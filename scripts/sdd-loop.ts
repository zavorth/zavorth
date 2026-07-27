#!/usr/bin/env node

import { runSddCli } from '../src/cli/SddCli.js';

async function main() {
  const exitCode = await runSddCli(process.argv.slice(2));
  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error('[sdd-loop] failure ao operar o loop SDD.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
