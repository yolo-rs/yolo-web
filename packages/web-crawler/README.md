# YOLO-Web crawler

`@yolo-web/web-crawler` provides a sequential, bounded HTML crawler for the
`web crawl` CLI and local research applications.

```ts
import { crawl, synthesizeMarkdown } from "@yolo-web/web-crawler";

const result = await crawl({
  seeds: ["https://www.linuxfromscratch.org/"],
  maxDepth: 1,
  maxPages: 30,
  delayMs: 800,
});
await Bun.write("crawl.json", JSON.stringify(result, null, 2));
await Bun.write("crawl.md", synthesizeMarkdown(result, "LFS sources"));
```

The crawler defaults to same-origin traversal, robots exclusions, a 15 second
timeout and a 2 MB response limit. Its JSON records include final URL, status,
retrieval timestamp, content type, extracted links and response SHA-256. The
digest describes retrieved bytes; it is not a publisher signature. The current
extractor is HTML/text oriented and does not render JavaScript or enumerate
paginated APIs. Check upstream licensing before redistributing captured text.

The package also exports `listGitHubRepositories(owner, options)` for public
organization/user repository metadata and `inspectGitRemote(url)` for
`git ls-remote --symref <url> HEAD`. GitHub page responses keep per-page ETags
and SHA-256 digests, and repository results are sorted locally by star count.
The Git adapter records only the symbolic default ref and commit ID; it does not
clone the repository.
