import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';
const ALLOWED_SCOPES = ['global', 'session', 'task'] as const;
type AllowedScope = (typeof ALLOWED_SCOPES)[number];
const ALLOWED_ACTIONS_ON_EXCEED = ['warn', 'throttle', 'block'] as const;
type AllowedActionOnExceed = (typeof ALLOWED_ACTIONS_ON_EXCEED)[number];

export interface BudgetRule {
  id: string;
  name: string;
  scope: AllowedScope;
  limit_tokens: number;
  limit_cost_usd: number;
  alert_threshold: number;
  action_on_exceed: AllowedActionOnExceed;
  period: 'hourly' | 'daily' | 'monthly';
  enabled: boolean;
}

export interface UsageRecord {
  timestamp: number;
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
      action_on_exceed: {
        type: 'string',
        description: "Action when budget exceeded: 'warn', 'throttle', 'block'.",
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;
  private db: any = null;
  private dbInitPromise: Promise<any> | null = null;

  constructor(options?: { storageDir?: string }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'token-budget');
  }

  private validateScope(scope: string): scope is AllowedScope {
    return (ALLOWED_SCOPES as readonly string[]).includes(scope);
  }

  private async getDb(): Promise<any> {
    if (this.db) return this.db;
    if (this.dbInitPromise) return this.dbInitPromise;

    this.dbInitPromise = this.initDb();
    this.db = await this.dbInitPromise;
    this.dbInitPromise = null;
    return this.db;
  }

