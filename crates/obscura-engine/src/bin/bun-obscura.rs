// SPDX-License-Identifier: Apache-2.0
//! `bun-obscura`: headless browser CLI and CDP server. Re-invoked under the name
//! `bun-obscura-worker` (argv[0]) it runs the scrape worker instead.

fn main() {
    let args: Vec<std::ffi::OsString> = std::env::args_os().collect();
    let invoked_as_worker = args
        .first()
        .and_then(|arg0| std::path::Path::new(arg0).file_stem())
        .is_some_and(|stem| stem == "bun-obscura-worker");
    let code = if invoked_as_worker {
        bun_browser_engine::worker_main(args)
    } else {
        bun_browser_engine::cli_main(args)
    };
    std::process::exit(code);
}
