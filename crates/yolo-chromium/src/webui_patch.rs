//! Persistent edits for Chromium WebUI pages (`--webui-patch-dir=<dir>`).
//!
//! When a `chrome://<host>/...` main frame finishes loading, the shell looks
//! for `<dir>/<host>.css` and `<dir>/<host>.js` and injects them into the page
//! with `CefFrame::ExecuteJavaScript`.
//!
//! Security: WebUI pages are privileged. Their JavaScript can call `chrome.send`
//! and Mojo interfaces that change settings, install or remove extensions,
//! read history, and more. A patch file therefore runs with the same authority
//! as Chromium's own UI. The directory must be owned and writable only by the
//! user who runs the browser; the shell refuses symlinks that leave the
//! directory, files larger than [`MAX_PATCH_BYTES`], host names that are not
//! plain `[a-z0-9-_.]` labels, and, on Unix, files or directories that are
//! group- or world-writable. Never point it at a shared, downloaded, or
//! synced directory.

use std::path::{Path, PathBuf};

/// Largest accepted patch file.
pub const MAX_PATCH_BYTES: u64 = 1024 * 1024;

/// Schemes whose pages are WebUI and may be patched.
const WEBUI_SCHEMES: &[&str] = &["chrome://"];

/// Returns the WebUI host of `url` (`chrome://settings/people` -> `settings`),
/// or `None` for any other URL or for a host that is not a plain label.
pub fn webui_host(url: &str) -> Option<String> {
    let lower = url.to_ascii_lowercase();
    let rest = WEBUI_SCHEMES
        .iter()
        .find_map(|scheme| lower.strip_prefix(scheme))?;
    let host = rest.split(['/', '?', '#']).next().unwrap_or_default();
    is_plain_host(host).then(|| host.to_string())
}

fn is_plain_host(host: &str) -> bool {
    !host.is_empty()
        && host.len() <= 64
        && !host.starts_with('.')
        && !host.contains("..")
        && host.bytes().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || b"-_.".contains(&byte)
        })
}

/// Patch files that apply to one WebUI host.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct PatchFiles {
    pub host: String,
    pub css: Option<PathBuf>,
    pub js: Option<PathBuf>,
}

impl PatchFiles {
    pub fn is_empty(&self) -> bool {
        self.css.is_none() && self.js.is_none()
    }
}

/// Finds `<host>.css` and `<host>.js` under `dir` for `url`. Files that fail
/// the checks described in the module documentation are skipped with a
/// message on stderr.
pub fn find(dir: &Path, url: &str) -> Option<PatchFiles> {
    let host = webui_host(url)?;
    let root = match dir.canonicalize() {
        Ok(root) => root,
        Err(error) => {
            eprintln!(
                "yolo-chromium: --webui-patch-dir {}: {error}",
                dir.display()
            );
            return None;
        }
    };
    if let Err(reason) = check_permissions(&root) {
        eprintln!(
            "yolo-chromium: ignoring --webui-patch-dir {}: {reason}",
            root.display()
        );
        return None;
    }
    let pick = |extension: &str| {
        let candidate = root.join(format!("{host}.{extension}"));
        match accept_file(&root, &candidate) {
            Ok(found) => found,
            Err(reason) => {
                eprintln!("yolo-chromium: ignoring {}: {reason}", candidate.display());
                None
            }
        }
    };
    let files = PatchFiles {
        css: pick("css"),
        js: pick("js"),
        host,
    };
    (!files.is_empty()).then_some(files)
}

/// Returns `Ok(Some(path))` for an acceptable file, `Ok(None)` when it does not
/// exist, and `Err` when it exists but must not be loaded.
fn accept_file(root: &Path, candidate: &Path) -> Result<Option<PathBuf>, String> {
    if !candidate.exists() {
        return Ok(None);
    }
    let resolved = candidate
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if !resolved.starts_with(root) {
        return Err("resolves outside the patch directory".to_string());
    }
    let metadata = resolved.metadata().map_err(|error| error.to_string())?;
    if !metadata.is_file() {
        return Err("not a regular file".to_string());
    }
    if metadata.len() > MAX_PATCH_BYTES {
        return Err(format!("larger than {MAX_PATCH_BYTES} bytes"));
    }
    check_permissions(&resolved)?;
    Ok(Some(resolved))
}

#[cfg(unix)]
fn check_permissions(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    let mode = path
        .metadata()
        .map_err(|error| error.to_string())?
        .permissions()
        .mode();
    if mode & 0o022 != 0 {
        return Err(format!(
            "group- or world-writable (mode {:o})",
            mode & 0o777
        ));
    }
    Ok(())
}

#[cfg(not(unix))]
fn check_permissions(_path: &Path) -> Result<(), String> {
    // Windows ACLs are not inspected; the per-user profile directory default
    // and the documentation carry the ownership requirement.
    Ok(())
}

