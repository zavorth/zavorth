#!/usr/bin/env node
import { requireAutopilotCapabilityId } from '../src/services/CapabilityAutopilotSelection.js';
import { CapabilityAutopilotMemoryReplayService } from '../src/services/CapabilityAutopilotMemoryReplayService.js';
import { CapabilityAutopilotReceiptService } from '../src/services/CapabilityAutopilotReceiptService.js';
import type {
  CapabilityAutopilotAudience,
  CapabilityAutopilotSurface,
  CapabilityMemoryRecord,
  CapabilityReplayFrame,
  OriginalIntentEnvelope,
} from '../src/contracts/CapabilityAutopilotContract.js';

type CapabilityAutopilotMemoryCheck = {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  title: string;
  reason: string;
  evidence: string[];
};

type CapabilityAutopilotMemorySnapshot = {
  stage: '64';
  surface: 'capability-autopilot-memory';
  generatedAt: string;
  capabilityId: string;
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  memory: CapabilityMemoryRecord;
  replay: CapabilityReplayFrame;
  aggregate: ReturnType<CapabilityAutopilotMemoryReplayService['summarizeRecords']>;
  checks: CapabilityAutopilotMemoryCheck[];
  nextRecommendedStage: {
    stage: '65';
    title: string;
    reason: string;
  };
};

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const capabilityId = (() => { try { return requireAutopilotCapabilityId(typeof argv !== 'undefined' ? argv : process.argv.slice(2)); } catch (error) { process.stderr.write('[' + 'capability-autopilot-memory' + '] ' + (error instanceof Error ? error.message : String(error)) + '\n'); process.exit(1); return ''; } })();
const surface = (readArg('--surface=') || 'cli') as CapabilityAutopilotSurface;
const audience = (asJson ? 'technical_operator' : 'everyday_user') as CapabilityAutopilotAudience;
const rawIntentProbe = 'GATE64-RAW-INTENT-MUST-NOT-BE-STORED';
const rawWorkspaceProbe = 'C:/private/GATE64-RAW-WORKSPACE-MUST-NOT-BE-STORED';

main().catch((error) => {
  process.stderr.write(`[capability-autopilot-memory] failure: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const resumeIntent = buildFixtureIntent();
  const receiptService = new CapabilityAutopilotReceiptService();
  const receipt = await receiptService.buildCapabilityReceipt(capabilityId, {
    surface,
    audience,
    resumeIntent,
  });
  const memoryService = new CapabilityAutopilotMemoryReplayService();
  const memory = memoryService.buildMemoryRecord({
    receipt,
    rawIntentText: resumeIntent.rawText,
    workspace: resumeIntent.workspace,
  });
  const replay = memoryService.buildReplayFrame(memory);
  const aggregate = memoryService.summarizeRecords([memory]);
  const snapshot = buildSnapshot(memory, replay, aggregate);

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderReport(snapshot)}\n`);
  }

  if (requirePass && !snapshot.summary.ok) {
    process.exitCode = 1;
  }
}

function readArg(prefix: string): string | null {
  const found = argv.find((arg) => arg.startsWith(prefix));
  const value = found ? found.slice(prefix.length).trim() : '';
  return value || null;
}

function buildFixtureIntent(): OriginalIntentEnvelope {
  return {
    intentId: 'gate-64-fixture-intent',
    createdAt: new Date().toISOString(),
    surface,
    audience,
    userId: 'gate-64-gate',
    sessionId: 'gate-64-session',
    taskId: 'gate-64-task',
    rawText: rawIntentProbe,
    normalizedText: 'gate 64 redacted memory probe',
    requestedCapabilityId: capabilityId,
    requestedExecutorName: capabilityId.replace(/^executor-/, ''),
    workspace: rawWorkspaceProbe,
    metadata: {
      fixture: true,
      stage: 'capability-autopilot-memory-replay',
    },
  };
}

function buildSnapshot(
  memory: CapabilityMemoryRecord,
  replay: CapabilityReplayFrame,
  aggregate: ReturnType<CapabilityAutopilotMemoryReplayService['summarizeRecords']>,
): CapabilityAutopilotMemorySnapshot {
  const checks = buildChecks(memory, replay, aggregate);
  const failed = checks.filter((check) => check.status === 'fail').length;
  const warnings = checks.filter((check) => check.status === 'warn').length;
  const passed = checks.filter((check) => check.status === 'pass').length;

  return {
    stage: '64',
    surface: 'capability-autopilot-memory',
    generatedAt: new Date().toISOString(),
    capabilityId: memory.capabilityId,
    status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
    summary: {
      ok: failed === 0,
      passed,
      warnings,
      failed,
    },
    memory,
    replay,
    aggregate,
    checks,
    nextRecommendedStage: {
      stage: '65',
      title: 'Provider And Integration Expansion',
      reason:
        'After creating redacted memory and safe replay, the next step is to expand providers/adapters without losing safe degradation.',
    },
  };
}

