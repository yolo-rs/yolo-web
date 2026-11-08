//! # Native GUI & Viewport Subsystem for YOLO Browser
//!
//! Provides an ultra-responsive 120+ FPS desktop window application with zero Electron overhead.
//! Bridges Servo (Stylo, Euclid, Webrender display lists, Surfman GPU surfaces) and Obscura (DOM, V8, CDP)
//! with interactive tabs, navigation bar, omnibox, shields indicator, and interactive event dispatching.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use url::Url;

use crate::YoloViewport;

/// Represents a single browser tab in the GUI session.
#[derive(Debug, Clone)]
pub struct GuiBrowserTab {
    /// Unique tab identifier.
    pub id: u64,
    /// Human-readable title of the tab.
    pub title: String,
    /// Currently loaded URL.
    pub url: Url,
    /// Favicon URL or inline image data.
    pub favicon_url: Option<String>,
    /// Navigation load progress (0.0 to 1.0).
    pub progress: f32,
    /// Whether the tab is actively loading resources.
    pub is_loading: bool,
    /// Whether Brave Shields / adblock is active on this tab.
    pub shields_active: bool,
    /// Total ads/trackers blocked in this tab session.
    pub blocked_count: u64,
}

impl GuiBrowserTab {
    /// Creates a new GUI browser tab.
    pub fn new(id: u64, url: Url) -> Self {
        let initial_title = url.host_str().unwrap_or("New Tab").to_string();
        Self {
            id,
            title: initial_title,
            url,
            favicon_url: None,
            progress: 1.0,
            is_loading: false,
            shields_active: true,
            blocked_count: 0,
        }
    }
}

/// Commands initiated by the user interface (clicks, keypresses, omnibox submit).
#[derive(Debug, Clone, PartialEq)]
pub enum GuiUserCommand {
    /// Navigate active tab to a specific URL or search query.
    Navigate(String),
    /// Reload current tab (bypass cache if hard is true).
    Reload { hard: bool },
    /// Go back in history.
    Back,
    /// Go forward in history.
    Forward,
    /// Stop ongoing navigation.
    Stop,
    /// Open a new tab with optional target URL.
    NewTab(Option<Url>),
    /// Close an existing tab by its ID.
    CloseTab(u64),
    /// Switch active viewport to the tab with specified ID.
    SelectTab(u64),
    /// Toggle Brave Shields protection for current tab.
    ToggleShields,
    /// Request screenshot or visual rasterization.
    CaptureScreenshot,
    /// Trigger CDP DevTools inspection.
    OpenDevTools,
}

/// Normalized user input event targeted at the web viewport.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ViewportInputEvent {
    /// Mouse pointer move in viewport coordinates (CSS pixels).
    MouseMove { x: f32, y: f32 },
    /// Mouse button pressed or released.
    MouseButton {
        x: f32,
        y: f32,
        button: MouseButtonKind,
        state: ElementStateKind,
    },
    /// Scroll wheel delta.
    Scroll { dx: f32, dy: f32 },
    /// Keyboard key event.
    Key {
        key_code: u32,
        state: ElementStateKind,
        modifiers: InputModifiers,
    },
}

/// Mouse button kind.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MouseButtonKind {
    Left,
    Middle,
    Right,
}

/// Input element state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ElementStateKind {
    Pressed,
    Released,
}

/// Active keyboard modifier flags.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct InputModifiers {
    pub shift: bool,
    pub ctrl: bool,
    pub alt: bool,
    pub meta: bool,
}

/// Backend graphics architecture powering the viewport.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GraphicsBackend {
    /// Hardware-accelerated WebGPU rendering via WGPU.
    WgpuBareMetal,
    /// WebRender GPU compositor via Surfman context / ANGLE / Direct3D12.
    WebRenderSurfman,
    /// High-throughput CPU rasterization via tiny-skia / pixmap (headless/screenshot).
    SoftwarePixmap,
}

/// State model for the native browser GUI window.
pub struct YoloBrowserGuiState {
    /// Tabs opened in this window.
    pub tabs: Vec<GuiBrowserTab>,
    /// Index of the currently visible and focused tab.
    pub active_tab_index: usize,
    /// Active text in the omnibox / navigation bar.
    pub omnibox_input: String,
    /// Whether the user has modified the omnibox text.
    pub omnibox_focused: bool,
    /// Target viewport dimensions.
    pub viewport: YoloViewport,
    /// Active graphics backend.
    pub graphics_backend: GraphicsBackend,
    /// Target frame rate (e.g. 120 FPS for bare-metal fluid scrolling).
    pub target_fps: u32,
    /// Flag indicating whether the viewport requires a repaint on next frame tick.
    pub needs_repaint: Arc<AtomicBool>,
    /// Queue of user commands awaiting processing by the browser engine / CDP pipeline.
    pub command_queue: Vec<GuiUserCommand>,
}

