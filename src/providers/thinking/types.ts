export interface ThinkingLevelConfig {
  level: 'none' | 'low' | 'medium' | 'high' | 'xhigh';
  budgetTokens?: number;
  enabled?: boolean;
}

export interface ThinkingAdapter {
  readonly providerId: string;
  detectThinkingCapability(modelId: string): boolean;
  getThinkingConfig(modelId: string, level: string): ThinkingLevelConfig;
  getSupportedLevels(modelId: string): string[];
  getMaxThinkingBudget(modelId: string): number;
}
