import { ThinkingAdapter, ThinkingLevelConfig } from './types.js';

const THINKING_MODELS = [
  'claude-3-5-sonnet',
  'claude-3-5-haiku',
  'claude-3-opus',
  'claude-sonnet-4',
  'claude-opus-4',
];

const BUDGET_MAP: Record<string, number> = {
  none: 0,
  low: 2048,
  medium: 8192,
  high: 32768,
  xhigh: 128000,
};

const MODEL_MAX_BUDGET: Record<string, number> = {
  'claude-3-opus': 32768,
  'claude-3-5-sonnet': 128000,
  'claude-3-5-haiku': 128000,
  'claude-sonnet-4': 128000,
  'claude-opus-4': 128000,
};

export class AnthropicThinking implements ThinkingAdapter {
  readonly providerId = 'anthropic';

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
    return ['none', 'low', 'medium', 'high', 'xhigh'];
  }

  getMaxThinkingBudget(modelId: string): number {
    const base = modelId.split('/').pop() ?? modelId;
    for (const [key, budget] of Object.entries(MODEL_MAX_BUDGET)) {
      if (base.startsWith(key)) return budget;
    }
    return 32768;
  }
}
