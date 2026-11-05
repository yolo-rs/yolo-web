//! # yolo-chromium
//!
//! Upstream Chromium browser shell for YOLO-Web. The engine is the official
//! CEF (Chromium Embedded Framework) binary distribution, which ships Blink,
//! V8, Skia, the network stack, and the Chrome runtime style UI built from one
//! Chromium revision. This crate owns the Rust control plane on top of it:
//! process entry points, browser-process callbacks, Views window delegates,
//! configuration, and a machine-readable smoke receipt.
//!
//! On Windows the shell runs as a cdylib loaded by CEF's `bootstrap.exe` or
//! `bootstrapc.exe`, which keeps Chromium's sandbox enabled; the `yolo-chromium`
//! launcher binary prepares that layout and starts the host. See `README.md`.

pub mod cdp;
pub mod config;
pub mod engine_info;
pub mod entry;
pub mod receipt;
pub mod shell;
pub mod theme;
pub mod version;

pub use entry::{run, run_in_process};
pub use shell::{EXIT_INIT_FAILED, EXIT_LOAD_ERROR, EXIT_OK, EXIT_TIMEOUT};

/// Raw CEF bindings used by this crate (re-exported for host integrations).
pub use cef_dll_sys as sys;
