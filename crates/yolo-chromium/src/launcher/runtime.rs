//! Runtime directory preparation for the Windows bootstrap host.
//!
//! CEF's bootstrap executable loads `<its own base name>.dll` from its own
//! directory and expects the distribution's resources next to it, so the
//! launcher mirrors the distribution into one directory, copies the bootstrap
//! as `yolo-chromium.exe`, the shell cdylib as `yolo-chromium.dll`, and writes
//! the application manifest CEF applications ship with.

use std::{
    fs, io,
    path::{Path, PathBuf},
};

use super::HostKind;

/// Application manifest written next to the host executable.
pub const APP_MANIFEST: &str = include_str!("cef-app.exe.manifest");

/// Files in the distribution root that are not needed at run time.
const SKIPPED_FILES: &[&str] = &["CMakeLists.txt", "CREDITS.html", "archive.json"];
/// Extensions in the distribution root that are build-time only.
const SKIPPED_EXTENSIONS: &[&str] = &["lib", "exe"];
/// Subdirectories mirrored into the runtime directory.
const RUNTIME_DIRS: &[&str] = &["locales"];

/// Paths produced by [`prepare`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimeLayout {
    pub dir: PathBuf,
    pub host_exe: PathBuf,
    pub client_dll: PathBuf,
    /// Number of files copied or refreshed by this call.
    pub updated_files: usize,
}

/// Mirrors the CEF distribution and the shell DLL into `runtime_dir`.
pub fn prepare(
    cef_dir: &Path,
    client_dll: &Path,
    runtime_dir: &Path,
    host: HostKind,
) -> Result<RuntimeLayout, String> {
    let bootstrap = cef_dir.join(host.bootstrap_file_name());
    if !cef_dir.join("libcef.dll").is_file() || !bootstrap.is_file() {
        return Err(format!(
            "CEF distribution not found at {} (expected libcef.dll and {}); \
             build with `cargo build -p yolo-chromium` or pass --cef-dir",
            cef_dir.display(),
            host.bootstrap_file_name()
        ));
    }
    if !client_dll.is_file() {
        return Err(format!(
            "shell library not found at {}; run `cargo build -p yolo-chromium`",
            client_dll.display()
        ));
    }

    fs::create_dir_all(runtime_dir)
        .map_err(|error| format!("create {}: {error}", runtime_dir.display()))?;
    let mut updated = sync_root_files(cef_dir, runtime_dir)?;
    for name in RUNTIME_DIRS {
        updated += sync_root_files(&cef_dir.join(name), &runtime_dir.join(name))?;
    }

    let base = host.app_base_name();
    let host_exe = runtime_dir.join(format!("{base}.exe"));
    let dll = runtime_dir.join(format!("{base}.dll"));
    updated += usize::from(sync_file(&bootstrap, &host_exe)?);
    updated += usize::from(sync_file(client_dll, &dll)?);
    let manifest = runtime_dir.join(format!("{base}.exe.manifest"));
    if fs::read_to_string(&manifest).ok().as_deref() != Some(APP_MANIFEST) {
        fs::write(&manifest, APP_MANIFEST)
            .map_err(|error| format!("write {}: {error}", manifest.display()))?;
        updated += 1;
    }

    Ok(RuntimeLayout {
        dir: runtime_dir.to_path_buf(),
        host_exe,
        client_dll: dll,
        updated_files: updated,
    })
}

fn sync_root_files(source: &Path, destination: &Path) -> Result<usize, String> {
    fs::create_dir_all(destination)
        .map_err(|error| format!("create {}: {error}", destination.display()))?;
    let entries =
        fs::read_dir(source).map_err(|error| format!("read {}: {error}", source.display()))?;
    let mut updated = 0;
    for entry in entries {
        let entry = entry.map_err(|error| format!("read {}: {error}", source.display()))?;
        let path = entry.path();
        if !path.is_file() || !is_runtime_file(&path) {
            continue;
        }
        let target = destination.join(entry.file_name());
        updated += usize::from(sync_file(&path, &target)?);
    }
    Ok(updated)
}

