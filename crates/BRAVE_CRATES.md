# Consolidated Brave Rust Crates & Privacy Shields (`crates/brave-*`)

This document catalogs the upstream **Brave Software (`github.com/brave`)** Rust crates, filter lists, skills, and Bun TypeScript packages consolidated into the `yolo-web` Cargo + Bun monorepo.

---

## 1. Upstream GitHub Forks (`aphrody-dev/*`)

All 12 top-starred Brave repositories have been forked and synchronized:

| Upstream Repository             | Fork URL                                                 | Monorepo Target                                                  |
| :------------------------------ | :------------------------------------------------------- | :--------------------------------------------------------------- |
| `brave/brave-browser`           | `https://github.com/aphrody-dev/brave-browser`           | Reference architecture & Shields specs                           |
| `brave/brave-core`              | `https://github.com/aphrody-dev/brave-core`              | Reference Shields & farbling specs                               |
| `brave/adblock-rust`            | `https://github.com/aphrody-dev/adblock-rust`            | `crates/brave-adblock`                                           |
| `brave/brave-search-mcp-server` | `https://github.com/aphrody-dev/brave-search-mcp-server` | `packages/brave-shields` & `packages/brave-search-mcp`           |
| `brave/adblock-lists`           | `https://github.com/aphrody-dev/adblock-lists`           | `crates/brave-adblock/lists`                                     |
| `brave/brave-search-skills`     | `https://github.com/aphrody-dev/brave-search-skills`     | `skills/brave-search`                                            |
| `brave/cookiecrumbler`          | `https://github.com/aphrody-dev/cookiecrumbler`          | `crates/brave-adblock/cookiecrumbler` & `packages/brave-shields` |
| `brave/adblock-resources`       | `https://github.com/aphrody-dev/adblock-resources`       | `crates/brave-adblock/resources`                                 |
| `brave/brave-search-cli`        | `https://github.com/aphrody-dev/brave-search-cli`        | `crates/brave-search-cli`                                        |
| `brave/kuchikiki`               | `https://github.com/aphrody-dev/kuchikiki`               | `crates/brave-kuchikiki`                                         |
| `brave/sta-rs`                  | `https://github.com/aphrody-dev/sta-rs`                  | `crates/brave-star`                                              |
| `brave/bravebot`                | `https://github.com/aphrody-dev/bravebot`                | `crates/brave-bot`                                               |

---

## 2. Consolidated Rust Crates (`crates/brave-*`)

### 2.1 `crates/brave-adblock` (`adblock` v0.13.5)

- **Upstream**: `brave/adblock-rust`, `brave/adblock-lists`, `brave/adblock-resources`, `brave/cookiecrumbler`
- **Purpose**: High-performance native Rust ABP/uBlock filter parser, tokenizer, network blocker, and cosmetic CSS selector engine.
- **Bundled Resources**:
  - `crates/brave-adblock/lists/`: Official Brave filter lists (`brave-unbreak.txt`, `brave-lists/`, `custom/`).
  - `crates/brave-adblock/resources/`: Surrogate scriptlets and redirect resources from `brave/adblock-resources`.
  - `crates/brave-adblock/cookiecrumbler/`: Cookie consent notice detection and hiding rules from `brave/cookiecrumbler`.

### 2.2 `crates/brave-kuchikiki` (`kuchikiki` v0.8.2)

- **Upstream**: `brave/kuchikiki`
- **Purpose**: `(口利き)` HTML5 tree manipulation and CSS selector matching library built on `html5ever`, `cssparser`, and `selectors`. Used across DOM sanitization, reader mode, and cosmetic filter injection.

### 2.3 `crates/brave-search-cli` (`brave-search-cli` / `bx` v1.7.0)

- **Upstream**: `brave/brave-search-cli`
- **Purpose**: Token-efficient Rust CLI (`bx`) for the Brave Search API, optimized for AI agents, RAG pipelines, and LLM grounding.

### 2.4 `crates/brave-star` (`sta-rs` v0.3.3)

- **Upstream**: `brave/sta-rs`
- **Purpose**: Distributed Secret-Sharing for Threshold Aggregation Reporting (`STAR`), including `adss`, `ppoprf`, and `sharks` sub-crates for k-anonymous, privacy-preserving browser telemetry.

### 2.5 `crates/brave-bot` (`bravebot-core` v0.20.0)

- **Upstream**: `brave/bravebot`
- **Purpose**: Information-flow security kernel with taint labels, capability slots, policy gates, and sandboxed agent execution.

---

## 3. Bun TypeScript Packages & Skills

### 3.1 `packages/brave-shields` (`@yolo-web/brave-shields` v0.2.0)

- **`BraveShieldsEngine`**: Pure Bun TypeScript network & cosmetic filter engine compatible with `adblock-rust` and `cookiecrumbler` (`||domain^`, `$third-party`, `$script,image,xmlhttprequest`, `@@||` exceptions, `$important`, `##` cosmetic selectors, `#@#` cosmetic exceptions).
- **`BraveFingerprintProtection`**: Stealth & anti-fingerprinting shield profiles (`off`, `standard`, `strict`) with deterministic per-domain Canvas/AudioContext farbling, cross-origin `Referer` trimming, `Sec-GPC: 1` & `DNT: 1` headers, and tracking query parameter stripping (`utm_*`, `fbclid`, `gclid`, `msclkid`, `mc_eid`, etc.).
- **`BraveSearchMcpBridge`**: Pure Bun client and MCP tool handler (`brave_web_search`, `brave_local_search`, `brave_news_search`) using native `fetch`.

### 3.2 `packages/brave-search-mcp` (`@yolo-web/brave-search-mcp` v2.1.4)

- Pure Bun port of `brave/brave-search-mcp-server` with all Node.js/npm/dotenv legacy dependencies purged.

### 3.3 `skills/brave-search`

- Consolidated agent skills from `brave/brave-search-skills` for web, local, news, and LLM-context search workflows.