/// Builds the script injected into the page for `css` and `js` sources.
///
/// CSS is installed as a constructed stylesheet on `document.adoptedStyleSheets`
/// (not subject to the page's `style-src`), falling back to a `<style>`
/// element; re-injection replaces the previous patch sheet. It styles the
/// document tree only: content inside WebUI shadow roots is reached through
/// inherited properties and CSS custom properties such as `--cr-*`.
pub fn injection_script(host: &str, css: Option<&str>, js: Option<&str>) -> String {
    let mut script = String::new();
    if let Some(css) = css {
        let css = serde_json::to_string(css).unwrap_or_else(|_| "\"\"".to_string());
        let host = serde_json::to_string(host).unwrap_or_else(|_| "\"\"".to_string());
        script.push_str(&format!(
            "(() => {{\n\
             const css = {css};\n\
             const root = document.documentElement;\n\
             try {{\n\
               const sheet = new CSSStyleSheet();\n\
               sheet.replaceSync(css);\n\
               sheet.yoloWebuiPatch = true;\n\
               document.adoptedStyleSheets = [...document.adoptedStyleSheets.filter((s) => !s.yoloWebuiPatch), sheet];\n\
             }} catch (error) {{\n\
               let style = document.getElementById(\"yolo-webui-patch\");\n\
               if (!style) {{ style = document.createElement(\"style\"); style.id = \"yolo-webui-patch\"; root.appendChild(style); }}\n\
               style.textContent = css;\n\
             }}\n\
             if (root) root.dataset.yoloWebuiPatch = {host};\n\
             }})();\n"
        ));
    }
    if let Some(js) = js {
        script.push_str(js);
        script.push('\n');
    }
    script
}

/// Reads the patch files and returns the script, or `None` when nothing could
/// be read.
pub fn load_script(files: &PatchFiles) -> Option<String> {
    let read = |path: &Option<PathBuf>| {
        path.as_ref()
            .and_then(|path| match std::fs::read_to_string(path) {
                Ok(text) => Some(text),
                Err(error) => {
                    eprintln!("yolo-chromium: cannot read {}: {error}", path.display());
                    None
                }
            })
    };
    let css = read(&files.css);
    let js = read(&files.js);
    if css.is_none() && js.is_none() {
        return None;
    }
    Some(injection_script(&files.host, css.as_deref(), js.as_deref()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_is_extracted_from_webui_urls_only() {
        assert_eq!(webui_host("chrome://version/").as_deref(), Some("version"));
        assert_eq!(
            webui_host("chrome://settings/people?x=1").as_deref(),
            Some("settings")
        );
        assert_eq!(webui_host("CHROME://GPU").as_deref(), Some("gpu"));
        assert_eq!(
            webui_host("chrome://media-internals#a").as_deref(),
            Some("media-internals")
        );
        assert_eq!(webui_host("https://example.com/"), None);
        assert_eq!(webui_host("chrome-extension://abc/"), None);
        assert_eq!(webui_host("chrome:///"), None);
        assert_eq!(webui_host("chrome://..%2f/"), None);
        assert_eq!(webui_host("chrome://a\\b/"), None);
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir()
            .join("yolo-chromium-webui-patch-tests")
            .join(format!("{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("create temp dir");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o700)).unwrap();
        }
        dir
    }

    fn write(path: PathBuf, contents: impl AsRef<[u8]>) {
        std::fs::write(&path, contents).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600)).unwrap();
        }
    }

    #[test]
    fn find_matches_host_files() {
        let dir = temp_dir("find");
        write(dir.join("version.css"), "body{color:red}");
        write(dir.join("settings.js"), "1;");
        write(dir.join("other.css"), "x");

        let version = find(&dir, "chrome://version/").expect("version patch");
        assert_eq!(version.host, "version");
        assert!(version
            .css
            .as_ref()
            .is_some_and(|p| p.ends_with("version.css")));
        assert!(version.js.is_none());

        let settings = find(&dir, "chrome://settings/people").expect("settings patch");
        assert!(settings.css.is_none());
        assert!(settings
            .js
            .as_ref()
            .is_some_and(|p| p.ends_with("settings.js")));

        assert!(find(&dir, "chrome://gpu/").is_none());
        assert!(find(&dir, "https://version/").is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn oversized_and_non_file_patches_are_rejected() {
        let dir = temp_dir("reject");
        std::fs::create_dir_all(dir.join("flags.css")).unwrap();
        let big = vec![b'a'; (MAX_PATCH_BYTES + 1) as usize];
        write(dir.join("gpu.css"), big);
        assert!(find(&dir, "chrome://flags/").is_none());
        assert!(find(&dir, "chrome://gpu/").is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn world_writable_patches_are_rejected() {
        use std::os::unix::fs::PermissionsExt;
        let dir = temp_dir("mode");
        let file = dir.join("version.css");
        write(file.clone(), "x");
        std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o666)).unwrap();
        assert!(find(&dir, "chrome://version/").is_none());
        std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o600)).unwrap();
        assert!(find(&dir, "chrome://version/").is_some());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn injection_script_escapes_css_and_appends_js() {
        let script = injection_script(
            "version",
            Some("a::after{content:\"</script>\"}"),
            Some("window.x = 1;"),
        );
        assert!(script.contains(r#"const css = "a::after{content:\"</script>\"}";"#));
        assert!(script.contains("adoptedStyleSheets"));
        assert!(script.contains(r#"dataset.yoloWebuiPatch = "version""#));
        assert!(script.trim_end().ends_with("window.x = 1;"));
        assert_eq!(injection_script("version", None, None), "");
    }
}
