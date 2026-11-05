//! Brand theme presets applied to Chromium's Views UI through CEF's theme
//! color API (`CefWindow::SetThemeColor`, see `include/cef_color_ids.h`).
//!
//! The engine keeps Chromium's own Google/Material defaults unless a preset
//! or a JSON override is selected with `--theme=<preset|path.json>`. Presets
//! follow the YOLO brand families: `neutral` (Chromium defaults), `m3`,
//! `fluent`, `apple`, `omarchy`, `hyprland`, `aphrody`.

use std::{collections::BTreeMap, fs, path::Path};

use cef::sys::cef_color_id_t as ColorId;

/// Chromium color tokens that a preset can override.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Token {
    FrameActive,
    FrameInactive,
    Toolbar,
    ToolbarText,
    ToolbarButtonIcon,
    ToolbarSeparator,
    LocationBarBackground,
    LocationBarBackgroundHovered,
    OmniboxText,
    OmniboxResultsBackground,
    TabBackgroundActive,
    TabBackgroundInactive,
    TabForegroundActive,
    TabForegroundInactive,
    TabStroke,
    NewTabButtonBackground,
    NewTabPageBackground,
    NewTabPageText,
    BookmarkBarBackground,
    BookmarkBarForeground,
    SidePanelBackground,
    InfoBarBackground,
    WindowBackground,
}

impl Token {
    /// All tokens, in a stable order.
    pub const ALL: [Token; 23] = [
        Token::FrameActive,
        Token::FrameInactive,
        Token::Toolbar,
        Token::ToolbarText,
        Token::ToolbarButtonIcon,
        Token::ToolbarSeparator,
        Token::LocationBarBackground,
        Token::LocationBarBackgroundHovered,
        Token::OmniboxText,
        Token::OmniboxResultsBackground,
        Token::TabBackgroundActive,
        Token::TabBackgroundInactive,
        Token::TabForegroundActive,
        Token::TabForegroundInactive,
        Token::TabStroke,
        Token::NewTabButtonBackground,
        Token::NewTabPageBackground,
        Token::NewTabPageText,
        Token::BookmarkBarBackground,
        Token::BookmarkBarForeground,
        Token::SidePanelBackground,
        Token::InfoBarBackground,
        Token::WindowBackground,
    ];

    /// JSON key used in `--theme=<path.json>` files.
    pub fn key(self) -> &'static str {
        match self {
            Token::FrameActive => "frameActive",
            Token::FrameInactive => "frameInactive",
            Token::Toolbar => "toolbar",
            Token::ToolbarText => "toolbarText",
            Token::ToolbarButtonIcon => "toolbarButtonIcon",
            Token::ToolbarSeparator => "toolbarSeparator",
            Token::LocationBarBackground => "locationBarBackground",
            Token::LocationBarBackgroundHovered => "locationBarBackgroundHovered",
            Token::OmniboxText => "omniboxText",
            Token::OmniboxResultsBackground => "omniboxResultsBackground",
            Token::TabBackgroundActive => "tabBackgroundActive",
            Token::TabBackgroundInactive => "tabBackgroundInactive",
            Token::TabForegroundActive => "tabForegroundActive",
            Token::TabForegroundInactive => "tabForegroundInactive",
            Token::TabStroke => "tabStroke",
            Token::NewTabButtonBackground => "newTabButtonBackground",
            Token::NewTabPageBackground => "newTabPageBackground",
            Token::NewTabPageText => "newTabPageText",
            Token::BookmarkBarBackground => "bookmarkBarBackground",
            Token::BookmarkBarForeground => "bookmarkBarForeground",
            Token::SidePanelBackground => "sidePanelBackground",
            Token::InfoBarBackground => "infoBarBackground",
            Token::WindowBackground => "windowBackground",
        }
    }

    fn from_key(key: &str) -> Option<Token> {
        Token::ALL.into_iter().find(|token| token.key() == key)
    }

    /// Chromium color id (`include/cef_color_ids.h`).
    pub fn color_id(self) -> i32 {
        let id = match self {
            Token::FrameActive => ColorId::CEF_ColorFrameActive,
            Token::FrameInactive => ColorId::CEF_ColorFrameInactive,
            Token::Toolbar => ColorId::CEF_ColorToolbar,
            Token::ToolbarText => ColorId::CEF_ColorToolbarText,
            Token::ToolbarButtonIcon => ColorId::CEF_ColorToolbarButtonIcon,
            Token::ToolbarSeparator => ColorId::CEF_ColorToolbarSeparator,
            Token::LocationBarBackground => ColorId::CEF_ColorLocationBarBackground,
            Token::LocationBarBackgroundHovered => ColorId::CEF_ColorLocationBarBackgroundHovered,
            Token::OmniboxText => ColorId::CEF_ColorOmniboxText,
            Token::OmniboxResultsBackground => ColorId::CEF_ColorOmniboxResultsBackground,
            Token::TabBackgroundActive => ColorId::CEF_ColorTabBackgroundActiveFrameActive,
            Token::TabBackgroundInactive => ColorId::CEF_ColorTabBackgroundInactiveFrameActive,
            Token::TabForegroundActive => ColorId::CEF_ColorTabForegroundActiveFrameActive,
            Token::TabForegroundInactive => ColorId::CEF_ColorTabForegroundInactiveFrameActive,
            Token::TabStroke => ColorId::CEF_ColorTabStrokeFrameActive,
            Token::NewTabButtonBackground => ColorId::CEF_ColorNewTabButtonBackgroundFrameActive,
            Token::NewTabPageBackground => ColorId::CEF_ColorNewTabPageBackground,
            Token::NewTabPageText => ColorId::CEF_ColorNewTabPageText,
            Token::BookmarkBarBackground => ColorId::CEF_ColorBookmarkBarBackground,
            Token::BookmarkBarForeground => ColorId::CEF_ColorBookmarkBarForeground,
            Token::SidePanelBackground => ColorId::CEF_ColorSidePanelBackground,
            Token::InfoBarBackground => ColorId::CEF_ColorInfoBarBackground,
            Token::WindowBackground => ColorId::CEF_ColorWindowBackground,
        };
        id as i32
    }
}

