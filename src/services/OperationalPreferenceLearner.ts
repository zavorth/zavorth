import type { OperationalPreferenceSnapshot } from '../contracts/PracticalAgencyContract.js';

type PreferenceKeys = OperationalPreferenceSnapshot['preferences'];

const KEYWORD_RULES: Array<{ key: keyof PreferenceKeys; positive: string[]; negative: string[] }> = [
  {
    key: 'aiFirst',
    positive: ['act first', 'act on your own', 'take initiative', 'go ahead', 'be autonomous', 'act autonomously', 'ai-first'],
    negative: ['ask first', 'ask me first', 'confirm first', 'wait for me', 'ask before'],
  },
  {
    key: 'hideInternalJargon',
    positive: ['hide jargon', 'no jargon', 'plain language', 'simple terms', 'avoid technical terms', 'sem jarg'],
    negative: ['show jargon', 'technical terms are fine', 'keep jargon', 'use jargon'],
  },
  {
    key: 'portugueseReplies',
    positive: ['portuguese', 'em portugues', 'em português', 'pt-br', 'responda em português'],
    negative: ['english', 'in english', 'reply in english'],
  },
  {
    key: 'localWorkspaceAutonomy',
    positive: ['workspace autonomy', 'free reign in workspace', 'autonomy in workspace', 'act freely', 'local autonomy'],
    negative: ['no autonomy', 'restrict access', 'ask before touching', 'approval first'],
  },
  {
    key: 'proposalBeforeImpact',
    positive: ['propose first', 'propose before', 'preview before', 'show me first', 'plan before', 'propose instead', 'proposta antes'],
    negative: ['just do it', 'no proposal', 'do it directly', 'skip proposal', 'no need to ask'],
  },
];

function inferBoolean(text: string, positive: string[], negative: string[]): boolean | null {
  const lower = text.toLowerCase();
  const hasPositive = positive.some((phrase) => lower.includes(phrase));
  const hasNegative = negative.some((phrase) => lower.includes(phrase));
  if (hasPositive && !hasNegative) return true;
  if (hasNegative && !hasPositive) return false;
  return null;
}

export class OperationalPreferenceLearner {
  public learn(input: { text: string; existing?: Partial<OperationalPreferenceSnapshot['preferences']> | null }): OperationalPreferenceSnapshot {
    const existing = input.existing || {};
    const preferences: PreferenceKeys = {
      aiFirst: existing.aiFirst ?? false,
      hideInternalJargon: existing.hideInternalJargon ?? false,
      portugueseReplies: existing.portugueseReplies ?? false,
      localWorkspaceAutonomy: existing.localWorkspaceAutonomy ?? false,
      proposalBeforeImpact: existing.proposalBeforeImpact ?? false,
    };

    for (const rule of KEYWORD_RULES) {
      const inferred = inferBoolean(input.text, rule.positive, rule.negative);
      if (inferred !== null) {
        preferences[rule.key] = inferred;
      }
    }

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
