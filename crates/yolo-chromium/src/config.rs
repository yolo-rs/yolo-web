//! Shell configuration parsed from the Chromium command line of the browser
//! process. Unknown switches are left untouched for Chromium itself.

use std::path::PathBuf;

use cef::{CefString, CommandLine, ImplCommandLine};

/// Default page when no `--url` is given.
pub const DEFAULT_URL: &str = "https://www.google.com/";
/// Default page for `--smoke` runs; served by Chromium itself, no network.
pub const DEFAULT_SMOKE_URL: &str = "chrome://version/";
/// Default `--smoke-timeout-ms`.
pub const DEFAULT_SMOKE_TIMEOUT_MS: i64 = 30_000;
/// Default `--window-size`.
pub const DEFAULT_WINDOW_SIZE: (i32, i32) = (1280, 800);
/// Default `chrome_policy_id`: registry key on Windows, directory on Linux.
pub const DEFAULT_POLICY_ID: &str = if cfg!(windows) {
    r"SOFTWARE\Policies\YOLO-Web\Chromium"
} else {
    "/etc/yolo-web/chromium/policies"
};

/// Initial top-level window state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InitialShowState {
    Normal,
    Minimized,
    Maximized,
}

/// `--smoke` run parameters.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SmokeConfig {
    /// Where to write the JSON receipt; stdout only when `None`.
    pub receipt_path: Option<PathBuf>,
    /// Abort with exit code 3 when the page has not loaded in time.
    pub timeout_ms: i64,
    /// Keep the browser open this long after the page loaded so that external
    /// probes (DevTools endpoint) can observe it.
    pub hold_ms: i64,
}

/// Parsed shell configuration.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShellConfig {
    pub url: String,
    /// Alloy runtime style instead of Chrome style (`--use-alloy-style`).
    pub alloy_style: bool,
    /// Views framework windows (default) versus native windows (`--use-native`).
    pub use_views: bool,
    pub initial_show_state: InitialShowState,
    pub window_size: (i32, i32),
    /// Profile directory; `None` means an in-memory profile.
    pub cache_path: Option<PathBuf>,
    pub remote_debugging_port: Option<u16>,
    pub log_file: Option<PathBuf>,
    pub log_severity: Option<String>,
    pub locale: Option<String>,
    pub no_sandbox: bool,
    /// `--theme=<preset|path.json>`; `None` keeps Chromium defaults.
    pub theme: Option<String>,
    /// `--theme-pack=<path>`: resolved theme-pack v1.1 JSON (colors and
    /// title); takes precedence over `--theme`.
    pub theme_pack: Option<String>,
    /// Registry key (Windows) or directory (Linux) read for managed policies.
    pub policy_id: Option<String>,
    pub smoke: Option<SmokeConfig>,
    /// `--headless`: Chromium's own headless mode. The Chrome runtime style,
    /// its WebUI, and DevTools stay intact, but no window reaches the screen.
    pub headless: bool,
    /// `--windowless`: CEF windowless (off-screen) rendering through a
    /// `CefRenderHandler`. CEF always uses the Alloy runtime style for
    /// windowless browsers, and Alloy style blocks Chrome-UI WebUI hosts such
    /// as chrome://settings, chrome://extensions, and chrome://flags.
    pub windowless: bool,
    /// `--webui-patch-dir=<dir>`: persistent CSS/JS edits for chrome:// pages.
    pub webui_patch_dir: Option<PathBuf>,
}

impl ShellConfig {
    /// Reads the configuration from the global Chromium command line.
    pub fn from_command_line(command_line: &CommandLine) -> Self {
        let has = |name: &str| command_line.has_switch(Some(&CefString::from(name))) != 0;
        let value = |name: &str| -> Option<String> {
            if !has(name) {
                return None;
            }
            let value = CefString::from(&command_line.switch_value(Some(&CefString::from(name))))
                .to_string();
            (!value.is_empty()).then_some(value)
        };

        let smoke = has("smoke").then(|| SmokeConfig {
            receipt_path: value("receipt").map(PathBuf::from),
            timeout_ms: value("smoke-timeout-ms")
                .and_then(|raw| raw.parse().ok())
                .unwrap_or(DEFAULT_SMOKE_TIMEOUT_MS),
            hold_ms: value("smoke-hold-ms")
                .and_then(|raw| raw.parse().ok())
                .unwrap_or(0),
        });
        let url = value("url").unwrap_or_else(|| {
            if smoke.is_some() {
                DEFAULT_SMOKE_URL.to_string()
            } else {
                DEFAULT_URL.to_string()
            }
        });
        let cache_path = if has("cache-path") {
            value("cache-path").map(PathBuf::from)
        } else if smoke.is_some() || has("incognito") {
            None
        } else {
            Some(default_cache_path())
        };

        let windowless = has("windowless");
        Self {
            url,
            alloy_style: windowless || has("use-alloy-style"),
            use_views: !windowless && !has("use-native"),
            initial_show_state: match value("initial-show-state").as_deref() {
                Some("minimized") => InitialShowState::Minimized,
                Some("maximized") => InitialShowState::Maximized,
                _ => InitialShowState::Normal,
            },
            window_size: value("window-size")
                .and_then(|raw| parse_window_size(&raw))
                .unwrap_or(DEFAULT_WINDOW_SIZE),
            cache_path,
            remote_debugging_port: value("remote-debugging-port").and_then(|raw| raw.parse().ok()),
            log_file: value("log-file").map(PathBuf::from),
            log_severity: value("log-severity"),
            locale: value("lang"),
            no_sandbox: has("no-sandbox"),
            theme: value("theme"),
            theme_pack: value("theme-pack"),
            policy_id: if has("no-policies") {
                None
            } else {
                Some(value("policy-id").unwrap_or_else(|| DEFAULT_POLICY_ID.to_string()))
            },
            smoke,
            headless: has("headless"),
            windowless,
            webui_patch_dir: value("webui-patch-dir").map(PathBuf::from),
        }
    }
}

/// Per-user profile directory used when no `--cache-path` is given.
pub fn default_cache_path() -> PathBuf {
    let base = if cfg!(windows) {
        std::env::var_os("LOCALAPPDATA").map(PathBuf::from)
    } else {
        std::env::var_os("XDG_CACHE_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".cache")))
    };
    base.unwrap_or_else(std::env::temp_dir)
        .join("yolo-web")
        .join("chromium")
        .join("default")
}

/// Parses `WIDTHxHEIGHT` or `WIDTH,HEIGHT`.
pub fn parse_window_size(raw: &str) -> Option<(i32, i32)> {
    let (width, height) = raw.split_once(['x', 'X', ','])?;
    let width: i32 = width.trim().parse().ok()?;
    let height: i32 = height.trim().parse().ok()?;
    (width > 0 && height > 0).then_some((width, height))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn window_size_accepts_common_separators() {
        assert_eq!(parse_window_size("1280x800"), Some((1280, 800)));
        assert_eq!(parse_window_size("1024,768"), Some((1024, 768)));
        assert_eq!(parse_window_size("0x10"), None);
        assert_eq!(parse_window_size("wide"), None);
    }

    #[test]
    fn default_cache_path_is_namespaced() {
        let path = default_cache_path();
        assert!(path.ends_with(PathBuf::from("yolo-web").join("chromium").join("default")));
    }
}
