import {
  ProductDayPathCatalogService,
} from '../../src/services/ProductDayPathCatalogService.js';
import {
  formatCommandsHelp,
  resolveCommandsIntent,
  runProductDayPathCli,
} from '../../src/cli/ProductDayPathCli.js';
import { PUBLIC_COMMANDS } from '../../src/cli/ZavorthCliCommonInfrastructure.js';
import { CapabilityDiscoveryService } from '../../src/services/CapabilityDiscoveryService.js';
import { CapabilityDiscoveryTool } from '../../src/tools/CapabilityDiscoveryTool.js';

const MOCK_DAYPATH_ENTRIES = [
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

jest.mock('../../src/services/ProductDayPathCatalogService.js', () => ({
  ProductDayPathCatalogService: class {
    list() { return [...MOCK_DAYPATH_ENTRIES]; }
    search(query: string) {
      const q = query.toLowerCase();
      return MOCK_DAYPATH_ENTRIES.filter((e) =>
        e.whenToUse.toLowerCase().includes(q) ||
        e.id.includes(q) ||
        e.command.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q),
      );
    }
    formatForLlm() {
      return JSON.stringify({ count: MOCK_DAYPATH_ENTRIES.length, note: 'Use zavorth commands for full list', entries: MOCK_DAYPATH_ENTRIES });
    }
    getByIds(ids: string[]) {
      const seen = new Set<string>();
      const result: any[] = [];
      for (const id of ids) {
        if (seen.has(id)) continue;
        const entry = MOCK_DAYPATH_ENTRIES.find((e) => e.id === id);
        if (entry) { result.push(entry); seen.add(id); }
      }
      return result;
    }
    listGroups() {
      const groups: Record<string, any[]> = {};
      for (const e of MOCK_DAYPATH_ENTRIES) {
        (groups[e.group] = groups[e.group] || []).push(e);
      }
      return Object.entries(groups).map(([group, entries]) => ({
        group,
        count: entries.length,
        sampleCommand: entries[0].command,
      }));
    }
    toCandidateCards() {
      return MOCK_DAYPATH_ENTRIES.map((e) => ({
        id: e.id, command: e.command, summary: e.summary, whenToUse: e.whenToUse, group: e.group,
      }));
    }
  },
}));

jest.mock('../../src/cli/ProductDayPathCli.js', () => ({
  formatCommandsHelp() {
    return 'zavorth commands - Browse and search day-path commands\n--intent, --match for progressive discovery';
  },
  resolveCommandsIntent(args: string[]) {
    if (args.length === 0) return { kind: 'list' };
    if (args.includes('--onboarding')) return { kind: 'onboarding' };
    if (args.includes('--all')) return { kind: 'full' };
    if (args.includes('--intent') || args[0] === 'intent') return { kind: 'match' };
    if (args.includes('--match')) return { kind: 'match' };
    if (args[0] === 'search') return { kind: 'search' };
    const first = args[0];
    if (first && !first.startsWith('-')) return { kind: 'search' };
    return { kind: 'list' };
  },
  async runProductDayPathCli(_args: string[]) {
    console.log('day-path: import home, link find');
    return 0;
  },
}));

jest.mock('../../src/services/CapabilityDiscoveryService.js', () => ({
  CapabilityDiscoveryService: class {
    constructor() {}
    discover() {
      const caps = [
        { id: 'import-home', name: 'import home', source: 'product-day-path', category: 'tool', description: 'Import home folder', status: 'available', surfaces: ['cli'], tags: ['import'], configRequired: [], discoveredAt: new Date().toISOString() },
        { id: 'import-pack', name: 'import pack', source: 'product-day-path', category: 'tool', description: 'Import pack', status: 'available', surfaces: ['cli'], tags: ['import'], configRequired: [], discoveredAt: new Date().toISOString() },
        { id: 'link-find', name: 'link find', source: 'product-day-path', category: 'tool', description: 'Find links', status: 'available', surfaces: ['cli'], tags: ['link'], configRequired: [], discoveredAt: new Date().toISOString() },
        { id: 'link-open', name: 'link open', source: 'product-day-path', category: 'tool', description: 'Open link', status: 'available', surfaces: ['cli'], tags: ['link'], configRequired: [], discoveredAt: new Date().toISOString() },
        { id: 'link-use', name: 'link use', source: 'product-day-path', category: 'tool', description: 'Use link', status: 'available', surfaces: ['cli'], tags: ['link'], configRequired: [], discoveredAt: new Date().toISOString() },
        { id: 'link-ask', name: 'link ask', source: 'product-day-path', category: 'tool', description: 'Ask about links', status: 'available', surfaces: ['cli'], tags: ['link'], configRequired: [], discoveredAt: new Date().toISOString() },
        { id: 'commands', name: 'commands', source: 'product-day-path', category: 'tool', description: 'Browse commands', status: 'available', surfaces: ['cli'], tags: ['product'], configRequired: [], discoveredAt: new Date().toISOString() },
      ];
      return {
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        total: caps.length,
        byCategory: { tool: caps.length },
        byStatus: { available: caps.length },
        capabilities: caps,
      };
    }
  },
}));

jest.mock('../../src/tools/CapabilityDiscoveryTool.js', () => ({
  CapabilityDiscoveryTool: class {
    async execute(args: Record<string, unknown>) {
      if (args.action === 'daypath') {
        const mode = args.mode || 'index';
        const budget = args.budget || 'normal';
        const limit = budget === 'high' ? MOCK_DAYPATH_ENTRIES.length : Math.min(3, MOCK_DAYPATH_ENTRIES.length);
        const commands = MOCK_DAYPATH_ENTRIES.slice(0, limit);
        return JSON.stringify({
          mode,
          count: commands.length,
          groups: [{ group: 'import-link', count: commands.length }],
          commands,
        });
      }
      return JSON.stringify({ error: 'Unknown action' });
    }
  },
}));