impl YoloBrowserGuiState {
    /// Instantiates a new GUI state with an initial tab.
    pub fn new(initial_url: Url, viewport: YoloViewport, backend: GraphicsBackend) -> Self {
        let initial_tab = GuiBrowserTab::new(1, initial_url.clone());
        let initial_omnibox = initial_url.to_string();
        Self {
            tabs: vec![initial_tab],
            active_tab_index: 0,
            omnibox_input: initial_omnibox,
            omnibox_focused: false,
            viewport,
            graphics_backend: backend,
            target_fps: 120,
            needs_repaint: Arc::new(AtomicBool::new(true)),
            command_queue: Vec::new(),
        }
    }

    /// Returns the currently active tab if available.
    pub fn active_tab(&self) -> Option<&GuiBrowserTab> {
        self.tabs.get(self.active_tab_index)
    }

    /// Returns a mutable reference to the currently active tab.
    pub fn active_tab_mut(&mut self) -> Option<&mut GuiBrowserTab> {
        self.tabs.get_mut(self.active_tab_index)
    }

    /// Handles omnibox submission: resolves URL or generates search query.
    pub fn submit_omnibox(&mut self) {
        let input = self.omnibox_input.trim();
        if input.is_empty() {
            return;
        }

        let target_url = if input.starts_with("http://")
            || input.starts_with("https://")
            || input.starts_with("about:")
            || input.starts_with("data:")
        {
            input.to_string()
        } else if input.contains('.') && !input.contains(' ') {
            format!("https://{input}")
        } else {
            // Default to privacy-preserving Brave Search
            format!("https://search.brave.com/search?q={}", urlencoding(input))
        };

        self.omnibox_focused = false;
        self.command_queue.push(GuiUserCommand::Navigate(target_url));
        self.needs_repaint.store(true, Ordering::Release);
    }

    /// Appends a new tab and sets it active.
    pub fn open_tab(&mut self, url: Url) {
        let new_id = (self.tabs.len() as u64) + 1;
        let tab = GuiBrowserTab::new(new_id, url.clone());
        self.tabs.push(tab);
        self.active_tab_index = self.tabs.len() - 1;
        self.omnibox_input = url.to_string();
        self.command_queue.push(GuiUserCommand::NewTab(Some(url)));
        self.needs_repaint.store(true, Ordering::Release);
    }

    /// Closes a tab at specified index.
    pub fn close_tab_at(&mut self, index: usize) {
        if self.tabs.len() <= 1 {
            // Keep at least one tab open
            return;
        }
        if index < self.tabs.len() {
            let removed = self.tabs.remove(index);
            self.command_queue.push(GuiUserCommand::CloseTab(removed.id));
            if self.active_tab_index >= self.tabs.len() {
                self.active_tab_index = self.tabs.len() - 1;
            }
            if let Some(tab) = self.active_tab() {
                self.omnibox_input = tab.url.to_string();
            }
            self.needs_repaint.store(true, Ordering::Release);
        }
    }

    /// Dispatches an interactive event from the window system into the viewport coordinate space.
    pub fn dispatch_viewport_event(&self, event: ViewportInputEvent) {
        // Marks repaint flag on interactive user actions
        self.needs_repaint.store(true, Ordering::Release);
        // Tracing or sending over IPC channel to Obscura/Servo constellation
        tracing::debug!(?event, "Viewport input event dispatched");
    }

    /// Drains pending commands for execution by browser runtime or CDP bridge.
    pub fn drain_commands(&mut self) -> Vec<GuiUserCommand> {
        self.command_queue.drain(..).collect()
    }
}

/// Simple percent encoding helper for search queries.
fn urlencoding(input: &str) -> String {
    let mut encoded = String::with_capacity(input.len());
    for byte in input.bytes() {
        match byte {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            b' ' => encoded.push('+'),
            _ => {
                encoded.push_str(&format!("%{:02X}", byte));
            }
        }
    }
    encoded
}
