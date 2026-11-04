#!/usr/bin/env bun
import { getOptions } from './config.js';
import { stdioServer, httpServer } from './protocols/index.js';

async function main() {
  const options = await getOptions();

  if (!options) {
    throw new Error('Invalid configuration');
  }

  // default to stdio server unless http is explicitly requested
  if (options.transport === 'http') {
    httpServer.start();
    return;
  }

  await stdioServer.start();
}

main().catch((error) => {
  console.error(error);
  throw error;
});
