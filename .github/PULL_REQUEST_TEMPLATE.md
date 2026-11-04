<!--
Copyright 2026 The YOLO-Web Authors. All rights reserved.
Use of this source code is governed by a BSD-3-Clause / Apache-2.0
license that can be found in the LICENSE file.
-->

## Description
<!-- Provide a concise description of the changes proposed in this pull request. -->

## Subsystem Impacted
- [ ] `crates/servo-*` (Stylo CSS3, HTML5ever, Geometry, WebVTT)
- [ ] `crates/obscura*` (CDP, DOM, Net, SSRF, Render)
- [ ] `crates/brave-*` (Adblock-rust, Fingerprinting, Shields)
- [ ] `crates/deno-*` (V8 Isolates, Core bindings)
- [ ] `packages/web-cli` & `packages/web-mcp` (Unified Web entrypoints)
- [ ] `packages/chromium-tracker` (live Chromium, CEF, and Depot Tools tracking)
- [ ] `packages/challenge-solver` (Cloudflare Turnstile, reCAPTCHA, Google IPP)

## Type of Change
- [ ] `feat`: New capability or modern Chromium feature
- [ ] `fix`: Bug fix
- [ ] `perf`: Performance optimization (AoT / LTO / memory reduction)
- [ ] `docs`: Documentation, style guide, or architecture update
- [ ] `test`: New recursive target test or integration suite

## Google & Chromium Engineering Checklist
- [ ] **Google Style Guide**: Code adheres to Google Rust/TypeScript/C++ style guidelines.
- [ ] **Zero Host Leakage**: Verified no host `process.env` or globals leak into Guest V8 context.
- [ ] **Typecheck**: `bun check` passes with 0 errors.
- [ ] **Formatter**: `bun fmt --check` and `cargo fmt --check` pass.
- [ ] **Linter**: `bun lint` and `cargo clippy` pass cleanly.
- [ ] **Tests**: `bun test packages apps` passes all test suites.
- [ ] **Copyright Header**: Verified on all newly added source files.

## Related Issues / Bugs
Bug: crbug.com/yolo/
Closes #