function buildChecks(
  memory: CapabilityMemoryRecord,
  replay: CapabilityReplayFrame,
  aggregate: ReturnType<CapabilityAutopilotMemoryReplayService['summarizeRecords']>,
): CapabilityAutopilotMemoryCheck[] {
  const serialized = JSON.stringify({ memory, replay, aggregate });

  return [
    check(
      'capability-autopilot-memory:privacy-contract',
      'privacy contract',
      memory.privacy.redacted && !memory.privacy.rawIntentStored && !memory.privacy.rawWorkspaceStored ? 'pass' : 'fail',
      'Capability memory stores fingerprints and hashes, not raw payload.',
      [
        `redacted=${String(memory.privacy.redacted)}`,
        `rawIntentStored=${String(memory.privacy.rawIntentStored)}`,
        `rawWorkspaceStored=${String(memory.privacy.rawWorkspaceStored)}`,
      ],
    ),
    check(
      'capability-autopilot-memory:no-raw-payload',
      'no serialized raw payload',
      !serialized.includes(rawIntentProbe) &&
        !serialized.includes(rawWorkspaceProbe) &&
        !serialized.includes('rawText') &&
        !serialized.includes('normalizedText') ? 'pass' : 'fail',
      'Public gate snapshot must not leak original text, raw workspace or raw keys.',
      [
        `containsIntentProbe=${String(serialized.includes(rawIntentProbe))}`,
        `containsWorkspaceProbe=${String(serialized.includes(rawWorkspaceProbe))}`,
        `containsRawKeys=${String(serialized.includes('rawText') || serialized.includes('normalizedText'))}`,
      ],
    ),
    check(
      'capability-autopilot-memory:fingerprints',
      'hashes and fingerprints',
      Boolean(memory.intentFingerprint && memory.workspaceHash) ? 'pass' : 'fail',
      'Intent and workspace need to become deterministic fingerprint/hash for future learning.',
      [
        `intentFingerprint=${memory.intentFingerprint ? memory.intentFingerprint.slice(0, 12) : '<absent>'}`,
        `workspaceHash=${memory.workspaceHash ? memory.workspaceHash.slice(0, 12) : '<absent>'}`,
      ],
    ),
    check(
      'capability-autopilot-memory:signals',
      'operational signals',
      memory.signals.length > 0 ? 'pass' : 'fail',
      'Replay learning needs sufficient operational signals to explain the recommendation.',
      memory.signals.map((signal) => `${signal.kind}:${signal.weight}`),
    ),
    check(
      'capability-autopilot-memory:replay-frame',
      'coherent replay frame',
      replay.sourceMemoryId === memory.memoryId && replay.replayable === memory.replayable ? 'pass' : 'fail',
      'The replay frame needs to point to the source memory and preserve the replay decision.',
      [
        `sourceMemoryId=${replay.sourceMemoryId}`,
        `memoryId=${memory.memoryId}`,
        `replayable=${String(replay.replayable)}`,
      ],
    ),
    check(
      'capability-autopilot-memory:aggregate',
      'aggregate without sensitive payload',
      aggregate.totalRecords === 1 && aggregate.replayableCount === (memory.replayable ? 1 : 0) ? 'pass' : 'fail',
      'Aggregated summary should count outcomes without depending on raw payload.',
      [
        `totalRecords=${aggregate.totalRecords}`,
        `replayableCount=${aggregate.replayableCount}`,
        `lastRecommendedAction=${aggregate.lastRecommendedAction || '<absent>'}`,
      ],
    ),
  ];
}

function check(
  id: string,
  title: string,
  status: CapabilityAutopilotMemoryCheck['status'],
  reason: string,
  evidence: string[] = [],
): CapabilityAutopilotMemoryCheck {
  return {
    id,
    title,
    status,
    reason,
    evidence,
  };
}

function renderReport(snapshot: CapabilityAutopilotMemorySnapshot): string {
  const lines: string[] = [];
  lines.push('[capability-autopilot-memory] Capability Memory And Replay Learning');
  lines.push(`status: ${snapshot.status}`);
  lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
  lines.push(`capability: ${snapshot.capabilityId}`);
  lines.push(`outcome: ${snapshot.memory.outcome} | replayable=${String(snapshot.memory.replayable)}`);
  lines.push(`recommended: ${snapshot.replay.recommendedNextAction}`);
  lines.push('');
  for (const item of snapshot.checks) {
    lines.push(`[${item.status}] ${item.title}`);
    lines.push(`  ${item.reason}`);
    for (const evidence of item.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }
  lines.push('');
  lines.push(`recommended next step: ${snapshot.nextRecommendedStage.phase} - ${snapshot.nextRecommendedStage.title}`);
  lines.push(snapshot.nextRecommendedStage.reason);
  return lines.join('\n');
}
