//! Launcher command line and host process control.

use std::path::{Path, PathBuf};

use crate::engine_info;

pub mod devtools;
pub mod runtime;

/// Exit code when the launcher itself fails (bad arguments, missing files).
pub const EXIT_LAUNCHER_ERROR: i32 = 64;
/// Exit code when the host process exceeded `--launcher-timeout-ms`.
pub const EXIT_HOST_TIMEOUT: i32 = 4;
/// Extra time granted to the host beyond the smoke timeout.
const SMOKE_GRACE_MS: u64 = 20_000;
/// Default `--smoke-timeout-ms`, mirrored from the shell.
const DEFAULT_SMOKE_TIMEOUT_MS: u64 = 30_000;
/// Hold applied to smoke runs with a DevTools port so the probe can connect.
const DEFAULT_SMOKE_HOLD_MS: u64 = 1_500;

const USAGE: &str = "\
yolo-chromium - upstream Chromium browser shell (CEF) for YOLO-Web

Usage: yolo-chromium [launcher options] [chromium switches]

Launcher options:
  --engine-version            Print the linked CEF/Chromium build facts as JSON and exit
  --prepare-runtime           Prepare the runtime directory and exit
  --runtime-dir=<dir>         Runtime directory (default: <exe dir>/yolo-chromium-runtime)
  --cef-dir=<dir>             CEF distribution directory (default: build-time directory)
  --host=bootstrapc|bootstrap Console (default) or windows-subsystem CEF bootstrap
  --launcher-timeout-ms=<n>   Kill the host after n milliseconds (exit code 4)
  -h, --help                  Show this help

Shell switches (forwarded to the host):
  --url=<url>                 Page to open (default https://www.google.com/)
  --cache-path=<dir>          Profile directory (default per-user; empty = in-memory)
  --remote-debugging-port=<n> Expose the Chrome DevTools Protocol
  --window-size=WxH           Initial window size (default 1280x800)
  --initial-show-state=normal|minimized|maximized
  --use-alloy-style           Alloy runtime style instead of Chrome style
  --use-native                Native window instead of the Views framework
  --lang=<locale> --log-file=<path> --log-severity=<level> --no-sandbox
  --smoke                     Load the page, print and write a receipt, exit
  --smoke-timeout-ms=<n>      Smoke timeout (default 30000)
  --smoke-hold-ms=<n>         Keep the page open n ms after load (default 1500 with a DevTools port)
  --receipt=<path>            Receipt file for --smoke (e.g. engines/cef.lock.json)

Any other switch is passed to Chromium unchanged.
";

/// Which CEF bootstrap executable hosts the shell DLL.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HostKind {
    /// `bootstrapc.exe`: console subsystem, stdout attached.
    Console,
    /// `bootstrap.exe`: windows subsystem, no console.
    Windows,
}

impl HostKind {
    pub fn bootstrap_file_name(self) -> &'static str {
        match self {
            HostKind::Console => "bootstrapc.exe",
            HostKind::Windows => "bootstrap.exe",
        }
    }

    /// Base name of the host executable and DLL inside the runtime directory.
    pub fn app_base_name(self) -> &'static str {
        match self {
            HostKind::Console => "yolo-chromium",
            HostKind::Windows => "yolo-chromium-win",
        }
    }
}

/// Parsed launcher options.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LauncherOptions {
    pub engine_version: bool,
    pub prepare_only: bool,
    pub help: bool,
    pub runtime_dir: Option<PathBuf>,
    pub cef_dir: Option<PathBuf>,
    pub host: HostKind,
    pub timeout_ms: Option<u64>,
    pub smoke: bool,
    pub smoke_timeout_ms: u64,
    /// `--smoke-hold-ms` forwarded to the host.
    pub smoke_hold_ms: Option<u64>,
    /// `--remote-debugging-port` forwarded to the host, probed by the launcher.
    pub remote_debugging_port: Option<u16>,
    /// `--receipt` path (absolute) forwarded to the host.
    pub receipt: Option<PathBuf>,
    /// Switches forwarded to the host, with file paths made absolute.
    pub forwarded: Vec<String>,
}

impl Default for LauncherOptions {
    fn default() -> Self {
        Self {
            engine_version: false,
            prepare_only: false,
            help: false,
            runtime_dir: None,
            cef_dir: None,
            host: HostKind::Console,
            timeout_ms: None,
            smoke: false,
            smoke_timeout_ms: DEFAULT_SMOKE_TIMEOUT_MS,
            smoke_hold_ms: None,
            remote_debugging_port: None,
            receipt: None,
            forwarded: Vec::new(),
        }
    }
}

/// Switches whose values are paths resolved against the launcher's working
/// directory before the host changes directory.
const PATH_SWITCHES: &[&str] = &["--receipt", "--cache-path", "--log-file"];

