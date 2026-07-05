#!/usr/bin/env node

import { RuntimeAccessManifestService } from '../src/services/RuntimeAccessManifestService.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const service = new RuntimeAccessManifestService();
  const manifest = await service.buildManifest();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    return;
  }

  console.log('[zavorth-access] manifesto de acesso');
  console.log(`[zavorth-access] resumo: ${manifest.summary}`);
  console.log(`[zavorth-access] app local: ${manifest.local.appUrl}`);
  console.log(`[zavorth-access] remote app: ${manifest.remote.appUrl || 'not configured'}`);
  console.log(`[zavorth-access] web auth: ${manifest.auth.required ? manifest.auth.source : 'absent'} | host authorized: ${manifest.auth.authorizedHost === false ? 'no' : 'yes'}`);
  if (manifest.recommendedPlan) {
    console.log('[zavorth-access] proximo passo oficial:');
    console.log(`- ${manifest.recommendedPlan.primaryLabel}: ${manifest.recommendedPlan.primarySummary}`);
    if (manifest.recommendedPlan.primaryCommand) {
      console.log(`  comando: ${manifest.recommendedPlan.primaryCommand}`);
    }
    if (manifest.recommendedPlan.openTarget) {
      console.log(`  abrir: ${manifest.recommendedPlan.openTarget}`);
    }
    console.log(`- launcher: ${manifest.recommendedPlan.launcherRecommendation.summary}`);
    console.log(`  comando: ${manifest.recommendedPlan.launcherRecommendation.command}`);
    console.log(`- remoto oficial: ${manifest.recommendedPlan.remoteRecommendation.summary}`);
    console.log(`  comando: ${manifest.recommendedPlan.remoteRecommendation.command}`);
  }
  console.log('[zavorth-access] comandos recomendados:');
  console.log(`- bootstrap: ${manifest.commands.bootstrap}`);
  console.log(`- go: ${manifest.commands.go}`);
  console.log(`- install: ${manifest.commands.install}`);
  console.log(`- launcher: ${manifest.commands.launcher}`);
  console.log(`- startup: ${manifest.commands.startupLauncher}`);
  console.log(`- journey: ${manifest.commands.journey}`);
  console.log(`- start: ${manifest.commands.start}`);
  console.log(`- access: ${manifest.commands.access}`);
  console.log(`- remote: ${manifest.commands.remote}`);
  console.log(`- remote-go: ${manifest.commands.remoteGo}`);
  console.log(`- manifest: ${manifest.commands.manifest}`);
  console.log(`- trust: ${manifest.commands.trust}`);

  if (manifest.surfaces.length > 0) {
    console.log('[zavorth-access] superficies recomendadas:');
    for (const surface of manifest.surfaces) {
      console.log(
        `- ${surface.label}: ${surface.entry}${surface.remoteEntry ? ` | remoto: ${surface.remoteEntry}` : ''} | ${
          surface.ready ? 'ready' : 'pending'
        }`,
      );
    }
  }

  if (manifest.guides.local.length > 0) {
    console.log('[zavorth-access] uso local:');
    for (const line of manifest.guides.local) {
      console.log(`- ${line}`);
    }
  }

  if (manifest.guides.remote.length > 0) {
    console.log('[zavorth-access] uso remoto:');
    for (const line of manifest.guides.remote) {
      console.log(`- ${line}`);
    }
  }

  if (manifest.nextSteps.length > 0) {
    console.log('[zavorth-access] proximos passos:');
    for (const step of manifest.nextSteps) {
      console.log(`- ${step.title}: ${step.description}`);
    }
  }

  if (manifest.warnings.length > 0) {
    console.log('[zavorth-access] avisos:');
    for (const warning of manifest.warnings) {
      console.log(`- ${warning}`);
    }
  }
}

main().catch((error) => {
  console.error('[zavorth-access] failed to build access manifest.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
