//! Browser-process shell: CEF application, client handlers, and Views window
//! delegates. All CEF callbacks arrive on the UI thread; shared state lives in
//! a mutex that is never held across a CEF call that can re-enter a handler.

use std::{
    cell::RefCell,
    sync::{Arc, Mutex, MutexGuard},
    time::Instant,
};

#[allow(clippy::wildcard_imports)]
use cef::*;

use crate::{
    config::{InitialShowState, ShellConfig},
    engine_info,
    receipt::{self, ColorCheck, Receipt, ShellInfo, SmokeError, SmokeResult, ThemeReceipt},
    theme::{self, Theme},
    version, webui_patch,
};

/// Process exit code: success.
pub const EXIT_OK: i32 = 0;
/// Process exit code: CEF failed to initialize.
pub const EXIT_INIT_FAILED: i32 = 1;
/// Process exit code: the smoke page failed to load.
pub const EXIT_LOAD_ERROR: i32 = 2;
/// Process exit code: the smoke page did not load before the timeout.
pub const EXIT_TIMEOUT: i32 = 3;

/// Frame rate for `--windowless` browsers.
const HEADLESS_FRAME_RATE: i32 = 30;
/// Opaque white page background for windowless browsers, so screenshots are
/// not transparent (`0xAARRGGBB`).
const HEADLESS_BACKGROUND: u32 = 0xFFFF_FFFF;
/// Grace period between closing the shell's browsers and forcing the quit.
const QUIT_FALLBACK_MS: i64 = 3_000;
/// Attempts to reload a `chrome-extension://` page that failed to load.
const EXTENSION_RETRIES: u32 = 40;
/// Delay between those attempts.
const EXTENSION_RETRY_DELAY_MS: i64 = 250;

/// Shared browser-process state.
pub type Shared = Arc<Mutex<ShellState>>;

/// Deferred CEF calls collected while the state lock is held.
#[derive(Default)]
struct Actions {
    close: Vec<Browser>,
    force_close: bool,
    quit: bool,
    /// Post a `SmokeHoldTask` after this many milliseconds.
    hold_ms: Option<i64>,
    /// Post a `QuitFallbackTask` after this many milliseconds, so the shell
    /// still exits when Chrome-owned browsers (extension pages, tabs opened
    /// without this client) keep the window open.
    quit_fallback_ms: Option<i64>,
}

/// Set once `quit_message_loop` has been called.
static QUIT_REQUESTED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// Calls `quit_message_loop` at most once.
fn quit_once() -> bool {
    if QUIT_REQUESTED.swap(true, std::sync::atomic::Ordering::SeqCst) {
        return false;
    }
    quit_message_loop();
    true
}

impl Actions {
    fn run(self, state: &Shared) {
        if let Some(hold_ms) = self.hold_ms {
            let mut task = SmokeHoldTask::new(state.clone());
            post_delayed_task(ThreadId::UI, Some(&mut task), hold_ms.max(1));
        }
        for browser in self.close {
            if let Some(host) = browser.host() {
                host.close_browser(self.force_close.into());
            }
        }
        if let Some(delay_ms) = self.quit_fallback_ms {
            let mut task = QuitFallbackTask::new(delay_ms);
            post_delayed_task(ThreadId::UI, Some(&mut task), delay_ms.max(1));
        }
        if self.quit {
            quit_once();
        }
    }
}

/// Browser-process state owned by the shell.
pub struct ShellState {
    config: ShellConfig,
    theme: Theme,
    /// Read-back of the theme colors from the first Views window.
    theme_check: Option<Vec<ColorCheck>>,
    /// Latest window title as read back from the Views window.
    window_title: String,
    browsers: Vec<Browser>,
    exit_code: i32,
    smoke_started: Option<Instant>,
    smoke_done: bool,
    /// Main-frame load that is being held open for `--smoke-hold-ms`.
    smoke_pending: Option<(String, i32)>,
    last_title: String,
    last_url: String,
    /// `chrome-extension://` page whose navigation waits for the extension
    /// loaded by `--load-extension` to be registered (see
    /// `defer_extension_url`).
    deferred_url: Option<String>,
    /// Retries left for a failed `chrome-extension://` navigation.
    extension_retries: u32,
}

