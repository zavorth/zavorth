import { buildZavorthControlZavorthControlViewModel } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/adapters/ZavorthControlAdapter.js'
import { buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/projections/zavorthAgentGatewayRuntimeProjection.js';
import { ZavorthAgentGateway } from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-memory-${++index}`;
}

describe('ZavorthControl Memory With Receipts Memory Receipts', () => {
  it('projects memoryWithReceipts metadata into the zavorthControl view model', () => {
    const viewModel = buildZavorthControlZavorthControlViewModel({
      runtime: {
        status: 'ready',
      },
      wsStatus: 'connected',
      agentRun: {
        id: 'run-memory',
        status: 'completed',
        metadata: {
          memoryWithReceipts: {
            contractVersion: '2026-05-03.memory-receipts',
            generatedAt: '2026-05-03T23:30:00.000Z',
            identifiers: {
              runId: 'run-memory',
              traceId: 'trace-memory',
              requestId: 'request-memory',
              sessionId: 'session-memory',
            },
            summary: {
              memoryCount: 1,
              receiptCount: 1,
              layers: ['semantic'],
              averageConfidence: 0.86,
              lowConfidenceCount: 0,
            },
            receipts: [
              {
                id: 'memory-receipt:preference',
                memoryId: 'preference',
                title: 'Preferencia',
                layer: 'semantic',
                summary: 'Usuario prefere resumo curto.',
                source: 'memory-signal',
                sourceType: 'run-observatory',
                createdAt: '2026-05-03T23:30:00.000Z',
                confidence: 0.86,
                confidenceLabel: 'high',
                observatoryReceiptId: 'receipt:preference',
                origin: {
                  kind: 'memory',
                  ref: 'session-memory',
                },
                actions: {
                  reviewCommand: 'zavorth memory receipts run run-memory',
                  askSourceCommand: 'zavorth memory source preference',
                  forgetCommand: 'zavorth memory forget preference',
                  correctCommand: 'zavorth memory correct preference "<novo valor>"',
                },
              },
            ],
            audit: {
              allMemoryHasReceipt: true,
              canAnswerSourceQuestion: true,
              canForgetOrCorrect: true,
              runObservatoryLinked: true,
              noMemoryInvented: true,
            },
            surface: {
              cliCommand: 'zavorth memory receipts run run-memory --json',
              zavorthControlPath: '/control?sector=dreams',
              sourceQuestionHint: 'Pergunte de onde veio.',
            },
            nextSafeAction: 'Pode responder citando a memoria.',
          },
        },
      },
    });

    expect(viewModel.memoryWithReceipts).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.memory-receipts',
      summary: expect.objectContaining({
        receiptCount: 1,
      }),
      audit: expect.objectContaining({
        noMemoryInvented: true,
      }),
    }));
    expect(viewModel.memoryWithReceipts?.receipts[0]).toEqual(expect.objectContaining({
      sourceType: 'run-observatory',
      actions: expect.objectContaining({
        forgetCommand: 'zavorth memory forget preference',
      }),
    }));
  });

  it('maps gateway snapshots with memory receipts into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-03T23:35:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed',
        summary: 'ok',
        replyText: 'ok',
        memorySignals: [
          {
            id: 'memory-tone',
            title: 'Tom',
            layer: 'semantic',
            summary: 'Responder em portugues curto.',
            confidence: 0.9,
          },
        ],
      }),
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-cc-memory',
      text: 'gere um resumo operacional com origem',
      requestedTools: ['workspace.read'],
    });
    const projection = buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.memoryWithReceipts).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.memory-receipts',
      audit: expect.objectContaining({
        allMemoryHasReceipt: true,
        runObservatoryLinked: true,
      }),
    }));
    expect(projection.memoryWithReceipts?.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        memoryId: 'memory-tone',
        confidenceLabel: 'high',
      }),
    ]));
  });
});
