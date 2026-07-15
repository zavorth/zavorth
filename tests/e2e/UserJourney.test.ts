/**
 * E2E User Journey Tests — Simulates real user interactions across all improvements.
 *
 * These tests validate the complete user experience from onboarding through
 * daily usage, covering:
 * 1. Profile selection and onboarding
 * 2. Smart defaults application
 * 3. Cognitive firewall with all modes
 * 4. Tiered autonomy in action
 * 5. Progressive disclosure milestones
 * 6. Tool caching and predictive loading
 */

import {
  CognitiveFirewall,
  ToolGatekeeper,
  ToolUsageTracker,
  ToolResultCache,
  ContextAwareInjector,
} from '../../src/cognitive-firewall';
import { TieredAutonomyClassifier, TieredApplier } from '../../src/services/TieredAutonomyService';
import { ProfileOnboardingService } from '../../src/services/ProfileOnboardingService';
import { SmartDefaultsService } from '../../src/services/SmartDefaultsService';
import { ProgressiveDisclosureService } from '../../src/services/ProgressiveDisclosureService';
import { ProfileTieredAutonomyService } from '../../src/services/ProfileTieredAutonomyService';
import type { ToolDefinition } from '../../src/providers/ILlmProvider';
import type { ZavorthNativeLearningLoopCandidate } from '../../src/contracts/native/ZavorthNativeLearningLoopContract';

// ── Mock tools ────────────────────────────────────────────────

const ALL_TOOLS: ToolDefinition[] = [
  {
    name: 'web_search',
    description: 'Search the web.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Query' } },
      required: ['query'],
    },
  },
  {
    name: 'read_file',
    description: 'Read a file.',
    parameters: { type: 'object', properties: { path: { type: 'string', description: 'Path' } }, required: ['path'] },
  },
  {
    name: 'create_file',
    description: 'Create a file.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path' },
        content: { type: 'string', description: 'Content' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'run_sandbox_code',
    description: 'Run code in sandbox.',
    parameters: { type: 'object', properties: { code: { type: 'string', description: 'Code' } }, required: ['code'] },
  },
  {
    name: 'semantic_memory',
    description: 'Query memory.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Query' } },
      required: ['query'],
    },
  },
];

