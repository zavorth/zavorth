import os from 'node:os';
import path from 'node:path';
import type { FileDocumentDiffLiveEntry } from '../src/contracts/FileDocumentDiffLivePlaneContract.js';
import { ArtifactDiffService } from '../src/services/ArtifactDiffService.js';
import { DocumentExtractService } from '../src/services/DocumentExtractService.js';
import { DocumentWorkflowDecisionService } from '../src/services/DocumentWorkflowDecisionService.js';
import { FileDocumentDiffLivePlaneService } from '../src/services/FileDocumentDiffLivePlaneService.js';
import { FileTransferService } from '../src/services/FileTransferService.js';

type Profile = 'configured' | 'staging-live';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const target = readArg('--target');
const profile = (readArg('--profile') || 'configured') as Profile;
const confirmLiveIo = args.includes('--confirm-live-io');
const snapshot = new FileDocumentDiffLivePlaneService().buildSnapshot();
const selected = target
  ? snapshot.entries.filter((entry) => entry.targetId === target)
  : snapshot.entries;

if (selected.length === 0) {
  console.error(`[file-document-diff-live-plane] unknown target: ${target}`);
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
      ? 'staging-live file/document/diff requires --confirm-live-io and explicit workspace paths.'
      : 'Certification matrix exposes real file bytes, document extraction, artifact diffs and prose workflow decisions.',
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
    console.log(`[file-document-diff-live-plane] profile=${profile} liveIoPerformed=${output.liveIoPerformed}`);
    console.log(`[file-document-diff-live-plane] ${output.status}: ${output.reason}`);
    for (const entry of output.entries) {
      console.log(`[file-document-diff-live-plane] ${entry.targetId} ${entry.status} capabilities=${entry.capabilities.join(',')}`);
      console.log(`  doctor: ${entry.doctorCommand}`);
      console.log(`  staging: ${entry.stagingLiveSmokeCommand}`);
      console.log(`  required env: ${entry.requiredEnv.join(', ') || 'none'}`);
    }
  }
}

async function runLiveSmoke(entry: FileDocumentDiffLiveEntry): Promise<unknown> {
  const artifactDir = readArg('--artifact-dir') || readEnv('ZAVORTH_FILE_DOCUMENT_DIFF_ARTIFACT_DIR') || path.join(os.tmpdir(), 'zavorth-file-document-diff-live-smoke');
  const workspaceRoot = readArg('--workspace-root') || readEnv('ZAVORTH_FILE_TRANSFER_WORKSPACE_ROOT') || process.cwd();
  if (entry.targetId === 'file-transfer') {
    const source = requireArg(entry.targetId, '--source');
    const destination = requireArg(entry.targetId, '--destination');
    const service = new FileTransferService({ artifactDir, workspaceRoots: [workspaceRoot] });
    const result = await service.executeLive({
      direction: readArg('--direction') === 'move' ? 'move' : 'copy',
      source: { kind: 'workspace-path', ref: source },
      destination: { kind: 'workspace-path', ref: destination },
      overwrite: args.includes('--overwrite'),
      allowedRoots: [workspaceRoot, artifactDir],
      confirmWrite: true,
      allowMoveDelete: args.includes('--allow-move-delete'),
    });
    return {
      targetId: entry.targetId,
      operation: 'file.transfer',
      ok: result.ok,
      status: result.status,
      artifactId: result.artifactId,
      bytesTransferred: result.bytesTransferred,
      error: result.error,
      liveIoPerformed: true,
      secretValuesSerialized: false,
    };
  }
  if (entry.targetId === 'document-extract') {
    const source = requireArg(entry.targetId, '--source');
    const service = new DocumentExtractService({ artifactDir, workspaceRoots: [workspaceRoot] });
    const result = await service.extractLive({
      source: {
        storageRef: source,
        contentType: readArg('--content-type') || null,
      },
      mode: 'full',
      allowedRoots: [workspaceRoot, artifactDir],
      outputDir: artifactDir,
    });
    return {
      targetId: entry.targetId,
      operation: 'document.extract',
      ok: result.ok,
      outputArtifactId: result.outputArtifactId,
      textLength: result.text.length,
      tables: result.tables.length,
      error: result.error,
      liveIoPerformed: true,
      secretValuesSerialized: false,
    };
  }
  if (entry.targetId === 'diffs') {
    const left = requireArg(entry.targetId, '--left');
    const right = requireArg(entry.targetId, '--right');
    const service = new ArtifactDiffService({ artifactDir, workspaceRoots: [workspaceRoot] });
    const result = await service.createDiffArtifact({
      left: { kind: 'workspace-path', ref: left },
      right: { kind: 'workspace-path', ref: right },
      outputDir: artifactDir,
      allowedRoots: [workspaceRoot, artifactDir],
    });
    return {
      targetId: entry.targetId,
      operation: 'artifact.diff',
      ok: result.ok,
      artifact: result.artifact,
      summary: result.summary,
      error: result.error,
      liveIoPerformed: true,
      secretValuesSerialized: false,
    };
  }
  const workflow = new DocumentWorkflowDecisionService().decide({
    targetId: entry.targetId,
    requestedAction: readArg('--action'),
    sourceContentType: readArg('--content-type'),
  });
  return {
    targetId: entry.targetId,
    operation: 'document.workflow.decision',
    ok: true,
    workflow,
    liveIoPerformed: false,
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

function requireArg(targetId: string, name: string): string {
  const value = readArg(name);
  if (value) return value;
  throw new Error(`[file-document-diff-live-plane] ${targetId} requires ${name} for staging-live smoke.`);
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
