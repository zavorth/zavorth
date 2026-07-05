import {
  toCompact,
  toCompactBatch,
  isCompact,
  resolveFull,
  resolveFullBatch,
  buildToolRegistry,
  calculateSavings,
} from '../../src/cognitive-firewall/LazyToolDefinition';
import type { ToolDefinition } from '../../src/providers/ILlmProvider';

function buildTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: 'test_tool',
    description: 'A test tool for unit testing. It does various things.',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'The input value' },
      },
      required: ['input'],
    },
    ...overrides,
  };
}

describe('LazyToolDefinition', () => {
  describe('toCompact', () => {
    it('produces a compact definition with name and short description', () => {
      const tool = buildTool();
      const compact = toCompact(tool);

      expect(compact.name).toBe('test_tool');
      expect(compact.description).toBe('A test tool for unit testing.');
      expect(compact.compact).toBe(true);
    });

    it('extracts first sentence only', () => {
      const tool = buildTool({
        description: 'Searches the web. Returns results. Supports pagination.',
      });
      const compact = toCompact(tool);

      expect(compact.description).toBe('Searches the web.');
    });

    it('caps description at 80 characters', () => {
      const tool = buildTool({
        description: 'This is a very long description that goes on and on and on and on and on and on and on past the limit we set',
      });
      const compact = toCompact(tool);

      expect(compact.description.length).toBeLessThanOrEqual(80);
      expect(compact.description).toContain('...');
    });

    it('handles empty description', () => {
      const tool = buildTool({ description: '' });
      const compact = toCompact(tool);

      expect(compact.description).toBe('');
    });

    it('preserves category and metadata', () => {
      const tool = buildTool({
        category: 'web',
        metadata: { pluginId: 'test-plugin', source: 'mcp' },
      });
      const compact = toCompact(tool);

      expect(compact.category).toBe('web');
      expect(compact.metadata).toEqual({ pluginId: 'test-plugin', source: 'mcp' });
    });

    it('handles description without sentence-ending punctuation', () => {
      const tool = buildTool({ description: 'Searches the web' });
      const compact = toCompact(tool);

      expect(compact.description).toBe('Searches the web');
    });
  });

  describe('toCompactBatch', () => {
    it('converts multiple tools to compact form', () => {
      const tools = [
        buildTool({ name: 'tool_a', description: 'Does A.' }),
        buildTool({ name: 'tool_b', description: 'Does B.' }),
      ];
      const compacts = toCompactBatch(tools);

      expect(compacts).toHaveLength(2);
      expect(compacts[0].name).toBe('tool_a');
      expect(compacts[1].name).toBe('tool_b');
      expect(compacts.every((c) => c.compact === true)).toBe(true);
    });

    it('returns empty array for empty input', () => {
      expect(toCompactBatch([])).toEqual([]);
    });
  });

  describe('isCompact', () => {
    it('returns true for compact definitions', () => {
      const compact = toCompact(buildTool());
      expect(isCompact(compact)).toBe(true);
    });

    it('returns false for full definitions', () => {
      const tool = buildTool();
      expect(isCompact(tool)).toBe(false);
    });
  });

  describe('resolveFull', () => {
    it('resolves a compact definition to its full form', () => {
      const tool = buildTool();
      const registry = new Map([[tool.name, tool]]);
      const compact = toCompact(tool);

      const resolved = resolveFull(compact, registry);

      expect(resolved).toBe(tool);
      expect(resolved?.parameters).toBeDefined();
      expect(resolved?.parameters.properties.input).toBeDefined();
    });

    it('returns null for unknown tools', () => {
      const registry = new Map<string, ToolDefinition>();
      const compact = toCompact(buildTool({ name: 'unknown' }));

      expect(resolveFull(compact, registry)).toBeNull();
    });
  });

  describe('resolveFullBatch', () => {
    it('resolves multiple compacts, filtering unknowns', () => {
      const toolA = buildTool({ name: 'a' });
      const toolB = buildTool({ name: 'b' });
      const registry = new Map([
        [toolA.name, toolA],
        [toolB.name, toolB],
      ]);
      const compacts = toCompactBatch([
        toolA,
        buildTool({ name: 'unknown' }),
        toolB,
      ]);

      const resolved = resolveFullBatch(compacts, registry);

      expect(resolved).toHaveLength(2);
      expect(resolved.map((r) => r.name)).toEqual(['a', 'b']);
    });
  });

  describe('buildToolRegistry', () => {
    it('creates a name-to-definition map', () => {
      const tools = [
        buildTool({ name: 'a' }),
        buildTool({ name: 'b' }),
      ];
      const registry = buildToolRegistry(tools);

      expect(registry.size).toBe(2);
      expect(registry.get('a')).toBe(tools[0]);
      expect(registry.get('b')).toBe(tools[1]);
    });
  });

  describe('calculateSavings', () => {
    it('reports positive savings', () => {
      const tools = [
        buildTool({
          description: 'Searches the web for information. Supports pagination and filtering.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'The search query' },
              page: { type: 'number', description: 'Page number' },
              limit: { type: 'number', description: 'Results per page' },
            },
            required: ['query'],
          },
        }),
      ];

      const savings = calculateSavings(tools);

      expect(savings.savedTokens).toBeGreaterThan(0);
      expect(savings.savingsPercent).toBeGreaterThan(50);
      expect(savings.compactTokens).toBeLessThan(savings.fullTokens);
    });

    it('returns zero savings for empty input', () => {
      const savings = calculateSavings([]);

      expect(savings.fullTokens).toBe(0);
      expect(savings.compactTokens).toBe(0);
      expect(savings.savedTokens).toBe(0);
      expect(savings.savingsPercent).toBe(0);
    });
  });
});
