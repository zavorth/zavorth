import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DiagnosticsSignal } from '../../contracts/DiagnosticsContract.js';

export type DiagnosticsArtifactRef = {
  artifactId: string;
  contentType: string;
  storageRef: string;
};

export class OpenTelemetryJsonExportAdapter {
  public readonly adapterId = 'otel-json-export';

  public async export(input: {
    artifactDir: string;
    scope: string;
    signals: DiagnosticsSignal[];
    generatedAt: string;
  }): Promise<DiagnosticsArtifactRef> {
    await fs.promises.mkdir(input.artifactDir, { recursive: true });
    const artifactId = `diagnostics.otel.${input.scope}.${randomUUID()}`;
    const storageRef = path.join(input.artifactDir, `${artifactId}.json`);
    await fs.promises.writeFile(
      storageRef,
      JSON.stringify({
        resourceSpans: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'zavorth' } },
              { key: 'zavorth.scope', value: { stringValue: input.scope } },
            ],
          },
          scopeSpans: [{
            scope: {
              name: 'zavorth.intent-model0.diagnostics',
            },
            spans: input.signals.map((signal) => ({
              traceId: this.hashLike(`${signal.name}:${signal.observedAt}`).padEnd(32, '0').slice(0, 32),
              spanId: this.hashLike(signal.name).padEnd(16, '0').slice(0, 16),
              name: signal.name,
              kind: signal.kind,
              startTimeUnixNano: `${Date.parse(signal.observedAt) * 1_000_000}`,
              endTimeUnixNano: `${Date.parse(input.generatedAt) * 1_000_000}`,
              attributes: Object.entries(signal.attributes).map(([key, value]) => ({
                key,
                value: { stringValue: String(value) },
              })),
            })),
          }],
        }],
        metrics: input.signals
          .filter((signal) => signal.kind === 'metric')
          .map((signal) => ({
            name: signal.name,
            unit: signal.unit,
            value: signal.value,
            observedAt: signal.observedAt,
          })),
        generatedAt: input.generatedAt,
        secretValuesSerialized: false,
      }, null, 2),
      'utf8',
    );
    return {
      artifactId,
      contentType: 'application/json',
      storageRef,
    };
  }

  private hashLike(value: string): string {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }
    return Math.abs(hash).toString(16);
  }
}

export class PrometheusTextScrapeAdapter {
  public readonly adapterId = 'prometheus-text-scrape';

  public render(signals: DiagnosticsSignal[]): string {
    const lines: string[] = [
      '# HELP zavorth_diagnostics_signal Zavorth diagnostics live signal',
      '# TYPE zavorth_diagnostics_signal gauge',
    ];
    for (const signal of signals.filter((entry) => entry.kind === 'metric' || entry.kind === 'health')) {
      const metricName = this.metricName(signal.name);
      const labels = Object.entries({
        kind: signal.kind,
        unit: signal.unit || '',
      })
        .map(([key, value]) => `${key}="${String(value).replace(/"/g, '\\"')}"`)
        .join(',');
      lines.push(`# HELP ${metricName} ${signal.name}`);
      lines.push(`# TYPE ${metricName} gauge`);
      lines.push(`${metricName}{${labels}} ${this.metricValue(signal.value)}`);
    }
    return `${lines.join('\n')}\n`;
  }

  public scrape(text: string): {
    ok: boolean;
    series: number;
    metricNames: string[];
  } {
    const metricNames = text.split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split(/[{\s]/)[0])
      .filter(Boolean);
    return {
      ok: metricNames.length > 0,
      series: metricNames.length,
      metricNames,
    };
  }

  private metricName(value: string): string {
    return `zavorth_${value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
  }

  private metricValue(value: DiagnosticsSignal['value']): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value === 'healthy') return 1;
    if (value === 'degraded') return 0.5;
    return 0;
  }
}
