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

  console.log('[zavorth-access] access manifest');
  console.log(`[zavorth-access] summary: ${manifest.summary}`);
  console.log(`[zavorth-access] local app: ${manifest.local.appUrl}`);
  console.log(`[zavorth-access] remote app: ${manifest.remote.appUrl || 'not configured'}`);
  console.log(`[zavorth-access] web auth: ${manifest.auth.required ? manifest.auth.source : 'absent'} | host authorized: ${manifest.auth.authorizedHost === false ? 'no' : 'yes'}`);
  if (manifest.recommendedPlan) {
    console.log('[zavorth-access] official next step:');
    console.log(`- ${manifest.recommendedPlan.primaryLabel}: ${manifest.recommendedPlan.primarySummary}`);
    if (manifest.recommendedPlan.primaryCommand) {
      console.log(`  command: ${manifest.recommendedPlan.primaryCommand}`);
    }
    if (manifest.recommendedPlan.openTarget) {
      console.log(`  open: ${manifest.recommendedPlan.openTarget}`);
    }
    console.log(`- launcher: ${manifest.recommendedPlan.launcherRecommendation.summary}`);
    console.log(`  command: ${manifest.recommendedPlan.launcherRecommendation.command}`);
    console.log(`- official remote: ${manifest.recommendedPlan.remoteRecommendation.summary}`);
    console.log(`  command: ${manifest.recommendedPlan.remoteRecommendation.command}`);
  }
  console.log('[zavorth-access] recommended commands:');
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
    console.log('[zavorth-access] recommended surfaces:');
    for (const surface of manifest.surfaces) {
      console.log(
        `- ${surface.label}: ${surface.entry}${surface.remoteEntry ? ` | remote: ${surface.remoteEntry}` : ''} | ${
          surface.ready ? 'ready' : 'pending'
        }`,
      );
    }
  }

  if (manifest.guides.local.length > 0) {
    console.log('[zavorth-access] local usage:');
    for (const line of manifest.guides.local) {
      console.log(`- ${line}`);
    }
  }

  if (manifest.guides.remote.length > 0) {
    console.log('[zavorth-access] remote usage:');
    for (const line of manifest.guides.remote) {
      console.log(`- ${line}`);
    }
  }

  if (manifest.nextSteps.length > 0) {
    console.log('[zavorth-access] next steps:');
    for (const step of manifest.nextSteps) {
      console.log(`- ${step.title}: ${step.description}`);
    }
  }

  if (manifest.warnings.length > 0) {
    console.log('[zavorth-access] warnings:');
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
