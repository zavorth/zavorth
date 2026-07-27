#!/usr/bin/env node

import { RuntimeAccessLaunchService } from '../src/runtime/access/RuntimeAccessLaunchService.js';
import {
  RuntimeOfficialRemoteAccessService,
  type RuntimeOfficialRemoteAccessAction,
  type RuntimeOfficialRemoteRolloutCandidateId,
} from '../src/runtime/access/RuntimeOfficialRemoteAccessService.js';

function resolveAction(argv: string[]): RuntimeOfficialRemoteAccessAction | null {
  if (argv.includes('--go')) {
    return 'go';
  }
  if (argv.includes('--apply')) {
    return 'apply';
  }
  if (argv.includes('--verify')) {
    return 'verify';
  }
  if (argv.includes('--rollback')) {
    return 'rollback';
  }
  return null;
}

function resolveProvider(argv: string[]): RuntimeOfficialRemoteRolloutCandidateId | null {
  const index = argv.findIndex((entry) => entry === '--provider');
  if (index >= 0) {
    const value = String(argv[index + 1] || '').trim().toLowerCase();
    if (value === 'local-cloudflare' || value === 'oracle-cloudflare') {
      return value;
    }
  }
  return null;
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const openRemote = argv.includes('--open');
  const action = resolveAction(argv);
  const provider = resolveProvider(argv);
  const service = new RuntimeOfficialRemoteAccessService();
  const report = action
    ? await service.runAction(action, {
      provider,
      autoTrustLocal: argv.includes('--trust-local'),
      dryRun: argv.includes('--dry-run'),
    })
    : await service.inspect({
      autoTrustLocal: argv.includes('--trust-local'),
      dryRun: argv.includes('--dry-run'),
    });
  const launchService = new RuntimeAccessLaunchService();
  const launchSelection = openRemote
    ? launchService.selectTarget(
      {
        local: {
          ready: report.official.local.ready,
          appUrl: report.official.local.appUrl,
        },
        remote: {
          ready: report.remote.ready,
          appUrl: report.remote.appUrl,
        },
      },
      'remote',
    )
    : null;
  const launchResult = launchSelection
    ? await launchService.openSelected(launchSelection)
    : null;

  if (asJson) {
    process.stdout.write(`${JSON.stringify({ ...report, launch: launchResult }, null, 2)}\n`);
    return;
  }

  console.log('[zavorth-remote] path remote oficial');
  if (action) {
    console.log(`[zavorth-remote] action: ${action}${provider ? ` (${provider})` : ''}`);
  }
  console.log(`[zavorth-remote] summary: ${report.summary}`);
  console.log(`[zavorth-remote] remote app: ${report.remote.appUrl || 'not configured'}`);
  console.log(`[zavorth-remote] status: ${report.remote.ready ? 'ready' : 'pending'}`);
  console.log(`[zavorth-remote] rollout active: ${report.rollout.activeId || 'nenhum'}`);
  console.log(`[zavorth-remote] estado guiado: ${report.state.status}`);
  if (launchSelection) {
    console.log(`[zavorth-remote] open: ${launchSelection.url || 'not available'} | ${launchSelection.reason}`);
    if (launchResult?.attempted) {
      console.log(`[zavorth-remote] launch: ${launchResult.ok ? 'ok' : 'failed'}${launchResult.error ? ` (${launchResult.error})` : ''}`);
    }
  }

  if (report.remote.issues.length > 0) {
    console.log('[zavorth-remote] bloqueios current:');
    for (const issue of report.remote.issues) {
      console.log(`- ${issue}`);
    }
  }

  if (report.rollout.candidates.length > 0) {
    console.log('[zavorth-remote] rollouts sugeridos:');
    for (const candidate of report.rollout.candidates) {
      const recommendation = candidate.id === report.rollout.recommendedId ? ' | recomendado' : '';
      console.log(
        `- ${candidate.label}: ${candidate.ready ? 'ready' : 'pending'} (${candidate.doneSteps}/${candidate.totalSteps})${recommendation}`,
      );
      console.log(`  comando: ${candidate.command}`);
      console.log(`  guia: ${candidate.guide}`);
      console.log(`  summary: ${candidate.summary}`);
      for (const highlight of candidate.pendingHighlights) {
        console.log(`  pendencia: ${highlight}`);
      }
    }
  }

  if (report.nextSteps.length > 0) {
    console.log('[zavorth-remote] next steps:');
    for (const step of report.nextSteps) {
      console.log(`- ${step}`);
    }
  }
}

main().catch((error) => {
  console.error('[zavorth-remote] failure ao validate o path remote oficial.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
