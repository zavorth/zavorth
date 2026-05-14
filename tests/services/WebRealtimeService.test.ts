import fs from 'fs';
import os from 'os';
import path from 'path';
import { WebRealtimeService } from '../../src/services/WebRealtimeService';
import { GatewaySessionLedgerService } from '../../src/services/GatewaySessionLedgerService.js';

describe('WebRealtimeService', () => {
  it('emits workflow events when workflow runs change for a subscribed session', async () => {
    const snapshots = {
      fast: {
        tasks: [],
        permissions: [],
        continuity: null,
        replay: null,
        handoff: null,
        workflowRuns: [
          {
            workflow_run_id: 'wf-ship-001',
            workflow_name: 'ship',
            objective: 'Fechar briefing final',
            workspace: 'C:/repo',
            origin: {},
            trigger: {},
            workspace_context: null,
            created_at: '2026-04-06T10:00:00.000Z',
            updated_at: '2026-04-06T10:00:00.000Z',
            status: 'approval_pending',
            stages: [
              {
                id: 'draft',
                label: 'Rascunho',
                executor: 'codex',
                role: 'maker',
                strategy_note: null,
                index: 0,
                status: 'completed',
                task_id: 'task-draft-1',
                attempt_count: 1,
                objective: 'Escrever rascunho',
                handoff_summary: null,
                started_at: '2026-04-06T10:00:00.000Z',
                finished_at: '2026-04-06T10:02:00.000Z',
                result_summary: 'Rascunho pronto',
                artifact_count: 1,
              },
              {
                id: 'delivery',
                label: 'Entrega final',
                executor: 'external_executor',
                role: 'reviewer',
                strategy_note: null,
                index: 1,
                status: 'approval_pending',
                task_id: 'task-delivery-1',
                attempt_count: 1,
                objective: 'Publicar entrega final',
                handoff_summary: 'Rascunho pronto',
                started_at: '2026-04-06T10:03:00.000Z',
                finished_at: '2026-04-06T10:04:00.000Z',
                result_summary: 'Aguardando aprovacao final',
                artifact_count: 0,
              },
            ],
            resume_stage: {
              id: 'delivery',
              label: 'Entrega final',
              executor: 'external_executor',
              strategy_note: null,
              status: 'approval_pending',
              index: 1,
              attempt_count: 1,
              task_id: 'task-delivery-1',
              objective: 'Publicar entrega final',
              handoff_summary: 'Rascunho pronto',
              result_summary: 'Aguardando aprovacao final',
              reason: 'aguarda sua confirmacao para seguir',
            },
            actionable_stages: [
              {
                id: 'draft',
                label: 'Rascunho',
                executor: 'codex',
                status: 'completed',
                index: 0,
                task_id: 'task-draft-1',
                objective: 'Escrever rascunho',
                handoff_summary: null,
                result_summary: 'Rascunho pronto',
                reason: 'Rascunho pronto',
                action: 'reexecutar',
              },
              {
                id: 'delivery',
                label: 'Entrega final',
                executor: 'external_executor',
                status: 'approval_pending',
                index: 1,
                task_id: 'task-delivery-1',
                objective: 'Publicar entrega final',
                handoff_summary: 'Rascunho pronto',
                result_summary: 'Aguardando aprovacao final',
                reason: 'Aguardando aprovacao final',
                action: 'continue',
              },
            ],
            resume_prompt: 'Retome pela etapa Entrega final.',
            artifacts: [],
            artifacts_manifest: { total: 0 },
            externalized_state: null,
          },
        ],
        toolRuns: [
          {
            runId: 'workflow-wf-ship-001-delivery-1',
            taskId: 'task-delivery-1',
            workflowRunId: 'wf-ship-001',
            toolName: 'Entrega final',
            status: 'approval_pending',
            filesTouched: [],
            artifacts: [],
            diff: { summary: null, patches: [] },
          },
        ],
      } as any,
      resolved: null as any,
    };
    snapshots.resolved = snapshots.fast;

    const sessionReadModel = {
      buildSnapshotFast: jest.fn(() => snapshots.fast),
      buildSnapshot: jest.fn(async () => snapshots.resolved),
    };

    const service = new WebRealtimeService(
      {
        getRecentTasksByChat: jest.fn(() => []),
      } as any,
      {
        listRequests: jest.fn(async () => []),
      } as any,
      () => 'Permissao pendente',
      'web-user-1',
      {
        sessionReadModelService: sessionReadModel as any,
      },
    );

    const sessionId = service.createSession();
    const events: any[] = [];
    service.subscribe(sessionId, (event) => {
      events.push(event);
    });

    await service.captureBaseline(sessionId);
    events.length = 0;

    snapshots.fast = {
      ...snapshots.fast,
      workflowRuns: [
        {
          ...snapshots.fast.workflowRuns[0],
          updated_at: '2026-04-06T10:06:00.000Z',
          status: 'completed',
          resume_stage: null,
          actionable_stages: [
            {
              id: 'draft',
              label: 'Rascunho',
              executor: 'codex',
              status: 'completed',
              index: 0,
              task_id: 'task-draft-1',
              objective: 'Escrever rascunho',
              handoff_summary: null,
              result_summary: 'Rascunho pronto',
              reason: 'Rascunho pronto',
              action: 'reexecutar',
            },
            {
              id: 'delivery',
              label: 'Entrega final',
              executor: 'external_executor',
              status: 'completed',
              index: 1,
              task_id: 'task-delivery-1',
              objective: 'Publicar entrega final',
              handoff_summary: 'Rascunho pronto',
              result_summary: 'Entrega final publicada',
              reason: 'Entrega final publicada',
              action: 'reexecutar',
            },
          ],
          stages: [
            snapshots.fast.workflowRuns[0].stages[0],
            {
              ...snapshots.fast.workflowRuns[0].stages[1],
              status: 'completed',
              finished_at: '2026-04-06T10:06:00.000Z',
              result_summary: 'Entrega final publicada',
            },
          ],
          artifacts: [
            {
              id: 'artifact-final-1',
              name: 'briefing-final.md',
              kind: 'report',
              type: 'file',
              path: 'C:/repo/artifacts/briefing-final.md',
            },
          ],
          artifacts_manifest: { total: 1, primary_artifact_name: 'briefing-final.md' },
        },
      ],
      toolRuns: [
        {
          runId: 'workflow-wf-ship-001-delivery-1',
          taskId: 'task-delivery-1',
          workflowRunId: 'wf-ship-001',
          toolName: 'Entrega final',
          status: 'completed',
          filesTouched: ['C:/repo/artifacts/briefing-final.md'],
          artifacts: [
            {
              id: 'artifact-final-1',
              name: 'briefing-final.md',
            },
          ],
          diff: { summary: null, patches: [] },
        },
      ],
    } as any;
    snapshots.resolved = snapshots.fast;

    await (service as any).refreshSession(sessionId, false);

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'workflow',
          payload: expect.objectContaining({
            workflow_run_id: 'wf-ship-001',
            status: 'completed',
            artifacts_manifest: expect.objectContaining({
              primary_artifact_name: 'briefing-final.md',
            }),
          }),
        }),
        expect.objectContaining({
          type: 'tool',
          payload: expect.objectContaining({
            runId: 'workflow-wf-ship-001-delivery-1',
            status: 'completed',
          }),
        }),
        expect.objectContaining({
          type: 'snapshot',
          payload: expect.objectContaining({
            workflowRuns: expect.arrayContaining([
              expect.objectContaining({
                workflow_run_id: 'wf-ship-001',
                status: 'completed',
              }),
            ]),
          }),
        }),
      ]),
    );
  });

  it('rehydrates persisted transcript messages from the session ledger after restart', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-realtime-ledger-'));
    const ledger = new GatewaySessionLedgerService({
      rootDir: tempDir,
      now: () => new Date('2026-04-12T14:00:00.000Z'),
    });
    const sessionReadModel = {
      buildSnapshotFast: jest.fn(() => ({
        tasks: [],
        permissions: [],
        continuity: null,
        replay: null,
        handoff: null,
        workflowRuns: [],
      })),
      buildSnapshot: jest.fn(async () => ({
        tasks: [],
        permissions: [],
        continuity: null,
        replay: null,
        handoff: null,
        workflowRuns: [],
      })),
    };

    const first = new WebRealtimeService(
      {
        getRecentTasksByChat: jest.fn(() => []),
      } as any,
      {
        listRequests: jest.fn(async () => []),
      } as any,
      () => 'Permissao pendente',
      'web-user-1',
      {
        sessionReadModelService: sessionReadModel as any,
        sessionLedgerService: ledger,
      },
    );

    const sessionId = first.createSession();
    first.recordUserMessage(sessionId, 'oi zavorth');
    first.recordAssistantMessage(sessionId, 'ola operador');
    first.stop();

    const second = new WebRealtimeService(
      {
        getRecentTasksByChat: jest.fn(() => []),
      } as any,
      {
        listRequests: jest.fn(async () => []),
      } as any,
      () => 'Permissao pendente',
      'web-user-1',
      {
        sessionReadModelService: sessionReadModel as any,
        sessionLedgerService: ledger,
      },
    );

    second.ensureSession(sessionId);
    expect(second.getSnapshot(sessionId).messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: 'oi zavorth',
        }),
        expect.objectContaining({
          role: 'assistant',
          content: 'ola operador',
        }),
      ]),
    );

    second.stop();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
