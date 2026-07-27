import { ThinkingAdapter, ThinkingLevelConfig } from './types.js';

const REASONING_MODELS = ['o1', 'o1-mini', 'o1-pro', 'o3', 'o3-mini', 'o4-mini'];

const REASONING_EFFORT_MAP: Record<string, string> = {
  none: 'low',
  low: 'low',
  medium: 'medium',
  high: 'high',
};

const MODEL_MAX_BUDGET: Record<string, number> = {
  'o1': 100000,
  'o1-mini': 65536,
  'o1-pro': 100000,
  'o3': 100000,
  'o3-mini': 65536,
  'o4-mini': 100000,
};

export class OpenAIThinking implements ThinkingAdapter {
  readonly providerId = 'openai';

  detectThinkingCapability(modelId: string): boolean {
    const base = modelId.split('/').pop() ?? modelId;
    return REASONING_MODELS.some(m => base.startsWith(m));
  }

  getThinkingConfig(modelId: string, level: string): ThinkingLevelConfig {
    const effort = REASONING_EFFORT_MAP[level] ?? 'medium';
    return {
      level: level as ThinkingLevelConfig['level'],
      budgetTokens: level === 'none' ? undefined : this.getMaxThinkingBudget(modelId),
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
    return 65536;
  }
}
