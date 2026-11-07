//! Integrated Bun host: the browser owns a supervised Bun runtime that runs
//! `packages/yolo-agent/src/host.ts` (the agent bridge) against the browser's
//! own DevTools port.
//!
//! Contract with the TypeScript side (see `host.ts`):
//! * env `YOLO_CDP_PORT` carries the loopback DevTools port;
//! * the per-run bridge token travels on the child's stdin (first line), never
//!   in argv, and is never logged: every line that reaches the log or the
//!   receipt goes through [`Token::redact`];
//! * stdin closing means the browser is gone, the host shuts down;
//! * stdout carries one JSON line `{"event":"ready","port":N,...}` once the
//!   bridge listens.
//!
//! The supervisor restarts the host with exponential backoff up to a limit and
//! kills it when the browser exits: a Windows job object with
//! `KILL_ON_JOB_CLOSE`, `PR_SET_PDEATHSIG` on Linux, plus the stdin EOF above.

use std::{
    ffi::OsString,
    fmt,
    io::{BufRead, BufReader, Read, Write},
    net::{Ipv4Addr, SocketAddrV4, TcpStream},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex, MutexGuard,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

use serde::Serialize;

/// Switch that forces the host on.
pub const SWITCH_ENABLE: &str = "bun-host";
/// Switch that forces the host off.
pub const SWITCH_DISABLE: &str = "no-bun-host";
/// Environment variable naming the Bun binary.
pub const ENV_BUN: &str = "YOLO_BUN";
/// Environment variable naming the agent host entry (`host.ts`).
pub const ENV_ENTRY: &str = "YOLO_AGENT_ENTRY";
/// Entry path relative to the repository root.
pub const ENTRY_RELATIVE: &str = "packages/yolo-agent/src/host.ts";
/// Default restart limit.
pub const DEFAULT_MAX_RESTARTS: u32 = 5;
/// Smoke hold applied when the host is enabled so the bridge probe can finish.
pub const SMOKE_HOLD_MS: i64 = 10_000;

type EnvLookup<'a> = &'a dyn Fn(&str) -> Option<OsString>;

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

/// Per-run bridge token. `Debug` and `Display` never print the value.
#[derive(Clone, PartialEq, Eq)]
pub struct Token(String);

impl Token {
    /// 256 random bits from the operating system, hex encoded.
    pub fn generate() -> std::io::Result<Self> {
        let mut bytes = [0u8; 32];
        fill_random(&mut bytes)?;
        Ok(Self(
            bytes.iter().map(|byte| format!("{byte:02x}")).collect(),
        ))
    }

    /// Wraps an existing value (tests).
    pub fn from_string(value: String) -> Self {
        Self(value)
    }

    /// The secret. Callers must only hand it to the child's stdin and to the
    /// authorization header of loopback probes.
    pub fn expose(&self) -> &str {
        &self.0
    }

    /// Replaces every occurrence of the token in `text`.
    pub fn redact(&self, text: &str) -> String {
        if self.0.is_empty() {
            text.to_string()
        } else {
            text.replace(&self.0, "<redacted>")
        }
    }
}

impl fmt::Debug for Token {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Token(<redacted>)")
    }
}

impl fmt::Display for Token {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("<redacted>")
    }
}

#[cfg(unix)]
fn fill_random(buffer: &mut [u8]) -> std::io::Result<()> {
    std::fs::File::open("/dev/urandom")?.read_exact(buffer)
}

#[cfg(windows)]
fn fill_random(buffer: &mut [u8]) -> std::io::Result<()> {
    use windows_sys::Win32::Security::Cryptography::{
        BCryptGenRandom, BCRYPT_USE_SYSTEM_PREFERRED_RNG,
    };
    // SAFETY: the buffer is valid for `len` bytes; a null algorithm handle is
    // allowed together with BCRYPT_USE_SYSTEM_PREFERRED_RNG.
    let status = unsafe {
        BCryptGenRandom(
            std::ptr::null_mut(),
            buffer.as_mut_ptr(),
            buffer.len() as u32,
            BCRYPT_USE_SYSTEM_PREFERRED_RNG,
        )
    };
    if status == 0 {
        Ok(())
    } else {
        Err(std::io::Error::other(format!(
            "BCryptGenRandom failed: {status:#x}"
        )))
    }
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/// Where the Bun binary came from.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BunSource {
    Env,
    Bundled,
    Path,
}

impl BunSource {
    pub fn as_str(self) -> &'static str {
        match self {
            BunSource::Env => "env",
            BunSource::Bundled => "bundled",
            BunSource::Path => "path",
        }
    }
}

fn bun_file_name() -> &'static str {
    if cfg!(windows) {
        "bun.exe"
    } else {
        "bun"
    }
}