impl ShellState {
    /// Creates the shared state for one browser process.
    pub fn new(config: ShellConfig) -> Shared {
        let resolved = match (config.theme_pack.as_deref(), config.theme.as_deref()) {
            (Some(path), _) => Some(theme::load_pack(path)),
            (None, Some(spec)) => Some(theme::resolve(spec)),
            (None, None) => None,
        };
        let theme = match resolved {
            Some(Ok(theme)) => {
                eprintln!("yolo-chromium: theme {}", theme.name);
                theme
            }
            Some(Err(error)) => {
                eprintln!("yolo-chromium: {error}; keeping Chromium defaults");
                Theme::default()
            }
            None => Theme::default(),
        };
        Arc::new(Mutex::new(Self {
            config,
            theme,
            theme_check: None,
            window_title: String::new(),
            browsers: Vec::new(),
            exit_code: EXIT_OK,
            smoke_started: None,
            smoke_done: false,
            smoke_pending: None,
            last_title: String::new(),
            last_url: String::new(),
            deferred_url: None,
            extension_retries: EXTENSION_RETRIES,
        }))
    }

    pub fn config(&self) -> &ShellConfig {
        &self.config
    }

    pub fn exit_code(&self) -> i32 {
        self.exit_code
    }

    pub fn browser_count(&self) -> usize {
        self.browsers.len()
    }

    pub fn theme(&self) -> &Theme {
        &self.theme
    }

    fn runtime_style(&self) -> RuntimeStyle {
        if self.config.alloy_style {
            RuntimeStyle::ALLOY
        } else {
            RuntimeStyle::DEFAULT
        }
    }

