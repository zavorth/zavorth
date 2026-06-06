import {
  CognitiveFirewall,
  getDynamicIntentToolMap,
  setDynamicIntentToolMap,
  ToolGatekeeper,
} from '../../src/cognitive-firewall';
import type { ToolDefinition } from '../../src/providers/ILlmProvider';
import { PluginStateService, type StoredPluginState } from '../../src/services/PluginStateService';

function buildPluginState(entries: Record<string, Partial<StoredPluginState>> = {}): PluginStateService {
  const normalizedEntries = Object.fromEntries(
    Object.entries(entries).map(([key, entry]) => [key.toLowerCase(), {
      pluginId: entry.pluginId || key,
      installed: entry.installed ?? true,
      trust: entry.trust || 'review',
      installedRevision: entry.installedRevision || 'rev-test',
      sourceDigest: entry.sourceDigest || 'sha256-test',
      sourceLocator: entry.sourceLocator || 'test-registry',
      sourceTrusted: entry.sourceTrusted ?? false,
      updatedAt: entry.updatedAt || '2026-06-06T00:00:00.000Z',
    }]),
  );
  return new PluginStateService({
    stateFile: 'X:/state/plugin-state.json',
    existsSync: jest.fn(() => true),
    readFileSync: jest.fn(() => JSON.stringify({
      version: 1,
      updatedAt: '2026-06-06T00:00:00.000Z',
      entries: normalizedEntries,
    })),
  });
}

