import { ThinkingAdapter, ThinkingLevelConfig } from './types.js';

const THINKING_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
];

const BUDGET_MAP: Record<string, number> = {
  none: 0,
  low: 1024,
  medium: 8192,
  high: 32768,
};

const MODEL_MAX_BUDGET: Record<string, number> = {
  'gemini-2.5-flash': 32768,
  'gemini-2.5-pro': 32768,
  'gemini-2.0-flash': 16384,
};

export class GoogleThinking implements ThinkingAdapter {
  readonly providerId = 'google';

  detectThinkingCapability(modelId: string): boolean {
    const base = modelId.split('/').pop() ?? modelId;
    return THINKING_MODELS.some(m => base.startsWith(m));
  }

  getThinkingConfig(modelId: string, level: string): ThinkingLevelConfig {
    const maxBudget = this.getMaxThinkingBudget(modelId);
    const budget = Math.min(BUDGET_MAP[level] ?? 0, maxBudget);
    return {
      level: level as ThinkingLevelConfig['level'],
      budgetTokens: level === 'none' ? undefined : budget,
      enabled: level !== 'none',
    };
  }

  getSupportedLevels(_modelId: string): string[] {
    return ['none', 'low', 'medium', 'high'];
  }

  getMaxThinkingBudget(modelId: string): number {
    const base = modelId.split('/').pop() ?? modelId;
    for (const [key, budget] of Object.entries(MODEL_MAX_BUDGET)) {
      if (base.startsWith(key)) return budget;
    }
    return 16384;
  }
}