  private async initDb(): Promise<any> {
    const dbPath = path.join(this.storageDir, 'zavorth.db');
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    let sqlite3: any;
    try {
      sqlite3 = await import('better-sqlite3');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Erro: driver SQLite real better-sqlite3 indisponivel. Instale as dependencias nativas antes de executar zavorth_token_budget. Detalhe: ${message}`
      );
    }

    const db = sqlite3.default(dbPath);

    // Initialize tables
    db.prepare(`
      CREATE TABLE IF NOT EXISTS token_budgets (
        id TEXT PRIMARY KEY,
        name TEXT,
        scope TEXT,
        limit_tokens INTEGER,
        limit_cost_usd REAL,
        alert_threshold REAL,
        action_on_exceed TEXT,
        period TEXT,
        enabled INTEGER
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS token_usage_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER,
        scope TEXT,
        model TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cost_usd REAL,
        task_type TEXT
      )
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_usage_timestamp_scope
      ON token_usage_records(timestamp, scope)
    `).run();

    // Check if token_budgets is empty
    const countResult = db.prepare('SELECT COUNT(*) as count FROM token_budgets').get() as { count: number } | undefined;
    if (!countResult || countResult.count === 0) {
      const insert = db.prepare(`
        INSERT INTO token_budgets (id, name, scope, limit_tokens, limit_cost_usd, alert_threshold, action_on_exceed, period, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const defaults = [
        ['BUDGET-001', 'Global Daily Limit', 'global', 1000000, 10.0, 0.8, 'warn', 'daily', 1],
        ['BUDGET-002', 'Session Limit', 'session', 100000, 1.0, 0.8, 'warn', 'daily', 1],
        ['BUDGET-003', 'Task Limit', 'task', 50000, 0.5, 0.9, 'throttle', 'daily', 1],
        ['BUDGET-004', 'Monthly Cap', 'global', 30000000, 300.0, 0.7, 'warn', 'monthly', 1],
      ];
      const insertAll = db.transaction(() => {
        for (const row of defaults) {
          insert.run(...row);
        }
      });
      insertAll();
    }

    return db;
  }

  public async cleanup(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    try {
      switch (action) {
        case 'check':
          return await this.checkBudget(args);
        case 'record':
          return await this.recordUsage(args);
        case 'status':
          return await this.getStatus(args);
        case 'set_budget':
          return await this.setBudget(args);
        case 'list_budgets':
          return await this.listBudgets();
        case 'reset':
          return await this.resetUsage(args);
        case 'optimize':
          return await this.optimizeSuggestion();
        case 'report':
          return await this.generateReport();
        default:
          return `Error: action "${action}" is invalid.`;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `Error executing ${action}: ${message}`;
    }
  }

  private async checkBudget(args: Record<string, unknown>): Promise<string> {
    const scope = String(args.scope || 'global');
    if (!this.validateScope(scope)) {
      return `Error: invalid scope "${scope}". Allowed values: ${ALLOWED_SCOPES.join(', ')}.`;
    }
    const inputTokens = typeof args.input_tokens === 'number' ? args.input_tokens : 0;
    const outputTokens = typeof args.output_tokens === 'number' ? args.output_tokens : 0;
    const totalTokens = inputTokens + outputTokens;
    const cost = typeof args.cost_usd === 'number' ? args.cost_usd : 0;

    const db = await this.getDb();
    const applicable = db.prepare('SELECT * FROM token_budgets WHERE enabled = 1 AND scope = ?').all(scope) as any[];
    if (applicable.length === 0) return `No budgets configured for scope "${scope}".`;

    const results: string[] = [`Budget check for ${scope} (${totalTokens} tokens, $${cost.toFixed(4)}):`];

    for (const budget of applicable) {
      const periodUsage = this.getPeriodUsage(db, budget);
      const limit_tokens = Number(budget.limit_tokens);
      const limit_cost_usd = Number(budget.limit_cost_usd);
      const alert_threshold = Number(budget.alert_threshold);

      const tokenPercent = limit_tokens > 0 ? (periodUsage.tokens + totalTokens) / limit_tokens : 0;
      const costPercent = limit_cost_usd > 0 ? (periodUsage.cost + cost) / limit_cost_usd : 0;
      const maxPercent = Math.max(tokenPercent, costPercent);

      const status = maxPercent >= 1 ? '🚫 EXCEEDED' : maxPercent >= alert_threshold ? '⚠️ WARNING' : '✅ OK';
      results.push(
        `  ${status} ${budget.name}: ${(tokenPercent * 100).toFixed(1)}% tokens, ${(costPercent * 100).toFixed(1)}% cost`
      );

      if (maxPercent >= 1 && budget.action_on_exceed === 'block') {
        throw new Error('Budget Exceeded');
      }
    }

    return results.join('\n');
  }

  private async recordUsage(args: Record<string, unknown>): Promise<string> {
    const model = String(args.model || 'unknown');
    let inputTokens = typeof args.input_tokens === 'number' ? args.input_tokens : 0;
    let outputTokens = typeof args.output_tokens === 'number' ? args.output_tokens : 0;
    let cost = typeof args.cost_usd === 'number' ? args.cost_usd : 0;
    const scope = String(args.scope || 'global');
    const taskType = String(args.task_type || 'general');

    if (!Number.isFinite(inputTokens) || inputTokens < 0) inputTokens = 0;
    if (!Number.isFinite(outputTokens) || outputTokens < 0) outputTokens = 0;
    if (!Number.isFinite(cost) || cost < 0) cost = 0;

    const timestamp = Date.now();

    const db = await this.getDb();
    db.prepare(`
      INSERT INTO token_usage_records (timestamp, scope, model, input_tokens, output_tokens, cost_usd, task_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(timestamp, scope, model, inputTokens, outputTokens, cost, taskType);

    return `Usage recorded: ${inputTokens + outputTokens} tokens ($${cost.toFixed(4)}) via ${model}`;
  }

  private async getStatus(args: Record<string, unknown>): Promise<string> {
    const scope = String(args.scope || 'global');
    if (!this.validateScope(scope)) {
      return `Error: invalid scope "${scope}". Allowed values: ${ALLOWED_SCOPES.join(', ')}.`;
    }
    const db = await this.getDb();
    const budgets = db.prepare('SELECT * FROM token_budgets WHERE enabled = 1 AND scope = ?').all(scope) as any[];
    if (budgets.length === 0) return `No active budget for scope "${scope}".`;

    const lines: string[] = [`Budget Status (${scope}):`];
    for (const budget of budgets) {
      const usage = this.getPeriodUsage(db, budget);
      const limit_tokens = Number(budget.limit_tokens);
      const limit_cost_usd = Number(budget.limit_cost_usd);
      const alert_threshold = Number(budget.alert_threshold);

      const tokenPercent = limit_tokens > 0 ? (usage.tokens / limit_tokens) * 100 : 0;
      const costPercent = limit_cost_usd > 0 ? (usage.cost / limit_cost_usd) * 100 : 0;

      lines.push(
        `  ${budget.name} [${budget.id}]:`,
        `    Tokens: ${usage.tokens}/${limit_tokens} (${tokenPercent.toFixed(1)}%)`,
        `    Cost: $${usage.cost.toFixed(4)}/$${limit_cost_usd} (${costPercent.toFixed(1)}%)`,
        `    Alert at: ${(alert_threshold * 100).toFixed(0)}%`,
        `    Action on exceed: ${budget.action_on_exceed}`,
        `    Period: ${budget.period}`,
      );
    }

    return lines.join('\n');
  }

  private async setBudget(args: Record<string, unknown>): Promise<string> {
    const scope = String(args.scope || 'global');
    if (!this.validateScope(scope)) {
      return `Error: invalid scope "${scope}". Allowed values: ${ALLOWED_SCOPES.join(', ')}.`;
    }

    let actionOnExceed: AllowedActionOnExceed = 'warn';
    if (typeof args.action_on_exceed === 'string') {
      if (!(ALLOWED_ACTIONS_ON_EXCEED as readonly string[]).includes(args.action_on_exceed)) {
        return `Error: invalid action_on_exceed "${args.action_on_exceed}". Allowed values: ${ALLOWED_ACTIONS_ON_EXCEED.join(', ')}.`;
      }
      actionOnExceed = args.action_on_exceed as AllowedActionOnExceed;
    }

    const db = await this.getDb();
    const existing = db.prepare('SELECT * FROM token_budgets WHERE scope = ? LIMIT 1').get(scope) as any;

    if (existing) {
      let limit_tokens = existing.limit_tokens;
      let limit_cost_usd = existing.limit_cost_usd;
      let alert_threshold = existing.alert_threshold;
      let period = existing.period;

      if (typeof args.limit_tokens === 'number') limit_tokens = args.limit_tokens;
      if (typeof args.limit_cost_usd === 'number') limit_cost_usd = args.limit_cost_usd;
      if (typeof args.alert_threshold === 'number') alert_threshold = args.alert_threshold;
      if (args.period) period = String(args.period);

      db.prepare(`
        UPDATE token_budgets
        SET limit_tokens = ?, limit_cost_usd = ?, alert_threshold = ?, period = ?, action_on_exceed = ?
        WHERE id = ?
      `).run(limit_tokens, limit_cost_usd, alert_threshold, period, actionOnExceed, existing.id);

      return `Budget "${existing.name}" updated.`;
    }

    const maxRow = db.prepare("SELECT MAX(CAST(SUBSTR(id, 9) AS INTEGER)) as maxId FROM token_budgets").get() as { maxId: number | null } | undefined;
    const nextIdNum = (maxRow?.maxId || 0) + 1;
    const budgetId = `BUDGET-${String(nextIdNum).padStart(3, '0')}`;
    const name = `${scope} budget`;
    const limit_tokens = typeof args.limit_tokens === 'number' ? args.limit_tokens : 100000;
    const limit_cost_usd = typeof args.limit_cost_usd === 'number' ? args.limit_cost_usd : 1.0;
    const alert_threshold = typeof args.alert_threshold === 'number' ? args.alert_threshold : 0.8;
    const period = typeof args.period === 'string' ? args.period : 'daily';
    const enabled = 1;

    db.prepare(`
      INSERT INTO token_budgets (id, name, scope, limit_tokens, limit_cost_usd, alert_threshold, action_on_exceed, period, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(budgetId, name, scope, limit_tokens, limit_cost_usd, alert_threshold, actionOnExceed, period, enabled);

    return `Budget "${name}" created for scope "${scope}".`;
  }

  private async listBudgets(): Promise<string> {
    const db = await this.getDb();
    const budgets = db.prepare('SELECT * FROM token_budgets').all() as any[];
    const lines: string[] = ['Token Budgets:'];
    for (const b of budgets) {
      const status = b.enabled === 1 ? '✅' : '⏸️';
      lines.push(
        `  ${status} ${b.id}: ${b.name} [${b.scope}] limit:${b.limit_tokens} tokens/$${b.limit_cost_usd} per ${b.period}`
      );
    }
    return lines.join('\n');
  }

  private async resetUsage(args: Record<string, unknown>): Promise<string> {
    const scope = String(args.scope || 'global');
    if (!this.validateScope(scope)) {
      return `Error: invalid scope "${scope}". Allowed values: ${ALLOWED_SCOPES.join(', ')}.`;
    }
    const db = await this.getDb();
    const result = db.prepare('DELETE FROM token_usage_records WHERE scope = ?').run(scope);
    return `Reset ${result.changes} usage records for scope "${scope}".`;
  }

  private async optimizeSuggestion(): Promise<string> {
    const db = await this.getDb();
    const suggestions: string[] = ['Token Optimization Suggestions:'];

    const sorted = db.prepare(`
      SELECT
        model,
        SUM(input_tokens + output_tokens) as tokens,
        SUM(cost_usd) as cost,
        COUNT(*) as count
      FROM token_usage_records
      GROUP BY model
      ORDER BY cost DESC
      LIMIT 5
    `).all() as any[];

    if (sorted.length > 0) {
      suggestions.push('', '  Top models by cost:');
      for (const stats of sorted) {
        const tokens = Number(stats.tokens || 0);
        const cost = Number(stats.cost || 0);
        const count = Number(stats.count || 0);
        suggestions.push(`    ${stats.model}: ${tokens} tokens, $${cost.toFixed(4)}, ${count} calls`);
      }
    }

    suggestions.push('', '  Tips:');
    suggestions.push('    - Use smaller models for simple tasks (chat, summarize)');
    suggestions.push('    - Use context compression to reduce input tokens');
    suggestions.push('    - Cache frequent prompts to avoid reprocessing');
    suggestions.push('    - Set per-task budgets to prevent runaway costs');

    return suggestions.join('\n');
  }

  private async generateReport(): Promise<string> {
    const db = await this.getDb();
    const summary = db.prepare(`
      SELECT
        SUM(input_tokens + output_tokens) as total_tokens,
        SUM(cost_usd) as total_cost,
        COUNT(*) as total_calls
      FROM token_usage_records
    `).get() as { total_tokens: number | null; total_cost: number | null; total_calls: number } | undefined;

    const totalTokens = summary?.total_tokens || 0;
    const totalCost = summary?.total_cost || 0;
    const totalCalls = summary?.total_calls || 0;

    const byModel = db.prepare(`
      SELECT
        model,
        SUM(input_tokens + output_tokens) as tokens,
        SUM(cost_usd) as cost,
        COUNT(*) as calls
      FROM token_usage_records
      GROUP BY model
      ORDER BY cost DESC
    `).all() as any[];

    const byTask = db.prepare(`
      SELECT
        task_type,
        SUM(input_tokens + output_tokens) as tokens,
        COUNT(*) as calls
      FROM token_usage_records
      GROUP BY task_type
      ORDER BY tokens DESC
    `).all() as any[];

    const lines: string[] = [
      'Token Budget Report:',
      `  Total tokens: ${totalTokens}`,
      `  Total cost: $${totalCost.toFixed(4)}`,
      `  Total calls: ${totalCalls}`,
      '',
      'By Model:',
    ];
    for (const row of byModel) {
      const tokens = Number(row.tokens || 0);
      const cost = Number(row.cost || 0);
      const calls = Number(row.calls || 0);
      lines.push(`  ${row.model}: ${tokens} tokens, $${cost.toFixed(4)}, ${calls} calls`);
    }

    lines.push('', 'By Task Type:');
    for (const row of byTask) {
      const tokens = Number(row.tokens || 0);
      const calls = Number(row.calls || 0);
      lines.push(`  ${row.task_type}: ${tokens} tokens, ${calls} calls`);
    }

    return lines.join('\n');
  }

  private getPeriodUsage(db: any, budget: any): { tokens: number; cost: number } {
    const now = Date.now();
    let cutoffMs: number;

    switch (budget.period) {
      case 'hourly':
        cutoffMs = now - 3600000;
        break;
      case 'daily':
        cutoffMs = now - 86400000;
        break;
      case 'monthly': {
        const d = new Date(now);
        cutoffMs = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        break;
      }
      default:
        cutoffMs = now - 86400000;
    }

    let row: any;
    if (budget.scope === 'global') {
      row = db.prepare(`
        SELECT
          SUM(input_tokens + output_tokens) as total_tokens,
          SUM(cost_usd) as total_cost
        FROM token_usage_records
        WHERE timestamp >= ?
      `).get(cutoffMs);
    } else {
      row = db.prepare(`
        SELECT
          SUM(input_tokens + output_tokens) as total_tokens,
          SUM(cost_usd) as total_cost
        FROM token_usage_records
        WHERE scope = ? AND timestamp >= ?
      `).get(budget.scope, cutoffMs);
    }

    return {
      tokens: row?.total_tokens || 0,
      cost: row?.total_cost || 0,
    };
  }

  public close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // Ignore
      }
      this.db = null;
    }
  }
}
