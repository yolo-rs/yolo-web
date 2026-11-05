//! Process entry points: the shared `run` used by every process type, the
//! Windows bootstrap DLL exports, and the in-process entry for hosts that do
//! not need CEF's bootstrap executable.

use std::os::raw::c_int;

use cef::{
    api_hash, execute_process, get_exit_code, initialize, run_message_loop, shutdown, sys, App,
    CefString, CommandLine, ImplCommandLine, LogSeverity, MainArgs, Settings,
};

use crate::{
    config::ShellConfig,
    shell::{ShellState, YoloApp, EXIT_INIT_FAILED, EXIT_OK},
};

/// Runs the CEF process described by `command_line`.
///
/// Returns the process exit code. Non-browser processes (`--type=...`) return
/// as soon as `cef_execute_process` finishes; the browser process initializes
/// CEF, runs the message loop until the last window closes, and shuts down.
pub fn run(main_args: &MainArgs, command_line: &CommandLine, sandbox_info: *mut u8) -> i32 {
    let is_browser_process = command_line.has_switch(Some(&CefString::from("type"))) == 0;
    let code = execute_process(Some(main_args), None::<&mut App>, sandbox_info);
    if !is_browser_process || code >= 0 {
        return code.max(0);
    }

    let config = ShellConfig::from_command_line(command_line);
    let settings = build_settings(&config);
    let state = ShellState::new(config);
    let mut app = YoloApp::new(state.clone());

    if initialize(
        Some(main_args),
        Some(&settings),
        Some(&mut app),
        sandbox_info,
    ) != 1
    {
        let exit = get_exit_code();
        let notified =
            exit == sys::cef_resultcode_t::CEF_RESULT_CODE_NORMAL_EXIT_PROCESS_NOTIFIED as c_int;
        if notified {
            // Another instance owns this profile; it was asked to open the URL.
            return EXIT_OK;
        }
        eprintln!("yolo-chromium: cef_initialize failed (result code {exit})");
        return EXIT_INIT_FAILED;
    }

    run_message_loop();
    shutdown();

    state
        .lock()
        .map(|guard| guard.exit_code())
        .unwrap_or(EXIT_INIT_FAILED)
}

fn build_settings(config: &ShellConfig) -> Settings {
    let mut settings = Settings {
        no_sandbox: (config.no_sandbox || !crate::engine_info::SANDBOX) as c_int,
        ..Default::default()
    };
    if let Some(path) = &config.cache_path {
        settings.cache_path = CefString::from(path.to_string_lossy().as_ref());
    }
    if let Some(port) = config.remote_debugging_port {
        settings.remote_debugging_port = c_int::from(port);
    }
    if let Some(path) = &config.log_file {
        settings.log_file = CefString::from(path.to_string_lossy().as_ref());
    }
    if let Some(severity) = &config.log_severity {
        settings.log_severity = match severity.as_str() {
            "verbose" | "debug" => LogSeverity::VERBOSE,
            "info" => LogSeverity::INFO,
            "warning" => LogSeverity::WARNING,
            "error" => LogSeverity::ERROR,
            "fatal" => LogSeverity::FATAL,
            "disable" => LogSeverity::DISABLE,
            _ => LogSeverity::DEFAULT,
        };
    }
    if let Some(locale) = &config.locale {
        settings.locale = CefString::from(locale.as_str());
    }
    if let Some(policy_id) = &config.policy_id {
        settings.chrome_policy_id = CefString::from(policy_id.as_str());
    }
    settings
}

/// Runs the shell inside the current process (no bootstrap executable).
///
/// On Windows this only keeps the sandbox when the process was started by
/// CEF's bootstrap; use the `yolo-chromium` launcher for the sandboxed path.
pub fn run_in_process() -> i32 {
    let _ = api_hash(sys::CEF_API_VERSION_LAST, 0);
    let args = cef::args::Args::new();
    #[cfg(target_os = "windows")]
    let command_line = windows::command_line_from_process();
    #[cfg(not(target_os = "windows"))]
    let command_line = args.as_cmd_line();
    let Some(command_line) = command_line else {
        eprintln!("yolo-chromium: failed to create the CEF command line");
        return EXIT_INIT_FAILED;
    };
    run(args.as_main_args(), &command_line, std::ptr::null_mut())
}

#[cfg(target_os = "windows")]
pub mod windows {
    //! Entry points called by CEF's `bootstrap.exe` / `bootstrapc.exe` after
    //! they load this crate's cdylib as `<exe-name>.dll` (see
    //! `include/cef_sandbox_win.h` in the CEF distribution).

    use std::os::raw::{c_char, c_int, c_void};

    use cef::{
        api_hash, command_line_create, sys, CefString, CommandLine, ImplCommandLine, MainArgs,
    };
    use windows_sys::Win32::System::{
        Environment::GetCommandLineW, LibraryLoader::GetModuleHandleW,
    };

    use super::run;
    use crate::shell::EXIT_INIT_FAILED;

    /// Builds the CEF command line from the process command line, preserving
    /// quoting exactly as Windows received it.
    pub fn command_line_from_process() -> Option<CommandLine> {
        let command_line = command_line_create()?;
        // SAFETY: GetCommandLineW returns a pointer to a NUL-terminated UTF-16
        // string owned by the process for its whole lifetime.
        let text = unsafe {
            let raw = GetCommandLineW();
            if raw.is_null() {
                String::new()
            } else {
                let mut length = 0;
                while *raw.add(length) != 0 {
                    length += 1;
                }
                String::from_utf16_lossy(std::slice::from_raw_parts(raw, length))
            }
        };
        command_line.init_from_string(Some(&CefString::from(text.as_str())));
        Some(command_line)
    }

    fn bootstrap_main(instance: *mut c_void, sandbox_info: *mut c_void) -> c_int {
        let _ = api_hash(sys::CEF_API_VERSION_LAST, 0);
        let main_args = MainArgs {
            instance: sys::HINSTANCE(instance.cast()),
        };
        let Some(command_line) = command_line_from_process() else {
            return EXIT_INIT_FAILED;
        };
        run(&main_args, &command_line, sandbox_info.cast())
    }

    /// Entry point for `bootstrap.exe` (windows subsystem).
    ///
    /// # Safety
    /// Called once by CEF's bootstrap with a valid module handle and the
    /// sandbox interface it created; `version_info` is not dereferenced.
    #[unsafe(no_mangle)]
    pub unsafe extern "C" fn RunWinMain(
        instance: *mut c_void,
        _command_line: *const u16,
        _command_show: c_int,
        sandbox_info: *mut c_void,
        _version_info: *mut c_void,
    ) -> c_int {
        bootstrap_main(instance, sandbox_info)
    }

    /// Entry point for `bootstrapc.exe` (console subsystem).
    ///
    /// # Safety
    /// Called once by CEF's console bootstrap; `argv` and `version_info` are
    /// not dereferenced, the command line is read from the process instead.
    #[unsafe(no_mangle)]
    pub unsafe extern "C" fn RunConsoleMain(
        _argc: c_int,
        _argv: *mut *mut c_char,
        sandbox_info: *mut c_void,
        _version_info: *mut c_void,
    ) -> c_int {
        // SAFETY: a null module name returns the handle of the host executable.
        let instance = unsafe { GetModuleHandleW(std::ptr::null()) };
        bootstrap_main(instance.cast(), sandbox_info)
    }
}