/// Resolves Bun: `YOLO_BUN`, then next to the executable (`bun`, `bun/bun`,
/// `bin/bun`), then `PATH`. `env` abstracts the environment for tests; no
/// user-specific path is ever consulted.
pub fn resolve_bun(env: EnvLookup<'_>, exe_dir: Option<&Path>) -> Option<(PathBuf, BunSource)> {
    if let Some(explicit) = env(ENV_BUN).filter(|value| !value.is_empty()) {
        let path = PathBuf::from(explicit);
        // An explicit choice is authoritative: no silent fallback.
        return path.is_file().then_some((path, BunSource::Env));
    }
    if let Some(dir) = exe_dir {
        let name = bun_file_name();
        for candidate in [
            dir.join(name),
            dir.join("bun").join(name),
            dir.join("bin").join(name),
        ] {
            if candidate.is_file() {
                return Some((candidate, BunSource::Bundled));
            }
        }
    }
    let path_var = env("PATH")?;
    std::env::split_paths(&path_var)
        .map(|dir| dir.join(bun_file_name()))
        .find(|candidate| candidate.is_file())
        .map(|path| (path, BunSource::Path))
}

/// Resolves the agent host entry: an explicit switch value, `YOLO_AGENT_ENTRY`,
/// then `packages/yolo-agent/src/host.ts` in an ancestor of the executable or
/// of the working directory, then the source tree this crate was built from.
pub fn resolve_entry(
    explicit: Option<&Path>,
    env: EnvLookup<'_>,
    exe_dir: Option<&Path>,
    cwd: Option<&Path>,
) -> Option<PathBuf> {
    if let Some(path) = explicit {
        return path.is_file().then(|| path.to_path_buf());
    }
    if let Some(value) = env(ENV_ENTRY).filter(|value| !value.is_empty()) {
        let path = PathBuf::from(value);
        return path.is_file().then_some(path);
    }
    let mut roots: Vec<PathBuf> = Vec::new();
    for start in [exe_dir, cwd].into_iter().flatten() {
        roots.extend(start.ancestors().map(Path::to_path_buf));
    }
    roots.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join(".."));
    roots
        .into_iter()
        .map(|root| root.join(ENTRY_RELATIVE))
        .find(|candidate| candidate.is_file())
}

/// First line of `bun --version`, if it runs.
pub fn bun_version(bun: &Path) -> Option<String> {
    let output = Command::new(bun).arg("--version").output().ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    let line = text.lines().next()?.trim();
    (output.status.success() && !line.is_empty()).then(|| line.chars().take(64).collect())
}

// ---------------------------------------------------------------------------
// Backoff
// ---------------------------------------------------------------------------

/// Exponential restart backoff with a ceiling.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Backoff {
    pub base_ms: u64,
    pub max_ms: u64,
    pub max_restarts: u32,
}

impl Default for Backoff {
    fn default() -> Self {
        Self {
            base_ms: 250,
            max_ms: 8_000,
            max_restarts: DEFAULT_MAX_RESTARTS,
        }
    }
}

impl Backoff {
    /// Delay before restart number `attempt` (0-based), or `None` once the
    /// restart budget is exhausted.
    pub fn delay(&self, attempt: u32) -> Option<Duration> {
        if attempt >= self.max_restarts {
            return None;
        }
        let factor = 1u64.checked_shl(attempt.min(32)).unwrap_or(u64::MAX);
        Some(Duration::from_millis(
            self.base_ms.saturating_mul(factor).min(self.max_ms),
        ))
    }
}

// ---------------------------------------------------------------------------
// Receipt / status
// ---------------------------------------------------------------------------

/// Result of the one-shot tool call made through the bridge.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolProbe {
    pub tool: &'static str,
    pub ok: bool,
    /// Redacted, truncated answer text or the error.
    pub detail: String,
}

/// The `bunHost` section of the smoke receipt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BunHostReceipt {
    pub enabled: bool,
    pub resolved: bool,
    pub source: Option<&'static str>,
    pub version: Option<String>,
    /// The literal `"redacted"` while a child runs, `null` otherwise.
    pub pid: Option<&'static str>,
    pub restarts: u32,
    pub gave_up: bool,
    pub bridge_ready: bool,
    pub bridge_port: Option<u16>,
    pub tool_probe: Option<ToolProbe>,
    pub reason: Option<String>,
}

impl BunHostReceipt {
    pub fn disabled(reason: impl Into<String>) -> Self {
        Self {
            enabled: false,
            resolved: false,
            source: None,
            version: None,
            pid: None,
            restarts: 0,
            gave_up: false,
            bridge_ready: false,
            bridge_port: None,
            tool_probe: None,
            reason: Some(reason.into()),
        }
    }
}

type Status = Arc<Mutex<BunHostReceipt>>;

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

