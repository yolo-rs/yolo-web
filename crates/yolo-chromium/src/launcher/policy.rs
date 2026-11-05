//! Managed Chromium policies for the shell (search engine, new tab, homepage,
//! startup pages). Chrome style reads platform policies from the registry key
//! named by `CefSettings.chrome_policy_id`; on Windows the launcher writes the
//! user-level key `HKCU\<POLICY_KEY>` with `reg.exe` before starting the host.
//! See https://chromeenterprise.google/policies/ for the policy names.

use std::process::Command;

/// Registry path (without hive) used as `chrome_policy_id`.
pub const POLICY_KEY: &str = "SOFTWARE\\Policies\\YOLO-Web\\Chromium";
/// Default search engine when `--search-engine=aphrody` is given.
pub const APHRODY_SEARCH_URL: &str = "https://aphrody.com/search?q={searchTerms}";

/// One registry value to write.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PolicyValue {
    String(String),
    Dword(u32),
    /// `RestoreOnStartupURLs` style list: a subkey with numbered values.
    List(Vec<String>),
}

/// Policies derived from launcher switches.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct PolicySet {
    pub entries: Vec<(String, PolicyValue)>,
}

impl PolicySet {
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    fn push(&mut self, name: &str, value: PolicyValue) {
        self.entries.push((name.to_string(), value));
    }

    /// Builds the policy set from the shell options.
    pub fn from_options(
        search_engine: Option<&str>,
        new_tab_url: Option<&str>,
        homepage: Option<&str>,
        startup_urls: &[String],
    ) -> Self {
        let mut set = Self::default();
        if let Some(engine) = search_engine {
            let (name, url, keyword) = search_provider(engine);
            set.push("DefaultSearchProviderEnabled", PolicyValue::Dword(1));
            set.push("DefaultSearchProviderName", PolicyValue::String(name));
            set.push("DefaultSearchProviderKeyword", PolicyValue::String(keyword));
            set.push("DefaultSearchProviderSearchURL", PolicyValue::String(url));
        }
        if let Some(url) = new_tab_url {
            set.push("NewTabPageLocation", PolicyValue::String(url.to_string()));
        }
        if let Some(url) = homepage {
            set.push("HomepageLocation", PolicyValue::String(url.to_string()));
            set.push("HomepageIsNewTabPage", PolicyValue::Dword(0));
            set.push("ShowHomeButton", PolicyValue::Dword(1));
        }
        if !startup_urls.is_empty() {
            // 4 = open a list of URLs.
            set.push("RestoreOnStartup", PolicyValue::Dword(4));
            set.push(
                "RestoreOnStartupURLs",
                PolicyValue::List(startup_urls.to_vec()),
            );
        }
        set
    }

    /// `reg.exe` argument vectors that apply this set under `HKCU`.
    #[cfg(any(target_os = "windows", test))]
    pub fn reg_commands(&self) -> Vec<Vec<String>> {
        let key = format!("HKCU\\{POLICY_KEY}");
        let mut commands = Vec::new();
        for (name, value) in &self.entries {
            match value {
                PolicyValue::String(text) => commands.push(vec![
                    "add".into(),
                    key.clone(),
                    "/v".into(),
                    name.clone(),
                    "/t".into(),
                    "REG_SZ".into(),
                    "/d".into(),
                    text.clone(),
                    "/f".into(),
                ]),
                PolicyValue::Dword(number) => commands.push(vec![
                    "add".into(),
                    key.clone(),
                    "/v".into(),
                    name.clone(),
                    "/t".into(),
                    "REG_DWORD".into(),
                    "/d".into(),
                    number.to_string(),
                    "/f".into(),
                ]),
                PolicyValue::List(items) => {
                    let subkey = format!("{key}\\{name}");
                    commands.push(vec!["delete".into(), subkey.clone(), "/f".into()]);
                    for (index, item) in items.iter().enumerate() {
                        commands.push(vec![
                            "add".into(),
                            subkey.clone(),
                            "/v".into(),
                            (index + 1).to_string(),
                            "/t".into(),
                            "REG_SZ".into(),
                            "/d".into(),
                            item.clone(),
                            "/f".into(),
                        ]);
                    }
                }
            }
        }
        commands
    }
}

