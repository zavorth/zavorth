import os from 'node:os';
import path from 'node:path';
import type { MemoryArtifactsRuntimeLiveEntry } from '../src/contracts/MemoryArtifactsRuntimeLiveClosureContract.js';
import { MemoryArtifactsRuntimeLiveClosureService } from '../src/services/MemoryArtifactsRuntimeLiveClosureService.js';
import { MemoryArtifactsRuntimeLiveService } from '../src/services/MemoryArtifactsRuntimeLiveService.js';

type Profile = 'configured' | 'staging-live';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const target = readArg('--target');
const profile = (readArg('--profile') || 'configured') as Profile;
const confirmLiveIo = args.includes('--confirm-live-io');
const snapshot = new MemoryArtifactsRuntimeLiveClosureService().buildSnapshot();
const selected = target
  ? snapshot.entries.filter((entry) => entry.targetId === target)
  : snapshot.entries;

if (selected.length === 0) {
  console.error(`[memory-artifacts-runtime-live-closure] unknown target: ${target}`);
  process.exit(1);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main(): Promise<void> {
  const liveReceiptByTarget = new Map<string, unknown>();
  if (profile === 'staging-live' && confirmLiveIo) {
    for (const entry of selected) {
      liveReceiptByTarget.set(entry.targetId, await runLiveSmoke(entry));
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    profile,
    liveIoPerformed: [...liveReceiptByTarget.values()].some(receiptHasLiveIo),
    confirmLiveIo,
    status: profile === 'staging-live' && !confirmLiveIo ? 'blocked-until-confirmed' : 'ready-for-operator',
    reason: profile === 'staging-live' && !confirmLiveIo
      ? 'staging-live memory/artifact/runtime closure requires --confirm-live-io before local runtime state is touched.'
      : 'Intent model2 exposes real memory writes, artifact replay and governed runtime execution receipts.',
    entries: selected.map((entry) => ({
      targetId: entry.targetId,
      status: entry.status,
      capabilities: entry.capabilities,
      adapterFamily: entry.adapterFamily,
      modes: entry.modes,
      doctorCommand: entry.doctorCommand,
      stagingLiveSmokeCommand: entry.stagingLiveSmokeCommand,
      requiredEnv: entry.configSchema.requiredEnv,
      optionalEnv: entry.configSchema.optionalEnv,
      gaps: entry.gaps,
      receipt: entry.receipt,
      liveReceipt: liveReceiptByTarget.get(entry.targetId) || null,
    })),
  };

  if (asJson) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`[memory-artifacts-runtime-live-closure] profile=${profile} liveIoPerformed=${output.liveIoPerformed}`);
    console.log(`[memory-artifacts-runtime-live-closure] ${output.status}: ${output.reason}`);
    for (const entry of output.entries) {
      console.log(`[memory-artifacts-runtime-live-closure] ${entry.targetId} ${entry.status} capabilities=${entry.capabilities.join(',')}`);
      console.log(`  doctor: ${entry.doctorCommand}`);
      console.log(`  staging: ${entry.stagingLiveSmokeCommand}`);
      console.log(`  required env: ${entry.requiredEnv.join(', ') || 'none'}`);
    }
  }
}

async function runLiveSmoke(entry: MemoryArtifactsRuntimeLiveEntry): Promise<unknown> {
  const service = new MemoryArtifactsRuntimeLiveService({
    workspaceRoot: readArg('--workspace-root') || process.cwd(),
    tempRoot: readArg('--state-dir') || readEnv('ZAVORTH_MEMORY_ARTIFACTS_RUNTIME_DIR') || path.join(os.tmpdir(), 'zavorth-memory-artifacts-runtime-live-smoke'),
  });
  if (entry.targetId === 'memory-core' || entry.targetId === 'active-memory' || entry.targetId === 'memory-lancedb') {
    return {
      targetId: entry.targetId,
      operation: 'memory',
      proof: await service.runMemoryProof(),
      liveIoPerformed: true,
      secretValuesSerialized: false,
    };
  }
  if (entry.targetId === 'memory-wiki') {
    return {
      targetId: entry.targetId,
      operation: 'memory-wiki',
      proof: await service.runWikiPersistenceProof(),
      liveIoPerformed: true,
      secretValuesSerialized: false,
    };
  }
  if (entry.targetId === 'thread-ownership') {
    return {
      targetId: entry.targetId,
      operation: 'thread-ownership',
      proof: await service.runThreadOwnershipProof(),
      liveIoPerformed: true,
      secretValuesSerialized: false,
    };
  }
  if (entry.targetId === 'codex' || entry.targetId === 'openshell') {
    return {
      targetId: entry.targetId,
      operation: 'runtime-executor',
      artifact: await service.runArtifactIndexReplayProof(),
      runtime: await service.runRuntimeExecutorProof({ confirmExecution: true }),
      liveIoPerformed: true,
      secretValuesSerialized: false,
    };
  }
  if (entry.targetId === 'llm-task' || entry.targetId === 'vydra' || entry.targetId === 'skill-workshop' || entry.targetId === 'acpx') {
    return {
      targetId: entry.targetId,
      operation: 'task-workspace-bridge',
      proof: await service.runTaskWorkspaceBridgeProof(),
      liveIoPerformed: true,
      secretValuesSerialized: false,
    };
  }
  return {
    targetId: entry.targetId,
    operation: 'full',
    proof: await service.runFullProof({ confirmExecution: true }),
    liveIoPerformed: true,
    secretValuesSerialized: false,
  };
}

function readArg(name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) {
    return direct.slice(name.length + 1);
  }
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  return null;
}

function readEnv(name: string): string | null {
  const value = String(process.env[name] || '').trim();
  return value || null;
}

function receiptHasLiveIo(receipt: unknown): boolean {
  return Boolean(
    receipt
    && typeof receipt === 'object'
    && (receipt as { liveIoPerformed?: unknown }).liveIoPerformed === true,
  );
}