/// A resolved theme: ARGB colors per token. An empty map keeps Chromium's
/// defaults.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Theme {
    pub name: String,
    pub colors: BTreeMap<Token, u32>,
}

/// Preset names in the YOLO brand families.
pub const PRESETS: [&str; 7] = [
    "neutral", "m3", "fluent", "apple", "omarchy", "hyprland", "aphrody",
];

/// Builds a light theme from a surface, an on-surface text color, a frame,
/// and an accent color.
fn palette(name: &str, frame: u32, surface: u32, field: u32, text: u32, accent: u32) -> Theme {
    let mut colors = BTreeMap::new();
    colors.insert(Token::FrameActive, frame);
    colors.insert(Token::FrameInactive, mix(frame, surface, 0.35));
    colors.insert(Token::Toolbar, surface);
    colors.insert(Token::ToolbarText, text);
    colors.insert(Token::ToolbarButtonIcon, text);
    colors.insert(Token::ToolbarSeparator, mix(surface, text, 0.18));
    colors.insert(Token::LocationBarBackground, field);
    colors.insert(Token::LocationBarBackgroundHovered, mix(field, text, 0.06));
    colors.insert(Token::OmniboxText, text);
    colors.insert(Token::OmniboxResultsBackground, surface);
    colors.insert(Token::TabBackgroundActive, surface);
    colors.insert(Token::TabBackgroundInactive, frame);
    colors.insert(Token::TabForegroundActive, text);
    colors.insert(Token::TabForegroundInactive, mix(text, frame, 0.25));
    colors.insert(Token::TabStroke, mix(frame, text, 0.2));
    colors.insert(Token::NewTabButtonBackground, frame);
    colors.insert(Token::NewTabPageBackground, surface);
    colors.insert(Token::NewTabPageText, text);
    colors.insert(Token::BookmarkBarBackground, surface);
    colors.insert(Token::BookmarkBarForeground, text);
    colors.insert(Token::SidePanelBackground, surface);
    colors.insert(Token::InfoBarBackground, mix(surface, accent, 0.12));
    colors.insert(Token::WindowBackground, surface);
    Theme {
        name: name.to_string(),
        colors,
    }
}

/// Returns a preset by name; `neutral` keeps Chromium's defaults.
pub fn preset(name: &str) -> Option<Theme> {
    Some(match name.to_ascii_lowercase().as_str() {
        "neutral" | "chromium" | "google" | "default" => Theme {
            name: "neutral".to_string(),
            colors: BTreeMap::new(),
        },
        // Material 3 baseline (light): primary #6750A4, surface #FEF7FF.
        "m3" | "material" => palette(
            "m3", 0xFFE8DEF8, 0xFFFEF7FF, 0xFFF3EDF7, 0xFF1D1B20, 0xFF6750A4,
        ),
        // Windows 11 Fluent (light): mica-like surfaces, accent #0067C0.
        "fluent" | "winui" => palette(
            "fluent", 0xFFEDEDED, 0xFFF9F9F9, 0xFFFFFFFF, 0xFF1A1A1A, 0xFF0067C0,
        ),
        // macOS-style light chrome, accent #007AFF.
        "apple" | "macos" => palette(
            "apple", 0xFFE7E7E7, 0xFFF6F6F6, 0xFFFFFFFF, 0xFF1D1D1F, 0xFF007AFF,
        ),
        // Omarchy dark (Tokyo Night family), accent #7AA2F7.
        "omarchy" => palette(
            "omarchy", 0xFF16161E, 0xFF1A1B26, 0xFF24283B, 0xFFC0CAF5, 0xFF7AA2F7,
        ),
        // Hyprland dark (Catppuccin Mocha family), accent #89B4FA.
        "hyprland" => palette(
            "hyprland", 0xFF11111B, 0xFF1E1E2E, 0xFF313244, 0xFFCDD6F4, 0xFF89B4FA,
        ),
        // Aphrody brand: deep violet surfaces with a gold accent.
        "aphrody" => palette(
            "aphrody", 0xFF140A22, 0xFF1C0F2B, 0xFF2A1B3F, 0xFFF4ECFF, 0xFFF2C14E,
        ),
        _ => return None,
    })
}

