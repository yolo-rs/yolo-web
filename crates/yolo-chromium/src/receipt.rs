//! Machine-readable receipt of a `--smoke` run. The receipt is the evidence
//! that a specific CEF/Chromium build initialized, loaded a page, and shut
//! down cleanly on a host; it is written to `engines/cef.lock.json` by
//! `cargo run -p yolo-chromium -- --smoke --receipt=engines/cef.lock.json`.

use std::{
    fs, io,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::Serialize;

use crate::engine_info::BuildInfo;

/// Receipt schema version.
pub const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostInfo {
    pub os: &'static str,
    pub arch: &'static str,
    pub target: &'static str,
}

/// Versions reported by the loaded `libcef` at run time.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeInfo {
    pub cef_version: String,
    pub chromium_version: String,
    pub api_hash_platform: String,
    pub commit_hash: String,
    pub sandbox_compat_hash: String,
    /// True when the loaded library matches the headers this build used.
    pub matches_build: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellInfo {
    pub runtime_style: &'static str,
    pub views: bool,
    pub sandbox: bool,
    pub cache_path: Option<String>,
    pub remote_debugging_port: Option<u16>,
    pub host_executable: String,
    /// `--headless` (windowless rendering); omitted when false.
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub headless: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SmokeError {
    pub code: i32,
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SmokeResult {
    pub url: String,
    pub final_url: String,
    pub title: String,
    pub http_status: i32,
    pub load_ms: u64,
    /// `loaded`, `load-error`, or `timeout`.
    pub outcome: &'static str,
    pub error: Option<SmokeError>,
    pub exit_code: i32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Receipt {
    pub schema_version: u32,
    pub engine: &'static str,
    pub captured_at: String,
    pub host: HostInfo,
    pub build: BuildInfo,
    pub runtime: RuntimeInfo,
    pub shell: ShellInfo,
    pub smoke: SmokeResult,
    /// DevTools probe when `--remote-debugging-port` was set.
    pub cdp: Option<crate::cdp::CdpProbe>,
    /// Active theme and the read-back of its colors; omitted without a theme.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme: Option<ThemeReceipt>,
}

/// One themed color: what the theme asked for and what the Chromium color
/// provider of the window returned afterwards.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColorCheck {
    pub token: &'static str,
    pub color_id: i32,
    pub role: &'static str,
    /// `#AARRGGBB`.
    pub expected: String,
    pub actual: String,
    pub matches: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeReceipt {
    pub name: String,
    pub pack: Option<crate::theme::PackInfo>,
    pub titles: Option<crate::theme::Titles>,
    /// False when no Views window existed to read the colors back from.
    pub window_created: bool,
    pub applied: usize,
    pub verified: usize,
    /// Window title read back from the window.
    pub window_title: String,
    pub colors: Vec<ColorCheck>,
}

impl Receipt {
    pub fn to_json(&self) -> String {
        serde_json::to_string_pretty(self).unwrap_or_else(|error| {
            format!("{{\"error\":\"receipt serialization failed: {error}\"}}")
        })
    }

    /// Writes the receipt as pretty JSON with a trailing newline.
    pub fn write(&self, path: &Path) -> io::Result<()> {
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                fs::create_dir_all(parent)?;
            }
        }
        fs::write(path, format!("{}\n", self.to_json()))
    }
}

/// Host facts for the running binary.
pub fn host_info(target: &'static str) -> HostInfo {
    HostInfo {
        os: std::env::consts::OS,
        arch: std::env::consts::ARCH,
        target,
    }
}

/// Current time as `YYYY-MM-DDTHH:MM:SSZ` without external crates.
pub fn iso8601_now() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    iso8601_from_unix(secs)
}

/// Formats Unix seconds as `YYYY-MM-DDTHH:MM:SSZ`.
pub fn iso8601_from_unix(secs: u64) -> String {
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    let (hour, minute, second) = (rem / 3_600, (rem % 3_600) / 60, rem % 60);
    // Civil-from-days (proleptic Gregorian), see Howard Hinnant's date algorithms.
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if month <= 2 { y + 1 } else { y };
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}Z")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn iso8601_matches_known_dates() {
        assert_eq!(iso8601_from_unix(0), "1970-01-01T00:00:00Z");
        assert_eq!(iso8601_from_unix(951_782_400), "2000-02-29T00:00:00Z");
        assert_eq!(iso8601_from_unix(1_762_300_800), "2025-11-05T00:00:00Z");
    }

    #[test]
    fn receipt_serializes_with_camel_case_keys() {
        let receipt = Receipt {
            schema_version: SCHEMA_VERSION,
            engine: "cef",
            captured_at: iso8601_from_unix(0),
            host: host_info("x86_64-pc-windows-msvc"),
            build: crate::engine_info::build_info(),
            runtime: RuntimeInfo {
                cef_version: "156.0.15".into(),
                chromium_version: "156.0.8078.80".into(),
                api_hash_platform: String::new(),
                commit_hash: String::new(),
                sandbox_compat_hash: String::new(),
                matches_build: true,
            },
            shell: ShellInfo {
                headless: false,
                runtime_style: "chrome",
                views: true,
                sandbox: true,
                cache_path: None,
                remote_debugging_port: None,
                host_executable: "yolo-chromium.exe".into(),
            },
            smoke: SmokeResult {
                url: "chrome://version/".into(),
                final_url: "chrome://version/".into(),
                title: "About Version".into(),
                http_status: 200,
                load_ms: 1,
                outcome: "loaded",
                error: None,
                exit_code: 0,
            },
            cdp: None,
            theme: None,
        };
        let json = receipt.to_json();
        assert!(json.contains("\"schemaVersion\": 1"));
        assert!(json.contains("\"matchesBuild\": true"));
        assert!(json.contains("\"chromiumVersion\""));
    }
}
