import { ZavorthLayeredMemoryService } from '../../src/services/ZavorthLayeredMemoryService.js';

describe('ZavorthLayeredMemoryService', () => {
  it('builds layered status across episodic, semantic and procedural memory', async () => {
    const service = new ZavorthLayeredMemoryService({
      now: () => new Date('2026-04-09T15:00:00.000Z'),
      memoryPlaneService: {
        buildSnapshot: jest.fn(async () => ({
          timeline: {
            recent: [
              {
                id: 'timeline-1',
                label: 'Retomar ship',
                summary: 'Workflow finalizado com sucesso.',
                source: 'workflow',
                status: 'current',
                happenedAt: '2026-04-09T14:30:00.000Z',
                kind: 'workflow',
                category: 'ship',
              },
            ],
          },
          replay: {
            timeline: [
              {
                id: 'timeline-2',
                label: 'Replay anterior',
                summary: 'Ultimo handoff.',
                source: 'replay',
                status: 'historical',
                happenedAt: '2026-04-09T14:10:00.000Z',
                kind: 'handoff',
                category: 'session',
              },
            ],
          },
        })),
      } as any,
      memoryService: {
        listAll: jest.fn(async () => [
          {
            id: 1,
            user_id: 'alice',
            key: 'preferred-release-channel',
            value: 'stable',
            category: 'preference',
            created_at: '2026-04-09T13:00:00.000Z',
            updated_at: '2026-04-09T14:00:00.000Z',
          },
        ]),
        listRelevant: jest.fn(async () => []),
        listHistoricalRelevant: jest.fn(async () => []),
      } as any,
      learningPlaneService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-09T15:00:00.000Z',
          summary: {
            total: 1,
            pending: 0,
            approved: 1,
            rejected: 0,
            promoted: 1,
            published: 0,
            quarantined: 0,
            highConfidence: 1,
          },
          candidates: [
            {
              id: 'candidate:wf-1',
              platformEntryId: 'skill:learned:ship:demo:wf-1',
              title: 'Ship playbook para demo',
              kind: 'playbook',
              summary: 'Validated publiction procedure.',
              score: 0.91,
              reviewState: 'approved',
              lifecycle: 'trusted_local',
              createdAt: '2026-04-09T14:00:00.000Z',
              updatedAt: '2026-04-09T14:40:00.000Z',
              lastValidatedAt: '2026-04-09T14:40:00.000Z',
              source: {
                workflowRunId: 'wf-1',
                workflow: 'ship',
                workspace: 'C:/repo/demo',
                objective: 'Publicar release.',
                artifactCount: 1,
                completedStages: 2,
                totalStages: 2,
                originTaskId: 'task-1',
                sourceSurface: 'web',
              },
              steps: ['Inspect runtime', 'Publish release'],
              details: [],
            },
          ],
          narrative: {
            headline: 'Learning ready.',
            operatorSummary: '1 item promovido.',
          },
        })),
      } as any,
      workflowRunService: {
        listRuns: jest.fn(() => []),
      } as any,
    });

    const status = await service.buildStatus({
      userId: 'alice',
      sessionId: 'session-1',
      chatId: 'web:session-1',
      platform: 'web',
      workspaceHint: 'C:/repo/demo',
    });

    expect(status.summary).toEqual(
      expect.objectContaining({
        total: 4,
        episodic: 2,
        semantic: 1,
        procedural: 1,
      }),
    );
  });

  it('searches and explains recall provenance across layers', async () => {
    const service = new ZavorthLayeredMemoryService({
      now: () => new Date('2026-04-09T15:00:00.000Z'),
      memoryPlaneService: {
        buildSnapshot: jest.fn(async () => ({
          timeline: {
            recent: [
              {
                id: 'timeline-1',
                label: 'Ship release',
                summary: 'Release ready para o ambiente stable.',
                source: 'workflow',
                status: 'current',
                happenedAt: '2026-04-09T14:30:00.000Z',
                kind: 'workflow',
                category: 'ship',
              },
            ],
          },
          replay: {
            timeline: [],
          },
        })),
      } as any,
      memoryService: {
        listAll: jest.fn(async () => []),
        listRelevant: jest.fn(async () => [
          {
            id: 1,
            user_id: 'alice',
            key: 'release-channel',
            value: 'stable releases exigem smoke completo',
            category: 'policy',
            created_at: '2026-04-09T13:00:00.000Z',
            updated_at: '2026-04-09T14:00:00.000Z',
          },
        ]),
        listHistoricalRelevant: jest.fn(async () => []),
      } as any,
      learningPlaneService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-09T15:00:00.000Z',
          summary: {
            total: 1,
            pending: 1,
            approved: 0,
            rejected: 0,
            promoted: 0,
            published: 0,
            quarantined: 0,
            highConfidence: 1,
          },
          candidates: [
            {
              id: 'candidate:wf-ship',
              platformEntryId: 'skill:learned:ship:demo:wf-ship',
              title: 'Ship recipe para demo',
              kind: 'recipe',
              summary: 'Publicar release em stable.',
              score: 0.84,
              reviewState: 'pending',
              lifecycle: 'learned_draft',
              createdAt: '2026-04-09T14:00:00.000Z',
              updatedAt: '2026-04-09T14:40:00.000Z',
              lastValidatedAt: '2026-04-09T14:40:00.000Z',
              source: {
                workflowRunId: 'wf-ship',
                workflow: 'ship',
                workspace: 'C:/repo/demo',
                objective: 'Publicar release stable.',
                artifactCount: 1,
                completedStages: 2,
                totalStages: 2,
                originTaskId: 'task-ship',
                sourceSurface: 'web',
              },
              steps: ['Rodar smoke', 'Publicar stable'],
              details: [],
            },
          ],
          narrative: {
            headline: 'Learning ready.',
            operatorSummary: '1 draft disponivel.',
          },
        })),
      } as any,
      workflowRunService: {
        listRuns: jest.fn(() => []),
      } as any,
    });

    const search = await service.search({
      userId: 'alice',
      query: 'stable release',
      workspaceHint: 'C:/repo/demo',
    });
    const procedures = await service.readProcedures({
      workspaceHint: 'C:/repo/demo',
    });

    expect(search.total).toBeGreaterThanOrEqual(2);
    expect(search.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memoryLayer: 'episodic',
          source: 'workflow',
        }),
        expect.objectContaining({
          memoryLayer: 'semantic',
          source: 'memory-store',
        }),
        expect.objectContaining({
          memoryLayer: 'procedural',
          source: 'learning-plane',
        }),
      ]),
    );
    expect(procedures.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'candidate:wf-ship',
          steps: expect.arrayContaining(['Rodar smoke', 'Publicar stable']),
        }),
      ]),
    );
  });

  it('emits layered memory metrics with pressure and procedure composition', async () => {
    const service = new ZavorthLayeredMemoryService({
      now: () => new Date('2026-04-09T15:00:00.000Z'),
      memoryPlaneService: {
        buildSnapshot: jest.fn(async () => ({
          timeline: {
            recent: new Array(8).fill(null).map((_, index) => ({
              id: `timeline-${index}`,
              label: `Evento ${index}`,
              summary: 'Evento episodico.',
              source: 'workflow',
              status: 'current',
              happenedAt: '2026-04-09T14:30:00.000Z',
              kind: 'workflow',
              category: 'ship',
            })),
          },
          replay: {
            timeline: [],
          },
        })),
      } as any,
      memoryService: {
        listAll: jest.fn(async () => [
          {
            id: 1,
            user_id: 'alice',
            key: 'preferred-release-channel',
            value: 'stable',
            category: 'preference',
            created_at: '2026-04-09T13:00:00.000Z',
            updated_at: '2026-04-09T14:00:00.000Z',
          },
        ]),
        listRelevant: jest.fn(async () => []),
        listHistoricalRelevant: jest.fn(async () => []),
      } as any,
      learningPlaneService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-09T15:00:00.000Z',
          summary: {
            total: 2,
            pending: 1,
            approved: 1,
            rejected: 0,
            promoted: 1,
            published: 0,
            quarantined: 0,
            highConfidence: 1,
          },
          candidates: [
            {
              id: 'candidate:wf-1',
              platformEntryId: 'skill:learned:ship:demo:wf-1',
              title: 'Ship playbook para demo',
              kind: 'playbook',
              summary: 'Validated publiction procedure.',
              score: 0.91,
              reviewState: 'approved',
              lifecycle: 'trusted_local',
              createdAt: '2026-04-09T14:00:00.000Z',
              updatedAt: '2026-04-09T14:40:00.000Z',
              lastValidatedAt: '2026-04-09T14:40:00.000Z',
              source: {
                workflowRunId: 'wf-1',
                workflow: 'ship',
                workspace: 'C:/repo/demo',
                objective: 'Publicar release.',
                artifactCount: 1,
                completedStages: 2,
                totalStages: 2,
                originTaskId: 'task-1',
                sourceSurface: 'web',
              },
              steps: ['Inspect runtime', 'Publish release'],
              details: [],
            },
            {
              id: 'candidate:wf-2',
              platformEntryId: 'skill:learned:release:demo:wf-2',
              title: 'Release draft para demo',
              kind: 'recipe',
              summary: 'Procedimento under review.',
              score: 0.77,
              reviewState: 'pending',
              lifecycle: 'learned_draft',
              createdAt: '2026-04-09T14:10:00.000Z',
              updatedAt: '2026-04-09T14:45:00.000Z',
              lastValidatedAt: '2026-04-09T14:45:00.000Z',
              source: {
                workflowRunId: 'wf-2',
                workflow: 'release',
                workspace: 'C:/repo/demo',
                objective: 'Publicar beta.',
                artifactCount: 0,
                completedStages: 2,
                totalStages: 2,
                originTaskId: 'task-2',
                sourceSurface: 'cli',
              },
              steps: ['Run checks', 'Publish beta'],
              details: [],
            },
          ],
          narrative: {
            headline: 'Learning ready.',
            operatorSummary: '2 items available.',
          },
        })),
      } as any,
      workflowRunService: {
        listRuns: jest.fn(() => []),
      } as any,
    });

    const metrics = await service.readMetrics({
      userId: 'alice',
      workspaceHint: 'C:/repo/demo',
    });

    expect(metrics.summary).toEqual(
      expect.objectContaining({
        totalEntries: 11,
        pressure: 'elevated',
      }),
    );
    expect(metrics.procedures).toEqual(
      expect.objectContaining({
        total: 2,
        trustedLocal: 1,
        learnedDraft: 1,
        implicit: 0,
      }),
    );
  });
});
