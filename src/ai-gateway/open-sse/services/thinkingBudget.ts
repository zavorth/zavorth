export type ThinkingMode = "none" | "budget" | "effort";

export interface ThinkingBudgetConfig {
  mode: ThinkingMode;
  budgetTokens?: number;
  effort?: "low" | "medium" | "high";
}

let thinkingBudgetConfig: ThinkingBudgetConfig = { mode: "none" };

export function getThinkingBudgetConfig(): ThinkingBudgetConfig {
  return thinkingBudgetConfig;
}

export function setThinkingBudgetConfig(config: ThinkingBudgetConfig): void {
  thinkingBudgetConfig = config;
}

export function applyThinkingBudget(
  body: Record<string, unknown>
): Record<string, unknown> {
  if (thinkingBudgetConfig.mode === "none") return body;
  const result: Record<string, unknown> = { ...body };
  if (thinkingBudgetConfig.mode === "effort") {
    result.reasoning_effort = thinkingBudgetConfig.effort ?? "medium";
  }
  if (thinkingBudgetConfig.mode === "budget" && thinkingBudgetConfig.budgetTokens) {
    result.thinking = { budget_tokens: thinkingBudgetConfig.budgetTokens };
  }
  return result;
}
