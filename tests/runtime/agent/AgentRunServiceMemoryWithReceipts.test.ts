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

describe('AgentRunService Memory With Receipts Wave 32', () => {
  it('attaches memoryWithReceipts after executor returns memory signals', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Usei memoria com origem.',
      replyText: 'Sua preferencia e responder curto.',
      memorySignals: [
        {
          id: 'memory-short-portuguese',
          title: 'Preferencia de resposta',
          layer: 'semantic',
          summary: 'Usuario prefere respostas curtas em portugues.',
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
      text: 'gere um resumo operacional com origem',
      requestedTools: ['workspace.read'],
    });

    const snapshot = result.run.metadata.memoryWithReceipts as any;
    expect(result.run.status).toBe('completed');
    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: MEMORY_WITH_RECEIPTS_CONTRACT_VERSION,
      audit: expect.objectContaining({
        allMemoryHasReceipt: true,
        canForgetOrCorrect: true,
        runObservatoryLinked: true,
      }),
    }));
    expect(snapshot.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        memoryId: 'memory-short-portuguese',
        actions: expect.objectContaining({
          forgetCommand: 'zavorth memory forget memory-short-portuguese',
        }),
      }),
    ]));
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
      text: 'continue de onde paramos',
      metadata: {
        memoryPrompt: 'A ultima wave terminou no Safety Narrative.',
      },
    });

    const snapshot = run.metadata.memoryWithReceipts as any;
    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: MEMORY_WITH_RECEIPTS_CONTRACT_VERSION,
      summary: expect.objectContaining({
        memoryCount: 1,
      }),
    }));
    expect(snapshot.receipts[0]).toEqual(expect.objectContaining({
      memoryId: `canonical-context:${run.id}`,
      sourceType: 'canonical-context',
    }));
  });

  it('answers memory recall from receipted canonical memory without calling the executor', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Executor nao deveria responder recall.',
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
      text: 'como resolvemos aquele erro de permissao?',
      requestedTools: [],
      metadata: {
        memoryPrompt: 'Resolvemos o erro de permissao executando o terminal no workspace correto e evitando sudo.',
      },
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.run.status).toBe('completed');
    expect(result.run.metadata.memoryWithReceipts).toEqual(expect.objectContaining({
      contractVersion: MEMORY_WITH_RECEIPTS_CONTRACT_VERSION,
      summary: expect.objectContaining({
        memoryCount: 1,
      }),
    }));
    expect(result.run.metadata.naturalFirstMemoryContinuity).toEqual(expect.objectContaining({
      contractVersion: NATURAL_FIRST_MEMORY_CONTINUITY_CONTRACT_VERSION,
      phase: 6,
      route: 'memory-recall',
      status: 'memory-cited',
      memoryWithReceiptsLinked: true,
      receiptCount: 1,
      policy: expect.objectContaining({
        noMemoryInvented: true,
        citeOnlyReceiptedMemory: true,
        noToolExecution: true,
      }),
    }));
    expect(result.replies[0].text).toContain('Encontrei memoria com origem registrada');
    expect(result.replies[0].text).toContain('Resolvemos o erro de permissao');
  });

  it('answers memory recall honestly when no memory source is available', async () => {
    const executor = jest.fn();
    const service = new AgentRunService({
      now: () => new Date('2026-05-11T14:05:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-empty-memory',
      text: 'o que combinamos sobre aquele deploy?',
      requestedTools: [],
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.run.status).toBe('completed');
    expect(result.run.metadata.memoryWithReceipts).toBeUndefined();
    expect(result.run.metadata.naturalFirstMemoryContinuity).toEqual(expect.objectContaining({
      contractVersion: NATURAL_FIRST_MEMORY_CONTINUITY_CONTRACT_VERSION,
      status: 'memory-empty',
      receiptCount: 0,
      policy: expect.objectContaining({
        noMemoryInvented: true,
        citeOnlyReceiptedMemory: true,
      }),
    }));
    expect(result.replies[0].text).toContain('Ainda nao encontrei uma memoria recuperada com fonte');
  });
});
