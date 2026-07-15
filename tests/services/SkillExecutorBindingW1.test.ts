import {
  bindSkillDeclaredTools,
  formatToolBindsTable,
  mergeAliasMaps,
  resolveSkillToolName,
  SKILL_TOOL_ALIASES,
} from '../../src/services/SkillExecutorBindingService.js';

describe('SkillExecutorBindingService aliases and guidance', () => {
  it('aliases search_query → web_search', () => {
    const b = resolveSkillToolName('search_query', { useKnownCatalog: true });
    expect(b.status).toBe('aliased');
    expect(b.resolvedName).toBe('web_search');
    expect(b.guidanceOnly).toBe(false);
  });

  it('marks unknown tools unresolved guidance-only', () => {
    const b = resolveSkillToolName('totally_unknown_tool_xyz', { useKnownCatalog: true });
    // With known catalog + gateways present, may route to gateway instead of unresolved.
    // Force empty gateway + empty known for pure unresolved:
    const pure = resolveSkillToolName('totally_unknown_tool_xyz', {
      useKnownCatalog: false,
      registry: { has: () => false, list: () => [] } as any,
      gatewayFallbacks: [],
    });
    expect(pure.status).toBe('unresolved');
    expect(pure.resolvedName).toBeNull();
    expect(pure.guidanceOnly).toBe(true);
    expect(pure.note).toMatch(/guidance-only/i);
  });

  it('merges pack-declared aliases', () => {
    const map = mergeAliasMaps(SKILL_TOOL_ALIASES, {
      custom_search: ['web_search'],
    });
    const b = resolveSkillToolName('custom_search', {
      useKnownCatalog: true,
      aliasMap: map,
    });
    expect(b.status).toBe('aliased');
    expect(b.resolvedName).toBe('web_search');
  });

  it('bind report includes guidanceOnly on unresolved', () => {
    const report = bindSkillDeclaredTools([{ name: 'read_file' }, { name: 'nope_tool_abc' }], {
      useKnownCatalog: true,
      gatewayFallbacks: [],
      registry: {
        has: (n: string) => n === 'read_file',
        list: () => ['read_file'],
      } as any,
    });
    expect(report.direct).toContain('read_file');
    const unresolved = report.bindings.find((x) => x.declaredName === 'nope_tool_abc');
    expect(unresolved?.status).toBe('unresolved');
    expect(unresolved?.guidanceOnly).toBe(true);
    expect(formatToolBindsTable(report.bindings)).toMatch(/read_file/);
    expect(formatToolBindsTable(report.bindings)).toMatch(/guidanceOnly/i);
  });
});
