#!/usr/bin/env node

import { ZavorthFederatedMeshControlPlaneService } from '@zavorth/mesh/ZavorthFederatedMeshControlPlaneService.js';
import type {
  FederatedMeshCommandScope,
  FederatedMeshProfile,
  FederatedMeshTrust,
} from '@zavorth/mesh/ZavorthFederatedMeshControlPlaneService.js';
import type { NodeMeshCapabilityId } from '../src/contracts/NodeMeshContract.js';

function readFlag(argv: string[], names: string[]): string | null {
  for (const name of names) {
    const inline = argv.find((entry) => entry.startsWith(`${name}=`));
    if (inline) {
      return inline.split('=').slice(1).join('=').trim() || null;
    }
    const index = argv.findIndex((entry) => entry === name);
    if (index >= 0 && argv[index + 1]) {
      return String(argv[index + 1]).trim() || null;
    }
  }
  return null;
}

function readList(argv: string[], names: string[]): string[] {
  const raw = readFlag(argv, names);
  if (!raw) {
    return [];
  }
  return raw.split(',').map((entry) => entry.trim()).filter(Boolean);
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
  const service = new ZavorthFederatedMeshControlPlaneService();
  const originalConsole = {
    log: console.log,
    info: console.info,
  };
  if (asJson) {
    console.log = () => undefined;
    console.info = () => undefined;
  }

  const nodeId = readFlag(argv, ['--node', '--node-id']);
  const routeCapability = readFlag(argv, ['--route', '--capability']);

  if (argv.includes('--pair')) {
    const result = service.pairNode({
      nodeId,
      label: readFlag(argv, ['--label']),
      profile: readFlag(argv, ['--profile']) as FederatedMeshProfile | null,
      trust: readFlag(argv, ['--trust']) as FederatedMeshTrust | null,
      capabilityIds: readList(argv, ['--capabilities', '--caps']) as NodeMeshCapabilityId[],
      commandScopes: readList(argv, ['--scopes']) as FederatedMeshCommandScope[],
      requestedBy: 'cli-operator',
      sourceSurface: 'cli',
      hostHints: {
        hostname: readFlag(argv, ['--host', '--hostname']),
        networkType: readFlag(argv, ['--network']),
        batteryLevel: Number(readFlag(argv, ['--battery']) || Number.NaN),
      },
    });
    if (asJson) {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      console.log('[federated-mesh] pair oficial');
      console.log(`[federated-mesh] node=${result.node.id} | profile=${result.node.profile} | trust=${result.node.trust}`);
      console.log(`[federated-mesh] resumo: ${result.summary}`);
      console.log(`[federated-mesh] bootstrap: ${result.bootstrapCommand || 'n/d'}`);
    }
    return;
  }

  if (argv.includes('--heartbeat')) {
    const result = service.recordHeartbeat({
      nodeId: nodeId || '',
      status: readFlag(argv, ['--status']) as any,
      capabilityIds: readList(argv, ['--capabilities', '--caps']) as NodeMeshCapabilityId[],
      latencyMs: Number(readFlag(argv, ['--latency', '--latency-ms']) || Number.NaN),
      costScore: Number(readFlag(argv, ['--cost', '--cost-score']) || Number.NaN),
      batteryPercent: Number(readFlag(argv, ['--battery']) || Number.NaN),
      networkType: readFlag(argv, ['--network']),
      trust: readFlag(argv, ['--trust']) as FederatedMeshTrust | null,
      commandScopes: readList(argv, ['--scopes']) as FederatedMeshCommandScope[],
    });
    if (asJson) {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      console.log('[federated-mesh] heartbeat oficial');
      console.log(`[federated-mesh] status=${result.status}`);
      console.log(`[federated-mesh] resumo: ${result.summary}`);
    }
    if (result.status !== 'accepted') {
      process.exitCode = 1;
    }
    return;
  }

  const revokeNodeId = readFlag(argv, ['--revoke']);
  if (revokeNodeId) {
    const result = service.revokeNode({
      nodeId: revokeNodeId,
      reason: readFlag(argv, ['--reason']),
    });
    if (asJson) {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      console.log('[federated-mesh] revogacao oficial');
      console.log(`[federated-mesh] status=${result.status}`);
      console.log(`[federated-mesh] resumo: ${result.summary}`);
    }
    if (result.status !== 'revoked') {
      process.exitCode = 1;
    }
    return;
  }

  if (routeCapability) {
    const result = await service.routeCapability({
      capabilityId: routeCapability,
      action: readFlag(argv, ['--action']),
      mutable: argv.includes('--mutable') ? true : argv.includes('--read-only') ? false : null,
      persist: argv.includes('--queue') || argv.includes('--persist'),
      requestedBy: 'cli-operator',
      sourceSurface: 'cli',
      preferProfile: readFlag(argv, ['--prefer-profile']) as FederatedMeshProfile | null,
    });
    if (asJson) {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      console.log('[federated-mesh] route planner oficial');
      console.log(`[federated-mesh] status=${result.status} | capability=${result.capabilityId} | mutable=${result.mutable ? 'yes' : 'no'}`);
      console.log(`[federated-mesh] selecionado=${result.selectedNode?.id || 'n/d'} | profile=${result.selectedNode?.profile || 'n/d'}`);
      for (const reason of result.reasons) {
        console.log(`- ${reason}`);
      }
    }
    if (requirePass && (result.status === 'blocked' || result.status === 'dormant')) {
      process.exitCode = 1;
    }
    return;
  }

  const snapshot = await service.buildSnapshot({
    routeCapabilityId: readFlag(argv, ['--preview-route']) as NodeMeshCapabilityId | null,
    selectedNodeId: nodeId,
  });
  if (asJson) {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    console.log('[federated-mesh] leitura oficial da Etapa 21');
    console.log(`[federated-mesh] postura=${snapshot.summary.posture} | infra=${snapshot.summary.infrastructureState} | implementation=${snapshot.summary.implementationReady ? 'ready' : 'pending'}`);
    console.log(`[federated-mesh] nodes=${snapshot.summary.onlineNodes}/${snapshot.summary.remoteNodes} online | revoked=${snapshot.summary.revokedNodes} | capabilities=${snapshot.summary.routeableCapabilities}/${snapshot.summary.capabilityCount}`);
    console.log(`[federated-mesh] runtime pesado iniciado=${snapshot.summary.heavyRuntimesStarted ? 'yes' : 'no'}`);
    console.log(`[federated-mesh] resumo: ${snapshot.narrative.operatorSummary}`);
    console.log(`[federated-mesh] proximo passo: ${snapshot.narrative.nextAction}`);
    if (snapshot.actions.length > 0) {
      console.log('[federated-mesh] acoes sugeridas:');
      for (const action of snapshot.actions.slice(0, 5)) {
        console.log(`- ${action.label}: ${action.command}`);
      }
    }
  }
  if (requirePass && snapshot.summary.posture === 'critical') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[federated-mesh] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
