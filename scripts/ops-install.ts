#!/usr/bin/env node
import {
  executeOfficialInstallFlow,
  parseOfficialInstallArgs,
  printOfficialInstallReport,
} from './lib/runtime-official-install.js';

async function main() {
  const args = parseOfficialInstallArgs(process.argv.slice(2));
  const { report, launcher, appOpen } = await executeOfficialInstallFlow(args);
  const canonicalCommand = report.manifest.commands.go;

  if (args.json) {
    process.stdout.write(`${JSON.stringify({ report, launcher, appOpen, canonicalCommand }, null, 2)}\n`);
    if (!args.dryRun && !report.local.ready) {
      process.exitCode = 1;
    }
    return;
  }

  printOfficialInstallReport(report);
  console.log(`[zavorth-install] shortcut oficial: ${canonicalCommand}`);

  if (!launcher.skipped) {
    console.log(
      `[zavorth-install] launcher: ${
        launcher.applied ? 'installed'
          : `failed${launcher.error ? ` (${launcher.error})` : ''}`
      }`,
    );
  }

  if (!appOpen.skipped) {
    console.log(
      `[zavorth-install] abrir app: ${
        appOpen.opened ? `ok (${appOpen.targetUrl})`
          : `failed${appOpen.error ? ` (${appOpen.error})` : ''}`
      }`,
    );
  }

  if (!args.dryRun && !report.local.ready) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[zavorth-install] failure ao run o path oficial de installation.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
