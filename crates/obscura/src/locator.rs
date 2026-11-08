//! High-level Locator API for Obscura (surpassing Playwright).
//!
//! Provides resilient, lazy DOM element location with support for:
//! - CSS Selectors
//! - XPath expressions (`xpath=//...` or `//...`)
//! - Text matching (`text=...` exact or substring)
//! - Accessibility Roles (`role=button[name="Submit"]`)
//! - ARIA labels (`aria-label=...`)
//! - Test IDs (`data-testid=...`)
//! - Auto-waiting, retry, and evaluation

use std::time::Duration;
use crate::error::Error;
use crate::page::{Element, Page};

/// Supported selector strategies for resolving elements.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SelectorStrategy {
    Css(String),
    XPath(String),
    Role { role: String, name: Option<String> },
    Text { text: String, exact: bool },
    Label(String),
    Placeholder(String),
    AltText(String),
    Title(String),
    TestId(String),
}

impl SelectorStrategy {
    /// Parse a selector string into a structured `SelectorStrategy`.
    pub fn parse(selector: &str) -> Self {
        let trimmed = selector.trim();
        if let Some(rest) = trimmed.strip_prefix("xpath=") {
            SelectorStrategy::XPath(rest.to_string())
        } else if trimmed.starts_with("//") || trimmed.starts_with("(") {
            SelectorStrategy::XPath(trimmed.to_string())
        } else if let Some(rest) = trimmed.strip_prefix("text=") {
            let (unquoted, exact) = strip_quotes(rest);
            SelectorStrategy::Text { text: unquoted, exact }
        } else if let Some(rest) = trimmed.strip_prefix("role=") {
            parse_role_selector(rest)
        } else if let Some(rest) = trimmed.strip_prefix("aria-label=") {
            let (unquoted, _) = strip_quotes(rest);
            SelectorStrategy::Label(unquoted)
        } else if let Some(rest) = trimmed.strip_prefix("label=") {
            let (unquoted, _) = strip_quotes(rest);
            SelectorStrategy::Label(unquoted)
        } else if let Some(rest) = trimmed.strip_prefix("placeholder=") {
            let (unquoted, _) = strip_quotes(rest);
            SelectorStrategy::Placeholder(unquoted)
        } else if let Some(rest) = trimmed.strip_prefix("alt=") {
            let (unquoted, _) = strip_quotes(rest);
            SelectorStrategy::AltText(unquoted)
        } else if let Some(rest) = trimmed.strip_prefix("title=") {
            let (unquoted, _) = strip_quotes(rest);
            SelectorStrategy::Title(unquoted)
        } else if let Some(rest) = trimmed.strip_prefix("testid=") {
            let (unquoted, _) = strip_quotes(rest);
            SelectorStrategy::TestId(unquoted)
        } else if let Some(rest) = trimmed.strip_prefix("data-testid=") {
            let (unquoted, _) = strip_quotes(rest);
            SelectorStrategy::TestId(unquoted)
        } else if let Some(rest) = trimmed.strip_prefix("css=") {
            SelectorStrategy::Css(rest.to_string())
        } else {
            SelectorStrategy::Css(trimmed.to_string())
        }
    }

