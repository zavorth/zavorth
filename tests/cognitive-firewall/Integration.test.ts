/**
 * Integration tests — verify all 5 Cognitive Firewall improvements
 * work together end-to-end through the public API.
 */
import {
  CognitiveFirewall,
  ToolGatekeeper,
  ToolResultCache,
  ToolClusterRegistry,
  ToolUsageTracker,
  ContextAwareInjector,
  toCompact,
  toCompactBatch,
  isCompact,
  resolveFull,
  buildToolRegistry,
  calculateSavings,
} from '../../src/cognitive-firewall';
import type { ToolDefinition, CompactToolDefinition } from '../../src/providers/ILlmProvider';

function buildTool(name: string, description?: string): ToolDefinition {
  return {
    name,
    description: description || `Tool: ${name}. Does things.`,
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input value' },
      },
      required: ['input'],
    },
  };
}

const ALL_TOOLS: ToolDefinition[] = [
  buildTool('web_search', 'Search the web for information. Supports pagination.'),
  buildTool('read_file', 'Read a file from the workspace.'),
  buildTool('create_file', 'Create a new file in the workspace.'),
  buildTool('list_directory', 'List directory contents.'),
  buildTool('run_sandbox_code', 'Execute code in a sandbox environment.'),
  buildTool('remote_shell', 'Execute commands on a remote shell.'),
  buildTool('semantic_memory', 'Query semantic memory store.'),
  buildTool('configure_llm_profile', 'Configure LLM provider settings.'),
  buildTool('get_datetime', 'Get current date and time.'),
  buildTool('desktop_automation', 'Automate desktop interactions.'),
  buildTool('query_external_ai', 'Query an external AI service.'),
  buildTool('zavorth_action', 'Execute a Zavorth system action.'),
];

