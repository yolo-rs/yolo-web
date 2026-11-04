//! Minimal probe of Chromium's DevTools HTTP endpoint (`/json/version`), used
//! by `--smoke` runs that enable `--remote-debugging-port` to prove that the
//! Chrome DevTools Protocol is reachable without any external tooling.

use std::{
    io::{Read, Write},
    net::{Ipv4Addr, SocketAddrV4, TcpStream},
    time::Duration,
};

use serde::Serialize;

/// Facts returned by `/json/version`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CdpProbe {
    pub port: u16,
    pub browser: String,
    pub protocol_version: String,
    pub user_agent: String,
    pub v8_version: String,
    pub web_socket_debugger_url: String,
}

/// Queries `http://127.0.0.1:{port}/json/version` with a short timeout.
pub fn probe(port: u16) -> Result<CdpProbe, String> {
    let address = SocketAddrV4::new(Ipv4Addr::LOCALHOST, port);
    let timeout = Duration::from_secs(5);
    let mut stream = TcpStream::connect_timeout(&address.into(), timeout)
        .map_err(|error| format!("connect {address}: {error}"))?;
    stream.set_read_timeout(Some(timeout)).ok();
    stream.set_write_timeout(Some(timeout)).ok();
    stream
        .write_all(
            format!(
                "GET /json/version HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n"
            )
            .as_bytes(),
        )
        .map_err(|error| format!("request: {error}"))?;
    let response = read_http_response(&mut stream).map_err(|error| format!("response: {error}"))?;
    parse_version_response(&response, port)
}

/// Reads one HTTP/1.1 response. Chromium's DevTools server keeps the
/// connection open, so the body length comes from `Content-Length` rather
/// than from EOF.
fn read_http_response(stream: &mut TcpStream) -> std::io::Result<String> {
    let mut buffer = Vec::new();
    let mut chunk = [0u8; 4096];
    let header_end = loop {
        if let Some(position) = find_header_end(&buffer) {
            break position;
        }
        let read = stream.read(&mut chunk)?;
        if read == 0 {
            return Ok(String::from_utf8_lossy(&buffer).into_owned());
        }
        buffer.extend_from_slice(&chunk[..read]);
    };
    let content_length = String::from_utf8_lossy(&buffer[..header_end])
        .lines()
        .find_map(|line| {
            let (name, value) = line.split_once(':')?;
            name.trim()
                .eq_ignore_ascii_case("content-length")
                .then(|| value.trim().parse::<usize>().ok())
                .flatten()
        });
    let body_start = header_end + 4;
    match content_length {
        Some(length) => {
            while buffer.len() < body_start + length {
                let read = stream.read(&mut chunk)?;
                if read == 0 {
                    break;
                }
                buffer.extend_from_slice(&chunk[..read]);
            }
        }
        None => {
            stream.read_to_end(&mut buffer)?;
        }
    }
    Ok(String::from_utf8_lossy(&buffer).into_owned())
}

fn find_header_end(buffer: &[u8]) -> Option<usize> {
    buffer.windows(4).position(|window| window == b"\r\n\r\n")
}

/// Parses the HTTP response of `/json/version`.
pub fn parse_version_response(response: &str, port: u16) -> Result<CdpProbe, String> {
    let (head, body) = response
        .split_once("\r\n\r\n")
        .ok_or_else(|| "malformed HTTP response".to_string())?;
    let status = head.lines().next().unwrap_or_default();
    if !status.contains(" 200 ") {
        return Err(format!("unexpected status line: {status}"));
    }
    let json: serde_json::Value =
        serde_json::from_str(body.trim()).map_err(|error| format!("invalid JSON body: {error}"))?;
    let field = |name: &str| json[name].as_str().unwrap_or_default().to_string();
    Ok(CdpProbe {
        port,
        browser: field("Browser"),
        protocol_version: field("Protocol-Version"),
        user_agent: field("User-Agent"),
        v8_version: field("V8-Version"),
        web_socket_debugger_url: field("webSocketDebuggerUrl"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_devtools_version_response() {
        let response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"Browser\":\"Chrome/156.0.8078.80\",\"Protocol-Version\":\"1.3\",\"User-Agent\":\"Mozilla/5.0\",\"V8-Version\":\"15.6.1\",\"webSocketDebuggerUrl\":\"ws://127.0.0.1:9333/devtools/browser/abc\"}";
        let probe = parse_version_response(response, 9333).unwrap();
        assert_eq!(probe.browser, "Chrome/156.0.8078.80");
        assert_eq!(probe.protocol_version, "1.3");
        assert_eq!(
            probe.web_socket_debugger_url,
            "ws://127.0.0.1:9333/devtools/browser/abc"
        );
    }

    #[test]
    fn rejects_non_200_responses() {
        assert!(parse_version_response("HTTP/1.1 404 Not Found\r\n\r\n{}", 1).is_err());
        assert!(parse_version_response("garbage", 1).is_err());
    }
}
