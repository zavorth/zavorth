/**
 * E2E smoke test for Cognitive Firewall improvements.
 * Validates all 5 improvements work together through the public API.
 * Run with: npx tsx scripts/cognitive-firewall-e2e-test.ts
 */

import {
  CognitiveFirewall,
  ToolUsageTracker,
  ToolResultCache,
  ToolClusterRegistry,
  ContextAwareInjector,
  toCompact,
  resolveFull,
  buildToolRegistry,
} from '../src/cognitive-firewall';
import type { ToolDefinition } from '../src/providers/ILlmProvider';

// ── Mock tool registry ──────────────────────────────────────────
const ALL_TOOLS: ToolDefinition[] = [
  {
    name: 'web_search',
    description: 'Search the web for information. Returns relevant results.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search query' } },
      required: ['query'],
    },
  },
  {
    name: 'read_file',
    description: 'Read a file from the workspace. Returns file contents.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'File path' } },
      required: ['path'],
    },
  },
  {
    name: 'create_file',
    description: 'Create a new file in the workspace.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'File content' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_directory',
    description: 'List directory contents.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Directory path' } },
      required: ['path'],
    },
  },
  {
    name: 'run_sandbox_code',
    description: 'Execute code in a sandbox environment.',
    parameters: {
      type: 'object',
      properties: { code: { type: 'string', description: 'Code to execute' } },
      required: ['code'],
    },
  },
  {
    name: 'remote_shell',
    description: 'Execute commands on a remote shell.',
    parameters: {
      type: 'object',
      properties: { command: { type: 'string', description: 'Shell command' } },
      required: ['command'],
    },
  },
  {
    name: 'semantic_memory',
    description: 'Query semantic memory store.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Memory query' } },
      required: ['query'],
    },
  },
  {
    name: 'configure_llm_profile',
    description: 'Configure LLM provider settings.',
    parameters: {
      type: 'object',
      properties: { provider: { type: 'string', description: 'Provider name' } },
      required: ['provider'],
    },
  },
  { name: 'get_datetime', description: 'Get current date and time.', parameters: { type: 'object', properties: {} } },
  {
    name: 'desktop_automation',
    description: 'Automate desktop interactions.',
    parameters: {
      type: 'object',
      properties: { action: { type: 'string', description: 'Desktop action' } },
      required: ['action'],
    },
  },
  {
    name: 'query_external_ai',
    description: 'Query an external AI service.',
    parameters: {
      type: 'object',
      properties: { prompt: { type: 'string', description: 'Prompt to send' } },
      required: ['prompt'],
    },
  },
  {
    name: 'zavorth_action',
    description: 'Execute a Zavorth system action.',
    parameters: {
      type: 'object',
      properties: { action: { type: 'string', description: 'Action name' } },
      required: ['action'],
    },
  },
];

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    failed++;
  }
}

// ── Test A: Predictive Tool Loading ─────────────────────────────
console.log('\n═══ A) Predictive Tool Loading ═══');

const tracker = new ToolUsageTracker();
for (let i = 0; i < 10; i++) {
  tracker.recordTurn('session-e2e', ['web_search', 'read_file']);
}

const predictiveFirewall = new CognitiveFirewall({
  compactMode: true,
  clusterMode: true,
  usageTracker: tracker,
  sessionId: 'session-e2e',
});

const predDecision = predictiveFirewall.evaluate('search for TypeScript articles', ALL_TOOLS);

assert(predDecision.toolHintProfile.isPredictiveMode === true, 'Predictive mode is active');
assert(predDecision.toolHintProfile.predictedToolNames !== undefined, 'Predicted tools exist');
assert(predDecision.toolHintProfile.predictedToolNames!.includes('read_file'), 'read_file predicted');
assert(
  predDecision.toolHintProfile.tools.some((t) => t.name === 'read_file'),
  'read_file in tool set (predicted)',
);

// ── Test B: Lazy Tool Definition ────────────────────────────────
console.log('\n═══ B) Lazy Tool Definition ═══');

const compactFirewall = new CognitiveFirewall({ compactMode: true });
const compactDecision = compactFirewall.evaluate('read the README.md file', ALL_TOOLS);

assert(compactDecision.toolHintProfile.isCompactMode === true, 'Compact mode is active');
assert(compactDecision.toolHintProfile.compactTools !== undefined, 'Compact tools exist');
assert(compactDecision.toolHintProfile.compactTools!.length > 0, 'Compact tools are non-empty');

for (const ct of compactDecision.toolHintProfile.compactTools!) {
  assert(ct.compact === true, `  ${ct.name} has compact=true`);
  assert(ct.description.length <= 100, `  ${ct.name} description is short (${ct.description.length} chars)`);
}

assert(compactDecision.tokenSavings !== undefined, 'Token savings calculated');
assert(compactDecision.tokenSavings!.savedTokens > 0, `Saved ${compactDecision.tokenSavings!.savedTokens} tokens`);
assert(compactDecision.tokenSavings!.savingsPercent > 0, `${compactDecision.tokenSavings!.savingsPercent}% savings`);