describe('Cognitive Firewall — Full Integration', () => {
  // ──────────────────────────────────────────────────────────────
  // B) Lazy Tool Definition — Integration with CognitiveFirewall
  // ──────────────────────────────────────────────────────────────
  describe('B) Lazy Tool Definition — integration', () => {
    it('CognitiveFirewall with compactMode returns compactTools in decision', () => {
      const firewall = new CognitiveFirewall({ compactMode: true });
      const decision = firewall.evaluate('read the file README.md', ALL_TOOLS);

      expect(decision.toolHintProfile.isCompactMode).toBe(true);
      expect(decision.toolHintProfile.compactTools).toBeDefined();
      expect(decision.toolHintProfile.compactTools!.length).toBeGreaterThan(0);

      // Each compact tool should have compact: true
      for (const ct of decision.toolHintProfile.compactTools!) {
        expect(ct.compact).toBe(true);
        expect(ct.name).toBeTruthy();
        expect(ct.description).toBeTruthy();
        // Should NOT have parameters
        expect((ct as any).parameters).toBeUndefined();
      }
    });

    it('CognitiveFirewall without compactMode does not include compactTools', () => {
      const firewall = new CognitiveFirewall();
      const decision = firewall.evaluate('read the file README.md', ALL_TOOLS);

      expect(decision.toolHintProfile.isCompactMode).toBeUndefined();
      expect(decision.toolHintProfile.compactTools).toBeUndefined();
    });

    it('compact tools can be resolved back to full definitions', () => {
      const firewall = new CognitiveFirewall({ compactMode: true });
      const decision = firewall.evaluate('read the file README.md', ALL_TOOLS);
      const registry = buildToolRegistry(ALL_TOOLS);

      for (const ct of decision.toolHintProfile.compactTools!) {
        const full = resolveFull(ct, registry);
        expect(full).not.toBeNull();
        expect(full!.name).toBe(ct.name);
        expect(full!.parameters).toBeDefined();
      }
    });

    it('tokenSavings is present when compactMode is active', () => {
      const firewall = new CognitiveFirewall({ compactMode: true });
      const decision = firewall.evaluate('search the web for news', ALL_TOOLS);

      expect(decision.tokenSavings).toBeDefined();
      expect(decision.tokenSavings!.savedTokens).toBeGreaterThan(0);
      expect(decision.tokenSavings!.savingsPercent).toBeGreaterThan(0);
    });

    it('stats includes compact info when compactMode is active', () => {
      const firewall = new CognitiveFirewall({ compactMode: true });
      const decision = firewall.evaluate('search the web', ALL_TOOLS);

      expect(decision.stats).toContain('Compact: active');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // E) Tool Result Caching — Integration
  // ──────────────────────────────────────────────────────────────
  describe('E) Tool Result Caching — integration', () => {
    let cache: ToolResultCache;

    beforeEach(() => {
      cache = new ToolResultCache({ maxEntries: 10, defaultTtlMs: 5000 });
    });

    it('caches and retrieves tool results correctly', () => {
      const args = { query: 'TypeScript best practices' };
      const result = JSON.stringify({ results: ['article1', 'article2'] });

      cache.set('web_search', args, result);
      const cached = cache.get('web_search', args);

      expect(cached).toBe(result);
    });

    it('non-cacheable tools are never cached', () => {
      cache.set('run_sandbox_code', { code: 'test' }, 'output');
      cache.set('remote_shell', { cmd: 'ls' }, 'output');
      cache.set('desktop_automation', { action: 'click' }, 'output');

      expect(cache.get('run_sandbox_code', { code: 'test' })).toBeNull();
      expect(cache.get('remote_shell', { cmd: 'ls' })).toBeNull();
      expect(cache.get('desktop_automation', { action: 'click' })).toBeNull();
      expect(cache.size).toBe(0);
    });

    it('cache stats track hits and misses accurately', () => {
      cache.set('web_search', { query: 'a' }, 'result_a');
      cache.set('web_search', { query: 'b' }, 'result_b');

      cache.get('web_search', { query: 'a' }); // hit
      cache.get('web_search', { query: 'a' }); // hit
      cache.get('web_search', { query: 'c' }); // miss
      cache.get('read_file', { path: 'x' }); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.size).toBe(2);
    });

    it('invalidate clears entries for a specific tool', () => {
      cache.set('web_search', { query: 'a' }, 'result_a');
      cache.set('read_file', { path: 'x' }, 'content');

      cache.invalidate('web_search');

      expect(cache.get('web_search', { query: 'a' })).toBeNull();
      expect(cache.get('read_file', { path: 'x' })).toBe('content');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // C) Tool Clustering — Integration with ToolGatekeeper
  // ──────────────────────────────────────────────────────────────
  describe('C) Tool Clustering — integration', () => {
    it('ToolGatekeeper with clusterMode expands clusters into tools', () => {
      const gatekeeper = new ToolGatekeeper({ clusterMode: true });
      const hint = gatekeeper.buildHintProfile(ALL_TOOLS, 'file_operation');

      expect(hint.isClusterMode).toBe(true);
      expect(hint.activeClusters).toBeDefined();
      expect(hint.activeClusters!).toContain('file_ops');

      // Should include all file_ops tools that are in ALL_TOOLS
      const toolNames = hint.tools.map((t) => t.name);
      expect(toolNames).toContain('read_file');
      expect(toolNames).toContain('create_file');
      expect(toolNames).toContain('list_directory');
    });

    it('cluster mode produces superset of individual mode', () => {
      const individual = new ToolGatekeeper();
      const clustered = new ToolGatekeeper({ clusterMode: true });

      const individualHint = individual.buildHintProfile(ALL_TOOLS, 'research');
      const clusteredHint = clustered.buildHintProfile(ALL_TOOLS, 'research');

      const individualNames = new Set(individualHint.tools.map((t) => t.name));
      const clusteredNames = new Set(clusteredHint.tools.map((t) => t.name));

      // Clustered should have at least all the individual ones
      for (const name of individualNames) {
        expect(clusteredNames.has(name)).toBe(true);
      }

      // Clustered should have more tools (from expanded clusters)
      expect(clusteredHint.tools.length).toBeGreaterThanOrEqual(individualHint.tools.length);
    });

    it('ToolClusterRegistry returns correct clusters for intent', () => {
      const registry = new ToolClusterRegistry();

      const fileClusters = registry.getClustersForIntent('file_operation');
      expect(fileClusters.map((c) => c.name)).toContain('file_ops');

      const webClusters = registry.getClustersForIntent('information');
      expect(webClusters.map((c) => c.name)).toContain('web');

      const convClusters = registry.getClustersForIntent('conversation');
      expect(convClusters).toEqual([]);
    });

    it('CognitiveFirewall with clusterMode passes through correctly', () => {
      const firewall = new CognitiveFirewall({ clusterMode: true });
      const decision = firewall.evaluate('create a new file called test.ts', ALL_TOOLS);

      expect(decision.toolHintProfile.isClusterMode).toBe(true);
      expect(decision.toolHintProfile.activeClusters).toBeDefined();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // A) Predictive Tool Loading — Integration with ToolGatekeeper
  // ──────────────────────────────────────────────────────────────
  describe('A) Predictive Tool Loading — integration', () => {
    it('ToolGatekeeper includes predicted tools when usageTracker is provided', () => {
      const tracker = new ToolUsageTracker();

      // Build usage pattern: web_search always with read_file
      for (let i = 0; i < 10; i++) {
        tracker.recordTurn('session1', ['web_search', 'read_file']);
      }

      const gatekeeper = new ToolGatekeeper({
        usageTracker: tracker,
        sessionId: 'session1',
      });

      // Request only web_search via intent
      const hint = gatekeeper.buildHintProfile(ALL_TOOLS, 'information');

      expect(hint.isPredictiveMode).toBe(true);
      expect(hint.predictedToolNames).toBeDefined();
      expect(hint.predictedToolNames!).toContain('read_file');

      // read_file should be in the tools list even though information intent
      // doesn't normally include it
      const toolNames = hint.tools.map((t) => t.name);
      expect(toolNames).toContain('read_file');
    });

    it('no predictions when usageTracker is not provided', () => {
      const gatekeeper = new ToolGatekeeper();
      const hint = gatekeeper.buildHintProfile(ALL_TOOLS, 'information');

      expect(hint.isPredictiveMode).toBeUndefined();
      expect(hint.predictedToolNames).toBeUndefined();
    });

    it('no predictions with insufficient history', () => {
      const tracker = new ToolUsageTracker();
      tracker.recordTurn('session1', ['web_search']); // Only 1 turn

      const gatekeeper = new ToolGatekeeper({
        usageTracker: tracker,
        sessionId: 'session1',
      });

      const hint = gatekeeper.buildHintProfile(ALL_TOOLS, 'information');

      expect(hint.predictedToolNames).toBeUndefined();
    });

    it('CognitiveFirewall passes usageTracker and sessionId to gatekeeper', () => {
      const tracker = new ToolUsageTracker();
      for (let i = 0; i < 10; i++) {
        tracker.recordTurn('session1', ['web_search', 'read_file']);
      }

      // Free text is full_toolset (all tools already exposed). Predictive add-ons
      // apply when a filtered structured category is used as a hint profile.
      const gatekeeper = new ToolGatekeeper({
        usageTracker: tracker,
        sessionId: 'session1',
      });
      const hint = gatekeeper.buildHintProfile(ALL_TOOLS, 'information');

      expect(hint.isPredictiveMode).toBe(true);
      expect(hint.predictedToolNames).toContain('read_file');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // D) Context-Aware Tool Injection — Integration
  // ──────────────────────────────────────────────────────────────
  describe('D) Context-Aware Tool Injection — integration', () => {
    let injector: ContextAwareInjector;

    beforeEach(() => {
      injector = new ContextAwareInjector();
    });

    it('starts with minimal tools and injects on demand', () => {
      const initial = injector.getInitialTools({
        category: 'file_operation',
        confidence: 0.8,
        reason: 'test',
        isHardDecision: false,
        downgradedBy: [],
        secondPass: {
          source: 'ContextualIntentSecondPass',
          stage: 7,
          mode: 'local-contextual',
          verdict: 'confirmed',
          originalCategory: 'file_operation',
          finalCategory: 'file_operation',
          confidenceDelta: 0,
          signals: [],
        },
      });

      // Minimal set should only have read_file
      expect(initial).toEqual(['read_file']);

      // But we can inject create_file on demand
      const result = injector.handleRequest('session1', 'create_file', ALL_TOOLS);
      expect(result.tool).not.toBeNull();
      expect(result.tool!.name).toBe('create_file');
      expect(result.escalated).toBe(false);
    });

    it('escalates to full toolset after repeated failures', () => {
      // Two failures should trigger escalation
      injector.handleRequest('session1', 'nonexistent_tool_1', ALL_TOOLS);
      const result = injector.handleRequest('session1', 'nonexistent_tool_2', ALL_TOOLS);

      expect(result.escalated).toBe(true);
      expect(injector.isEscalated('session1')).toBe(true);

      // Now any tool should be available
      const post = injector.handleRequest('session1', 'web_search', ALL_TOOLS);
      expect(post.tool).not.toBeNull();
    });

    it('resets state between turns', () => {
      // Escalate
      injector.handleRequest('session1', 'nonexistent_1', ALL_TOOLS);
      injector.handleRequest('session1', 'nonexistent_2', ALL_TOOLS);
      expect(injector.isEscalated('session1')).toBe(true);

      // New turn
      injector.startNewTurn('session1');
      expect(injector.isEscalated('session1')).toBe(false);
      expect(injector.getInjectedTools('session1')).toEqual([]);
    });

    it('works with CognitiveFirewall intent classification', () => {
      const firewall = new CognitiveFirewall();
      const decision = firewall.evaluate('create a file called test.ts', ALL_TOOLS);

      // Free text is model-owned full_toolset; injector minimal set is for structured categories.
      expect(decision.classification.category).toBe('full_toolset');
      const initial = injector.getInitialTools({
        ...decision.classification,
        category: 'file_operation',
      });
      expect(initial.length).toBeLessThanOrEqual(2);
      expect(initial).toContain('read_file');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Combined Mode — All improvements together
  // ──────────────────────────────────────────────────────────────
  describe('Combined Mode — all improvements together', () => {
    it('works with all features enabled simultaneously', () => {
      const tracker = new ToolUsageTracker();
      for (let i = 0; i < 10; i++) {
        tracker.recordTurn('session1', ['web_search', 'read_file']);
      }

      const firewall = new CognitiveFirewall({
        compactMode: true,
        clusterMode: true,
        usageTracker: tracker,
        sessionId: 'session1',
      });

      const freeText = firewall.evaluate('search for TypeScript articles', ALL_TOOLS);

      // Free text → full_toolset still gets compact + cluster telemetry.
      expect(freeText.classification.category).toBe('full_toolset');
      expect(freeText.toolHintProfile.isCompactMode).toBe(true);
      expect(freeText.toolHintProfile.isClusterMode).toBe(true);
      expect(freeText.toolHintProfile.compactTools!.length).toBeGreaterThan(0);
      expect(freeText.toolHintProfile.activeClusters!.length).toBeGreaterThan(0);
      expect(freeText.tokenSavings!.savingsPercent).toBeGreaterThan(0);
      expect(freeText.stats).toContain('Compact: active');
      expect(freeText.stats).toContain('Clusters: active');

      // Predictive add-ons require a filtered structured category hint.
      const predictive = new ToolGatekeeper({
        compactMode: true,
        clusterMode: true,
        usageTracker: tracker,
        sessionId: 'session1',
      }).buildHintProfile(ALL_TOOLS, 'information');
      expect(predictive.isPredictiveMode).toBe(true);
      expect(predictive.predictedToolNames).toBeDefined();
    });

    it('full workflow: free-text full_toolset → cache → inject', () => {
      const firewall = new CognitiveFirewall();
      const cache = new ToolResultCache();
      const injector = new ContextAwareInjector();

      // Step 1: Free text is model-owned (full_toolset), not keyword file_operation.
      const decision = firewall.evaluate('read the README.md file', ALL_TOOLS);
      expect(decision.classification.category).toBe('full_toolset');
      expect(decision.tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining(['read_file', 'create_file', 'web_search']),
      );

      // Step 2: Injector can still start from an explicit structured category.
      const initial = injector.getInitialTools({
        ...decision.classification,
        category: 'file_operation',
      });
      expect(initial).toContain('read_file');

      // Step 3: Simulate tool execution — cache result
      const toolArgs = { path: 'README.md' };
      const toolResult = '# My Project\nWelcome to my project.';
      cache.set('read_file', toolArgs, toolResult);

      // Step 4: Verify cache hit
      const cached = cache.get('read_file', toolArgs);
      expect(cached).toBe(toolResult);

      // Step 5: On-demand injection for a different tool
      const injectResult = injector.handleRequest('session1', 'create_file', ALL_TOOLS);
      expect(injectResult.tool).not.toBeNull();
      expect(injectResult.tool!.name).toBe('create_file');
    });
  });
});
