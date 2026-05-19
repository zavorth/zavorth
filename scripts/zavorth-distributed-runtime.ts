#!/usr/bin/env node

import { ZavorthDistributedRuntimeControlPlaneService } from '../src/services/ZavorthDistributedRuntimeControlPlaneService.js';

function readFlag(argv: string[], names: string[]): string | null {
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '').trim();
    for (const name of names) {
      if (token === name) {
        return String(argv[index + 1] || '').trim() || null;
      }
      if (token.startsWith(`${name}=`)) {
        return String(token.slice(name.length + 1) || '').trim() || null;
      }
    }
  }
  return null;
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const requirePass = argv.includes('--require-pass');
  const query = readFlag(argv, ['--query', '--q']);
  const selectedId = readFlag(argv, ['--selected', '--selected-id', '--id']);
  const service = new ZavorthDistributedRuntimeControlPlaneService();
  const snapshot = await service.buildSnapshot({ selectedId, query });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }

  console.log('[zavorth-distributed-runtime] leitura consolidada da Distributed runtime');
  console.log(`[zavorth-distributed-runtime] postura: ${snapshot.summary.posture}`);
  console.log(
    `[zavorth-distributed-runtime] implementation=${snapshot.summary.implementationReady ? 'ready' : 'pending'} | infra=${snapshot.summary.infrastructureState}${snapshot.summary.infrastructureOfflineReason ? ` | ${snapshot.summary.infrastructureOfflineReason}` : ''}`,
  );
  console.log(`[zavorth-distributed-runtime] resumo: ${snapshot.narrative.operatorSummary}`);
  console.log(
    `[zavorth-distributed-runtime] channels=${snapshot.summary.readyChannels}/${snapshot.summary.totalChannels} | advanced=${snapshot.summary.readyAdvancedChannels}/${snapshot.summary.advancedChannels}`,
  );
  console.log(
    `[zavorth-distributed-runtime] fleet=${snapshot.summary.onlineNodes}/${snapshot.summary.totalNodes} | queued=${snapshot.summary.queuedInvocations} | stale=${snapshot.summary.staleQueued} | advanced-capabilities=${snapshot.summary.advancedCapabilityCoverage}/8`,
  );
  console.log(
    `[zavorth-distributed-runtime] transports=${snapshot.summary.readyTransports}/${snapshot.summary.totalTransports} | live=${snapshot.summary.liveTransports} | attention=${snapshot.summary.transportAttention}`,
  );
  console.log(
    `[zavorth-distributed-runtime] surfaces=${snapshot.summary.readySurfaces}/${snapshot.summary.totalSurfaces} | primary=${snapshot.summary.primarySurfaceReady ? 'ok' : 'pendente'} | remote=${snapshot.summary.remoteReady ? 'ok' : 'pendente'}`,
  );
  console.log(`[zavorth-distributed-runtime] proximo passo: ${snapshot.narrative.nextAction}`);

  if (snapshot.actions.length > 0) {
    console.log('[zavorth-distributed-runtime] acoes sugeridas:');
    for (const action of snapshot.actions.slice(0, 6)) {
      console.log(`- ${action.label}: ${action.command || action.reason}`);
    }
  }

  if (requirePass && snapshot.summary.posture === 'critical') {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[zavorth-distributed-runtime] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
