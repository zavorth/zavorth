#!/usr/bin/env node

import { RuntimeInstallJourneyService } from '../src/services/RuntimeInstallJourneyService.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const apply = argv.includes('--apply');

  const service = new RuntimeInstallJourneyService();
  const report = await service.run({ dryRun: !apply });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  console.log('[zavorth-journey] jornada oficial de instalacao');
  console.log(`[zavorth-journey] modo: ${apply ? 'apply' : 'dry-run'}`);
  console.log(`[zavorth-journey] resumo: ${report.summary}`);
  if (report.manifest.recommendedPlan) {
    console.log('[zavorth-journey] proximo passo oficial:');
    console.log(`- ${report.manifest.recommendedPlan.primaryLabel}: ${report.manifest.recommendedPlan.primarySummary}`);
    if (report.manifest.recommendedPlan.primaryCommand) {
      console.log(`  comando: ${report.manifest.recommendedPlan.primaryCommand}`);
    }
    if (report.manifest.recommendedPlan.openTarget) {
      console.log(`  abrir: ${report.manifest.recommendedPlan.openTarget}`);
    }
  }

  for (const phase of report.phases) {
    console.log(`[zavorth-journey] [${phase.status}] ${phase.title}`);
    console.log(`  ${phase.summary}`);
    if (phase.command) {
      console.log(`  comando: ${phase.command}`);
    }
    for (const detail of phase.details.slice(0, 3)) {
      console.log(`  - ${detail}`);
    }
  }

  console.log(`[zavorth-journey] app local: ${report.manifest.local.appUrl}`);
  console.log(`[zavorth-journey] app remoto: ${report.manifest.remote.appUrl || 'nao configurado'}`);

  if (report.manifest.guides.local.length > 0) {
    console.log('[zavorth-journey] uso local:');
    for (const line of report.manifest.guides.local) {
      console.log(`- ${line}`);
    }
  }

  if (report.manifest.guides.remote.length > 0) {
    console.log('[zavorth-journey] uso remoto:');
    for (const line of report.manifest.guides.remote) {
      console.log(`- ${line}`);
    }
  }
}

main().catch((error) => {
  console.error('[zavorth-journey] falha ao montar a jornada oficial.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
