import {
  AgentRunService,
  MEMORY_WITH_RECEIPTS_CONTRACT_VERSION,
  NATURAL_FIRST_MEMORY_CONTINUITY_CONTRACT_VERSION,
} from '../../../src/runtime/agent/index.js';
import type { UniversalAgentExecutor } from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-memory-receipts-${++index}`;
}

describe('AgentRunService Memory With Receipts Memory Receipts', () => {
  it('attaches memoryWithReceipts after executor returns memory signals', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'I used memory with source attribution.',
      replyText: 'Your preference is short replies.',
      memorySignals: [
        {
          id: 'memory-short-portuguese',
          title: 'Response preference',
          layer: 'semantic',
          summary: 'User prefers short replies in English.',
          confidence: 0.91,
        },
      ],
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-05-03T23:05:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-memory-receipts',
      text: 'generate an operational summary with source attribution',
      requestedTools: ['workspace.read'],
    });

    const snapshot = result.run.metadata.memoryWithReceipts as any;
    expect(result.run.status).toBe('completed');
    expect(snapshot).toEqual(
      expect.objectContaining({
        contractVersion: MEMORY_WITH_RECEIPTS_CONTRACT_VERSION,
        audit: expect.objectContaining({
          allMemoryHasReceipt: true,
          canForgetOrCorrect: true,
          runObservatoryLinked: true,
        }),
      }),
    );
    expect(snapshot.receipts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memoryId: 'memory-short-portuguese',
          actions: expect.objectContaining({
            forgetCommand: 'zavorth memory forget memory-short-portuguese',
          }),
        }),
      ]),
    );
  });

  it('attaches canonical context memory receipt on createRun', () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-03T23:07:00.000Z'),
      idFactory: createIdFactory(),
    });

    const run = service.createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-create-memory-receipts',
      text: 'continue from where we left off',
      metadata: {
        memoryPrompt: 'The last delivery finished at Safety Narrative.',
      },
    });

    const snapshot = run.metadata.memoryWithReceipts as any;
    expect(snapshot).toEqual(
      expect.objectContaining({
        contractVersion: MEMORY_WITH_RECEIPTS_CONTRACT_VERSION,
        summary: expect.objectContaining({
          memoryCount: 1,
        }),
      }),
    );
    expect(snapshot.receipts[0]).toEqual(
      expect.objectContaining({
        memoryId: `canonical-context:${run.id}`,
        sourceType: 'canonical-context',
      }),
    );
  });

  it('answers memory recall from receipted canonical memory without calling the executor', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Executor should not respond to recall.',
      replyText: 'executor-called',
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-05-11T14:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-natural-memory',
      text: 'how did we fix that permission error-',
      requestedTools: [],
      metadata: {
        memoryPrompt: 'We fixed the permission error by running the terminal in the correct workspace and avoiding sudo.',
      },
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.run.status).toBe('completed');
    expect(result.run.metadata.memoryWithReceipts).toEqual(
      expect.objectContaining({
        contractVersion: MEMORY_WITH_RECEIPTS_CONTRACT_VERSION,
        summary: expect.objectContaining({
          memoryCount: 1,
        }),
      }),
    );
    expect(result.run.metadata.naturalFirstMemoryContinuity).toEqual(
      expect.objectContaining({
        contractVersion: NATURAL_FIRST_MEMORY_CONTINUITY_CONTRACT_VERSION,
        stage: 6,
        route: 'memory-recall',
        status: 'memory-cited',
        memoryWithReceiptsLinked: true,
        receiptCount: 1,
        policy: expect.objectContaining({
          noMemoryInvented: true,
          citeOnlyReceiptedMemory: true,
          noToolExecution: true,
        }),
      }),
    );
    expect(result.replies[0].text).toContain('Found memory with recorded source attribution');
    expect(result.replies[0].text).toContain('We fixed the permission error');
  });

  it('answers memory recall honestly when no memory source is available', async () => {
    const executor = jest.fn(() => ({
      status: 'completed' as const,
      summary: 'No receipted memory was available; the model answered without claiming recall.',
      replyText: 'I do not have a receipted memory for that deployment.',
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-05-11T14:05:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-empty-memory',
      text: 'what did we agree on about that deploy-',
      requestedTools: [],
    });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.run.status).toBe('completed');
    expect(result.run.metadata.memoryWithReceipts).toBeUndefined();
    expect(result.run.metadata.naturalFirstMemoryContinuity).toBeUndefined();
    expect(result.replies[0].text).toContain('do not have a receipted memory');
  });
});
