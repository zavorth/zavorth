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
    findByCommand: jest.fn((commandType: string) =>
      capabilities.find((capability) => capability.command?.command === commandType) || null),
    matchImplicit: jest.fn((commandType: string, text: string) => {
      if (commandType !== '/task' && commandType !== '/auto') {
        return null;
      }
      if (text.includes('noticias') || text.includes('web')) {
        return capabilities.find((capability) => capability.id === 'route-web-research') || null;
      }
      if (text.includes('corrija') || text.includes('src/app.ts')) {
        return capabilities.find((capability) => capability.id === 'route-codex-auto') || null;
      }
      return null;
    }),
  };
}

const capabilities: CapabilityDefinition[] = [
  {
    id: 'route-codex-auto',
    label: 'Edicao direcionada de codigo',
    type: 'executor',
    description: 'Auto-roteia alteracoes de codigo para Codex.',
    intent: 'code_execution',
    executor_preference: 'codex',
    dispatch_mode: 'execution',
    routing_reason: 'Pedido parece alteracao direcionada de codigo.',
    routing_confidence: 0.82,
    allowed_command_types: ['/task', '/auto'],
    matchers: [{ patterns: ['corrija'] }],
  },
  {
    id: 'route-web-research',
    label: 'Pesquisa web estruturada',
    type: 'research',
    description: 'Pesquisa web estruturada.',
    intent: 'web_research',
    executor_preference: 'web_research',
    dispatch_mode: 'execution',
    routing_reason: 'Pedido tem perfil claro de pesquisa web.',
    routing_confidence: 0.91,
    allowed_command_types: ['/task'],
    matchers: [{ patterns: ['web'] }],
  },
  {
    id: 'command-mcp',
    label: 'MCP Servers',
    type: 'integration',
    description: 'Gerencia servidores MCP.',
    intent: 'mcp_management',
    executor_preference: null,
    dispatch_mode: 'execution',
    routing_reason: 'Comando explicito para MCP.',
    routing_confidence: 1,
    command: {
      command: '/mcp',
      description: 'Gerencia servidores MCP.',
      section: 'monitoring',
      handler_action: 'mcp_management',
    },
  },
  {
    id: 'plugin-ship',
    label: 'Ship Plugin',
    type: 'workflow',
    description: 'Workflow de ship instalado por plugin.',
    intent: 'workflow_execution',
    executor_preference: 'workflow:ship',
    dispatch_mode: 'execution',
    routing_reason: 'Workflow de ship plugado.',
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
      description: 'Executa workflow ship.',
      section: 'execution',
      explicit_executor: 'workflow:ship',
    },
  },
];

describe('ZavorthCapabilityOsService', () => {
  it('builds phase 26 manifests with risk, permissions, MCP allowlist and fallback matrix', () => {
    const service = new ZavorthCapabilityOsService({
      now: () => new Date('2026-04-24T12:00:00.000Z'),
      capabilityRegistry: createRegistry(capabilities) as any,
      ledgerService: null,
    });

    const snapshot = service.buildSnapshot();
    const codex = snapshot.manifests.find((manifest) => manifest.id === 'route-codex-auto');
    const mcp = snapshot.manifests.find((manifest) => manifest.id === 'command-mcp');
    const plugin = snapshot.manifests.find((manifest) => manifest.id === 'plugin-ship');

    expect(snapshot.phase).toBe('26');
    expect(snapshot.surface).toBe('capability-os');
    expect(snapshot.summary.byType.executor).toBe(1);
    expect(snapshot.summary.highRisk).toBeGreaterThanOrEqual(3);
    expect(codex?.permissions.requiresApproval).toBe(true);
    expect(codex?.permissions.policySource).toBe('inferred');
    expect(codex?.fallback.chain).toEqual(['local_executor', 'conversation']);
    expect(mcp?.permissions.scopes).toEqual(expect.arrayContaining(['mcp:allowlisted', 'folder:workspace', 'secrets:redacted']));
    expect(snapshot.mcpHost.serverAllowlist).toContain('command-mcp');
    expect(plugin?.permissions.policySource).toBe('manifest');
    expect(plugin?.artifacts.kinds).toEqual(['patch', 'test-report']);
  });

  it('explains routing decisions and writes the trust ledger when requested', () => {
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

    expect(decision.phase).toBe('26');
    expect(decision.surface).toBe('capability-route');
    expect(decision.selected?.id).toBe('route-web-research');
    expect(decision.fallbackChain).toEqual(['research', 'conversation']);
    expect(decision.decision.requiresApproval).toBe(true);
    expect(decision.ledger.recorded).toBe(true);
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'capabilities',
        requestedBy: 'alice',
        sourceSurface: 'cli',
        status: 'previewed',
      }),
    );
  });
});

describe('IntentRouterV2 and ExecutionGatewayV2', () => {
  it('keeps fallback explainable when the primary executor fails', () => {
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

    expect(plan.phase).toBe('26');
    expect(plan.surface).toBe('execution-gateway-v2');
    expect(plan.selectedCapabilityId).toBe('route-codex-auto');
    expect(plan.primaryExecutor).toBe('codex');
    expect(plan.fallbackExecutor).toBe('local_executor');
    expect(plan.preserves.task).toBe(true);
    expect(plan.preserves.artifacts).toEqual(expect.arrayContaining(['patch', 'test-report']));
    expect(plan.reason).toContain('codex');
  });
});
