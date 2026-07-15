import { SharedSurfaceEcosystemCommandPack } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceEcosystemCommandPack';

function buildCtx(rawText = '/platform') {
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

function buildPack(overrides: Record<string, any> = {}): SharedSurfaceEcosystemCommandPack {
  return new SharedSurfaceEcosystemCommandPack({
    platformActionService: { execute: jest.fn() } as any,
    platformRegistryService: {
      renderCatalogReport: jest.fn(() => 'Zavorth platform plane'),
    } as any,
    platformCatalogSyncService: {
      sync: jest.fn(async () => ({
        ok: true,
        status: 'ready',
        summary: 'Registry remoto pronto.',
        entryCount: 3,
        collectionCount: 1,
        recipeCount: 1,
        cacheFile: 'C:/tmp/platform-cache.json',
        error: null,
      })),
    } as any,
    platformPublisherService: {
      publishDetailed: jest.fn(async () => ({
        ok: true,
        releaseId: '@example/sql-analyzer@1.2.3',
        packageId: '@example/sql-analyzer',
        version: '1.2.3',
        signature: 'sha256:abc123',
        packageSha256: 'abc123',
        fileCount: 2,
        outputFile: 'C:/repo/data/runtime/platform-publish/example.json',
        uploadStatus: 'prepared',
      })),
    } as any,
    skillMcpSidecarService: {
      renderReport: jest.fn(() => 'Skill MCP Sidecar'),
    } as any,
    skillLibraryPresentationService: {
      renderReport: jest.fn(() => 'Skill Library'),
    } as any,
    skillInstallPlanPresentationService: {
      renderReport: jest.fn(() => 'Skill Install Plan'),
    } as any,
    skillBridgeActivationService: {
      executeCommand: jest.fn(async () => ({
        status: 'dry-run',
        action: 'dry-run',
        selectedId: 'research-pack',
        report: 'Universal Skill Bridge Activation\n/skills run research-pack',
      })),
      renderReport: jest.fn((snapshot: any) => snapshot.report),
    } as any,
    subagentInvocationGatewayService: {
      executeCommand: jest.fn(async () => ({
        status: 'ready',
        action: 'subagents.list',
        mode: 'oneshot',
        summary: { liveRuns: 0, workerResults: 0 },
      })),
      invoke: jest.fn(async () => ({
        status: 'completed',
        action: 'subagents.spawn',
        mode: 'oneshot',
        summary: { liveRuns: 1, workerResults: 2 },
      })),
      renderReport: jest.fn((snapshot: any) => `Subagents ${snapshot.status}`),
    } as any,
    naturalInvocationRouterService: {
      plan: jest.fn(async (input: any) =>
        naturalPlan(input.text, {
          channel: input.channel,
          actorId: input.actorId,
          primaryAction: /skill/i.test(input.text)
            ? 'use_skill'
            : /absorv|biblioteca|batch/i.test(input.text)
              ? 'large_absorption'
              : 'spawn_team',
        }),
      ),
      renderPlan: jest.fn((plan: any) => `Natural ${plan.primaryAction}`),
    } as any,
    ...overrides,
  });
}

describe('SharedSurfaceEcosystemCommandPack', () => {
  it('renders the platform catalog through /platform', async () => {
    const renderCatalogReport = jest.fn(() => 'Zavorth platform plane\n\nzavorthBridge');
    const pack = buildPack({
      platformRegistryService: { renderCatalogReport } as any,
    });
    const ctx = buildCtx('/platform skill:zavorthBridge');

    const handled = await pack.maybeHandle(ctx as any, '/platform', 'skill:zavorthBridge');

    expect(handled).toBe(true);
    expect(renderCatalogReport).toHaveBeenCalledWith({
      selectedId: 'skill:zavorthBridge',
      query: 'skill:zavorthBridge',
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Zavorth platform plane'));
  });

  it('syncs the platform registry through /platform sync', async () => {
    const sync = jest.fn(async () => ({
      ok: true,
      status: 'ready',
      summary: 'Registry remoto pronto com 3 item(ns).',
      entryCount: 3,
      collectionCount: 1,
      recipeCount: 1,
      cacheFile: 'C:/tmp/platform-cache.json',
      error: null,
    }));
    const pack = buildPack({
      platformCatalogSyncService: { sync } as any,
    });
    const ctx = buildCtx('/platform sync');

    const handled = await pack.maybeHandle(ctx as any, '/platform', 'sync');

    expect(handled).toBe(true);
    expect(sync).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Platform registry sync'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Registry remoto pronto'));
  });

  it('executes platform lifecycle actions through /platform subcommands', async () => {
    const execute = jest.fn(async () => ({
      summary: 'UI Debug Onboarding aplicada no platform plane.',
      details: ['Alvos avaliados: 1 | aplicados: 1 | noop: 0 | bloqueados: 0.'],
      selected: null,
      selectedCollection: null,
      selectedRecipe: {
        id: 'recipe:ui-debug-onboarding',
        label: 'UI Debug Onboarding',
      },
      snapshot: {},
    }));
    const pack = buildPack({
      platformActionService: { execute } as any,
      platformRegistryService: {
        renderCatalogReport: jest.fn(() => 'Zavorth platform plane\n\nUI Debug Onboarding'),
      } as any,
    });
    const ctx = buildCtx('/platform install recipe:ui-debug-onboarding');

    const handled = await pack.maybeHandle(ctx as any, '/platform', 'install recipe:ui-debug-onboarding');

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        entryId: 'recipe:ui-debug-onboarding',
        actionId: 'install',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('UI Debug Onboarding aplicada no platform plane.'));
  });

  it('executes platform publish through /platform publish', async () => {
    const publishDetailed = jest.fn(async () => ({
      ok: true,
      releaseId: '@example/sql-analyzer@1.2.3',
      packageId: '@example/sql-analyzer',
      version: '1.2.3',
      signature: 'sha256:abc123',
      packageSha256: 'abc123',
      fileCount: 2,
      outputFile: 'C:/repo/data/runtime/platform-publish/example.json',
      uploadStatus: 'prepared',
    }));
    const pack = buildPack({
      platformPublisherService: { publishDetailed } as any,
    });
    const ctx = buildCtx('/platform publish C:/tmp/sql-analyzer');

    const handled = await pack.maybeHandle(ctx as any, '/platform', 'publish C:/tmp/sql-analyzer');

    expect(handled).toBe(true);
    expect(publishDetailed).toHaveBeenCalledWith(
      expect.objectContaining({
        packagePath: 'C:/tmp/sql-analyzer',
        signLocal: true,
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Platform publish'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('@example/sql-analyzer@1.2.3'));
  });

  it('routes /skills plan recipe to the install plan presenter', async () => {
    const renderReport = jest.fn(() => 'Skill Install Plan\nrecipe:ui-debug-onboarding');
    const pack = buildPack({
      skillInstallPlanPresentationService: { renderReport } as any,
    });
    const ctx = buildCtx('/skills plan recipe recipe:ui-debug-onboarding');

    const handled = await pack.maybeHandle(ctx as any, '/skills', 'plan recipe recipe:ui-debug-onboarding');

    expect(handled).toBe(true);
    expect(renderReport).toHaveBeenCalledWith({
      recipeId: 'recipe:ui-debug-onboarding',
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Skill Install Plan'));
  });

  it('routes /skills bridge commands to the governed activation service', async () => {
    const executeCommand = jest.fn(async () => ({
      status: 'ready',
      action: 'inspect',
      selectedId: 'research-pack',
      report: 'Universal Skill Bridge Activation\nresearch-pack',
    }));
    const renderReport = jest.fn((snapshot: any) => snapshot.report);
    const pack = buildPack({
      skillBridgeActivationService: { executeCommand, renderReport } as any,
    });
    const ctx = buildCtx('/skills bridge research-pack');

    const handled = await pack.maybeHandle(ctx as any, '/skills', 'bridge research-pack');

    expect(handled).toBe(true);
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        args: 'bridge research-pack',
        channel: 'telegram',
        actorId: 'telegram-user',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Universal Skill Bridge Activation'));
  });

  it('routes /skills run commands to the governed activation service', async () => {
    const executeCommand = jest.fn(async () => ({
      status: 'dry-run',
      action: 'dry-run',
      selectedId: 'research-pack',
      report: 'Universal Skill Bridge Activation\nBridge: dry-run',
    }));
    const pack = buildPack({
      skillBridgeActivationService: {
        executeCommand,
        renderReport: jest.fn((snapshot: any) => snapshot.report),
      } as any,
    });
    const ctx = buildCtx('/skills run research-pack');

    const handled = await pack.maybeHandle(ctx as any, '/skills', 'run research-pack');

    expect(handled).toBe(true);
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        args: 'run research-pack',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Bridge: dry-run'));
  });

  it('accepts /skills use as a natural alias for governed skill activation', async () => {
    const executeCommand = jest.fn(async () => ({
      status: 'dry-run',
      action: 'dry-run',
      selectedId: 'research-pack',
      report: 'Universal Skill Bridge Activation\nBridge: dry-run',
    }));
    const pack = buildPack({
      skillBridgeActivationService: {
        executeCommand,
        renderReport: jest.fn((snapshot: any) => snapshot.report),
      } as any,
    });
    const ctx = buildCtx('/skills use research-pack');

    const handled = await pack.maybeHandle(ctx as any, '/skills', 'use research-pack');

    expect(handled).toBe(true);
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        args: 'run research-pack',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Bridge: dry-run'));
  });

  it('routes /agents spawn through the governed subagent invocation gateway', async () => {
    const invoke = jest.fn(async (input: any) => ({
      status: 'completed',
      action: 'subagents.spawn',
      mode: input.mode,
      summary: { liveRuns: 1, workerResults: 2 },
    }));
    const pack = buildPack({
      subagentInvocationGatewayService: {
        executeCommand: jest.fn(),
        invoke,
        renderReport: jest.fn((snapshot: any) => `Subagents ${snapshot.status}`),
      } as any,
    });
    const ctx = buildCtx('/agents spawn --mock-live --roles planner,qa revisar canais');

    const handled = await pack.maybeHandle(
      ctx as any,
      '/agents',
      'spawn --mock-live --roles planner,qa revisar canais',
    );

    expect(handled).toBe(true);
    expect(invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'channel',
        live: true,
        mockLive: true,
        roleIds: ['planner', 'qa'],
        text: 'revisar canais',
      }),
    );
    expect((ctx.reply as jest.Mock).mock.calls[0][0]).toContain('Zavorth agents');
    expect((ctx.reply as jest.Mock).mock.calls[0][0]).toContain('Status: completed');
    expect((ctx.reply as jest.Mock).mock.calls[0][1]).toMatchObject({
      reply_markup: expect.objectContaining({ inline_keyboard: expect.any(Array) }),
    });
  });

  it('routes /agents status through subagents.list without spawning', async () => {
    const executeCommand = jest.fn(async () => ({
      status: 'ready',
      action: 'subagents.list',
      mode: 'oneshot',
      summary: { liveRuns: 0, workerResults: 0 },
    }));
    const invoke = jest.fn();
    const pack = buildPack({
      subagentInvocationGatewayService: {
        executeCommand,
        invoke,
        renderReport: jest.fn((snapshot: any) => `Subagents ${snapshot.action}`),
      } as any,
    });
    const ctx = buildCtx('/agents status');

    const handled = await pack.maybeHandle(ctx as any, '/agents', 'status');

    expect(handled).toBe(true);
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'subagents.list',
        sourceSurface: 'channel',
      }),
    );
    expect(invoke).not.toHaveBeenCalled();
    expect((ctx.reply as jest.Mock).mock.calls[0][0]).toContain('Zavorth agents');
    expect((ctx.reply as jest.Mock).mock.calls[0][0]).toContain('Action: subagents.list');
  });

  it('routes /agents history and latest read aliases through the same agent UX', async () => {
    const executeCommand = jest.fn(async (input: any) => ({
      status: 'ready',
      action: input.action,
      mode: 'oneshot',
      selectedSessionId: input.sessionId || null,
      summary: { liveRuns: 0, workerResults: 0 },
    }));
    const pack = buildPack({
      subagentInvocationGatewayService: {
        executeCommand,
        invoke: jest.fn(),
        renderReport: jest.fn((snapshot: any) =>
          `Subagents ${snapshot.action} ${snapshot.selectedSessionId || ''}`.trim(),
        ),
      } as any,
    });
    const historyCtx = buildCtx('/agents history');
    const readCtx = buildCtx('/agents read latest');

    await pack.maybeHandle(historyCtx as any, '/agents', 'history');
    await pack.maybeHandle(readCtx as any, '/agents', 'read latest');

    expect(executeCommand).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: 'subagents.list',
      }),
    );
    expect(executeCommand).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: 'subagents.read',
        sessionId: 'latest',
      }),
    );
    expect((historyCtx.reply as jest.Mock).mock.calls[0][0]).toContain('Action: subagents.list');
    expect((readCtx.reply as jest.Mock).mock.calls[0][0]).toContain('Action: subagents.read');
    expect((readCtx.reply as jest.Mock).mock.calls[0][0]).toContain('latest');
  });

  it('routes /vision through the read-only vision control plane', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/vision inspect tela com segredo');
    const secret = 'sk-' + 'sharedSurfaceVisionSecret999';

    const handled = await pack.maybeHandle(
      ctx as any,
      '/vision',
      `inspect --target-kind desktop tela contem token=abc123456789 ${secret}`,
    );

    expect(handled).toBe(true);
    const replyText = (ctx.reply as jest.Mock).mock.calls[0][0];
    expect(replyText).toContain('Vision Control Plane');
    expect(replyText).toContain('[redacted-secret]');
    expect(replyText).toContain('/vision status');
    expect(replyText).not.toContain(secret);
    expect(replyText).not.toContain('token=abc123456789');
  });

  it('routes /vision browser inspect through the browser vision bridge', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/vision browser inspect');
    const secret = 'sk-' + 'sharedBrowserVisionSecret999';

    const handled = await pack.maybeHandle(
      ctx as any,
      '/vision',
      `browser inspect --url https://example.com/app --dom "Tela pronta ${secret}"`,
    );

    expect(handled).toBe(true);
    const replyText = (ctx.reply as jest.Mock).mock.calls[0][0];
    expect(replyText).toContain('Browser Vision Bridge');
    expect(replyText).toContain('Evidence: dom');
    expect(replyText).toContain('[redacted-secret]');
    expect(replyText).not.toContain(secret);
  });

  it('routes /computer browser plan and keeps mutating actions approval-first', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/computer browser plan');

    const handled = await pack.maybeHandle(
      ctx as any,
      '/computer',
      'browser plan --url https://example.com/form --selector #submit clique e envie formulario',
    );

    expect(handled).toBe(true);
    const replyText = (ctx.reply as jest.Mock).mock.calls[0][0];
    expect(replyText).toContain('Browser Vision Bridge');
    expect(replyText).toContain('Policy: require_owner_approval');
    expect(replyText).toContain('click');
    expect(replyText).toContain('submit');
  });

  it('routes /computer observe through the desktop computer control plane', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/computer observe');

    const handled = await pack.maybeHandle(
      ctx as any,
      '/computer',
      'observe --window Notepad --screen "Tela normal sem segredo"',
    );

    expect(handled).toBe(true);
    const replyText = (ctx.reply as jest.Mock).mock.calls[0][0];
    expect(replyText).toContain('Computer Control Plane');
    expect(replyText).toContain('computer.observe');
    expect(replyText).toContain('screenshot');
    expect(replyText).toContain('preview before click or typing');
  });

  it('routes /computer plan as approval-first desktop control', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/computer plan');

    const handled = await pack.maybeHandle(
      ctx as any,
      '/computer',
      'plan --window Notepad --target-text Salvar clique no botao salvar',
    );

    expect(handled).toBe(true);
    const replyText = (ctx.reply as jest.Mock).mock.calls[0][0];
    expect(replyText).toContain('Computer Control Plane');
    expect(replyText).toContain('Policy: require_owner_approval');
    expect(replyText).toContain('click-element');
    expect(replyText).toContain('preview before click or typing');
  });

  it('blocks /computer control over terminal surfaces', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/computer observe');

    const handled = await pack.maybeHandle(ctx as any, '/computer', 'observe --window "Windows PowerShell"');

    expect(handled).toBe(true);
    const replyText = (ctx.reply as jest.Mock).mock.calls[0][0];
    expect(replyText).toContain('Computer Control Plane');
    expect(replyText).toContain('Status: blocked');
    expect(replyText).toContain('terminal');
  });

  it('routes /device inspect through the Android ADB bridge', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/device inspect');

    const handled = await pack.maybeHandle(
      ctx as any,
      '/device',
      'inspect --screen "Tela Android pronta" --ui-xml "<hierarchy><node text=CHECK /></hierarchy>"',
    );

    expect(handled).toBe(true);
    const replyText = (ctx.reply as jest.Mock).mock.calls[0][0];
    expect(replyText).toContain('Android ADB Device Bridge');
    expect(replyText).toContain('device.observe');
    expect(replyText).toContain('read-only ADB only without approval');
  });

  it('routes /device plan as approval-first Android control', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/device plan');

    const handled = await pack.maybeHandle(
      ctx as any,
      '/device',
      'plan --target-text CHECK --payload "texto aprovado" toque no botao e digite',
    );

    expect(handled).toBe(true);
    const replyText = (ctx.reply as jest.Mock).mock.calls[0][0];
    expect(replyText).toContain('Android ADB Device Bridge');
    expect(replyText).toContain('Policy: require_owner_approval');
    expect(replyText).toContain('tap');
    expect(replyText).toContain('type-text');
  });

  it('blocks /device install by default', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/device plan');

    const handled = await pack.maybeHandle(
      ctx as any,
      '/device',
      'plan --package com.example.app instalar apk no celular',
    );

    expect(handled).toBe(true);
    const replyText = (ctx.reply as jest.Mock).mock.calls[0][0];
    expect(replyText).toContain('Android ADB Device Bridge');
    expect(replyText).toContain('Status: blocked');
    expect(replyText).toContain('install-uninstall');
  });

  it('routes /invoke through the natural invocation router', async () => {
    const plan = jest.fn(async (input: any) =>
      naturalPlan(input.text, {
        channel: input.channel,
        actorId: input.actorId,
        primaryAction: 'spawn_team',
      }),
    );
    const pack = buildPack({
      naturalInvocationRouterService: {
        plan,
        renderPlan: jest.fn(),
      } as any,
    });
    const ctx = buildCtx('/invoke mande um agente pesquisar e outro validar');

    const handled = await pack.maybeHandle(ctx as any, '/invoke', 'mande um agente pesquisar e outro validar');

    expect(handled).toBe(true);
    expect(plan).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'mande um agente pesquisar e outro validar',
        autoExecute: true,
        autoLiveSubagents: true,
        channel: 'telegram',
        actorId: 'telegram-user',
      }),
    );
    expect((ctx.reply as jest.Mock).mock.calls[0][0]).toContain('Zavorth Natural Invoke');
    expect((ctx.reply as jest.Mock).mock.calls[0][0]).toMatch(/Action: spawn_team|Acao: spawn_team|spawn_team/i);
    expect((ctx.reply as jest.Mock).mock.calls[0][1]).toMatchObject({
      reply_markup: expect.objectContaining({ inline_keyboard: expect.any(Array) }),
    });
  });

  it('free-text natural invocation API is deleted from the pack', () => {
    const pack = buildPack();
    expect((pack as any).maybeHandleNaturalInvocation).toBeUndefined();
    expect((pack as any).parseNaturalAgentRuntimeCommand).toBeUndefined();
    expect((pack as any).looksLikeNaturalInvocation).toBeUndefined();
  });

  it('ignores unrelated commands', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/watchmode');

    const handled = await pack.maybeHandle(ctx as any, '/watchmode', '');

    expect(handled).toBe(false);
    expect(ctx.reply).not.toHaveBeenCalled();
  });
});