function buildCandidate(
  overrides: Partial<ZavorthNativeLearningLoopCandidate> = {},
): ZavorthNativeLearningLoopCandidate {
  return {
    id: 'test',
    kind: 'auto-skill-candidate',
    title: 'Test',
    summary: 'Test candidate',
    recommendation: 'Test',
    confidence: 0.8,
    risk: 'low',
    state: 'suggested',
    approvalRequired: true,
    reversible: true,
    source: { surface: 'test', workspace: null, sessionId: null, evidenceRefs: [] },
    actions: [],
    safety: {
      rawSecretsSerialized: false,
      canModifySecurityPolicy: false,
      securityPolicyFirewall: true,
      untrustedEvidence: true,
    },
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════
// TEST 1: Personal user — fast onboarding, maximum autonomy
// ══════════════════════════════════════════════════════════════

describe('E2E: Personal user journey', () => {
  it('personal user gets 3-question onboarding', () => {
    const onboarding = new ProfileOnboardingService();
    const flow = onboarding.getFlow('personal');

    expect(flow.questions).toHaveLength(3);
    expect(flow.questions.map((q) => q.id)).toEqual(['provider', 'apiKey', 'language']);
  });

  it('personal user gets lightweight defaults', () => {
    const defaults = new SmartDefaultsService().getDefaults('personal');

    expect(defaults.memory.mode).toBe('local-metadata');
    expect(defaults.safety.mode).toBe('preview-first');
    expect(defaults.skills.mode).toBe('auto-suggest');
    expect(defaults.cron.enabled).toBe(false);
  });

  it('personal user has maximum tiered autonomy', () => {
    const config = new ProfileTieredAutonomyService().getConfig('personal');

    expect(config.autoRiskThreshold).toBe('medium');
    expect(config.notifyRiskThreshold).toBe('high');
  });

  it('personal user low-risk candidate is auto-promoted', () => {
    const classifier = new TieredAutonomyClassifier({
      autoRiskThreshold: 'medium',
      notifyRiskThreshold: 'high',
    });

    const candidate = buildCandidate({
      risk: 'low',
      title: 'Use shorter greetings',
      summary: 'Make hello messages more concise',
    });

    const decision = classifier.classify(candidate);
    expect(decision.tier).toBe('auto');
  });

  it('personal user medium-risk candidate is auto-promoted', () => {
    const classifier = new TieredAutonomyClassifier({
      autoRiskThreshold: 'medium',
      notifyRiskThreshold: 'high',
    });

    const candidate = buildCandidate({
      risk: 'medium',
      title: 'Optimize web search workflow',
      summary: 'Cache search results locally',
    });

    const decision = classifier.classify(candidate);
    expect(decision.tier).toBe('auto');
  });

  it('personal user security candidate requires approval', () => {
    const classifier = new TieredAutonomyClassifier({
      autoRiskThreshold: 'medium',
      notifyRiskThreshold: 'high',
    });

    const candidate = buildCandidate({
      risk: 'low',
      title: 'Modify security policy',
      summary: 'Update firewall rules',
    });

    const decision = classifier.classify(candidate);
    expect(decision.tier).toBe('approve');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 2: Developer user — code-aware setup, balanced autonomy
// ══════════════════════════════════════════════════════════════

describe('E2E: Developer user journey', () => {
  it('developer user gets 5-question onboarding', () => {
    const onboarding = new ProfileOnboardingService();
    const flow = onboarding.getFlow('developer');

    expect(flow.questions).toHaveLength(5);
    expect(flow.questions.map((q) => q.id)).toContain('primaryStack');
    expect(flow.questions.map((q) => q.id)).toContain('devTools');
  });

  it('developer user gets dev-optimized defaults', () => {
    const defaults = new SmartDefaultsService().getDefaults('developer');

    expect(defaults.memory.mode).toBe('local-summary');
    expect(defaults.safety.mode).toBe('approval-required');
    expect(defaults.skills.mode).toBe('auto-install');
    expect(defaults.cron.enabled).toBe(true);
  });

  it('developer user has balanced tiered autonomy', () => {
    const config = new ProfileTieredAutonomyService().getConfig('developer');

    expect(config.autoRiskThreshold).toBe('medium');
    expect(config.notifyRiskThreshold).toBe('high');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 3: Business user — strict audit, maximum governance
// ══════════════════════════════════════════════════════════════

describe('E2E: Business user journey', () => {
  it('business user gets 6-question onboarding', () => {
    const onboarding = new ProfileOnboardingService();
    const flow = onboarding.getFlow('business');

    expect(flow.questions).toHaveLength(6);
    expect(flow.questions.map((q) => q.id)).toContain('teamSize');
    expect(flow.questions.map((q) => q.id)).toContain('complianceLevel');
  });

  it('business user gets strict defaults', () => {
    const defaults = new SmartDefaultsService().getDefaults('business');

    expect(defaults.safety.mode).toBe('governed');
    expect(defaults.receipts.level).toBe('audit');
    expect(defaults.skills.mode).toBe('governed');
  });

  it('business user everything requires approval', () => {
    const config = new ProfileTieredAutonomyService().getConfig('business');

    expect(config.forceApprovalKinds.length).toBeGreaterThan(0);
    expect(config.forceApprovalPatterns.length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 4: Cognitive Firewall — all modes working together
// ══════════════════════════════════════════════════════════════

describe('E2E: Cognitive Firewall full stack', () => {
  it('compact + cluster + predictive modes work together', () => {
    const tracker = new ToolUsageTracker();
    for (let i = 0; i < 10; i++) {
      tracker.recordTurn('user-1', ['web_search', 'read_file']);
    }

    const firewall = new CognitiveFirewall({
      compactMode: true,
      clusterMode: true,
      usageTracker: tracker,
      sessionId: 'user-1',
    });

    const decision = firewall.evaluate('search for TypeScript articles', ALL_TOOLS);

    expect(decision.classification.category).toBe('full_toolset');
    expect(decision.toolHintProfile.isCompactMode).toBe(true);
    expect(decision.toolHintProfile.isClusterMode).toBe(true);
    expect(decision.toolHintProfile.compactTools!.length).toBeGreaterThan(0);
    expect(decision.toolHintProfile.activeClusters!.length).toBeGreaterThan(0);
    expect(decision.tokenSavings!.savedTokens).toBeGreaterThan(0);

    // Predictive extras apply on filtered structured categories, not full_toolset.
    const predictive = new ToolGatekeeper({
      usageTracker: tracker,
      sessionId: 'user-1',
    }).buildHintProfile(ALL_TOOLS, 'information');
    expect(predictive.isPredictiveMode).toBe(true);
    expect(predictive.predictedToolNames).toContain('read_file');
  });

  it('tool cache avoids re-execution', () => {
    const cache = new ToolResultCache();
    let executionCount = 0;

    // First call — cache miss
    const result1 = cache.get('web_search', { query: 'test' });
    expect(result1).toBeNull();

    // Store result
    cache.set('web_search', { query: 'test' }, 'cached result');

    // Second call — cache hit
    const result2 = cache.get('web_search', { query: 'test' });
    expect(result2).toBe('cached result');

    // Non-cacheable tool not cached
    cache.set('run_sandbox_code', { code: 'test' }, 'output');
    expect(cache.get('run_sandbox_code', { code: 'test' })).toBeNull();
  });

  it('on-demand injection escalates after failures', () => {
    const injector = new ContextAwareInjector();

    // First failure
    injector.handleRequest('user-1', 'nonexistent1', ALL_TOOLS);
    // Second failure — escalation
    const result = injector.handleRequest('user-1', 'nonexistent2', ALL_TOOLS);

    expect(result.escalated).toBe(true);

    // After escalation, any tool is available
    const injected = injector.handleRequest('user-1', 'create_file', ALL_TOOLS);
    expect(injected.tool).not.toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 5: Tiered Autonomy — real candidate processing
// ══════════════════════════════════════════════════════════════

describe('E2E: Tiered Autonomy real flow', () => {
  it('applies low-risk candidate immediately for personal user', async () => {
    const applied: string[] = [];
    const applier = new TieredApplier(async (candidate) => {
      applied.push(candidate.id);
    });

    const classifier = new TieredAutonomyClassifier({
      autoRiskThreshold: 'medium',
      notifyRiskThreshold: 'high',
    });

    const candidate = buildCandidate({
      id: 'style-1',
      risk: 'low',
      title: 'Use shorter greetings',
      summary: 'Make hello messages more concise',
    });

    const decision = classifier.classify(candidate);
    const result = await applier.apply({ candidate, decision });

    expect(result.applied).toBe(true);
    expect(result.notifyUser).toBe(false);
    expect(applied).toContain('style-1');
  });

  it('applies medium-risk candidate with notification', async () => {
    const notified: string[] = [];
    const applier = new TieredApplier(
      async () => {},
      (candidate) => {
        notified.push(candidate.id);
      },
    );

    const classifier = new TieredAutonomyClassifier({
      autoRiskThreshold: 'low',
      notifyRiskThreshold: 'medium',
    });

    const candidate = buildCandidate({
      id: 'workflow-1',
      risk: 'medium',
      title: 'Optimize search workflow',
      summary: 'Cache results locally',
    });

    const decision = classifier.classify(candidate);
    const result = await applier.apply({ candidate, decision });

    expect(result.applied).toBe(true);
    expect(result.notifyUser).toBe(true);
    expect(result.undoAvailable).toBe(true);
    expect(notified).toContain('workflow-1');
  });

  it('queues high-risk candidate for approval', async () => {
    const applied: string[] = [];
    const applier = new TieredApplier(async (candidate) => {
      applied.push(candidate.id);
    });

    const classifier = new TieredAutonomyClassifier();

    const candidate = buildCandidate({
      id: 'security-1',
      risk: 'high',
      title: 'Modify security policy',
      summary: 'Update firewall rules',
    });

    const decision = classifier.classify(candidate);
    const result = await applier.apply({ candidate, decision });

    expect(result.applied).toBe(false);
    expect(applied).toHaveLength(0);
  });

  it('undo works within window', async () => {
    const undone: string[] = [];
    const applier = new TieredApplier(
      async () => {},
      undefined,
      async (candidate) => {
        undone.push(candidate.id);
      },
    );

    const classifier = new TieredAutonomyClassifier({
      autoRiskThreshold: 'low',
      notifyRiskThreshold: 'medium',
    });

    const candidate = buildCandidate({
      id: 'undo-1',
      risk: 'medium',
      title: 'Test undo',
      summary: 'Test',
    });

    const decision = classifier.classify(candidate);
    await applier.apply({ candidate, decision });

    const undoResult = await applier.undo('undo-1');
    expect(undoResult).toBe(true);
    expect(undone).toContain('undo-1');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 6: Progressive Disclosure — milestones and suggestions
// ══════════════════════════════════════════════════════════════

describe('E2E: Progressive Disclosure journey', () => {
  it('new user starts at basic level', () => {
    const service = new ProgressiveDisclosureService();
    const state = service.getState('new-user', 'personal');

    expect(state.currentLevel).toBe('basic');
    expect(service.getAvailableFeatures('new-user')).toHaveLength(0);
  });

  it('user progresses to intermediate after 10 conversations', () => {
    const service = new ProgressiveDisclosureService({ persistToDisk: false });
    const userId = `growing-user-${Date.now()}`;
    service.getState(userId, 'personal');

    for (let i = 0; i < 10; i++) {
      service.recordActivity(userId, 'conversation', { conversationCount: i + 1 });
    }

    expect(service.getLevel(userId)).toBe('intermediate');
  });

  it('user gets suggestion after skill use', () => {
    const service = new ProgressiveDisclosureService({ persistToDisk: false });
    const userId = `skill-user-${Date.now()}`;
    service.getState(userId, 'personal');

    const suggestions = service.recordActivity(userId, 'skill-use');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toContain('skill');
  });

  it('user can manually promote level', () => {
    const service = new ProgressiveDisclosureService({ persistToDisk: false });
    const userId = `power-user-${Date.now()}`;
    service.getState(userId, 'personal');

    const level1 = service.promoteLevel(userId);
    expect(level1).toBe('intermediate');

    const level2 = service.promoteLevel(userId);
    expect(level2).toBe('advanced');

    const level3 = service.promoteLevel(userId);
    expect(level3).toBe('expert');
  });

  it('expert user has all features available', () => {
    const service = new ProgressiveDisclosureService({ persistToDisk: false });
    const userId = `expert-user-${Date.now()}`;
    service.getState(userId, 'personal');

    // Promote to expert
    service.promoteLevel(userId);
    service.promoteLevel(userId);
    service.promoteLevel(userId);

    const features = service.getAvailableFeatures(userId);
    expect(features).toContain('stats-dashboard');
    expect(features).toContain('cron-automation');
    expect(features).toContain('subagent-orchestration');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 7: Full user journey — onboarding to daily use
// ══════════════════════════════════════════════════════════════

describe('E2E: Complete user journey', () => {
  it('personal user: onboarding → first use → suggestions', () => {
    // Step 1: Onboarding
    const onboarding = new ProfileOnboardingService();
    const flow = onboarding.getFlow('personal');
    expect(flow.questions).toHaveLength(3);

    // Step 2: Smart defaults
    const defaults = new SmartDefaultsService().getDefaults('personal');
    expect(defaults.memory.mode).toBe('local-metadata');

    // Step 3: First conversation with firewall
    const tracker = new ToolUsageTracker();
    const firewall = new CognitiveFirewall({
      compactMode: true,
      clusterMode: true,
      usageTracker: tracker,
      sessionId: 'personal-user',
    });

    const decision = firewall.evaluate('hello', ALL_TOOLS);
    expect(decision.useFastModel).toBe(false);
    expect(decision.classification.category).toBe('full_toolset');

    // Step 4: Record usage for predictive loading (need 3+ turns)
    for (let i = 0; i < 5; i++) {
      tracker.recordTurn('personal-user', ['web_search', 'read_file']);
    }

    // Step 5: Free text stays full_toolset; predictive extras need a filtered category.
    const decision2 = firewall.evaluate('search for news', ALL_TOOLS);
    expect(decision2.classification.category).toBe('full_toolset');
    expect(decision2.toolHintProfile.isCompactMode).toBe(true);

    // Step 6: Progressive disclosure
    const disclosure = new ProgressiveDisclosureService();
    disclosure.getState('personal-user', 'personal');
    for (let i = 0; i < 10; i++) {
      disclosure.recordActivity('personal-user', 'conversation', { conversationCount: i + 1 });
    }
    expect(disclosure.getLevel('personal-user')).toBe('intermediate');
  });

  it('developer user: onboarding → code work → skill suggestions', () => {
    // Step 1: Onboarding
    const onboarding = new ProfileOnboardingService();
    const flow = onboarding.getFlow('developer');
    expect(flow.questions).toHaveLength(5);

    // Step 2: Smart defaults
    const defaults = new SmartDefaultsService().getDefaults('developer');
    expect(defaults.skills.mode).toBe('auto-install');
    expect(defaults.cron.enabled).toBe(true);

    // Step 3: Code work with firewall
    const firewall = new CognitiveFirewall({
      compactMode: true,
      clusterMode: true,
    });

    const decision = firewall.evaluate('read the README.md file', ALL_TOOLS);
    // Free text does not keyword-map to file_operation; model owns capability choice.
    expect(decision.classification.category).toBe('full_toolset');

    // Step 4: Progressive disclosure
    const disclosure = new ProgressiveDisclosureService();
    disclosure.getState('dev-user', 'developer');
    disclosure.recordActivity('dev-user', 'skill-use');
    expect(disclosure.getLevel('dev-user')).toBe('advanced');
  });
});
