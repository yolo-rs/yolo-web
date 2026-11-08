#!/usr/bin/env bun
// SPDX-License-Identifier: Apache-2.0
import { crawler, GOOGLE_CRAWL_TARGETS } from "./index.ts";

console.log(
  `[Google-Bun-Crawler] Starting 24/7 autonomous crawl of ${GOOGLE_CRAWL_TARGETS.length} targets...`,
);
const results = await crawler.runFullCycle();
console.table(results);