/// Resolves `--theme=<preset|path.json>`. A JSON file maps token keys to
/// `#RRGGBB` / `#AARRGGBB` strings and may set `"base"` to a preset name.
pub fn resolve(spec: &str) -> Result<Theme, String> {
    if let Some(theme) = preset(spec) {
        return Ok(theme);
    }
    let path = Path::new(spec);
    if !path.is_file() {
        return Err(format!(
            "unknown theme {spec:?}: expected one of {} or a JSON file path",
            PRESETS.join(", ")
        ));
    }
    let text = fs::read_to_string(path).map_err(|error| format!("read {spec}: {error}"))?;
    parse_json(&text, spec)
}

/// Parses a JSON theme document.
pub fn parse_json(text: &str, origin: &str) -> Result<Theme, String> {
    let value: serde_json::Value =
        serde_json::from_str(text).map_err(|error| format!("{origin}: invalid JSON: {error}"))?;
    let object = value
        .as_object()
        .ok_or_else(|| format!("{origin}: theme must be a JSON object"))?;
    let mut theme = match object.get("base").and_then(|base| base.as_str()) {
        Some(base) => {
            preset(base).ok_or_else(|| format!("{origin}: unknown base preset {base:?}"))?
        }
        None => Theme::default(),
    };
    theme.name = object
        .get("name")
        .and_then(|name| name.as_str())
        .unwrap_or(origin)
        .to_string();
    for (key, raw) in object {
        if key == "base" || key == "name" {
            continue;
        }
        let token =
            Token::from_key(key).ok_or_else(|| format!("{origin}: unknown token {key:?}"))?;
        let color = raw
            .as_str()
            .and_then(parse_color)
            .ok_or_else(|| format!("{origin}: {key} must be a #RRGGBB or #AARRGGBB string"))?;
        theme.colors.insert(token, color);
    }
    Ok(theme)
}

/// Parses `#RRGGBB` or `#AARRGGBB` into ARGB.
pub fn parse_color(text: &str) -> Option<u32> {
    let hex = text.trim().trim_start_matches('#');
    match hex.len() {
        6 => u32::from_str_radix(hex, 16)
            .ok()
            .map(|rgb| 0xFF00_0000 | rgb),
        8 => u32::from_str_radix(hex, 16).ok(),
        _ => None,
    }
}

/// Linear interpolation between two ARGB colors (`t` toward `b`).
pub fn mix(a: u32, b: u32, t: f32) -> u32 {
    let t = t.clamp(0.0, 1.0);
    let channel = |shift: u32| {
        let ca = ((a >> shift) & 0xFF) as f32;
        let cb = ((b >> shift) & 0xFF) as f32;
        ((ca + (cb - ca) * t).round() as u32) & 0xFF
    };
    (channel(24) << 24) | (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn presets_resolve_and_neutral_is_empty() {
        for name in PRESETS {
            let theme = preset(name).expect(name);
            assert_eq!(theme.name, name);
            if name == "neutral" {
                assert!(theme.colors.is_empty());
            } else {
                assert_eq!(theme.colors.len(), Token::ALL.len());
            }
        }
        assert!(preset("nope").is_none());
    }

    #[test]
    fn json_overrides_a_base_preset() {
        let theme = parse_json(
            "{\"base\":\"omarchy\",\"name\":\"night\",\"toolbar\":\"#101010\",\"frameActive\":\"#80000000\"}",
            "inline",
        )
        .unwrap();
        assert_eq!(theme.name, "night");
        assert_eq!(theme.colors[&Token::Toolbar], 0xFF101010);
        assert_eq!(theme.colors[&Token::FrameActive], 0x80000000);
        assert_eq!(theme.colors.len(), Token::ALL.len());
        assert!(parse_json("{\"bogus\":\"#fff\"}", "inline").is_err());
        assert!(parse_json("{\"toolbar\":\"#fff\"}", "inline").is_err());
    }

    #[test]
    fn colors_parse_and_mix() {
        assert_eq!(parse_color("#1a73e8"), Some(0xFF1A73E8));
        assert_eq!(parse_color("80FFFFFF"), Some(0x80FFFFFF));
        assert_eq!(parse_color("#fff"), None);
        assert_eq!(mix(0xFF000000, 0xFFFFFFFF, 0.5), 0xFF808080);
        assert_eq!(mix(0xFF102030, 0xFF102030, 0.9), 0xFF102030);
    }

    #[test]
    fn tokens_map_to_distinct_chromium_ids() {
        let mut ids: Vec<i32> = Token::ALL.iter().map(|token| token.color_id()).collect();
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(ids.len(), Token::ALL.len());
        // Numeric ids shift with platform-specific entries in cef_color_ids.h,
        // so compare against the generated enum instead of a literal.
        assert_eq!(
            Token::Toolbar.color_id(),
            ColorId::CEF_ColorToolbar as i32
        );
    }
}
