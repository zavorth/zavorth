import { ZavorthMemoryPlaneService } from '../../src/services/ZavorthMemoryPlaneService.js';

describe('ZavorthMemoryPlaneService', () => {
  it('hydrates memory, replay, artifacts and workspace signals into one snapshot', async () => {
    const service = new ZavorthMemoryPlaneService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      gatewaySessionReadModelService: {
        buildSnapshot: jest.fn(async () => ({
          sessionId: 'session-1',
          chatId: 'web:session-1',
          runtimeUserId: 'user-1',
          continuity: {
            focusTask: {
              taskId: 'task-1',
              workspace: 'C:/repo',
            },
            currentSurfaceTask: null,
            latestTelegramTask: null,
            latestWebTask: null,
            suggestedAction: {
              reason: 'Retomar task-1.',
            },
          },
          replay: {
            headline: 'Replay pronto.',
            operatorSummary: 'Leitura consolidada.',
            stats: {
              tasks: 2,
              workflowRuns: 1,
            },
            recentArtifacts: [
              {
                id: 'artifact-1',
                label: 'briefing-final.md',
                kind: 'doc',
                summary: 'Briefing consolidado.',
                path: 'artifacts/briefing-final.md',
                createdAt: '2026-04-02T11:58:00.000Z',
                sourceTaskId: 'task-1',
              },
            ],
            recommendedEntry: {
              label: 'Retomar briefing',
              reason: 'Existe uma entrega reutilizavel.',
            },
          },
          handoff: {
            handoffPrompt: 'Retome o briefing final.',
          },
          tasks: [
            {
              task_id: 'task-1',
              updated_at: '2026-04-02T11:58:00.000Z',
              workspace: 'C:/repo',
              artifacts: [
                {
                  id: 'artifact-1',
                  name: 'briefing-final.md',
                  kind: 'doc',
                  summary: 'Briefing consolidado.',
                  path: 'artifacts/briefing-final.md',
                  createdAt: '2026-04-02T11:58:00.000Z',
                },
              ],
            },
          ],
        })),
        buildSnapshotFast: jest.fn(() => ({
          sessionId: 'session-1',
          chatId: 'web:session-1',
          runtimeUserId: 'user-1',
          continuity: {},
          replay: null,
          handoff: null,
          tasks: [],
        })),
      } as any,
      memoryService: {
        listAll: jest.fn(async () => [
          {
            key: 'workspace-focus',
            value: 'Consolidar briefing final.',
            category: 'workspace',
            created_at: '2026-04-02T11:00:00.000Z',
            updated_at: '2026-04-02T11:30:00.000Z',
          },
        ]),
        listRelevant: jest.fn(async () => [
          {
            key: 'ship-workflow',
            value: 'Workflow ship costuma terminar com review final.',
            category: 'workflow',
            created_at: '2026-04-02T11:10:00.000Z',
            updated_at: '2026-04-02T11:40:00.000Z',
          },
        ]),
      } as any,
      workspaceOperationalMemoryService: {
        getMemory: jest.fn(async () => ({
          workspace: 'C:/repo',
          summary: 'Workspace com briefing final e recomendacao de ship.',
          recent_artifacts: [
            {
              name: 'briefing-final.md',
              kind: 'doc',
              summary: 'Briefing consolidado.',
              created_at: '2026-04-02T11:58:00.000Z',
            },
          ],
          continuity_recommendations: [
            {
              label: 'Retomar briefing final',
              reason: 'Existe uma entrega reaproveitavel.',
              kind: 'resume',
            },
          ],
          workflow_recommendations: [
            {
              workflow: 'ship',
              rationale: 'O contexto ja esta em ponto de entrega.',
            },
          ],
        })),
      } as any,
    });

    const snapshot = await service.buildSnapshot({
      userId: 'user-1',
      sessionId: 'session-1',
      chatId: 'web:session-1',
      platform: 'web',
    });

    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        persistedMemories: 1,
        relevantMemories: 1,
        replayTasks: 2,
        workflowRuns: 1,
        artifacts: 1,
        workspaceSignals: 3,
        timelineEvents: 4,
        historicalEvents: 1,
        changedFacts: 0,
      }),
    );
    expect(snapshot.memory.recent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'workspace-focus',
          category: 'workspace',
        }),
      ]),
    );
    expect(snapshot.artifacts.recent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'briefing-final.md',
        }),
      ]),
    );
    expect(snapshot.workspace).toEqual(
      expect.objectContaining({
        workspace: 'C:/repo',
        summary: 'Workspace com briefing final e recomendacao de ship.',
      }),
    );
    expect(snapshot.timeline.recent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'memory',
          status: 'current',
          label: 'workspace-focus',
        }),
        expect.objectContaining({
          kind: 'memory',
          status: 'historical',
          label: 'ship-workflow',
        }),
        expect.objectContaining({
          kind: 'artifact',
          label: 'briefing-final.md',
        }),
      ]),
    );
    expect(snapshot.suggestedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'artifact',
        }),
      ]),
    );
  });

  it('keeps the fast snapshot lightweight and honest', () => {
    const service = new ZavorthMemoryPlaneService({
      gatewaySessionReadModelService: {
        buildSnapshotFast: jest.fn(() => ({
          sessionId: 'session-1',
          chatId: 'web:session-1',
          runtimeUserId: 'user-1',
          continuity: {},
          replay: null,
          handoff: null,
          tasks: [],
        })),
      } as any,
    });

    const snapshot = service.buildSnapshotFast({
      userId: 'user-1',
      sessionId: 'session-1',
      chatId: 'web:session-1',
    });

    expect(snapshot.summary.persistedMemories).toBe(0);
    expect(snapshot.summary.artifacts).toBe(0);
    expect(snapshot.memory.recent).toEqual([]);
    expect(snapshot.timeline.recent).toEqual([]);
    expect(snapshot.timeline.conflicts).toEqual([]);
    expect(snapshot.workspace).toBeNull();
  });

  it('keeps changed facts visible through timeline conflicts', async () => {
    const service = new ZavorthMemoryPlaneService({
      memoryService: {
        listAll: jest.fn(async () => [
          {
            key: 'workspace-focus',
            value: 'Entregar o dashboard do runtime.',
            category: 'workspace',
            created_at: '2026-04-02T11:00:00.000Z',
            updated_at: '2026-04-02T11:30:00.000Z',
          },
        ]),
        listRelevant: jest.fn(async () => [
          {
            key: 'workspace-focus',
            value: 'Consolidar o provider plane.',
            category: 'workspace',
            created_at: '2026-04-01T11:00:00.000Z',
            updated_at: '2026-04-01T11:30:00.000Z',
          },
        ]),
        listHistoricalRelevant: jest.fn(async () => []),
      } as any,
    });

    const snapshot = await service.buildSnapshot({
      userId: 'user-1',
      workspaceHint: 'C:/repo',
    });

    expect(snapshot.summary.changedFacts).toBe(1);
    expect(snapshot.timeline.conflicts).toEqual([
      expect.objectContaining({
        key: 'workspace-focus',
        currentValue: 'Entregar o dashboard do runtime.',
        previousValue: 'Consolidar o provider plane.',
      }),
    ]);
    expect(snapshot.suggestedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'memory-conflict-review',
        }),
      ]),
    );
    expect(snapshot.narrative.operatorSummary).toContain('1 fato(s) mudaram');
  });

  it('uses persisted historical memory when the current relevant set is empty', async () => {
    const service = new ZavorthMemoryPlaneService({
      memoryService: {
        listAll: jest.fn(async () => [
          {
            key: 'provider-profile',
            value: 'coding',
            category: 'preferencia',
            created_at: '2026-04-02T11:00:00.000Z',
            updated_at: '2026-04-02T11:30:00.000Z',
          },
        ]),
        listRelevant: jest.fn(async () => []),
        listHistoricalRelevant: jest.fn(async () => [
          {
            key: 'provider-profile',
            value: 'balanced',
            category: 'preferencia',
            created_at: '2026-04-01T10:00:00.000Z',
            updated_at: '2026-04-01T10:30:00.000Z',
            archived_at: '2026-04-02T11:31:00.000Z',
            event_type: 'superseded',
          },
        ]),
      } as any,
    });

    const snapshot = await service.buildSnapshot({
      userId: 'user-1',
      workspaceHint: 'C:/repo',
    });

    expect(snapshot.summary.relevantMemories).toBe(1);
    expect(snapshot.summary.changedFacts).toBe(1);
    expect(snapshot.timeline.recent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'memory',
          status: 'historical',
          label: 'provider-profile',
          source: 'memory.history',
        }),
      ]),
    );
    expect(snapshot.timeline.latestHistoricalAt).toBe('2026-04-02T11:31:00.000Z');
  });
});
