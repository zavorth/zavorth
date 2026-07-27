import { TelegramHubController } from '../../../src/telegram/controllers/TelegramHubController';

describe('TelegramHubController', () => {
  function createDeps() {
    return {
      zavorthBridgePreferenceStore: {
        getPreferredModel: jest.fn().mockResolvedValue('gemini-3.1-flash'),
      },
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([]),
      },
      isDemoModeEnabled: jest.fn().mockReturnValue(false),
      isOperatorModeEnabled: jest.fn().mockReturnValue(false),
      isPresentationModeEnabled: jest.fn().mockReturnValue(false),
      getHealthStats: jest.fn().mockReturnValue({ process: { uptimeSeconds: 10 } }),
      formatSystemStatusReply: jest.fn().mockReturnValue('status'),
      formatModelsReply: jest.fn().mockReturnValue('models'),
      formatPermissionList: jest.fn().mockReturnValue('permissions'),
      handleDashboard: jest.fn().mockResolvedValue(undefined),
      handleOperationalMode: jest.fn().mockResolvedValue(undefined),
      handleWslCommand: jest.fn().mockResolvedValue(undefined),
      handleAudit: jest.fn().mockResolvedValue(undefined),
      renderHelpCard: jest.fn().mockResolvedValue(undefined),
      skillLibraryPresentationService: {
        buildSnapshot: jest.fn().mockReturnValue({
          narrative: {
            operatorSummary: '7 visible skills and 3 ready recipes.',
          },
          catalog: {
            summary: {
              readyRecipes: 3,
              recipes: 3,
            },
          },
          trust: [{ trust: 'trusted', count: 7 }],
          bundles: [{ tag: 'security', skillCount: 3 }],
          vendors: [{ displayName: 'AIGateway', summary: 'ready.' }],
        }),
        renderReport: jest.fn().mockReturnValue('library report'),
      },
      skillInstallPlanPresentationService: {
        renderReport: jest.fn().mockReturnValue('plan report'),
      },
      skillMcpSidecarService: {
        renderReport: jest.fn().mockReturnValue('mcp report'),
      },
    } as any;
  }

  it('renders the settings page directly', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    const controller = new TelegramHubController(createDeps());
    await controller.handleSettingsCommand(ctx);

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('*Zavorth Settings*');
    expect(ctx.reply.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ parse_mode: 'Markdown' }));
  });

  it('presents the hub overview as manual support instead of the primary entry', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    const controller = new TelegramHubController(createDeps());
    await controller.handleMenuCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringMatching(/Este hub e apoio manual|Zavorth|hub/i),
      expect.objectContaining({ parse_mode: 'Markdown' }),
    );
    expect(ctx.reply.mock.calls[0][0]).toContain('Your assistant for research');
    expect(ctx.reply.mock.calls[0][0]).not.toContain('Use the hub to navigate capabilities');
  });

  it('edits the current hub page when a page callback arrives', async () => {
    const ctx = {
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      chat: { id: 123 },
      callbackQuery: { message: { message_id: 456 } },
      api: {
        editMessageText: jest.fn().mockResolvedValue(undefined),
      },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    const controller = new TelegramHubController(createDeps());
    await controller.handleHubCallback(ctx, 'hub:page:quickstart');

    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    expect(ctx.api.editMessageText).toHaveBeenCalledWith(
      123,
      456,
      expect.stringContaining('*Quick Guide*'),
      expect.anything(),
    );
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('renders recipe actions through the hub action callback', async () => {
    const ctx = {
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    const controller = new TelegramHubController(createDeps());
    await controller.handleHubCallback(ctx, 'hub:action:recipe_codex');

    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('*Recipe: Codex*');
    expect(ctx.reply.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ parse_mode: 'Markdown' }));
  });

  it('renders the skills page from the hub start command', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    const controller = new TelegramHubController(createDeps());
    await controller.handleStartCommand(ctx, 'skills');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('*Skill Library*');
    expect(ctx.reply.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ parse_mode: 'Markdown' }));
  });

  it('routes quick status actions through the injected health snapshot provider', async () => {
    const ctx = {
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const deps = createDeps();

    const controller = new TelegramHubController(deps);
    await controller.handleHubCallback(ctx, 'hub:action:status');

    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    expect(deps.getHealthStats).toHaveBeenCalled();
    expect(deps.formatSystemStatusReply).toHaveBeenCalledWith({ process: { uptimeSeconds: 10 } });
    expect(ctx.reply).toHaveBeenCalledWith('status');
  });
});
