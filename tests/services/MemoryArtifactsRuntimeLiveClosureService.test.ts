import fs from 'fs';
import os from 'os';
import path from 'path';

import { MemoryArtifactsRuntimeLiveClosureService } from '../../src/services/MemoryArtifactsRuntimeLiveClosureService.js';
import { MemoryArtifactsRuntimeLiveService } from '../../src/services/MemoryArtifactsRuntimeLiveService.js';

describe('MemoryArtifactsRuntimeLiveClosureService Intent model2', () => {
  let workspaceRoot: string;
  let tempRoot: string;

  beforeEach(async () => {
    workspaceRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-intent-model2-workspace-'));
    tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-intent-model2-state-'));
  });

  afterEach(async () => {
    await fs.promises.rm(workspaceRoot, { recursive: true, force: true });
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  });

  it('closes Intent model2 memory, artifacts and runtime gates without live IO', () => {
    const snapshot = new MemoryArtifactsRuntimeLiveClosureService({
      now: () => new Date('2026-05-05T00:12:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-05.live-checkpoint-12');
    expect(snapshot.phase).toBe('Intent model2 - Memory, Artifacts And Runtime Executor Live Closure');
    expect(snapshot.status).toBe('closed');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        targets: 11,
        memoryTargets: 4,
        artifactTargets: 4,
        runtimeTargets: 2,
        workflowTargets: 2,
        pluginTargets: 1,
        bridgeTargets: 1,
        rememberRecallForgetTargets: 2,
        artifactIndexReplayTargets: 5,
        threadOwnershipTargets: 1,
        approvalGateTargets: 4,
        stagingLiveSmokeCommands: 11,
        redactedReceipts: 11,
        blocked: 0,
        memoryMarkedLiveWithoutWrite: false,
        artifactsMarkedLiveWithoutReplay: false,
        runtimeMarkedLiveWithoutExecutionProfile: false,
        unsafeRuntimeBypassesApproval: false,
        liveIoRequiredBySandboxAdapterCheck: false,
        secretValuesSerialized: false,
      }),
    );
  });

  it('writes recalls cites and forgets real memory entries', async () => {
    const service = new MemoryArtifactsRuntimeLiveService({
      workspaceRoot,
      tempRoot,
      now: () => new Date('2026-05-05T00:12:00.000Z'),
    });

    const proof = await service.runMemoryProof();
    const wiki = await service.runWikiPersistenceProof();

    expect(proof).toEqual(
      expect.objectContaining({
        ok: true,
        remembered: true,
        recalled: true,
        cited: true,
        forgotten: true,
        secretValuesSerialized: false,
      }),
    );
    expect(fs.existsSync(proof.ledgerPath)).toBe(true);
    expect(fs.existsSync(proof.receiptPath)).toBe(true);
    expect(wiki.ok).toBe(true);
    expect(wiki.persisted).toBe(true);
    expect(wiki.searched).toBe(true);
    expect(fs.existsSync(wiki.pagePath)).toBe(true);
  });

  it('indexes and replays real artifact bodies', async () => {
    const service = new MemoryArtifactsRuntimeLiveService({
      workspaceRoot,
      tempRoot,
      now: () => new Date('2026-05-05T00:12:00.000Z'),
    });

    const proof = await service.runArtifactIndexReplayProof();

    expect(proof.ok).toBe(true);
    expect(proof.indexed).toBe(true);
    expect(proof.replayed).toBe(true);
    expect(fs.existsSync(proof.artifactPath)).toBe(true);
    expect(fs.existsSync(proof.indexPath)).toBe(true);
    expect(fs.existsSync(proof.replayReceiptPath)).toBe(true);
    expect(proof.secretValuesSerialized).toBe(false);
  });

  it('executes a controlled runtime profile', async () => {
    const service = new MemoryArtifactsRuntimeLiveService({
      workspaceRoot,
      tempRoot,
      now: () => new Date('2026-05-05T00:12:00.000Z'),
    });

    const thread = await service.runThreadOwnershipProof();
    const runtime = await service.runRuntimeExecutorProof({ confirmExecution: true });

    expect(thread.ok).toBe(true);
    expect(thread.conflictingOwnerBlocked).toBe(true);
    expect(thread.released).toBe(true);
    expect(runtime.ok).toBe(true);
    expect(runtime.codexRunPlan).toBe(true);
    expect(runtime.openShellCommandPlan).toBe(true);
    expect(runtime.localRuntimeExecuted).toBe(true);
    expect(runtime.stdout).toBe('zavorth-checkpoint-12-runtime');
    expect(runtime.approvalRequired).toBe(true);
  });

  it('persists task, plugin and ACP bridge receipts', async () => {
    const service = new MemoryArtifactsRuntimeLiveService({
      workspaceRoot,
      tempRoot,
      now: () => new Date('2026-05-05T00:12:00.000Z'),
    });

    const proof = await service.runTaskWorkspaceBridgeProof();

    expect(proof.ok).toBe(true);
    expect(proof.workflowPersisted).toBe(true);
    expect(proof.pluginExecutedAfterApproval).toBe(true);
    expect(proof.bridgeEnvelopePersisted).toBe(true);
    expect(proof.pluginReceiptStatus).toBe('executed');
    expect(proof.unsafeRuntimeBypassesApproval).toBe(false);
    expect(fs.existsSync(proof.bridgeReceiptPath)).toBe(true);
  });
});
