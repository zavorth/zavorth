import {
  MEMORY_WITH_RECEIPTS_CONTRACT_VERSION,
  MemoryWithReceiptsService,
  type UniversalAgentRun,
} from '../../../src/runtime/agent/index.js';

function createRun(overrides: Partial<UniversalAgentRun> = {}): UniversalAgentRun {
  return {
    id: 'run-memory-receipts-1',
    traceId: 'trace-memory-receipts-1',
    requestId: 'request-memory-receipts-1',
    sessionId: 'session-memory-receipts-1',
    userId: 'grey',
    channel: 'cli',
    title: 'Memory receipts run',
    input: 'use minha memoria do projeto',
    status: 'completed',
    createdAt: '2026-05-03T23:00:00.000Z',
    updatedAt: '2026-05-03T23:00:00.000Z',
    summary: 'Resposta baseada em memoria.',
    events: [],
    toolExposure: {
      mode: 'read_only',
      summary: 'read-only',
      tools: [],
    },
    replyPorts: [],
    modelProfile: {
      providerLabel: 'provider',
      modelLabel: 'model',
      routingPolicy: 'direct',
    },
    approvals: [],
    artifacts: [],
    memorySignals: [
      {
        id: 'memory-project-tone',
        title: 'Preferencia de tom',
        layer: 'semantic',
        summary: 'Usuario prefere respostas curtas em portugues.',
        confidence: 0.88,
      },
      {
        id: 'memory-open-task',
        title: 'Tarefa aberta',
        layer: 'episodic',
        summary: 'Memory Receipts esta focada em receipts de memoria.',
        confidence: 0.42,
      },
    ],
    metadata: {},
    ...overrides,
  };
}

describe('MemoryWithReceiptsService Memory Receipts', () => {
  it('builds receipts with origin, confidence and forget/correct actions for memory signals', () => {
    const snapshot = new MemoryWithReceiptsService({
      now: () => new Date('2026-05-03T23:01:00.000Z'),
    }).buildSnapshot({
      run: createRun(),
    });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: MEMORY_WITH_RECEIPTS_CONTRACT_VERSION,
      source: 'MemoryWithReceiptsService',
      summary: expect.objectContaining({
        memoryCount: 2,
        receiptCount: 2,
        lowConfidenceCount: 1,
      }),
      audit: expect.objectContaining({
        allMemoryHasReceipt: true,
        canAnswerSourceQuestion: true,
        canForgetOrCorrect: true,
        runObservatoryLinked: true,
        noMemoryInvented: true,
      }),
    }));
    expect(snapshot.receipts[0]).toEqual(expect.objectContaining({
      memoryId: 'memory-project-tone',
      source: 'memory-signal',
      sourceType: 'run-observatory',
      confidenceLabel: 'high',
      observatoryReceiptId: 'receipt:memory-project-tone',
      actions: expect.objectContaining({
        forgetCommand: 'zavorth memory forget memory-project-tone',
        correctCommand: 'zavorth memory correct memory-project-tone "<novo valor>"',
      }),
    }));
    expect(snapshot.surface.sourceQuestionHint).toContain('de onde');
  });

  it('creates a receipt for canonical context memory prompts', () => {
    const snapshot = new MemoryWithReceiptsService().buildSnapshot({
      run: createRun({
        memorySignals: [],
        metadata: {
          canonicalContext: {
            memoryPrompt: 'Projeto Zavorth usa gateway unico e receipts auditaveis.',
          },
          coldContext: {
            memoryContext: {
              label: 'mnemos',
              sourceType: 'file',
              sourceFile: 'memory/zavorth.md',
            },
            confidence: 0.67,
          },
        },
      }),
      generatedAt: '2026-05-03T23:02:00.000Z',
    });

    expect(snapshot.summary.memoryCount).toBe(1);
    expect(snapshot.receipts[0]).toEqual(expect.objectContaining({
      memoryId: 'canonical-context:run-memory-receipts-1',
      title: 'Contexto de memoria canonico',
      source: 'mnemos',
      sourceType: 'file',
      origin: expect.objectContaining({
        kind: 'file',
        ref: 'memory/zavorth.md',
      }),
    }));
  });
});
