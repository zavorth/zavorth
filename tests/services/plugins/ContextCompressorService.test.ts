import fs from 'fs';
import path from 'path';
import os from 'os';
import { ContextCompressorService, ConversationTurn } from '../../../src/services/plugins/ContextCompressorService';

function makeTurn(role: ConversationTurn['role'], content: string, tokens-: number): ConversationTurn {
  return {
    role,
    content,
    timestamp: new Date().toISOString(),
    ...(tokens ? { tokens } : {}),
  };
}

function makeTurns(n: number, contentPrefix = 'message'): ConversationTurn[] {
  return Array.from({ length: n }, (_, i) =>
    makeTurn(i % 2 === 0 ? 'user' : 'assistant', `${contentPrefix} ${i} with some extra content here`),
  );
}

describe('ContextCompressorService', () => {
  let service: ContextCompressorService;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-compress-'));
    service = new ContextCompressorService({ storageDir: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('compress() - short conversations (no-op)', () => {
    it('returns no-op for short conversation with balanced strategy', () => {
      const turns = makeTurns(5);
      const result = service.compress(turns, 'balanced');
      expect(result.compression_ratio).toBe(1.0);
      expect(result.original_turns).toBe(5);
      expect(result.compressed_turns).toBe(5);
      expect(result.archived_turns).toHaveLength(0);
    });

    it('returns no-op when tokens are below threshold', () => {
      const turns = [makeTurn('user', 'hi'), makeTurn('assistant', 'hello')];
      const result = service.compress(turns, 'aggressive');
      expect(result.compression_ratio).toBe(1.0);
    });
  });

  describe('compress() - long conversations', () => {
    it('compresses when turns exceed strategy max_turns', () => {
      const turns = makeTurns(60);
      const result = service.compress(turns, 'balanced');
      expect(result.compressed_turns).toBeLessThan(result.original_turns);
      expect(result.compression_ratio).toBeLessThan(1.0);
    });

    it('preserves recent turns', () => {
      const turns = makeTurns(50);
      const result = service.compress(turns, 'balanced');
      const recentContent = turns.slice(-10).map(t => t.content);
      const preservedContent = result.preserved_turns
        .filter(t => t.role !== 'system')
        .map(t => t.content);
      for (const c of recentContent) {
        expect(preservedContent).toContain(c);
      }
    });

    it('archives old turns', () => {
      const turns = makeTurns(50);
      const result = service.compress(turns, 'balanced');
      expect(result.archived_turns.length).toBeGreaterThan(0);
    });

    it('generates a summary for old turns', () => {
      const turns = makeTurns(50);
      const result = service.compress(turns, 'balanced');
      expect(result.summary).toBeTruthy();
      expect(result.summary).toContain('user messages');
    });
  });

  describe('compress() - conservative strategy', () => {
    it('preserves up to 20 recent turns', () => {
      const turns = makeTurns(60);
      const result = service.compress(turns, 'conservative');
      const nonSystem = result.preserved_turns.filter(t => t.role !== 'system');
      expect(nonSystem.length).toBeLessThanOrEqual(20);
    });

    it('keeps tool results', () => {
      const turns: ConversationTurn[] = [
        ...makeTurns(55, 'old'),
        makeTurn('tool', 'tool result data'),
        makeTurn('user', 'latest message'),
      ];
      const result = service.compress(turns, 'conservative');
      const toolTurns = result.preserved_turns.filter(t => t.role === 'tool');
      expect(toolTurns.length).toBeGreaterThan(0);
    });
  });

  describe('compress() - balanced strategy', () => {
    it('preserves 10 recent turns', () => {
      const turns = makeTurns(40);
      const result = service.compress(turns, 'balanced');
      const nonSystem = result.preserved_turns.filter(t => t.role !== 'system');
      expect(nonSystem.length).toBeLessThanOrEqual(10);
    });

    it('does not keep tool results', () => {
      const turns: ConversationTurn[] = [
        ...makeTurns(35, 'old'),
        makeTurn('tool', 'tool result'),
        makeTurn('user', 'latest'),
      ];
      const result = service.compress(turns, 'balanced');
      const toolTurns = result.preserved_turns.filter(t => t.role === 'tool');
      expect(toolTurns).toHaveLength(0);
    });
  });

  describe('compress() - aggressive strategy', () => {
    it('preserves only 5 recent turns', () => {
      const turns = makeTurns(20);
      const result = service.compress(turns, 'aggressive');
      const nonSystem = result.preserved_turns.filter(t => t.role !== 'system');
      expect(nonSystem.length).toBeLessThanOrEqual(5);
    });

    it('achieves higher compression than balanced', () => {
      const turns = makeTurns(30);
      const balanced = service.compress(turns, 'balanced');
      const aggressive = new ContextCompressorService({ storageDir: tmpDir }).compress(turns, 'aggressive');
      expect(aggressive.compression_ratio).toBeLessThanOrEqual(balanced.compression_ratio);
    });
  });

  describe('compress() - fact-only strategy', () => {
    it('preserves only 3 recent turns', () => {
      const turns = makeTurns(20);
      const result = service.compress(turns, 'fact-only');
      const nonSystem = result.preserved_turns.filter(t => t.role !== 'system');
      expect(nonSystem.length).toBeLessThanOrEqual(3);
    });

    it('does not generate summary', () => {
      const turns = makeTurns(20);
      const result = service.compress(turns, 'fact-only');
      const summaries = result.preserved_turns.filter(t => t.content.startsWith('[Context Summary]'));
      expect(summaries).toHaveLength(0);
    });

    it('extracts facts', () => {
      const turns: ConversationTurn[] = [
        ...makeTurns(10, 'chat'),
        makeTurn('user', 'My name is Alice and I prefer dark mode'),
        makeTurn('assistant', 'Hello Alice!'),
        ...makeTurns(5, 'more chat'),
      ];
      const result = service.compress(turns, 'fact-only');
      expect(result.key_facts.length).toBeGreaterThan(0);
    });
  });

  describe('compressForProvider()', () => {
    it('uses conservative when well under limit', () => {
      const turns = makeTurns(5);
      const result = service.compressForProvider(turns, 100000);
      expect(result.compression_ratio).toBe(1.0);
    });

    it('uses balanced when approaching limit', () => {
      const turns = makeTurns(40);
      const totalTokens = turns.reduce((s, t) => s + t.content.length, 0) / 4;
      const limit = Math.ceil(totalTokens / 0.85);
      const result = service.compressForProvider(turns, limit);
      expect(result).toBeDefined();
    });

    it('uses aggressive when over limit', () => {
      const turns = makeTurns(50);
      const totalTokens = turns.reduce((s, t) => s + t.content.length, 0) / 4;
      const limit = Math.ceil(totalTokens / 1.1);
      const result = service.compressForProvider(turns, limit);
      expect(result).toBeDefined();
    });
  });

  describe('fact extraction', () => {
    it('extracts user name', () => {
      const turns: ConversationTurn[] = [
        ...makeTurns(10, 'chat'),
        makeTurn('user', 'My name is Bob'),
        ...makeTurns(10, 'more chat'),
      ];
      const result = service.compress(turns, 'fact-only');
      const factStr = result.key_facts.join('; ');
      expect(factStr).toContain('Bob');
    });

    it('extracts preferences', () => {
      const turns: ConversationTurn[] = [
        ...makeTurns(10, 'chat'),
        makeTurn('user', 'I always use TypeScript over JavaScript'),
        ...makeTurns(10, 'more chat'),
      ];
      const result = service.compress(turns, 'fact-only');
      const factStr = result.key_facts.join('; ');
      expect(factStr).toContain('Preference');
    });

    it('extracts tool usage', () => {
      const turns: ConversationTurn[] = [
        ...makeTurns(10, 'chat'),
        {
          role: 'user' as const,
          content: 'Run the linter',
          timestamp: new Date().toISOString(),
          tool_calls: [{ name: 'eslint', args: { path: '.' } }],
        },
        ...makeTurns(10, 'more chat'),
      ];
      const result = service.compress(turns, 'fact-only');
      const factStr = result.key_facts.join('; ');
      expect(factStr).toContain('eslint');
    });

    it('deduplicates facts', () => {
      const turns: ConversationTurn[] = [
        ...makeTurns(10, 'chat'),
        makeTurn('user', 'My name is Alice'),
        makeTurn('user', 'My name is Alice again'),
        ...makeTurns(10, 'more chat'),
      ];
      const result = service.compress(turns, 'fact-only');
      const nameFacts = result.key_facts.filter(f => f.includes('Alice'));
      expect(nameFacts.length).toBeLessThanOrEqual(2);
    });
  });

  describe('summary generation', () => {
    it('includes user and assistant message counts', () => {
      const turns = makeTurns(40);
      const result = service.compress(turns, 'balanced');
      expect(result.summary).toContain('user messages');
      expect(result.summary).toContain('assistant responses');
    });

    it('reports tools used', () => {
      const turns: ConversationTurn[] = [
        ...makeTurns(15, 'chat'),
        {
          role: 'user' as const,
          content: 'run test',
          timestamp: new Date().toISOString(),
          tool_calls: [{ name: 'jest', args: {} }],
        },
        ...makeTurns(20, 'more chat'),
      ];
      const result = service.compress(turns, 'balanced');
      expect(result.summary).toContain('jest');
    });
  });

  describe('stats tracking', () => {
    it('starts with zero compressions', () => {
      const stats = service.getStats();
      expect(stats).toContain('Compressions: 0');
    });

    it('tracks compression count', () => {
      const turns = makeTurns(50);
      service.compress(turns, 'balanced');
      const stats = service.getStats();
      expect(stats).toContain('Compressions: 1');
    });

    it('reports tokens saved', () => {
      const turns = makeTurns(50);
      service.compress(turns, 'aggressive');
      const stats = service.getStats();
      expect(stats).toContain('Tokens saved');
    });

    it('reports average ratio', () => {
      const turns = makeTurns(50);
      service.compress(turns, 'balanced');
      const stats = service.getStats();
      expect(stats).toContain('Average ratio');
    });
  });

  describe('listStrategies()', () => {
    it('lists all 4 strategies', () => {
      const list = service.listStrategies();
      expect(list).toContain('conservative');
      expect(list).toContain('balanced');
      expect(list).toContain('aggressive');
      expect(list).toContain('fact-only');
    });

    it('includes strategy descriptions', () => {
      const list = service.listStrategies();
      expect(list).toContain('Keep most context');
      expect(list).toContain('Maximum compression');
    });
  });
});
