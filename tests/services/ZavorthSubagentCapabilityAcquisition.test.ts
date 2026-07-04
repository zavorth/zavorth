import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthSubagentRuntimeService } from '@zavorth/agents/ZavorthSubagentRuntimeService.js';

describe('ZavorthSubagentRuntimeService capability acquisition', () => {
  it('spawns a governed batch with orchestrator role mode and observable parent-child receipts', async () => {
    const fixture = createFixture();
    try {
      const service = new ZavorthSubagentRuntimeService({
        now: fixture.now,
        stateFilePath: fixture.stateFile,
        boardDbPath: fixture.boardDb,
      });

      const snapshot = await service.execute({
        action: 'subagents.spawn_batch',
        tasks: [
          'use subagents to inspect the runtime contracts',
          'use subagents to inspect the desktop projection',
        ],
        explicitSubagents: true,
        roleMode: 'orchestrator',
        maxConcurrentChildren: 4,
        persistState: true,
      });

      expect(snapshot.action).toBe('subagents.spawn_batch');
      expect(snapshot.status).toBe('completed');
      expect(snapshot.runs).toHaveLength(2);
      expect(snapshot.runs.every((run) => run.roleMode === 'orchestrator')).toBe(true);
      expect(snapshot.summary.batchRuns).toBe(1);
      expect(snapshot.observability.events.map((event) => event.name)).toEqual(expect.arrayContaining([
        'subagent.created',
        'subagent.started',
        'subagent.completed',
      ]));
      expect(snapshot.sessions[0]?.profileSummaries[0]?.identity).toMatchObject({
        motionState: 'completed',
        surface: expect.objectContaining({
          i18nKey: 'subagent.status.completed',
        }),
      });
      expect(snapshot.observability.events.find((event) => event.identity)?.identity).toMatchObject({
        surface: expect.objectContaining({
          i18nKey: 'subagent.status.completed',
        }),
      });
      expect(snapshot.limits.maxChildren).toBe(4);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks recursive delegation from leaf mode while allowing orchestrator children within limits', async () => {
    const fixture = createFixture();
    try {
      const service = new ZavorthSubagentRuntimeService({
        now: fixture.now,
        stateFilePath: fixture.stateFile,
        boardDbPath: fixture.boardDb,
      });
      const parent = await service.execute({
        action: 'subagents.spawn',
        task: 'use subagents to read local state',
        explicitSubagents: true,
        roleMode: 'orchestrator',
        maxSpawnDepth: 2,
      });
      const parentRunId = parent.selectedRunId;

      const leafAttempt = await service.execute({
        action: 'subagents.spawn',
        task: 'use subagents to create a child analysis',
        explicitSubagents: true,
        parentRunId,
        roleMode: 'leaf',
      });
      const orchestratorChild = await service.execute({
        action: 'subagents.spawn',
        task: 'use subagents to create a child analysis',
        explicitSubagents: true,
        parentRunId,
        roleMode: 'orchestrator',
      });

      expect(leafAttempt.status).toBe('denied');
      expect(leafAttempt.policy.leafSubagentsCannotDelegate).toBe(true);
      expect(orchestratorChild.status).toBe('completed');
      expect(orchestratorChild.parentChildTree.find((entry) => entry.runId === parentRunId)?.childRunIds).toContain(
        orchestratorChild.selectedRunId,
      );
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('exposes durable workboard actions through the runtime snapshot', async () => {
    const fixture = createFixture();
    try {
      const service = new ZavorthSubagentRuntimeService({
        now: fixture.now,
        stateFilePath: fixture.stateFile,
        boardDbPath: fixture.boardDb,
      });

      const created = await service.execute({
        action: 'subagents.board.create',
        task: 'Coordinate read-only implementation slices',
        tasks: ['Inspect contracts', 'Inspect UI projections'],
        explicitSubagents: true,
      });
      const claimed = await service.execute({
        action: 'subagents.board.claim',
        workerId: 'worker-a',
      });
      const heartbeat = await service.execute({
        action: 'subagents.board.heartbeat',
        workerId: 'worker-a',
        taskId: claimed.workboard.selectedTaskId,
      });
      const completed = await service.execute({
        action: 'subagents.board.complete',
        workerId: 'worker-a',
        taskId: claimed.workboard.selectedTaskId,
        message: 'Contract slice completed.',
      });

      expect(created.workboard.tasks.map((task) => task.status)).toEqual(['queued', 'queued']);
      expect(claimed.workboard.selectedTask?.status).toBe('running');
      expect(heartbeat.observability.events.at(-1)?.name).toBe('subagent.heartbeat');
      expect(completed.workboard.selectedTask?.status).toBe('completed');
      expect(completed.workboard.receipts.some((receipt) => receipt.action === 'task.completed')).toBe(true);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('updates dynamic subagent config and projects sandbox/device state without serializing secrets', async () => {
    const fixture = createFixture();
    try {
      const service = new ZavorthSubagentRuntimeService({
        now: fixture.now,
        stateFilePath: fixture.stateFile,
        boardDbPath: fixture.boardDb,
      });

      const configured = await service.execute({
        action: 'subagents.config.update',
        configPatch: {
          maxConcurrentChildren: 3,
          maxSpawnDepth: 4,
          childTimeoutMs: 120000,
          defaultRoleMode: 'orchestrator',
          sandboxBackend: 'modal',
          cloudSandboxEnabled: true,
          inheritToolsets: true,
        },
        approvalId: 'approval-config-1',
      });
      const approved = await service.execute({
        action: 'subagents.device.approve',
        deviceId: 'phone-1',
        deviceLabel: 'Operator Phone',
        deviceCapabilities: ['device.info', 'camera.capture', 'location.read'],
        approvalId: 'approval-device-1',
      });
      const revoked = await service.execute({
        action: 'subagents.device.revoke',
        deviceId: 'phone-1',
        message: 'Operator revoked the device.',
        approvalId: 'approval-device-2',
      });

      expect(configured.dynamicConfig.settings).toMatchObject({
        maxConcurrentChildren: 3,
        maxSpawnDepth: 4,
        childTimeoutMs: 120000,
        defaultRoleMode: 'orchestrator',
        sandboxBackend: 'modal',
        cloudSandboxEnabled: true,
        inheritToolsets: true,
      });
      expect(configured.sandbox.selectedBackend).toBe('modal');
      expect(configured.sandbox.safety.secretsNeverSerialized).toBe(true);
      expect(JSON.stringify(configured)).not.toContain('modal-secret-value');
      expect(JSON.stringify(configured)).not.toContain('daytona-secret-value');
      expect(approved.pairedDevices.devices[0]).toMatchObject({
        deviceId: 'phone-1',
        status: 'approved',
      });
      expect(approved.pairedDevices.devices[0]?.sensitiveCapabilitiesRequireApproval).toBe(true);
      expect(revoked.pairedDevices.devices[0]?.status).toBe('revoked');
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-subagent-acquisition-'));
  let tick = 0;
  return {
    root,
    stateFile: path.join(root, 'runtime-state.json'),
    boardDb: path.join(root, 'subagents.sqlite'),
    now: () => new Date(Date.parse('2026-07-02T12:00:00.000Z') + tick++ * 1000),
  };
}