    fn runtime_style_name(&self) -> &'static str {
        if self.config.alloy_style {
            "alloy"
        } else {
            "chrome"
        }
    }

    fn show_state(&self) -> ShowState {
        match self.config.initial_show_state {
            InitialShowState::Normal => ShowState::NORMAL,
            InitialShowState::Minimized => ShowState::MINIMIZED,
            InitialShowState::Maximized => ShowState::MAXIMIZED,
        }
    }

    fn on_after_created(&mut self, browser: Browser) {
        self.browsers.push(browser);
    }

    fn on_before_close(&mut self, mut browser: Browser) -> Actions {
        if let Some(index) = self
            .browsers
            .iter()
            .position(|known| known.is_same(Some(&mut browser)) != 0)
        {
            self.browsers.remove(index);
        }
        Actions {
            quit: self.browsers.is_empty(),
            ..Default::default()
        }
    }

    fn on_title_change(&mut self, title: &str) -> String {
        self.last_title = title.to_string();
        self.theme.window_title(title)
    }

    /// Extensions passed with `--load-extension` register asynchronously after
    /// the browser context initializes, so a browser created straight at
    /// `chrome-extension://<id>/page.html` can lose the race and fail with
    /// an error page. Such a URL is parked here and the browser starts at
    /// `about:blank`; the first blank load then navigates to it.
    fn defer_extension_url(&mut self, url: &str) -> String {
        if is_extension_url(url) && self.deferred_url.is_none() {
            self.deferred_url = Some(url.to_string());
            self.extension_retries = EXTENSION_RETRIES;
            return "about:blank".to_string();
        }
        url.to_string()
    }

    /// Takes the parked extension URL once the blank page has loaded.
    fn take_deferred_url(&mut self, loaded_url: &str) -> Option<String> {
        if loaded_url.starts_with("about:blank") {
            self.deferred_url.take()
        } else {
            None
        }
    }

    /// Consumes one retry for a failed extension page; `true` when the
    /// navigation should be attempted again.
    fn take_extension_retry(&mut self, failed_url: &str) -> bool {
        if !is_extension_url(failed_url) || self.extension_retries == 0 {
            return false;
        }
        self.extension_retries -= 1;
        true
    }

    fn on_address_change(&mut self, url: &str) {
        self.last_url = url.to_string();
    }

    fn on_main_frame_loaded(&mut self, url: &str, http_status: i32) -> Actions {
        self.last_url = url.to_string();
        let Some(smoke) = &self.config.smoke else {
            return Actions::default();
        };
        if self.smoke_done || self.smoke_pending.is_some() {
            return Actions::default();
        }
        if smoke.hold_ms > 0 {
            self.smoke_pending = Some((url.to_string(), http_status));
            return Actions {
                hold_ms: Some(smoke.hold_ms),
                ..Default::default()
            };
        }
        self.finish_smoke("loaded", None, http_status, EXIT_OK)
    }

    fn on_smoke_hold_elapsed(&mut self) -> Actions {
        match self.smoke_pending.take() {
            Some((url, http_status)) if !self.smoke_done => {
                self.last_url = url;
                self.finish_smoke("loaded", None, http_status, EXIT_OK)
            }
            _ => Actions::default(),
        }
    }

    fn on_main_frame_error(&mut self, code: i32, text: &str, url: &str) -> Actions {
        if self.config.smoke.is_some() && !self.smoke_done {
            self.last_url = url.to_string();
            return self.finish_smoke(
                "load-error",
                Some(SmokeError {
                    code,
                    text: text.to_string(),
                }),
                0,
                EXIT_LOAD_ERROR,
            );
        }
        Actions::default()
    }

    /// Theme section of the receipt; absent when no theme is active.
    fn theme_receipt(&self) -> Option<ThemeReceipt> {
        if self.theme.colors.is_empty() && self.theme.pack.is_none() {
            return None;
        }
        let colors = self.theme_check.clone().unwrap_or_default();
        Some(ThemeReceipt {
            name: self.theme.name.clone(),
            pack: self.theme.pack.clone(),
            titles: self.theme.titles.clone(),
            window_created: self.theme_check.is_some(),
            applied: colors.len(),
            verified: colors.iter().filter(|check| check.matches).count(),
            window_title: self.window_title.clone(),
            colors,
        })
    }

    fn on_smoke_timeout(&mut self) -> Actions {
        if self.smoke_pending.is_some() {
            // The page loaded; only the hold was still running.
            return self.on_smoke_hold_elapsed();
        }
        if self.config.smoke.is_some() && !self.smoke_done {
            return self.finish_smoke("timeout", None, 0, EXIT_TIMEOUT);
        }
        Actions::default()
    }

    fn finish_smoke(
        &mut self,
        outcome: &'static str,
        error: Option<SmokeError>,
        http_status: i32,
        exit_code: i32,
    ) -> Actions {
        self.smoke_done = true;
        self.exit_code = exit_code;
        let load_ms = self
            .smoke_started
            .map(|started| started.elapsed().as_millis() as u64)
            .unwrap_or(0);
        let receipt = Receipt {
            schema_version: receipt::SCHEMA_VERSION,
            engine: "cef",
            captured_at: receipt::iso8601_now(),
            host: receipt::host_info(engine_info::TARGET),
            build: engine_info::build_info(),
            runtime: version::runtime_info(),
            shell: ShellInfo {
                headless: self.config.headless,
                runtime_style: self.runtime_style_name(),
                views: self.config.use_views,
                sandbox: engine_info::SANDBOX && !self.config.no_sandbox,
                cache_path: self
                    .config
                    .cache_path
                    .as_ref()
                    .map(|path| path.to_string_lossy().into_owned()),
                remote_debugging_port: self.config.remote_debugging_port,
                host_executable: std::env::current_exe()
                    .ok()
                    .and_then(|exe| {
                        exe.file_name()
                            .map(|name| name.to_string_lossy().into_owned())
                    })
                    .unwrap_or_default(),
            },
            smoke: SmokeResult {
                url: self.config.url.clone(),
                final_url: self.last_url.clone(),
                title: self.last_title.clone(),
                http_status,
                load_ms,
                outcome,
                error,
                exit_code,
            },
            // The DevTools HTTP endpoint answers on the UI thread, so the
            // probe must not run here; the launcher process fills this in.
            cdp: None,
            theme: self.theme_receipt(),
        };
        let json = receipt.to_json();
        println!("{json}");
        if let Some(path) = self
            .config
            .smoke
            .as_ref()
            .and_then(|smoke| smoke.receipt_path.clone())
        {
            match receipt.write(&path) {
                Ok(()) => eprintln!("yolo-chromium: receipt written to {}", path.display()),
                Err(error) => {
                    eprintln!("yolo-chromium: failed to write {}: {error}", path.display());
                    self.exit_code = EXIT_INIT_FAILED;
                }
            }
        }
        Actions {
            close: self.browsers.clone(),
            force_close: true,
            quit: self.browsers.is_empty(),
            hold_ms: None,
            quit_fallback_ms: Some(QUIT_FALLBACK_MS),
        }
    }
}

