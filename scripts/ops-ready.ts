#!/usr/bin/env node

import {
  executeOfficialInstallFlow,
  parseOfficialInstallArgs,
  printOfficialInstallReport,
} from './lib/runtime-official-install.js';

async function main() {
  const args = parseOfficialInstallArgs(process.argv.slice(2));
  const { report, launcher, appOpen } = await executeOfficialInstallFlow(args, {
    allowReadonly: true,
    autoInstallRecommendedLauncher: false,
    requestedLauncherMode: 'startup',
  });
  const canonicalCommand = report.manifest.commands.go;

  if (args.json) {
    process.stdout.write(`${JSON.stringify({ ...report, launcher, launch: appOpen, canonicalCommand }, null, 2)}\n`);
    return;
  }

  printOfficialInstallReport(report, '[zavorth-ready]');
  console.log(`[zavorth-ready] atalho oficial: ${canonicalCommand}`);
  if (args.launcher) {
    console.log(
      `[zavorth-ready] launcher startup: ${
        launcher.applied
          ? 'instalado'
          : (launcher.skipped
            ? 'ignorado'
            : `falhou${launcher.error ? ` (${launcher.error})` : ''}`)
      }`,
    );
  }

  if (!appOpen.skipped) {
    console.log(
      `[zavorth-ready] abrir app: ${
        appOpen.opened
          ? `ok (${appOpen.targetUrl})`
          : `falhou${appOpen.error ? ` (${appOpen.error})` : ''}`
      }`,
    );
  }

  if (report.remote.appProbe) {
    console.log(`[zavorth-ready] probe app remoto: ${report.remote.appProbe.ok ? 'ok' : 'falhou'} -> ${report.remote.appProbe.targetUrl}`);
  }
  if (report.remote.authProbe) {
    console.log(`[zavorth-ready] probe auth remoto: ${report.remote.authProbe.ok ? 'ok' : 'falhou'} -> ${report.remote.authProbe.targetUrl}`);
  }
}

main().catch((error) => {
  console.error('[zavorth-ready] falha ao preparar o acesso oficial do Zavorth.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
