import {
  CognitiveFirewall,
  getDynamicIntentToolMap,
  setDynamicIntentToolMap,
  ToolGatekeeper,
} from '../../src/cognitive-firewall';
import type { ToolDefinition } from '../../src/providers/ILlmProvider';

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
    expect(decision.stats).toContain('gate=false');
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
});
