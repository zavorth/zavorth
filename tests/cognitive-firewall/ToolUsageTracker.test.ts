import { ToolUsageTracker } from '../../src/cognitive-firewall/ToolUsageTracker';

describe('ToolUsageTracker', () => {
  let tracker: ToolUsageTracker;

  beforeEach(() => {
    tracker = new ToolUsageTracker({ sessionTtlMs: 10000 });
  });

  describe('recordTurn', () => {
    it('records tool usage for a session', () => {
      tracker.recordTurn('session1', ['web_search', 'read_file']);

      expect(tracker.getSessionTurnCount('session1')).toBe(1);
    });

    it('accumulates turns for the same session', () => {
      tracker.recordTurn('session1', ['web_search']);
      tracker.recordTurn('session1', ['read_file']);
      tracker.recordTurn('session1', ['web_search']);

      expect(tracker.getSessionTurnCount('session1')).toBe(3);
    });

    it('keeps separate sessions independent', () => {
      tracker.recordTurn('session1', ['web_search']);
      tracker.recordTurn('session2', ['read_file']);

      expect(tracker.getSessionTurnCount('session1')).toBe(1);
      expect(tracker.getSessionTurnCount('session2')).toBe(1);
    });

    it('enforces sliding window limit', () => {
      // Record more than MAX_TURNS (100)
      for (let i = 0; i < 110; i++) {
        tracker.recordTurn('session1', ['web_search']);
      }

      expect(tracker.getSessionTurnCount('session1')).toBe(100);
    });
  });

  describe('predictNextTools', () => {
    it('returns empty when insufficient history', () => {
      tracker.recordTurn('session1', ['web_search', 'read_file']);

      const result = tracker.predictNextTools('session1', ['web_search']);

      expect(result.predictedTools).toEqual([]);
    });

    it('predicts co-occurring tools', () => {
      // Build pattern: web_search is always followed by read_file
      for (let i = 0; i < 10; i++) {
        tracker.recordTurn('session1', ['web_search', 'read_file']);
      }

      const result = tracker.predictNextTools('session1', ['web_search']);

      expect(result.predictedTools).toContain('read_file');
    });

    it('does not predict tools already in current set', () => {
      for (let i = 0; i < 10; i++) {
        tracker.recordTurn('session1', ['web_search', 'read_file']);
      }

      const result = tracker.predictNextTools('session1', ['web_search', 'read_file']);

      expect(result.predictedTools).not.toContain('read_file');
      expect(result.predictedTools).not.toContain('web_search');
    });

    it('caps predictions at 5', () => {
      // Record a session with many co-occurring tools
      for (let i = 0; i < 10; i++) {
        tracker.recordTurn('session1', [
          'web_search',
          'tool_a',
          'tool_b',
          'tool_c',
          'tool_d',
          'tool_e',
          'tool_f',
        ]);
      }

      const result = tracker.predictNextTools('session1', ['web_search']);

      expect(result.predictedTools.length).toBeLessThanOrEqual(5);
    });

    it('returns confidence scores between 0 and 1', () => {
      for (let i = 0; i < 10; i++) {
        tracker.recordTurn('session1', ['web_search', 'read_file']);
      }

      const result = tracker.predictNextTools('session1', ['web_search']);

      for (const [, score] of result.confidenceScores) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });

    it('returns empty for unknown session', () => {
      const result = tracker.predictNextTools('unknown', ['web_search']);

      expect(result.predictedTools).toEqual([]);
    });

    it('sorts predictions by confidence (highest first)', () => {
      // tool_a co-occurs 100%, tool_b co-occurs 50%
      for (let i = 0; i < 10; i++) {
        tracker.recordTurn('session1', ['web_search', 'tool_a']);
      }
      for (let i = 0; i < 5; i++) {
        tracker.recordTurn('session1', ['web_search', 'tool_b']);
      }

      const result = tracker.predictNextTools('session1', ['web_search']);

      if (result.predictedTools.length >= 2) {
        const indexA = result.predictedTools.indexOf('tool_a');
        const indexB = result.predictedTools.indexOf('tool_b');
        expect(indexA).toBeLessThan(indexB);
      }
    });
  });

  describe('session management', () => {
    it('clears a specific session', () => {
      tracker.recordTurn('session1', ['web_search']);
      tracker.clearSession('session1');

      expect(tracker.getSessionTurnCount('session1')).toBe(0);
    });

    it('clears all sessions', () => {
      tracker.recordTurn('session1', ['web_search']);
      tracker.recordTurn('session2', ['read_file']);
      tracker.clearAll();

      expect(tracker.getActiveSessionCount()).toBe(0);
    });

    it('tracks active session count', () => {
      tracker.recordTurn('session1', ['web_search']);
      tracker.recordTurn('session2', ['read_file']);
      tracker.recordTurn('session3', ['web_search']);

      expect(tracker.getActiveSessionCount()).toBe(3);
    });
  });

  describe('session TTL', () => {
    it('evicts stale sessions', async () => {
      const shortTtlTracker = new ToolUsageTracker({ sessionTtlMs: 100 });
      shortTtlTracker.recordTurn('session1', ['web_search']);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(shortTtlTracker.getActiveSessionCount()).toBe(0);
    });

    it('keeps active sessions alive', () => {
      tracker.recordTurn('session1', ['web_search']);

      expect(tracker.getActiveSessionCount()).toBe(1);
    });
  });

  describe('co-occurrence patterns', () => {
    it('handles multiple co-occurring tools in predictions', () => {
      // Pattern: web_search + read_file + create_file always together
      for (let i = 0; i < 10; i++) {
        tracker.recordTurn('session1', ['web_search', 'read_file', 'create_file']);
      }

      const result = tracker.predictNextTools('session1', ['web_search']);

      expect(result.predictedTools).toContain('read_file');
      expect(result.predictedTools).toContain('create_file');
    });

    it('handles partial co-occurrence patterns', () => {
      // web_search appears with read_file 80% of the time
      for (let i = 0; i < 8; i++) {
        tracker.recordTurn('session1', ['web_search', 'read_file']);
      }
      for (let i = 0; i < 2; i++) {
        tracker.recordTurn('session1', ['web_search']);
      }

      const result = tracker.predictNextTools('session1', ['web_search']);

      expect(result.predictedTools).toContain('read_file');
      const score = result.confidenceScores.get('read_file');
      expect(score).toBeGreaterThanOrEqual(0.3);
    });
  });
});
