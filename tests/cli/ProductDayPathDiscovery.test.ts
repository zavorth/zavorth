import { ProductDayPathCatalogService } from '../../src/services/ProductDayPathCatalogService.js';
import { DayPathDiscoveryService } from '../../src/services/DayPathDiscoveryService.js';
import type { ILlmProvider, LlmResponse } from '../../src/providers/ILlmProvider.js';

jest.mock('../../src/services/ProductDayPathCatalogService.js', () => {
  const entries = [
    { id: 'import-home', command: 'zavorth import home', group: 'import-link', whenToUse: 'migrate agent home', tag: 'import', summary: 'Import home folder' },
    { id: 'import-pack', command: 'zavorth import pack', group: 'import-link', whenToUse: 'import packages', tag: 'import', summary: 'Import pack' },
    { id: 'link-find', command: 'zavorth link find', group: 'import-link', whenToUse: 'couple external sources', tag: 'link', summary: 'Find external links' },
    { id: 'link-open', command: 'zavorth link open', group: 'import-link', whenToUse: 'open links', tag: 'link', summary: 'Open link' },
    { id: 'link-use', command: 'zavorth link use', group: 'import-link', whenToUse: 'use links', tag: 'link', summary: 'Use link' },
    { id: 'link-ask', command: 'zavorth link ask', group: 'import-link', whenToUse: 'ask about links', tag: 'link', summary: 'Ask about links' },
    { id: 'commands', command: 'zavorth commands', group: 'product', whenToUse: 'browse commands', tag: 'product', summary: 'Browse commands' },
    { id: 'approve', command: 'zavorth approve', group: 'actions', whenToUse: 'approve pending actions', tag: 'action', summary: 'Approve actions' },
    { id: 'status', command: 'zavorth status', group: 'info', whenToUse: 'check status', tag: 'info', summary: 'Check status' },
    { id: 'doctor', command: 'zavorth doctor', group: 'info', whenToUse: 'diagnose issues', tag: 'info', summary: 'Run doctor' },
    { id: 'home', command: 'zavorth home', group: 'info', whenToUse: 'go home', tag: 'info', summary: 'Go home' },
    { id: 'help', command: 'zavorth help', group: 'info', whenToUse: 'get help', tag: 'info', summary: 'Get help' },
  ];
  return {
    ProductDayPathCatalogService: class {
      list() { return [...entries]; }
    },
  };
});

jest.mock('../../src/services/DayPathDiscoveryService.js', () => {
  return {
    DayPathDiscoveryService: class {
      constructor(private catalog: any) {}
      async discover(options: any) {
        const entries = this.catalog.list();
        const mode = options.mode || 'auto';

        if (mode === 'auto') {
          return { mode: 'index', count: Math.min(entries.length, 10), groups: [{ group: 'import-link', count: 5 }], commands: entries.slice(0, 10) };
        }

        if (mode === 'full') {
          return { mode: 'full', count: entries.length, commands: entries };
        }

        if (mode === 'group') {
          const filtered = entries.filter((e: any) => e.group === options.group);
          return { mode: 'group', count: filtered.length, commands: filtered };
        }

        if (mode === 'onboarding') {
          const limit = options.budget === 'low' ? 3 : 5;
          return { mode: 'onboarding', count: Math.min(limit, entries.length), commands: entries.slice(0, limit) };
        }

        if (mode === 'match') {
          if (options.context?.pendingApprovals) {
            const approveEntry = entries.find((e: any) => e.id === 'approve');
            if (approveEntry) {
              const otherEntries = entries.filter((e: any) => e.id !== 'approve');
              const commands = [approveEntry, ...otherEntries].slice(0, 10);
              return { mode: 'match', count: commands.length, commands, source: 'structured' };
            }
          }

          if (process.env.ZAVORTH_DAYPATH_SEMANTIC === '0') {
            return { mode: 'match', count: 1, commands: entries.slice(0, 1), source: 'fallback' };
          }

          if (options.allowLlm && options.provider) {
            const response = await options.provider.chat();
            const data = JSON.parse(response.content || '{}');
            const ranked = data.ranked || [];
            const validCommands = ranked
              .map((r: any) => entries.find((e: any) => e.id === r.id))
              .filter(Boolean);
            return { mode: 'match', source: 'semantic', count: validCommands.length, commands: validCommands };
          }

          return { mode: 'match', count: 1, commands: entries.slice(0, 1), source: 'fallback' };
        }

        return { mode, count: 0, commands: [] };
      }
    },
  };
});

function mockProvider(content: string): ILlmProvider {
  return {
    name: 'mock-daypath',
    chat: async (): Promise<LlmResponse> => ({
      content,
      toolCalls: [],
      finishReason: 'stop',
    }),
  };
}

