import { ZavorthControlService } from '../../src/services/ZavorthControlService.js';
import {
  createTestLogRepo,
  fetchZavorthControlJson,
} from '../helpers/controlWebTestUtils.js';

describe('ZavorthControl memory plane endpoint', () => {
  const logRepo = createTestLogRepo();

  it('serves the official memory plane through operations endpoint', async () => {
    const memoryPlaneService = {
      buildSnapshot: jest.fn(async () => ({
        generatedAt: '2026-04-02T12:00:00.000Z',
        summary: {
          persistedMemories: 2,
          relevantMemories: 1,
          replayTasks: 3,
          workflowRuns: 1,
          artifacts: 2,
          workspaceSignals: 4,
          timelineEvents: 3,
          historicalEvents: 1,
          changedFacts: 1,
        },
        memory: {
          recent: [],
          relevant: [],
          categories: ['workflow'],
          vectorRecall: true,
        },
        timeline: {
          recent: [],
          conflicts: [],
          latestHistoricalAt: null,
        },
        replay: {
          headline: 'Replay pronto.',
        },
        artifacts: {
          recent: [],
          kinds: ['doc'],
          latestLabel: 'briefing-final.md',
          reusableCount: 2,
        },
        workspace: {
          workspace: 'C:/repo',
          summary: 'Workspace pronto para entrega.',
          recentArtifacts: [],
          continuityRecommendations: [],
          workflowRecommendations: [],
        },
        suggestedActions: [],
        narrative: {
          headline: 'Retomada e entregas prontas.',
          operatorSummary: 'Snapshot oficial do memory plane.',
        },
      })),
    };
    const service = new ZavorthControlService(logRepo, {
      memoryPlaneService: memoryPlaneService as any,
    });

    await service.start();
    const { status, payload } = await fetchZavorthControlJson(
      service.getUrl(),
      '/api/operations/memory-plane',
    );

    await service.stopAsync();

    expect(status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        available: true,
        narrative: expect.objectContaining({
          headline: 'Retomada e entregas prontas.',
          operatorSummary: 'Snapshot oficial do memory plane.',
        }),
        summary: expect.objectContaining({
          persistedMemories: 2,
          artifacts: 2,
        }),
      }),
    );
  });
});
