import fs from 'fs';
import path from 'path';
import http from 'http';

export interface PrometheusMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

export interface PrometheusHistogram {
  name: string;
  help: string;
  buckets: number[];
  counts: number[];
  sum: number;
  count: number;
  labels: Record<string, string>;
}

export class DiagnosticsPrometheusService {
  private readonly storageDir: string;
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, PrometheusHistogram> = new Map();
  private labelStore: Map<string, Map<string, number>> = new Map();
  private server: http.Server | null = null;
  private port = 9090;

  constructor(options?: { storageDir?: string; port?: number }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'prometheus');
    if (options?.port) this.port = options.port;
    this.ensureStorageDir();
    this.initDefaultMetrics();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private initDefaultMetrics(): void {
    this.counters.set('zavorth_tool_executions_total', 0);
    this.counters.set('zavorth_tool_errors_total', 0);
    this.counters.set('zavorth_channel_messages_sent_total', 0);
    this.counters.set('zavorth_channel_messages_received_total', 0);
    this.counters.set('zavorth_skill_invocations_total', 0);
    this.counters.set('zavorth_api_requests_total', 0);
    this.counters.set('zavorth_approval_requests_total', 0);
    this.counters.set('zavorth_approval_denied_total', 0);
    this.counters.set('zavorth_memory_operations_total', 0);
    this.counters.set('zavorth_session_count_total', 0);

    this.gauges.set('zavorth_active_sessions', 0);
    this.gauges.set('zavorth_active_spans', 0);
    this.gauges.set('zavorth_memory_entries', 0);
    this.gauges.set('zavorth_queue_depth', 0);
    this.gauges.set('zavorth_uptime_seconds', 0);
    this.gauges.set('zavorth_tool_success_rate', 1.0);
    this.gauges.set('zavorth_avg_response_time_ms', 0);

    this.histograms.set('zavorth_tool_duration_seconds', {
      name: 'zavorth_tool_duration_seconds',
      help: 'Tool execution duration in seconds',
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
      counts: new Array(10).fill(0),
      sum: 0,
      count: 0,
      labels: {},
    });

    this.histograms.set('zavorth_llm_latency_seconds', {
      name: 'zavorth_llm_latency_seconds',
      help: 'LLM response latency in seconds',
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      counts: new Array(9).fill(0),
      sum: 0,
      count: 0,
      labels: {},
    });
  }

  public incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    if (labels) {
      const key = this.labelKey(name, labels);
      const current = this.labelStore.get(key)?.get(name) || 0;
      if (!this.labelStore.has(key)) this.labelStore.set(key, new Map());
      this.labelStore.get(key)!.set(name, current + value);
    }
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  public setGauge(name: string, value: number, labels?: Record<string, string>): void {
    if (labels) {
      const key = this.labelKey(name, labels);
      if (!this.labelStore.has(key)) this.labelStore.set(key, new Map());
      this.labelStore.get(key)!.set(name, value);
    }
    this.gauges.set(name, value);
  }

  public observeHistogram(name: string, value: number): void {
    const hist = this.histograms.get(name);
    if (!hist) return;

    hist.sum += value;
    hist.count++;
    for (let i = 0; i < hist.buckets.length; i++) {
      if (value <= hist.buckets[i]) {
        hist.counts[i]++;
      }
    }
  }

  public recordToolExecution(toolName: string, durationMs: number, success: boolean): void {
    this.incrementCounter('zavorth_tool_executions_total', 1, { tool: toolName });
    if (!success) this.incrementCounter('zavorth_tool_errors_total', 1, { tool: toolName });
    this.observeHistogram('zavorth_tool_duration_seconds', durationMs / 1000);

    const total = this.counters.get('zavorth_tool_executions_total') || 1;
    const errors = this.counters.get('zavorth_tool_errors_total') || 0;
    this.setGauge('zavorth_tool_success_rate', (total - errors) / total);
  }

  public recordChannelMessage(channel: string, direction: 'sent' | 'received'): void {
    const metric = direction === 'sent' ? 'zavorth_channel_messages_sent_total' : 'zavorth_channel_messages_received_total';
    this.incrementCounter(metric, 1, { channel });
  }

