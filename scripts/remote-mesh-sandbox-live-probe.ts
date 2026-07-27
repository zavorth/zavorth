#!/usr/bin/env node
import process from 'node:process';

import type { RemoteMeshSandboxLiveProbeSnapshot } from '../src/contracts/RemoteMeshSandboxLiveProbeContract.js';
import {
  MockRemoteMeshLiveProbeTransport,
  RemoteMeshSandboxLiveProbeExecutorService,
} from '../src/services/RemoteMeshSandboxLiveProbeExecutorService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const requirePass = args.includes('--require-pass');
const target = valueFor('--target') || process.env.ZAVORTH_REMOTE_MESH_TARGET || null;
const ownerTrustRequested = args.includes('--owner-trust') || process.env.ZAVORTH_REMOTE_MESH_OWNER_TRUST === '1';
const acknowledgedRisk = args.includes('--acknowledge-risk') || process.env.ZAVORTH_REMOTE_MESH_ACKNOWLEDGE_RISK === '1';
const acceptRelayRoute = args.includes('--accept-relay') || process.env.ZAVORTH_REMOTE_MESH_ACCEPT_RELAY === '1';
const armLiveProbe = args.includes('--arm-live-probe') || process.env.ZAVORTH_REMOTE_MESH_ARM_LIVE_PROBE === '1';
const executeLiveProbe = args.includes('--execute-live-probe') || process.env.ZAVORTH_REMOTE_MESH_EXECUTE_LIVE_PROBE === '1';
const useLocalTransport = args.includes('--local-transport') || process.env.ZAVORTH_REMOTE_MESH_LOCAL_LIVE_PROBE === '1';

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new RemoteMeshSandboxLiveProbeExecutorService({
    transport: useLocalTransport ? new MockRemoteMeshLiveProbeTransport() : undefined,
  });
  const snapshot = await service.buildSnapshot({
    executeLiveProbe,
    activationInput: {
      tailnetTarget: target,
      ownerTrust: {
        trusted: ownerTrustRequested,
        source: ownerTrustRequested ? 'env' : 'none',
        operatorLabel: process.env.USERNAME || process.env.USER || null,
        acknowledgedRisk,
      },
      acceptRelayRoute,
      armLiveProbe,
    },
  });
  const failures = validateSnapshot(snapshot);

  if (json) {
    process.stdout.write(`${JSON.stringify({ ...snapshot, validation: { failures } }, null, 2)}\n`);
  } else {
    process.stdout.write(render(snapshot, failures));
  }

  if (requirePass && failures.length > 0) {
    process.exitCode = 1;
  }
}

function validateSnapshot(snapshot: RemoteMeshSandboxLiveProbeSnapshot): string[] {
  const failures: string[] = [];

  if (snapshot.summary.rawCommandSerialized !== false) {
    failures.push('R5 must not serialize raw commands');
  }
  if (snapshot.summary.secretValuesSerialized !== false) {
    failures.push('R5 must not serialize secrets');
  }
  if (snapshot.summary.remoteProcessSpawned !== false) {
    failures.push('R5 first probe must not spawn a remote process');
  }
  if (snapshot.summary.filesystemMutationPerformed !== false) {
    failures.push('R5 first probe must not mutate any filesystem');
  }
  if (snapshot.execution.candidate?.rawCommand !== null && snapshot.execution.candidate !== null) {
    failures.push('R5 candidate exposed a raw command');
  }
  if (snapshot.execution.receipt.rawCommandSerialized !== false || !snapshot.execution.receipt.noSecretsSerialized) {
    failures.push('R5 receipt is not redacted/safe');
  }
  if (snapshot.status === 'executed' && snapshot.activation.status !== 'armed-ready') {
    failures.push('R5 cannot execute unless R4 is armed-ready');
  }
  if (snapshot.status === 'executed' && snapshot.execution.result?.status !== 'success') {
    failures.push('R5 executed but transport did not report success');
  }
  if (snapshot.execution.liveExecution.requested && snapshot.status !== 'executed') {
    failures.push(`R5 live probe was requested but did not execute: ${snapshot.execution.reason}`);
  }
  if (!snapshot.execution.liveExecution.requested && snapshot.summary.executionPerformed) {
    failures.push('R5 performed execution without an explicit execute request');
  }

  const serialized = JSON.stringify(snapshot);
  if (/sk-[A-Za-z0-9_-]{12,}/.test(serialized) || /xox[baprs]-[A-Za-z0-9-]{12,}/.test(serialized)) {
    failures.push('snapshot contains secret-looking values');
  }

  return failures;
}

function render(snapshot: RemoteMeshSandboxLiveProbeSnapshot, failures: string[]): string {
  const lines = [
    `Zavorth Remote Mesh Sandbox R5: ${snapshot.status}`,
    `activation=${snapshot.summary.activationStatus} transport=${snapshot.summary.transportKind}`,
    `requested=${snapshot.summary.executionRequested} performed=${snapshot.summary.executionPerformed} network=${snapshot.summary.liveNetworkCallPerformed}`,
    '',
  ];

  for (const guard of snapshot.execution.guards) {
    lines.push(`[${guard.status}] ${guard.id}: ${guard.evidence}`);
    if (guard.remediation) {
      lines.push(`  next: ${guard.remediation}`);
    }
  }

  lines.push('', `Reason: ${snapshot.execution.reason}`);

  if (snapshot.execution.result) {
    lines.push(`Result: ${snapshot.execution.result.status} exitCode=${snapshot.execution.result.exitCode}`);
  }

  if (failures.length > 0) {
    lines.push('', 'Failures:');
    failures.forEach((failure) => lines.push(`- ${failure}`));
  } else {
    lines.push('', 'Validation: passed');
  }

  return `${lines.join('\n')}\n`;
}

function valueFor(flag: string): string | null {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return args[index + 1] || null;
}
