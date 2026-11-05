//! Brand theme presets applied to Chromium's Views UI through CEF's theme
//! color API (`CefWindow::SetThemeColor`, see `include/cef_color_ids.h`).
//!
//! The engine keeps Chromium's own Google/Material defaults unless a preset
//! or a JSON override is selected with `--theme=<preset|path.json>`. Presets
//! follow the YOLO brand families: `neutral` (Chromium defaults), `m3`,
//! `fluent`, `apple`, `omarchy`, `hyprland`, `aphrody`.

use std::{collections::BTreeMap, fs, path::Path};

use serde::Serialize;

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

/// Product and window strings of a theme pack (`theme.title`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Titles {
    pub product_name: String,
    /// `{page}` is replaced by the current page title.
    pub window_title_template: String,
    pub ntp_heading: String,
}

/// Provenance of a theme pack, carried into the `--smoke` receipt. Logo,
/// wallpaper and pet are recorded as the pack declares them; the shell does
/// not draw or fabricate any brand art.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackInfo {
    pub path: String,
    pub pack: String,
    pub schema_version: u32,
    pub content_hash: String,
    pub role_count: usize,
    pub dark: bool,
    pub seed: String,
    pub variant: String,
    pub logo: Option<String>,
    /// `file:<path>` or `generated`.
    pub wallpaper: String,
    pub pet: Option<String>,
}

/// A resolved theme: ARGB colors per token. An empty map keeps Chromium's
/// defaults.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Theme {
    pub name: String,
    pub colors: BTreeMap<Token, u32>,
    /// Window title strings; `None` keeps the built-in title.
    pub titles: Option<Titles>,
    /// Set when the theme came from `--theme-pack`.
    pub pack: Option<PackInfo>,
}

impl Theme {
    /// Window title for `page` (empty for no page).
    pub fn window_title(&self, page: &str) -> String {
        match &self.titles {
            Some(titles) if page.trim().is_empty() => titles.product_name.clone(),
            Some(titles) => titles.window_title_template.replace("{page}", page),
            None if page.trim().is_empty() => DEFAULT_TITLE.to_string(),
            None => format!("{page} - {DEFAULT_TITLE}"),
        }
    }
}

/// Window title without a theme pack.
pub const DEFAULT_TITLE: &str = "YOLO-Web Chromium";

/// Schema version of the resolved theme document (`yolo-theme-pack`
/// `SCHEMA_VERSION`) that this shell reads.
pub const PACK_SCHEMA_VERSION: u32 = 1;

/// The 50 role names of a v1.1 pack: the 49 Material 3 system roles plus
/// `focus-ring` (`yolo_tokens::role::Role::ALL`).
pub const PACK_ROLES: [&str; 50] = [
    "primary",
    "on-primary",
    "primary-container",
    "on-primary-container",
    "inverse-primary",
    "secondary",
    "on-secondary",
    "secondary-container",
    "on-secondary-container",
    "tertiary",
    "on-tertiary",
    "tertiary-container",
    "on-tertiary-container",
    "error",
    "on-error",
    "error-container",
    "on-error-container",
    "background",
    "on-background",
    "surface",
    "on-surface",
    "surface-variant",
    "on-surface-variant",
    "surface-dim",
    "surface-bright",
    "surface-container-lowest",
    "surface-container-low",
    "surface-container",
    "surface-container-high",
    "surface-container-highest",
    "surface-tint",
    "outline",
    "outline-variant",
    "inverse-surface",
    "inverse-on-surface",
    "shadow",
    "scrim",
    "primary-fixed",
    "primary-fixed-dim",
    "on-primary-fixed",
    "on-primary-fixed-variant",
    "secondary-fixed",
    "secondary-fixed-dim",
    "on-secondary-fixed",
    "on-secondary-fixed-variant",
    "tertiary-fixed",
    "tertiary-fixed-dim",
    "on-tertiary-fixed",
    "on-tertiary-fixed-variant",
    "focus-ring",
];

