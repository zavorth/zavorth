import { SharedSurfaceControlPlaneCommandPack } from '../../src/domain/surface/application/shared-surface/SharedSurfaceControlPlaneCommandPack';

describe('SharedSurfaceControlPlaneCommandPack', () => {
  it('routes /qa through the internal control-plane boundary', async () => {
    const qaControlPlaneService = {
      buildSnapshot: jest.fn(() => ({ summary: { posture: 'healthy' } })),
      renderReport: jest.fn(() => 'QA release: QA, budgets e release gates'),
    };
    const pack = new SharedSurfaceControlPlaneCommandPack({
      evalControlPlaneService: { buildSnapshot: jest.fn() } as any,
      qaControlPlaneService: qaControlPlaneService as any,
      governanceControlPlaneService: { buildSnapshot: jest.fn(), renderReport: jest.fn() } as any,
      replayLearningControlPlaneService: { buildSnapshot: jest.fn(), renderReport: jest.fn() } as any,
      ecosystemControlPlaneService: { buildSnapshot: jest.fn(), renderReport: jest.fn() } as any,
      distributedRuntimeControlPlaneService: { buildSnapshot: jest.fn(), renderReport: jest.fn() } as any,
      runtimeStabilityControlPlaneService: { buildSnapshot: jest.fn(), renderReport: jest.fn() } as any,
      rolloutReadinessControlPlaneService: { buildSnapshot: jest.fn(), renderReport: jest.fn() } as any,
      naturalSetupControlPlaneService: { buildSnapshot: jest.fn(), renderReport: jest.fn() } as any,
    });
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/qa beta',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    const handled = await pack.maybeHandle(ctx as any, '/qa', 'beta');

    expect(handled).toBe(true);
    expect(qaControlPlaneService.renderReport).toHaveBeenCalledWith({ profile: 'beta' });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('QA release: QA, budgets e release gates'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('policy: shared-control-plane'));
  });

  it('formats /evals using the extracted command pack', async () => {
    const pack = new SharedSurfaceControlPlaneCommandPack({
      evalControlPlaneService: {
        buildSnapshot: jest.fn(async () => ({
          summary: {
            posture: 'attention',
            scorecards: 2,
            datasets: 1,
            regressions: 1,
          },
          narrative: {
            operatorSummary: 'Uma regressao precisa de atencao.',
          },
          regressions: [{ label: 'Gateway smoke', severity: 'high' }],
          telemetry: {
            status: 'attention',
            totalEvents: 10,
            traceCount: 2,
            failureEvents: 1,
            traces: [{ source: 'telegram', status: 'failed', eventCount: 4, lastEventType: 'error' }],
            recommendation: 'Reexecutar a smoke do gateway.',
          },
          history: {
            entries: 3,
            delta: { regressions: 1, traceCount: 1 },
            trend: [{ posture: 'attention', generatedAt: '2026-04-15T10:00:00.000Z' }],
            recommendation: 'Comparar com a janela anterior.',
          },
        })),
      } as any,
      qaControlPlaneService: { buildSnapshot: jest.fn(), renderReport: jest.fn() } as any,
      governanceControlPlaneService: { buildSnapshot: jest.fn(), renderReport: jest.fn() } as any,
      replayLearningControlPlaneService: { buildSnapshot: jest.fn(), renderReport: jest.fn() } as any,
      ecosystemControlPlaneService: { buildSnapshot: jest.fn(), renderReport: jest.fn() } as any,
      distributedRuntimeControlPlaneService: { buildSnapshot: jest.fn(), renderReport: jest.fn() } as any,
      runtimeStabilityControlPlaneService: { buildSnapshot: jest.fn(), renderReport: jest.fn() } as any,
      rolloutReadinessControlPlaneService: { buildSnapshot: jest.fn(), renderReport: jest.fn() } as any,
      naturalSetupControlPlaneService: { buildSnapshot: jest.fn(), renderReport: jest.fn() } as any,
    });
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/evals surface telegram',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    const handled = await pack.maybeHandle(ctx as any, '/evals', 'surface telegram');

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Eval observability: Eval + Observability'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Maior regressao: Gateway smoke'));
  });
});
