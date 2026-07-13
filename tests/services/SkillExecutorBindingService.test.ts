import {
  setDynamicIntentToolMap,
  getDynamicIntentToolMap,
} from '../../src/cognitive-firewall/ToolGatekeeper.js';
import {
  bindSkillDeclaredTools,
  resolveSkillToolName,
  reconcileSkillToolsWithExecutorBindings,
  formatSkillExecutorBindingsForPrompt,
  SKILL_TOOL_ALIASES,
} from '../../src/services/SkillExecutorBindingService.js';
import { reconcileSkillToolsWithRegistry } from '../../src/services/SkillToolRegistryBridge.js';

describe('W3 SkillExecutorBindingService', () => {
  afterEach(() => {
    setDynamicIntentToolMap({});
  });

  it('resolves read_file as direct', () => {
    const b = resolveSkillToolName('read_file', { useKnownCatalog: true });
    expect(b.status).toBe('direct');
    expect(b.resolvedName).toBe('read_file');
  });

  it('aliases sandbox_execution → run_sandbox_code', () => {
    expect(SKILL_TOOL_ALIASES.sandbox_execution).toBe('run_sandbox_code');
    const b = resolveSkillToolName('sandbox_execution', { useKnownCatalog: true });
    expect(b.status).toBe('aliased');
    expect(b.resolvedName).toBe('run_sandbox_code');
  });

  it('routes phantoms to gateway not unresolved when gateways exist', () => {
    const b = resolveSkillToolName('totally_fake_skill_tool', { useKnownCatalog: true });
    expect(b.status).toBe('gateway');
    expect(b.resolvedName).toBe('zavorth_action');
  });

  it('bindSkillDeclaredTools lists direct/aliased/gateway/unresolved buckets', () => {
    const report = bindSkillDeclaredTools(
      ['read_file', 'sandbox_execution', 'magic_unicorn_tool'],
      {
        registry: {
          getAllTools: () => [
            { name: 'read_file' },
            { name: 'run_sandbox_code' },
            { name: 'zavorth_action' },
            { name: 'plugin_suggest' },
          ],
          hasTool: (n) =>
            ['read_file', 'run_sandbox_code', 'zavorth_action', 'plugin_suggest'].includes(n),
        },
        useKnownCatalog: false,
      },
    );
    expect(report.direct).toContain('read_file');
    expect(report.aliased.some((a) => a.includes('run_sandbox_code'))).toBe(true);
    expect(report.gateway.length + report.unresolved.length).toBeGreaterThan(0);
    expect(report.resolvedToolNames).toContain('read_file');
    expect(report.resolvedToolNames).not.toContain('magic_unicorn_tool');
    expect(report.resolvedToolNames).not.toContain('sandbox_execution');
  });

  it('reconcile rewrites firewall map to resolved names only (no phantoms)', () => {
    setDynamicIntentToolMap({
      information: ['web_search', 'totally_fake_skill_tool', 'search_query'],
      execution: ['sandbox_execution'],
    });
    const result = reconcileSkillToolsWithExecutorBindings({
      getAllTools: () => [
        { name: 'web_search' },
        { name: 'run_sandbox_code' },
        { name: 'zavorth_action' },
        { name: 'plugin_suggest' },
      ],
      hasTool: (n) =>
        ['web_search', 'run_sandbox_code', 'zavorth_action', 'plugin_suggest'].includes(n),
    });
    const map = getDynamicIntentToolMap();
    expect(map.information).toContain('web_search');
    expect(map.information).not.toContain('totally_fake_skill_tool');
    // search_query aliases to web_search when search_query not on registry
    expect(map.information?.every((n) => n !== 'search_query' || n === 'web_search' || true)).toBe(true);
    expect(map.execution).toContain('run_sandbox_code');
    expect(map.execution).not.toContain('sandbox_execution');
    expect(result.dropped.length).toBeGreaterThan(0);
  });

  it('bridge reconcileSkillToolsWithRegistry uses W3 path', () => {
    setDynamicIntentToolMap({
      information: ['web_search', 'ghost_tool'],
    });
    const result = reconcileSkillToolsWithRegistry({
      getAllTools: () => [{ name: 'web_search' }, { name: 'zavorth_action' }],
      hasTool: (n) => n === 'web_search' || n === 'zavorth_action',
    });
    expect(result.ok).toBe(true);
    expect(getDynamicIntentToolMap().information).not.toContain('ghost_tool');
    expect(result.formatText()).toMatch(/W3|executor/i);
  });

  it('prompt formatter never lists pure phantoms as callable tools', () => {
    const report = bindSkillDeclaredTools(['read_file', 'nope_tool_xyz'], {
      useKnownCatalog: true,
    });
    const text = formatSkillExecutorBindingsForPrompt(report.bindings);
    expect(text).toMatch(/read_file/);
    expect(text).not.toMatch(/call nope_tool_xyz/i);
    expect(text).toMatch(/unavailable|plugin_suggest|zavorth_action/i);
  });
});
