import { SharedSurfaceOperationsCommandPack } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceOperationsCommandPack';

function buildPack(overrides: Record<string, any> = {}): SharedSurfaceOperationsCommandPack {
  return new SharedSurfaceOperationsCommandPack({
    hubControlPlaneService: { renderReport: jest.fn(() => 'Hub + MCP product plane') } as any,
    hubActionService: { execute: jest.fn() } as any,
    automationControlPlaneService: { renderReport: jest.fn(async () => 'Scheduled runs: Automations e scheduled runs') } as any,
    automationActionService: { execute: jest.fn(), apply: jest.fn() } as any,
    trustPlaneService: { renderReport: jest.fn(() => 'Trust Plane do Zavorth') } as any,
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
    expect(hubActionService.execute).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'platform-sync',
      requestedBy: 'telegram-user',
    }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Hub sincronizado com sucesso.'));
  });

  it('creates automations through the extracted pack', async () => {
    const automationActionService = {
      apply: jest.fn(),
      execute: jest.fn(async () => ({
        ok: true,
        actionId: 'create',
        summary: 'Automacao criada com entrega no app.',
        details: ['Rotina diaria registrada.'],
        snapshot: {
          narrative: {
            operatorSummary: 'Uma automacao ativa no runtime atual.',
            nextAction: 'Aguardar a primeira execucao.',
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
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Automacao criada com entrega no app.'));
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
    expect(trustPlaneActionService.execute).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'set-mcp-profile',
      profile: 'trusted',
      requestedBy: 'telegram-user',
      sourceSurface: 'telegram',
    }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Perfil MCP alterado para trusted.'));
  });
});
