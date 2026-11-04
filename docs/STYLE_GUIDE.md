# Google & Chromium Engineering & Style Guide for YOLO-Web

> **Official Standard**: This guide encodes the official Google Style Guides (Rust, TypeScript, JavaScript, C++, C) and Chromium Engineering Guidelines as mandatory requirements for all AI agents and human contributors working on YOLO-Web.

---

## 1. Google & Chromium Core Principles

1. **Safety & Zero Undefined Behavior (UB)**:
   - YOLO-Web modernizes Chromium by porting critical systems to Rust.
   - `unsafe` in Rust is strictly bounded, annotated with a `// SAFETY:` invariant comment, and audited.
   - Host plane runs on 100% Upstream Bun (v1.4.4+ in Rust + WebKit/JSC); in-page script execution runs strictly in isolated V8 Isolates (`deno_core`/`rusty_v8`).

2. **Zero Host Leakage**:
   - Never leak host globals, environment variables (`process.env`), or internal file paths into browser page V8 contexts.

3. **Chromium Compatibility**:
   - Modernize without breaking Chromium DevTools Protocol (CDP), web standards (HTML5/CSS3/DOM Level 4), or Blink semantics.

---

## 2. Rust Style Guide (Google & Chromium Standard)

- **Formatting**: Enforced via `cargo fmt` (`rustfmt.toml`). 100-character line limit.
- **Naming Conventions**:
  - Types, Traits, Enums: `UpperCamelCase` (e.g., `ChromiumTrackingEngine`, `DualEngineCoordinator`).
  - Functions, Methods, Variables: `snake_case` (e.g., `calculate_specificity`, `fetch_channel_details`).
  - Constants & Statics: `SCREAMING_SNAKE_CASE` (e.g., `MAX_PAYLOAD_BYTES`).
- **Error Handling**:
  - Prefer `Result<T, E>` with domain-specific error enums (`thiserror`).
  - Never call `unwrap()` or `expect()` in library crates (`crates/*`) outside tests. Propagate with `?`.
- **Memory Safety & Unsafe Rules**:
  - Every `unsafe` block must be preceded by:
    ```rust
    // SAFETY: <justification detailing why preconditions are satisfied>
    unsafe { ... }
    ```
- **Linter Quality Gates**:
  - Run `cargo clippy --workspace --all-targets -- -D warnings`.

---

## 3. TypeScript & JavaScript Style Guide (Google Standard)

- **No `any`**: Strictly banned. Use `unknown`, generics, or exact discriminated union interfaces.
- **Type Annotations**: Explicit return types on all exported functions, methods, and classes.
- **Async/Await**:
  - Never mix `Promise.then()` with `async/await` in the same function scope.
  - Always handle promise rejections or bubble errors cleanly.
- **Resource Management**:
  - Use Explicit Resource Management (`using` / `await using`) for disposable handles, DB instances, file descriptors, and test servers.
- **Toolchain Quality Gate**:
  - Typecheck: `bun check` (TypeScript 7 / tsgo engine).
  - Format: `bun fmt`.
  - Lint: `bun lint` with `--type-aware`.
  - Test: `bun test`.

---

## 4. C++ & C Style Guide (Google & Chromium Standard)

- **Chromium Guidelines**:
  - Headers: Include `<memory>`, `<utility>`, `<string_view>` explicitly. Use `#pragma once` or standard include guards.
  - Smart Pointers: Use `std::unique_ptr<T>` for unique ownership and `scoped_refptr<T>` for reference-counted Blink/Chromium objects. Never use raw `new` / `delete`.
  - Naming:
    - Classes & Structs: `PascalCase`.
    - Methods: `CamelCase()` (Google style) or `snake_case()` where matching STL concepts.
    - Member variables: `trailing_underscore_` (e.g., `isolate_`, `client_hint_profile_`).
- **Exceptions**: Exceptions are disabled (`-fno-exceptions`) in accordance with Google C++ and Chromium architecture. Return `absl::Status` / `base::expected<T, E>`.

---

## 5. Google Open Source Licensing & Headers

Every source file (`.rs`, `.ts`, `.js`, `.cc`, `.h`, `.cpp`) must start with an appropriate copyright header:

```typescript
// Copyright 2026 The YOLO-Web Authors. All rights reserved.
// Use of this source code is governed by a BSD-3-Clause / Apache-2.0
// license that can be found in the LICENSE file.
```

---

## 6. Commit Message & PR Standards (Google Conventional Commits)

```
<type>(<scope>): <short imperative summary>

[optional body explaining context, why, and alternatives considered]

Bug: crbug.com/yolo/<id> or Issue #<id>
Change-Id: I<hash>
Reviewed-by: <reviewer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
