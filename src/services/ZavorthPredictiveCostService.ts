import path from 'path';
import fs from 'fs';
import sqlite3 from 'better-sqlite3';
import { logger } from '../logger.js';

export interface CostPrediction {
  avgInputTokens: number;
  avgOutputTokens: number;
  avgCostUsd: number;
  recommendedModelId: string;
  historyCount: number;
}

const DEFAULT_PREDICTIONS: Record<string, { input: number; output: number; cost: number; model: string }> = {
  chat: { input: 500, output: 200, cost: 0.001, model: 'gpt-4o-mini' },
  conversation: { input: 500, output: 200, cost: 0.001, model: 'gpt-4o-mini' },
  code_generation: { input: 3000, output: 1000, cost: 0.05, model: 'claude-4' },
  code_review: { input: 4000, output: 1000, cost: 0.03, model: 'claude-4-sonnet' },
  reasoning: { input: 4000, output: 2000, cost: 0.10, model: 'gpt-4o' },
  research: { input: 10000, output: 4000, cost: 0.15, model: 'gemini-2.5-pro' },
  summarization: { input: 2000, output: 500, cost: 0.002, model: 'gemini-2.5-flash' },
};

export class ZavorthPredictiveCostService {
  private readonly dbPath: string;

  constructor(options?: { dbPath?: string }) {
    this.dbPath = options?.dbPath || path.join(process.cwd(), 'data', 'runtime', 'token-budget', 'zavorth.db');
  }

  /**
   * Predicts the cost and token usage for a task based on historical database records.
   */
  public predictCost(taskType: string): CostPrediction {
    const defaultVal = DEFAULT_PREDICTIONS[taskType] || { input: 2000, output: 800, cost: 0.01, model: 'gemini-2.5-flash' };
    
    if (!fs.existsSync(this.dbPath)) {
      return {
        avgInputTokens: defaultVal.input,
        avgOutputTokens: defaultVal.output,
        avgCostUsd: defaultVal.cost,
        recommendedModelId: defaultVal.model,
        historyCount: 0,
      };
    }

    try {
      const db = new sqlite3(this.dbPath, { readonly: true });
      const row = db.prepare(`
        SELECT 
          COUNT(*) as count,
          AVG(input_tokens) as avg_input,
          AVG(output_tokens) as avg_output,
          AVG(cost_usd) as avg_cost
        FROM token_usage_records
        WHERE task_type = ?
      `).get(taskType) as { count: number; avg_input: number | null; avg_output: number | null; avg_cost: number | null } | undefined;

      db.close();

      if (row && row.count > 0 && row.avg_input !== null) {
        const avgInput = Math.round(row.avg_input);
        const avgOutput = Math.round(row.avg_output || 0);
        const avgCost = row.avg_cost || 0.0;

        // Smart model recommendation based on historical cost
        let recommendedModelId = defaultVal.model;
        if (avgCost < 0.005) {
          recommendedModelId = 'gpt-4o-mini';
        } else if (avgCost > 0.05) {
          recommendedModelId = taskType === 'research' ? 'gemini-2.5-pro' : 'claude-4';
        } else {
          recommendedModelId = 'claude-4-sonnet';
        }

        return {
          avgInputTokens: avgInput,
          avgOutputTokens: avgOutput,
          avgCostUsd: avgCost,
          recommendedModelId,
          historyCount: row.count,
        };
      }
    } catch (dbError: unknown) {
      logger.warn(`[Predictive Cost] Error querying database: ${dbError}`);
    }

    return {
      avgInputTokens: defaultVal.input,
      avgOutputTokens: defaultVal.output,
      avgCostUsd: defaultVal.cost,
      recommendedModelId: defaultVal.model,
      historyCount: 0,
    };
  }
}