fn lock(state: &Shared) -> MutexGuard<'_, ShellState> {
    state
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn cef_string(value: Option<&CefString>) -> String {
    value.map(CefString::to_string).unwrap_or_default()
}

fn is_extension_url(url: &str) -> bool {
    url.starts_with("chrome-extension://")
}

/// Creates a browser window for `url`. Must run on the CEF UI thread.
pub fn create_browser_window(state: &Shared, url: &str) {
    let url = lock(state).defer_extension_url(url);
    let url = url.as_str();
    if lock(state).config.windowless {
        create_windowless_browser(state, url);
        return;
    }
    let (runtime_style, use_views, show_state, size, theme) = {
        let guard = lock(state);
        (
            guard.runtime_style(),
            guard.config.use_views,
            guard.show_state(),
            Size {
                width: guard.config.window_size.0,
                height: guard.config.window_size.1,
            },
            guard.theme.clone(),
        )
    };
    let mut client = YoloClient::new(state.clone());
    let settings = BrowserSettings::default();
    let url = CefString::from(url);

    if use_views {
        let mut delegate = YoloBrowserViewDelegate::new(state.clone(), runtime_style);
        let browser_view = browser_view_create(
            Some(&mut client),
            Some(&url),
            Some(&settings),
            None,
            None,
            Some(&mut delegate),
        );
        let mut window_delegate = YoloWindowDelegate::new(
            state.clone(),
            RefCell::new(browser_view),
            runtime_style,
            show_state,
            size,
            theme,
        );
        window_create_top_level(Some(&mut window_delegate));
    } else {
        let window_info = WindowInfo {
            runtime_style,
            ..Default::default()
        };
        #[cfg(target_os = "windows")]
        let window_info = window_info.set_as_popup(Default::default(), &theme.window_title(""));
        browser_host_create_browser(
            Some(&window_info),
            Some(&mut client),
            Some(&url),
            Some(&settings),
            None,
            None,
        );
    }
}

