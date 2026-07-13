import { TelegramNaturalCapabilityRoutingService } from '../../src/telegram/TelegramNaturalCapabilityRoutingService';

describe('TelegramNaturalCapabilityRoutingService (Hermes-style no free-text NLU)', () => {
  function createService() {
    const deps = {
      fileDeliveryController: {
        shouldHandleFreeForm: jest.fn().mockReturnValue(true),
        handleFreeForm: jest.fn().mockResolvedValue(undefined),
      },
      inspectionController: {
        shouldHandleNaturalInspection: jest.fn().mockReturnValue(true),
        handleTaskFiles: jest.fn().mockResolvedValue(undefined),
      },
      researchController: {
        handleResearch: jest.fn().mockResolvedValue(undefined),
      },
      schedulerController: {
        handleAutomations: jest.fn().mockResolvedValue(undefined),
      },
      surfaceOperationalIntentService: {
        classify: jest.fn().mockReturnValue({ intent: 'operational', shouldExecute: true }),
        toResponseDecision: jest.fn().mockReturnValue({ responsePath: 'agent-runtime' }),
      },
    };

    return {
      deps,
      service: new TelegramNaturalCapabilityRoutingService(deps),
    };
  }

  it('never steals free text for file delivery (agent owns free text)', async () => {
    const { deps, service } = createService();
    const ctx = { chat: { type: 'private' } } as any;

    const handled = await service.dispatch(ctx, 'me envie o relatorio em pdf da pasta downloads', '42');

    expect(handled).toBe(false);
    expect(deps.fileDeliveryController.handleFreeForm).not.toHaveBeenCalled();
  });

  it('never steals free text for inspection', async () => {
    const { deps, service } = createService();
    const ctx = { chat: { type: 'private' } } as any;

    const handled = await service.dispatch(ctx, 'compare o que mudou hoje em "C:/fora"', '42');

    expect(handled).toBe(false);
    expect(deps.inspectionController.handleTaskFiles).not.toHaveBeenCalled();
  });

  it('never steals free text for automation', async () => {
    const { deps, service } = createService();
    const ctx = { chat: { type: 'private' } } as any;

    const handled = await service.dispatch(ctx, 'me lembre todo dia de revisar os logs do Zavorth', '42');

    expect(handled).toBe(false);
    expect(deps.schedulerController.handleAutomations).not.toHaveBeenCalled();
  });

  it('never steals free text for research', async () => {
    const { deps, service } = createService();
    const ctx = { chat: { type: 'private' } } as any;

    const handled = await service.dispatch(ctx, 'pesquise artigos recentes sobre agentes governados', '42');

    expect(handled).toBe(false);
    expect(deps.researchController.handleResearch).not.toHaveBeenCalled();
  });

  it('does not route explicit slash commands either (slash handlers own those)', async () => {
    const { deps, service } = createService();
    const ctx = { chat: { type: 'private' } } as any;

    const handled = await service.dispatch(ctx, '/help', '42');

    expect(handled).toBe(false);
    expect(deps.fileDeliveryController.handleFreeForm).not.toHaveBeenCalled();
    expect(deps.schedulerController.handleAutomations).not.toHaveBeenCalled();
    expect(deps.researchController.handleResearch).not.toHaveBeenCalled();
  });

  it('keeps plain chat out of natural capability routes', async () => {
    const { deps, service } = createService();
    const ctx = { chat: { type: 'private' } } as any;

    const handled = await service.dispatch(ctx, 'oi, tudo bem?', '42');

    expect(handled).toBe(false);
  });
});
