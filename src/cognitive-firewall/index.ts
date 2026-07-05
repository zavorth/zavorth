/**
 * CognitiveFirewall — Fachada principal do sistema de economia de tokens.
 *
 * Orchestrates IntentClassifier + ToolGatekeeper in one simple call
 * for integration with ConversationalAgent and any other Zavorth point.
 *
 * USO:
 *   const firewall = new CognitiveFirewall();
 *   const decision = firewall.evaluate(userMessage, allToolDefinitions);
 *   // decision.tools → tools filtradas para injetar no prompt
 *   // decision.useFastModel → se true, pode usar LLM barato (Flash/local)
 */

import { IntentClassifier, type IntentClassification } from './IntentClassifier.js';
import { ToolGatekeeper, type ToolGatekeeperHintProfile, type ToolGatekeeperOptions } from './ToolGatekeeper.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { calculateSavings } from './LazyToolDefinition.js';

export interface FirewallDecision {
  /** Tools filtered by intent. Inject these, and only these, into the LLM prompt. */
  tools: ToolDefinition[];
  /** Hint profile consumable by runtime policy/telemetry; not the final gate. */
  toolHintProfile: ToolGatekeeperHintProfile;
  /** Nomes recomendados para exposicao, sem substituir a policy final. */
  recommendedToolNames: string[];
  /** True when Cognitive Firewall blocked exposure of an untrusted plugin/capability. */
  toolExposureGatedByCognitiveFirewall: boolean;
  /** If true, the message is trivial chat and can use a cheaper LLM. */
  useFastModel: boolean;
  /** Full intent classification for logging/debug. */
  classification: IntentClassification;
  /** Savings statistics for logs. */
  stats: string;
  /** Token savings from compact mode (only present when compactMode is active). */
  tokenSavings?: {
    fullTokens: number;
    compactTokens: number;
    savedTokens: number;
    savingsPercent: number;
  };
}

export interface CognitiveFirewallOptions extends ToolGatekeeperOptions {}

export class CognitiveFirewall {
  private readonly classifier = new IntentClassifier();
  private readonly baseOptions: CognitiveFirewallOptions;
  private readonly baseGatekeeper: ToolGatekeeper;

  constructor(options?: CognitiveFirewallOptions) {
    this.baseOptions = options ?? {};
    this.baseGatekeeper = new ToolGatekeeper(options);
  }

  /**
   * Evaluates a user message and decides:
   * 1. Which tools to inject in the prompt (Just-In-Time)
   * 2. Whether it can use a cheaper model (LLM Cascade)
   *
   * Runs in <1ms, 0 tokens, 0 external calls.
   *
   * @param userMessage - The user's message to classify
   * @param allTools - All registered tool definitions
   * @param evaluateOptions - Optional per-call options (e.g., sessionId for predictive loading)
   */
  public evaluate(
    userMessage: string,
    allTools: ToolDefinition[],
    evaluateOptions?: { sessionId?: string },
  ): FirewallDecision {
    const classification = this.classifier.classify(userMessage);

    // Use per-call sessionId if provided, otherwise use base gatekeeper
    const gatekeeper = evaluateOptions?.sessionId && this.baseOptions.usageTracker
      ? new ToolGatekeeper({
          ...this.baseOptions,
          sessionId: evaluateOptions.sessionId,
        })
      : this.baseGatekeeper;

    const toolHintProfile = gatekeeper.buildHintProfile(allTools, classification.category);
    const isCompactMode = toolHintProfile.isCompactMode ?? false;

    let tokenSavings: FirewallDecision['tokenSavings'];
    if (isCompactMode && allTools.length > 0) {
      const savings = calculateSavings(toolHintProfile.tools);
      tokenSavings = {
        fullTokens: savings.fullTokens,
        compactTokens: savings.compactTokens,
        savedTokens: savings.savedTokens,
        savingsPercent: savings.savingsPercent,
      };
    }

    const stats = gatekeeper.getFilterStats(
      allTools.length,
      toolHintProfile.filteredTools,
      classification.category,
      toolHintProfile.quarantinedToolNames.length,
      isCompactMode,
      toolHintProfile.isClusterMode ?? false,
      toolHintProfile.isPredictiveMode ?? false,
    );

    return {
      tools: toolHintProfile.tools,
      toolHintProfile,
      recommendedToolNames: toolHintProfile.recommendedToolNames,
      toolExposureGatedByCognitiveFirewall: toolHintProfile.toolExposureGatedByCognitiveFirewall,
      useFastModel: classification.isTrivialChat,
      classification,
      stats,
      tokenSavings,
    };
  }
}

// Re-export for convenience.
export { IntentClassifier, type IntentClassification } from './IntentClassifier.js';
export {
  ToolGatekeeper,
  getDynamicIntentToolMap,
  setDynamicIntentToolMap,
  type IntentToolCategoryMap,
  type ToolGatekeeperHintGroup,
  type ToolGatekeeperHintProfile,
  type ToolGatekeeperOptions,
} from './ToolGatekeeper.js';
export { NaturalLanguageRouter, type NaturalRouteDecision } from './NaturalLanguageRouter.js';
export { IntentEnrichedParser, type IntentEnrichedCommand } from './IntentEnrichedParser.js';
export {
  toCompact,
  toCompactBatch,
  isCompact,
  resolveFull,
  resolveFullBatch,
  buildToolRegistry,
  calculateSavings,
} from './LazyToolDefinition.js';
export type { CompactToolDefinition } from '../providers/ILlmProvider.js';
export { ToolResultCache, type ToolResultCacheOptions, type ToolResultCacheStats } from './ToolResultCache.js';
export { ToolClusterRegistry, type ToolCluster } from './ToolClusterRegistry.js';
export { ToolUsageTracker, type ToolUsageTurn, type PredictionResult } from './ToolUsageTracker.js';
export { ContextAwareInjector, type InjectorState, type InjectorResult } from './ContextAwareInjector.js';
