//! # YOLO Browser (`yolo-browser`)
//!
//! Unified Chromium-compatible browser engine in pure Rust for **AI Agents** and **Humans**.
//! Consolidates three pillars in a single Rust + Bun monorepo (`https://github.com/yolo-rs/yolo-web`):
//! - **Servo** (`crates/servo-*`): W3C HTML5/XML5 parsers (`html5ever`, `markup5ever`, `xml5ever`),
//!   Stylo CSS3 & selector matching (`cssparser`, `selectors`, `servo_arc`), 2D/3D geometry (`euclid`),
//!   stack caches & collections (`smallvec`, `tendril`, `uluru`, `fnv`), SVG, XPath, and WebVTT.
//! - **Obscura** (`crates/obscura*`): V8 (`deno_core`) JavaScript runtime, DOM tree, Taffy/Cosmic-Text/Tiny-Skia
//!   layout & rasterizer, stealth TLS transport, Chrome DevTools Protocol (CDP), and MCP server.
//! - **Brave** (`crates/brave-*`): Native Rust Adblock & Shields engine (`adblock-rust`), `kuchikiki`
//!   HTML tree manipulation, `sta-rs` privacy telemetry, and `bravebot-core` prompt-injection resistance.

pub use obscura;
pub use obscura_browser as browser;
pub use obscura_cdp as cdp;
pub use obscura_dom as dom;
pub use obscura_js as js;
pub use obscura_mcp as mcp;
pub use obscura_net as net;
pub use obscura_render as render;
pub use obscura_ssrf as ssrf;
/// Typed browser and web-platform standards registry bundled with YOLO-Web.
pub use yolo_standards as standards;

/// Optional metadata bridge to the versioned yolo-zig native ABI.
///
/// Enable the `zig-ffi` feature and set `YOLO_ZIG_LIB_DIR` to the directory
/// containing the target-specific library built by the yolo-zig workspace.
#[cfg(feature = "zig-ffi")]
pub mod zig_ffi {
    pub use yolo_zig_ffi::{ABI_VERSION, Error, RuntimeInfo, runtime_info};
}

/// Re-exported Servo engine crates consolidated into the monorepo.
pub mod servo {
    pub use cssparser;
    pub use euclid;
    pub use fnv;
    pub use html5ever;
    pub use markup5ever;
    pub use selectors;
    pub use servo_arc;
    pub use servo_svg as svg;
    pub use servo_webvtt as webvtt;
    pub use smallvec;
    pub use tendril;
    pub use uluru;
    pub use url;
    pub use xml5ever;
}

/// Re-exported Brave privacy, adblock, DOM, and security crates consolidated into the monorepo.
pub mod brave {
    pub use adblock;
    pub use bravebot_core;
    pub use kuchikiki;
}

/// Re-exported Deno & V8 browser runtime crates consolidated into the monorepo.
pub mod deno_v8 {
    pub use deno_core_parking_lot as parking_lot;
    pub use deno_error;
    pub use deno_media_type as media_type;
    pub use deno_unsafecell as unsafecell;
    pub use deno_unsync as unsync;
    pub use fastwebsockets;
    pub use import_map;
}

use adblock::lists::{FilterSet, ParseOptions};
use adblock::request::Request as AdblockRequest;
use adblock::Engine as BraveAdblockEngine;
use euclid::{Point2D, Rect, Scale, Size2D};
use fnv::FnvHashMap;
use serde::{Deserialize, Serialize};
use smallvec::SmallVec;
use uluru::LRUCache;

/// Logical CSS pixel unit tag for Servo `euclid` geometry.
#[derive(Debug, Copy, Clone, PartialEq, Eq, Default)]
pub struct CssPixel;

/// Physical device pixel unit tag for Servo `euclid` geometry.
#[derive(Debug, Copy, Clone, PartialEq, Eq, Default)]
pub struct DevicePixel;

/// Operating mode for the unified browser engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EngineMode {
    /// Headless high-throughput mode for AI agents (CDP + MCP + Stealth + Brave Shields).
    AiAgent,
    /// Interactive viewport mode for humans with live input & visual feedback.
    HumanInteractive,
    /// Shared co-pilot mode where AI agents and humans collaborate on the same session.
    HybridCoPilot,
}

