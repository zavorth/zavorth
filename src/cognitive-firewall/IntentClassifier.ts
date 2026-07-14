/**
 * IntentClassifier - local, zero-token routing hints for the Cognitive Firewall.
 *
 * Free-text capability choice is model-owned. This classifier only flags trivial
 * chat for cheap-model selection; it does not map words to tools or features.
 * Category values other than conversation / full_toolset remain on the type for
 * ToolGatekeeper maps and explicit structured callers.
 */

export type IntentCategory =
  | 'conversation'
  | 'information'
  | 'file_operation'
  | 'execution'
  | 'configuration'
  | 'memory'
  | 'desktop'
  | 'research'
  | 'full_toolset';

export interface IntentClassification {
  category: IntentCategory;
  confidence: number;
  reason: string;
  isTrivialChat: boolean;
  isHardDecision: false;
  downgradedBy: string[];
  secondPass: IntentSecondPassReview;
}

export interface IntentSecondPassReview {
  source: 'ContextualIntentSecondPass';
  stage: 7;
  mode: 'local-contextual';
  verdict: 'confirmed' | 'downgraded' | 'left-ambiguous';
  originalCategory: IntentCategory;
  finalCategory: IntentCategory;
  confidenceDelta: number;
  signals: string[];
}

/** Short social acknowledgements only — not capability routing. */
const TRIVIAL_CHAT_PATTERNS = /^(hey|hi|hello|good\s+morning|good\s+afternoon|good\s+evening|thanks|thank\s+you|ok|okay|sure|right|got\s+it|understood|nice|great|perfect|awesome|cool|yes|no|y|n|\?\?|\!\!|bye|see\s+ya|cheers|lol|haha|yo|sup|howdy|greetings|welcome|ta|ty|thx|tyvm|np|yw|roger|copy|affirmative|negative)[\?\!\.\,]?$/i;

export class IntentClassifier {
  /**
   * Free-text capability choice is model-owned. Only empty/trivial chat is
   * marked as conversation for cheap-model selection.
   */
  public classify(rawMessage: string): IntentClassification {
    const text = this.normalize(rawMessage);
    const trimmed = text.trim();

    if (!trimmed) {
      return this.decision({
        category: 'conversation',
        confidence: 0.5,
        reason: 'Empty message.',
        isTrivialChat: true,
      });
    }

    if (this.isTrivialChat(trimmed)) {
      return this.decision({
        category: 'conversation',
        confidence: 0.95,
        reason: 'Short social acknowledgement; tool routing remains model-owned.',
        isTrivialChat: true,
      });
    }

    return this.decision({
      category: 'full_toolset',
      confidence: 0.5,
      reason: 'Free-text intent is model-owned; local classifier does not map words to capabilities.',
      isTrivialChat: false,
      secondPass: {
        source: 'ContextualIntentSecondPass',
        stage: 7,
        mode: 'local-contextual',
        verdict: 'left-ambiguous',
        originalCategory: 'full_toolset',
        finalCategory: 'full_toolset',
        confidenceDelta: 0,
        signals: ['model-owned-free-text'],
      },
    });
  }

  private decision(draft: {
    category: IntentCategory;
    confidence: number;
    reason: string;
    isTrivialChat: boolean;
    secondPass?: IntentSecondPassReview;
  }): IntentClassification {
    return {
      category: draft.category,
      confidence: draft.confidence,
      reason: draft.reason,
      isTrivialChat: draft.isTrivialChat,
      isHardDecision: false,
      downgradedBy: [],
      secondPass: draft.secondPass || {
        source: 'ContextualIntentSecondPass',
        stage: 7,
        mode: 'local-contextual',
        verdict: 'confirmed',
        originalCategory: draft.category,
        finalCategory: draft.category,
        confidenceDelta: 0,
        signals: [],
      },
    };
  }

  private isTrivialChat(text: string): boolean {
    if (text.length > 60) return false;
    return TRIVIAL_CHAT_PATTERNS.test(text);
  }

  private normalize(value: string): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}
