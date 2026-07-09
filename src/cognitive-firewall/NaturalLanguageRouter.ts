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
  /** Whether a cheap/fast model may answer this turn. */
  useFastModel: boolean;
  /** Whether the message is a trivial greeting/ack. */
  isTrivialChat: boolean;
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

const ZERO_TOOL_INTENTS: Set<IntentCategory> = new Set([
  'conversation',
]);

const TRIVIAL_CHAT_PATTERNS = [
  /^(hey|hi|hello|good\s+morning|good\s+afternoon|good\s+evening|thanks|thank\s+you|ok|okay|sure|right|got\s+it|understood|nice|great|perfect|awesome|cool|yes|no|y|n|\?\?|\!\!|bye|see\s+ya|cheers|lol|haha|hey|yo|sup|howdy|greetings|welcome|cheers|ta|ty|thx|tyvm|np|yw|roger|copy|affirmative|negative)\b/i,
  /^(ok|okay|sure|right|got\s+it|understood|nice|great|perfect|awesome|cool|thanks|thank\s+you|cheers|ta|ty|thx|tyvm|np|yw|roger|copy)\b/i,
  /^(yes|no|yeah|nope|yep|yep|yea|nah|nope|nay|aye|right|correct|wrong|true|false)\s*$/i,
  /^(haha|lol|hehe|lmao|rofl|omg|wow|bruh|yo|hey|hi|hello)\s*$/i,
];

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

    const isTrivialChat = this.isTrivialChat(trimmed);
    const firewallDecision = this.firewall.evaluate(trimmed, []);
    const intentCategory = firewallDecision.classification.category;

    return {
      classified: true,
      skipCommandRouting: false,
      intentCategory,
      useFastModel: isTrivialChat || firewallDecision.useFastModel,
      isTrivialChat,
      firewallStats: firewallDecision.stats,
      suggestedInternalCommand: null,
      legacyFallbackCommand: '/task',
    };
  }

  private isTrivialChat(text: string): boolean {
    return TRIVIAL_CHAT_PATTERNS.some((pattern) => pattern.test(text));
  }

  private createDecision(
    intentCategory: IntentCategory,
    overrides: Partial<NaturalRouteDecision> = {},
  ): NaturalRouteDecision {
    return {
      classified: true,
      skipCommandRouting: false,
      intentCategory,
      useFastModel: ZERO_TOOL_INTENTS.has(intentCategory),
      isTrivialChat: false,
      firewallStats: 'classification=skipped',
      suggestedInternalCommand: null,
      legacyFallbackCommand: '/task',
      ...overrides,
    };
  }
}