impl Token {
    /// Pack role that paints this token, following `ROLE_SURFACES` of
    /// `yolo-theme-pack` (the surface named in the comment, its background
    /// or foreground role).
    pub fn role(self) -> &'static str {
        match self {
            // "window frame, active" background
            Token::FrameActive => "surface-container-high",
            // "window frame, inactive" background
            Token::FrameInactive => "surface-container",
            // "toolbar" background / foreground
            Token::Toolbar | Token::BookmarkBarBackground => "surface-container",
            Token::ToolbarText | Token::BookmarkBarForeground => "on-surface",
            // "toolbar icon" foreground
            Token::ToolbarButtonIcon => "on-surface-variant",
            // "toolbar separator" foreground
            Token::ToolbarSeparator => "outline-variant",
            // "location bar" background / foreground
            Token::LocationBarBackground => "surface-container-highest",
            Token::OmniboxText => "on-surface",
            // "location bar, hover" background
            Token::LocationBarBackgroundHovered => "surface-bright",
            // "omnibox results" background
            Token::OmniboxResultsBackground => "surface-container-low",
            // "tab, active" and "tab, inactive"
            Token::TabBackgroundActive => "surface",
            Token::TabForegroundActive => "on-surface",
            Token::TabBackgroundInactive | Token::NewTabButtonBackground => "surface-container",
            Token::TabForegroundInactive => "on-surface-variant",
            // "text field border, divider" foreground
            Token::TabStroke => "outline",
            // "page background" background / foreground
            Token::NewTabPageBackground | Token::WindowBackground => "surface",
            Token::NewTabPageText => "on-surface",
            // "card" background
            Token::SidePanelBackground => "surface-container-low",
            // "accent highlight, badge" background
            Token::InfoBarBackground => "tertiary-container",
        }
    }
}

/// Builds a theme from role colors (`role name` to ARGB) through the single
/// token to role mapping. Fails when a mapped role is missing.
pub fn from_roles(name: &str, roles: &BTreeMap<String, u32>) -> Result<Theme, String> {
    let mut colors = BTreeMap::new();
    for token in Token::ALL {
        let role = token.role();
        let color = roles
            .get(role)
            .ok_or_else(|| format!("{name}: missing role {role:?} for {}", token.key()))?;
        colors.insert(token, *color);
    }
    Ok(Theme {
        name: name.to_string(),
        colors,
        titles: None,
        pack: None,
    })
}

/// Preset names in the YOLO brand families.
pub const PRESETS: [&str; 7] = [
    "neutral", "m3", "fluent", "apple", "omarchy", "hyprland", "aphrody",
];

/// Builds a preset from a frame, a surface, a text field, a text color, and
/// an accent color by deriving the pack roles that the token mapping reads,
/// so presets and packs share one token to role table.
fn palette(name: &str, frame: u32, surface: u32, field: u32, text: u32, accent: u32) -> Theme {
    let mut roles: BTreeMap<String, u32> = BTreeMap::new();
    let mut put = |role: &str, color: u32| {
        roles.insert(role.to_string(), color);
    };
    put("surface-container-high", frame);
    put("surface-container", mix(surface, frame, 0.5));
    put("surface", surface);
    put("surface-container-low", surface);
    put("surface-container-highest", field);
    put("surface-bright", mix(field, text, 0.06));
    put("on-surface", text);
    put("on-surface-variant", mix(text, frame, 0.25));
    put("outline-variant", mix(surface, text, 0.18));
    put("outline", mix(frame, text, 0.2));
    put("tertiary-container", mix(surface, accent, 0.12));
    from_roles(name, &roles).expect("preset roles cover the token mapping")
}

