#!/usr/bin/env node
import process from 'node:process';

import type { RemoteMeshSandboxAuditTimelineSnapshot } from '../src/contracts/RemoteMeshSandboxAuditTimelineContract.js';
import { RemoteMeshSandboxAuditTimelineService } from '../src/services/RemoteMeshSandboxAuditTimelineService.js';
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
const useMockTransport = args.includes('--mock-transport') || process.env.ZAVORTH_REMOTE_MESH_MOCK_LIVE_PROBE === '1';

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const liveProbeService = new RemoteMeshSandboxLiveProbeExecutorService({
    transport: useMockTransport ? new MockRemoteMeshLiveProbeTransport() : undefined,
  });
  const snapshot = await new RemoteMeshSandboxAuditTimelineService({
    liveProbeService,
  }).buildSnapshot({
    liveProbeInput: {
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

function validateSnapshot(snapshot: RemoteMeshSandboxAuditTimelineSnapshot): string[] {
  const failures: string[] = [];

  if (snapshot.summary.entries <= 0) {
    failures.push('R6 timeline must contain at least one entry');
  }
  if (snapshot.summary.receipts <= 0) {
    failures.push('R6 timeline must expose receipts');
  }
  if (!snapshot.summary.timelineHasExecutionReceipt) {
    failures.push('R6 timeline must include the R5 execution receipt');
  }
  if (!snapshot.summary.timelineHasOperatorNextAction) {
    failures.push('R6 timeline must include an operator next action');
  }
  if (snapshot.summary.rawCommandSerialized !== false) {
    failures.push('R6 must not serialize raw commands');
  }
  if (snapshot.summary.secretValuesSerialized !== false) {
    failures.push('R6 must not serialize secrets');
  }
  if (snapshot.summary.remoteProcessSpawned !== false) {
    failures.push('R6 first audit surface must not report a remote process spawn');
  }
  if (snapshot.summary.filesystemMutationPerformed !== false || snapshot.summary.mutationPerformed !== false) {
    failures.push('R6 first audit surface must not report filesystem mutation');
  }
  if (snapshot.status === 'timeline-blocked') {
    failures.push('R6 timeline is blocked by unsafe evidence');
  }
  if (!snapshot.query.runId || !snapshot.indexes.byRunId[snapshot.query.runId]) {
    failures.push('R6 timeline must be queryable by runId');
  }
  if (snapshot.query.actionId && !snapshot.indexes.byActionId[snapshot.query.actionId]) {
    failures.push('R6 timeline actionId index is missing');
  }
  if (snapshot.query.receiptIds.some((receiptId) => !snapshot.indexes.byReceiptId[receiptId])) {
    failures.push('R6 timeline receiptId index is missing entries');
  }
  if (snapshot.timeline.some((entry) => entry.sideEffects.rawCommandSerialized !== false || entry.sideEffects.secretValuesSerialized !== false)) {
    failures.push('R6 timeline entry serialized raw command or secret evidence');
  }
  if (snapshot.receipts.some((receipt) => receipt.rawCommandSerialized !== false || !receipt.noSecretsSerialized)) {
    failures.push('R6 receipt list contains unsafe receipt evidence');
  }

  const serialized = JSON.stringify(snapshot);
  if (/sk-[A-Za-z0-9_-]{12,}/.test(serialized) || /xox[baprs]-[A-Za-z0-9-]{12,}/.test(serialized)) {
    failures.push('snapshot contains secret-looking values');
  }

  return failures;
}

function render(snapshot: RemoteMeshSandboxAuditTimelineSnapshot, failures: string[]): string {
  const lines = [
    `Zavorth Remote Mesh Sandbox R6: ${snapshot.status}`,
    `entries=${snapshot.summary.entries} receipts=${snapshot.summary.receipts} blocked=${snapshot.summary.blocked} waiting=${snapshot.summary.waiting} failed=${snapshot.summary.failed}`,
    `activation=${snapshot.summary.activationStatus} liveProbe=${snapshot.summary.liveProbeStatus} runId=${snapshot.query.runId}`,
    '',
  ];

  for (const entry of snapshot.timeline.slice(0, 12)) {
    lines.push(`${entry.sequence}. [${entry.status}] ${entry.phase}/${entry.kind}: ${entry.title}`);
    lines.push(`   ${entry.evidence}`);
  }

  if (snapshot.timeline.length > 12) {
    lines.push(`... ${snapshot.timeline.length - 12} more timeline entries`);
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
