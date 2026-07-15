import type { CapabilityDefinition, CapabilitySummary } from '../../src/contracts/CapabilityContract';
import { ZavorthCapabilityOsService } from '../../src/services/ZavorthCapabilityOsService';
import { IntentRouterV2 } from '../../src/orchestrator/IntentRouterV2';
import { ExecutionGatewayV2 } from '../../src/execution/ExecutionGatewayV2';

function buildSummary(capabilities: CapabilityDefinition[]): CapabilitySummary {
  const plugin = capabilities.filter((capability) => capability.source === 'plugin').length;
  return {
    total: capabilities.length,
    builtin: capabilities.length - plugin,
    plugin,
    commands: capabilities.filter((capability) => capability.command).length,
    implicitRoutes: capabilities.filter((capability) => capability.matchers?.length).length,
  };
}

function createRegistry(capabilities: CapabilityDefinition[]) {
  return {
    getAll: jest.fn(() => capabilities.map((capability) => ({ ...capability }))),
    getSummary: jest.fn(() => buildSummary(capabilities)),
    findByCommand: jest.fn(
      (commandType: string) => capabilities.find((capability) => capability.command?.command === commandType) || null,
    ),
  };
}

const capabilities: CapabilityDefinition[] = [
  {
    id: 'route-codex-auto',
    label: 'Targeted code edit',
    type: 'executor',
    description: 'Auto-routes code changes to Codex.',
    intent: 'code_execution',
    executor_preference: 'codex',
    dispatch_mode: 'execution',
    routing_reason: 'Request looks like a targeted code change.',
    routing_confidence: 0.82,
    allowed_command_types: ['/task', '/auto'],
    matchers: [{ patterns: ['corrija'] }],
    command: {
      command: '/codex',
      description: 'Explicit codex route.',
      section: 'execution',
      explicit_executor: 'codex',
    },
  },
  {
    id: 'route-web-research',
    label: 'Structured web research',
    type: 'research',
    description: 'Structured web research.',
    intent: 'web_research',
    executor_preference: 'web_research',
    dispatch_mode: 'execution',
    routing_reason: 'Request has a clear web research profile.',
    routing_confidence: 0.91,
    allowed_command_types: ['/task'],
    matchers: [{ patterns: ['web'] }],
    command: {
      command: '/research',
      description: 'Explicit web research route.',
      section: 'execution',
      explicit_executor: 'web_research',
    },
  },
  {
    id: 'command-mcp',
    label: 'MCP Servers',
    type: 'integration',
    description: 'Manages MCP servers.',
    intent: 'mcp_management',
    executor_preference: null,
    dispatch_mode: 'execution',
    routing_reason: 'Explicit MCP command.',
    routing_confidence: 1,
    command: {
      command: '/mcp',
      description: 'Manages MCP servers.',
      section: 'monitoring',
      handler_action: 'mcp_management',
    },
  },
  {
    id: 'plugin-ship',
    label: 'Ship Plugin',
    type: 'workflow',
    description: 'Ship workflow installed by plugin.',
    intent: 'workflow_execution',
    executor_preference: 'workflow:ship',
    dispatch_mode: 'execution',
    routing_reason: 'Plugged ship workflow.',
    routing_confidence: 1,
    source: 'plugin',
    policy: {
      executor: 'workflow:ship',
      requiresApproval: true,
      dangerLevel: 'high',
      networkScope: 'local',
      lifecycle: 'session',
      artifactKinds: ['patch', 'test-report'],
      allowedHosts: ['local'],
    },
    command: {
      command: '/ship',
      description: 'Runs ship workflow.',
      section: 'execution',
      explicit_executor: 'workflow:ship',
    },
  },
];

