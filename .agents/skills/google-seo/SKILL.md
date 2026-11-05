---
name: google-seo
description: Audit technical SEO, crawlability, indexability, metadata, canonical URLs, structured data, and performance using Google Search Central guidance and Lighthouse.
---

# Google Search SEO

Use this skill for technical SEO changes and audits in YOLO-Web-owned web apps. Follow Google Search Central's current documentation; do not promise rankings or treat one Lighthouse score as proof of indexability.

## Workflow

1. Identify the actual public routes and deployment origin. Inspect server rendering, response status, redirects, canonical URLs, robots directives, sitemap, and metadata.
2. For representative routes, compare raw server HTML with rendered DOM. Important content and crawlable links must be discoverable without relying on user-only state. Test that assets required to render the page are crawlable.
3. Check title and description uniqueness, language/viewport metadata, headings, descriptive link text, image alternatives, and canonical consistency.
4. Check `robots.txt`, `noindex`, HTTP status, redirects, and sitemap membership as separate controls. `robots.txt` controls crawling; it does not guarantee deindexing. A sitemap helps discovery but does not guarantee indexing.
5. Validate structured data against the relevant Google feature documentation and test tool. Include only facts visible on the page; never invent reviews, ratings, or organization details.
6. Run Lighthouse against a locally served or preview URL for SEO, accessibility, best practices, and lab performance. Report the URL, browser/version, environment, and output artifact. Use repeated runs for comparisons.
7. If deployed to Vercel with Speed Insights enabled and authenticated project access, inspect field Core Web Vitals separately from Lighthouse lab results. Do not assume this repository is linked to a Vercel project.
8. Fix the concrete defect with the smallest change and rerun the affected audit. Document any issue that depends on credentials, production traffic, or search engine recrawl timing.

## Guardrails

- Prefer useful, user-focused content and crawlable `<a href>` links.
- Keep route URLs stable and provide a single preferred canonical URL where duplicates exist.
- Do not block a URL in `robots.txt` when the goal is for a crawler to observe its `noindex` directive.
- Do not add structured data for information absent from visible page content.
- A successful Lighthouse SEO audit is not a promise of crawling, indexing, rich results, or ranking.
- Use Bun for project commands. Do not add Node, npm, npx, pnpm, or yarn workflows.

## Official references

- [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Google Search developer guide](https://developers.google.com/search/docs/fundamentals/get-started-developers)
- [Google sitemap overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
- [Google canonicalization](https://developers.google.com/search/docs/crawling-indexing/canonicalization)
- [Lighthouse in Chrome DevTools](https://developer.chrome.com/docs/devtools/lighthouse)
