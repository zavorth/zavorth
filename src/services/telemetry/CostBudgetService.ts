import { config } from '../../config/index.js';

type CostBudgetEvaluation = {
  estimatedCostUsd: number;
  limitUsd: number;
  withinBudget: boolean;
};

export class CostBudgetService {
  constructor(
    private readonly defaultBudgetUsd: number = config.graphCostBudgetUsd,
    private readonly estimatedCostPer1kTokensUsd: number = config.graphEstimatedCostPer1kTokensUsd,
  ) {}

  public evaluateTokens(tokenCount: number, limitUsd = this.defaultBudgetUsd): CostBudgetEvaluation {
    const estimatedCostUsd = Number(
      ((Math.max(0, tokenCount) / 1000) * this.estimatedCostPer1kTokensUsd).toFixed(6),
    );

    return {
      estimatedCostUsd,
      limitUsd,
      withinBudget: estimatedCostUsd <= limitUsd,
    };
  }
}