    /// Convert the strategy into a client-side JavaScript expression.
    pub fn to_js_query(&self) -> String {
        match self {
            SelectorStrategy::Css(css) => {
                let esc = escape_js_str(css);
                format!("document.querySelectorAll('{}')", esc)
            }
            SelectorStrategy::XPath(xpath) => {
                let esc = escape_js_str(xpath);
                format!(
                    "(function() {{
                        var res = document.evaluate('{}', document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                        var arr = [];
                        for (var i = 0; i < res.snapshotLength; i++) {{ arr.push(res.snapshotItem(i)); }}
                        return arr;
                    }})()",
                    esc
                )
            }
            SelectorStrategy::Role { role, name } => {
                let role_esc = escape_js_str(role);
                let name_filter = if let Some(n) = name {
                    let n_esc = escape_js_str(n);
                    format!(
                        "var elName = (el.getAttribute('aria-label') || el.innerText || el.value || '').trim();
                         if (elName !== '{}') return false;",
                        n_esc
                    )
                } else {
                    "".to_string()
                };
                format!(
                    "(function() {{
                        var candidates = document.querySelectorAll('*');
                        var matched = [];
                        var r = '{}'.toLowerCase();
                        for (var i = 0; i < candidates.length; i++) {{
                            var el = candidates[i];
                            var explicitRole = el.getAttribute('role');
                            var tag = el.tagName.toLowerCase();
                            var matchesRole = (explicitRole && explicitRole.toLowerCase() === r) ||
                                (r === 'button' && (tag === 'button' || (tag === 'input' && (el.type === 'button' || el.type === 'submit')))) ||
                                (r === 'link' && tag === 'a') ||
                                (r === 'textbox' && (tag === 'textarea' || (tag === 'input' && (!el.type || el.type === 'text' || el.type === 'email' || el.type === 'password')))) ||
                                (r === 'heading' && /^h[1-6]$/.test(tag)) ||
                                (r === 'checkbox' && tag === 'input' && el.type === 'checkbox') ||
                                (r === 'radio' && tag === 'input' && el.type === 'radio');
                            if (matchesRole) {{
                                {}
                                matched.push(el);
                            }}
                        }}
                        return matched;
                    }})()",
                    role_esc, name_filter
                )
            }
            SelectorStrategy::Text { text, exact } => {
                let text_esc = escape_js_str(text);
                format!(
                    "(function() {{
                        var candidates = document.querySelectorAll('*');
                        var matched = [];
                        var target = '{}';
                        var exact = {};
                        for (var i = 0; i < candidates.length; i++) {{
                            var el = candidates[i];
                            var txt = el.innerText || el.textContent || '';
                            if (exact ? txt.trim() === target : txt.indexOf(target) !== -1) {{
                                if (el.children.length === 0 || exact) {{
                                    matched.push(el);
                                }}
                            }}
                        }}
                        return matched;
                    }})()",
                    text_esc, exact
                )
            }
            SelectorStrategy::Label(label) => {
                let esc = escape_js_str(label);
                format!(
                    "(function() {{
                        var matched = [];
                        var aria = document.querySelectorAll('[aria-label=\"{}\"]');
                        for (var i = 0; i < aria.length; i++) matched.push(aria[i]);
                        var labels = document.querySelectorAll('label');
                        for (var i = 0; i < labels.length; i++) {{
                            if ((labels[i].innerText || '').trim() === '{}') {{
                                var forId = labels[i].getAttribute('for');
                                if (forId) {{
                                    var el = document.getElementById(forId);
                                    if (el) matched.push(el);
                                }} else {{
                                    var inp = labels[i].querySelector('input, select, textarea');
                                    if (inp) matched.push(inp);
                                }}
                            }}
                        }}
                        return matched;
                    }})()",
                    esc, esc
                )
            }
            SelectorStrategy::Placeholder(ph) => {
                let esc = escape_js_str(ph);
                format!("document.querySelectorAll('[placeholder=\"{}\"]')", esc)
            }
            SelectorStrategy::AltText(alt) => {
                let esc = escape_js_str(alt);
                format!("document.querySelectorAll('img[alt=\"{}\"]')", esc)
            }
            SelectorStrategy::Title(title) => {
                let esc = escape_js_str(title);
                format!("document.querySelectorAll('[title=\"{}\"]')", esc)
            }
            SelectorStrategy::TestId(id) => {
                let esc = escape_js_str(id);
                format!(
                    "document.querySelectorAll('[data-testid=\"{}\"], [data-test-id=\"{}\"], [data-test=\"{}\"], [id=\"{}\"]')",
                    esc, esc, esc, esc
                )
            }
        }
    }
}

fn strip_quotes(s: &str) -> (String, bool) {
    let t = s.trim();
    if (t.starts_with('"') && t.ends_with('"')) || (t.starts_with('\'') && t.ends_with('\'')) {
        if t.len() >= 2 {
            (t[1..t.len() - 1].to_string(), true)
        } else {
            (t.to_string(), false)
        }
    } else {
        (t.to_string(), false)
    }
}

fn parse_role_selector(s: &str) -> SelectorStrategy {
    let t = s.trim();
    if let Some(idx) = t.find("[name=") {
        let role = t[..idx].trim().to_string();
        let rest = &t[idx + 6..];
        let name_trimmed = rest.trim_end_matches(']').trim();
        let (name, _) = strip_quotes(name_trimmed);
        SelectorStrategy::Role {
            role,
            name: Some(name),
        }
    } else {
        SelectorStrategy::Role {
            role: t.to_string(),
            name: None,
        }
    }
}

fn escape_js_str(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('\'', "\\'")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

/// A lazy DOM locator that automatically retries and supports flexible queries.
pub struct Locator<'p> {
    page: &'p Page,
    strategy: SelectorStrategy,
}

impl<'p> Locator<'p> {
    pub fn new(page: &'p Page, strategy: SelectorStrategy) -> Self {
        Self { page, strategy }
    }

    pub fn strategy(&self) -> &SelectorStrategy {
        &self.strategy
    }

