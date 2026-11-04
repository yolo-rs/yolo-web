//! Run-time version facts read from the loaded `libcef` library and compared
//! with the compile-time facts in [`crate::engine_info`].

use std::ffi::CStr;

use cef::{api_hash, sys};

use crate::{engine_info, receipt::RuntimeInfo};

mod ffi {
    use std::os::raw::c_int;

    // `cef_version_info` is exported by libcef (include/cef_version_info.h)
    // but not covered by the cef-dll-sys bindings; the sys crate already links
    // the import library.
    unsafe extern "C" {
        pub fn cef_version_info(entry: c_int) -> c_int;
    }
}

/// Entries understood by `cef_version_info`.
const CEF_MAJOR: i32 = 0;
const CEF_MINOR: i32 = 1;
const CEF_PATCH: i32 = 2;
const CHROME_MAJOR: i32 = 4;
const CHROME_MINOR: i32 = 5;
const CHROME_BUILD: i32 = 6;
const CHROME_PATCH: i32 = 7;

/// Entries understood by `cef_api_hash`.
const HASH_PLATFORM: i32 = 0;
const HASH_COMMIT: i32 = 2;
const HASH_SANDBOX_COMPAT: i32 = 3;

fn version_entry(entry: i32) -> i32 {
    // SAFETY: plain FFI call into libcef with an integer selector; the function
    // has no preconditions beyond the library being loaded, which the import
    // table guarantees for this process.
    unsafe { ffi::cef_version_info(entry) }
}

fn hash_entry(entry: i32) -> String {
    let pointer = api_hash(sys::CEF_API_VERSION_LAST, entry);
    if pointer.is_null() {
        return String::new();
    }
    // SAFETY: libcef returns a NUL-terminated string it owns for the process
    // lifetime; we only copy it.
    unsafe { CStr::from_ptr(pointer) }
        .to_string_lossy()
        .into_owned()
}

/// Queries the loaded library. Safe to call before `cef_initialize`.
pub fn runtime_info() -> RuntimeInfo {
    let cef_version = format!(
        "{}.{}.{}",
        version_entry(CEF_MAJOR),
        version_entry(CEF_MINOR),
        version_entry(CEF_PATCH)
    );
    let chromium_version = format!(
        "{}.{}.{}.{}",
        version_entry(CHROME_MAJOR),
        version_entry(CHROME_MINOR),
        version_entry(CHROME_BUILD),
        version_entry(CHROME_PATCH)
    );
    let commit_hash = hash_entry(HASH_COMMIT);
    let matches_build = chromium_version == engine_info::CHROMIUM_VERSION
        && engine_info::CEF_VERSION.starts_with(&cef_version)
        && (commit_hash.is_empty() || commit_hash == engine_info::CEF_COMMIT_HASH);
    RuntimeInfo {
        cef_version,
        chromium_version,
        api_hash_platform: hash_entry(HASH_PLATFORM),
        commit_hash,
        sandbox_compat_hash: hash_entry(HASH_SANDBOX_COMPAT),
        matches_build,
    }
}