static GLOBAL: Mutex<Option<Status>> = Mutex::new(None);

/// Registers the status that [`snapshot`] reports.
pub fn register(status: Status) {
    *lock(&GLOBAL) = Some(status);
}

/// Current `bunHost` receipt section; `None` before initialization.
pub fn snapshot() -> Option<BunHostReceipt> {
    lock(&GLOBAL).as_ref().map(|status| lock(status).clone())
}

// ---------------------------------------------------------------------------
// Supervisor
// ---------------------------------------------------------------------------

/// Everything the supervisor needs to run the host.
#[derive(Debug, Clone)]
pub struct HostConfig {
    pub bun: PathBuf,
    pub source: BunSource,
    pub entry: PathBuf,
    pub cdp_port: u16,
    pub profile_dir: Option<PathBuf>,
    pub backoff: Backoff,
    /// How long to wait for the DevTools port before the first start.
    pub cdp_wait: Duration,
    /// Uptime after which the consecutive-failure counter resets.
    pub stable_after: Duration,
}

/// Running supervisor. Dropping it stops the host.
pub struct BunHost {
    status: Status,
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl BunHost {
    /// Starts supervising. The DevTools port wait and every spawn happen on
    /// the supervisor thread, so this never blocks the browser start.
    pub fn start(config: HostConfig, token: Token) -> Self {
        let status = Arc::new(Mutex::new(BunHostReceipt {
            enabled: true,
            resolved: true,
            source: Some(config.source.as_str()),
            version: bun_version(&config.bun),
            reason: None,
            ..BunHostReceipt::disabled("")
        }));
        let stop = Arc::new(AtomicBool::new(false));
        let thread = {
            let (status, stop) = (status.clone(), stop.clone());
            thread::Builder::new()
                .name("bun-host-supervisor".into())
                .spawn(move || supervise(&config, &token, &status, &stop))
                .ok()
        };
        Self {
            status,
            stop,
            thread,
        }
    }

    pub fn status(&self) -> Status {
        self.status.clone()
    }

    pub fn snapshot(&self) -> BunHostReceipt {
        lock(&self.status).clone()
    }

    /// Stops the host and waits for the supervisor thread.
    pub fn stop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

impl Drop for BunHost {
    fn drop(&mut self) {
        self.stop();
    }
}

fn log(token: &Token, message: &str) {
    eprintln!("yolo-chromium: bun-host: {}", token.redact(message));
}

fn sleep_unless_stopped(duration: Duration, stop: &AtomicBool) {
    let deadline = Instant::now() + duration;
    while Instant::now() < deadline && !stop.load(Ordering::SeqCst) {
        thread::sleep(Duration::from_millis(25).min(duration));
    }
}

fn wait_for_port(port: u16, limit: Duration, stop: &AtomicBool) -> bool {
    let deadline = Instant::now() + limit;
    let address = SocketAddrV4::new(Ipv4Addr::LOCALHOST, port);
    loop {
        if TcpStream::connect_timeout(&address.into(), Duration::from_millis(200)).is_ok() {
            return true;
        }
        if stop.load(Ordering::SeqCst) || Instant::now() >= deadline {
            return false;
        }
        thread::sleep(Duration::from_millis(100));
    }
}

fn supervise(config: &HostConfig, token: &Token, status: &Status, stop: &AtomicBool) {
    let generation = Arc::new(AtomicU64::new(0));
    if !config.cdp_wait.is_zero() && !wait_for_port(config.cdp_port, config.cdp_wait, stop) {
        log(token, "DevTools port never opened; starting the host anyway");
    }
    let job = ProcessGroup::new();
    let mut attempt = 0u32;
    while !stop.load(Ordering::SeqCst) {
        let started = Instant::now();
        let id = generation.fetch_add(1, Ordering::SeqCst) + 1;
        match spawn(config, token, &job) {
            Err(error) => log(token, &format!("spawn failed: {error}")),
            Ok(mut running) => {
                lock(status).pid = Some("redacted");
                log(token, "started");
                let readers = running.attach_readers(token, status, &generation, id);
                let exit = loop {
                    if stop.load(Ordering::SeqCst) {
                        let _ = running.child.kill();
                        let _ = running.child.wait();
                        break None;
                    }
                    match running.child.try_wait() {
                        Ok(Some(exit)) => break Some(exit),
                        Ok(None) => thread::sleep(Duration::from_millis(50)),
                        Err(_) => break None,
                    }
                };
                drop(running.stdin.take());
                {
                    let mut guard = lock(status);
                    guard.pid = None;
                    guard.bridge_ready = false;
                }
                for reader in readers {
                    let _ = reader.join();
                }
                if let Some(exit) = exit {
                    log(token, &format!("exited unexpectedly: {exit}"));
                }
            }
        }
        if stop.load(Ordering::SeqCst) {
            break;
        }
        if started.elapsed() >= config.stable_after {
            attempt = 0;
        }
        match config.backoff.delay(attempt) {
            Some(delay) => {
                attempt += 1;
                lock(status).restarts += 1;
                log(
                    token,
                    &format!("restart {attempt} in {} ms", delay.as_millis()),
                );
                sleep_unless_stopped(delay, stop);
            }
            None => {
                lock(status).gave_up = true;
                log(token, "restart budget exhausted; giving up");
                break;
            }
        }
    }
    drop(job);
}

struct Running {
    child: Child,
    stdin: Option<ChildStdin>,
}

impl Running {
    fn attach_readers(
        &mut self,
        token: &Token,
        status: &Status,
        generation: &Arc<AtomicU64>,
        id: u64,
    ) -> Vec<JoinHandle<()>> {
        let mut readers = Vec::new();
        if let Some(stdout) = self.child.stdout.take() {
            let (token, status, generation) = (token.clone(), status.clone(), generation.clone());
            readers.push(thread::spawn(move || {
                for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                    match parse_ready(&line) {
                        Some(port) => on_ready(port, &token, &status, &generation, id),
                        None => log(&token, &format!("stdout: {line}")),
                    }
                }
            }));
        }
        if let Some(stderr) = self.child.stderr.take() {
            let token = token.clone();
            readers.push(thread::spawn(move || {
                for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                    log(&token, &format!("stderr: {line}"));
                }
            }));
        }
        readers
    }
}