/// Viewport geometry backed by Servo's `euclid` linear algebra primitives.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct YoloViewport {
    pub width_css: f32,
    pub height_css: f32,
    pub device_pixel_ratio: f32,
}

impl Default for YoloViewport {
    fn default() -> Self {
        Self {
            width_css: 1280.0,
            height_css: 800.0,
            device_pixel_ratio: 1.0,
        }
    }
}

impl YoloViewport {
    pub fn new(width_css: f32, height_css: f32, device_pixel_ratio: f32) -> Self {
        Self {
            width_css,
            height_css,
            device_pixel_ratio: device_pixel_ratio.max(0.5),
        }
    }

    /// Returns the logical CSS viewport rectangle using Servo `euclid::Rect`.
    pub fn css_rect(&self) -> Rect<f32, CssPixel> {
        Rect::new(
            Point2D::origin(),
            Size2D::new(self.width_css, self.height_css),
        )
    }

    /// Returns the physical device pixel dimensions using Servo `euclid::Scale` and `Size2D`.
    pub fn physical_size(&self) -> Size2D<u32, DevicePixel> {
        let scale: Scale<f32, CssPixel, DevicePixel> = Scale::new(self.device_pixel_ratio);
        let scaled = Size2D::<f32, CssPixel>::new(self.width_css, self.height_css) * scale;
        Size2D::new(scaled.width.round() as u32, scaled.height.round() as u32)
    }
}

/// Cached DOM/Selector entry stored in Servo's stack-allocated `uluru::LRUCache`.
#[derive(Debug, Clone)]
pub struct CachedQueryEntry {
    pub selector: String,
    pub matched_node_ids: SmallVec<[usize; 8]>,
}

/// Default Brave Shields filter rules compiled into every `YoloBrowserSession`.
pub const DEFAULT_BRAVE_SHIELDS_RULES: &[&str] = &[
    "||doubleclick.net^",
    "||googlesyndication.com^",
    "||google-analytics.com^",
    "||connect.facebook.net^",
    "||adservice.google.com^",
    "##.ad-banner",
    "##.cookie-consent-banner",
];

/// Unified browser engine manifest and session state combining Servo, Obscura, and Brave subsystems.
pub struct YoloBrowserSession {
    pub mode: EngineMode,
    pub viewport: YoloViewport,
    pub stealth_enabled: bool,
    pub brave_shields_enabled: bool,
    pub allow_private_network: bool,
    pub cdp_port: u16,
    pub mcp_port: Option<u16>,
    selector_cache: LRUCache<CachedQueryEntry, 32>,
    metadata: FnvHashMap<String, String>,
    adblock_engine: BraveAdblockEngine,
}

impl YoloBrowserSession {
    pub fn new(mode: EngineMode, viewport: YoloViewport) -> Self {
        Self::with_filter_rules(mode, viewport, DEFAULT_BRAVE_SHIELDS_RULES)
    }

    pub fn with_filter_rules(
        mode: EngineMode,
        viewport: YoloViewport,
        rules: &[&str],
    ) -> Self {
        let mut metadata = FnvHashMap::default();
        metadata.insert(
            "engine".to_string(),
            "yolo-browser (servo + obscura + brave)".to_string(),
        );
        metadata.insert("runtime".to_string(), "rust + bun".to_string());

        let mut filter_set = FilterSet::new(true);
        let list_text = rules.join("\n");
        filter_set.add_filter_list(list_text, ParseOptions::default());
        let adblock_engine = BraveAdblockEngine::new_with_filter_set(filter_set);

        Self {
            mode,
            viewport,
            stealth_enabled: true,
            brave_shields_enabled: true,
            allow_private_network: false,
            cdp_port: 9222,
            mcp_port: Some(3000),
            selector_cache: LRUCache::default(),
            metadata,
            adblock_engine,
        }
    }

    /// Evaluates a network request against Brave's native Rust `adblock` engine.
    pub fn should_block_request(
        &self,
        url: &str,
        source_url: &str,
        request_type: &str,
    ) -> bool {
        if !self.brave_shields_enabled {
            return false;
        }
        match AdblockRequest::new(url, source_url, request_type, "GET") {
            Ok(req) => self.adblock_engine.check_network_request(&req).should_block(),
            Err(_) => false,
        }
    }

