# Justfile - Google & Chromium Engineering Workflows for YOLO-Web
# Modern developer commands for Rust + Bun + Chromium V8

set shell := ["powershell", "-c"]

default:
    @just --list

# --- Quality Gates (Google & Chromium Standard) ---

# Run all quality checks across Bun and Cargo
check: check-bun check-cargo

# TypeScript 7 typecheck using Bun
check-bun:
    bun check

# Rust workspace typecheck
check-cargo:
    cargo check --workspace

# Check formatting across TS and Rust
fmt-check:
    bun fmt --check
    cargo fmt --check

# Apply formatting automatically
fmt:
    bun fmt
    cargo fmt

# Run all linters
lint:
    bun lint
    cargo clippy --workspace --all-targets -- -D warnings

# Run all test suites across the monorepo
test:
    bun test packages apps
    cargo test -p yolo-browser

# Run recursive target tests targeting Google, Cloudflare & Chromium domains
test-recursive:
    bun test packages/knowledge-indexer/src/recursive-targets.test.ts

# --- Documentation & Manifests ---

# Generate documentation manifest & wiki index
docs:
    bun run scripts/generate-docs.ts

# --- Compilation & Ahead-of-Time (AoT) Binaries ---

# Build all native standalone AoT binaries
build-aot:
    bun run aot:web
    bun run aot:web-mcp

# Build release Rust binaries
build-rust:
    cargo build --release -p yolo-browser-cli

# Full end-to-end production build
build: docs build-aot build-rust
