import { ThinkingAdapter, ThinkingLevelConfig } from './types.js';

const THINKING_MODELS = ['deepseek-r1', 'deepseek-reasoner'];

const MODEL_MAX_BUDGET: Record<string, number> = {
  'deepseek-r1': 65536,
  'deepseek-reasoner': 65536,
};

export class DeepSeekThinking implements ThinkingAdapter {
  readonly providerId = 'deepseek';

  detectThinkingCapability(modelId: string): boolean {
    const base = modelId.split('/').pop() ?? modelId;
    return THINKING_MODELS.some(m => base.startsWith(m));
  }

  getThinkingConfig(_modelId: string, level: string): ThinkingLevelConfig {
    const enabled = level !== 'none';
    return {
      level: level as ThinkingLevelConfig['level'],
      budgetTokens: undefined,
      enabled,
    };
  }

  getSupportedLevels(_modelId: string): string[] {
    return ['none', 'high'];
  }

  getMaxThinkingBudget(modelId: string): number {
    const base = modelId.split('/').pop() ?? modelId;
    for (const [key, budget] of Object.entries(MODEL_MAX_BUDGET)) {
      if (base.startsWith(key)) return budget;
    }
    return 65536;
  }
}
