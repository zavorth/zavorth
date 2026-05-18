import { TelegramCommandRoutingService } from '../../src/telegram/TelegramCommandRoutingService';

describe('TelegramCommandRoutingService', () => {
  function createService() {
    const deps = {
      menuController: {
        renderHelpCard: jest.fn().mockResolvedValue(undefined),
      },
      opsController: {
        handleStatus: jest.fn().mockResolvedValue(undefined),
        handleReadiness: jest.fn().mockResolvedValue(undefined),
        handleReadinessFixes: jest.fn().mockResolvedValue(undefined),
        handleReadyToGo: jest.fn().mockResolvedValue(undefined),
        handleStayOnline: jest.fn().mockResolvedValue(undefined),
        handleExternalAgentOnboarding: jest.fn().mockResolvedValue(undefined),
        handleExternalAgentGateway: jest.fn().mockResolvedValue(undefined),
        handleCapabilities: jest.fn().mockResolvedValue(undefined),
        handleIntegrations: jest.fn().mockResolvedValue(undefined),
        handleDemo: jest.fn().mockResolvedValue(undefined),
        handleDashboard: jest.fn().mockResolvedValue(undefined),
        handleAccess: jest.fn().mockResolvedValue(undefined),
        handleBootstrap: jest.fn().mockResolvedValue(undefined),
        handleWslCommand: jest.fn().mockResolvedValue(undefined),
        handleModels: jest.fn().mockResolvedValue(undefined),
        handleAudit: jest.fn().mockResolvedValue(undefined),
        handleOperationalMode: jest.fn().mockResolvedValue(undefined),
        handleOperatorMode: jest.fn().mockResolvedValue(undefined),
        handlePresentationMode: jest.fn().mockResolvedValue(undefined),
        handleDailyReport: jest.fn().mockResolvedValue(undefined),
        handleConnect: jest.fn().mockResolvedValue(undefined),
        handleChanges: jest.fn().mockResolvedValue(undefined),
        handleSelfUpdate: jest.fn().mockResolvedValue(undefined),
        handleAutoRepair: jest.fn().mockResolvedValue(undefined),
      },
      hubController: {
        handleStartCommand: jest.fn().mockResolvedValue(undefined),
        handleSettingsCommand: jest.fn().mockResolvedValue(undefined),
        handleMenuCommand: jest.fn().mockResolvedValue(undefined),
      },
      skillCatalogController: {
        handleSkills: jest.fn().mockResolvedValue(undefined),
      },
      securityController: {
        handleCleanup: jest.fn().mockResolvedValue(undefined),
        handleClear: jest.fn().mockResolvedValue(undefined),
        handleLock: jest.fn().mockResolvedValue(undefined),
        handleUnlock: jest.fn().mockResolvedValue(undefined),
        handleHostAuth: jest.fn().mockResolvedValue(undefined),
      },
      providerController: {
        handleModel: jest.fn().mockResolvedValue(undefined),
      },
      permissionController: {
        handlePermissionCommand: jest.fn().mockResolvedValue(undefined),
        handlePermissionAllowCommand: jest.fn().mockResolvedValue(undefined),
        handlePermissionRevokeCommand: jest.fn().mockResolvedValue(undefined),
        handleApproval: jest.fn().mockResolvedValue(undefined),
        handleRejection: jest.fn().mockResolvedValue(undefined),
      },
      echoApprovalController: {
        handleEchoCommand: jest.fn().mockResolvedValue(undefined),
      },
      echoPreferenceStore: {
        isEchoModeActive: jest.fn().mockResolvedValue(false),
        setEchoMode: jest.fn().mockResolvedValue({}),
      },
      schedulerController: {
        handleSchedule: jest.fn().mockResolvedValue(undefined),
        handleReport: jest.fn().mockResolvedValue(undefined),
        handleListSchedules: jest.fn().mockResolvedValue(undefined),
        handleUnschedule: jest.fn().mockResolvedValue(undefined),
        handleAutomations: jest.fn().mockResolvedValue(undefined),
      },
      funController: {
        handle: jest.fn().mockResolvedValue(undefined),
      },
      groupAdminController: {
        handleBan: jest.fn().mockResolvedValue(undefined),
        handleKick: jest.fn().mockResolvedValue(undefined),
        handleMute: jest.fn().mockResolvedValue(undefined),
        handleUnmute: jest.fn().mockResolvedValue(undefined),
        handleWarn: jest.fn().mockResolvedValue(undefined),
        handleWarns: jest.fn().mockResolvedValue(undefined),
        handleClearWarns: jest.fn().mockResolvedValue(undefined),
        handleRegras: jest.fn().mockResolvedValue(undefined),
        handleStats: jest.fn().mockResolvedValue(undefined),
        handleSetWelcome: jest.fn().mockResolvedValue(undefined),
        handleSetBye: jest.fn().mockResolvedValue(undefined),
        handleAntiSpam: jest.fn().mockResolvedValue(undefined),
        handleFilter: jest.fn().mockResolvedValue(undefined),
      },
      researchController: {
        handleResearch: jest.fn().mockResolvedValue(undefined),
        handleDeepResearch: jest.fn().mockResolvedValue(undefined),
      },
      knowledgeController: {
        handleSave: jest.fn().mockResolvedValue(undefined),
        handleSnippet: jest.fn().mockResolvedValue(undefined),
        handleSnippets: jest.fn().mockResolvedValue(undefined),
        handleRemember: jest.fn().mockResolvedValue(undefined),
        handleRecall: jest.fn().mockResolvedValue(undefined),
        handleMemory: jest.fn().mockResolvedValue(undefined),
        handleForget: jest.fn().mockResolvedValue(undefined),
      },
      executionController: {
        handleUndo: jest.fn().mockResolvedValue(undefined),
      },
      selfModificationController: {
        handleCommand: jest.fn().mockResolvedValue(undefined),
      },
      zavorthBridgeController: {
        handleWindowAction: jest.fn().mockResolvedValue(undefined),
        handleBridgeStatus: jest.fn().mockResolvedValue(undefined),
        handleSessionAction: jest.fn().mockResolvedValue(undefined),
        handleModelCommand: jest.fn().mockResolvedValue(undefined),
      },
      fileDeliveryController: {
        shouldHandleFreeForm: jest.fn().mockReturnValue(false),
        handleFreeForm: jest.fn().mockResolvedValue(undefined),
      },
      naturalCapabilityRouter: {
        dispatch: jest.fn().mockResolvedValue(false),
      },
    };

    return {
      deps,
      service: new TelegramCommandRoutingService(deps as any),
    };
  }

  it('routes private permission allow commands to the permission controller', async () => {
    const { deps, service } = createService();

    const handled = await service.dispatchPrivateCommand(
      { chat: { type: 'private' } } as any,
      {
        command_type: '/permallow',
        command_args: 'executor=codex kind=command value="npm test"',
      } as any,
      '/permallow executor=codex kind=command value="npm test"',
      '42',
    );

    expect(handled).toBe(true);
    expect(deps.permissionController.handlePermissionAllowCommand).toHaveBeenCalledWith(
      expect.anything(),
      'executor=codex kind=command value="npm test"',
    );
  });

  it('routes free-form /task messages to file delivery only in private chats', async () => {
    const { deps, service } = createService();
    deps.fileDeliveryController.shouldHandleFreeForm.mockReturnValue(true);
    const ctx = {
      chat: { type: 'private' },
    } as any;

    const handled = await service.dispatchPrivateCommand(
      ctx,
      {
        command_type: '/task',
        command_args: 'me envie C:/fora/index.html',
      } as any,
      '/task me envie C:/fora/index.html',
      '42',
    );

    expect(handled).toBe(true);
    expect(deps.fileDeliveryController.handleFreeForm).toHaveBeenCalledWith(
      ctx,
      'me envie C:/fora/index.html',
      '42',
    );
    expect(deps.naturalCapabilityRouter.dispatch).not.toHaveBeenCalled();
  });

  it('delegates natural /task capability routing before the legacy switchboard', async () => {
    const { deps, service } = createService();
    const ctx = {
      chat: { type: 'private' },
    } as any;
    deps.naturalCapabilityRouter.dispatch.mockResolvedValue(true);

    const handled = await service.dispatchPrivateCommand(
      ctx,
      {
        command_type: '/task',
        command_args: 'me lembre todo dia de revisar os logs',
      } as any,
      'me lembre todo dia de revisar os logs',
      '42',
    );

    expect(handled).toBe(true);
    expect(deps.naturalCapabilityRouter.dispatch).toHaveBeenCalledWith(
      ctx,
      'me lembre todo dia de revisar os logs',
      '42',
    );
    expect(deps.fileDeliveryController.handleFreeForm).not.toHaveBeenCalled();
  });

  it('does not invoke natural capability routing for explicit slash commands', async () => {
    const { deps, service } = createService();

    const handled = await service.dispatchPrivateCommand(
      { chat: { type: 'private' } } as any,
      {
        command_type: '/help',
        command_args: '',
      } as any,
      '/help',
      '42',
    );

    expect(handled).toBe(true);
    expect(deps.menuController.renderHelpCard).toHaveBeenCalled();
    expect(deps.naturalCapabilityRouter.dispatch).not.toHaveBeenCalled();
  });

  it('routes group admin commands to the matching group controller handler', async () => {
    const { deps, service } = createService();

    const handled = await service.dispatchGroupCommand(
      {} as any,
      '/ban',
      '123456',
    );

    expect(handled).toBe(true);
    expect(deps.groupAdminController.handleBan).toHaveBeenCalledWith(
      expect.anything(),
      '123456',
    );
  });

  it('routes safe group dashboard commands to the ops controller', async () => {
    const { deps, service } = createService();

    const handled = await service.dispatchGroupCommand(
      {} as any,
      '/dashboard',
      '',
    );

    expect(handled).toBe(true);
    expect(deps.opsController.handleDashboard).toHaveBeenCalled();
  });

  it('routes readiness guided fixes on Telegram surfaces', async () => {
    const { deps, service } = createService();

    const handled = await service.dispatchPrivateCommand(
      { chat: { type: 'private' } } as any,
      {
        command_type: '/fixes',
        command_args: '',
      } as any,
      '/fixes',
      '42',
    );

    expect(handled).toBe(true);
    expect(deps.opsController.handleReadinessFixes).toHaveBeenCalled();
  });

  it('routes Ready To Go on Telegram surfaces', async () => {
    const { deps, service } = createService();

    const handled = await service.dispatchPrivateCommand(
      { chat: { type: 'private' } } as any,
      {
        command_type: '/ready',
        command_args: '',
      } as any,
      '/ready',
      '42',
    );

    expect(handled).toBe(true);
    expect(deps.opsController.handleReadyToGo).toHaveBeenCalled();
  });

  it('routes Stay Online on Telegram surfaces', async () => {
    const { deps, service } = createService();

    const privateHandled = await service.dispatchPrivateCommand(
      { chat: { type: 'private' } } as any,
      {
        command_type: '/stayonline',
        command_args: '',
      } as any,
      '/stayonline',
      '42',
    );
    const groupHandled = await service.dispatchGroupCommand(
      {} as any,
      '/stayonline',
      '',
    );

    expect(privateHandled).toBe(true);
    expect(groupHandled).toBe(true);
    expect(deps.opsController.handleStayOnline).toHaveBeenCalledTimes(2);
  });

  it('routes External Agent Onboarding on Telegram surfaces', async () => {
    const { deps, service } = createService();

    const privateHandled = await service.dispatchPrivateCommand(
      { chat: { type: 'private' } } as any,
      {
        command_type: '/agentonboarding',
        command_args: 'path C:/agents/demo consent',
      } as any,
      '/agentonboarding path C:/agents/demo consent',
      '42',
    );
    const groupHandled = await service.dispatchGroupCommand(
      {} as any,
      '/agentonboarding',
      'command claude consent',
    );

    expect(privateHandled).toBe(true);
    expect(groupHandled).toBe(true);
    expect(deps.opsController.handleExternalAgentOnboarding).toHaveBeenCalledTimes(2);
  });

  it('routes External Agent Gateway on Telegram surfaces', async () => {
    const { deps, service } = createService();

    const privateHandled = await service.dispatchPrivateCommand(
      { chat: { type: 'private' } } as any,
      {
        command_type: '/externalagent',
        command_args: 'run fixture -- ping approve',
      } as any,
      '/externalagent run fixture -- ping approve',
      '42',
    );
    const groupHandled = await service.dispatchGroupCommand(
      {} as any,
      '/externalagent',
      'list',
    );

    expect(privateHandled).toBe(true);
    expect(groupHandled).toBe(true);
    expect(deps.opsController.handleExternalAgentGateway).toHaveBeenCalledTimes(2);
  });

  it('routes readiness commands to the ops controller across private and group chats', async () => {
    const { deps, service } = createService();

    const privateHandled = await service.dispatchPrivateCommand(
      { chat: { type: 'private' } } as any,
      {
        command_type: '/readiness',
        command_args: '',
      } as any,
      '/readiness',
      '42',
    );
    const groupHandled = await service.dispatchGroupCommand(
      {} as any,
      '/readiness',
      '',
    );

    expect(privateHandled).toBe(true);
    expect(groupHandled).toBe(true);
    expect(deps.opsController.handleReadiness).toHaveBeenCalledTimes(2);
  });

  it('routes private /access commands to the ops controller', async () => {
    const { deps, service } = createService();

    const handled = await service.dispatchPrivateCommand(
      { chat: { type: 'private' } } as any,
      {
        command_type: '/access',
        command_args: 'remote',
      } as any,
      '/access remote',
      '42',
    );

    expect(handled).toBe(true);
    expect(deps.opsController.handleAccess).toHaveBeenCalledWith(expect.anything(), 'remote');
  });

  it('routes private /bootstrap commands to the ops controller', async () => {
    const { deps, service } = createService();

    const handled = await service.dispatchPrivateCommand(
      { chat: { type: 'private' } } as any,
      {
        command_type: '/bootstrap',
        command_args: '',
      } as any,
      '/bootstrap',
      '42',
    );

    expect(handled).toBe(true);
    expect(deps.opsController.handleBootstrap).toHaveBeenCalledWith(expect.anything());
  });

  it('routes /skills commands to the skill catalog controller', async () => {
    const { deps, service } = createService();

    const handled = await service.dispatchPrivateCommand(
      { chat: { type: 'private' } } as any,
      {
        command_type: '/skills',
        command_args: 'recipe security-hardening',
      } as any,
      '/skills recipe security-hardening',
      '42',
    );

    expect(handled).toBe(true);
    expect(deps.skillCatalogController.handleSkills).toHaveBeenCalledWith(
      expect.anything(),
      'recipe security-hardening',
    );
  });

  it('routes /automations commands to the scheduler controller', async () => {
    const { deps, service } = createService();

    const handled = await service.dispatchPrivateCommand(
      { chat: { type: 'private' } } as any,
      {
        command_type: '/automations',
        command_args: 'maintenance on',
      } as any,
      '/automations maintenance on',
      '42',
    );

    expect(handled).toBe(true);
    expect(deps.schedulerController.handleAutomations).toHaveBeenCalledWith(
      expect.anything(),
      'maintenance on',
      '42',
    );
  });

  it('routes /echo to voice mode and /echoapprovals to approval handling', async () => {
    const { deps, service } = createService();
    const ctx = {
      chat: { type: 'private' },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    const echoHandled = await service.dispatchPrivateCommand(
      ctx,
      {
        command_type: '/echo',
        command_args: 'on',
      } as any,
      '/echo on',
      '42',
    );
    const approvalsHandled = await service.dispatchPrivateCommand(
      ctx,
      {
        command_type: '/echoapprovals',
        command_args: 'approve abc',
      } as any,
      '/echoapprovals approve abc',
      '42',
    );

    expect(echoHandled).toBe(true);
    expect(deps.echoPreferenceStore.setEchoMode).toHaveBeenCalledWith(true);
    expect(deps.echoApprovalController.handleEchoCommand).toHaveBeenCalledWith(ctx, 'approve abc');
    expect(approvalsHandled).toBe(true);
  });
});
