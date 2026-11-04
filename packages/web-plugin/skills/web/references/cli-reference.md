# CLI Reference for Unified `web` CLI

The `web` command-line utility unifies Obscura headless browser, Brave Search CLI (`bx`), Servo tools, and Bun host tools into a single command.

## Usage

```bash
web <command> [options] [arguments]
```

## Subcommands

### 1. `web fetch <url>`

Fetch and render a URL using Obscura's Chromium V8 engine with Brave Shields active.

**Options**:

- `--screenshot <path>`: Write PNG screenshot to target path.
- `--pdf <path>`: Write rendered PDF to target path.
- `--markdown`: Extract readable markdown to stdout.
- `--eval <script>`: Execute JavaScript code inside the Chromium V8 isolate.
- `--dump <format>`: Dump page in format (`text`, `html`, `markdown`, `links`, `original`).
- `--stealth`: Apply TLS fingerprinting, user agent masking, and WebGL noise (default: true).
- `--no-shields`: Disable Brave Shields adblock and tracker filtering.

### 2. `web search <query>`

Execute a web search using Brave's private, independent search index.

**Options**:

- `-c, --count <n>`: Number of results to return (1-20, default: 10).
- `-o, --offset <n>`: Pagination offset (default: 0).

### 3. `web context <query>`

RAG & AI grounding endpoint. Returns clean, structured, token-budgeted text snippets.

**Options**:

- `-t, --max-tokens <n>`: Total token budget for returned snippets (default: 4096).

### 4. `web shields <url>`

Test a URL against Brave Shields `adblock-rust` network rules and `CookieCrumbler`.

**Options**:

- `-s, --source <url>`: Source page initiating the request (default: `https://example.com/`).
- `-t, --type <type>`: Resource type (`script`, `image`, `stylesheet`, `xmlhttprequest`, default: `script`).

### 5. `web servo <query>`

Compute Servo Stylo selector specificity or translate XPath to CSS3.

**Options**:

- `--xpath`: Treat input as XPath 1.0 and translate to CSS3 selector.

### 6. `web mcp`

Run the unified `web` Model Context Protocol (MCP) server.

**Options**:

- `-t, --transport <type>`: Transport mode (`stdio` or `http`, default: `stdio`).
- `-p, --port <port>`: Port to bind when using HTTP transport (default: 3000).

### 7. `web serve`

Launch the Chrome DevTools Protocol (CDP) WebSocket server on `ws://127.0.0.1:<port>/devtools/browser`.

**Options**:

- `-p, --port <port>`: Port to bind (default: 9222).
- `--host <host>`: Bind address (default: `127.0.0.1`).

### 8. `web info`

Inspect the complete dual-runtime engine state, compiled crates, and memory usage.

**Options**:

- `--json`: Output as structured JSON.
