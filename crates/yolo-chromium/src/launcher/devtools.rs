//! Background probe of the host's DevTools endpoint. The endpoint answers on
//! Chromium's UI thread, so the shell cannot query it from inside a callback;
//! the launcher process does it instead and records the result in the receipt.

use std::{
    fs,
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread::{self, JoinHandle},
    time::Duration,
};

use crate::cdp::{self, CdpProbe};

/// Delay between probe attempts while the host starts up.
const RETRY_DELAY: Duration = Duration::from_millis(100);

/// A probe thread that retries until the endpoint answers or it is stopped.
pub struct ProbeTask {
    stop: Arc<AtomicBool>,
    handle: JoinHandle<Option<CdpProbe>>,
}

impl ProbeTask {
    /// Starts probing `port` in the background.
    pub fn start(port: u16) -> Self {
        let stop = Arc::new(AtomicBool::new(false));
        let stop_flag = stop.clone();
        let handle = thread::spawn(move || {
            while !stop_flag.load(Ordering::Relaxed) {
                if let Ok(probe) = cdp::probe(port) {
                    return Some(probe);
                }
                thread::sleep(RETRY_DELAY);
            }
            None
        });
        Self { stop, handle }
    }

    /// Stops the probe and returns its result, if any.
    pub fn finish(self) -> Option<CdpProbe> {
        self.stop.store(true, Ordering::Relaxed);
        self.handle.join().ok().flatten()
    }
}

/// Inserts the probe into the `cdp` field of an existing receipt file.
pub fn attach_to_receipt(path: &Path, probe: &CdpProbe) -> Result<(), String> {
    let text = fs::read_to_string(path).map_err(|error| format!("read: {error}"))?;
    let mut receipt: serde_json::Value =
        serde_json::from_str(&text).map_err(|error| format!("parse: {error}"))?;
    let object = receipt
        .as_object_mut()
        .ok_or_else(|| "receipt is not a JSON object".to_string())?;
    object.insert(
        "cdp".to_string(),
        serde_json::to_value(probe).map_err(|error| format!("serialize: {error}"))?,
    );
    let json =
        serde_json::to_string_pretty(&receipt).map_err(|error| format!("serialize: {error}"))?;
    fs::write(path, format!("{json}\n")).map_err(|error| format!("write: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn attaches_probe_to_receipt_json() {
        let dir =
            std::env::temp_dir().join(format!("yolo-chromium-receipt-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("receipt.json");
        fs::write(&path, "{\"schemaVersion\":1,\"cdp\":null}\n").unwrap();
        let probe = CdpProbe {
            port: 9333,
            browser: "Chrome/156.0.8078.80".into(),
            protocol_version: "1.3".into(),
            user_agent: "UA".into(),
            v8_version: "15.6".into(),
            web_socket_debugger_url: "ws://127.0.0.1:9333/devtools/browser/x".into(),
        };
        attach_to_receipt(&path, &probe).unwrap();
        let text = fs::read_to_string(&path).unwrap();
        assert!(text.contains("\"browser\": \"Chrome/156.0.8078.80\""));
        assert!(text.contains("\"schemaVersion\": 1"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn probe_task_stops_without_a_server() {
        let task = ProbeTask::start(1);
        thread::sleep(Duration::from_millis(50));
        assert!(task.finish().is_none());
    }
}