fn spawn(config: &HostConfig, token: &Token, job: &ProcessGroup) -> std::io::Result<Running> {
    let mut command = Command::new(&config.bun);
    command
        .arg(&config.entry)
        .env("YOLO_CDP_PORT", config.cdp_port.to_string())
        .env_remove("YOLO_BRIDGE_TOKEN")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(profile) = &config.profile_dir {
        command.env("YOLO_AGENT_PROFILE", profile);
    }
    prepare_command(&mut command);
    let mut child = command.spawn()?;
    job.adopt(&child);
    let mut stdin = child.stdin.take();
    if let Some(pipe) = stdin.as_mut() {
        pipe.write_all(token.expose().as_bytes())?;
        pipe.write_all(b"\n")?;
        pipe.flush()?;
    }
    Ok(Running { child, stdin })
}

/// Port from a `{"event":"ready","port":N}` line.
pub fn parse_ready(line: &str) -> Option<u16> {
    let value: serde_json::Value = serde_json::from_str(line.trim()).ok()?;
    if value.get("event")?.as_str()? != "ready" {
        return None;
    }
    u16::try_from(value.get("port")?.as_u64()?)
        .ok()
        .filter(|port| *port > 0)
}

fn on_ready(port: u16, token: &Token, status: &Status, generation: &AtomicU64, id: u64) {
    let current =
        |status: &Status| generation.load(Ordering::SeqCst) == id && lock(status).pid.is_some();
    // /health needs no token and proves the loopback listener answers.
    let mut healthy = false;
    for _ in 0..20 {
        if let Ok((200, _)) = http(port, "GET", "/health", None, None) {
            healthy = true;
            break;
        }
        thread::sleep(Duration::from_millis(100));
    }
    if !healthy || !current(status) {
        return;
    }
    {
        let mut guard = lock(status);
        guard.bridge_ready = true;
        guard.bridge_port = Some(port);
    }
    log(token, &format!("bridge ready on 127.0.0.1:{port}"));
    let probe = call_browser_tabs(port, token);
    log(
        token,
        &format!(
            "tool browser_tabs {}",
            if probe.ok { "answered" } else { "failed" }
        ),
    );
    if current(status) {
        lock(status).tool_probe = Some(probe);
    }
}

const TABS_CALL: &str = r#"{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"browser_tabs","arguments":{"op":"list"}}}"#;

/// One `tools/call browser_tabs` through the bridge's MCP endpoint.
pub fn call_browser_tabs(port: u16, token: &Token) -> ToolProbe {
    let (ok, detail) = match http(port, "POST", "/mcp", Some(token), Some(TABS_CALL)) {
        Ok((200, body)) => match serde_json::from_str::<serde_json::Value>(&body) {
            Ok(value) => {
                let is_error = value["result"]["isError"].as_bool().unwrap_or(true);
                let text = value["result"]["content"][0]["text"]
                    .as_str()
                    .or_else(|| value["error"]["message"].as_str())
                    .unwrap_or("");
                (value.get("result").is_some() && !is_error, text.to_string())
            }
            Err(error) => (false, format!("unparseable response: {error}")),
        },
        Ok((code, _)) => (false, format!("HTTP {code}")),
        Err(error) => (false, error),
    };
    ToolProbe {
        tool: "browser_tabs",
        ok,
        detail: token.redact(&detail).chars().take(200).collect(),
    }
}

