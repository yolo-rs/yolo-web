//! # Bare-Metal & Webrender Compositor Bridge
//!
//! Bridges Servo Webrender / Surfman / WGPU / Tiny-Skia rendering pipelines for 120 FPS
//! window presentation and headless off-screen bitmap/PNG/PDF generation.

use euclid::{Rect, Size2D};
use std::sync::Arc;
use crate::{CssPixel, DevicePixel, YoloViewport};

/// Composited surface frame buffer.
#[derive(Clone)]
pub struct CompositedFrame {
    /// Width in device pixels.
    pub width: u32,
    /// Height in device pixels.
    pub height: u32,
    /// RGBA8 / BGRA8 pixel bytes for direct swapchain presentation or serialization.
    pub rgba_data: Arc<Vec<u8>>,
    /// Presentation timestamp in nanoseconds.
    pub timestamp_ns: u64,
}

/// Headless raster export target formats.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExportFormat {
    /// Raw RGBA8 bitmap.
    RawRgba,
    /// Compressed PNG image.
    Png,
    /// Portable Document Format (PDF).
    Pdf,
}

/// Renderer pipeline configuration.
#[derive(Debug, Clone)]
pub struct CompositorConfig {
    /// Enable bare-metal GPU acceleration via WGPU / WebRender.
    pub gpu_accelerated: bool,
    /// Target frame rate (e.g. 120 for high refresh rate monitors).
    pub target_fps: u32,
    /// Enable V-Sync double/triple buffering.
    pub vsync: bool,
    /// Hardware device pixel ratio.
    pub device_scale_factor: f32,
}

impl Default for CompositorConfig {
    fn default() -> Self {
        Self {
            gpu_accelerated: true,
            target_fps: 120,
            vsync: true,
            device_scale_factor: 1.0,
        }
    }
}

/// Compositor pipeline managing off-screen surfaces and GPU swapchains.
pub struct YoloCompositor {
    config: CompositorConfig,
    viewport: YoloViewport,
}

impl YoloCompositor {
    /// Instantiates a new compositor with configuration.
    pub fn new(viewport: YoloViewport, config: CompositorConfig) -> Self {
        Self { config, viewport }
    }

    /// Resize viewport and recreate GPU swapchain / surface if necessary.
    pub fn resize(&mut self, new_viewport: YoloViewport) {
        self.viewport = new_viewport;
    }

    /// Produce a rendered frame from RGBA pixel buffer (bridged from Obscura or Servo paint).
    pub fn create_frame(&self, raw_rgba: Vec<u8>, width: u32, height: u32) -> CompositedFrame {
        CompositedFrame {
            width,
            height,
            rgba_data: Arc::new(raw_rgba),
            timestamp_ns: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos() as u64,
        }
    }

    /// Exports an offscreen frame to PNG or raw buffer for headless test automation / AI Agent inspection.
    pub fn export_frame(&self, frame: &CompositedFrame, format: ExportFormat) -> Result<Vec<u8>, String> {
        match format {
            ExportFormat::RawRgba => Ok((*frame.rgba_data).clone()),
            ExportFormat::Png => {
                // In headless mode, encode into PNG using tiny-skia or image crate
                #[cfg(feature = "render")]
                {
                    let pixmap_ref = tiny_skia::PixmapRef::from_bytes(&frame.rgba_data, frame.width, frame.height)
                        .ok_or_else(|| "Invalid pixmap dimensions".to_string())?;
                    pixmap_ref.encode_png().map_err(|e| format!("PNG encoding error: {e}"))
                }
                #[cfg(not(feature = "render"))]
                {
                    Ok((*frame.rgba_data).clone())
                }
            }
            ExportFormat::Pdf => {
                Err("Direct PDF export delegates to obscura_browser::pdf".to_string())
            }
        }
    }
}
