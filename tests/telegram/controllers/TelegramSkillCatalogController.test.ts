import { TelegramSkillCatalogController } from '../../../src/telegram/controllers/TelegramSkillCatalogController.js';

describe('TelegramSkillCatalogController', () => {
  it('renders recipe requests through the install plan service', async () => {
    const skillLibraryPresentationService = {
      renderReport: jest.fn(() => 'library report'),
    };
    const skillInstallPlanPresentationService = {
      renderReport: jest.fn(() => 'recipe plan'),
    };
    const skillMcpSidecarService = {
      renderReport: jest.fn(() => 'mcp report'),
    };
    const controller = new TelegramSkillCatalogController({
      skillMcpSidecarService: skillMcpSidecarService as any,
      skillLibraryPresentationService: skillLibraryPresentationService as any,
      skillInstallPlanPresentationService: skillInstallPlanPresentationService as any,
    });
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handleSkills(ctx, 'recipe security-hardening');

    expect(skillInstallPlanPresentationService.renderReport).toHaveBeenCalledWith({
      recipeId: 'security-hardening',
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('recipe plan'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('policy: telegram-skill-catalog'));
  });

  it('renders MCP inspection requests through the MCP sidecar service', async () => {
    const controller = new TelegramSkillCatalogController({
      skillMcpSidecarService: {
        renderReport: jest.fn(() => 'mcp report'),
      } as any,
      skillLibraryPresentationService: {
        renderReport: jest.fn(() => 'library report'),
      } as any,
      skillInstallPlanPresentationService: {
        renderReport: jest.fn(() => 'plan report'),
      } as any,
    });
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handleSkills(ctx, 'mcp security');

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('mcp report'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('policy: telegram-skill-catalog'));
  });

  it('renders the library overview through the presentation service', async () => {
    const controller = new TelegramSkillCatalogController({
      skillMcpSidecarService: {
        renderReport: jest.fn(() => 'mcp report'),
      } as any,
      skillLibraryPresentationService: {
        renderReport: jest.fn(() => 'library report'),
      } as any,
      skillInstallPlanPresentationService: {
        renderReport: jest.fn(() => 'plan report'),
      } as any,
    });
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handleSkills(ctx, 'library security');

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('library report'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('policy: telegram-skill-catalog'));
  });

  it('routes bridge activation commands through the governed activation service', async () => {
    const skillBridgeActivationService = {
      executeCommand: jest.fn(async () => ({
        status: 'dry-run',
        action: 'dry-run',
        selectedId: 'research-pack',
        report: 'Universal Skill Bridge Activation\nBridge: dry-run',
      })),
      renderReport: jest.fn((snapshot: any) => snapshot.report),
    };
    const controller = new TelegramSkillCatalogController({
      skillMcpSidecarService: {
        renderReport: jest.fn(() => 'mcp report'),
      } as any,
      skillLibraryPresentationService: {
        renderReport: jest.fn(() => 'library report'),
      } as any,
      skillInstallPlanPresentationService: {
        renderReport: jest.fn(() => 'plan report'),
      } as any,
      skillBridgeActivationService: skillBridgeActivationService as any,
    });
    const ctx = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handleSkills(ctx, 'run research-pack');

    expect(skillBridgeActivationService.executeCommand).toHaveBeenCalledWith(expect.objectContaining({
      args: 'run research-pack',
      channel: 'telegram',
      actorId: '42',
    }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Universal Skill Bridge Activation'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('policy: telegram-skill-bridge-activation'));
  });
});