const registry = buildToolRegistry(ALL_TOOLS);
for (const ct of compactDecision.toolHintProfile.compactTools!) {
  const full = resolveFull(ct, registry);
  assert(full !== null, `  ${ct.name} resolves back to full definition`);
  assert(full!.parameters !== undefined, `  ${ct.name} has parameters after resolve`);
}

// ── Test C: Tool Clustering ─────────────────────────────────────
console.log('\n═══ C) Tool Clustering ═══');

const clusterFirewall = new CognitiveFirewall({ clusterMode: true });
const clusterDecision = clusterFirewall.evaluate('create a new file called test.ts', ALL_TOOLS);

assert(clusterDecision.toolHintProfile.isClusterMode === true, 'Cluster mode is active');
assert(clusterDecision.toolHintProfile.activeClusters !== undefined, 'Active clusters exist');
assert(clusterDecision.toolHintProfile.activeClusters!.includes('file_ops'), 'file_ops cluster active');

const clusterTools = clusterDecision.toolHintProfile.tools.map((t) => t.name);
assert(clusterTools.includes('read_file'), 'read_file in cluster tools');
assert(clusterTools.includes('create_file'), 'create_file in cluster tools');
assert(clusterTools.includes('list_directory'), 'list_directory in cluster tools');

// ── Test E: Tool Result Caching ─────────────────────────────────
console.log('\n═══ E) Tool Result Caching ═══');

const cache = new ToolResultCache({ maxEntries: 100, defaultTtlMs: 60000 });

// Cache miss
assert(cache.get('web_search', { query: 'test' }) === null, 'Cache miss on empty cache');

// Cache set + hit
const mockResult = JSON.stringify({ results: ['article1', 'article2'] });
cache.set('web_search', { query: 'TypeScript best practices' }, mockResult);
const cached = cache.get('web_search', { query: 'TypeScript best practices' });
assert(cached === mockResult, 'Cache hit returns correct result');

// Non-cacheable tools
cache.set('run_sandbox_code', { code: 'test' }, 'output');
assert(cache.get('run_sandbox_code', { code: 'test' }) === null, 'Non-cacheable tool not cached');

// Cache stats
const stats = cache.getStats();
assert(stats.hits >= 1, `Cache has ${stats.hits} hits`);
assert(stats.size >= 1, `Cache has ${stats.size} entries`);

// ── Test D: Context-Aware Injection ─────────────────────────────
console.log('\n═══ D) Context-Aware Tool Injection ═══');

const injector = new ContextAwareInjector();

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

assert(initial.length <= 2, `Initial tools are minimal (${initial.length})`);
assert(initial.includes('read_file'), 'read_file in initial set');

// On-demand injection
const injected = injector.handleRequest('session-e2e', 'create_file', ALL_TOOLS);
assert(injected.tool !== null, 'create_file injected on demand');
assert(injected.tool!.name === 'create_file', 'Correct tool injected');
assert(injected.escalated === false, 'Not escalated after successful injection');

// Escalation after failures
const inj2 = new ContextAwareInjector();
inj2.handleRequest('s1', 'nonexistent1', ALL_TOOLS);
const escResult = inj2.handleRequest('s1', 'nonexistent2', ALL_TOOLS);
assert(escResult.escalated === true, 'Escalated after 2 failures');

// ── Combined Mode ───────────────────────────────────────────────
console.log('\n═══ Combined Mode ═══');

const allTracker = new ToolUsageTracker();
for (let i = 0; i < 10; i++) {
  allTracker.recordTurn('session-all', ['web_search', 'read_file']);
}

const allFirewall = new CognitiveFirewall({
  compactMode: true,
  clusterMode: true,
  usageTracker: allTracker,
  sessionId: 'session-all',
});

const allDecision = allFirewall.evaluate('search and read articles', ALL_TOOLS);

assert(allDecision.toolHintProfile.isCompactMode === true, 'Compact active');
assert(allDecision.toolHintProfile.isClusterMode === true, 'Cluster active');
assert(allDecision.toolHintProfile.isPredictiveMode === true, 'Predictive active');
assert(allDecision.toolHintProfile.compactTools!.length > 0, 'Compact tools present');
assert(allDecision.toolHintProfile.activeClusters!.length > 0, 'Active clusters present');
assert(allDecision.toolHintProfile.predictedToolNames!.length > 0, 'Predicted tools present');
assert(allDecision.tokenSavings!.savedTokens > 0, 'Token savings positive');

// Stats string includes all modes
assert(allDecision.stats.includes('Compact: active'), 'Stats mention Compact');
assert(allDecision.stats.includes('Clusters: active'), 'Stats mention Clusters');
assert(allDecision.stats.includes('Predictive: active'), 'Stats mention Predictive');

// ── Summary ─────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
