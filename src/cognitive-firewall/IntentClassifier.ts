/**
 * IntentClassifier - local, zero-token routing hints for the Cognitive Firewall.
 *
 * Free-text capability choice is model-owned. This classifier only marks empty
 * input as conversation; all other free text is full_toolset.
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

export class IntentClassifier {
  /**
   * Free-text capability choice is model-owned. Empty input is conversation;
   * everything else is full_toolset.
   */
  public classify(rawMessage: string): IntentClassification {
    const text = this.normalize(rawMessage);
    const trimmed = text.trim();

    if (!trimmed) {
      return this.decision({
        category: 'conversation',
        confidence: 0.5,
        reason: 'Empty message.',
      });
    }

    return this.decision({
      category: 'full_toolset',
      confidence: 0.5,
      reason: 'Free-text intent is model-owned; local classifier does not map words to capabilities.',
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
    secondPass?: IntentSecondPassReview;
  }): IntentClassification {
    return {
      category: draft.category,
      confidence: draft.confidence,
      reason: draft.reason,
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

  private normalize(value: string): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}
