import { SharedSurfaceCapabilityCommandPack } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceCapabilityCommandPack';

function buildCtx(rawText = '/enable sandbox once') {
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

function buildManifest(overrides: Record<string, any> = {}) {
  return {
    id: 'sandbox',
    label: 'Sandbox',
    activationMode: 'sidecar',
    approvalRequired: true,
    estimatedFootprint: {
      ramIdleMb: 192,
      diskMb: 1536,
      processCount: 1,
      notes: 'Docker sandbox.',
    },
    ...overrides,
  };
}

function buildPack(overrides: Record<string, any> = {}): SharedSurfaceCapabilityCommandPack {
  return new SharedSurfaceCapabilityCommandPack({
    capabilityLifecycleService: {
      getManifest: jest.fn(() => buildManifest()),
      registerCapabilityDemand: jest.fn(() => ({
        capability: { capabilityId: 'sandbox', state: 'provisioning' },
        approval: { capabilityId: 'sandbox' },
      })),
      enableCapability: jest.fn(() => ({ fallbackBehavior: null })),
      disableCapability: jest.fn(() => ({ notes: 'Desabilitada pelo operador.' })),
      markCapabilityState: jest.fn(),
      registerCapabilityUsage: jest.fn(),
    } as any,
    taskResourcePlannerService: {
      planCapabilityEnable: jest.fn(async () => ({
        generatedAt: '2026-04-14T16:10:00.000Z',
        taskKind: 'capability',
        intent: 'Habilitar Sandbox',
        heavy: true,
        approvalRequired: true,
        summary: 'Planner detectou sandbox pesada.',
        userFacingSummary: 'Para cumprir isso eu posso need de Sandbox.',
        budget: {
          ramMb: 192,
          cpuPercent: 18,
          diskMb: 1536,
          processCount: 1,
          externalExposure: 'local',
          recurring: false,
          companionDependencies: ['wsl', 'docker-desktop'],
          capabilityIds: ['sandbox'],
          fallback: 'Executa no modo local guardado.',
          notes: [],
        },
        capabilityEstimates: [],
        companionEstimates: [],
        warnings: [],
      })),
      renderImpactSummary: jest.fn(() => 'Impacto estimado: Sandbox, WSL e Docker Desktop.'),
      toMutationResourceImpact: jest.fn(() => ({
        ramMb: 192,
        diskMb: 1536,
        processCount: 1,
        externalExposure: 'local',
        recurring: false,
        notes: ['Sandbox pesada.'],
      })),
    } as any,
    permissionService: {
      findApprovedRequest: jest.fn(async () => null),
      createRequest: jest.fn(async () => ({
        permission_id: 'perm-1',
        status: 'pending',
      })),
    } as any,
    capabilityRegistry: {
      getSummary: jest.fn(() => ({
        total: 2,
        builtin: 1,
        plugin: 1,
        commands: 1,
        implicitRoutes: 1,
      })),
      getAll: jest.fn(() => [
        {
          id: 'task',
          label: 'Task',
          description: 'Executa tarefas.',
          source: 'builtin',
          command: { command: '/task' },
          matchers: [],
        },
        {
          id: 'plugin-demo',
          label: 'Plugin Demo',
          description: 'Plugin declaractive.',
          source: 'plugin',
          plugin_name: 'demo',
          command: null,
          matchers: [{ pattern: 'demo' }],
          routing_reason: 'Detecta demo.',
        },
      ]),
    } as any,
    ...overrides,
  });
}

describe('SharedSurfaceCapabilityCommandPack', () => {
  it('renders the capability registry summary', () => {
    const pack = buildPack();

    const reply = pack.buildCapabilitiesReply();

    expect(reply).toContain('What Zavorth can do');
    expect(reply).toContain('Loaded base: 2 capabilities');
    expect(reply).toContain('Task: /task');
    expect(reply).toContain('demo: Plugin Demo');
  });

  it('routes enable through planner and approval gate when required', async () => {
    const ctx = buildCtx('/enable sandbox once');
    const pack = buildPack();

    await pack.handleEnable(ctx as any, 'sandbox once');

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('awaiting approval'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Impacto estimado: Sandbox, WSL e Docker Desktop.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Scope: once.'));
  });

  it('accepts free capability name as primary enable payload', async () => {
    const enableCapability = jest.fn(() => ({ fallbackBehavior: null }));
    const pack = buildPack({
      capabilityLifecycleService: {
        getManifest: jest.fn(() => buildManifest({ approvalRequired: false })),
        registerCapabilityDemand: jest.fn(() => ({
          capability: { capabilityId: 'sandbox', state: 'provisioning' },
          approval: null,
        })),
        enableCapability,
        disableCapability: jest.fn(),
        markCapabilityState: jest.fn(),
        registerCapabilityUsage: jest.fn(),
      } as any,
    });
    const ctx = buildCtx('/enable sandbox');

    await pack.handleEnable(ctx as any, 'sandbox');

    expect(enableCapability).toHaveBeenCalledWith('sandbox', 'telegram-user', 'host');
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Capability Sandbox enabled.'));
    expect(ctx.reply).not.toHaveBeenCalledWith(expect.stringMatching(/^Uso:/));
  });

  it('disables non-core capabilities and suggests rollback', async () => {
    const disableCapability = jest.fn(() => ({ notes: 'Disabled by operator.' }));
    const pack = buildPack({
      capabilityLifecycleService: {
        getManifest: jest.fn(() => buildManifest({ approvalRequired: false })),
        registerCapabilityDemand: jest.fn(),
        enableCapability: jest.fn(),
        disableCapability,
        markCapabilityState: jest.fn(),
        registerCapabilityUsage: jest.fn(),
      } as any,
    });
    const ctx = buildCtx('/disable sandbox');

    await pack.handleDisable(ctx as any, 'sandbox');

    expect(disableCapability).toHaveBeenCalledWith('sandbox', 'telegram-user');
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Capability Sandbox disabled.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Rollback: /enable sandbox.'));
  });
});