/// Whether a distribution root file belongs in the runtime directory.
pub fn is_runtime_file(path: &Path) -> bool {
    let name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();
    if SKIPPED_FILES.contains(&name.as_str()) {
        return false;
    }
    let extension = path
        .extension()
        .map(|extension| extension.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default();
    !SKIPPED_EXTENSIONS.contains(&extension.as_str())
}

/// Copies `source` to `target` unless an identical-looking copy exists.
/// Returns whether a copy happened.
pub fn sync_file(source: &Path, target: &Path) -> Result<bool, String> {
    if same_file(source, target).map_err(|error| format!("stat {}: {error}", target.display()))? {
        return Ok(false);
    }
    fs::copy(source, target)
        .map_err(|error| format!("copy {} to {}: {error}", source.display(), target.display()))?;
    Ok(true)
}

fn same_file(source: &Path, target: &Path) -> io::Result<bool> {
    let Ok(target_meta) = fs::metadata(target) else {
        return Ok(false);
    };
    let source_meta = fs::metadata(source)?;
    if source_meta.len() != target_meta.len() {
        return Ok(false);
    }
    match (source_meta.modified(), target_meta.modified()) {
        (Ok(source_time), Ok(target_time)) => Ok(source_time <= target_time),
        _ => Ok(true),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "yolo-chromium-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    #[test]
    fn runtime_file_filter_skips_build_inputs() {
        assert!(is_runtime_file(Path::new("libcef.dll")));
        assert!(is_runtime_file(Path::new("resources.pak")));
        assert!(is_runtime_file(Path::new("icudtl.dat")));
        assert!(is_runtime_file(Path::new("vk_swiftshader_icd.json")));
        assert!(!is_runtime_file(Path::new("libcef.lib")));
        assert!(!is_runtime_file(Path::new("bootstrap.exe")));
        assert!(!is_runtime_file(Path::new("CMakeLists.txt")));
        assert!(!is_runtime_file(Path::new("archive.json")));
    }

    #[test]
    fn prepare_mirrors_a_fake_distribution() {
        let root = temp_dir("prepare");
        let cef = root.join("cef");
        fs::create_dir_all(cef.join("locales")).unwrap();
        for name in [
            "libcef.dll",
            "resources.pak",
            "libcef.lib",
            "CMakeLists.txt",
        ] {
            fs::write(cef.join(name), name).unwrap();
        }
        fs::write(cef.join("locales").join("en-US.pak"), "locale").unwrap();
        fs::write(cef.join("bootstrapc.exe"), "bootstrap").unwrap();
        let dll = root.join("yolo_chromium.dll");
        fs::write(&dll, "dll").unwrap();
        let runtime = root.join("runtime");

        let layout = prepare(&cef, &dll, &runtime, HostKind::Console).unwrap();
        assert!(runtime.join("libcef.dll").is_file());
        assert!(runtime.join("resources.pak").is_file());
        assert!(runtime.join("locales").join("en-US.pak").is_file());
        assert!(!runtime.join("libcef.lib").exists());
        assert!(!runtime.join("CMakeLists.txt").exists());
        assert_eq!(layout.host_exe, runtime.join("yolo-chromium.exe"));
        assert_eq!(fs::read_to_string(&layout.host_exe).unwrap(), "bootstrap");
        assert_eq!(fs::read_to_string(&layout.client_dll).unwrap(), "dll");
        assert_eq!(
            fs::read_to_string(runtime.join("yolo-chromium.exe.manifest")).unwrap(),
            APP_MANIFEST
        );
        assert!(layout.updated_files >= 6);

        let second = prepare(&cef, &dll, &runtime, HostKind::Console).unwrap();
        assert_eq!(second.updated_files, 0);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn prepare_rejects_missing_inputs() {
        let root = temp_dir("missing");
        let error = prepare(
            &root,
            &root.join("x.dll"),
            &root.join("r"),
            HostKind::Console,
        )
        .unwrap_err();
        assert!(error.contains("CEF distribution not found"));
        let _ = fs::remove_dir_all(&root);
    }
}