function naturalPlan(requestText: string, overrides: Record<string, any> = {}) {
  const primaryAction = overrides.primaryAction || 'spawn_team';
  return {
    generatedAt: '2026-05-10T14:10:00.000Z',
    contractVersion: '2026-05-10.natural-invocation-checkpoint-5',
    source: 'ZavorthNaturalInvocationRouter',
    status: 'ready',
    channel: overrides.channel || 'telegram',
    actorId: overrides.actorId || 'telegram-user',
    requestText,
    primaryAction,
    actions: [primaryAction],
    confidence: 0.94,
    candidates: [],
    selectedSkillName: primaryAction === 'use_skill' ? 'research-pack' : null,
    selectedSubagentMode: primaryAction === 'spawn_team' ? 'session' : null,
    selectedRoleIds: primaryAction === 'spawn_team' ? ['planner', 'researcher', 'qa'] : [],
    subagentAutoInvocation: null,
    sourcePath: null,
    approval: { required: false, reason: null, approvalId: null },
    safety: {
      policyBrokerRequired: true,
      skillContentIsUntrustedByDefault: true,
      importedSkillsAreInstructionsOnly: true,
      liveUseRequiresApproval: true,
      workspaceMutationRequiresApproval: true,
      sensitiveNetworkRequiresApproval: true,
    },
    execution: {
      subagentRuntime: null,
      skillBridge: null,
    },
    surfaceCommands: [
      { command: '/agents', description: 'Agent status' },
      { command: '/agents spawn <task>', description: 'Spawn agent' },
      { command: '/skills search <query>', description: 'Search skills' },
      { command: '/invoke <request>', description: 'Natural invoke' },
    ],
    receipts: [],
    narrative: {
      headline: 'Natural invocation routed',
      summary: `Router selected ${primaryAction}.`,
      nextAction: 'Execute the selected route or answer directly.',
    },
    commands: {
      invoke: 'npm run zavorth:natural-invocation -- --text "<request>"',
      invokeJson: 'npm run zavorth:natural-invocation:json -- --text "<request>"',
      check: 'npm run zavorth:natural-invocation:check --silent',
      nextStage: 'Runtime gateway - Absorption Materialization And Bridge Handoff',
    },
    ...overrides,
  };
}
