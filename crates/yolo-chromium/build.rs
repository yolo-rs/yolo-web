//! Records the facts of the CEF (Chromium Embedded Framework) distribution this
//! crate links against so that both the shell library and the launcher binary
//! can report them without initializing CEF.

use std::{
    collections::HashMap,
    env, fs,
    path::{Path, PathBuf},
};

fn main() {
    println!("cargo::rerun-if-changed=build.rs");
    println!("cargo::rerun-if-env-changed=DEP_CEF_DLL_WRAPPER_CEF_DIR");

    let cef_dir = env::var("DEP_CEF_DLL_WRAPPER_CEF_DIR")
        .map(PathBuf::from)
        .expect(
            "cef-dll-sys must be a direct dependency so it exports DEP_CEF_DLL_WRAPPER_CEF_DIR",
        );
    let api_version = env::var("DEP_CEF_DLL_WRAPPER_CEF_API_VERSION").unwrap_or_default();

    emit("YOLO_CHROMIUM_CEF_DIR", &cef_dir.to_string_lossy());
    emit("YOLO_CHROMIUM_CEF_API_VERSION", &api_version);
    emit(
        "YOLO_CHROMIUM_TARGET",
        &env::var("TARGET").unwrap_or_default(),
    );
    emit(
        "YOLO_CHROMIUM_SANDBOX",
        if env::var_os("CARGO_FEATURE_SANDBOX").is_some() {
            "1"
        } else {
            "0"
        },
    );

    let version_header = cef_dir.join("include").join("cef_version.h");
    println!("cargo::rerun-if-changed={}", version_header.display());
    let defines = parse_defines(&read(&version_header));
    for (name, key) in [
        ("CEF_VERSION", "YOLO_CHROMIUM_CEF_VERSION"),
        ("CEF_VERSION_MAJOR", "YOLO_CHROMIUM_CEF_VERSION_MAJOR"),
        ("CEF_VERSION_MINOR", "YOLO_CHROMIUM_CEF_VERSION_MINOR"),
        ("CEF_VERSION_PATCH", "YOLO_CHROMIUM_CEF_VERSION_PATCH"),
        ("CEF_COMMIT_NUMBER", "YOLO_CHROMIUM_CEF_COMMIT_NUMBER"),
        ("CEF_COMMIT_HASH", "YOLO_CHROMIUM_CEF_COMMIT_HASH"),
        (
            "CEF_SANDBOX_COMPAT_HASH",
            "YOLO_CHROMIUM_CEF_SANDBOX_COMPAT_HASH",
        ),
        ("CHROME_VERSION_MAJOR", "YOLO_CHROMIUM_CHROMIUM_MAJOR"),
        ("CHROME_VERSION_MINOR", "YOLO_CHROMIUM_CHROMIUM_MINOR"),
        ("CHROME_VERSION_BUILD", "YOLO_CHROMIUM_CHROMIUM_BUILD"),
        ("CHROME_VERSION_PATCH", "YOLO_CHROMIUM_CHROMIUM_PATCH"),
    ] {
        emit(key, defines.get(name).map(String::as_str).unwrap_or(""));
    }
    let chromium_version = format!(
        "{}.{}.{}.{}",
        define(&defines, "CHROME_VERSION_MAJOR"),
        define(&defines, "CHROME_VERSION_MINOR"),
        define(&defines, "CHROME_VERSION_BUILD"),
        define(&defines, "CHROME_VERSION_PATCH"),
    );
    emit("YOLO_CHROMIUM_CHROMIUM_VERSION", &chromium_version);

    let api_versions_header = cef_dir.join("include").join("cef_api_versions.h");
    println!("cargo::rerun-if-changed={}", api_versions_header.display());
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let api_hash = platform_define(
        &read(&api_versions_header),
        &format!("CEF_API_HASH_{api_version}"),
        &target_os,
    )
    .unwrap_or_default();
    emit("YOLO_CHROMIUM_CEF_API_HASH", &api_hash);

    let archive_json = cef_dir.join("archive.json");
    println!("cargo::rerun-if-changed={}", archive_json.display());
    let (archive_name, archive_sha1) =
        serde_json::from_str::<serde_json::Value>(&read(&archive_json))
            .ok()
            .map(|value| {
                (
                    value["name"].as_str().unwrap_or("").to_string(),
                    value["sha1"].as_str().unwrap_or("").to_string(),
                )
            })
            .unwrap_or_default();
    emit("YOLO_CHROMIUM_CEF_ARCHIVE_NAME", &archive_name);
    emit("YOLO_CHROMIUM_CEF_ARCHIVE_SHA1", &archive_sha1);

    emit("YOLO_CHROMIUM_CEF_CRATE_VERSION", &cef_crate_version());
}

fn emit(key: &str, value: &str) {
    println!("cargo::rustc-env={key}={value}");
}

fn read(path: &Path) -> String {
    fs::read_to_string(path).unwrap_or_default()
}

fn define<'a>(defines: &'a HashMap<String, String>, name: &str) -> &'a str {
    defines.get(name).map(String::as_str).unwrap_or("0")
}

/// Parses `#define NAME VALUE` lines; string values lose their quotes.
fn parse_defines(text: &str) -> HashMap<String, String> {
    text.lines()
        .filter_map(|line| {
            let rest = line.trim().strip_prefix("#define")?.trim_start();
            let (name, value) = rest.split_once(char::is_whitespace)?;
            let value = value.trim().trim_matches('"').to_string();
            Some((name.to_string(), value))
        })
        .collect()
}

/// The exact `cef` crate version resolved in the workspace lockfile.
fn cef_crate_version() -> String {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap_or_default());
    let lockfile = manifest_dir.join("..").join("..").join("Cargo.lock");
    println!("cargo::rerun-if-changed={}", lockfile.display());
    let mut in_cef = false;
    for line in read(&lockfile).lines() {
        let line = line.trim();
        if line == "[[package]]" {
            in_cef = false;
        } else if line == "name = \"cef\"" {
            in_cef = true;
        } else if in_cef {
            if let Some(version) = line.strip_prefix("version = ") {
                return version.trim_matches('"').to_string();
            }
        }
    }
    "unknown".to_string()
}

/// Resolves a `#define NAME "value"` that the CEF headers wrap in
/// `#if defined(OS_WIN)` / `#elif defined(OS_MAC)` / `#elif defined(OS_LINUX)`
/// blocks, picking the block for `target_os`.
fn platform_define(text: &str, name: &str, target_os: &str) -> Option<String> {
    let wanted = match target_os {
        "windows" => "OS_WIN",
        "macos" => "OS_MAC",
        _ => "OS_LINUX",
    };
    let mut active_platform: Option<String> = None;
    let mut fallback = None;
    for line in text.lines() {
        let line = line.trim();
        if let Some(condition) = line
            .strip_prefix("#if defined(")
            .or_else(|| line.strip_prefix("#elif defined("))
        {
            active_platform = Some(condition.trim_end_matches(')').to_string());
            continue;
        }
        if line == "#endif" || line == "#else" {
            active_platform = None;
            continue;
        }
        let Some(rest) = line.strip_prefix("#define") else {
            continue;
        };
        let Some((define_name, value)) = rest.trim_start().split_once(char::is_whitespace) else {
            continue;
        };
        if define_name != name {
            continue;
        }
        let value = value.trim().trim_matches('"').to_string();
        match active_platform.as_deref() {
            Some(platform) if platform == wanted => return Some(value),
            None => fallback = Some(value),
            _ => {}
        }
    }
    fallback
}
