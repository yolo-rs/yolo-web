// SPDX-License-Identifier: Apache-2.0
//! `bun-obscura-worker`: line-delimited JSON scrape worker spawned by `bun-obscura scrape`.
//! On Windows the engine launches this sibling executable instead of using argv[0].

fn main() {
    std::process::exit(bun_browser_engine::worker_main(std::env::args_os().collect()));
}
