/**
 * CognitiveFirewall — local free-text hints + plugin quarantine.
 *
 * Orchestrates IntentClassifier + ToolGatekeeper for telemetry, cheap-model
 * selection on trivial chat, compact/cluster hints, and hard plugin quarantine.
 * Free-text capability choice is model-owned: non-trivial turns are full_toolset.
 * ConversationalAgent exposes the full catalog (minus quarantine).
 *
 * Optional LLM classification (disabled by default) only distinguishes
 * conversation vs full_toolset — never word→tool categories.
 *
 * USO:
 *   const firewall = new CognitiveFirewall();
 *   const decision = firewall.evaluate(userMessage, allToolDefinitions);
 *   // decision.useFastModel → trivial chat may use a cheap model
 *   // decision.tools → hint profile tools (not the product free-text gate)
 */

import { IntentClassifier, type IntentClassification } from './IntentClassifier.js';
import { LLMIntentClassifier, type LLMIntentClassifierOptions } from './LLMIntentClassifier.js';
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

export interface CognitiveFirewallOptions extends ToolGatekeeperOptions {
  /** Enable LLM-based classification for ambiguous intents (default: false) */
  enableLLMClassification?: boolean;
  /** LLM provider name for classification (defaults to user's configured provider) */
  llmProviderName?: string;
  /** Confidence threshold below which LLM classification is used (default: 0.6) */
  llmConfidenceThreshold?: number;
  /** LLM classification options */
  llmClassifierOptions?: LLMIntentClassifierOptions;
}

export class CognitiveFirewall {
  private readonly regexClassifier = new IntentClassifier();
  private readonly llmClassifier: LLMIntentClassifier | null;
  private readonly baseOptions: CognitiveFirewallOptions;
  private readonly baseGatekeeper: ToolGatekeeper;
  private readonly gatekeeperCache: Map<string, ToolGatekeeper> = new Map();
  private readonly llmConfidenceThreshold: number;

  constructor(options?: CognitiveFirewallOptions) {
    this.baseOptions = options ?? {};
    this.baseGatekeeper = new ToolGatekeeper(options);
    this.llmConfidenceThreshold = options?.llmConfidenceThreshold ?? 0.6;
    
    // Initialize LLM classifier if enabled
    if (options?.enableLLMClassification) {
      this.llmClassifier = new LLMIntentClassifier({
        providerName: options.llmProviderName,
        ...options.llmClassifierOptions,
      });
    } else {
      this.llmClassifier = null;
    }
  }

  /**
   * Evaluates a user message synchronously (regex only, zero cost).
   * Use this when async is not available or for trivial cases.
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
    const classification = this.regexClassifier.classify(userMessage);
    return this.buildDecision(classification, allTools, evaluateOptions);
  }

  /**
   * Evaluates a user message with intelligent hybrid classification.
   * Uses regex for trivial cases, LLM for ambiguous/complex cases.
   *
   * @param userMessage - The user's message to classify
   * @param allTools - All registered tool definitions
   * @param evaluateOptions - Optional per-call options (e.g., sessionId for predictive loading)
   */
  public async evaluateAsync(
    userMessage: string,
    allTools: ToolDefinition[],
    evaluateOptions?: { sessionId?: string },
  ): Promise<FirewallDecision> {
    // Start with regex classification
    const regexClassification = this.regexClassifier.classify(userMessage);
    
    // If LLM is enabled and regex confidence is low, use LLM
    if (this.llmClassifier && regexClassification.confidence < this.llmConfidenceThreshold) {
      try {
        const llmClassification = await this.llmClassifier.classify(userMessage);
        
        // Use LLM classification if it has higher confidence
        if (llmClassification.confidence > regexClassification.confidence) {
          console.log(`[CognitiveFirewall] LLM upgraded classification: ${regexClassification.category} (${regexClassification.confidence}) → ${llmClassification.category} (${llmClassification.confidence})`);
          return this.buildDecision(llmClassification, allTools, evaluateOptions);
        }
      } catch (error: unknown) {
        console.warn('[CognitiveFirewall] LLM classification failed, using regex:', error);
      }
    }
    
    return this.buildDecision(regexClassification, allTools, evaluateOptions);
  }

  /**
   * Build the final decision from a classification.
   */
  private buildDecision(
    classification: IntentClassification,
    allTools: ToolDefinition[],
    evaluateOptions?: { sessionId?: string },
  ): FirewallDecision {
    // Reuse cached gatekeeper per sessionId to avoid recreating ToolClusterRegistry
    let gatekeeper: ToolGatekeeper;
    if (evaluateOptions?.sessionId && this.baseOptions.usageTracker) {
      let cached = this.gatekeeperCache.get(evaluateOptions.sessionId);
      if (!cached) {
        cached = new ToolGatekeeper({
          ...this.baseOptions,
          sessionId: evaluateOptions.sessionId,
        });
        this.gatekeeperCache.set(evaluateOptions.sessionId, cached);
        // Evict old entries if cache grows too large
        if (this.gatekeeperCache.size > 100) {
          const firstKey = this.gatekeeperCache.keys().next().value;
          if (firstKey) this.gatekeeperCache.delete(firstKey);
        }
      }
      gatekeeper = cached;
    } else {
      gatekeeper = this.baseGatekeeper;
    }

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