/// Returns a preset by name; `neutral` keeps Chromium's defaults.
pub fn preset(name: &str) -> Option<Theme> {
    Some(match name.to_ascii_lowercase().as_str() {
        "neutral" | "chromium" | "google" | "default" => Theme {
            name: "neutral".to_string(),
            colors: BTreeMap::new(),
            titles: None,
            pack: None,
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

/// Reads a resolved theme pack document (`--theme-pack=<path>`), as printed
/// by `yolo-theme-pack`'s `resolve` example.
pub fn load_pack(path: &str) -> Result<Theme, String> {
    let text = fs::read_to_string(path).map_err(|error| format!("read {path}: {error}"))?;
    parse_pack(&text, path)
}

/// Parses a theme-pack document: `schema_version`, `content_hash`, and a
/// `theme` object with the 50 `roles` as `[name, "#rrggbb"]` pairs, `title`,
/// `logo`, `wallpaper`, and `pet`.
pub fn parse_pack(text: &str, origin: &str) -> Result<Theme, String> {
    let doc: serde_json::Value =
        serde_json::from_str(text).map_err(|error| format!("{origin}: invalid JSON: {error}"))?;
    let schema = doc.get("schema_version").and_then(|v| v.as_u64());
    if schema != Some(u64::from(PACK_SCHEMA_VERSION)) {
        return Err(format!(
            "{origin}: schema_version {schema:?} is not supported (expected {PACK_SCHEMA_VERSION})"
        ));
    }
    let content_hash = doc
        .get("content_hash")
        .and_then(|v| v.as_str())
        .filter(|hash| hash.len() == 64 && hash.bytes().all(|b| b.is_ascii_hexdigit()))
        .ok_or_else(|| format!("{origin}: content_hash must be 64 hex digits"))?
        .to_string();
    let theme = doc
        .get("theme")
        .and_then(|v| v.as_object())
        .ok_or_else(|| format!("{origin}: missing \"theme\" object"))?;

    let mut roles: BTreeMap<String, u32> = BTreeMap::new();
    let pairs = theme
        .get("roles")
        .and_then(|v| v.as_array())
        .ok_or_else(|| format!("{origin}: theme.roles must be an array"))?;
    for pair in pairs {
        let (name, hex) = pair
            .as_array()
            .and_then(|pair| Some((pair.first()?.as_str()?, pair.get(1)?.as_str()?)))
            .ok_or_else(|| format!("{origin}: each role must be [name, \"#rrggbb\"]"))?;
        let color = parse_color(hex)
            .ok_or_else(|| format!("{origin}: role {name} has invalid color {hex:?}"))?;
        roles.insert(name.to_string(), color);
    }
    for required in PACK_ROLES {
        if !roles.contains_key(required) {
            return Err(format!("{origin}: missing role {required:?}"));
        }
    }

    let text_field = |object: &serde_json::Value, key: &str| -> Result<String, String> {
        object
            .get(key)
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .ok_or_else(|| format!("{origin}: {key} must be a string"))
    };
    let title = theme
        .get("title")
        .ok_or_else(|| format!("{origin}: missing theme.title"))?;
    let titles = Titles {
        product_name: text_field(title, "product_name")?,
        window_title_template: text_field(title, "window_title_template")?,
        ntp_heading: text_field(title, "ntp_heading")?,
    };
    let pack_id = text_field(&serde_json::Value::Object(theme.clone()), "pack")?;
    let wallpaper = match theme.get("wallpaper") {
        Some(w) if w.get("kind").and_then(|k| k.as_str()) == Some("file") => {
            format!("file:{}", text_field(w, "path")?)
        }
        Some(w) if w.get("kind").and_then(|k| k.as_str()) == Some("generated") => {
            "generated".to_string()
        }
        _ => {
            return Err(format!(
                "{origin}: theme.wallpaper must be file or generated"
            ));
        }
    };
    let logo = theme
        .get("logo")
        .filter(|v| !v.is_null())
        .map(|logo| text_field(logo, "mark"))
        .transpose()?;
    let pet = theme
        .get("pet")
        .filter(|v| !v.is_null())
        .map(|pet| text_field(pet, "id"))
        .transpose()?;

    let mut resolved = from_roles(&pack_id, &roles)?;
    resolved.pack = Some(PackInfo {
        path: origin.to_string(),
        pack: pack_id,
        schema_version: PACK_SCHEMA_VERSION,
        content_hash,
        role_count: roles.len(),
        dark: theme.get("dark").and_then(|v| v.as_bool()).unwrap_or(false),
        seed: theme
            .get("seed")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        variant: theme
            .get("variant")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        logo,
        wallpaper,
        pet,
    });
    resolved.titles = Some(titles);
    Ok(resolved)
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

    const AURORA: &str = include_str!("../tests/fixtures/theme-pack-aurora-terminal.json");

    #[test]
    fn pack_fixture_maps_roles_to_chromium_ids() {
        let theme = parse_pack(AURORA, "aurora").unwrap();
        assert_eq!(theme.name, "aurora-terminal");
        assert_eq!(theme.colors.len(), Token::ALL.len());
        // aurora-terminal (dark): surface-container-high, on-surface, primary.
        let pack: serde_json::Value = serde_json::from_str(AURORA).unwrap();
        let role = |name: &str| -> u32 {
            let hex = pack["theme"]["roles"]
                .as_array()
                .unwrap()
                .iter()
                .find(|pair| pair[0] == name)
                .map(|pair| pair[1].as_str().unwrap().to_string())
                .unwrap();
            parse_color(&hex).unwrap()
        };
        assert_eq!(
            theme.colors[&Token::FrameActive],
            role("surface-container-high")
        );
        assert_eq!(theme.colors[&Token::ToolbarText], role("on-surface"));
        assert_eq!(
            theme.colors[&Token::InfoBarBackground],
            role("tertiary-container")
        );
        assert_eq!(
            Token::FrameActive.color_id(),
            ColorId::CEF_ColorFrameActive as i32
        );
        let info = theme.pack.as_ref().unwrap();
        assert_eq!(info.role_count, 50);
        assert_eq!(info.pack, "aurora-terminal");
        assert_eq!(info.wallpaper, "generated");
        assert_eq!(info.content_hash.len(), 64);
        assert_eq!(theme.window_title("Docs"), "Docs - Yolo");
        assert_eq!(theme.window_title(""), "Yolo");
    }

    #[test]
    fn pack_rejects_bad_documents() {
        let mut doc: serde_json::Value = serde_json::from_str(AURORA).unwrap();
        doc["schema_version"] = 2.into();
        assert!(
            parse_pack(&doc.to_string(), "v2")
                .unwrap_err()
                .contains("schema_version")
        );
        let mut doc: serde_json::Value = serde_json::from_str(AURORA).unwrap();
        doc["theme"]["roles"].as_array_mut().unwrap().pop();
        assert!(
            parse_pack(&doc.to_string(), "short")
                .unwrap_err()
                .contains("focus-ring")
        );
        let mut doc: serde_json::Value = serde_json::from_str(AURORA).unwrap();
        doc["content_hash"] = "abc".into();
        assert!(parse_pack(&doc.to_string(), "hash").is_err());
        assert!(parse_pack("[]", "array").is_err());
    }

    #[test]
    fn every_mapped_role_is_a_pack_role() {
        for token in Token::ALL {
            assert!(PACK_ROLES.contains(&token.role()), "{}", token.key());
        }
        assert_eq!(PACK_ROLES.len(), 50);
    }

    #[test]
    fn default_title_without_pack() {
        let theme = preset("m3").unwrap();
        assert_eq!(theme.window_title("Docs"), "Docs - YOLO-Web Chromium");
        assert_eq!(theme.window_title(""), DEFAULT_TITLE);
    }

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
        assert_eq!(Token::Toolbar.color_id(), ColorId::CEF_ColorToolbar as i32);
    }
}
