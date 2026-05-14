import { TelegramNaturalCapabilityRoutingService } from '../../src/telegram/TelegramNaturalCapabilityRoutingService';

describe('TelegramNaturalCapabilityRoutingService', () => {
  function createService() {
    const deps = {
      fileDeliveryController: {
        shouldHandleFreeForm: jest.fn().mockReturnValue(false),
        handleFreeForm: jest.fn().mockResolvedValue(undefined),
      },
      inspectionController: {
        shouldHandleNaturalInspection: jest.fn().mockReturnValue(false),
        handleTaskFiles: jest.fn().mockResolvedValue(undefined),
      },
      researchController: {
        handleResearch: jest.fn().mockResolvedValue(undefined),
      },
      schedulerController: {
        handleAutomations: jest.fn().mockResolvedValue(undefined),
      },
    };

    return {
      deps,
      service: new TelegramNaturalCapabilityRoutingService(deps),
    };
  }

  it('routes natural file delivery requests before the generic conversational path', async () => {
    const { deps, service } = createService();
    deps.fileDeliveryController.shouldHandleFreeForm.mockReturnValue(true);
    const ctx = { chat: { type: 'private' } } as any;

    const handled = await service.dispatch(ctx, 'me envie o relatorio em pdf da pasta downloads', '42');

    expect(handled).toBe(true);
    expect(deps.fileDeliveryController.handleFreeForm).toHaveBeenCalledWith(
      ctx,
      'me envie o relatorio em pdf da pasta downloads',
      '42',
    );
  });

  it('routes natural inspection requests through the inspection controller', async () => {
    const { deps, service } = createService();
    deps.inspectionController.shouldHandleNaturalInspection.mockReturnValue(true);
    const ctx = { chat: { type: 'private' } } as any;

    const handled = await service.dispatch(ctx, 'compare o que mudou hoje em "C:/fora"', '42');

    expect(handled).toBe(true);
    expect(deps.inspectionController.handleTaskFiles).toHaveBeenCalledWith(
      ctx,
      'compare o que mudou hoje em "C:/fora"',
      '42',
    );
  });

  it('routes natural automation requests to the scheduler automation entrypoint', async () => {
    const { deps, service } = createService();
    const ctx = { chat: { type: 'private' } } as any;

    const handled = await service.dispatch(ctx, 'me lembre todo dia de revisar os logs do Zavorth', '42');

    expect(handled).toBe(true);
    expect(deps.schedulerController.handleAutomations).toHaveBeenCalledWith(
      ctx,
      'me lembre todo dia de revisar os logs do Zavorth',
      '42',
    );
  });

  it('recognizes accented automation wording without mojibake-sensitive regexes', async () => {
    const { deps, service } = createService();
    const ctx = { chat: { type: 'private' } } as any;

    const handled = await service.dispatch(ctx, 'crie uma automação semanal para revisar os logs', '42');

    expect(handled).toBe(true);
    expect(deps.schedulerController.handleAutomations).toHaveBeenCalledWith(
      ctx,
      'crie uma automação semanal para revisar os logs',
      '42',
    );
  });

  it('does not treat durable memory reminders as scheduled automations without time intent', async () => {
    const { deps, service } = createService();
    const ctx = { chat: { type: 'private' } } as any;

    const handled = await service.dispatch(ctx, 'me lembre que prefiro respostas curtas', '42');

    expect(handled).toBe(false);
    expect(deps.schedulerController.handleAutomations).not.toHaveBeenCalled();
  });

  it('keeps plain chat out of natural capability routes', async () => {
    const { deps, service } = createService();
    const ctx = { chat: { type: 'private' } } as any;

    const handled = await service.dispatch(ctx, 'oi, tudo bem?', '42');

    expect(handled).toBe(false);
    expect(deps.fileDeliveryController.handleFreeForm).not.toHaveBeenCalled();
    expect(deps.schedulerController.handleAutomations).not.toHaveBeenCalled();
    expect(deps.researchController.handleResearch).not.toHaveBeenCalled();
  });

  it('routes deep research-like natural requests to the research controller', async () => {
    const { deps, service } = createService();
    const ctx = { chat: { type: 'private' } } as any;

    const handled = await service.dispatch(ctx, 'investigue artigos e papers recentes sobre alignment de agentes', '42');

    expect(handled).toBe(true);
    expect(deps.researchController.handleResearch).toHaveBeenCalledWith(
      ctx,
      'investigue artigos e papers recentes sobre alignment de agentes',
    );
  });

  it('routes product-style research requests without requiring /research', async () => {
    const { deps, service } = createService();
    const ctx = { chat: { type: 'private' } } as any;

    const handled = await service.dispatch(ctx, 'pesquise artigos recentes sobre agentes governados', '42');

    expect(handled).toBe(true);
    expect(deps.researchController.handleResearch).toHaveBeenCalledWith(
      ctx,
      'pesquise artigos recentes sobre agentes governados',
    );
  });

  it('does not route explicit slash commands through natural capabilities', async () => {
    const { deps, service } = createService();
    const ctx = { chat: { type: 'private' } } as any;

    const handled = await service.dispatch(ctx, '/help', '42');

    expect(handled).toBe(false);
    expect(deps.fileDeliveryController.handleFreeForm).not.toHaveBeenCalled();
    expect(deps.schedulerController.handleAutomations).not.toHaveBeenCalled();
    expect(deps.researchController.handleResearch).not.toHaveBeenCalled();
  });

  it('does not route natural capabilities in group chats', async () => {
    const { deps, service } = createService();
    deps.fileDeliveryController.shouldHandleFreeForm.mockReturnValue(true);
    const ctx = { chat: { type: 'group' } } as any;

    const handled = await service.dispatch(ctx, 'me envie o relatorio em pdf da pasta downloads', '42');

    expect(handled).toBe(false);
    expect(deps.fileDeliveryController.handleFreeForm).not.toHaveBeenCalled();
  });
});