/// Minimal loopback HTTP/1.1 client (`Connection: close`).
fn http(
    port: u16,
    method: &str,
    path: &str,
    token: Option<&Token>,
    body: Option<&str>,
) -> Result<(u16, String), String> {
    let address = SocketAddrV4::new(Ipv4Addr::LOCALHOST, port);
    let timeout = Duration::from_secs(20);
    let mut stream = TcpStream::connect_timeout(&address.into(), Duration::from_secs(2))
        .map_err(|error| format!("connect: {error}"))?;
    stream.set_read_timeout(Some(timeout)).ok();
    stream.set_write_timeout(Some(timeout)).ok();
    let mut request = format!(
        "{method} {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\nAccept: application/json\r\n"
    );
    if let Some(token) = token {
        request.push_str(&format!("Authorization: Bearer {}\r\n", token.expose()));
    }
    if let Some(body) = body {
        request.push_str(&format!(
            "Content-Type: application/json\r\nContent-Length: {}\r\n",
            body.len()
        ));
    }
    request.push_str("\r\n");
    if let Some(body) = body {
        request.push_str(body);
    }
    stream
        .write_all(request.as_bytes())
        .map_err(|error| format!("write: {error}"))?;
    let mut raw = Vec::new();
    stream
        .read_to_end(&mut raw)
        .map_err(|error| format!("read: {error}"))?;
    let text = String::from_utf8_lossy(&raw);
    let (head, body) = text
        .split_once("\r\n\r\n")
        .ok_or_else(|| "malformed response".to_string())?;
    let code = head
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|code| code.parse().ok())
        .ok_or_else(|| "malformed status line".to_string())?;
    let body = if head
        .to_ascii_lowercase()
        .contains("transfer-encoding: chunked")
    {
        dechunk(body)
    } else {
        body.to_string()
    };
    Ok((code, body))
}

fn dechunk(body: &str) -> String {
    let mut out = String::new();
    let mut rest = body;
    while let Some((size_line, tail)) = rest.split_once("\r\n") {
        let size = usize::from_str_radix(size_line.split(';').next().unwrap_or("").trim(), 16)
            .unwrap_or(0);
        if size == 0 || tail.len() < size {
            break;
        }
        out.push_str(&tail[..size]);
        rest = tail[size..].trim_start_matches("\r\n");
    }
    out
}

// ---------------------------------------------------------------------------
// Parent-death handling
// ---------------------------------------------------------------------------

#[cfg(unix)]
fn prepare_command(command: &mut Command) {
    use std::os::unix::process::CommandExt;
    // SAFETY: only async-signal-safe calls (prctl, getppid, _exit) run between
    // fork and exec. PR_SET_PDEATHSIG tracks the spawning thread, which is the
    // long-lived supervisor thread.
    unsafe {
        let parent = libc::getpid();
        command.pre_exec(move || {
            #[cfg(target_os = "linux")]
            {
                libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGKILL);
                if libc::getppid() != parent {
                    libc::_exit(1);
                }
            }
            let _ = parent;
            Ok(())
        });
    }
}

#[cfg(not(unix))]
fn prepare_command(_command: &mut Command) {}

/// Windows job object (`KILL_ON_JOB_CLOSE`); a no-op elsewhere.
#[cfg(windows)]
struct ProcessGroup(windows_sys::Win32::Foundation::HANDLE);

// SAFETY: a job handle is usable from any thread.
#[cfg(windows)]
unsafe impl Send for ProcessGroup {}

#[cfg(windows)]
impl ProcessGroup {
    fn new() -> Self {
        use windows_sys::Win32::System::JobObjects::{
            CreateJobObjectW, JobObjectExtendedLimitInformation, SetInformationJobObject,
            JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        };
        // SAFETY: plain Win32 calls with valid, zero-initialized structures.
        unsafe {
            let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if !handle.is_null() {
                let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                SetInformationJobObject(
                    handle,
                    JobObjectExtendedLimitInformation,
                    (&raw const info).cast(),
                    std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                );
            }
            Self(handle)
        }
    }

    fn adopt(&self, child: &Child) {
        use std::os::windows::io::AsRawHandle;
        use windows_sys::Win32::System::JobObjects::AssignProcessToJobObject;
        if !self.0.is_null() {
            // SAFETY: both handles are valid for the call.
            unsafe { AssignProcessToJobObject(self.0, child.as_raw_handle()) };
        }
    }
}