/// Parses launcher arguments; `cwd` anchors relative path switches.
pub fn parse_args(args: &[String], cwd: &Path) -> Result<LauncherOptions, String> {
    let mut options = LauncherOptions::default();
    for arg in args {
        let (name, value) = match arg.split_once('=') {
            Some((name, value)) => (name, Some(value)),
            None => (arg.as_str(), None),
        };
        match name {
            "-h" | "--help" => options.help = true,
            "--engine-version" => options.engine_version = true,
            "--prepare-runtime" => options.prepare_only = true,
            "--runtime-dir" => options.runtime_dir = Some(absolute(required(name, value)?, cwd)),
            "--cef-dir" => options.cef_dir = Some(absolute(required(name, value)?, cwd)),
            "--host" => {
                options.host = match required(name, value)? {
                    "bootstrapc" | "console" => HostKind::Console,
                    "bootstrap" | "windows" => HostKind::Windows,
                    other => return Err(format!("unknown --host value: {other}")),
                }
            }
            "--launcher-timeout-ms" => {
                options.timeout_ms = Some(parse_u64(name, required(name, value)?)?)
            }
            "--smoke" => {
                options.smoke = true;
                options.forwarded.push(arg.clone());
            }
            "--smoke-timeout-ms" => {
                options.smoke_timeout_ms = parse_u64(name, required(name, value)?)?;
                options.forwarded.push(arg.clone());
            }
            "--smoke-hold-ms" => {
                options.smoke_hold_ms = Some(parse_u64(name, required(name, value)?)?);
                options.forwarded.push(arg.clone());
            }
            "--remote-debugging-port" => {
                let port = parse_u64(name, required(name, value)?)?;
                options.remote_debugging_port = u16::try_from(port).ok().filter(|port| *port > 0);
                options.forwarded.push(arg.clone());
            }
            _ if PATH_SWITCHES.contains(&name) && value.is_some_and(|value| !value.is_empty()) => {
                let path = absolute(value.unwrap_or_default(), cwd);
                if name == "--receipt" {
                    options.receipt = Some(path.clone());
                }
                options
                    .forwarded
                    .push(format!("{name}={}", path.to_string_lossy()));
            }
            _ => options.forwarded.push(arg.clone()),
        }
    }
    if options.smoke && options.remote_debugging_port.is_some() && options.smoke_hold_ms.is_none() {
        options.smoke_hold_ms = Some(DEFAULT_SMOKE_HOLD_MS);
        options
            .forwarded
            .push(format!("--smoke-hold-ms={DEFAULT_SMOKE_HOLD_MS}"));
    }
    if options.smoke && options.timeout_ms.is_none() {
        options.timeout_ms =
            Some(options.smoke_timeout_ms + options.smoke_hold_ms.unwrap_or(0) + SMOKE_GRACE_MS);
    }
    Ok(options)
}

fn required<'a>(name: &str, value: Option<&'a str>) -> Result<&'a str, String> {
    value
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("{name} requires a value ({name}=<value>)"))
}

fn parse_u64(name: &str, value: &str) -> Result<u64, String> {
    value
        .parse()
        .map_err(|_| format!("{name} expects a non-negative integer, got {value:?}"))
}

fn absolute(value: &str, cwd: &Path) -> PathBuf {
    let path = PathBuf::from(value);
    if path.is_absolute() {
        path
    } else {
        cwd.join(path)
    }
}

/// Runs the launcher and returns the process exit code.
pub fn run(args: Vec<String>) -> i32 {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let options = match parse_args(&args, &cwd) {
        Ok(options) => options,
        Err(error) => {
            eprintln!("yolo-chromium: {error}\n\n{USAGE}");
            return EXIT_LAUNCHER_ERROR;
        }
    };
    if options.help {
        print!("{USAGE}");
        return 0;
    }
    if options.engine_version {
        let build = engine_info::build_info();
        match serde_json::to_string_pretty(&build) {
            Ok(json) => println!("{json}"),
            Err(error) => {
                eprintln!("yolo-chromium: {error}");
                return EXIT_LAUNCHER_ERROR;
            }
        }
        return 0;
    }
    match launch(&options) {
        Ok(code) => code,
        Err(error) => {
            eprintln!("yolo-chromium: {error}");
            EXIT_LAUNCHER_ERROR
        }
    }
}

