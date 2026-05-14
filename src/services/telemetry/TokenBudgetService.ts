import { config } from '../../config/index.js';
import { TokenCounter } from '../../monitoring/TokenCounter.js';

type BudgetEvaluation = {
  used: number;
  limit: number;
  withinBudget: boolean;
};

export class TokenBudgetService {
  constructor(private readonly defaultLimit: number = config.graphTokenBudget) {}

  public evaluateText(text: string, limit = this.defaultLimit): BudgetEvaluation {
    const used = TokenCounter.countTokens(String(text || ''));
    return {
      used,
      limit,
      withinBudget: used <= limit,
    };
  }
}
