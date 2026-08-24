import {
  RUN_OBSERVATORY_CONTRACT_VERSION,
  ZavorthAgentGateway,
  type UniversalAgentExecutor,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-observatory-${++index}`;
}

describe('Run Observatory Run Observatory', () => {
  it('projects runs into receipts, timeline, replay and health without creating a parallel pipeline', async () => {
    const executor: UniversalAgentExecutor = ({ request, run }) => ({
      status: request.text.includes('falhe') ? 'failed' : 'completed',
      summary: request.text.includes('falhe')
        ? 'Falha observavel registrada.'
        : 'Relatorio observavel pronto.',
      replyText: 'Run registrada no observatory.',
      events: [
        {
          kind: request.text.includes('falhe') ? 'error' : 'tool',
          title: request.text.includes('falhe') ? 'Executor falhou' : 'workspace_scan',
          detail: request.text.includes('falhe')
            ? 'Erro controlado para health degraded.'
            : 'Workspace analisado em modo leitura.',
          status: request.text.includes('falhe') ? 'failed' : 'done',
          metadata: request.text.includes('falhe') ? undefined : {
            planId: 'plan-diff-preview-1',
            status: 'applied',
            approvalRequired: false,
            diffReceiptText: [
              'Previa de alteracao',
              'Resumo: 1 arquivo, 1 hunk, Risk 3 reversivel.',
              'Apply: so com pedido explicito.',
            ].join('\n'),
            rollbackArtifactPath: 'data/runtime/intelligence-fabric-rollbacks/plan-diff-preview-1/rollback.json',
            diffReceipt: {
              summary: '1 arquivo, 1 hunk, Risk 3 reversivel.',
              files: [
                {
                  path: 'notes/preview.txt',
                  operation: 'patch',
                  status: 'passed',
                  hunkCount: 1,
                },
              ],
            },
          },
        },
      ],
      artifacts: request.text.includes('falhe') ? [] : [
        {
          id: 'artifact-observatory-1',
          title: 'Relatorio observavel',
          kind: 'report',
          createdAt: run.createdAt,
          sessionId: run.sessionId,
          status: 'ready',
        },
      ],
      memorySignals: request.text.includes('falhe') ? [] : [
        {
          id: 'memory-observatory-1',
          title: 'Preferencia de observabilidade',
          layer: 'procedural',
          summary: 'Runs devem gerar receipts auditaveis.',
          confidence: 0.92,
        },
      ],
    });
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-03T19:00:00.000Z'),
      idFactory: createIdFactory(),
      defaultProviderLabel: 'OpenAI',
      defaultModelLabel: 'gpt-4o',
      executor,
    });

    const completed = await gateway.handle({
      requestId: 'request-observatory-product-a',
      traceId: 'trace-observatory-product-a',
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-observatory-product',
      text: 'gere relatorio observavel',
      requestedTools: ['read_file'],
    });
    const failed = await gateway.handle({
      requestId: 'request-observatory-product-b',
      traceId: 'trace-observatory-product-b',
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-observatory-product',
      text: 'falhe de forma observavel',
      requestedTools: [],
    });

    const snapshot = gateway.queryRuns({ limit: 10 });

    expect(snapshot.contractVersion).toBe(RUN_OBSERVATORY_CONTRACT_VERSION);
    expect(snapshot.summary).toEqual(expect.objectContaining({
      totalRuns: 2,
      matchedRuns: 2,
      artifactCount: 1,
      memorySignalCount: 1,
      failedRunCount: 1,
      receiptCount: expect.any(Number),
    }));
    expect(snapshot.health).toEqual(expect.objectContaining({
      status: 'degraded',
      replayAvailable: true,
      receiptsAvailable: true,
    }));
    expect(snapshot.intelligenceFabricHealth).toEqual(expect.objectContaining({
      contractVersion: 'zavorth-intelligence-fabric-post-default-health/v1',
      recommendation: expect.stringMatching(/maintain_default|observe|auto_demote_controlled/),
      rollback: expect.objectContaining({
        available: true,
        demoteMode: 'disabled',
        destructive: false,
      }),
      summary: expect.objectContaining({
        runs: 2,
        fabricRuns: 2,
      }),
    }));
    expect(snapshot.sidecars).toEqual(expect.objectContaining({
      health: expect.any(Array),
      receipts: expect.objectContaining({
        contractVersion: 'sidecar-execution-receipts/v1',
        recentReceipts: expect.any(Array),
      }),
      summary: expect.objectContaining({
        totalSidecars: expect.any(Number),
        recentReceiptCount: expect.any(Number),
      }),
    }));
    expect(snapshot.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        runId: completed.run.id,
        kind: 'artifact',
        title: 'Relatorio observavel',
      }),
      expect.objectContaining({
        runId: completed.run.id,
        kind: 'budget',
        source: 'RunBudgetPolicy',
      }),
      expect.objectContaining({
        runId: failed.run.id,
        kind: 'error',
        status: 'failed',
      }),
      expect.objectContaining({
        runId: completed.run.id,
        kind: 'capability',
        source: 'CapabilityLoopGovernanceService',
      }),
    ]));
    expect(snapshot.timeline.length).toBe(snapshot.receipts.length);
    expect(snapshot.replay).toEqual(expect.objectContaining({
      available: true,
      receiptCount: snapshot.receipts.length,
      commandHints: expect.arrayContaining(['zavorth observatory --json']),
    }));
    expect(snapshot.diffPreviews).toEqual([
      expect.objectContaining({
        planId: 'plan-diff-preview-1',
        title: 'Previa de change',
        applied: true,
        actions: expect.objectContaining({
          approveApplyLabel: 'Applied',
          rollbackArtifactPath: 'data/runtime/intelligence-fabric-rollbacks/plan-diff-preview-1/rollback.json',
        }),
        files: [
          expect.objectContaining({
            path: 'notes/preview.txt',
            operation: 'patch',
            hunkCount: 1,
          }),
        ],
      }),
    ]);

    const failedOnly = gateway.queryRuns({ status: 'failed' });
    expect(failedOnly.runs).toEqual([
      expect.objectContaining({
        run: expect.objectContaining({
          id: failed.run.id,
          traceId: 'trace-observatory-product-b',
        }),
        matchedBy: ['status'],
      }),
    ]);
    expect(failedOnly.surface.zavorthControlPath).toContain('status=failed');
  });
});
