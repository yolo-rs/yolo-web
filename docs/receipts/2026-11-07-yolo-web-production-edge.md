# Aphrody Production Edge Web Services & Routing Verification

Date: 2026-11-07
Author: Autonomous Web Publishing & Edge Routing Specialist
Scope: Edge routing topology, TLS configuration, origin routing, and production specifications for `aphrody.com` and `*.aphrody.app`.

---

## 1. Domain & Edge Architecture Topology

Aphrody production web infrastructure utilizes an Anycast edge proxy mesh (Cloudflare CDN / Origin Shields / Cloudflare Access) paired with dedicated Hostinger VPS origin nodes (`prod`, `vps`, `bunos`) and WireGuard mesh routing (`10.0.0.0/24`).

```
                              [ Public Clients / Web Crawlers / AI Agents ]
                                                    |
                                                    v
                                      +---------------------------+
                                      | Cloudflare Anycast Edge   |
                                      | TLS 1.3 (GTS / LE YE1)   |
                                      | DDoS & Bot Shielding      |
                                      +-------------+-------------+
                                                    |
                   +--------------------------------+--------------------------------+
                   |                                                                 |
                   v                                                                 v
+-------------------------------------+                           +-------------------------------------+
|        aphrody.com (Apex/Sub)       |                           |          *.aphrody.app              |
| DNS: A / AAAA / CNAME Proxy         |                           | DNS: Custom Domains & Workers Edge  |
| HSTS: max-age=31536000; preload     |                           | Zero-Trust Access Gateway           |
+------------------+------------------+                           +------------------+------------------+
                   |                                                                 |
                   |                                                                 |
                   v                                                                 v
+-------------------------------------+                           +-------------------------------------+
| Origin Gateway (`prod` / `vps`)     |                           | Cloudflare Pages / Workers R2       |
| Hostinger KVM Node (Debian 13)      |                           | Craft Studios WASM/WebGPU Frontends |
| Nginx Reverse Proxy / aphrody-webos |                           | Deploy Orchestrator / CI Workers    |
| Port: 18790 (aphrody-ai supervisor) |                           | Static Pre-Rendered Assets          |
+-------------------------------------+                           +-------------------------------------+
```

---

## 2. Production Domain Routing Matrix

### 2.1 `aphrody.com` Domain Family

| Endpoint | Routing Target | Edge Protocol | TLS Issuer | Security & Response Status |
|:---|:---|:---|:---|:---|
| `http://aphrody.com/` | `https://aphrody.com/` | 301 Permanent Redirect | N/A | HTTP -> HTTPS redirect hop |
| `https://aphrody.com/` | Hostinger `prod` origin (`aphrody-webos-server`) | HTTP/2, HTTP/3 QUIC | Let's Encrypt YE1 | Status 200 OK. HSTS enabled. Calm Divine OS landing. |
| `https://www.aphrody.com/` | `https://aphrody.com/` | 301 Permanent Redirect | Let's Encrypt YE1 | Canonical apex normalization. |
| `https://yolo.aphrody.com/` | Cloudflare Pages / Custom Domain (`dist/yolo-aphrody-com`) | HTTP/2, HTTP/3 QUIC | Google Trust Services WE1 | Status 200 OK. Dioxus/Taffy UI showcase hub. |
| `https://cdn.aphrody.com/` | `prod` Nginx static storage origin | HTTP/2 | Let's Encrypt YE1 | Status 200 OK (`application/json` / static binaries). |
| `https://downloads.aphrody.com/` | `prod` Nginx download portal | HTTP/2 | Let's Encrypt YE1 | Status 200 OK. CSP & nosniff enforcement. |
| `https://omar.aphrody.com/` | Cloudflare Access Protected | HTTP/2 | Let's Encrypt YE2 | Status 403 Forbidden (Strict Identity Gate). |

### 2.2 `*.aphrody.app` Domain Family

| Endpoint | Routing Target | Edge Protocol | TLS Issuer | Security & Response Status |
|:---|:---|:---|:---|:---|
| `https://craft.aphrody.app/` | Cloudflare R2 / Custom Domain Worker | HTTP/2, HTTP/3 QUIC | Google Trust Services WE1 | Status 200 OK. 14 Creative Studios (WebGPU/WASM). |
| `https://deploy.aphrody.app/` | Edge CI/CD Webhook & Dashboard | HTTP/2 | Google Trust Services WE1 | Status 200 OK. HSTS & nosniff enabled. |
| `https://nie.aphrody.app/` | Retired Legacy Microservice | HTTP/2 | Google Trust Services WE1 | Status 410 Gone (Intentional endpoint retirement). |
| `https://video.aphrody.app/` | Media Streaming Subsystem Edge | HTTP/2 | Google Trust Services WE1 | Status 404 / Explicit empty root frontier. |
| `https://aphrody.app/` | Cloudflare Zero Trust Gateway | HTTP/2 | Google Trust Services WE1 | 302 Redirect -> `aphrody-labs` Access Login. |

---

## 3. Edge Routing Verification Protocol

Edge endpoints are verified using `web fetch` and `curl` across TLS 1.3 handshakes:

1. **Apex Canonical Redirect Check**:
   ```bash
   curl -sI http://aphrody.com/ | grep -E "(HTTP|Location)"
   # Output: HTTP/1.1 301 Moved Permanently -> Location: https://aphrody.com/
   ```

2. **TLS 1.3 & ALPN Negotiation**:
   ```bash
   openssl s_client -connect aphrody.com:443 -alpn h2 -tls1_3 < /dev/null
   # Result: Handshake OK, ALPN = h2, Cipher = TLS_AES_128_GCM_SHA256
   ```

3. **Brave Shields & Headless Fetch Verification**:
   ```bash
   web fetch https://aphrody.com --markdown
   web shields https://craft.aphrody.app --source=https://aphrody.com
   ```

---

## 4. Origin Node Configuration & Mesh Interconnect

Origin workloads run across nodes connected via WireGuard interface `wg0`:
- **Production Hub (`prod`)**: Hostinger VPS node hosting primary web landing, Nginx ingress proxy, and systemd supervisor.
- **Agent Supervisor**: `aphrody-ai.service` running on port `18790` providing autonomous repository health, sync checks, and edge telemetry.
- **Mesh Subnet**: `10.0.0.0/24` with persistent keepalive `25s` for zero packet stall during cross-region failovers.
