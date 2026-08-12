import { HybridMemoryService } from '../../src/services/HybridMemoryService.js';

describe('HybridMemoryService', () => {
  it('keeps ledger sources authoritative while adding vector recall as support', async () => {
    const vectorStore = {
      count: jest.fn(() => 1),
      searchSemantic: jest.fn(() => [
        {
          id: 'chunk-1',
          sessionId: 'session-web-1',
          createdAt: '2026-04-14T10:00:00.000Z',
          originalTokenCount: 1200,
          compressedSummary: 'Historico comprimido sobre gateway approval e mutation plan.',
          keywords: ['gateway', 'approval', 'mutation'],
          relevanceScore: 0.91,
          embedding: [0.1, 0.2, 0.3],
        },
      ]),
      search: jest.fn(() => []),
    };
    const service = new HybridMemoryService({
      now: () => new Date('2026-04-14T12:00:00.000Z'),
      layeredMemory: {
        search: jest.fn(async () => ({
          generatedAt: '2026-04-14T12:00:00.000Z',
          query: 'gateway approval',
          total: 1,
          data: [
            {
              id: 'session:approval-ledger',
              label: 'Approval ledger',
              summary: 'Capability pesada precisa de approval antes de ativar.',
              memoryLayer: 'episodic',
              source: 'memory-plane',
              confidence: 0.92,
              lastValidatedAt: '2026-04-14T11:00:00.000Z',
              metadata: {
                status: 'current',
              },
            },
          ],
        })),
        readProcedures: jest.fn(),
      },
      memoryPlane: null,
      embeddingService: {
        generate: jest.fn(async () => [0.1, 0.2, 0.3]),
      },
      vectorStore,
    });

    const recall = await service.previewRecall({
      sessionId: 'session-web-1',
      userId: 'telegram-admin',
      platform: 'web',
      query: 'gateway approval',
      limit: 4,
    });

    expect(recall).toEqual(
      expect.objectContaining({
        ok: true,
        contractVersion: 'hybrid-memory-v1',
        mode: 'hybrid',
        embeddingStatus: 'ready',
        summary: expect.objectContaining({
          ledger: 1,
          recall: 1,
          ledgerAuthoritative: true,
        }),
      }),
    );
    expect(recall.sources[0]).toEqual(
      expect.objectContaining({
        type: 'ledger',
        label: 'Approval ledger',
      }),
    );
    expect(recall.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'recall',
          kind: 'vector',
          metadata: expect.objectContaining({
            hasEmbedding: true,
          }),
        }),
      ]),
    );
    expect(recall.context).toContain('Approval ledger');
    expect(vectorStore.searchSemantic).toHaveBeenCalledWith([0.1, 0.2, 0.3], 8, ['gateway', 'approval']);
    expect(vectorStore.search).not.toHaveBeenCalled();
  });

  it('falls back to ledger-only when embeddings and vector store are unavailable', async () => {
    const service = new HybridMemoryService({
      now: () => new Date('2026-04-14T12:00:00.000Z'),
      layeredMemory: {
        search: jest.fn(async () => ({
          generatedAt: '2026-04-14T12:00:00.000Z',
          query: 'artifact',
          total: 1,
          data: [
            {
              id: 'artifact:diff',
              label: 'Diff artifact',
              summary: 'Patch consolidado ficou visivel no artifact plane.',
              memoryLayer: 'episodic',
              source: 'artifact-plane',
              confidence: 0.81,
              lastValidatedAt: '2026-04-14T11:00:00.000Z',
              metadata: {},
            },
          ],
        })),
        readProcedures: jest.fn(),
      },
      memoryPlane: null,
      embeddingService: {
        generate: jest.fn(async () => {
          throw new Error('gemini key ausente');
        }),
      },
      createVectorStore: null,
    });

    const recall = await service.previewRecall({
      sessionId: 'session-web-1',
      query: 'artifact',
    });

    expect(recall.mode).toBe('ledger_only');
    expect(recall.embeddingStatus).toBe('failed');
    expect(recall.sources).toEqual([
      expect.objectContaining({
        type: 'ledger',
        label: 'Diff artifact',
      }),
    ]);
    expect(recall.warnings.join(' ')).toContain('Embeddings indisponiveis');
  });

  it('keeps keyword recall compatible when semantic embeddings fail', async () => {
    const vectorStore = {
      count: jest.fn(() => 1),
      searchSemantic: jest.fn(() => []),
      search: jest.fn(() => [
        {
          id: 'chunk-keyword',
          sessionId: 'session-web-1',
          createdAt: '2026-04-14T10:00:00.000Z',
          originalTokenCount: 450,
          compressedSummary: 'Historico comprimido sobre artifact approval.',
          keywords: ['artifact', 'approval'],
          relevanceScore: 0.62,
        },
      ]),
    };
    const service = new HybridMemoryService({
      now: () => new Date('2026-04-14T12:00:00.000Z'),
      layeredMemory: null,
      memoryPlane: null,
      embeddingService: {
        generate: jest.fn(async () => {
          throw new Error('gemini indisponivel');
        }),
      },
      vectorStore,
    });

    const recall = await service.previewRecall({
      sessionId: 'session-web-1',
      query: 'artifact approval',
      limit: 4,
    });

    expect(recall.mode).toBe('hybrid');
    expect(recall.embeddingStatus).toBe('failed');
    expect(recall.sources).toEqual([
      expect.objectContaining({
        type: 'recall',
        label: 'Compressed memory chunk-keyword',
      }),
    ]);
    expect(vectorStore.search).toHaveBeenCalledWith(['artifact', 'approval'], 8);
  });

  it('lists source inventory without requiring a vector backend', async () => {
    const service = new HybridMemoryService({
      now: () => new Date('2026-04-14T12:00:00.000Z'),
      layeredMemory: {
        search: jest.fn(),
        readProcedures: jest.fn(),
      },
      memoryPlane: {
        buildSnapshot: jest.fn(async () => ({
          generatedAt: '2026-04-14T12:00:00.000Z',
          summary: {
            persistedMemories: 2,
            relevantMemories: 1,
            replayTasks: 0,
            workflowRuns: 0,
            artifacts: 1,
            workspaceSignals: 0,
            timelineEvents: 3,
            historicalEvents: 0,
            changedFacts: 0,
          },
          memory: { recent: [], relevant: [], categories: [], vectorRecall: false },
          timeline: { recent: [], conflicts: [], latestHistoricalAt: null },
          replay: null,
          artifacts: { recent: [], kinds: [], latestLabel: null, reusableCount: 0 },
          workspace: null,
          suggestedActions: [],
          narrative: { headline: 'Memory', operatorSummary: 'ok' },
        } as any)),
      },
      createVectorStore: null,
    });

    const sources = await service.listSources({ sessionId: 'session-web-1' });

    expect(sources.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ledger:session', status: 'available', count: 3 }),
        expect.objectContaining({ id: 'ledger:memory', status: 'available', count: 3 }),
        expect.objectContaining({ id: 'recall:vector', status: 'unavailable', count: 0 }),
      ]),
    );
  });
});
