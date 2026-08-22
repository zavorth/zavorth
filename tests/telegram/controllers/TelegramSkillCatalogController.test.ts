import { TelegramSkillCatalogController } from '../../../src/telegram/controllers/TelegramSkillCatalogController.js';

interface MockSkillLibraryPresentationService {
  renderReport: jest.Mock;
}

interface MockSkillInstallPlanPresentationService {
  renderReport: jest.Mock;
}

interface MockSkillMcpSidecarService {
  renderReport: jest.Mock;
}

interface MockSkillBridgeActivationService {
  executeCommand: jest.Mock;
  renderReport: jest.Mock;
}

interface MockContext {
  from?: { id: number };
  reply: jest.Mock;
}

describe('TelegramSkillCatalogController', () => {
  it('renders recipe requests through the install plan service', async () => {
    const skillLibraryPresentationService: MockSkillLibraryPresentationService = {
      renderReport: jest.fn(() => 'library report'),
    };
    const skillInstallPlanPresentationService: MockSkillInstallPlanPresentationService = {
      renderReport: jest.fn(() => 'recipe plan'),
    };
    const skillMcpSidecarService: MockSkillMcpSidecarService = {
      renderReport: jest.fn(() => 'mcp report'),
    };
    const controller = new TelegramSkillCatalogController({
      skillMcpSidecarService: skillMcpSidecarService as unknown as never,
      skillLibraryPresentationService: skillLibraryPresentationService as unknown as never,
      skillInstallPlanPresentationService: skillInstallPlanPresentationService as unknown as never,
    });
    const ctx: MockContext = {
      reply: jest.fn().mockResolvedValue(undefined),
    };

    await controller.handleSkills(ctx, 'recipe security-hardening');

    expect(skillInstallPlanPresentationService.renderReport).toHaveBeenCalledWith({
      recipeId: 'security-hardening',
    });
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('recipe plan');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('policy: telegram-skill-catalog');
  });

  it('renders MCP inspection requests through the MCP sidecar service', async () => {
    const controller = new TelegramSkillCatalogController({
      skillMcpSidecarService: {
        renderReport: jest.fn(() => 'mcp report'),
      } as unknown as never,
      skillLibraryPresentationService: {
        renderReport: jest.fn(() => 'library report'),
      } as unknown as never,
      skillInstallPlanPresentationService: {
        renderReport: jest.fn(() => 'plan report'),
      } as unknown as never,
    });
    const ctx: MockContext = {
      reply: jest.fn().mockResolvedValue(undefined),
    };

    await controller.handleSkills(ctx, 'mcp security');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('mcp report');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('policy: telegram-skill-catalog');
  });

  it('renders the library overview through the presentation service', async () => {
    const controller = new TelegramSkillCatalogController({
      skillMcpSidecarService: {
        renderReport: jest.fn(() => 'mcp report'),
      } as unknown as never,
      skillLibraryPresentationService: {
        renderReport: jest.fn(() => 'library report'),
      } as unknown as never,
      skillInstallPlanPresentationService: {
        renderReport: jest.fn(() => 'plan report'),
      } as unknown as never,
    });
    const ctx: MockContext = {
      reply: jest.fn().mockResolvedValue(undefined),
    };

    await controller.handleSkills(ctx, 'library security');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('library report');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('policy: telegram-skill-catalog');
  });

  it('routes bridge activation commands through the governed activation service', async () => {
    const skillBridgeActivationService: MockSkillBridgeActivationService = {
      executeCommand: jest.fn(async () => ({
        status: 'dry-run',
        action: 'dry-run',
        selectedId: 'research-pack',
        report: 'Universal Skill Bridge Activation\nBridge: dry-run',
      })),
      renderReport: jest.fn((snapshot: unknown) => (snapshot as { report: string }).report),
    };
    const controller = new TelegramSkillCatalogController({
      skillMcpSidecarService: {
        renderReport: jest.fn(() => 'mcp report'),
      } as unknown as never,
      skillLibraryPresentationService: {
        renderReport: jest.fn(() => 'library report'),
      } as unknown as never,
      skillInstallPlanPresentationService: {
        renderReport: jest.fn(() => 'plan report'),
      } as unknown as never,
      skillBridgeActivationService: skillBridgeActivationService as unknown as never,
    });
    const ctx: MockContext = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    };

    await controller.handleSkills(ctx, 'run research-pack');

    expect(skillBridgeActivationService.executeCommand).toHaveBeenCalledWith(expect.objectContaining({
      args: 'run research-pack',
      channel: 'telegram',
      actorId: '42',
    }));
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Universal Skill Bridge Activation');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('policy: telegram-skill-bridge-activation');
  });
});
