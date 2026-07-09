import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface QualityMetric {
  id: string;
  timestamp: string;
  tool: string;
  action: string;
  score: number;
  feedback: 'positive' | 'negative' | 'neutral';
  comment: string;
  user: string;
}

export class QualityMetricsService {
  private readonly storageDir: string;
  private metrics: QualityMetric[] = [];
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'quality-metrics');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    this.loadMetrics();
  }

  private loadMetrics(): void {
    const p = path.join(this.storageDir, 'metrics.json');
    if (!fs.existsSync(p)) return;
    try {
      this.metrics = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (error: any) { /* ignore */ logger.warn('[Quality Metrics] JSON parse failed', error); }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.dirty) {
        this.dirty = false;
        fs.writeFileSync(path.join(this.storageDir, 'metrics.json'), JSON.stringify(this.metrics, null, 2), 'utf-8');
      }
    }, 2000);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  public record(metric: Omit<QualityMetric, 'id' | 'timestamp'>): string {
    const id = `qual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.metrics.push({ ...metric, id, timestamp: new Date().toISOString() });
    this.scheduleFlush();
    return `Quality metric recorded: ${metric.score}/10 (${metric.feedback}) for ${metric.tool}/${metric.action}`;
  }

  public getStats(): string {
    if (this.metrics.length === 0) return 'No quality metrics recorded.';

    const avgScore = this.metrics.reduce((s, m) => s + m.score, 0) / this.metrics.length;
    const positive = this.metrics.filter((m) => m.feedback === 'positive').length;
    const negative = this.metrics.filter((m) => m.feedback === 'negative').length;
    const neutral = this.metrics.filter((m) => m.feedback === 'neutral').length;

    return [
      'Quality Metrics:',
      `  Total: ${this.metrics.length}`,
      `  Avg score: ${avgScore.toFixed(1)}/10`,
      `  Positive: ${positive} (${((positive / this.metrics.length) * 100).toFixed(1)}%)`,
      `  Negative: ${negative} (${((negative / this.metrics.length) * 100).toFixed(1)}%)`,
      `  Neutral: ${neutral}`,
    ].join('\n');
  }

  public getQualityByTool(): string {
    const tools: Record<string, { scores: number[]; count: number }> = {};
    for (const m of this.metrics) {
      if (!tools[m.tool]) tools[m.tool] = { scores: [], count: 0 };
      tools[m.tool].scores.push(m.score);
      tools[m.tool].count++;
    }
    const sorted = Object.entries(tools)
      .map(([t, d]) => ({ tool: t, avg: d.scores.reduce((a, b) => a + b, 0) / d.scores.length, count: d.count }))
      .sort((a, b) => b.avg - a.avg);
    return ['Quality by Tool:', ...sorted.map((t) => `  ${t.tool}: ${t.avg.toFixed(1)}/10 (${t.count} ratings)`)].join('\n');
  }

  public getWorstTools(): string {
    const tools: Record<string, { scores: number[]; count: number }> = {};
    for (const m of this.metrics) {
      if (!tools[m.tool]) tools[m.tool] = { scores: [], count: 0 };
      tools[m.tool].scores.push(m.score);
      tools[m.tool].count++;
    }
    const sorted = Object.entries(tools)
      .map(([t, d]) => ({ tool: t, avg: d.scores.reduce((a, b) => a + b, 0) / d.scores.length, count: d.count }))
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 5);
    return ['Worst Tools (need improvement):', ...sorted.map((t) => `  ${t.tool}: ${t.avg.toFixed(1)}/10 (${t.count} ratings)`)].join('\n');
  }

  public getRecentFeedback(limit: number = 10): string {
    const recent = this.metrics
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
    return [
      'Recent Feedback:',
      ...recent.map((m) => `  ${m.timestamp.slice(0, 16)} ${m.tool}/${m.action}: ${m.score}/10 (${m.feedback})${m.comment ? ` - ${m.comment}` : ''}`),
    ].join('\n');
  }
}
