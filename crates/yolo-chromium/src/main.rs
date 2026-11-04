//! `yolo-chromium` launcher.
//!
//! On Windows this binary does not link CEF itself: it prepares a runtime
//! directory with the CEF distribution files, CEF's bootstrap executable
//! renamed to `yolo-chromium.exe`, and the shell cdylib renamed to
//! `yolo-chromium.dll`, then starts the host and forwards every switch. That
//! keeps Chromium's sandbox enabled. On other platforms it runs the shell
//! in-process.

#[path = "cdp.rs"]
mod cdp;
#[path = "engine_info.rs"]
mod engine_info;
mod launcher;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    std::process::exit(launcher::run(args));
}
