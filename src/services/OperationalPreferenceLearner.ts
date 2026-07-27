import type { OperationalPreferenceSnapshot } from '../contracts/PracticalAgencyContract.js';

export class OperationalPreferenceLearner {
  public learn(input: { text: string; existing?: Partial<OperationalPreferenceSnapshot['preferences']> | null }): OperationalPreferenceSnapshot {
    void input.text;
    const existing = input.existing || {};
    const preferences = {
      aiFirst: existing.aiFirst ?? false,
      hideInternalJargon: existing.hideInternalJargon ?? false,
      portugueseReplies: existing.portugueseReplies ?? false,
      localWorkspaceAutonomy: existing.localWorkspaceAutonomy ?? false,
      proposalBeforeImpact: existing.proposalBeforeImpact ?? false,
    };

    return {
      source: 'OperationalPreferenceLearner',
      rawSecretsSerialized: false,
      preferences,
      receipts: [
        'operational-preferences-no-secrets',
        'operational-preferences-do-not-bypass-policy',
      ],
    };
  }
}
