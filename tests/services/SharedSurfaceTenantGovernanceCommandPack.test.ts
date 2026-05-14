import { SharedSurfaceTenantGovernanceCommandPack } from '../../src/domain/surface/application/shared-surface/SharedSurfaceTenantGovernanceCommandPack';

function buildCtx(rawText = '/tenants') {
  return {
    platform: 'telegram',
    userId: 'telegram-user',
    chatId: 'telegram:chat-1',
    isGroup: false,
    rawText,
    reply: jest.fn(async () => undefined),
    editMessage: jest.fn(async () => undefined),
  };
}

function buildTeamSnapshot() {
  return {
    narrative: {
      headline: 'Teams prontos.',
      operatorSummary: '1 team composto disponivel.',
    },
    teams: [
      {
        id: 'ops',
        label: 'Ops Team',
        summary: 'Fluxo composto operacional.',
        entryCommand: '/workflow ops',
        status: 'ready',
        runStats: { total: 2, resumable: 1 },
        surfaces: [
          { label: 'Telegram', status: 'ready', summary: 'Comando exposto.' },
        ],
        operatorSummary: 'Pronto para execucao assistida.',
      },
    ],
  };
}

function buildTenantSnapshot() {
  return {
    narrative: {
      headline: 'Governanca pronta.',
      operatorSummary: '1 tenant observado.',
      nextAction: 'Revisar canais compartilhados.',
    },
    summary: {
      total: 1,
      shared: 1,
      personal: 0,
      pendingOnboarding: 0,
      publicServers: 1,
      readyShared: 1,
    },
    tenants: [
      {
        platform: 'discord',
        governanceStatus: 'attention',
        tenantId: 'discord-public',
        scopeLabel: 'publico',
        operatorSummary: 'Tenant publico precisa revisao guiada.',
        sessionId: null,
        sourceUserId: null,
        runtimeUserId: 'telegram-user',
        recipe: { label: 'Review', summary: 'Revisar setup compartilhado.' },
        nextAction: 'Executar inspect-tenant.',
        actions: [
          {
            id: 'inspect-tenant',
            actionKind: 'guided',
            label: 'Inspecionar tenant',
            command: '/tenants discord-public',
          },
        ],
      },
    ],
  };
}

function buildPack(overrides: Record<string, any> = {}): SharedSurfaceTenantGovernanceCommandPack {
  return new SharedSurfaceTenantGovernanceCommandPack({
    teamCatalogService: {
      buildSnapshot: jest.fn(() => buildTeamSnapshot()),
    } as any,
    tenantGovernanceService: {
      buildSnapshot: jest.fn(() => buildTenantSnapshot()),
    } as any,
    tenantGovernanceActionService: {
      execute: jest.fn(async () => ({
        action: {
          label: 'Inspecionar tenant',
          note: 'Inspecao concluida.',
          replies: [],
        },
        tenantGovernance: buildTenantSnapshot(),
      })),
    } as any,
    channelMeshService: {
      renderReport: jest.fn(() => 'Channel mesh report'),
    } as any,
    formatSecurityMeshReply: jest.fn(() => 'Security mesh report'),
    ...overrides,
  });
}

describe('SharedSurfaceTenantGovernanceCommandPack', () => {
  it('renders teams from the team catalog', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/teams');

    await pack.handleTeams(ctx as any, '');

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Teams e workflows compostos do Zavorth'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Ops Team (ops)'));
  });

  it('renders tenant governance snapshots', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/tenants');

    await pack.handleTenants(ctx as any, '');

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Governanca de tenants do Zavorth'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('discord-public (publico)'));
  });

  it('executes guided tenant actions through the action service', async () => {
    const execute = jest.fn(async () => ({
      action: {
        label: 'Inspecionar tenant',
        note: 'Inspecao concluida.',
        replies: [],
      },
      tenantGovernance: buildTenantSnapshot(),
    }));
    const pack = buildPack({
      tenantGovernanceActionService: { execute } as any,
    });
    const ctx = buildCtx('/tenants discord-public inspect-tenant');

    await pack.handleTenants(ctx as any, 'discord-public inspect-tenant');

    expect(execute).toHaveBeenCalledWith({
      tenantId: 'discord-public',
      actionId: 'inspect-tenant',
      workspace: process.cwd(),
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Acao guiada do tenant discord-public'));
  });
});
