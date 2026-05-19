#!/usr/bin/env node
import process from 'node:process';

import type { RemoteMeshSandboxReadinessSnapshot } from '../src/contracts/RemoteMeshSandboxReadinessContract.js';
import type { RemoteMeshSandboxScopedMcpTransportSnapshot } from '../src/contracts/RemoteMeshSandboxScopedMcpTransportContract.js';
import { RemoteMeshSandboxScopedMcpStatusTransportService } from '../src/services/RemoteMeshSandboxScopedMcpStatusTransportService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const requirePass = args.includes('--require-pass');
const endpoint = valueFor('--endpoint') || process.env.ZAVORTH_REMOTE_MESH_MCP_ENDPOINT || null;
const target = valueFor('--target') || process.env.ZAVORTH_REMOTE_MESH_TARGET || null;
const ownerTrustRequested = args.includes('--owner-trust') || process.env.ZAVORTH_REMOTE_MESH_OWNER_TRUST === '1';
const acknowledgedRisk = args.includes('--acknowledge-risk') || process.env.ZAVORTH_REMOTE_MESH_ACKNOWLEDGE_RISK === '1';
const acceptRelayRoute = args.includes('--accept-relay') || process.env.ZAVORTH_REMOTE_MESH_ACCEPT_RELAY === '1';
const armLiveProbe = args.includes('--arm-live-probe') || process.env.ZAVORTH_REMOTE_MESH_ARM_LIVE_PROBE === '1';
const executeLiveProbe = args.includes('--execute-live-probe') || process.env.ZAVORTH_REMOTE_MESH_EXECUTE_LIVE_PROBE === '1';
const allowTailnetHttp = args.includes('--allow-tailnet-http') || process.env.ZAVORTH_REMOTE_MESH_ALLOW_TAILNET_HTTP === '1';
const authHeaderName = args.includes('--x-zavorth-token')
  ? 'X-Zavorth-Remote-Token' as const
  : 'Authorization' as const;

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const snapshot = await new RemoteMeshSandboxScopedMcpStatusTransportService({
    endpointUrl: endpoint,
    authToken: process.env.ZAVORTH_REMOTE_MESH_MCP_TOKEN || null,
    tokenSource: process.env.ZAVORTH_REMOTE_MESH_MCP_TOKEN ? 'env' : 'none',
    authHeaderName,
    allowInsecureHttpForTailnet: allowTailnetHttp,
  }).buildSnapshot({
    executeLiveProbe,
    target,
    ownerTrust: ownerTrustRequested,
    acknowledgedRisk,
    acceptRelayRoute,
    armLiveProbe,
    readinessSnapshot: readinessFromEnv(target),
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

function validateSnapshot(snapshot: RemoteMeshSandboxScopedMcpTransportSnapshot): string[] {
  const failures: string[] = [];

  if (snapshot.summary.rawCommandSerialized !== false) {
    failures.push('R7 must not serialize raw commands');
  }
  if (snapshot.summary.secretValuesSerialized !== false) {
    failures.push('R7 must not serialize secrets');
  }
  if (snapshot.summary.remoteProcessSpawned !== false) {
    failures.push('R7 status transport must not spawn remote processes');
  }
  if (snapshot.summary.filesystemMutationPerformed !== false || snapshot.summary.mutationPerformed !== false) {
    failures.push('R7 status transport must not mutate filesystems');
  }
  if (snapshot.status === 'blocked') {
    failures.push('R7 scoped MCP transport is blocked by unsafe configuration');
  }
  if (snapshot.summary.executionRequested && !snapshot.summary.executionPerformed) {
    failures.push('R7 live probe was requested but did not produce execution evidence');
  }
  if (snapshot.summary.executionPerformed && snapshot.auditTimeline.source.liveProbeStatus !== 'executed') {
    failures.push(`R7 execution did not finish successfully: ${snapshot.auditTimeline.source.liveProbeStatus}`);
  }
  if (snapshot.config.queryKeysRedacted.some((key) => /token|secret|key|auth|credential/i.test(key))) {
    failures.push('R7 endpoint contains credential-like query keys');
  }
  if (snapshot.payloadPreview.toolName !== 'notebook.get_status' || snapshot.payloadPreview.rawCommand !== null) {
    failures.push('R7 payload is not locked to notebook.get_status');
  }
  if (snapshot.auditTimeline.timeline.some((entry) => entry.sideEffects.rawCommandSerialized !== false || entry.sideEffects.secretValuesSerialized !== false)) {
    failures.push('R7 audit timeline serialized unsafe evidence');
  }

  const serialized = JSON.stringify(snapshot);
  if (/sk-[A-Za-z0-9_-]{12,}/.test(serialized) || /xox[baprs]-[A-Za-z0-9-]{12,}/.test(serialized)) {
    failures.push('snapshot contains secret-looking values');
  }

  return failures;
}

function render(snapshot: RemoteMeshSandboxScopedMcpTransportSnapshot, failures: string[]): string {
  const lines = [
    `Zavorth Remote Mesh Sandbox R7: ${snapshot.status}`,
    `endpoint=${snapshot.summary.endpointConfigured} auth=${snapshot.summary.authTokenConfigured} ready=${snapshot.summary.transportReady}`,
    `requested=${snapshot.summary.executionRequested} performed=${snapshot.summary.executionPerformed} network=${snapshot.summary.liveNetworkCallPerformed}`,
    '',
  ];

  for (const guard of snapshot.guards) {
    lines.push(`[${guard.status}] ${guard.id}: ${guard.evidence}`);
    if (guard.remediation) {
      lines.push(`  next: ${guard.remediation}`);
    }
  }

  lines.push('', `Audit: ${snapshot.auditTimeline.status} entries=${snapshot.auditTimeline.summary.entries}`);

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

function readinessFromEnv(target: string | null): RemoteMeshSandboxReadinessSnapshot | undefined {
  if (!target || process.env.ZAVORTH_REMOTE_MESH_ASSUME_READY !== '1') {
    return undefined;
  }
  return {
    generatedAt: new Date().toISOString(),
    contractVersion: '2026-05-05.remote-mesh-sandbox-r0',
    stage: 'R0',
    status: 'ready',
    target: {
      nodeId: target,
      expectedTailnetName: null,
      expectedPorts: [22],
    },
    summary: {
      checks: 1,
      passed: 1,
      warnings: 0,
      missing: 0,
      blocked: 0,
      notRequired: 0,
      directRouteObserved: true,
      relayRouteObserved: false,
      remoteMutationPerformed: false,
      remoteExecutionRequiredToBuildSnapshot: false,
      freeformShellAllowed: false,
      secretValuesSerialized: false,
    },
    checks: [],
    receipts: [],
    policy: {
      allowRemoteMutationDuringReadiness: false,
      allowFreeformShell: false,
      allowUnauthenticatedMcp: false,
      allowDockerGroupPrivilege: false,
      requireTailscale: false,
      requireSshClient: false,
      requireTermuxForMobileNode: false,
      requireProotDistroForMobileNode: false,
      requireDockerRootlessWhenDockerAvailable: false,
    },
    nextActions: [],
    commands: {
      readiness: 'npx tsx scripts/remote-mesh-sandbox-readiness.ts --json',
      readinessNoLiveProbes: 'npx tsx scripts/remote-mesh-sandbox-readiness.ts --json --no-live-probes',
      focusedTests: 'npx jest tests/services/RemoteMeshSandboxReadinessService.test.ts --runInBand',
      nextStage: 'R1 - Remote Mesh and Sandbox Contracts',
    },
  };
}