    pub fn element(&self) -> Option<Element<'p>> {
        let js_query = self.strategy.to_js_query();
        let script = format!(
            "(function() {{
                var elements = {};
                var first = elements && (elements.length !== undefined ? elements[0] : elements);
                return first ? (first._nid || null) : null;
            }})()",
            js_query
        );
        let val = self.page.evaluate(&script);
        val.as_u64()
            .or_else(|| val.as_f64().filter(|f| f.is_finite() && *f >= 0.0).map(|f| f as u64))
            .map(|nid| Element {
                node_id: nid,
                page: self.page,
            })
    }

    pub async fn wait_for(&self, timeout: Duration) -> Result<Element<'p>, Error> {
        let start = std::time::Instant::now();
        loop {
            if let Some(el) = self.element() {
                return Ok(el);
            }
            if start.elapsed() > timeout {
                return Err(Error::Timeout(format!(
                    "Locator({:?}) timed out after {}ms",
                    self.strategy,
                    timeout.as_millis()
                )));
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    }

    pub async fn click(&self, timeout: Option<Duration>) -> Result<(), Error> {
        let to = timeout.unwrap_or(Duration::from_secs(10));
        let el = self.wait_for(to).await?;
        el.click()
    }

    pub async fn fill(&self, text: &str, timeout: Option<Duration>) -> Result<(), Error> {
        let to = timeout.unwrap_or(Duration::from_secs(10));
        let _ = self.wait_for(to).await?;
        let js_query = self.strategy.to_js_query();
        let esc_text = escape_js_str(text);
        let script = format!(
            "(function() {{
                var elements = {};
                var el = elements && (elements.length !== undefined ? elements[0] : elements);
                if (el) {{
                    el.focus();
                    el.value = '{}';
                    el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    return true;
                }}
                return false;
            }})()",
            js_query, esc_text
        );
        let res = self.page.evaluate(&script);
        if res.as_bool().unwrap_or(false) {
            Ok(())
        } else {
            Err(Error::ElementNotFound("fill failed".into()))
        }
    }

    pub fn text_content(&self) -> Option<String> {
        let js_query = self.strategy.to_js_query();
        let script = format!(
            "(function() {{
                var elements = {};
                var el = elements && (elements.length !== undefined ? elements[0] : elements);
                return el ? (el.textContent || '') : null;
            }})()",
            js_query
        );
        let val = self.page.evaluate(&script);
        val.as_str().map(|s| s.to_string())
    }

    pub fn inner_html(&self) -> Option<String> {
        let js_query = self.strategy.to_js_query();
        let script = format!(
            "(function() {{
                var elements = {};
                var el = elements && (elements.length !== undefined ? elements[0] : elements);
                return el ? (el.innerHTML || '') : null;
            }})()",
            js_query
        );
        let val = self.page.evaluate(&script);
        val.as_str().map(|s| s.to_string())
    }

    pub fn get_attribute(&self, attr: &str) -> Option<String> {
        let js_query = self.strategy.to_js_query();
        let esc_attr = escape_js_str(attr);
        let script = format!(
            "(function() {{
                var elements = {};
                var el = elements && (elements.length !== undefined ? elements[0] : elements);
                return el ? el.getAttribute('{}') : null;
            }})()",
            js_query, esc_attr
        );
        let val = self.page.evaluate(&script);
        val.as_str().map(|s| s.to_string())
    }

    pub fn count(&self) -> usize {
        let js_query = self.strategy.to_js_query();
        let script = format!(
            "(function() {{
                var elements = {};
                if (!elements) return 0;
                return elements.length !== undefined ? elements.length : 1;
            }})()",
            js_query
        );
        let val = self.page.evaluate(&script);
        val.as_u64().unwrap_or(0) as usize
    }

    pub fn is_visible(&self) -> bool {
        let js_query = self.strategy.to_js_query();
        let script = format!(
            "(function() {{
                var elements = {};
                var el = elements && (elements.length !== undefined ? elements[0] : elements);
                if (!el) return false;
                var style = window.getComputedStyle ? window.getComputedStyle(el) : null;
                if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) return false;
                var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
                return rect ? (rect.width > 0 && rect.height > 0) : true;
            }})()",
            js_query
        );
        self.page.evaluate(&script).as_bool().unwrap_or(false)
    }

    pub fn is_enabled(&self) -> bool {
        let js_query = self.strategy.to_js_query();
        let script = format!(
            "(function() {{
                var elements = {};
                var el = elements && (elements.length !== undefined ? elements[0] : elements);
                return el ? !el.disabled : false;
            }})()",
            js_query
        );
        self.page.evaluate(&script).as_bool().unwrap_or(false)
    }

    pub fn is_checked(&self) -> bool {
        let js_query = self.strategy.to_js_query();
        let script = format!(
            "(function() {{
                var elements = {};
                var el = elements && (elements.length !== undefined ? elements[0] : elements);
                return el ? !!el.checked : false;
            }})()",
            js_query
        );
        self.page.evaluate(&script).as_bool().unwrap_or(false)
    }
}