/// Creates a windowless (off-screen rendered) browser for `--windowless`.
///
/// CEF renders windowless browsers through the client's `RenderHandler` and
/// always gives them the Alloy runtime style (`cef_types_runtime.h`:
/// "Windowless rendering will always use Alloy style"), so there is no Chrome
/// toolbar or tab strip. The page itself, chrome:// WebUI included, is the
/// same Chromium content as in a window, and DevTools
/// (`--remote-debugging-port`) sees it as a normal page target.
fn create_windowless_browser(state: &Shared, url: &str) {
    let mut client = YoloClient::new(state.clone());
    let settings = BrowserSettings {
        windowless_frame_rate: HEADLESS_FRAME_RATE,
        background_color: HEADLESS_BACKGROUND,
        ..Default::default()
    };
    // No parent window; shared textures stay off so OnPaint receives CPU
    // buffers and Page.captureScreenshot works without a GPU surface.
    let window_info = WindowInfo {
        shared_texture_enabled: 0,
        ..Default::default()
    }
    .set_as_windowless(Default::default());
    let url = CefString::from(url);
    browser_host_create_browser(
        Some(&window_info),
        Some(&mut client),
        Some(&url),
        Some(&settings),
        None,
        None,
    );
}

wrap_app! {
    pub struct YoloApp {
        state: Shared,
    }

    impl App {
        fn browser_process_handler(&self) -> Option<BrowserProcessHandler> {
            Some(YoloBrowserProcessHandler::new(self.state.clone()))
        }
    }
}

wrap_browser_process_handler! {
    struct YoloBrowserProcessHandler {
        state: Shared,
    }

    impl BrowserProcessHandler {
        fn on_context_initialized(&self) {
            let (url, smoke_timeout) = {
                let mut guard = lock(&self.state);
                guard.smoke_started = Some(Instant::now());
                (
                    guard.config.url.clone(),
                    guard.config.smoke.as_ref().map(|smoke| smoke.timeout_ms),
                )
            };
            create_browser_window(&self.state, &url);
            if let Some(timeout_ms) = smoke_timeout {
                let mut task = SmokeTimeoutTask::new(self.state.clone());
                post_delayed_task(ThreadId::UI, Some(&mut task), timeout_ms.max(1));
            }
        }

        fn default_client(&self) -> Option<Client> {
            // Chrome-style browsers that Chromium creates itself (new tabs,
            // DevTools Target.createTarget) get the shell's handlers too, so
            // --webui-patch-dir and the shutdown bookkeeping cover them.
            Some(YoloClient::new(self.state.clone()))
        }

        fn on_already_running_app_relaunch(
            &self,
            command_line: Option<&mut CommandLine>,
            _current_directory: Option<&CefString>,
        ) -> i32 {
            let url = command_line
                .map(|command_line| {
                    CefString::from(&command_line.switch_value(Some(&CefString::from("url"))))
                        .to_string()
                })
                .filter(|url| !url.is_empty())
                .unwrap_or_else(|| lock(&self.state).config.url.clone());
            create_browser_window(&self.state, &url);
            1
        }
    }
}

wrap_client! {
    pub struct YoloClient {
        state: Shared,
    }

    impl Client {
        fn display_handler(&self) -> Option<DisplayHandler> {
            Some(YoloDisplayHandler::new(self.state.clone()))
        }

        fn life_span_handler(&self) -> Option<LifeSpanHandler> {
            Some(YoloLifeSpanHandler::new(self.state.clone()))
        }

        fn load_handler(&self) -> Option<LoadHandler> {
            Some(YoloLoadHandler::new(self.state.clone()))
        }

        fn render_handler(&self) -> Option<RenderHandler> {
            let size = {
                let guard = lock(&self.state);
                guard.config.windowless.then_some(guard.config.window_size)
            };
            size.map(|(width, height)| YoloRenderHandler::new(width, height))
        }

        fn request_handler(&self) -> Option<RequestHandler> {
            Some(YoloRequestHandler::new())
        }
    }
}

