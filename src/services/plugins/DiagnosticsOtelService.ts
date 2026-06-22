import fs from 'fs';
import path from 'path';

export interface OtelSpan {
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  name: string;
  kind: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
  start_time: string;
  end_time: string | null;
  duration_ms: number | null;
  status: 'ok' | 'error' | 'unset';
  status_message: string | null;
  attributes: Record<string, unknown>;
  events: Array<{
    name: string;
    timestamp: string;
    attributes: Record<string, unknown>;
  }>;
}

export interface OtelMetric {
  name: string;
  description: string;
  unit: string;
  type: 'counter' | 'gauge' | 'histogram';
  value: number;
  attributes: Record<string, unknown>;
  timestamp: string;
}

export interface OtelLogEntry {
  timestamp: string;
  severity: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  body: string;
  attributes: Record<string, unknown>;
  trace_id: string | null;
  span_id: string | null;
}

export class DiagnosticsOtelService {
  private static readonly DEFAULT_MAX_SIZE = 10000;
  private readonly storageDir: string;
  private maxSize: number;
  private spans: OtelSpan[] = [];
  private metrics: OtelMetric[] = [];
  private logs: OtelLogEntry[] = [];
  private activeSpans: Map<string, OtelSpan> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();

  constructor(options?: { storageDir?: string; maxSize?: number }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'otel');
    this.maxSize = options?.maxSize || DiagnosticsOtelService.DEFAULT_MAX_SIZE;
    this.ensureStorageDir();
  }

  public setMaxSize(max: number): void {
    this.maxSize = max;
    this.evictOldEntries();
  }

  private evictOldEntries(): void {
    if (this.spans.length > this.maxSize) this.spans.splice(0, this.spans.length - this.maxSize);
    if (this.metrics.length > this.maxSize) this.metrics.splice(0, this.metrics.length - this.maxSize);
    if (this.logs.length > this.maxSize) this.logs.splice(0, this.logs.length - this.maxSize);
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  public startSpan(name: string, options?: {
    parent_span_id?: string;
    kind?: OtelSpan['kind'];
    attributes?: Record<string, unknown>;
  }): string {
    const traceId = options?.parent_span_id
      ? this.activeSpans.get(options.parent_span_id)?.trace_id || this.generateId()
      : this.generateId();
    const spanId = this.generateId();

    const span: OtelSpan = {
      trace_id: traceId,
      span_id: spanId,
      parent_span_id: options?.parent_span_id || null,
      name,
      kind: options?.kind || 'internal',
      start_time: new Date().toISOString(),
      end_time: null,
      duration_ms: null,
      status: 'unset',
      status_message: null,
      attributes: options?.attributes || {},
      events: [],
    };

    this.activeSpans.set(spanId, span);
    return spanId;
  }

  public endSpan(spanId: string, status?: 'ok' | 'error', statusMessage?: string): string {
    const span = this.activeSpans.get(spanId);
    if (!span) return `Span "${spanId}" nao encontrado.`;

    span.end_time = new Date().toISOString();
    span.duration_ms = new Date(span.end_time).getTime() - new Date(span.start_time).getTime();
    span.status = status || 'ok';
    span.status_message = statusMessage || null;

    this.spans.push(span);
    if (this.spans.length > this.maxSize) this.spans.shift();
    this.activeSpans.delete(spanId);

    return `Span "${span.name}" finalizado (${span.duration_ms}ms, status: ${span.status}).`;
  }

  public addSpanEvent(spanId: string, eventName: string, attributes: Record<string, unknown> = {}): string {
    const span = this.activeSpans.get(spanId);
    if (!span) return `Span "${spanId}" nao encontrado.`;

    span.events.push({
      name: eventName,
      timestamp: new Date().toISOString(),
      attributes,
    });

    return `Evento "${eventName}" adicionado ao span "${span.name}".`;
  }

  public recordMetric(name: string, options?: {
    description?: string;
    unit?: string;
    type?: OtelMetric['type'];
    value?: number;
    attributes?: Record<string, unknown>;
  }): void {
    const type = options?.type || 'counter';

    if (type === 'counter') {
      const current = this.counters.get(name) || 0;
      this.counters.set(name, current + (options?.value || 1));
    } else if (type === 'gauge') {
      this.gauges.set(name, options?.value || 0);
    }

    this.metrics.push({
      name,
      description: options?.description || '',
      unit: options?.unit || '',
      type,
      value: type === 'counter' ? this.counters.get(name)! : (options?.value || 0),
      attributes: options?.attributes || {},
      timestamp: new Date().toISOString(),
    });
    if (this.metrics.length > this.maxSize) this.metrics.shift();
  }

  public log(severity: OtelLogEntry['severity'], body: string, options?: {
    attributes?: Record<string, unknown>;
    trace_id?: string;
    span_id?: string;
  }): void {
    this.logs.push({
      timestamp: new Date().toISOString(),
      severity,
      body,
      attributes: options?.attributes || {},
      trace_id: options?.trace_id || null,
      span_id: options?.span_id || null,
    });
    if (this.logs.length > this.maxSize) this.logs.shift();
  }

  public getActiveSpans(): string {
    if (this.activeSpans.size === 0) return 'Nenhum span ativo.';

    const lines: string[] = [`Spans ativos (${this.activeSpans.size}):`];
    for (const [id, span] of this.activeSpans) {
      const elapsed = Date.now() - new Date(span.start_time).getTime();
      lines.push(`  ${id}: ${span.name} (${span.kind}) ${elapsed}ms`);
    }
    return lines.join('\n');
  }

  public getTraces(limit: number = 20): string {
    if (this.spans.length === 0) return 'Nenhum trace registrado.';

    const byTrace: Record<string, OtelSpan[]> = {};
    for (const span of this.spans) {
      if (!byTrace[span.trace_id]) byTrace[span.trace_id] = [];
      byTrace[span.trace_id].push(span);
    }

    const traceIds = Object.keys(byTrace).slice(-limit);
    const lines: string[] = [`Traces (ultimos ${traceIds.length}):`];

    for (const traceId of traceIds) {
      const spans = byTrace[traceId];
      const rootSpan = spans.find((s) => !s.parent_span_id) || spans[0];
      const totalDuration = spans.reduce((sum, s) => sum + (s.duration_ms || 0), 0);
      const hasErrors = spans.some((s) => s.status === 'error');

      lines.push(`  ${hasErrors ? '❌' : '✅'} ${traceId.slice(0, 12)}... | ${rootSpan.name} | ${spans.length} spans | ${totalDuration}ms`);
    }
    return lines.join('\n');
  }

  public getMetrics(): string {
    if (this.metrics.length === 0 && this.counters.size === 0) return 'Nenhuma metrica registrada.';

    const lines: string[] = ['Metricas:'];

    if (this.counters.size > 0) {
      lines.push('  Counters:');
      for (const [name, value] of this.counters) {
        lines.push(`    ${name}: ${value}`);
      }
    }

    if (this.gauges.size > 0) {
      lines.push('  Gauges:');
      for (const [name, value] of this.gauges) {
        lines.push(`    ${name}: ${value}`);
      }
    }

    return lines.join('\n');
  }

  public getLogs(options?: { severity?: OtelLogEntry['severity']; limit?: number }): string {
    let filtered = this.logs;
    if (options?.severity) {
      filtered = filtered.filter((l) => l.severity === options.severity);
    }

    const limit = options?.limit || 50;
    const recent = filtered.slice(-limit);

    if (recent.length === 0) return 'Nenhum log encontrado.';

    const lines: string[] = [`Logs (ultimos ${recent.length}):`];
    for (const log of recent) {
      const icon = { trace: '🔍', debug: '🐛', info: 'ℹ️', warn: '⚠️', error: '❌', fatal: '💀' }[log.severity];
      lines.push(`  ${icon} [${log.timestamp}] ${log.body.slice(0, 120)}`);
    }
    return lines.join('\n');
  }

  public getStats(): string {
    const lines: string[] = [
      'Estatisticas OpenTelemetry:',
      `  Spans: ${this.spans.length} completos, ${this.activeSpans.size} ativos`,
      `  Metricas: ${this.metrics.length} registradas, ${this.counters.size} counters, ${this.gauges.size} gauges`,
      `  Logs: ${this.logs.length} entradas`,
    ];

    if (this.spans.length > 0) {
      const avgDuration = this.spans.reduce((sum, s) => sum + (s.duration_ms || 0), 0) / this.spans.length;
      const errorRate = this.spans.filter((s) => s.status === 'error').length / this.spans.length;
      lines.push(`  Duracao media de span: ${avgDuration.toFixed(0)}ms`);
      lines.push(`  Taxa de erro: ${(errorRate * 100).toFixed(1)}%`);
    }

    return lines.join('\n');
  }

  public exportToOtelFormat(): string {
    return JSON.stringify({
      resourceSpans: [{
        resource: { attributes: { 'service.name': 'zavorth' } },
        scopeSpans: [{ scope: { name: 'zavorth-otel' }, spans: this.spans }],
      }],
      resourceMetrics: [{
        resource: { attributes: { 'service.name': 'zavorth' } },
        scopeMetrics: [{ scope: { name: 'zavorth-otel' }, metrics: this.metrics }],
      }],
    }, null, 2);
  }

  public flush(): string {
    const stats = {
      spans: this.spans.length,
      metrics: this.metrics.length,
      logs: this.logs.length,
    };

    const exportPath = path.join(this.storageDir, `export_${Date.now()}.json`);
    fs.writeFileSync(exportPath, this.exportToOtelFormat(), 'utf-8');

    this.spans = [];
    this.metrics = [];
    this.logs = [];

    return `Flush completo. ${stats.spans} spans, ${stats.metrics} metricas, ${stats.logs} logs exportados para ${exportPath}.`;
  }

  private generateId(): string {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }
}
