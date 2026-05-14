import type { OperationalPreferenceSnapshot } from '../contracts/PracticalAgencyContract.js';

export class OperationalPreferenceLearner {
  public learn(input: { text: string; existing?: Partial<OperationalPreferenceSnapshot['preferences']> | null }): OperationalPreferenceSnapshot {
    const text = normalize(input.text);
    const existing = input.existing || {};
    const preferences = {
      aiFirst: existing.aiFirst ?? /\b(ai-first|ia primeiro|llm|inteligente|pense primeiro)\b/.test(text),
      hideInternalJargon: existing.hideInternalJargon ?? /\b(sem jargao|sem termos tecnicos|dona de casa|usuario comum|linguagem natural)\b/.test(text),
      portugueseReplies: existing.portugueseReplies ?? /\b(portugues|en-us|em portugues)\b/.test(text),
      localWorkspaceAutonomy: existing.localWorkspaceAutonomy ?? /\b(local_owner|dono local|autonomia local|workspace)\b/.test(text),
      proposalBeforeImpact: existing.proposalBeforeImpact ?? /\b(proposta antes|previa|simulacao|antes de aplicar|confirmacao)\b/.test(text),
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

function normalize(value: string): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