wrap_render_handler! {
    struct YoloRenderHandler {
        width: i32,
        height: i32,
    }

    impl RenderHandler {
        fn view_rect(&self, _browser: Option<&mut Browser>, rect: Option<&mut Rect>) {
            if let Some(rect) = rect {
                *rect = Rect {
                    x: 0,
                    y: 0,
                    width: self.width,
                    height: self.height,
                };
            }
        }

        fn screen_info(
            &self,
            _browser: Option<&mut Browser>,
            screen_info: Option<&mut ScreenInfo>,
        ) -> i32 {
            let Some(screen_info) = screen_info else {
                return 0;
            };
            let rect = Rect {
                x: 0,
                y: 0,
                width: self.width,
                height: self.height,
            };
            screen_info.device_scale_factor = 1.0;
            screen_info.depth = 24;
            screen_info.depth_per_component = 8;
            screen_info.rect = rect.clone();
            screen_info.available_rect = rect;
            1
        }

        fn on_paint(
            &self,
            _browser: Option<&mut Browser>,
            _type_: PaintElementType,
            _dirty_rects: Option<&[Rect]>,
            _buffer: *const u8,
            _width: i32,
            _height: i32,
        ) {
            // Frames are dropped: screenshots go through DevTools
            // (Page.captureScreenshot), which reads the compositor directly.
        }
    }
}

wrap_request_handler! {
    struct YoloRequestHandler;

    impl RequestHandler {
        fn on_render_process_terminated(
            &self,
            browser: Option<&mut Browser>,
            status: TerminationStatus,
            error_code: i32,
            _error_string: Option<&CefString>,
        ) {
            let url = browser
                .and_then(|browser| browser.main_frame())
                .map(|frame| CefString::from(&frame.url()).to_string())
                .unwrap_or_default();
            eprintln!(
                "yolo-chromium: renderer terminated (status {}, code {error_code}) on {url}",
                sys::cef_termination_status_t::from(status) as i32
            );
        }
    }
}

wrap_display_handler! {
    struct YoloDisplayHandler {
        state: Shared,
    }

    impl DisplayHandler {
        fn on_title_change(&self, browser: Option<&mut Browser>, title: Option<&CefString>) {
            let title = lock(&self.state).on_title_change(&cef_string(title));
            let mut browser = browser.cloned();
            if let Some(window) =
                browser_view_get_for_browser(browser.as_mut()).and_then(|view| view.window())
            {
                window.set_title(Some(&CefString::from(title.as_str())));
                let read_back = CefString::from(&window.title()).to_string();
                lock(&self.state).window_title = read_back;
            }
        }

        fn on_address_change(
            &self,
            _browser: Option<&mut Browser>,
            frame: Option<&mut Frame>,
            url: Option<&CefString>,
        ) {
            if frame.map(|frame| frame.is_main() != 0).unwrap_or(false) {
                lock(&self.state).on_address_change(&cef_string(url));
            }
        }
    }
}

wrap_life_span_handler! {
    struct YoloLifeSpanHandler {
        state: Shared,
    }

    impl LifeSpanHandler {
        fn on_after_created(&self, browser: Option<&mut Browser>) {
            if let Some(browser) = browser.cloned() {
                lock(&self.state).on_after_created(browser);
            }
        }

        fn do_close(&self, _browser: Option<&mut Browser>) -> i32 {
            // Allow the close; the OS close event follows for windowed browsers.
            0
        }

        fn on_before_close(&self, browser: Option<&mut Browser>) {
            let actions = match browser.cloned() {
                Some(browser) => lock(&self.state).on_before_close(browser),
                None => Actions::default(),
            };
            actions.run(&self.state);
        }
    }
}