#[cfg(target_os = "windows")]
fn launch(options: &LauncherOptions) -> Result<i32, String> {
    use std::{
        process::Command,
        time::{Duration, Instant},
    };

    let exe = std::env::current_exe().map_err(|error| format!("current_exe: {error}"))?;
    let exe_dir = exe
        .parent()
        .ok_or_else(|| "launcher has no parent directory".to_string())?;
    let cef_dir = options
        .cef_dir
        .clone()
        .or_else(|| std::env::var_os("YOLO_CHROMIUM_CEF_DIR").map(PathBuf::from))
        .unwrap_or_else(|| PathBuf::from(engine_info::CEF_DISTRIBUTION_DIR));
    let client_dll = exe_dir.join("yolo_chromium.dll");
    let runtime_dir = options
        .runtime_dir
        .clone()
        .unwrap_or_else(|| exe_dir.join("yolo-chromium-runtime"));

    let layout = runtime::prepare(&cef_dir, &client_dll, &runtime_dir, options.host)?;
    if options.prepare_only {
        println!("{}", layout.dir.display());
        return Ok(0);
    }

    eprintln!(
        "yolo-chromium: starting {} {}",
        layout.host_exe.display(),
        options.forwarded.join(" ")
    );
    let mut child = Command::new(&layout.host_exe)
        .args(&options.forwarded)
        .current_dir(&layout.dir)
        .spawn()
        .map_err(|error| format!("failed to start {}: {error}", layout.host_exe.display()))?;

    let probe = options
        .remote_debugging_port
        .map(devtools::ProbeTask::start);

    let wait_result = match options.timeout_ms {
        None => child
            .wait()
            .map(Some)
            .map_err(|error| format!("waiting for host: {error}")),
        Some(timeout_ms) => {
            let deadline = Instant::now() + Duration::from_millis(timeout_ms);
            loop {
                match child.try_wait() {
                    Ok(Some(status)) => break Ok(Some(status)),
                    Ok(None) => {}
                    Err(error) => break Err(format!("waiting for host: {error}")),
                }
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    eprintln!("yolo-chromium: host exceeded {timeout_ms} ms and was terminated");
                    break Ok(None);
                }
                std::thread::sleep(Duration::from_millis(50));
            }
        }
    };

    let probe_result = probe.and_then(devtools::ProbeTask::finish);
    if let Some(probe) = &probe_result {
        eprintln!(
            "yolo-chromium: DevTools {} on port {} ({})",
            probe.browser, probe.port, probe.web_socket_debugger_url
        );
    }
    if let (Some(path), Some(probe)) = (&options.receipt, &probe_result) {
        if let Err(error) = devtools::attach_to_receipt(path, probe) {
            eprintln!(
                "yolo-chromium: could not update {}: {error}",
                path.display()
            );
        }
    }

    match wait_result? {
        Some(status) => Ok(status.code().unwrap_or(1)),
        None => Ok(EXIT_HOST_TIMEOUT),
    }
}

#[cfg(not(target_os = "windows"))]
fn launch(options: &LauncherOptions) -> Result<i32, String> {
    if options.prepare_only {
        return Err("--prepare-runtime is only meaningful on Windows".to_string());
    }
    Ok(yolo_chromium::run_in_process())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(args: &[&str]) -> LauncherOptions {
        let args: Vec<String> = args.iter().map(|arg| arg.to_string()).collect();
        parse_args(&args, Path::new("/work")).expect("valid args")
    }

    #[test]
    fn forwards_unknown_switches_and_resolves_paths() {
        let options = parse(&[
            "--url=https://example.com",
            "--receipt=engines/cef.lock.json",
            "--enable-features=Foo",
            "--host=bootstrap",
        ]);
        assert_eq!(options.host, HostKind::Windows);
        assert_eq!(options.forwarded[0], "--url=https://example.com");
        assert!(options.forwarded[1].starts_with("--receipt="));
        assert!(options.forwarded[1].ends_with("cef.lock.json"));
        assert!(options.forwarded[1].contains("work"));
        assert_eq!(options.forwarded[2], "--enable-features=Foo");
    }

    #[test]
    fn smoke_sets_a_launcher_timeout() {
        let options = parse(&["--smoke", "--smoke-timeout-ms=1000"]);
        assert!(options.smoke);
        assert_eq!(options.timeout_ms, Some(1000 + SMOKE_GRACE_MS));
        assert_eq!(
            options.forwarded,
            vec!["--smoke", "--smoke-timeout-ms=1000"]
        );
        let held = parse(&["--smoke", "--remote-debugging-port=9333"]);
        assert_eq!(held.remote_debugging_port, Some(9333));
        assert_eq!(held.smoke_hold_ms, Some(DEFAULT_SMOKE_HOLD_MS));
        assert!(held
            .forwarded
            .contains(&format!("--smoke-hold-ms={DEFAULT_SMOKE_HOLD_MS}")));
        assert_eq!(
            held.timeout_ms,
            Some(DEFAULT_SMOKE_TIMEOUT_MS + DEFAULT_SMOKE_HOLD_MS + SMOKE_GRACE_MS)
        );
    }

    #[test]
    fn rejects_bad_values() {
        let args = vec!["--host=other".to_string()];
        assert!(parse_args(&args, Path::new("/")).is_err());
        let args = vec!["--launcher-timeout-ms=soon".to_string()];
        assert!(parse_args(&args, Path::new("/")).is_err());
        let args = vec!["--runtime-dir".to_string()];
        assert!(parse_args(&args, Path::new("/")).is_err());
    }
}
