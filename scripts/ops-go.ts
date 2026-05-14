#!/usr/bin/env node
import {
  executeOfficialInstallFlow,
  formatOfficialInstallReport,
  parseOfficialInstallArgs,
} from './lib/runtime-official-install.js';
import {
  formatZavorthGoFailure,
  formatZavorthGoReport,
} from '../src/cli/ZavorthCliGoRenderer.js';

const cliArgs = parseOfficialInstallArgs(process.argv.slice(2));

async function main() {
  const args = cliArgs;

  const { report, launcher, appOpen } = await executeOfficialInstallFlow(args, {
    trustLocal: true,
    launcher: true,
    openBest: true,
  });

  if (args.json) {
    process.stdout.write(`${JSON.stringify({ report, launcher, appOpen }, null, 2)}\n`);
    if (!args.dryRun && !report.local.ready) {
      process.exitCode = 1;
    }
    return;
  }

  console.log(formatZavorthGoReport(report, { launcher, appOpen, dryRun: args.dryRun }));

  if (!args.dryRun && !report.local.ready) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  if (cliArgs.json) {
    console.error('[zavorth-go] falha ao executar o atalho oficial do Zavorth.');
    console.error(error instanceof Error ? error.message : String(error));
  } else {
    console.error(formatZavorthGoFailure(error));
  }
  process.exitCode = 1;
});
