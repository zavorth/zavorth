import { SharedSurfaceOperationsCommandPack } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceOperationsCommandPack';

function buildPack(overrides: Record<string, any> = {}): SharedSurfaceOperationsCommandPack {
  return new SharedSurfaceOperationsCommandPack({
    hubControlPlaneService: { renderReport: jest.fn(() => 'Hub + MCP product plane') } as any,
    hubActionService: { execute: jest.fn() } as any,
    automationControlPlaneService: {
      renderReport: jest.fn(async () => 'Scheduled runs: Automations e scheduled runs'),
    } as any,
    automationActionService: { execute: jest.fn(), apply: jest.fn() } as any,
    trustPlaneService: { renderReport: jest.fn(() => 'Zavorth Trust Plane') } as any,
    trustPlaneActionService: { execute: jest.fn(), apply: jest.fn() } as any,
    ...overrides,
  });
}

describe('SharedSurfaceOperationsCommandPack', () => {
  it('routes /hub sync through the extracted pack', async () => {
    const hubActionService = {
      execute: jest.fn(async () => ({
        summary: 'Hub sincronizado com sucesso.',
        details: ['Catalogo atualizado.'],
        hub: {
          narrative: {
            operatorSummary: 'Catalogo pronto para uso.',
            nextAction: 'Abrir /hub openrouter.',
          },
        },
      })),
    };
    const pack = buildPack({ hubActionService: hubActionService as any });
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/hub sync',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    const handled = await pack.maybeHandle(ctx as any, '/hub', 'sync');

    expect(handled).toBe(true);
    expect(hubActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'platform-sync',
        requestedBy: 'telegram-user',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Hub sincronizado com sucesso.'));
  });

  it('creates a schedule from free-text request without rejection help', async () => {
    const automationActionService = {
      apply: jest.fn(),
      execute: jest.fn(async () => ({
        ok: true,
        actionId: 'create',
        summary: 'Agendamento em preview.',
        details: ['Passa por approval governado.'],
        snapshot: {
          narrative: {
            operatorSummary: 'Aguardando aprovacao.',
            nextAction: 'Aprovar o plano.',
          },
        },
      })),
    };
    const pack = buildPack({ automationActionService: automationActionService as any });
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/schedule every 1h /status',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    const handled = await pack.maybeHandle(ctx as any, '/schedule', 'every 1h /status');

    expect(handled).toBe(true);
    expect(automationActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'create',
        intentText: 'every 1h /status',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Agendamento em preview.'));
    expect(ctx.reply).not.toHaveBeenCalledWith(expect.stringMatching(/^Uso:/));
  });

  it('creates a report from free-text topic without requiring structured every syntax only', async () => {
    const automationActionService = {
      apply: jest.fn(),
      execute: jest.fn(async () => ({
        ok: true,
        actionId: 'create',
        summary: 'Relatorio recorrente em preview.',
        details: [],
        snapshot: {
          narrative: {
            operatorSummary: 'Aguardando aprovacao.',
            nextAction: 'Aprovar o plano.',
          },
        },
      })),
    };
    const pack = buildPack({ automationActionService: automationActionService as any });
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/report ultimas noticias de IA',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    const handled = await pack.maybeHandle(ctx as any, '/report', 'ultimas noticias de IA');

    expect(handled).toBe(true);
    expect(automationActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'create',
        intentText: 'ultimas noticias de IA',
      }),
    );
    expect(ctx.reply).not.toHaveBeenCalledWith(expect.stringMatching(/Uso: \/report every/));
  });

  it('shows schedule status for empty/status instead of create', async () => {
    const renderReport = jest.fn(async () => 'Scheduled runs: Automations e scheduled runs');
    const execute = jest.fn();
    const pack = buildPack({
      automationControlPlaneService: { renderReport } as any,
      automationActionService: { execute, apply: jest.fn() } as any,
    });
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/schedule',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    await pack.maybeHandle(ctx as any, '/schedule', 'status');

    expect(renderReport).toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('creates automations through the extracted pack', async () => {
    const automationActionService = {
      apply: jest.fn(),
      execute: jest.fn(async () => ({
        ok: true,
        actionId: 'create',
        summary: 'Automation created with in-app delivery.',
        details: ['Daily routine registered.'],
        snapshot: {
          narrative: {
            operatorSummary: 'Uma automacao ativa no runtime atual.',
            nextAction: 'Wait for the first run.',
          },
        },
      })),
    };
    const pack = buildPack({ automationActionService: automationActionService as any });
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/automations todo dia as 9h verifique meus canais no app',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    const handled = await pack.maybeHandle(ctx as any, '/automations', 'todo dia as 9h verifique meus canais no app');

    expect(handled).toBe(true);
    expect(automationActionService.execute).toHaveBeenCalledWith({
      actionId: 'create',
      intentText: 'todo dia as 9h verifique meus canais no app',
      requestedBy: 'telegram-user',
      sourceSurface: 'telegram',
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Automation created with in-app delivery.'));
  });

  it('executes trust-plane profile changes through the extracted pack', async () => {
    const trustPlaneActionService = {
      apply: jest.fn(),
      execute: jest.fn(async () => ({
        summary: 'Perfil MCP alterado para trusted.',
        details: ['Allowlist MCP atual: 0 tool(s) explicita(s).'],
        snapshot: {
          summary: {
            posture: 'attention',
            mcpProfile: 'trusted',
            skillDefaultPolicy: 'deny',
            trustedPlugins: 1,
            installedPlugins: 2,
          },
        },
      })),
    };
    const pack = buildPack({ trustPlaneActionService: trustPlaneActionService as any });
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/trust mcp trusted',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    const handled = await pack.maybeHandle(ctx as any, '/trust', 'mcp trusted');

    expect(handled).toBe(true);
    expect(trustPlaneActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'set-mcp-profile',
        profile: 'trusted',
        requestedBy: 'telegram-user',
        sourceSurface: 'telegram',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Perfil MCP alterado para trusted.'));
  });
});
