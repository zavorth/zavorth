/**
 * NaturalLanguageRouter - text intent enrichment for free-form messages.
 *
 * This router does not convert natural language into hidden slash commands.
 * It classifies text as an intent hint and leaves the final route to the
 * runtime, policy layer, or explicit command parser.
 */

import type { CognitiveFirewall } from '../cognitive-firewall/index.js';
import type { IntentCategory } from '../cognitive-firewall/IntentClassifier.js';

export interface NaturalRouteDecision {
  /** Whether text was non-empty and could be classified as a hint. */
  classified: boolean;
  /** Whether legacy command routing should be skipped. */
  skipCommandRouting: boolean;
  /** Intent hint detected by the Cognitive Firewall. */
  intentCategory: IntentCategory;
  /** Whether a cheap/fast model may answer this turn (free-text path always false). */
  useFastModel: boolean;
  /** Stats from the firewall/tool hint layer. */
  firewallStats: string;
  /**
   * Real internal command suggestion, if a dedicated command exists.
   * Null means "no hidden command"; the legacy ingress may still use /task.
   */
  suggestedInternalCommand: string | null;
  /** Explicit compatibility fallback for legacy free-form ingress. */
  legacyFallbackCommand: '/task';
}

export class NaturalLanguageRouter {
  private readonly firewall: CognitiveFirewall;

  constructor(firewall?: CognitiveFirewall) {
    // Accept external instance to avoid duplicate CognitiveFirewall creation.
    // Lazy-load only if no instance provided (backward compatibility).
    if (firewall) {
      this.firewall = firewall;
    } else {
      // Lazy import to avoid circular dependency
      const { CognitiveFirewall: LazyFirewall } = require('../cognitive-firewall/index.js');
      this.firewall = new LazyFirewall();
    }
  }

  public route(text: string): NaturalRouteDecision {
    const trimmed = text.trim();

    if (!trimmed) {
      return this.createDecision('conversation', {
        classified: false,
        skipCommandRouting: false,
      });
    }

    const firewallDecision = this.firewall.evaluate(trimmed, []);
    const intentCategory = firewallDecision.classification.category;

    return {
      classified: true,
      skipCommandRouting: false,
      intentCategory,
      useFastModel: false,
      firewallStats: firewallDecision.stats,
      suggestedInternalCommand: null,
      legacyFallbackCommand: '/task',
    };
  }

  private createDecision(
    intentCategory: IntentCategory,
    overrides: Partial<NaturalRouteDecision> = {},
  ): NaturalRouteDecision {
    return {
      classified: true,
      skipCommandRouting: false,
      intentCategory,
      useFastModel: false,
      firewallStats: 'classification=skipped',
      suggestedInternalCommand: null,
      legacyFallbackCommand: '/task',
      ...overrides,
    };
  }
}
