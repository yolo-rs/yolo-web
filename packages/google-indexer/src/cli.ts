#!/usr/bin/env bun
// SPDX-License-Identifier: Apache-2.0
import { indexer } from "./index.ts";

const query = process.argv[2] || "google";
console.log(`[Google-Bun-Indexer] Searching index for: "${query}"...`);
const results = indexer.search(query);
console.table(results);