describe('ToolGatekeeper dynamic skill map', () => {
  afterEach(() => {
    setDynamicIntentToolMap({});
  });

  it('merges SkillLoader-provided tool names into intent filtering', () => {
    const gatekeeper = new ToolGatekeeper();
    const tools: ToolDefinition[] = [
      { name: 'web_search', description: 'Busca web', parameters: { type: 'object', properties: {} } },
      { name: 'trend_chart', description: 'Cria grafico de tendencias', parameters: { type: 'object', properties: {} } },
      { name: 'remote_shell', description: 'Shell', parameters: { type: 'object', properties: {} } },
    ];

    setDynamicIntentToolMap({
      research: ['trend_chart'],
    });

    expect(getDynamicIntentToolMap()).toEqual({ research: ['trend_chart'] });
    expect(gatekeeper.filterTools(tools, 'research').map((tool) => tool.name)).toEqual([
      'web_search',
      'trend_chart',
    ]);
  });

  it('keeps conversation turns tool-free unless a category map explicitly adds tools', () => {
    const gatekeeper = new ToolGatekeeper();
    const tools: ToolDefinition[] = [
      { name: 'web_search', description: 'Busca web', parameters: { type: 'object', properties: {} } },
    ];

    expect(gatekeeper.filterTools(tools, 'conversation')).toEqual([]);
  });

  it('emits hint telemetry without becoming the final tool exposure gate', () => {
    const gatekeeper = new ToolGatekeeper();
    const tools: ToolDefinition[] = [
      { name: 'read_file', description: 'Le arquivo do workspace', parameters: { type: 'object', properties: {} } },
      { name: 'list_directory', description: 'Lista diretorio', parameters: { type: 'object', properties: {} } },
      { name: 'web_search', description: 'Busca web', parameters: { type: 'object', properties: {} } },
    ];

    const hint = gatekeeper.buildHintProfile(tools, 'file_operation');

    expect(hint).toEqual(expect.objectContaining({
      intentCategory: 'file_operation',
      groups: ['workspace'],
      recommendedToolNames: expect.arrayContaining(['read_file', 'list_directory']),
      toolExposureGatedByCognitiveFirewall: false,
      isHardGate: false,
    }));
    expect(hint.tools.map((tool) => tool.name)).toEqual(['read_file', 'list_directory']);
    expect(hint.omittedToolNames).toEqual(['web_search']);
  });

  it('treats concrete workspace references as workspace hints even without the old file verbs', () => {
    const firewall = new CognitiveFirewall();
    const tools: ToolDefinition[] = [
      { name: 'read_file', description: 'Le arquivo do workspace', parameters: { type: 'object', properties: {} } },
      { name: 'list_directory', description: 'Lista diretorio', parameters: { type: 'object', properties: {} } },
      { name: 'web_search', description: 'Busca web', parameters: { type: 'object', properties: {} } },
    ];

    const decision = firewall.evaluate('confere o README principal do projeto', tools);

    expect(decision.classification.category).toBe('file_operation');
    expect(decision.toolHintProfile.groups).toEqual(['workspace']);
    expect(decision.recommendedToolNames).toEqual(expect.arrayContaining(['read_file', 'list_directory']));
    expect(decision.toolExposureGatedByCognitiveFirewall).toBe(false);
    expect(decision.stats).toContain('Tools: 2/3');
  });

  it('keeps recent news requests mapped to web hints and simple chat lightweight', () => {
    const firewall = new CognitiveFirewall();
    const tools: ToolDefinition[] = [
      { name: 'web_search', description: 'Busca web', parameters: { type: 'object', properties: {} } },
      { name: 'get_datetime', description: 'Data atual', parameters: { type: 'object', properties: {} } },
      { name: 'read_file', description: 'Le arquivo do workspace', parameters: { type: 'object', properties: {} } },
    ];

    const newsDecision = firewall.evaluate('quais sao as noticias recentes de IA?', tools);
    const chatDecision = firewall.evaluate('oi', tools);

    expect(newsDecision.toolHintProfile.groups).toEqual(['web']);
    expect(newsDecision.recommendedToolNames).toEqual(expect.arrayContaining(['web_search', 'get_datetime']));
    expect(chatDecision.classification.category).toBe('conversation');
    expect(chatDecision.tools).toEqual([]);
    expect(chatDecision.toolHintProfile.toolExposureGatedByCognitiveFirewall).toBe(false);
  });

  it('maps execution and memory hints to registered modern tool names', () => {
    const gatekeeper = new ToolGatekeeper();
    const tools: ToolDefinition[] = [
      { name: 'run_sandbox_code', description: 'Executa codigo em sandbox', parameters: { type: 'object', properties: {} } },
      { name: 'sandbox_execution', description: 'Nome legado inexistente', parameters: { type: 'object', properties: {} } },
      { name: 'semantic_memory', description: 'Consulta memoria semantica', parameters: { type: 'object', properties: {} } },
      { name: 'mem0_memory', description: 'Nome legado inexistente', parameters: { type: 'object', properties: {} } },
      { name: 'get_datetime', description: 'Data atual', parameters: { type: 'object', properties: {} } },
    ];

    expect(gatekeeper.filterTools(tools, 'execution').map((tool) => tool.name)).toContain('run_sandbox_code');
    expect(gatekeeper.filterTools(tools, 'execution').map((tool) => tool.name)).not.toContain('sandbox_execution');
    expect(gatekeeper.filterTools(tools, 'memory').map((tool) => tool.name)).toEqual([
      'semantic_memory',
      'get_datetime',
    ]);
  });

  it('blocks untrusted plugin tools before the LLM sees them, even for full toolset intent', () => {
    const gatekeeper = new ToolGatekeeper(buildPluginState());
    const tools: ToolDefinition[] = [
      { name: 'read_file', description: 'Native read', parameters: { type: 'object', properties: {} } },
      {
        name: 'remote_plugin_send',
        description: 'External send',
        metadata: { pluginId: 'mcp:remote-pack', source: 'mcp' },
        parameters: { type: 'object', properties: {} },
      },
    ];

    const hint = gatekeeper.buildHintProfile(tools, 'full_toolset');

    expect(hint.tools.map((tool) => tool.name)).toEqual(['read_file']);
    expect(hint.recommendedToolNames).toEqual(['read_file']);
    expect(hint.quarantinedToolNames).toEqual(['remote_plugin_send']);
    expect(hint.toolExposureGatedByCognitiveFirewall).toBe(true);
    expect(hint.isHardGate).toBe(true);
    expect(gatekeeper.getFilterStats(tools.length, hint.filteredTools, 'full_toolset', hint.quarantinedToolNames.length))
      .toContain('Quarentena: 1 bloqueada');
  });

  it('allows plugin tools only when the operator trust state and source trust are both explicit', () => {
    const gatekeeper = new ToolGatekeeper(buildPluginState({
      'mcp:trusted-pack': {
        pluginId: 'mcp:trusted-pack',
        trust: 'trusted',
        sourceTrusted: true,
      },
    }));
    const tools: ToolDefinition[] = [
      {
        name: 'trusted_lookup',
        description: 'Trusted lookup',
        metadata: { pluginId: 'mcp:trusted-pack', source: 'mcp' },
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'source_only_mcp',
        description: 'No plugin id',
        metadata: { source: 'mcp' },
        parameters: { type: 'object', properties: {} },
      },
    ];

    const hint = gatekeeper.buildHintProfile(tools, 'full_toolset');

    expect(hint.tools.map((tool) => tool.name)).toEqual(['trusted_lookup']);
    expect(hint.quarantinedToolNames).toEqual(['source_only_mcp']);
  });
});