    /// Records a selector query result in Servo's fast `uluru::LRUCache`.
    pub fn cache_selector_match(&mut self, selector: impl Into<String>, nodes: &[usize]) {
        let selector = selector.into();
        let mut matched_node_ids = SmallVec::<[usize; 8]>::new();
        matched_node_ids.extend_from_slice(nodes);
        self.selector_cache.insert(CachedQueryEntry {
            selector,
            matched_node_ids,
        });
    }

    /// Looks up a previously cached selector match in `O(1)` stack memory.
    pub fn lookup_cached_selector(&mut self, selector: &str) -> Option<&[usize]> {
        self.selector_cache
            .find(|entry| entry.selector == selector)
            .map(|entry| entry.matched_node_ids.as_slice())
    }

    /// Sets a session metadata key in Servo's `fnv::FnvHashMap`.
    pub fn set_metadata(&mut self, key: impl Into<String>, value: impl Into<String>) {
        self.metadata.insert(key.into(), value.into());
    }

    pub fn get_metadata(&self, key: &str) -> Option<&str> {
        self.metadata.get(key).map(String::as_str)
    }

    /// Parses an HTML snippet into an `obscura_dom::DomTree` using Servo's `html5ever`.
    pub fn parse_html(&self, html: &str) -> obscura_dom::DomTree {
        obscura_dom::parse_html(html)
    }

    /// Validates whether a target URL passes Obscura's SSRF protection gate and Brave Shields.
    pub fn validate_url(&self, raw_url: &str) -> Result<url::Url, String> {
        let parsed = url::Url::parse(raw_url).map_err(|e| e.to_string())?;
        match parsed.scheme() {
            "http" | "https" | "data" => {}
            "about" if parsed.as_str() == "about:blank" => return Ok(parsed),
            scheme => return Err(format!("URL scheme '{scheme}' is not allowed by browser navigation policy")),
        }

        // `data:` documents have no network destination. Their payload is
        // parsed by the document pipeline and must not be treated as a host.
        if parsed.scheme() == "data" {
            return Ok(parsed);
        }

        if !self.allow_private_network {
            if let Some(host) = parsed.host_str() {
                if let Ok(ip) = host.parse::<std::net::IpAddr>() {
                    if obscura_ssrf::is_forbidden_ip(ip) {
                        return Err(format!(
                            "Access to private/internal host {host} is blocked by SSRF gate"
                        ));
                    }
                } else if host == "localhost" || host.ends_with(".localhost") {
                    return Err(format!(
                        "Access to private/internal host {host} is blocked by SSRF gate"
                    ));
                }
            }
        }
        Ok(parsed)
    }
}

/// Summary of all consolidated Rust crates in the `yolo-web` monorepo.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonorepoEngineInfo {
    pub name: &'static str,
    pub organization: &'static str,
    pub repository: &'static str,
    pub version: &'static str,
    pub js_toolchain: &'static str,
    pub host_runtime_plane: &'static str,
    pub guest_browser_plane: &'static str,
    pub optimization_profile: &'static str,
    pub obscura_crates: Vec<&'static str>,
    pub servo_crates: Vec<&'static str>,
    pub brave_crates: Vec<&'static str>,
    pub deno_v8_crates: Vec<&'static str>,
}

