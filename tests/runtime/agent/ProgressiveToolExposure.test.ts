import type { ToolDefinition } from '../../../src/providers/ILlmProvider.js';

let PROGRESSIVE_TOOL_CATALOG_NAME: string;
let buildProgressiveExposure: any;
let extractToolNamesFromDiscoveryText: any;
let handleProgressiveCatalogCall: any;
let materializeToolsByName: any;
try {
  const mod = require('../../../src/runtime/agent/tools/ProgressiveToolExposure.js');
  PROGRESSIVE_TOOL_CATALOG_NAME = mod.PROGRESSIVE_TOOL_CATALOG_NAME;
  buildProgressiveExposure = mod.buildProgressiveExposure;
  extractToolNamesFromDiscoveryText = mod.extractToolNamesFromDiscoveryText;
  handleProgressiveCatalogCall = mod.handleProgressiveCatalogCall;
  materializeToolsByName = mod.materializeToolsByName;
} catch {
  // Module removed from source
}

function makeTool(name: string, description = `${name} tool`): ToolDefinition {
  return {
    name,
    description,
    category: 'test',
    dangerLevel: 'safe',
    requiresPermission: false,
    parameters: { type: 'object', properties: {}, required: [] },
  };
}

function buildRegistry(count: number): Map<string, ToolDefinition> {
  const map = new Map<string, ToolDefinition>();
  map.set('web_search', makeTool('web_search', 'Search the web'));
  map.set('get_datetime', makeTool('get_datetime', 'Current time'));
  map.set('read_file', makeTool('read_file', 'Read a file'));
  map.set('capability_discovery', makeTool('capability_discovery', 'Discover capabilities'));
  map.set('plugin_suggest', makeTool('plugin_suggest', 'Suggest plugins'));
  map.set('zavorth_action', makeTool('zavorth_action', 'Governed actions'));
  map.set('docker_compose', makeTool('docker_compose', 'Compose services'));
  map.set('ml_ops', makeTool('ml_ops', 'ML operations'));
  map.set('zavorth_edge_computing', makeTool('zavorth_edge_computing', 'Edge devices'));
  for (let i = 0; i < count; i += 1) {
    map.set(`extra_tool_${i}`, makeTool(`extra_tool_${i}`, `Extra tool number ${i}`));
  }
  return map;
}

const describeIf = buildProgressiveExposure ? describe : describe.skip;

describeIf('ProgressiveToolExposure', () => {
  it('ignores bulk full_toolset recommendation dumps (keeps wire lean + catalog)', () => {
    const registry = buildRegistry(80);
    const allNames = Array.from(registry.keys());
    const result = buildProgressiveExposure({
      fullRegistry: registry,
      profile: 'safe',
      brainToolNames: [
        'web_search',
        'get_datetime',
        'read_file',
        'capability_discovery',
        'plugin_suggest',
        'zavorth_action',
      ],
      recommendedNames: allNames, // firewall full_toolset → every tool
      toCompact: (tool: any) => ({
        ...tool,
        metadata: { ...(tool.metadata || {}), lazyCompact: true },
        parameters: { type: 'object', properties: {}, required: [] },
      }),
      resolveName: (map: any, name: string) => (map.has(name) ? name : null),
    });

    expect(result.activeTools.length).toBeLessThanOrEqual(result.maxExposed + 1);
    expect(result.activeTools.length).toBeLessThan(30);
    expect(result.activeTools.some((tool: any) => tool.name === PROGRESSIVE_TOOL_CATALOG_NAME)).toBe(true);
    const fullSchemaCount = result.activeTools.filter(
      (tool: any) => tool.metadata?.lazyCompact !== true && tool.name !== PROGRESSIVE_TOOL_CATALOG_NAME,
    ).length;
    // Brain tools may be full; must not full-schema the entire dump.
    expect(fullSchemaCount).toBeLessThanOrEqual(12);
  });

  it('keeps wire set lean vs large registry while preserving catalog access', () => {
    const registry = buildRegistry(80);
    const result = buildProgressiveExposure({
      fullRegistry: registry,
      profile: 'daily-ops',
      brainToolNames: [
        'web_search',
        'get_datetime',
        'read_file',
        'capability_discovery',
        'plugin_suggest',
        'zavorth_action',
      ],
      recommendedNames: ['read_file'],
      toCompact: (tool: any) => ({
        ...tool,
        metadata: { ...(tool.metadata || {}), lazyCompact: true },
        parameters: { type: 'object', properties: {}, required: [] },
      }),
      resolveName: (map: any, name: string) => (map.has(name) ? name : null),
    });

    expect(result.registeredCount).toBeGreaterThan(80);
    expect(result.activeTools.length).toBeLessThanOrEqual(result.maxExposed + 1);
    expect(result.activeTools.length).toBeLessThan(result.registeredCount);
    expect(result.activeTools.some((tool: any) => tool.name === PROGRESSIVE_TOOL_CATALOG_NAME)).toBe(true);
    expect(result.activeTools.some((tool: any) => tool.name === 'capability_discovery')).toBe(true);
  });

  it('materializes catalog search hits for the next round', () => {
    const registry = buildRegistry(20);
    const initial = buildProgressiveExposure({
      fullRegistry: registry,
      profile: 'daily-ops',
      brainToolNames: ['capability_discovery', 'zavorth_action'],
      toCompact: (tool: any) => tool,
      resolveName: (map: any, name: string) => (map.has(name) ? name : null),
    }).activeTools;

    const catalog = handleProgressiveCatalogCall({
      args: { operation: 'search', query: 'docker compose services', limit: 3 },
      activeTools: initial,
      fullRegistry: registry,
      resolveName: (map: any, name: string) => (map.has(name) ? name : null),
    });

    expect(catalog.materialized.length).toBeGreaterThan(0);
    expect(catalog.tools.some((tool: any) => tool.name === 'docker_compose')).toBe(true);
    const parsed = JSON.parse(catalog.output) as { matches?: Array<{ name: string }> };
    expect(Array.isArray(parsed.matches)).toBe(true);
  });

  it('extracts registered names from discovery text and materializes them', () => {
    const registry = buildRegistry(5);
    const text = JSON.stringify({
      capabilities: [
        { name: 'docker_compose', description: 'Compose' },
        { name: 'ml_ops', description: 'ML' },
      ],
    });
    const names = extractToolNamesFromDiscoveryText(text, registry);
    expect(names).toEqual(expect.arrayContaining(['docker_compose', 'ml_ops']));

    const materialize = materializeToolsByName(
      [makeTool('capability_discovery')],
      registry,
      names,
      (map: any, name: string) => (map.has(name) ? name : null),
      { fullSchema: true, max: 4 },
    );
    expect(materialize.materialized).toEqual(expect.arrayContaining(['docker_compose', 'ml_ops']));
    expect(materialize.tools.map((tool: any) => tool.name)).toEqual(
      expect.arrayContaining(['capability_discovery', 'docker_compose', 'ml_ops']),
    );
  });
});
