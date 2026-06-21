/**
 * NaturalLanguageRouter - text intent enrichment for free-form messages.
 *
 * This router does not convert natural language into hidden slash commands.
 * It classifies text as an intent hint and leaves the final route to the
 * runtime, policy layer, or explicit command parser.
 */

import { CognitiveFirewall } from '../cognitive-firewall/index.js';
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
  /^(oi|ola|hey|hi|hello|bom dia|boa tarde|boa noite|e ai|fala|salve|good morning|good afternoon|good evening|merci|danke|gracias|arigatou|감사합니다|شكرا|ありがとう)\b/i,
  /^(ok|ta|beleza|blz|show|perfeito|entendi|certo|valeu|obrigado|obg|thanks|vlw|tmj|merci|danke|gracias)\b/i,
  /^(sim|nao|s|n|yes|no|yeah|nope|yep|ja|nein|oui|non|はい|いいえ|네|아니오|نعم|لا)\s*$/i,
  /^(haha|kk|kkk|rs|rsrs|lol|hehe)\s*$/i,
];

export class NaturalLanguageRouter {
  private readonly firewall = new CognitiveFirewall();

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
