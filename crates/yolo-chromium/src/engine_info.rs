//! Compile-time facts about the CEF (Chromium Embedded Framework) distribution
//! this build links against. Values are recorded by `build.rs` from the
//! distribution's `include/cef_version.h`, `include/cef_api_versions.h`, and
//! `archive.json`, so they describe the exact binaries, not a documented plan.

use serde::Serialize;

/// Version of this crate.
pub const CRATE_VERSION: &str = env!("CARGO_PKG_VERSION");
/// Resolved `cef` crate version from the workspace lockfile.
pub const CEF_CRATE_VERSION: &str = env!("YOLO_CHROMIUM_CEF_CRATE_VERSION");
/// Target triple this build was produced for.
pub const TARGET: &str = env!("YOLO_CHROMIUM_TARGET");
/// Directory holding the extracted CEF binary distribution used at build time.
pub const CEF_DISTRIBUTION_DIR: &str = env!("YOLO_CHROMIUM_CEF_DIR");
/// Full CEF version string, e.g. `156.0.15+gcf671c0+chromium-156.0.8078.80`.
pub const CEF_VERSION: &str = env!("YOLO_CHROMIUM_CEF_VERSION");
/// CEF commit hash the distribution was built from.
pub const CEF_COMMIT_HASH: &str = env!("YOLO_CHROMIUM_CEF_COMMIT_HASH");
/// Windows sandbox compatibility hash of the distribution.
pub const CEF_SANDBOX_COMPAT_HASH: &str = env!("YOLO_CHROMIUM_CEF_SANDBOX_COMPAT_HASH");
/// Upstream Chromium version embedded in the distribution, e.g. `156.0.8078.80`.
pub const CHROMIUM_VERSION: &str = env!("YOLO_CHROMIUM_CHROMIUM_VERSION");
/// Versioned CEF C API the wrapper was compiled against (`CEF_API_VERSION_LAST`).
pub const CEF_API_VERSION: &str = env!("YOLO_CHROMIUM_CEF_API_VERSION");
/// Platform API hash matching [`CEF_API_VERSION`].
pub const CEF_API_HASH: &str = env!("YOLO_CHROMIUM_CEF_API_HASH");
/// Archive file name downloaded from the CEF builds index.
pub const CEF_ARCHIVE_NAME: &str = env!("YOLO_CHROMIUM_CEF_ARCHIVE_NAME");
/// SHA-1 of the archive as published by the CEF builds index.
pub const CEF_ARCHIVE_SHA1: &str = env!("YOLO_CHROMIUM_CEF_ARCHIVE_SHA1");
/// Whether the `sandbox` feature was enabled for this build.
pub const SANDBOX: bool = matches!(env!("YOLO_CHROMIUM_SANDBOX").as_bytes(), b"1");

/// Facts about the linked CEF distribution.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CefBuildInfo {
    pub version: &'static str,
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
    pub commit_number: u32,
    pub commit_hash: &'static str,
    pub chromium_version: &'static str,
    pub api_version: u32,
    pub api_hash: &'static str,
    pub sandbox_compat_hash: &'static str,
    pub distribution_dir: &'static str,
    pub archive_name: &'static str,
    pub archive_sha1: &'static str,
}

/// Facts about this build of the shell.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildInfo {
    pub crate_version: &'static str,
    pub cef_crate: &'static str,
    pub target: &'static str,
    pub sandbox: bool,
    pub cef: CefBuildInfo,
}

/// Returns the compile-time build facts.
pub fn build_info() -> BuildInfo {
    BuildInfo {
        crate_version: CRATE_VERSION,
        cef_crate: CEF_CRATE_VERSION,
        target: TARGET,
        sandbox: SANDBOX,
        cef: CefBuildInfo {
            version: CEF_VERSION,
            major: parse_u32(env!("YOLO_CHROMIUM_CEF_VERSION_MAJOR")),
            minor: parse_u32(env!("YOLO_CHROMIUM_CEF_VERSION_MINOR")),
            patch: parse_u32(env!("YOLO_CHROMIUM_CEF_VERSION_PATCH")),
            commit_number: parse_u32(env!("YOLO_CHROMIUM_CEF_COMMIT_NUMBER")),
            commit_hash: CEF_COMMIT_HASH,
            chromium_version: CHROMIUM_VERSION,
            api_version: parse_u32(CEF_API_VERSION),
            api_hash: CEF_API_HASH,
            sandbox_compat_hash: CEF_SANDBOX_COMPAT_HASH,
            distribution_dir: CEF_DISTRIBUTION_DIR,
            archive_name: CEF_ARCHIVE_NAME,
            archive_sha1: CEF_ARCHIVE_SHA1,
        },
    }
}

fn parse_u32(value: &str) -> u32 {
    value.trim().parse().unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_info_is_consistent_with_the_distribution() {
        let info = build_info();
        assert!(info.cef.major >= 156);
        assert!(info.cef.version.starts_with(&format!(
            "{}.{}.{}",
            info.cef.major, info.cef.minor, info.cef.patch
        )));
        assert!(info
            .cef
            .version
            .ends_with(&format!("chromium-{}", info.cef.chromium_version)));
        assert_eq!(info.cef.api_hash.len(), 40);
        assert_eq!(info.cef.archive_sha1.len(), 40);
        assert!(info.cef.api_version >= 15600);
    }
}
