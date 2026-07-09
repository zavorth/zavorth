import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface UsageEntry {
  id: string;
  timestamp: string;
  tool: string;
  action: string;
  provider: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  success: boolean;
  user: string;
  cost_estimate: number;
}

export class UsageAnalyticsService {
  private readonly storageDir: string;
  private entries: UsageEntry[] = [];
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'usage-analytics');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    this.loadEntries();
  }

  private loadEntries(): void {
    const p = path.join(this.storageDir, 'entries.json');
    if (!fs.existsSync(p)) return;
    try {
      this.entries = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (error: unknown) {/* ignore */ logger.warn('[Usage Analytics] JSON parse failed', error); }
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

  public record(entry: Omit<UsageEntry, 'id' | 'timestamp'>): string {
    const id = `usage_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.entries.push({ ...entry, id, timestamp: new Date().toISOString() });
    this.scheduleFlush();
    return `Recorded: ${entry.tool}/${entry.action} (${entry.provider}/${entry.model})`;
  }

  public getStats(): string {
    if (this.entries.length === 0) return 'No usage data recorded.';

    const totalTokensIn = this.entries.reduce((s, e) => s + e.tokens_in, 0);
    const totalTokensOut = this.entries.reduce((s, e) => s + e.tokens_out, 0);
    const totalCost = this.entries.reduce((s, e) => s + e.cost_estimate, 0);
    const successRate = this.entries.filter((e) => e.success).length / this.entries.length;
    const avgLatency = this.entries.reduce((s, e) => s + e.latency_ms, 0) / this.entries.length;

    return [
      'Usage Analytics:',
      `  Total calls: ${this.entries.length}`,
      `  Tokens: ${totalTokensIn} in / ${totalTokensOut} out`,
      `  Cost: $${totalCost.toFixed(4)}`,
      `  Success rate: ${(successRate * 100).toFixed(1)}%`,
      `  Avg latency: ${avgLatency.toFixed(0)}ms`,
    ].join('\n');
  }

  public getTopTools(limit: number = 10): string {
    const counts: Record<string, number> = {};
    for (const e of this.entries) counts[e.tool] = (counts[e.tool] || 0) + 1;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
    return ['Top Tools:', ...sorted.map(([t, c]) => `  ${t}: ${c} calls`)].join('\n');
  }

  public getTopProviders(limit: number = 10): string {
    const counts: Record<string, number> = {};
    for (const e of this.entries) counts[e.provider] = (counts[e.provider] || 0) + 1;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
    return ['Top Providers:', ...sorted.map(([p, c]) => `  ${p}: ${c} calls`)].join('\n');
  }

  public getDailySummary(): string {
    const daily: Record<string, { calls: number; cost: number; tokens: number }> = {};
    for (const e of this.entries) {
      const day = e.timestamp.slice(0, 10);
      if (!daily[day]) daily[day] = { calls: 0, cost: 0, tokens: 0 };
      daily[day].calls++;
      daily[day].cost += e.cost_estimate;
      daily[day].tokens += e.tokens_in + e.tokens_out;
    }
    const days = Object.entries(daily).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7);
    return ['Daily Summary (last 7 days):', ...days.map(([d, s]) => `  ${d}: ${s.calls} calls, ${s.tokens} tokens, $${s.cost.toFixed(4)}`)].join('\n');
  }
}
