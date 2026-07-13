/**
 * Cost savings dashboard — aggregates session model ledgers + background routing hints.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { SessionModelLedger } from './SessionModelRouteService.js';

export type CostSavingsDashboardSnapshot = {
  generatedAt: string;
  source: 'CostSavingsDashboardService';
  storageDir: string;
  sessionsScanned: number;
  totals: {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    estimatedSavingsUsd: number;
    backgroundRouteCalls: number;
  };
  byModel: Array<{
    modelKey: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  }>;
  backgroundRouteHint: string;
  narrative: string;
};

type Runtime = {
  storageDir?: string;
  now?: () => Date;
  frontierCostPer1kOut?: number;
};

export class CostSavingsDashboardService {
  private readonly storageDir: string;
  private readonly now: () => Date;
  private readonly frontierCostPer1kOut: number;

  public constructor(runtime: Runtime = {}) {
    this.storageDir = runtime.storageDir
      || path.join(process.cwd(), 'data', 'runtime', 'session-model-routes');
    this.now = runtime.now || (() => new Date());
    this.frontierCostPer1kOut = Number(runtime.frontierCostPer1kOut || process.env.ZAVORTH_FRONTIER_COST_PER_1K_OUT || 0.03) || 0.03;
  }

  public buildSnapshot(): CostSavingsDashboardSnapshot {
    const ledgers = this.loadLedgers();
    const byModelMap = new Map<string, {
      calls: number;
      inputTokens: number;
      outputTokens: number;
      estimatedCostUsd: number;
    }>();

    let calls = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let estimatedCostUsd = 0;
    let backgroundRouteCalls = 0;

    for (const ledger of ledgers) {
      for (const entry of ledger.usage || []) {
        if (String(entry.note || '').includes('cost-route:background')) {
          backgroundRouteCalls += 1;
        }
      }
      for (const [key, row] of Object.entries(ledger.totalsByModel || {})) {
        const current = byModelMap.get(key) || {
          calls: 0,
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostUsd: 0,
        };
        current.calls += row.calls || 0;
        current.inputTokens += row.inputTokens || 0;
        current.outputTokens += row.outputTokens || 0;
        current.estimatedCostUsd += row.estimatedCostUsd || 0;
        byModelMap.set(key, current);
        calls += row.calls || 0;
        inputTokens += row.inputTokens || 0;
        outputTokens += row.outputTokens || 0;
        estimatedCostUsd += row.estimatedCostUsd || 0;
      }
    }

    // Heuristic savings: if actual cost < frontier baseline for same output tokens
    const frontierBaseline = (outputTokens / 1000) * this.frontierCostPer1kOut;
    const estimatedSavingsUsd = Math.max(0, frontierBaseline - estimatedCostUsd);

    const byModel = Array.from(byModelMap.entries())
      .map(([modelKey, row]) => ({ modelKey, ...row }))
      .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd)
      .slice(0, 40);

    return {
      generatedAt: this.now().toISOString(),
      source: 'CostSavingsDashboardService',
      storageDir: this.storageDir,
      sessionsScanned: ledgers.length,
      totals: {
        calls,
        inputTokens,
        outputTokens,
        estimatedCostUsd,
        estimatedSavingsUsd,
        backgroundRouteCalls,
      },
      byModel,
      backgroundRouteHint:
        'Background routes pick the cheapest hop on YOUR stack (secondary model / fallbacks). '
        + 'Optional: ZAVORTH_BACKGROUND_MODEL if it matches a stack hop. Never invents off-stack vendors.',
      narrative: calls === 0
        ? 'No session model usage recorded yet. After chats, totals appear under data/runtime/session-model-routes/.'
        : `Tracked ${calls} call(s) across ${ledgers.length} session ledger(s)`
          + (backgroundRouteCalls ? ` (${backgroundRouteCalls} background cost-route)` : '')
          + `. Est. cost $${estimatedCostUsd.toFixed(4)}; est. savings vs frontier ~$${estimatedSavingsUsd.toFixed(4)}.`,
    };
  }

  private loadLedgers(): SessionModelLedger[] {
    if (!fs.existsSync(this.storageDir)) return [];
    const files = fs.readdirSync(this.storageDir).filter((f) => f.endsWith('.json'));
    const out: SessionModelLedger[] = [];
    for (const file of files.slice(0, 500)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(path.join(this.storageDir, file), 'utf8')) as SessionModelLedger;
        if (parsed && typeof parsed === 'object') out.push(parsed);
      } catch {
        // skip corrupt
      }
    }
    return out;
  }
}