wrap_load_handler! {
    struct YoloLoadHandler {
        state: Shared,
    }

    impl LoadHandler {
        fn on_load_end(
            &self,
            _browser: Option<&mut Browser>,
            frame: Option<&mut Frame>,
            http_status_code: i32,
        ) {
            let Some(frame) = frame else { return };
            if frame.is_main() == 0 {
                return;
            }
            let url = CefString::from(&frame.url()).to_string();
            let deferred = lock(&self.state).take_deferred_url(&url);
            if let Some(target) = deferred {
                // The browser started at about:blank; the extension is
                // registered by now, so go to the page that was asked for.
                frame.load_url(Some(&CefString::from(target.as_str())));
                return;
            }
            let patch_dir = lock(&self.state).config.webui_patch_dir.clone();
            if let Some(script) = patch_dir
                .as_deref()
                .and_then(|dir| webui_patch::find(dir, &url))
                .and_then(|files| webui_patch::load_script(&files))
            {
                let script_url = CefString::from("yolo-webui-patch://inject.js");
                frame.execute_java_script(
                    Some(&CefString::from(script.as_str())),
                    Some(&script_url),
                    1,
                );
            }
            let actions = lock(&self.state).on_main_frame_loaded(&url, http_status_code);
            actions.run(&self.state);
        }

        fn on_load_error(
            &self,
            browser: Option<&mut Browser>,
            frame: Option<&mut Frame>,
            error_code: Errorcode,
            error_text: Option<&CefString>,
            failed_url: Option<&CefString>,
        ) {
            let Some(frame) = frame else { return };
            if frame.is_main() == 0 {
                return;
            }
            let code = sys::cef_errorcode_t::from(error_code);
            if code == sys::cef_errorcode_t::ERR_ABORTED {
                return;
            }
            let failed = cef_string(failed_url);
            if lock(&self.state).take_extension_retry(&failed) {
                // Extension still registering: try the same page again.
                if let Some(browser) = browser.cloned() {
                    let mut task = ReloadExtensionTask::new(browser, failed);
                    post_delayed_task(ThreadId::UI, Some(&mut task), EXTENSION_RETRY_DELAY_MS);
                    return;
                }
            }
            let actions = lock(&self.state).on_main_frame_error(
                code as i32,
                &cef_string(error_text),
                &cef_string(failed_url),
            );
            actions.run(&self.state);
        }
    }
}

wrap_task! {
    struct SmokeTimeoutTask {
        state: Shared,
    }

    impl Task {
        fn execute(&self) {
            let actions = lock(&self.state).on_smoke_timeout();
            actions.run(&self.state);
        }
    }
}

wrap_task! {
    struct ReloadExtensionTask {
        browser: Browser,
        url: String,
    }

    impl Task {
        fn execute(&self) {
            if let Some(frame) = self.browser.main_frame() {
                frame.load_url(Some(&CefString::from(self.url.as_str())));
            }
        }
    }
}

wrap_task! {
    struct QuitFallbackTask {
        delay_ms: i64,
    }

    impl Task {
        fn execute(&self) {
            if quit_once() {
                eprintln!(
                    "yolo-chromium: browsers still open {} ms after smoke finished; quitting",
                    self.delay_ms
                );
            }
        }
    }
}

wrap_task! {
    struct SmokeHoldTask {
        state: Shared,
    }

    impl Task {
        fn execute(&self) {
            let actions = lock(&self.state).on_smoke_hold_elapsed();
            actions.run(&self.state);
        }
    }
}