  public recordLlmLatency(provider: string, model: string, latencyMs: number): void {
    this.observeHistogram('zavorth_llm_latency_seconds', latencyMs / 1000);
    this.incrementCounter('zavorth_llm_requests_total', 1, { provider, model });
  }

  public recordApprovalRequest(outcome: 'approved' | 'denied'): void {
    this.incrementCounter('zavorth_approval_requests_total');
    if (outcome === 'denied') this.incrementCounter('zavorth_approval_denied_total');
  }

  public exportPrometheusFormat(): string {
    const lines: string[] = [];

    for (const [name, value] of this.counters) {
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${value}`);
    }

    for (const [name, value] of this.gauges) {
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    }

    for (const [name, hist] of this.histograms) {
      lines.push(`# TYPE ${name} histogram`);
      lines.push(`# HELP ${hist.help}`);
      let cumulative = 0;
      for (let i = 0; i < hist.buckets.length; i++) {
        cumulative += hist.counts[i];
        lines.push(`${name}_bucket{le="${hist.buckets[i]}"} ${cumulative}`);
      }
      lines.push(`${name}_bucket{le="+Inf"} ${hist.count}`);
      lines.push(`${name}_sum ${hist.sum}`);
      lines.push(`${name}_count ${hist.count}`);
    }

    for (const [key, metrics] of this.labelStore) {
      const parsed = this.parseLabelKey(key);
      for (const [name, value] of metrics) {
        const labelsStr = Object.entries(parsed).map(([k, v]) => `${k}="${v}"`).join(',');
        lines.push(`${name}{${labelsStr}} ${value}`);
      }
    }

    return lines.join('\n') + '\n';
  }

  public getMetricsJson(): string {
    return JSON.stringify({
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Array.from(this.histograms.entries()).map(([name, h]) => ({
        name,
        help: h.help,
        buckets: h.buckets.map((b, i) => ({ le: b, count: h.counts[i] })),
        sum: h.sum,
        count: h.count,
      })),
      timestamp: Date.now(),
    }, null, 2);
  }

  public startHttpServer(): string {
    if (this.server) return `Servidor Prometheus ja running na porta ${this.port}.`;

    this.server = http.createServer((req, res) => {
      if (req.url === '/metrics') {
        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
        res.end(this.exportPrometheusFormat());
      } else if (req.url === '/metrics/json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(this.getMetricsJson());
      } else if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', metrics: this.counters.size + this.gauges.size }));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    this.server.listen(this.port, () => {
      console.log(`[Prometheus] Metrics server on :${this.port}/metrics`);
    });

    return `Servidor Prometheus iniciado na porta ${this.port}. Endpoints: /metrics, /metrics/json, /health`;
  }

  public stopHttpServer(): string {
    if (!this.server) return 'Servidor nao esta running.';
    this.server.close();
    this.server = null;
    return 'Servidor Prometheus parado.';
  }

  public getStats(): string {
    const lines: string[] = [
      'Prometheus Metrics:',
      `  Counters: ${this.counters.size}`,
      `  Gauges: ${this.gauges.size}`,
      `  Histograms: ${this.histograms.size}`,
      `  Labeled metrics: ${this.labelStore.size}`,
      '',
      'Top Counters:',
    ];

    const sorted = Array.from(this.counters.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [name, value] of sorted) {
      lines.push(`  ${name}: ${value}`);
    }

    lines.push('', 'Gauges:');
    for (const [name, value] of this.gauges) {
      lines.push(`  ${name}: ${typeof value === 'number' ? value.toFixed(3) : value}`);
    }

    return lines.join('\n');
  }

  public reset(): string {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.labelStore.clear();
    this.initDefaultMetrics();
    return 'Metricas resetadas.';
  }

  private labelKey(name: string, labels: Record<string, string>): string {
    const sorted = Object.entries(labels).sort((a, b) => a[0].localeCompare(b[0]));
    return `${name}|${sorted.map(([k, v]) => `${k}=${v}`).join(',')}`;
  }

  private parseLabelKey(key: string): Record<string, string> {
    const parts = key.split('|');
    if (parts.length < 2) return {};
    const result: Record<string, string> = {};
    for (const part of parts[1].split(',')) {
      const [k, v] = part.split('=');
      if (k && v) result[k] = v;
    }
    return result;
  }
}
