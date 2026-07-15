/**
 * UX intent hints for surface operational routing.
 *
 * Free-text is model-owned: this router does NOT keyword-scan natural language
 * to choose product features. Only structural signals may bias the decision:
 * empty input, explicitExecution, attachments, contextual mentions.
 *
 * Slash commands and structured capabilityIds remain the deterministic path.
 */

export type UserExperienceIntentKind =
  | 'chat'
  | 'answer'
  | 'explain'
  | 'plan'
  | 'preview'
  | 'execute'
  | 'approve'
  | 'configure'
  | 'diagnose';

export type UserExperienceIntentDecision = {
  source: 'UserExperienceIntentRouter';
  contractVersion: 'user-experience-intent-router/1';
  kind: UserExperienceIntentKind;
  confidence: 'low' | 'medium' | 'high';
  shouldUseTools: boolean;
  shouldAskApproval: boolean;
  explicitAction: boolean;
  explicitTarget: boolean;
  reason: string;
  signals: string[];
};

export type UserExperienceIntentInput = {
  text: string;
  explicitExecution?: boolean | null;
  hasAttachments?: boolean | null;
  hasContextualMentions?: boolean | null;
};

export class UserExperienceIntentRouter {
  public decide(input: UserExperienceIntentInput): UserExperienceIntentDecision {
    const rawText = String(input.text || '').trim();
    const signals: string[] = ['free-text-model-owned'];

    if (!rawText) {
      return this.decision('chat', 'high', false, false, false, false, 'Empty input stays light conversation.', [
        'empty',
      ]);
    }

    const explicitExecution = input.explicitExecution === true;
    const attachmentPresent = input.hasAttachments === true;
    const contextualMentions = input.hasContextualMentions === true;

    if (explicitExecution) signals.push('explicit-execution');
    if (attachmentPresent) signals.push('attachment');
    if (contextualMentions) signals.push('contextual-mention');

    // Structural only — never keyword-route free text into product features.
    if (explicitExecution) {
      return this.decision(
        'execute',
        'high',
        true,
        false,
        true,
        attachmentPresent,
        'Structured explicitExecution flag; free text was not keyword-scanned.',
        signals,
      );
    }

    if (attachmentPresent) {
      return this.decision(
        'preview',
        'high',
        true,
        false,
        true,
        true,
        'Attachment present; governed preview path. Free text was not keyword-scanned.',
        signals,
      );
    }

    // Default free text: do not force tools on/off via regex.
    // Low confidence so SurfaceOperationalIntentService does not treat this as high-confidence conversation-only.
    // LLM + tool catalog own capability choice (IntentClassifier full_toolset path).
    return this.decision(
      'answer',
      'low',
      false,
      false,
      false,
      false,
      'Free-text is model-owned; UX router does not keyword-route features.',
      signals,
    );
  }

  private decision(
    kind: UserExperienceIntentKind,
    confidence: UserExperienceIntentDecision['confidence'],
    shouldUseTools: boolean,
    shouldAskApproval: boolean,
    explicitAction: boolean,
    explicitTarget: boolean,
    reason: string,
    signals: string[],
  ): UserExperienceIntentDecision {
    return {
      source: 'UserExperienceIntentRouter',
      contractVersion: 'user-experience-intent-router/1',
      kind,
      confidence,
      shouldUseTools,
      shouldAskApproval,
      explicitAction,
      explicitTarget,
      reason,
      signals: Array.from(new Set(signals)),
    };
  }
}
