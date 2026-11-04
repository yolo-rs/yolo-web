# 2026 Scraper, Crawler, Browser & AoT/LTO Performance Blueprint

## Consolidated Stack Overview

| Category                 | Primary Engine / Tool                    | Role in YOLO-Web                                                         |
| :----------------------- | :--------------------------------------- | :----------------------------------------------------------------------- |
| **Browser Core**         | `obscura` + `servo` + `brave`            | Rust browser engine with V8 runtime, Taffy layout, and Brave Shields.    |
| **Search & RAG**         | Brave Search API                         | Independent web indexing, token-budgeted AI grounding snippets.          |
| **CSS & Geometry**       | `servo-stylo` + `servo-euclid`           | Parallel CSS selector matching, specificity scoring, and linear algebra. |
| **Adblock & Privacy**    | `adblock-rust` + CookieCrumbler          | High-performance network and cosmetic tracker blocking.                  |
| **Host Toolchain**       | Upstream Bun v1.4.4+ (Full Rust + JSC)   | Unified package manager, test runner, linter, bundler, and AoT compiler. |
| **Ahead-of-Time Native** | `bun compile` / Cranelift                | Compiles TypeScript into standalone native binaries in <300ms.           |
| **System LTO**           | Cargo `lto = "fat"`, `codegen-units = 1` | Maximum link-time optimization across all 60 consolidated Rust crates.   |

## Performance Gates

- **Cargo LTO**: `--profile release-dist` executes with `opt-level = 3`, `lto = "fat"`, `codegen-units = 1`, and symbol stripping.
- **Bun AoT**: `bun run aot:all` compiles standalone executables with SSA IR optimization and `--trim` dead code elimination.
- **Pure Bun Toolchain**: 0% Node.js, 0% Zig, 100% Rust + Bun + Chromium V8.
