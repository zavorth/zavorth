import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface CostEntry {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost: number;
  task_type: string;
}

export class CostAnalyticsService {
  private readonly storageDir: string;
  private entries: CostEntry[] = [];
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'cost-analytics');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    this.loadEntries();
  }

  private loadEntries(): void {
    const p = path.join(this.storageDir, 'entries.json');
    if (!fs.existsSync(p)) return;
    try {
      this.entries = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (error: any) { /* ignore */ logger.warn('[Cost Analytics] JSON parse failed', error); }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.dirty) {
        this.dirty = false;
        fs.writeFileSync(path.join(this.storageDir, 'entries.json'), JSON.stringify(this.entries, null, 2), 'utf-8');
      }
    }, 2000);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  public record(entry: Omit<CostEntry, 'id' | 'timestamp'>): string {
    const id = `cost_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.entries.push({ ...entry, id, timestamp: new Date().toISOString() });
    this.scheduleFlush();
    return `Cost recorded: $${entry.cost.toFixed(4)} for ${entry.provider}/${entry.model}`;
  }

  public getStats(): string {
    if (this.entries.length === 0) return 'No cost data recorded.';

    const totalCost = this.entries.reduce((s, e) => s + e.cost, 0);
    const avgCost = totalCost / this.entries.length;
    const maxCost = Math.max(...this.entries.map((e) => e.cost));

    return [
      'Cost Analytics:',
      `  Total cost: $${totalCost.toFixed(4)}`,
      `  Average per call: $${avgCost.toFixed(6)}`,
      `  Max single call: $${maxCost.toFixed(4)}`,
      `  Total entries: ${this.entries.length}`,
    ].join('\n');
  }

  public getCostByProvider(): string {
    const costs: Record<string, number> = {};
    for (const e of this.entries) costs[e.provider] = (costs[e.provider] || 0) + e.cost;
    const sorted = Object.entries(costs).sort((a, b) => b[1] - a[1]);
    return ['Cost by Provider:', ...sorted.map(([p, c]) => `  ${p}: $${c.toFixed(4)}`)].join('\n');
  }

  public getCostByModel(): string {
    const costs: Record<string, number> = {};
    for (const e of this.entries) {
      const key = `${e.provider}/${e.model}`;
      costs[key] = (costs[key] || 0) + e.cost;
    }
    const sorted = Object.entries(costs).sort((a, b) => b[1] - a[1]);
    return ['Cost by Model:', ...sorted.map(([m, c]) => `  ${m}: $${c.toFixed(4)}`)].join('\n');
  }

  public getCostByTaskType(): string {
    const costs: Record<string, number> = {};
    for (const e of this.entries) costs[e.task_type] = (costs[e.task_type] || 0) + e.cost;
    const sorted = Object.entries(costs).sort((a, b) => b[1] - a[1]);
    return ['Cost by Task Type:', ...sorted.map(([t, c]) => `  ${t}: $${c.toFixed(4)}`)].join('\n');
  }

  public getDailyCosts(): string {
    const daily: Record<string, number> = {};
    for (const e of this.entries) {
      const day = e.timestamp.slice(0, 10);
      daily[day] = (daily[day] || 0) + e.cost;
    }
    const days = Object.entries(daily).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7);
    return ['Daily Costs (last 7 days):', ...days.map(([d, c]) => `  ${d}: $${c.toFixed(4)}`)].join('\n');
  }
}
