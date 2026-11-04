# Contributing to YOLO-Web

Thank you for contributing to **YOLO-Web**. The project combines Bun developer tools, Rust workspace crates, and research/build workflows around upstream browser engines. Read the [architecture](docs/ARCHITECTURE.mdx) and [style guide](docs/STYLE_GUIDE.mdx) before changing ownership boundaries.

---

## 1. Code of Conduct

We follow the [Google Open Source Code of Conduct](https://opensource.google/conduct/). Respectful, inclusive, and rigorous collaboration is expected from all contributors and AI agents.

---

## 2. Style Guides

Follow [`docs/STYLE_GUIDE.mdx`](docs/STYLE_GUIDE.mdx). For imported upstream trees, preserve the style and build rules of the owning project.

---

## 3. Toolchain & Development Workflow

YOLO-Web-owned JavaScript/TypeScript applications and scripts run on Bun. Windows 11 and Linux x64 are first-class hosts. Chromium uses its official checkout/build tools; Cargo owns Rust builds.

```sh
# 1. Install dependencies
bun install

# 2. Run the checks relevant to your change
bun check
bun fmt --check
bun lint
bun test

# 3. Rust checks (scope commands to the crate you changed)
cargo fmt --check
cargo check -p yolo-browser
```

For crates that instantiate V8 isolates (`obscura-js`, `obscura-browser`, and
`obscura-cdp`), use process-isolated suites with `cargo nextest run -p <crate>`.

---

## 4. Licensing and upstream changes

Follow the repository's [LICENSE](LICENSE) and preserve upstream license and copyright notices. Do not add blanket headers to imported files. Chromium changes must identify their upstream revision, patch provenance, and applicable Chromium contribution requirements.
