use anyhow::Result;
use clap::{Parser, Subcommand};
use yolo_browser::{engine_info, EngineMode, YoloBrowserSession, YoloViewport};

#[derive(Parser, Debug)]
#[command(
    name = "yolo-browser",
    version,
    about = "Unified Chromium-compatible Rust browser for AI agents and humans (Servo + Obscura + Brave + Bun)"
)]
struct Cli {
    /// Enable privacy-first stealth mode
    #[arg(long, global = true, default_value_t = true)]
    stealth: bool,

    /// Enable Brave Shields adblock & tracker protection
    #[arg(long, global = true, default_value_t = true)]
    brave_shields: bool,

    /// Allow loopback / private RFC1918 network requests
    #[arg(long, global = true, default_value_t = false)]
    allow_private_network: bool,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Print consolidated Servo + Obscura + Brave monorepo engine architecture & crates
    Info {
        /// Output as JSON
        #[arg(long)]
        json: bool,
    },
    /// Parse an HTML document with Servo html5ever + Obscura DOM and query a CSS selector
    Query {
        /// Inline HTML string or path to an HTML file
        #[arg(long)]
        html: String,
        /// CSS selector to query
        #[arg(long, default_value = "*")]
        selector: String,
    },
    /// Check whether a URL is blocked by Brave Shields (adblock-rust) or Obscura SSRF gate
    ShieldCheck {
        /// Request URL to test
        #[arg(long)]
        url: String,
        /// Source page URL
        #[arg(long, default_value = "https://example.com/")]
        source_url: String,
        /// Resource type (script, image, xmlhttprequest, document, subdocument)
        #[arg(long, default_value = "script")]
        resource_type: String,
    },
    /// Launch a CDP server for AI agents (Playwright, Puppeteer, Bun CDP client) and Human Live View
    Serve {
        /// Port to bind the Chrome DevTools Protocol WebSocket server
        #[arg(long, default_value_t = 9222)]
        port: u16,
        /// Viewport width in CSS pixels
        #[arg(long, default_value_t = 1280.0)]
        width: f32,
        /// Viewport height in CSS pixels
        #[arg(long, default_value_t = 800.0)]
        height: f32,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Info { json } => {
            let info = engine_info();
            if json {
                println!("{}", serde_json::to_string_pretty(&info)?);
            } else {
                println!("=== {} v{} ({}) ===", info.name, info.version, info.organization);
                println!("Repository      : {}", info.repository);
                println!("JS/TS Toolchain : {}", info.js_toolchain);
                println!(
                    "Obscura Crates  : {} ({})",
                    info.obscura_crates.len(),
                    info.obscura_crates.join(", ")
                );
                println!(
                    "Servo Crates    : {} ({})",
                    info.servo_crates.len(),
                    info.servo_crates.join(", ")
                );
                println!(
                    "Brave Crates    : {} ({})",
                    info.brave_crates.len(),
                    info.brave_crates.join(", ")
                );
            }
        }
        Commands::Query { html, selector } => {
            let content = if std::path::Path::new(&html).exists() {
                std::fs::read_to_string(&html)?
            } else {
                html
            };
            let mut session = YoloBrowserSession::new(
                EngineMode::HybridCoPilot,
                YoloViewport::default(),
            );
            session.stealth_enabled = cli.stealth;
            session.brave_shields_enabled = cli.brave_shields;
            session.allow_private_network = cli.allow_private_network;
            let dom = session.parse_html(&content);
            let matches = dom
                .query_selector_all(&selector)
                .map_err(|e| anyhow::anyhow!(e))?;
            session.cache_selector_match(&selector, &matches);
            println!(
                "{}",
                serde_json::json!({
                    "selector": selector,
                    "count": matches.len(),
                    "nodeIds": matches,
                    "viewport": session.viewport.physical_size().to_array(),
                })
            );
        }
        Commands::ShieldCheck {
            url,
            source_url,
            resource_type,
        } => {
            let mut session = YoloBrowserSession::new(
                EngineMode::AiAgent,
                YoloViewport::default(),
            );
            session.brave_shields_enabled = cli.brave_shields;
            session.allow_private_network = cli.allow_private_network;
            let ssrf_valid = session.validate_url(&url).is_ok();
            let blocked_by_brave = session.should_block_request(&url, &source_url, &resource_type);
            println!(
                "{}",
                serde_json::json!({
                    "url": url,
                    "sourceUrl": source_url,
                    "resourceType": resource_type,
                    "ssrfAllowed": ssrf_valid,
                    "blockedByBraveShields": blocked_by_brave,
                })
            );
        }
        Commands::Serve {
            port,
            width,
            height,
        } => {
            tracing_subscriber::fmt::init();
            let viewport = YoloViewport::new(width, height, 1.0);
            let mut session = YoloBrowserSession::new(EngineMode::HybridCoPilot, viewport);
            session.cdp_port = port;
            session.stealth_enabled = cli.stealth;
            session.brave_shields_enabled = cli.brave_shields;
            session.allow_private_network = cli.allow_private_network;
            println!(
                "Starting YOLO Browser CDP server on ws://127.0.0.1:{}/devtools/browser (viewport: {}x{})",
                port, width as u32, height as u32
            );
            obscura_cdp::serve(port, None).await?;
        }
    }

    Ok(())
}