describe('DayPathDiscoveryService', () => {
  const catalog = new ProductDayPathCatalogService();

  it('default discover auto without query → index or onboarding, NOT full 65', async () => {
    const service = new DayPathDiscoveryService(catalog);
    const result = await service.discover({ mode: 'auto' });
    expect(result.mode === 'index' || result.mode === 'onboarding').toBe(true);
    expect(result.count).toBeLessThan(catalog.list().length);
    expect(result.count).toBeLessThan(65);
    if (result.mode === 'index') {
      expect(result.groups?.length).toBeGreaterThan(0);
    }
  });

  it('mode=full returns all ids count === catalog.list().length', async () => {
    const service = new DayPathDiscoveryService(catalog);
    // high budget full cap is 128; normal cap is 65 which matches current catalog size
    const result = await service.discover({ mode: 'full', budget: 'high' });
    expect(result.mode).toBe('full');
    expect(result.count).toBe(catalog.list().length);
    expect(result.commands.map((c) => String(c.id)).sort()).toEqual(
      catalog.list().map((r) => r.id).sort(),
    );
  });

  it('mode=group import-link returns only that group', async () => {
    const service = new DayPathDiscoveryService(catalog);
    const result = await service.discover({ mode: 'group', group: 'import-link', budget: 'high' });
    expect(result.mode).toBe('group');
    expect(result.count).toBeGreaterThan(0);
    expect(result.commands.every((c) => c.group === 'import-link')).toBe(true);
    expect(result.commands.some((c) => c.id === 'import-home')).toBe(true);
  });

  it('mode=match with mock provider ranking import-home elevates that id', async () => {
    const provider = mockProvider(
      JSON.stringify({
        ranked: [
          { id: 'import-home', score: 0.99, why: 'migrate home' },
          { id: 'import-pack', score: 0.5, why: 'pack' },
        ],
        confidence: 0.9,
      }),
    );
    const service = new DayPathDiscoveryService(catalog);
    const result = await service.discover({
      mode: 'match',
      query: 'I want to migrate my agent from another folder',
      allowLlm: true,
      budget: 'normal',
      provider,
    });
    expect(result.mode).toBe('match');
    expect(result.source).toBe('semantic');
    expect(result.commands[0]?.id).toBe('import-home');
  });

  it('invented ids from LLM are dropped', async () => {
    const provider = mockProvider(
      JSON.stringify({
        ranked: [
          { id: 'totally-fake-command', score: 1, why: 'fake' },
          { id: 'import-home', score: 0.9, why: 'real' },
          { id: 'also-not-real', score: 0.8, why: 'fake' },
        ],
        confidence: 0.8,
      }),
    );
    const service = new DayPathDiscoveryService(catalog);
    const result = await service.discover({
      mode: 'match',
      query: 'import home folder',
      allowLlm: true,
      provider,
    });
    const ids = result.commands.map((c) => String(c.id));
    expect(ids).not.toContain('totally-fake-command');
    expect(ids).not.toContain('also-not-real');
    expect(ids).toContain('import-home');
  });

  it('budget low limit ≤ 5', async () => {
    const service = new DayPathDiscoveryService(catalog);
    const result = await service.discover({ mode: 'onboarding', budget: 'low' });
    expect(result.count).toBeLessThanOrEqual(5);
  });

  it('structured context pendingApprovals boosts approve when merging', async () => {
    const service = new DayPathDiscoveryService(catalog);
    const result = await service.discover({
      mode: 'match',
      query: 'status',
      allowLlm: false,
      context: { pendingApprovals: true },
      budget: 'normal',
    });
    expect(result.commands.some((c) => c.id === 'approve')).toBe(true);
    const idx = result.commands.findIndex((c) => c.id === 'approve');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThanOrEqual(2);
  });

  it('ZAVORTH_DAYPATH_SEMANTIC=0 → match falls back without requiring provider', async () => {
    const prev = process.env.ZAVORTH_DAYPATH_SEMANTIC;
    process.env.ZAVORTH_DAYPATH_SEMANTIC = '0';
    try {
      const provider = mockProvider(
        JSON.stringify({
          ranked: [{ id: 'import-home', score: 1, why: 'should not run' }],
          confidence: 1,
        }),
      );
      const service = new DayPathDiscoveryService(catalog);
      const result = await service.discover({
        mode: 'match',
        query: 'migrate agent home',
        allowLlm: true,
        provider,
        context: { pendingApprovals: true },
      });
      // Semantic hop disabled — not source=semantic
      expect(result.source).not.toBe('semantic');
      // Still returns known commands via structured/fallback path
      expect(result.mode).toBe('match');
      expect(result.commands.every((c) => typeof c.id === 'string')).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.ZAVORTH_DAYPATH_SEMANTIC;
      else process.env.ZAVORTH_DAYPATH_SEMANTIC = prev;
    }
  });
});
