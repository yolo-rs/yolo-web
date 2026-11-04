# Contributing to YOLO-Web (Google & Chromium Standard)

Thank you for contributing to **YOLO-Web**! YOLO-Web is an open-source project modernizing Chromium in **Rust + Native Upstream Bun + Chromium V8**.

We maintain the same engineering standards as Google open-source projects and Chromium development.

---

## 1. Code of Conduct

We follow the [Google Open Source Code of Conduct](https://opensource.google/conduct/). Respectful, inclusive, and rigorous collaboration is expected from all contributors and AI agents.

---

## 2. Style Guides

All submissions must follow the official style guides detailed in [`docs/STYLE_GUIDE.md`](docs/STYLE_GUIDE.md):
- **Rust**: [Google Rust Style Guide](https://google.github.io/styleguide/rustguide.html) + `cargo fmt` + `cargo clippy`.
- **TypeScript / JavaScript**: [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html) + `bun check` + `bun fmt` + `bun lint`.
- **C++**: [Chromium C++ Style Guide](https://chromium.googlesource.com/chromium/src/+/main/styleguide/c++/c++.md).

---

## 3. Toolchain & Development Workflow

YOLO-Web enforces **100% Upstream Bun (v1.4.4+)** for all host operations and scripting. **Zero Node.js, zero Zig**.

```bash
# 1. Install dependencies
bun install

# 2. Run quality checks
bun check             # TypeScript 7 typecheck
bun fmt --check       # Prettier-compatible formatting check
bun lint              # Linter rules with --type-aware
bun test              # Comprehensive test runner

# 3. Rust workspace checks
cargo check --workspace
cargo fmt --check
cargo clippy --workspace -- -D warnings
```

---

## 4. Contributor License Agreement (CLA)

Contributions are licensed under the Apache-2.0 or BSD-3-Clause licenses. By contributing, you agree that your code will be governed by the project's [LICENSE](LICENSE).

All source files must contain the standard copyright header:
```typescript
// Copyright 2026 The YOLO-Web Authors. All rights reserved.
// Use of this source code is governed by a BSD-3-Clause / Apache-2.0
// license that can be found in the LICENSE file.
```