#[cfg(windows)]
impl Drop for ProcessGroup {
    fn drop(&mut self) {
        if !self.0.is_null() {
            // SAFETY: the handle was created by CreateJobObjectW and is closed once.
            unsafe { windows_sys::Win32::Foundation::CloseHandle(self.0) };
        }
    }
}

#[cfg(not(windows))]
struct ProcessGroup;

#[cfg(not(windows))]
impl ProcessGroup {
    fn new() -> Self {
        Self
    }
    fn adopt(&self, _child: &Child) {}
}

// ---------------------------------------------------------------------------
// Shell integration
// ---------------------------------------------------------------------------

/// Requested mode from the command line.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    /// `--bun-host`: start, report failures loudly.
    On,
    /// `--no-bun-host`.
    Off,
    /// Neither switch: start only for non-smoke runs that already expose a
    /// DevTools port, when both Bun and the entry resolve.
    Auto,
}

impl Mode {
    pub fn from_switches(enable: bool, disable: bool) -> Self {
        match (enable, disable) {
            (_, true) => Mode::Off,
            (true, false) => Mode::On,
            (false, false) => Mode::Auto,
        }
    }
}

/// Picks a free loopback port.
pub fn free_port() -> Option<u16> {
    std::net::TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
        .ok()?
        .local_addr()
        .ok()
        .map(|address| address.port())
}

/// Inputs for [`plan`].
pub struct PlanInput<'a> {
    pub mode: Mode,
    pub is_smoke: bool,
    pub cdp_port: Option<u16>,
    pub cache_path: Option<&'a Path>,
    pub entry_switch: Option<PathBuf>,
    pub max_restarts: Option<u32>,
}

/// Outcome of planning: either a config to run or the receipt to report.
pub enum Plan {
    Run(Box<HostConfig>),
    Skip(BunHostReceipt),
}

/// Pure decision (given resolvers) so the policy is unit-testable.
pub fn plan(
    input: &PlanInput<'_>,
    env: EnvLookup<'_>,
    exe_dir: Option<&Path>,
    cwd: Option<&Path>,
    allocate_port: &dyn Fn() -> Option<u16>,
) -> Plan {
    if input.mode == Mode::Off {
        return Plan::Skip(BunHostReceipt::disabled("--no-bun-host"));
    }
    if input.mode == Mode::Auto && (input.is_smoke || input.cdp_port.is_none()) {
        return Plan::Skip(BunHostReceipt::disabled(
            "auto mode needs a non-smoke run with --remote-debugging-port; pass --bun-host",
        ));
    }
    let Some((bun, source)) = resolve_bun(env, exe_dir) else {
        return Plan::Skip(BunHostReceipt::disabled(
            "bun not found (YOLO_BUN, bundled next to the executable, or PATH)",
        ));
    };
    let Some(entry) = resolve_entry(input.entry_switch.as_deref(), env, exe_dir, cwd) else {
        let mut receipt =
            BunHostReceipt::disabled(format!("agent entry {ENTRY_RELATIVE} not found"));
        receipt.resolved = true;
        receipt.source = Some(source.as_str());
        return Plan::Skip(receipt);
    };
    let Some(cdp_port) = input.cdp_port.or_else(allocate_port) else {
        return Plan::Skip(BunHostReceipt::disabled("no free DevTools port"));
    };
    let profile_dir = input
        .cache_path
        .map(|path| path.join("yolo-agent"))
        .or_else(|| {
            Some(std::env::temp_dir().join(format!("yolo-chromium-agent-{}", std::process::id())))
        });
    Plan::Run(Box::new(HostConfig {
        bun,
        source,
        entry,
        cdp_port,
        profile_dir,
        backoff: Backoff {
            max_restarts: input.max_restarts.unwrap_or(DEFAULT_MAX_RESTARTS),
            ..Backoff::default()
        },
        cdp_wait: Duration::from_secs(30),
        stable_after: Duration::from_secs(60),
    }))
}

