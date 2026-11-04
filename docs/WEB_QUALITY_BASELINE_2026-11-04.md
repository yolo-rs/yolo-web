# Human Browser Workbench quality baseline

This is one local Lighthouse lab run, recorded against the pre-transfer workbench UI after it was connected to a real Chrome DevTools Protocol browser. It is a snapshot, not a statistical performance baseline. The frontend now lives in `yolo-ui/apps/yolo-browser-workbench`; the historical run below measured it at port `8080`, while the current UI defaults to `8081` and proxies to the YOLO-Web API at `8080`.

## Environment

- App: `apps/human-browser`, served by Bun at `http://127.0.0.1:8080`
- Browser: Google Chrome `157.0.8103.38`, headless, isolated temporary profile
- CDP: loopback `127.0.0.1:9222`
- Auditor: Lighthouse `13.6.0`
- Categories: performance, accessibility, best practices, SEO
- Run time: `2026-11-04T14:00:28Z`

## Scores

| Category | Score |
| --- | ---: |
| Performance | 100 |
| Accessibility | 100 |
| Best practices | 100 |
| SEO | 100 |

The report retained the `lcp-discovery-insight` diagnostic. It is an insight for follow-up, not a scored audit failure. Compare future runs with the same Chrome/Lighthouse versions and connected-browser setup; collect multiple runs before treating score differences as regressions.

## Reproduce

Start Chrome with remote debugging bound to loopback and a dedicated temporary user-data directory. Start the YOLO-Web service in one checkout and the yolo-ui frontend in another, then run Lighthouse against the frontend:

```powershell
# yolo-web
bun run dev

# yolo-ui
$env:YOLO_WEB_API_URL = 'http://127.0.0.1:8080'
bun --filter @yolo-rs/browser-workbench start

# Either checkout
bunx lighthouse http://127.0.0.1:8081 --only-categories=accessibility,best-practices,seo,performance --output=json --output-path=artifacts/lighthouse.json
```

Lighthouse discovers Chrome from the local installation. If discovery is unavailable, set `CHROME_PATH` to the installed Chrome executable for the current shell. Keep credentials and browser profiles out of benchmark artifacts.

This lab score does not represent field Core Web Vitals. Use authenticated `vercel metrics` only for a linked Vercel project with Speed Insights data.
