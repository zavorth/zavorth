#!/usr/bin/env node

import { runZavorthCli } from '../src/cli/ZavorthCli.js';

async function main(): Promise<void> {
  const exitCode = await runZavorthCli(process.argv.slice(2));
  process.exitCode = exitCode;
}

main().catch((error: unknown) => {
  console.error(`[zavorth-cli] error: ${error?.message || String(error)}`);
  process.exitCode = 1;
});