/// Reads the `--bun-host` switches, decides, and starts the supervisor.
/// Sets `config.remote_debugging_port` when the host needs a port of its own
/// and extends the smoke hold so the bridge probe finishes before the receipt.
pub fn start_from_command_line(
    config: &mut crate::config::ShellConfig,
    command_line: &cef::CommandLine,
) -> Option<BunHost> {
    use cef::{CefString, ImplCommandLine};
    let has = |name: &str| command_line.has_switch(Some(&CefString::from(name))) != 0;
    let value = |name: &str| -> Option<String> {
        has(name)
            .then(|| {
                CefString::from(&command_line.switch_value(Some(&CefString::from(name))))
                    .to_string()
            })
            .filter(|value| !value.is_empty())
    };
    let exe = std::env::current_exe().ok();
    let exe_dir = exe.as_deref().and_then(Path::parent);
    let cwd = std::env::current_dir().ok();
    let input = PlanInput {
        mode: Mode::from_switches(has(SWITCH_ENABLE), has(SWITCH_DISABLE)),
        is_smoke: config.smoke.is_some(),
        cdp_port: config.remote_debugging_port,
        cache_path: config.cache_path.as_deref(),
        entry_switch: value("bun-entry").map(PathBuf::from),
        max_restarts: value("bun-max-restarts").and_then(|raw| raw.parse().ok()),
    };
    let explicit = input.mode == Mode::On;
    match plan(
        &input,
        &|name| std::env::var_os(name),
        exe_dir,
        cwd.as_deref(),
        &free_port,
    ) {
        Plan::Skip(receipt) => {
            if explicit {
                eprintln!(
                    "yolo-chromium: bun-host: not started: {}",
                    receipt.reason.as_deref().unwrap_or("unknown")
                );
            }
            register(Arc::new(Mutex::new(receipt)));
            None
        }
        Plan::Run(host) => {
            let token = match Token::generate() {
                Ok(token) => token,
                Err(error) => {
                    eprintln!("yolo-chromium: bun-host: no random token: {error}");
                    register(Arc::new(Mutex::new(BunHostReceipt::disabled(
                        "no random token",
                    ))));
                    return None;
                }
            };
            config.remote_debugging_port = Some(host.cdp_port);
            if let Some(smoke) = config.smoke.as_mut() {
                smoke.hold_ms = smoke.hold_ms.max(SMOKE_HOLD_MS);
            }
            let supervisor = BunHost::start(*host, token);
            register(supervisor.status());
            Some(supervisor)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("yolo-bun-host-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn touch(path: &Path) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, b"").unwrap();
    }

    #[test]
    fn token_is_random_hex_and_never_printed() {
        let a = Token::generate().unwrap();
        let b = Token::generate().unwrap();
        assert_eq!(a.expose().len(), 64);
        assert!(a.expose().bytes().all(|byte| byte.is_ascii_hexdigit()));
        assert_ne!(a, b);
        assert!(!format!("{a:?}").contains(a.expose()));
        assert!(!format!("{a}").contains(a.expose()));
    }

    #[test]
    fn redact_replaces_every_occurrence() {
        let token = Token::from_string("s3cret-token-value".into());
        let out = token.redact("Bearer s3cret-token-value and again s3cret-token-value");
        assert!(!out.contains("s3cret"));
        assert_eq!(out.matches("<redacted>").count(), 2);
        assert_eq!(Token::from_string(String::new()).redact("x"), "x");
    }

    #[test]
    fn probe_detail_is_redacted_and_truncated() {
        let token = Token::from_string("abc123abc123abc123".into());
        let long = format!("{} {}", token.expose(), "x".repeat(500));
        let detail: String = token.redact(&long).chars().take(200).collect();
        assert!(!detail.contains(token.expose()));
        assert_eq!(detail.chars().count(), 200);
    }

    #[test]
    fn backoff_doubles_caps_and_stops() {
        let backoff = Backoff {
            base_ms: 100,
            max_ms: 500,
            max_restarts: 5,
        };
        let delays: Vec<_> = (0..6)
            .map(|attempt| backoff.delay(attempt).map(|d| d.as_millis()))
            .collect();
        assert_eq!(
            delays,
            vec![Some(100), Some(200), Some(400), Some(500), Some(500), None]
        );
        let none = Backoff {
            max_restarts: 0,
            ..backoff
        };
        assert_eq!(none.delay(0), None);
        let huge = Backoff {
            base_ms: u64::MAX,
            ..backoff
        };
        assert_eq!(huge.delay(4), Some(Duration::from_millis(500)));
    }

    #[test]
    fn bun_resolution_prefers_env_then_bundled_then_path() {
        let root = scratch("resolve");
        let name = bun_file_name();
        let env_bun = root.join("custom").join(name);
        let bundled_dir = root.join("app");
        let path_dir = root.join("pathdir");
        touch(&env_bun);
        touch(&bundled_dir.join(name));
        touch(&path_dir.join(name));
        let path_var = std::env::join_paths([&path_dir]).unwrap();
        let env_with = |yolo_bun: Option<PathBuf>| {
            let path_var = path_var.clone();
            move |key: &str| -> Option<OsString> {
                match key {
                    "YOLO_BUN" => yolo_bun.clone().map(PathBuf::into_os_string),
                    "PATH" => Some(path_var.clone()),
                    _ => None,
                }
            }
        };
        assert_eq!(
            resolve_bun(&env_with(Some(env_bun.clone())), Some(&bundled_dir)),
            Some((env_bun.clone(), BunSource::Env))
        );
        assert_eq!(
            resolve_bun(&env_with(None), Some(&bundled_dir)),
            Some((bundled_dir.join(name), BunSource::Bundled))
        );
        assert_eq!(
            resolve_bun(&env_with(None), Some(&root.join("empty"))),
            Some((path_dir.join(name), BunSource::Path))
        );
        // A bad explicit YOLO_BUN does not fall back silently.
        assert_eq!(
            resolve_bun(
                &env_with(Some(root.join("missing"))),
                Some(&bundled_dir)
            ),
            None
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn entry_resolution_walks_ancestors_and_honors_override() {
        let root = scratch("entry");
        let entry = root.join(ENTRY_RELATIVE);
        touch(&entry);
        let none = |_: &str| -> Option<OsString> { None };
        let deep = root.join("target").join("release");
        fs::create_dir_all(&deep).unwrap();
        assert_eq!(
            resolve_entry(None, &none, Some(&deep), None),
            Some(entry.clone())
        );
        let override_env = |key: &str| (key == ENV_ENTRY).then(|| entry.clone().into_os_string());
        assert_eq!(
            resolve_entry(None, &override_env, None, None),
            Some(entry.clone())
        );
        assert_eq!(
            resolve_entry(Some(&root.join("nope.ts")), &none, Some(&deep), None),
            None
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn parse_ready_accepts_only_ready_events() {
        assert_eq!(
            parse_ready(
                r#"{"event":"ready","url":"http://127.0.0.1:4242","port":4242,"bun":"1.4.4"}"#
            ),
            Some(4242)
        );
        assert_eq!(parse_ready(r#"{"event":"log","port":1}"#), None);
        assert_eq!(parse_ready(r#"{"event":"ready","port":0}"#), None);
        assert_eq!(parse_ready("plain text"), None);
    }

    #[test]
    fn receipt_serializes_camel_case_with_redacted_pid() {
        let mut receipt = BunHostReceipt::disabled("x");
        receipt.enabled = true;
        receipt.pid = Some("redacted");
        receipt.bridge_ready = true;
        let json = serde_json::to_string(&receipt).unwrap();
        assert!(json.contains("\"bridgeReady\":true"));
        assert!(json.contains("\"pid\":\"redacted\""));
        assert!(json.contains("\"gaveUp\":false"));
    }

    #[test]
    fn plan_policy() {
        let root = scratch("plan");
        let name = bun_file_name();
        touch(&root.join("bin").join(name));
        touch(&root.join(ENTRY_RELATIVE));
        let env = |_: &str| -> Option<OsString> { None };
        let input = |mode, is_smoke, cdp_port| PlanInput {
            mode,
            is_smoke,
            cdp_port,
            cache_path: None,
            entry_switch: None,
            max_restarts: Some(2),
        };
        let run = |input: &PlanInput<'_>, exe_dir: &Path| {
            plan(input, &env, Some(exe_dir), None, &|| Some(9555))
        };
        let exe_dir = root.join("bin");
        assert!(
            matches!(run(&input(Mode::Off, false, Some(1)), &exe_dir), Plan::Skip(r) if !r.enabled)
        );
        // Auto: not for smoke runs or without a DevTools port.
        assert!(matches!(
            run(&input(Mode::Auto, true, Some(1)), &exe_dir),
            Plan::Skip(_)
        ));
        assert!(matches!(
            run(&input(Mode::Auto, false, None), &exe_dir),
            Plan::Skip(_)
        ));
        match run(&input(Mode::Auto, false, Some(9222)), &exe_dir) {
            Plan::Run(config) => {
                assert_eq!(config.cdp_port, 9222);
                assert_eq!(config.backoff.max_restarts, 2);
                assert_eq!(config.source, BunSource::Bundled);
            }
            Plan::Skip(r) => panic!("expected run: {r:?}"),
        }
        // On allocates a port when none was given.
        match run(&input(Mode::On, true, None), &exe_dir) {
            Plan::Run(config) => assert_eq!(config.cdp_port, 9555),
            Plan::Skip(r) => panic!("expected run: {r:?}"),
        }
        // Missing bun is reported, not fatal.
        let empty = root.join("nowhere");
        fs::create_dir_all(&empty).unwrap();
        match run(&input(Mode::On, false, Some(1)), &empty) {
            Plan::Skip(r) => assert!(r.reason.unwrap().contains("bun not found")),
            Plan::Run(_) => panic!("bun should not resolve"),
        }
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn mode_switches() {
        assert_eq!(Mode::from_switches(true, false), Mode::On);
        assert_eq!(Mode::from_switches(true, true), Mode::Off);
        assert_eq!(Mode::from_switches(false, false), Mode::Auto);
    }

    #[test]
    fn dechunk_joins_chunks() {
        assert_eq!(
            dechunk("5\r\nhello\r\n6\r\n world\r\n0\r\n\r\n"),
            "hello world"
        );
    }
}
