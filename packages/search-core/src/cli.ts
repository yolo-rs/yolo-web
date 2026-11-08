#!/usr/bin/env bun
/**
 * YOLO Sovereign Search CLI
 * Multi-Provider Search via Terminal (FreeContext7, Exa, SearXNG, Google)
 */

import { SovereignSearchEngine, type SearchProviderType } from './engine.ts';

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  console.log(`
YOLO Sovereign Search CLI
Usage:
  bun yolo-search <query> [options]

Options:
  -p, --provider <type>   Target provider: fastest (default), free-context7, searxng, exa, all
  -l, --limit <n>         Max results (default: 5)
  --docs <library>        Lookup verified symbol/doc for a specific library

Examples:
  bun yolo-search "bun serve"
  bun yolo-search "rust webgpu" --provider exa
  bun yolo-search "hooks" --docs react
`);
  process.exit(0);
}

const engine = new SovereignSearchEngine();

let provider: SearchProviderType | 'all' | 'fastest' = 'fastest';
let limit = 5;
let docsLib = '';
const queryParts: string[] = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-p' || arg === '--provider') {
    const val = args[++i];
    if (val) provider = val as any;
  } else if (arg === '-l' || arg === '--limit') {
    const val = args[++i];
    if (val) limit = parseInt(val, 10);
  } else if (arg === '--docs') {
    const val = args[++i];
    if (val) docsLib = val;
  } else if (arg) {
    queryParts.push(arg);
  }
}

const query = queryParts.filter(Boolean).join(' ');

async function main() {
  if (docsLib && query) {
    const res = engine.resolveDocs({ library: docsLib, symbol: query });
    if (!res) {
      console.log(`No documentation found for library '${docsLib}' matching '${query}'.`);
      return;
    }
    console.log(`=== [DOC] ${res.library}: ${res.symbol} (${res.tookMs.toFixed(2)}ms) ===`);
    console.log(`Summary: ${res.summary}`);
    console.log(`Signature:\n${res.signature}`);
    if (res.codeSnippet) {
      console.log(`\nExample:\n${res.codeSnippet}`);
    }
    console.log(`Source: ${res.sourceUri}`);
    return;
  }

  console.log(`Searching for "${query}" (provider: ${provider})...\n`);
  const res = await engine.search(query, { provider, limit });

  console.log(`--- Results (${res.totalHits} hits in ${res.tookMs.toFixed(2)}ms, cost: $${res.costDollars}, via ${res.providerUsed}) ---\n`);

  for (let i = 0; i < res.hits.length; i++) {
    const hit = res.hits[i];
    if (!hit) continue;
    console.log(`[${i + 1}] ${hit.title} (${hit.source})`);
    console.log(`    URL: ${hit.url}`);
    if (hit.snippet) {
      console.log(`    Snippet: ${hit.snippet.slice(0, 160).replace(/\n/g, ' ')}...`);
    }
    console.log();
  }
}

main().catch((err) => {
  console.error('Search failed:', err.message);
  process.exit(1);
});