wrap_window_delegate! {
    struct YoloWindowDelegate {
        state: Shared,
        browser_view: RefCell<Option<BrowserView>>,
        runtime_style: RuntimeStyle,
        initial_show_state: ShowState,
        preferred_size: Size,
        theme: Theme,
    }

    impl ViewDelegate {
        fn preferred_size(&self, _view: Option<&mut View>) -> Size {
            self.preferred_size.clone()
        }
    }

    impl PanelDelegate {}

    impl WindowDelegate {
        fn on_window_created(&self, window: Option<&mut Window>) {
            let browser_view = self.browser_view.borrow();
            let (Some(window), Some(browser_view)) = (window, browser_view.as_ref()) else {
                return;
            };
            let mut view = View::from(browser_view);
            window.add_child_view(Some(&mut view));
            let title = self.theme.window_title("");
            window.set_title(Some(&CefString::from(title.as_str())));
            if apply_theme_colors(window, &self.theme) {
                window.theme_changed();
            }
            let checks = read_back_theme(window, &self.theme);
            let read_title = CefString::from(&window.title()).to_string();
            let mut guard = lock(&self.state);
            if guard.theme_check.is_none() && !checks.is_empty() {
                guard.theme_check = Some(checks);
            }
            guard.window_title = read_title;
            if self.initial_show_state != ShowState::HIDDEN {
                window.show();
            }
        }

        fn on_theme_colors_changed(&self, window: Option<&mut Window>, _chrome_theme: i32) {
            // Re-apply the brand colors over the native or Chrome theme that
            // just changed (CEF triggers OnThemeChanged itself afterwards).
            if let Some(window) = window {
                apply_theme_colors(window, &self.theme);
            }
        }

        fn on_window_destroyed(&self, _window: Option<&mut Window>) {
            *self.browser_view.borrow_mut() = None;
        }

        fn can_close(&self, _window: Option<&mut Window>) -> i32 {
            let browser_view = self.browser_view.borrow();
            match browser_view.as_ref().and_then(|view| view.browser()) {
                Some(browser) => browser
                    .host()
                    .map(|host| host.try_close_browser())
                    .unwrap_or(1),
                None => 1,
            }
        }

        fn initial_show_state(&self, _window: Option<&mut Window>) -> ShowState {
            self.initial_show_state
        }

        fn window_runtime_style(&self) -> RuntimeStyle {
            self.runtime_style
        }
    }
}

wrap_browser_view_delegate! {
    struct YoloBrowserViewDelegate {
        state: Shared,
        runtime_style: RuntimeStyle,
    }

    impl ViewDelegate {}

    impl BrowserViewDelegate {
        fn chrome_toolbar_type(&self, _browser_view: Option<&mut BrowserView>) -> ChromeToolbarType {
            ChromeToolbarType::NORMAL
        }

        fn delegate_for_popup_browser_view(
            &self,
            _browser_view: Option<&mut BrowserView>,
            _settings: Option<&BrowserSettings>,
            _client: Option<&mut Client>,
            _is_devtools: i32,
        ) -> Option<BrowserViewDelegate> {
            Some(YoloBrowserViewDelegate::new(self.state.clone(), self.runtime_style))
        }

        fn on_popup_browser_view_created(
            &self,
            _browser_view: Option<&mut BrowserView>,
            popup_browser_view: Option<&mut BrowserView>,
            _is_devtools: i32,
        ) -> i32 {
            let (size, theme) = {
                let guard = lock(&self.state);
                (
                    Size {
                        width: guard.config.window_size.0,
                        height: guard.config.window_size.1,
                    },
                    guard.theme.clone(),
                )
            };
            let mut window_delegate = YoloWindowDelegate::new(
                self.state.clone(),
                RefCell::new(popup_browser_view.cloned()),
                self.runtime_style,
                ShowState::NORMAL,
                size,
                theme,
            );
            window_create_top_level(Some(&mut window_delegate));
            1
        }

        fn browser_runtime_style(&self) -> RuntimeStyle {
            self.runtime_style
        }
    }
}

/// Applies every color of `theme` to `window`. Returns whether any color was
/// set, in which case the caller should trigger `theme_changed` once.
fn apply_theme_colors(window: &Window, theme: &Theme) -> bool {
    for (token, color) in &theme.colors {
        window.set_theme_color(token.color_id(), *color);
    }
    !theme.colors.is_empty()
}

/// Reads every themed color back from `window` (the resolved Chromium color
/// provider, not the values that were set) and compares it with the theme.
fn read_back_theme(window: &Window, theme: &Theme) -> Vec<ColorCheck> {
    theme
        .colors
        .iter()
        .map(|(token, expected)| {
            let color_id = token.color_id();
            let actual = window.theme_color(color_id);
            ColorCheck {
                token: token.key(),
                color_id,
                role: token.role(),
                expected: format!("#{expected:08x}"),
                actual: format!("#{actual:08x}"),
                matches: actual == *expected,
            }
        })
        .collect()
}
