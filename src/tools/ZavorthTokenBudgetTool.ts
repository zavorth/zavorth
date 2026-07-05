import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export interface BudgetRule {
  id: string;
  name: string;
  scope: 'global' | 'session' | 'task';
  limit_tokens: number;
  limit_cost_usd: number;
  alert_threshold: number;
  action_on_exceed: 'warn' | 'throttle' | 'block';
  period: 'hourly' | 'daily' | 'monthly';
  enabled: boolean;
}

export interface UsageRecord {
  timestamp: string;
  scope: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  task_type: string;
}

export class ZavorthTokenBudgetTool extends BaseTool {
  public readonly name = 'zavorth_token_budget';

  public readonly description =
    'Token Budget Manager — track, limit, and optimize token usage per session/task with alerts and throttling.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'check', 'record', 'status', 'set_budget', 'list_budgets', 'reset', 'optimize', 'report'.",
      },
      model: {
        type: 'string',
        description: 'Model name for the usage record.',
      },
      input_tokens: {
        type: 'number',
        description: 'Number of input tokens.',
      },
      output_tokens: {
        type: 'number',
        description: 'Number of output tokens.',
      },
      cost_usd: {
        type: 'number',
        description: 'Cost in USD.',
      },
      task_type: {
        type: 'string',
        description: 'Task type for categorization.',
      },
      scope: {
        type: 'string',
        description: "Budget scope: 'global', 'session', 'task'.",
      },
      limit_tokens: {
        type: 'number',
        description: 'Token limit.',
      },
      limit_cost_usd: {
        type: 'number',
        description: 'Cost limit in USD.',
      },
      period: {
        type: 'string',
        description: "Period: 'hourly', 'daily', 'monthly'.",
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;
  private budgets: BudgetRule[] = [];
  private usage: UsageRecord[] = [];

  constructor(options?: { storageDir?: string }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'token-budget');
    this.ensureDir();
    this.loadData();
    this.initDefaults();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
  }

  private loadData(): void {
    const budgetsPath = path.join(this.storageDir, 'budgets.json');
    const usagePath = path.join(this.storageDir, 'usage.json');
    try { if (fs.existsSync(budgetsPath)) this.budgets = JSON.parse(fs.readFileSync(budgetsPath, 'utf-8')); } catch (error) { /* ignore */ logger.warn('[Zavorth Token Budget] JSON parse failed', error); }
    try { if (fs.existsSync(usagePath)) this.usage = JSON.parse(fs.readFileSync(usagePath, 'utf-8')); } catch (error) { /* ignore */ logger.warn('[Zavorth Token Budget] JSON parse failed', error); }
  }

  private saveData(): void {
    fs.writeFileSync(path.join(this.storageDir, 'budgets.json'), JSON.stringify(this.budgets, null, 2), 'utf-8');
    fs.writeFileSync(path.join(this.storageDir, 'usage.json'), JSON.stringify(this.usage.slice(-10000), null, 2), 'utf-8');
  }

  private initDefaults(): void {
    if (this.budgets.length > 0) return;
    this.budgets = [
      { id: 'BUDGET-001', name: 'Global Daily Limit', scope: 'global', limit_tokens: 1000000, limit_cost_usd: 10, alert_threshold: 0.8, action_on_exceed: 'warn', period: 'daily', enabled: true },
      { id: 'BUDGET-002', name: 'Session Limit', scope: 'session', limit_tokens: 100000, limit_cost_usd: 1, alert_threshold: 0.8, action_on_exceed: 'warn', period: 'daily', enabled: true },
      { id: 'BUDGET-003', name: 'Task Limit', scope: 'task', limit_tokens: 50000, limit_cost_usd: 0.5, alert_threshold: 0.9, action_on_exceed: 'throttle', period: 'daily', enabled: true },
      { id: 'BUDGET-004', name: 'Monthly Cap', scope: 'global', limit_tokens: 30000000, limit_cost_usd: 300, alert_threshold: 0.7, action_on_exceed: 'warn', period: 'monthly', enabled: true },
    ];
    this.saveData();
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'check': return this.checkBudget(args);
      case 'record': return this.recordUsage(args);
      case 'status': return this.getStatus(args);
      case 'set_budget': return this.setBudget(args);
      case 'list_budgets': return this.listBudgets();
      case 'reset': return this.resetUsage(args);
      case 'optimize': return this.optimizeSuggestion();
      case 'report': return this.generateReport();
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private checkBudget(args: Record<string, unknown>): string {
    const scope = String(args.scope || 'global');
    const inputTokens = typeof args.input_tokens === 'number' ? args.input_tokens : 0;
    const outputTokens = typeof args.output_tokens === 'number' ? args.output_tokens : 0;
    const totalTokens = inputTokens + outputTokens;
    const cost = typeof args.cost_usd === 'number' ? args.cost_usd : 0;

    const applicable = this.budgets.filter((b) => b.enabled && b.scope === scope);
    if (applicable.length === 0) return `No budgets configured for scope "${scope}".`;

    const results: string[] = [`Budget check for ${scope} (${totalTokens} tokens, $${cost.toFixed(4)}):`];

    for (const budget of applicable) {
      const periodUsage = this.getPeriodUsage(budget);
      const tokenPercent = budget.limit_tokens > 0 ? (periodUsage.tokens + totalTokens) / budget.limit_tokens : 0;
      const costPercent = budget.limit_cost_usd > 0 ? (periodUsage.cost + cost) / budget.limit_cost_usd : 0;
      const maxPercent = Math.max(tokenPercent, costPercent);

      const status = maxPercent >= 1 ? '🚫 EXCEEDED' : maxPercent >= budget.alert_threshold ? '⚠️ WARNING' : '✅ OK';
      results.push(`  ${status} ${budget.name}: ${(tokenPercent * 100).toFixed(1)}% tokens, ${(costPercent * 100).toFixed(1)}% cost`);

      if (maxPercent >= 1 && budget.action_on_exceed === 'block') {
        return `🚫 BLOCKED by "${budget.name}". Budget exceeded.`;
      }
    }

    return results.join('\n');
  }

  private recordUsage(args: Record<string, unknown>): string {
    const model = String(args.model || 'unknown');
    const inputTokens = typeof args.input_tokens === 'number' ? args.input_tokens : 0;
    const outputTokens = typeof args.output_tokens === 'number' ? args.output_tokens : 0;
    const cost = typeof args.cost_usd === 'number' ? args.cost_usd : 0;

    this.usage.push({
      timestamp: new Date().toISOString(),
      scope: String(args.scope || 'global'),
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: cost,
      task_type: String(args.task_type || 'general'),
    });

    this.saveData();
    return `Usage recorded: ${inputTokens + outputTokens} tokens ($${cost.toFixed(4)}) via ${model}`;
  }

  private getStatus(args: Record<string, unknown>): string {
    const scope = String(args.scope || 'global');
    const budget = this.budgets.find((b) => b.enabled && b.scope === scope);
    if (!budget) return `No active budget for scope "${scope}".`;

    const usage = this.getPeriodUsage(budget);
    const tokenPercent = budget.limit_tokens > 0 ? (usage.tokens / budget.limit_tokens) * 100 : 0;
    const costPercent = budget.limit_cost_usd > 0 ? (usage.cost / budget.limit_cost_usd) * 100 : 0;

    return [
      `Budget Status (${scope}):`,
      `  Tokens: ${usage.tokens}/${budget.limit_tokens} (${tokenPercent.toFixed(1)}%)`,
      `  Cost: $${usage.cost.toFixed(4)}/$${budget.limit_cost_usd} (${costPercent.toFixed(1)}%)`,
      `  Alert at: ${(budget.alert_threshold * 100).toFixed(0)}%`,
      `  Action on exceed: ${budget.action_on_exceed}`,
      `  Period: ${budget.period}`,
    ].join('\n');
  }

  private setBudget(args: Record<string, unknown>): string {
    const scope = String(args.scope || 'global');
    const existing = this.budgets.find((b) => b.scope === scope);

    if (existing) {
      if (typeof args.limit_tokens === 'number') existing.limit_tokens = args.limit_tokens;
      if (typeof args.limit_cost_usd === 'number') existing.limit_cost_usd = args.limit_cost_usd;
      if (typeof args.alert_threshold === 'number') existing.alert_threshold = args.alert_threshold;
      if (args.period) existing.period = String(args.period) as BudgetRule['period'];
      this.saveData();
      return `Budget "${existing.name}" updated.`;
    }

    const budget: BudgetRule = {
      id: `BUDGET-${String(this.budgets.length + 1).padStart(3, '0')}`,
      name: `${scope} budget`,
      scope: scope as BudgetRule['scope'],
      limit_tokens: typeof args.limit_tokens === 'number' ? args.limit_tokens : 100000,
      limit_cost_usd: typeof args.limit_cost_usd === 'number' ? args.limit_cost_usd : 1,
      alert_threshold: typeof args.alert_threshold === 'number' ? args.alert_threshold : 0.8,
      action_on_exceed: 'warn',
      period: (typeof args.period === 'string' ? args.period : 'daily') as BudgetRule['period'],
      enabled: true,
    };

    this.budgets.push(budget);
    this.saveData();
    return `Budget "${budget.name}" created for scope "${scope}".`;
  }

  private listBudgets(): string {
    const lines: string[] = ['Token Budgets:'];
    for (const b of this.budgets) {
      const status = b.enabled ? '✅' : '⏸️';
      lines.push(`  ${status} ${b.id}: ${b.name} [${b.scope}] limit:${b.limit_tokens} tokens/$${b.limit_cost_usd} per ${b.period}`);
    }
    return lines.join('\n');
  }

  private resetUsage(args: Record<string, unknown>): string {
    const count = this.usage.length;
    this.usage = [];
    this.saveData();
    return `Reset ${count} usage records.`;
  }

  private optimizeSuggestion(): string {
    const suggestions: string[] = ['Token Optimization Suggestions:'];

    const modelUsage: Record<string, { count: number; tokens: number; cost: number }> = {};
    for (const u of this.usage) {
      if (!modelUsage[u.model]) modelUsage[u.model] = { count: 0, tokens: 0, cost: 0 };
      modelUsage[u.model].count++;
      modelUsage[u.model].tokens += u.input_tokens + u.output_tokens;
      modelUsage[u.model].cost += u.cost_usd;
    }

    const sorted = Object.entries(modelUsage).sort((a, b) => b[1].cost - a[1].cost);
    if (sorted.length > 0) {
      suggestions.push('', '  Top models by cost:');
      for (const [model, stats] of sorted.slice(0, 5)) {
        suggestions.push(`    ${model}: ${stats.tokens} tokens, $${stats.cost.toFixed(4)}, ${stats.count} calls`);
      }
    }

    suggestions.push('', '  Tips:');
    suggestions.push('    - Use smaller models for simple tasks (chat, summarize)');
    suggestions.push('    - Use context compression to reduce input tokens');
    suggestions.push('    - Cache frequent prompts to avoid reprocessing');
    suggestions.push('    - Set per-task budgets to prevent runaway costs');

    return suggestions.join('\n');
  }

  private generateReport(): string {
    const totalTokens = this.usage.reduce((sum, u) => sum + u.input_tokens + u.output_tokens, 0);
    const totalCost = this.usage.reduce((sum, u) => sum + u.cost_usd, 0);
    const byModel: Record<string, { tokens: number; cost: number; calls: number }> = {};
    const byTask: Record<string, { tokens: number; calls: number }> = {};

    for (const u of this.usage) {
      if (!byModel[u.model]) byModel[u.model] = { tokens: 0, cost: 0, calls: 0 };
      byModel[u.model].tokens += u.input_tokens + u.output_tokens;
      byModel[u.model].cost += u.cost_usd;
      byModel[u.model].calls++;

      if (!byTask[u.task_type]) byTask[u.task_type] = { tokens: 0, calls: 0 };
      byTask[u.task_type].tokens += u.input_tokens + u.output_tokens;
      byTask[u.task_type].calls++;
    }

    const lines: string[] = [
      'Token Budget Report:',
      `  Total tokens: ${totalTokens}`,
      `  Total cost: $${totalCost.toFixed(4)}`,
      `  Total calls: ${this.usage.length}`,
      '',
      'By Model:',
    ];
    for (const [model, stats] of Object.entries(byModel).sort((a, b) => b[1].cost - a[1].cost)) {
      lines.push(`  ${model}: ${stats.tokens} tokens, $${stats.cost.toFixed(4)}, ${stats.calls} calls`);
    }

    lines.push('', 'By Task Type:');
    for (const [task, stats] of Object.entries(byTask).sort((a, b) => b[1].tokens - a[1].tokens)) {
      lines.push(`  ${task}: ${stats.tokens} tokens, ${stats.calls} calls`);
    }

    return lines.join('\n');
  }

  private getPeriodUsage(budget: BudgetRule): { tokens: number; cost: number } {
    const now = Date.now();
    let cutoff: number;

    switch (budget.period) {
      case 'hourly': cutoff = now - 3600000; break;
      case 'daily': cutoff = now - 86400000; break;
      case 'monthly': cutoff = now - 30 * 86400000; break;
      default: cutoff = now - 86400000;
    }

    let tokens = 0;
    let cost = 0;
    for (const u of this.usage) {
      if (new Date(u.timestamp).getTime() >= cutoff) {
        tokens += u.input_tokens + u.output_tokens;
        cost += u.cost_usd;
      }
    }

    return { tokens, cost };
  }
}