pub fn engine_info() -> MonorepoEngineInfo {
    MonorepoEngineInfo {
        name: "yolo-web",
        organization: "yolo-rs",
        repository: "https://github.com/yolo-rs/yolo-web",
        version: env!("CARGO_PKG_VERSION"),
        js_toolchain: "Bun (repo scripts) + deno_core/V8 (Rust page runtime)",
        host_runtime_plane: "Bun runs tooling and application scripts; WebKit/JSC is not vendored in this workspace",
        guest_browser_plane: "deno_core/V8 is integrated through Obscura; rendering and Web APIs are provided by Rust components, not Chromium/Blink",
        optimization_profile: "Cargo workspace release profile and package-specific Bun build scripts; no single combined Bun/Cargo AOT profile",
        obscura_crates: vec![
            "obscura",
            "obscura-browser",
            "obscura-cdp",
            "obscura-cli",
            "obscura-dom",
            "obscura-js",
            "obscura-mcp",
            "obscura-net",
            "obscura-render",
            "obscura-ssrf",
        ],
        servo_crates: vec![
            "servo-html5ever",
            "servo-markup5ever",
            "servo-xml5ever",
            "servo-web-atoms",
            "servo-rcdom",
            "servo-tendril",
            "servo-cssparser",
            "servo-euclid",
            "servo-smallvec",
            "servo-rust-url",
            "servo-uluru",
            "servo-fnv",
            "servo-ipc-channel",
            "servo-string-cache",
            "servo-stylo",
            "servo-webrender",
            "servo-pathfinder",
            "servo-font-kit",
            "servo-surfman",
            "servo-gaol",
            "servo-svg",
            "servo-xpath",
            "servo-webvtt",
            "servo-timers",
            "servo-allocator",
            "servo-tracing",
            "servo-dom-struct",
            "servo-deny-public-fields",
            "servo-hyper-serde",
            "servo-url",
            "servo-engine",
        ],
        brave_crates: vec![
            "brave-adblock",
            "brave-kuchikiki",
            "brave-search-cli",
            "brave-star",
            "brave-bot",
        ],
        deno_v8_crates: vec![
            "deno-core",
            "deno-error",
            "deno-import-map",
            "deno-fastwebsockets",
            "deno-media-type",
            "deno-unsync",
            "deno-unsafecell",
            "deno-core-parking-lot",
        ],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn viewport_euclid_geometry_scales_accurately() {
        let vp = YoloViewport::new(1440.0, 900.0, 2.0);
        let css = vp.css_rect();
        assert_eq!(css.width(), 1440.0);
        assert_eq!(css.height(), 900.0);

        let phys = vp.physical_size();
        assert_eq!(phys.width, 2880);
        assert_eq!(phys.height, 1800);
    }

    #[test]
    fn session_uluru_cache_and_html5ever_dom_work_together() {
        let mut session = YoloBrowserSession::new(
            EngineMode::HybridCoPilot,
            YoloViewport::default(),
        );
        let tree = session.parse_html(
            "<!doctype html><html><body><main id='app'><button class='cta'>Launch</button></main></body></html>",
        );
        let matches = tree.query_selector_all(".cta").expect("valid selector");
        assert_eq!(matches.len(), 1);
        let indices: Vec<usize> = matches.iter().map(|n| n.index()).collect();

        session.cache_selector_match(".cta", &indices);
        assert_eq!(session.lookup_cached_selector(".cta"), Some(indices.as_slice()));
    }

    #[test]
    fn brave_adblock_engine_blocks_trackers_and_allows_first_party() {
        let session = YoloBrowserSession::new(EngineMode::AiAgent, YoloViewport::default());
        assert!(session.should_block_request(
            "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js",
            "https://example.com/",
            "script"
        ));
        assert!(!session.should_block_request(
            "https://example.com/assets/app.js",
            "https://example.com/",
            "script"
        ));
    }

    #[test]
    fn ssrf_gate_blocks_loopback_by_default() {
        let session = YoloBrowserSession::new(EngineMode::AiAgent, YoloViewport::default());
        assert!(session.validate_url("https://example.com/path").is_ok());
        assert!(session.validate_url("http://127.0.0.1:8080/admin").is_err());
        assert!(session.validate_url("file:///etc/passwd").is_err());
        assert!(session.validate_url("javascript:alert(1)").is_err());
        assert!(session.validate_url("about:blank").is_ok());
        assert!(session.validate_url("data:text/html,<p>ok</p>").is_ok());
    }

    #[test]
    fn deno_v8_media_type_and_import_map_resolve_correctly() {
        let base_url = url::Url::parse("https://yolo-rs.dev/app/index.html").unwrap();
        let map_res = deno_v8::import_map::parse_from_json(
            base_url.clone(),
            r#"{"imports": {"@yolo/sdk": "./sdk/mod.js"}}"#,
        )
        .expect("valid WICG import map");
        let resolved = map_res
            .import_map
            .resolve("@yolo/sdk", &base_url)
            .expect("resolved import map specifier");
        assert_eq!(resolved.as_str(), "https://yolo-rs.dev/app/sdk/mod.js");

        let media = deno_v8::media_type::MediaType::from_specifier(&resolved);
        assert_eq!(media, deno_v8::media_type::MediaType::JavaScript);
    }
}