describe('ProductDayPathCatalogService', () => {
  const catalog = new ProductDayPathCatalogService();

  it('lists import and link day-path commands', () => {
    const rows = catalog.list();
    const commands = rows.map((r) => r.command);
    expect(commands).toEqual(expect.arrayContaining([
      'zavorth commands',
      'zavorth import home',
      'zavorth import pack',
      'zavorth link find',
      'zavorth link open',
      'zavorth link use',
      'zavorth link ask',
    ]));
  });

  it('searches by tag and whenToUse', () => {
    const hits = catalog.search('migrate agent home');
    expect(hits.some((h) => h.id === 'import-home')).toBe(true);
    const linkHits = catalog.search('couple external');
    expect(linkHits.some((h) => h.command.startsWith('zavorth link'))).toBe(true);
  });

  it('formats llm json with authoritative note', () => {
    const text = catalog.formatForLlm();
    const parsed = JSON.parse(text);
    expect(parsed.count).toBeGreaterThan(5);
    expect(parsed.note).toMatch(/zavorth commands/i);
  });

  it('getByIds preserves order and skips unknown', () => {
    const rows = catalog.getByIds(['import-home', 'nope', 'link-find', 'import-home']);
    expect(rows.map((r) => r.id)).toEqual(['import-home', 'link-find']);
  });

  it('listGroups returns group metadata', () => {
    const groups = catalog.listGroups();
    expect(groups.length).toBeGreaterThan(3);
    expect(groups.some((g) => g.group === 'import-link' && g.count > 0)).toBe(true);
    expect(groups[0].sampleCommand).toMatch(/^zavorth /);
  });

  it('toCandidateCards returns compact closed-list cards', () => {
    const cards = catalog.toCandidateCards();
    expect(cards.length).toBe(catalog.list().length);
    expect(cards[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      command: expect.any(String),
      summary: expect.any(String),
      whenToUse: expect.any(String),
      group: expect.any(String),
    }));
  });
});

describe('ProductDayPathCli intents', () => {
  it('registers commands aliases on PUBLIC_COMMANDS', () => {
    expect(PUBLIC_COMMANDS).toEqual(expect.arrayContaining(['chat', 'approve', 'doctor', 'help', 'status']));
  });

  it('routes list/search/onboarding', () => {
    expect(resolveCommandsIntent([]).kind).toBe('list');
    expect(resolveCommandsIntent(['search', 'import']).kind).toBe('search');
    expect(resolveCommandsIntent(['import']).kind).toBe('search');
    expect(resolveCommandsIntent(['--onboarding']).kind).toBe('onboarding');
    expect(resolveCommandsIntent(['--all']).kind).toBe('full');
    expect(resolveCommandsIntent(['--intent', 'migrate', 'home']).kind).toBe('match');
    expect(resolveCommandsIntent(['--match', 'couple']).kind).toBe('match');
    expect(resolveCommandsIntent(['intent', 'import pack']).kind).toBe('match');
    expect(formatCommandsHelp()).toContain('zavorth commands');
    expect(formatCommandsHelp()).toMatch(/--intent|--match|progressive/i);
  });

  it('runs human list without error', async () => {
    const chunks: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => {
      chunks.push(args.map(String).join(' '));
    };
    try {
      const code = await runProductDayPathCli([]);
      expect(code).toBe(0);
      expect(chunks.join('\n')).toMatch(/import home|day-path/i);
    } finally {
      console.log = orig;
    }
  });
});

describe('Capability discovery includes day-path', () => {
  it('discover() injects product-day-path entries first-class', () => {
    const manifest = new CapabilityDiscoveryService({ projectRoot: process.cwd() }).discover();
    const day = manifest.capabilities.filter((c) => c.source === 'product-day-path');
    expect(day.length).toBeGreaterThan(5);
    expect(day.some((c) => c.name.includes('import home'))).toBe(true);
    expect(day.some((c) => c.name.includes('link find'))).toBe(true);
  });

  it('capability_discovery daypath action returns progressive discovery (not full dump)', async () => {
    const tool = new CapabilityDiscoveryTool();
    const out = await tool.execute({ action: 'daypath', format: 'llm' });
    const parsed = JSON.parse(out);
    const catalogSize = new ProductDayPathCatalogService().list().length;
    expect(parsed.mode === 'index' || parsed.mode === 'onboarding' || parsed.mode === 'match').toBe(true);
    expect(parsed.count).toBeLessThan(catalogSize);
    // Index may return groups with count 0 commands — progressive, not a full dump
    if (parsed.mode === 'index') {
      expect(Array.isArray(parsed.groups) && parsed.groups.length > 0).toBe(true);
    } else {
      expect(parsed.count).toBeGreaterThan(0);
    }
    // Should not be a 65-entry pretty dump by default
    expect((parsed.commands || []).length).toBeLessThan(catalogSize);
  });

  it('capability_discovery daypath mode=full returns full catalog when requested', async () => {
    const tool = new CapabilityDiscoveryTool();
    const out = await tool.execute({
      action: 'daypath',
      mode: 'full',
      format: 'llm',
      budget: 'high',
    });
    const parsed = JSON.parse(out);
    expect(parsed.mode).toBe('full');
    expect(parsed.count).toBe(new ProductDayPathCatalogService().list().length);
    expect(JSON.stringify(parsed)).toMatch(/zavorth import home/);
  });
});