/// Maps `--search-engine` values to (name, URL template, keyword).
pub fn search_provider(spec: &str) -> (String, String, String) {
    match spec.to_ascii_lowercase().as_str() {
        "aphrody" | "aphrody.com" => (
            "Aphrody".into(),
            APHRODY_SEARCH_URL.into(),
            "aphrody.com".into(),
        ),
        "google" => (
            "Google".into(),
            "https://www.google.com/search?q={searchTerms}".into(),
            "google.com".into(),
        ),
        "duckduckgo" | "ddg" => (
            "DuckDuckGo".into(),
            "https://duckduckgo.com/?q={searchTerms}".into(),
            "duckduckgo.com".into(),
        ),
        "brave" => (
            "Brave Search".into(),
            "https://search.brave.com/search?q={searchTerms}".into(),
            "search.brave.com".into(),
        ),
        _ => {
            let keyword = spec
                .trim_start_matches("https://")
                .trim_start_matches("http://")
                .split('/')
                .next()
                .unwrap_or(spec)
                .to_string();
            let url = if spec.contains("{searchTerms}") {
                spec.to_string()
            } else {
                format!("{}?q={{searchTerms}}", spec.trim_end_matches('/'))
            };
            (keyword.clone(), url, keyword)
        }
    }
}

/// Applies the policies with `reg.exe` (Windows). Returns the number of
/// values written.
#[cfg(target_os = "windows")]
pub fn apply(set: &PolicySet) -> Result<usize, String> {
    let mut written = 0;
    for args in set.reg_commands() {
        let output = Command::new("reg.exe")
            .args(&args)
            .output()
            .map_err(|error| format!("reg.exe: {error}"))?;
        // `reg delete` of a missing subkey fails harmlessly.
        if !output.status.success() && args.first().map(String::as_str) != Some("delete") {
            return Err(format!(
                "reg.exe {} failed: {}",
                args.join(" "),
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
        if args.first().map(String::as_str) == Some("add") {
            written += 1;
        }
    }
    Ok(written)
}

/// Deletes the whole policy key (Windows).
#[cfg(target_os = "windows")]
pub fn reset() -> Result<(), String> {
    let key = format!("HKCU\\{POLICY_KEY}");
    let output = Command::new("reg.exe")
        .args(["delete", &key, "/f"])
        .output()
        .map_err(|error| format!("reg.exe: {error}"))?;
    if output.status.success()
        || String::from_utf8_lossy(&output.stderr).contains("unable to find")
        || String::from_utf8_lossy(&output.stderr).contains("introuvable")
    {
        Ok(())
    } else {
        Err(format!(
            "reg.exe delete failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

#[cfg(not(target_os = "windows"))]
pub fn apply(_set: &PolicySet) -> Result<usize, String> {
    Err(format!(
        "managed policies are written by the launcher on Windows only; on this platform create \
         a JSON policy file under the directory configured as chrome_policy_id ({POLICY_KEY})"
    ))
}

#[cfg(not(target_os = "windows"))]
pub fn reset() -> Result<(), String> {
    let _ = Command::new("true").status();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aphrody_search_engine_policy() {
        let set = PolicySet::from_options(Some("aphrody"), Some("https://aphrody.com/"), None, &[]);
        assert_eq!(set.entries.len(), 5);
        assert!(set
            .entries
            .iter()
            .any(|(name, value)| name == "DefaultSearchProviderSearchURL"
                && *value == PolicyValue::String(APHRODY_SEARCH_URL.into())));
        let commands = set.reg_commands();
        assert_eq!(commands.len(), 5);
        assert!(commands
            .iter()
            .all(|args| args[1] == format!("HKCU\\{POLICY_KEY}")));
    }

    #[test]
    fn custom_search_url_and_startup_list() {
        let (name, url, keyword) = search_provider("https://search.example.org/find");
        assert_eq!(name, "search.example.org");
        assert_eq!(keyword, "search.example.org");
        assert_eq!(url, "https://search.example.org/find?q={searchTerms}");
        let set = PolicySet::from_options(
            None,
            None,
            Some("https://aphrody.com/"),
            &["https://a.example".into(), "https://b.example".into()],
        );
        let commands = set.reg_commands();
        // homepage: 3 adds; startup: dword + delete + 2 adds
        assert_eq!(commands.len(), 7);
        assert_eq!(commands[4][0], "delete");
        assert_eq!(commands[5][3], "1");
        assert_eq!(commands[6][3], "2");
    }

    #[test]
    fn empty_options_produce_no_policies() {
        assert!(PolicySet::from_options(None, None, None, &[]).is_empty());
    }
}
