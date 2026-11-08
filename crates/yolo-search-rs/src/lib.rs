//! YOLO Sovereign Search Bare-Metal Rust Core
//! Fast FFI & Local Caching Interface for GPUI & Zed Native Integration.

use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SearchHitRs {
    pub title: String,
    pub url: String,
    pub snippet: String,
    pub source: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SearchResultRs {
    pub query: String,
    pub hits: Vec<SearchHitRs>,
    pub took_ms: f64,
}

/// Fast in-memory search indexer for zero-copy FFI
pub struct LocalSearchEngine {
    index: Vec<SearchHitRs>,
}

impl LocalSearchEngine {
    pub fn new() -> Self {
        Self {
            index: vec![
                SearchHitRs {
                    title: "Bun Documentation".to_string(),
                    url: "https://bun.com/docs".to_string(),
                    snippet: "Fast all-in-one JavaScript & TypeScript toolkit.".to_string(),
                    source: "local-rust".to_string(),
                },
                SearchHitRs {
                    title: "WGPU WebGPU Engine".to_string(),
                    url: "https://wgpu.rs".to_string(),
                    snippet: "Safe and portable graphics library for Rust based on WebGPU.".to_string(),
                    source: "local-rust".to_string(),
                },
            ],
        }
    }

    pub fn search(&self, query: &str) -> Vec<SearchHitRs> {
        let q = query.to_lowercase();
        self.index
            .iter()
            .filter(|hit| hit.title.to_lowercase().contains(&q) || hit.snippet.to_lowercase().contains(&q))
            .cloned()
            .collect()
    }
}

/// C-ABI FFI Entrypoint for zero-overhead native bindings (GPUI / Bun FFI)
#[unsafe(no_mangle)]
pub extern "C" fn yolo_search_query(query_ptr: *const c_char) -> *mut c_char {
    if query_ptr.is_null() {
        return std::ptr::null_mut();
    }

    let c_str = unsafe { CStr::from_ptr(query_ptr) };
    let query = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };

    let start = std::time::Instant::now();
    let engine = LocalSearchEngine::new();
    let hits = engine.search(query);
    let took_ms = start.elapsed().as_secs_f64() * 1000.0;

    let res = SearchResultRs {
        query: query.to_string(),
        hits,
        took_ms,
    };

    let json_str = serde_json::to_string(&res).unwrap_or_default();
    CString::new(json_str).map(CString::into_raw).unwrap_or(std::ptr::null_mut())
}

#[unsafe(no_mangle)]
pub extern "C" fn yolo_search_free(ptr: *mut c_char) {
    if !ptr.is_null() {
        unsafe {
            let _ = CString::from_raw(ptr);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search_rust_native() {
        let engine = LocalSearchEngine::new();
        let hits = engine.search("bun");
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].title, "Bun Documentation");
    }
}
