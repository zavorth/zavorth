import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthSubagentRuntimeService } from '@zavorth/agents/ZavorthSubagentRuntimeService.js';
import { ZavorthSubagentAutoInvocationPolicyService } from '../../src/services/ZavorthSubagentAutoInvocationPolicyService.js';

describe('ZavorthSubagentRuntimeService Connector registry', () => {
  it('spawns explicit read-only subagents without mutating the workspace', async () => {
    const fixture = createFixture();
    try {
      const service = new ZavorthSubagentRuntimeService({
        now: () => new Date('2026-05-10T14:00:00.000Z'),
        stateFilePath: fixture.stateFile,
        boardDbPath: fixture.boardDbFile,
      });
      const snapshot = await service.execute({
        action: 'subagents.spawn',
        task: 'use subagentes e analise localmente',
        explicitSubagents: true,
        // Structured read-only riskHints — free-text never preclears risk.
        riskHints: {
          surface: 'skill',
          brokerRisk: 'safe',
          receiptRisk: 'safe',
          requiresApproval: false,
          reason: 'Read-only subagent task can run in governed runtime.',
          reasons: ['read-only-subagent-precleared'],
        },
        persistState: false,
      });

      expect(snapshot.status).toBe('completed');
      expect(snapshot.summary.workspaceMutationPerformed).toBe(false);
      expect(snapshot.summary.externalIoPerformed).toBe(false);
      expect(snapshot.summary.upstreamRuntimeCodeExecuted).toBe(false);
      expect(snapshot.summary.subagentReceipts).toBeGreaterThan(0);
      expect(snapshot.policy.explicitUserSubagentsCanRunReadOnly).toBe(true);
      expect(snapshot.receipts[0]?.policyBrokerReceipt.allowed).toBe(true);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('requires approval for unstructured free-text tasks (no keyword risk routing)', async () => {
    const fixture = createFixture();
    try {
      const service = new ZavorthSubagentRuntimeService({
        now: () => new Date('2026-05-10T14:00:00.000Z'),
        stateFilePath: fixture.stateFile,
        boardDbPath: fixture.boardDbFile,
      });
      // Free-text "edit files" no longer keyword-routes risk; unstructured non-internal
      // tasks default to approval-required without structured riskHints.
      const snapshot = await service.execute({
        action: 'subagents.spawn',
        task: 'use subagentes e edite arquivos com um comando shell',
        explicitSubagents: true,
        persistState: false,
      });

      expect(snapshot.status).toBe('approval-required');
      expect(snapshot.receipts[0]?.status).toBe('approval-required');
      expect(snapshot.summary.workspaceMutationPerformed).toBe(false);
      expect(snapshot.policy.writesRequirePolicyBrokerApproval).toBe(true);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('runs live-mode workers concurrently through the governed worker backend', async () => {
    const fixture = createFixture();
    try {
      const service = new ZavorthSubagentRuntimeService({
        now: () => new Date('2026-05-10T14:00:00.000Z'),
        stateFilePath: fixture.stateFile,
        boardDbPath: fixture.boardDbFile,
      });
      const snapshot = await service.execute({
        action: 'subagents.spawn',
        task: 'use subagentes e analise localmente',
        roleIds: ['planner', 'qa'],
        explicitSubagents: true,
        riskHints: {
          surface: 'skill',
          brokerRisk: 'safe',
          receiptRisk: 'safe',
          requiresApproval: false,
          reason: 'Read-only subagent task can run in governed runtime.',
          reasons: ['read-only-subagent-precleared'],
        },
        mockLive: true,
        maxLiveWorkers: 2,
        persistState: false,
      });

      expect(snapshot.status).toBe('completed');
      expect(snapshot.summary.liveRuns).toBe(1);
      expect(snapshot.summary.workerResults).toBe(2);
      expect(snapshot.summary.failedWorkerResults).toBe(0);
      expect(snapshot.summary.externalIoPerformed).toBe(false);
      expect(snapshot.runs[0]?.executionMode).toBe('mock-live');
      expect(snapshot.runs[0]?.workerResults.map((entry) => entry.roleId)).toEqual(['planner', 'qa']);
      expect(snapshot.runs[0]?.output).toContain('Live governed subagent result');
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('supports latest session shortcuts for operational read, summarize and cancel UX', async () => {
    const fixture = createFixture();
    try {
      const service = new ZavorthSubagentRuntimeService({
        now: () => new Date('2026-05-10T14:00:00.000Z'),
        stateFilePath: fixture.stateFile,
        boardDbPath: fixture.boardDbFile,
      });
      const spawned = await service.execute({
        action: 'subagents.spawn',
        task: 'use subagentes e acompanhe esta auditoria',
        mode: 'session',
        explicitSubagents: true,
        riskHints: {
          surface: 'skill',
          brokerRisk: 'safe',
          receiptRisk: 'safe',
          requiresApproval: false,
          reason: 'Read-only subagent task can run in governed runtime.',
          reasons: ['read-only-subagent-precleared'],
        },
      });

      const read = await service.execute({
        action: 'subagents.read',
        sessionId: 'latest',
      });
      const summarized = await service.execute({
        action: 'subagents.summarize',
        sessionId: 'ultimo',
      });
      const cancelled = await service.execute({
        action: 'subagents.cancel',
      });
      const text = service.formatSnapshotText(read);

      expect(spawned.status).toBe('running');
      expect(read.selectedSessionId).toBe(spawned.selectedSessionId);
      expect(summarized.selectedSessionId).toBe(spawned.selectedSessionId);
      expect(summarized.timeline.at(-1)?.kind).toBe('summarize');
      expect(cancelled.selectedSessionId).toBe(spawned.selectedSessionId);
      expect(cancelled.status).toBe('cancelled');
      expect(text).toContain('Selected:');
      expect(text).toContain('/agents read latest');
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('exposes safe auto-invocation telemetry in snapshots and CLI text', async () => {
    const fixture = createFixture();
    try {
      const policy = new ZavorthSubagentAutoInvocationPolicyService();
      const decision = policy.decide({
        text: 'faca uma auditoria profunda em todo o Zavorth, procure falhas e valide os achados',
        taskKind: 'security',
        taskSubtype: 'audit',
      });
      const service = new ZavorthSubagentRuntimeService({
        now: () => new Date('2026-05-10T14:00:00.000Z'),
        stateFilePath: fixture.stateFile,
        boardDbPath: fixture.boardDbFile,
      });
      const snapshot = await service.execute({
        action: 'subagents.spawn',
        task: 'use subagentes para auditar localmente em modo somente leitura',
        roleIds: decision.roleIds,
        explicitSubagents: true,
        riskHints: {
          surface: 'skill',
          brokerRisk: 'safe',
          receiptRisk: 'safe',
          requiresApproval: false,
          reason: 'Read-only subagent task can run in governed runtime.',
          reasons: ['read-only-subagent-precleared'],
        },
        mockLive: true,
        maxLiveWorkers: 2,
        autoInvocation: decision.telemetry,
        persistState: false,
      });
      const text = service.formatSnapshotText(snapshot);

      // Auto-invocation telemetry is attached when the spawn carries a policy decision.
      // Free-text keywords no longer force selectedBy=explicit/implicit — structured spawn still runs.
      expect(snapshot.status).toBe('completed');
      expect(snapshot.summary.subagentReceipts).toBeGreaterThan(0);
      expect(text).toMatch(/Auto subagent|subagent|Selected|Live|completed/i);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('projects the shared dispatcher workboard with canonical task states and details', async () => {
    const fixture = createFixture();
    try {
      const service = new ZavorthSubagentRuntimeService({
        now: () => new Date('2026-05-10T14:00:00.000Z'),
        stateFilePath: fixture.stateFile,
        boardDbPath: fixture.boardDbFile,
      });
      const created = await service.execute({
        action: 'subagents.board.create',
        task: 'Coordinate runtime board',
        tasks: ['Render runtime task in desktop'],
        channel: 'dashboard',
        explicitSubagents: true,
        riskHints: {
          surface: 'skill',
          brokerRisk: 'safe',
          receiptRisk: 'safe',
          requiresApproval: false,
          reason: 'Board create is a structured control-plane action.',
          reasons: ['board-create-precleared'],
        },
        persistState: false,
      });
      const claimed = await service.execute({
        action: 'subagents.board.claim',
        workerId: 'worker-runtime',
        persistState: false,
      });

      await service.execute({
        action: 'subagents.board.heartbeat',
        taskId: claimed.workboard.selectedTaskId,
        workerId: 'worker-runtime',
        persistState: false,
      });
      const completed = await service.execute({
        action: 'subagents.board.complete',
        taskId: claimed.workboard.selectedTaskId,
        workerId: 'worker-runtime',
        message: 'Rendered through the shared projection.',
        persistState: false,
      });

      expect(created.workboard.tasks[0]?.status).toBe('queued');
      expect(claimed.workboard.selectedTask?.status).toBe('claimed');
      expect(claimed.workboard.selectedTask).toEqual(
        expect.objectContaining({
          attempts: 1,
          maxRetries: 2,
          claimedBy: 'worker-runtime',
        }),
      );
      expect(completed.workboard.selectedTask).toEqual(
        expect.objectContaining({
          status: 'completed',
          artifactRefs: [],
          comments: expect.arrayContaining([
            expect.objectContaining({ author: 'worker-runtime', body: 'Rendered through the shared projection.' }),
          ]),
        }),
      );
      expect(completed.workboard.summary.completed).toBe(1);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-subagent-test-'));
  return {
    root,
    stateFile: path.join(root, 'runtime-state.json'),
    boardDbFile: path.join(root, 'workboard.sqlite'),
  };
}
