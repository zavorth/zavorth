import { ContextAwareInjector } from '../../src/cognitive-firewall/ContextAwareInjector';
import type { ToolDefinition } from '../../src/providers/ILlmProvider';
import type { IntentClassification } from '../../src/cognitive-firewall/IntentClassifier';

function buildTool(name: string): ToolDefinition {
  return {
    name,
    description: `Tool: ${name}`,
    parameters: { type: 'object', properties: {} },
  };
}

function buildClassification(category: string): IntentClassification {
  return {
    category: category as IntentClassification['category'],
    confidence: 0.8,
    reason: 'test',
    isTrivialChat: false,
    isHardDecision: false,
    downgradedBy: [],
    secondPass: {
      source: 'ContextualIntentSecondPass',
      stage: 7,
      mode: 'local-contextual',
      verdict: 'confirmed',
      originalCategory: category as IntentClassification['category'],
      finalCategory: category as IntentClassification['category'],
      confidenceDelta: 0,
      signals: [],
    },
  };
}

describe('ContextAwareInjector', () => {
  let injector: ContextAwareInjector;

  beforeEach(() => {
    injector = new ContextAwareInjector({ sessionTtlMs: 10000 });
  });

  describe('getInitialTools', () => {
    it('returns minimal tool set for file_operation intent', () => {
      const tools = injector.getInitialTools(buildClassification('file_operation'));

      expect(tools).toContain('read_file');
      expect(tools.length).toBeLessThanOrEqual(2);
    });

    it('returns empty set for conversation intent', () => {
      const tools = injector.getInitialTools(buildClassification('conversation'));

      expect(tools).toEqual([]);
    });

    it('returns web_search for information intent', () => {
      const tools = injector.getInitialTools(buildClassification('information'));

      expect(tools).toContain('web_search');
    });

    it('returns fallback for unknown intent', () => {
      const tools = injector.getInitialTools(buildClassification('unknown_intent'));

      expect(tools).toContain('read_file');
      expect(tools).toContain('web_search');
    });
  });

  describe('handleRequest', () => {
    it('injects a tool found in the registry', () => {
      const allTools = [buildTool('read_file'), buildTool('web_search')];

      const result = injector.handleRequest('session1', 'read_file', allTools);

      expect(result.tool).not.toBeNull();
      expect(result.tool?.name).toBe('read_file');
      expect(result.escalated).toBe(false);
    });

    it('returns null for tool not in registry', () => {
      const allTools = [buildTool('read_file')];

      const result = injector.handleRequest('session1', 'unknown_tool', allTools);

      expect(result.tool).toBeNull();
      expect(result.escalated).toBe(false);
    });

    it('increments failure count for missing tools', () => {
      const allTools = [buildTool('read_file')];

      injector.handleRequest('session1', 'unknown1', allTools);
      const result = injector.handleRequest('session1', 'unknown2', allTools);

      expect(result.state.failureCount).toBe(2);
    });

    it('escalates after repeated failures', () => {
      const allTools = [buildTool('read_file')];

      // Fail twice (threshold is 2)
      injector.handleRequest('session1', 'unknown1', allTools);
      const result = injector.handleRequest('session1', 'unknown2', allTools);

      expect(result.escalated).toBe(true);
      expect(injector.isEscalated('session1')).toBe(true);
    });

    it('resets failure count on successful injection', () => {
      const allTools = [buildTool('read_file'), buildTool('web_search')];

      injector.handleRequest('session1', 'unknown1', allTools); // fail 1
      injector.handleRequest('session1', 'read_file', allTools); // success, reset
      const result = injector.handleRequest('session1', 'unknown2', allTools); // fail 1 again

      expect(result.state.failureCount).toBe(1);
      expect(result.escalated).toBe(false);
    });

    it('returns any tool once escalated', () => {
      const allTools = [buildTool('read_file'), buildTool('web_search'), buildTool('create_file')];

      // Escalate
      injector.handleRequest('session1', 'unknown1', allTools);
      injector.handleRequest('session1', 'unknown2', allTools);

      // Now any tool should be available
      const result = injector.handleRequest('session1', 'create_file', allTools);

      expect(result.tool).not.toBeNull();
      expect(result.tool?.name).toBe('create_file');
      expect(result.escalated).toBe(true);
    });
  });

  describe('startNewTurn', () => {
    it('resets turn-specific state', () => {
      const allTools = [buildTool('read_file')];

      // Escalate
      injector.handleRequest('session1', 'unknown1', allTools);
      injector.handleRequest('session1', 'unknown2', allTools);
      expect(injector.isEscalated('session1')).toBe(true);

      // Start new turn
      injector.startNewTurn('session1');

      expect(injector.isEscalated('session1')).toBe(false);
      expect(injector.getInjectedTools('session1')).toEqual([]);
    });
  });

  describe('getInjectedTools', () => {
    it('tracks injected tools', () => {
      const allTools = [buildTool('read_file'), buildTool('web_search')];

      injector.handleRequest('session1', 'read_file', allTools);
      injector.handleRequest('session1', 'web_search', allTools);

      const injected = injector.getInjectedTools('session1');

      expect(injected).toContain('read_file');
      expect(injected).toContain('web_search');
    });

    it('returns empty for unknown session', () => {
      expect(injector.getInjectedTools('unknown')).toEqual([]);
    });
  });

  describe('session management', () => {
    it('clears a specific session', () => {
      const allTools = [buildTool('read_file')];
      injector.handleRequest('session1', 'read_file', allTools);

      injector.clearSession('session1');

      expect(injector.getSessionState('session1')).toBeNull();
    });

    it('clears all sessions', () => {
      const allTools = [buildTool('read_file')];
      injector.handleRequest('session1', 'read_file', allTools);
      injector.handleRequest('session2', 'read_file', allTools);

      injector.clearAll();

      expect(injector.getActiveSessionCount()).toBe(0);
    });

    it('tracks active session count', () => {
      const allTools = [buildTool('read_file')];
      injector.handleRequest('session1', 'read_file', allTools);
      injector.handleRequest('session2', 'read_file', allTools);

      expect(injector.getActiveSessionCount()).toBe(2);
    });
  });

  describe('session TTL', () => {
    it('evicts stale sessions', async () => {
      const shortTtlInjector = new ContextAwareInjector({ sessionTtlMs: 100 });
      const allTools = [buildTool('read_file')];

      shortTtlInjector.handleRequest('session1', 'read_file', allTools);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(shortTtlInjector.getActiveSessionCount()).toBe(0);
    });
  });

  describe('getSessionState', () => {
    it('returns state for active session', () => {
      const allTools = [buildTool('read_file')];
      injector.handleRequest('session1', 'read_file', allTools);

      const state = injector.getSessionState('session1');

      expect(state).not.toBeNull();
      expect(state?.injectedTools.has('read_file')).toBe(true);
    });

    it('returns null for unknown session', () => {
      expect(injector.getSessionState('unknown')).toBeNull();
    });
  });
});
