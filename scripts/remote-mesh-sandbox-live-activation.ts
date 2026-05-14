#!/usr/bin/env node
import process from 'node:process';

import type { RemoteMeshSandboxLiveActivationSnapshot } from '../src/contracts/RemoteMeshSandboxLiveActivationContract.js';
import { RemoteMeshSandboxLiveActivationService } from '../src/services/RemoteMeshSandboxLiveActivationService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const requirePass = args.includes('--require-pass');
const target = valueFor('--target') || process.env.ZAVORTH_REMOTE_MESH_TARGET || null;
const ownerTrustRequested = args.includes('--owner-trust') || process.env.ZAVORTH_REMOTE_MESH_OWNER_TRUST === '1';
const acknowledgedRisk = args.includes('--acknowledge-risk') || process.env.ZAVORTH_REMOTE_MESH_ACKNOWLEDGE_RISK === '1';
const acceptRelayRoute = args.includes('--accept-relay') || process.env.ZAVORTH_REMOTE_MESH_ACCEPT_RELAY === '1';
const armLiveProbe = args.includes('--arm-live-probe') || process.env.ZAVORTH_REMOTE_MESH_ARM_LIVE_PROBE === '1';

const snapshot = new RemoteMeshSandboxLiveActivationService().buildSnapshot({
  tailnetTarget: target,
  ownerTrust: {
    trusted: ownerTrustRequested,
    source: ownerTrustRequested ? 'env' : 'none',
    operatorLabel: process.env.USERNAME || process.env.USER || null,
    acknowledgedRisk,
  },
  acceptRelayRoute,
  armLiveProbe,
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

function validateSnapshot(snapshot: RemoteMeshSandboxLiveActivationSnapshot): string[] {
  const failures: string[] = [];

  if (snapshot.summary.liveExecutionPerformed !== false) {
    failures.push('R4 must not perform the live execution itself');
  }
  if (snapshot.summary.liveNetworkCallPerformed !== false) {
    failures.push('R4 must not perform live network calls while building the gate');
  }
  if (snapshot.summary.remoteProcessSpawned !== false) {
    failures.push('R4 must not spawn remote processes while building the gate');
  }
  if (snapshot.summary.filesystemMutationPerformed !== false) {
    failures.push('R4 must not mutate filesystem while building the gate');
  }
  if (snapshot.summary.rawCommandSerialized !== false) {
    failures.push('R4 must not serialize raw commands');
  }
  if (snapshot.summary.secretValuesSerialized !== false) {
    failures.push('R4 must not serialize secrets');
  }
  if (snapshot.ownerTrust.mutableHostAccessGranted !== false) {
    failures.push('R4 gate must not grant mutable host access');
  }
  if (snapshot.plan.candidate?.rawCommand !== null && snapshot.plan.candidate !== null) {
    failures.push('R4 candidate exposed a raw command');
  }
  if (snapshot.plan.adapterBinding?.preview.rawCommand !== null && snapshot.plan.adapterBinding !== null) {
    failures.push('R4 adapter preview exposed a raw command');
  }
  if (snapshot.plan.receipt.rawCommandSerialized !== false || !snapshot.plan.receipt.noSecretsSerialized) {
    failures.push('R4 receipt is not redacted/safe');
  }

  const allGatesPassed = snapshot.plan.gates.every((gate) => gate.status === 'passed');
  if (snapshot.status === 'armed-ready' && !allGatesPassed) {
    failures.push('R4 cannot be armed-ready unless every gate passed');
  }
  if (snapshot.summary.liveExecutionAuthorized && snapshot.status !== 'armed-ready') {
    failures.push('R4 cannot authorize live execution unless status is armed-ready');
  }

  const serialized = JSON.stringify(snapshot);
  if (/sk-[A-Za-z0-9_-]{12,}/.test(serialized) || /xox[baprs]-[A-Za-z0-9-]{12,}/.test(serialized)) {
    failures.push('snapshot contains secret-looking values');
  }

  return failures;
}

function render(snapshot: RemoteMeshSandboxLiveActivationSnapshot, failures: string[]): string {
  const lines = [
    `Zavorth Remote Mesh Sandbox R4: ${snapshot.status}`,
    `gates=${snapshot.summary.gates} passed=${snapshot.summary.passed} waiting=${snapshot.summary.waiting} blocked=${snapshot.summary.blocked}`,
    `ownerTrusted=${snapshot.summary.ownerTrusted} targetConfigured=${snapshot.summary.targetConfigured} authorized=${snapshot.summary.liveExecutionAuthorized}`,
    '',
  ];

  for (const gate of snapshot.plan.gates) {
    lines.push(`[${gate.status}] ${gate.id}: ${gate.evidence}`);
    if (gate.remediation) {
      lines.push(`  next: ${gate.remediation}`);
    }
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