describe('ZavorthCapabilityOsService', () => {
  it('builds capability manifests with risk, permissions, MCP allowlist and fallback matrix', () => {
    const service = new ZavorthCapabilityOsService({
      now: () => new Date('2026-04-24T12:00:00.000Z'),
      capabilityRegistry: createRegistry(capabilities) as any,
      ledgerService: null,
    });

    const snapshot = service.buildSnapshot();
    const codex = snapshot.manifests.find((manifest) => manifest.id === 'route-codex-auto');
    const mcp = snapshot.manifests.find((manifest) => manifest.id === 'command-mcp');
    const plugin = snapshot.manifests.find((manifest) => manifest.id === 'plugin-ship');

    expect(snapshot.gate).toBe('capability-os');
    expect(snapshot.surface).toBe('capability-os');
    expect(snapshot.summary.byType.executor).toBe(1);
    expect(snapshot.summary.highRisk).toBeGreaterThanOrEqual(3);
    expect(codex?.permissions.requiresApproval).toBe(true);
    expect(codex?.permissions.policySource).toBe('inferred');
    expect(codex?.fallback.chain).toEqual(['local_executor', 'conversation']);
    expect(mcp?.permissions.scopes).toEqual(
      expect.arrayContaining(['mcp:allowlisted', 'folder:workspace', 'secrets:redacted']),
    );
    expect(snapshot.mcpHost.serverAllowlist).toContain('command-mcp');
    expect(plugin?.permissions.policySource).toBe('manifest');
    expect(plugin?.artifacts.kinds).toEqual(['patch', 'test-report']);
  });

  it('keeps free-text routes conversational (no matchImplicit keyword activation)', () => {
    const append = jest.fn((entry: any) => entry);
    const service = new ZavorthCapabilityOsService({
      now: () => new Date('2026-04-24T12:05:00.000Z'),
      capabilityRegistry: createRegistry(capabilities) as any,
      ledgerService: { append },
    });

    const decision = service.explainRoute('pesquise noticias de IA na web', {
      commandType: '/task',
      requestedBy: 'alice',
      sourceSurface: 'cli',
    });

    expect(decision.gate).toBe('capability-os');
    expect(decision.surface).toBe('capability-route');
    expect(decision.selected).toBeNull();
    expect(decision.decision.dispatchMode).toBe('conversation');
    expect(decision.decision.reason).toContain('conversational');
    expect(decision.ledger.recorded).toBe(true);
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'capabilities',
        requestedBy: 'alice',
        sourceSurface: 'cli',
        // Free-text conversation route is a non-mutating noop ledger entry.
        status: 'noop',
      }),
    );
  });

  it('routes explicit slash commands via findByCommand', () => {
    const service = new ZavorthCapabilityOsService({
      now: () => new Date('2026-04-24T12:06:00.000Z'),
      capabilityRegistry: createRegistry(capabilities) as any,
      ledgerService: null,
    });

    const decision = service.explainRoute('/research AI news today', {
      writeLedger: false,
    });

    expect(decision.selected?.id).toBe('route-web-research');
    expect(decision.fallbackChain).toEqual(['research', 'conversation']);
    expect(decision.decision.requiresApproval).toBe(true);
  });
});

describe('IntentRouterV2 and ExecutionGatewayV2', () => {
  it('keeps free-text fallback conversational when no explicit capability command is present', () => {
    const service = new ZavorthCapabilityOsService({
      now: () => new Date('2026-04-24T12:10:00.000Z'),
      capabilityRegistry: createRegistry(capabilities) as any,
      ledgerService: null,
    });
    const router = new IntentRouterV2({ capabilityOsService: service });
    const gateway = new ExecutionGatewayV2({
      now: () => new Date('2026-04-24T12:11:00.000Z'),
      intentRouter: router,
    });

    const plan = gateway.previewFallback('corrija src/app.ts e rode os testes', {
      commandType: '/task',
      failedExecutor: 'codex',
      writeLedger: false,
    });

    expect(plan.stage).toBe('26');
    expect(plan.surface).toBe('execution-gateway-v2');
    expect(plan.selectedCapabilityId).toBeNull();
    expect(plan.primaryExecutor).toBe('conversation');
    expect(plan.fallbackExecutor).toBe('conversation');
  });

  it('keeps fallback explainable for explicit slash capability routes', () => {
    const service = new ZavorthCapabilityOsService({
      now: () => new Date('2026-04-24T12:10:00.000Z'),
      capabilityRegistry: createRegistry(capabilities) as any,
      ledgerService: null,
    });
    const router = new IntentRouterV2({ capabilityOsService: service });
    const gateway = new ExecutionGatewayV2({
      now: () => new Date('2026-04-24T12:11:00.000Z'),
      intentRouter: router,
    });

    const plan = gateway.previewFallback('/codex fix src/app.ts and run tests', {
      failedExecutor: 'codex',
      writeLedger: false,
    });

    expect(plan.selectedCapabilityId).toBe('route-codex-auto');
    expect(plan.primaryExecutor).toBe('codex');
    expect(plan.fallbackExecutor).toBe('local_executor');
    expect(plan.preserves.task).toBe(true);
    expect(plan.preserves.artifacts).toEqual(expect.arrayContaining(['patch', 'test-report']));
    expect(plan.reason).toContain('codex');
  });
});
