import type {
  DiagnosticsSignal,
  DiagnosticsSnapshotRequest,
  DiagnosticsSnapshotResult,
} from '../contracts/DiagnosticsContract.js';
import { DIAGNOSTICS_CONTRACT_VERSION } from '../contracts/DiagnosticsContract.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config/index.js';
import {
  OpenTelemetryJsonExportAdapter,
  PrometheusTextScrapeAdapter,
  type DiagnosticsArtifactRef,
} from '../adapters/diagnostics/DiagnosticsQaMigrationLiveAdapters.js';

type DiagnosticsTraceServiceOptions = {
  artifactDir?: string;
  now?: () => Date;
  otelAdapter?: OpenTelemetryJsonExportAdapter;
  prometheusAdapter?: PrometheusTextScrapeAdapter;
};

export type DiagnosticsLiveSnapshotResult = DiagnosticsSnapshotResult & {
  otelArtifact: DiagnosticsArtifactRef | null;
  prometheusArtifact: DiagnosticsArtifactRef | null;
  prometheusScrape: {
    ok: boolean;
    series: number;
    metricNames: string[];
  } | null;
  liveMetrics: {
    pid: number;
    uptimeSeconds: number;
    platform: string;
    memoryRssBytes: number;
    heapUsedBytes: number;
    loadAverage1m: number;
  };
  secretValuesSerialized: false;
};

export class DiagnosticsTraceService {
  private readonly artifactDir: string;
  private readonly now: () => Date;
  private readonly otelAdapter: OpenTelemetryJsonExportAdapter;
  private readonly prometheusAdapter: PrometheusTextScrapeAdapter;

  constructor(options: DiagnosticsTraceServiceOptions = {}) {
    this.artifactDir = options.artifactDir || path.join(config.dataDir, 'artifacts', 'diagnostics');
    this.now = options.now || (() => new Date());
    this.otelAdapter = options.otelAdapter || new OpenTelemetryJsonExportAdapter();
    this.prometheusAdapter = options.prometheusAdapter || new PrometheusTextScrapeAdapter();
  }

  public snapshot(request: DiagnosticsSnapshotRequest): DiagnosticsSnapshotResult {
    const processedAt = this.now().toISOString();
    const signals: DiagnosticsSignal[] = [
      {
        kind: 'health',
        name: `${request.scope}.health`,
        value: 'healthy',
        unit: null,
        observedAt: processedAt,
        attributes: {
          dryRun: true,
          includeLogs: request.includeLogs === true,
        },
      },
      {
        kind: 'metric',
        name: `${request.scope}.receipt.count`,
        value: 1,
        unit: 'count',
        observedAt: processedAt,
        attributes: {
          secretValuesSerialized: false,
        },
      },
    ];

    return {
      ok: true,
      contractVersion: DIAGNOSTICS_CONTRACT_VERSION,
      status: 'healthy',
      signals,
      reportArtifactId: `diagnostics.${request.scope}.report`,
      receiptId: `diagnostics.${request.scope}.receipt`,
      processedAt,
      error: null,
    };
  }

  public async snapshotLive(request: DiagnosticsSnapshotRequest & {
    exportOtel?: boolean;
    exportPrometheus?: boolean;
  }): Promise<DiagnosticsLiveSnapshotResult> {
    const processedAt = this.now().toISOString();
    const liveMetrics = this.collectLiveMetrics();
    const signals = this.buildLiveSignals(request, processedAt, liveMetrics);
    const status = this.resolveStatus(liveMetrics);
    await fs.promises.mkdir(this.artifactDir, { recursive: true });
    const reportArtifactId = `diagnostics.${request.scope}.${randomUUID()}`;
    await fs.promises.writeFile(
      path.join(this.artifactDir, `${reportArtifactId}.json`),
      JSON.stringify({
        scope: request.scope,
        status,
        signals,
        generatedAt: processedAt,
        liveMetrics,
        includeLogs: request.includeLogs === true,
        secretValuesSerialized: false,
      }, null, 2),
      'utf8',
    );

    const otelArtifact = request.exportOtel !== false
      ? await this.otelAdapter.export({
        artifactDir: this.artifactDir,
        scope: request.scope,
        signals,
        generatedAt: processedAt,
      })
      : null;
    const prometheusText = request.exportPrometheus !== false
      ? this.prometheusAdapter.render(signals)
      : null;
    const prometheusArtifact = prometheusText
      ? await this.storePrometheusArtifact(request.scope, prometheusText)
      : null;

    return {
      ok: true,
      contractVersion: DIAGNOSTICS_CONTRACT_VERSION,
      status,
      signals,
      reportArtifactId,
      receiptId: `${reportArtifactId}.receipt`,
      processedAt,
      error: null,
      otelArtifact,
      prometheusArtifact,
      prometheusScrape: prometheusText ? this.prometheusAdapter.scrape(prometheusText) : null,
      liveMetrics,
      secretValuesSerialized: false,
    };
  }

  private buildLiveSignals(
    request: DiagnosticsSnapshotRequest,
    processedAt: string,
    liveMetrics: DiagnosticsLiveSnapshotResult['liveMetrics'],
  ): DiagnosticsSignal[] {
    return [
      {
        kind: 'health',
        name: `${request.scope}.health`,
        value: this.resolveStatus(liveMetrics),
        unit: null,
        observedAt: processedAt,
        attributes: {
          dryRun: false,
          includeLogs: request.includeLogs === true,
          pid: liveMetrics.pid,
        },
      },
      {
        kind: 'metric',
        name: `${request.scope}.process.uptime`,
        value: liveMetrics.uptimeSeconds,
        unit: 'seconds',
        observedAt: processedAt,
        attributes: {
          source: 'process.uptime',
        },
      },
      {
        kind: 'metric',
        name: `${request.scope}.memory.rss`,
        value: liveMetrics.memoryRssBytes,
        unit: 'bytes',
        observedAt: processedAt,
        attributes: {
          source: 'process.memoryUsage.rss',
        },
      },
      {
        kind: 'metric',
        name: `${request.scope}.heap.used`,
        value: liveMetrics.heapUsedBytes,
        unit: 'bytes',
        observedAt: processedAt,
        attributes: {
          source: 'process.memoryUsage.heapUsed',
        },
      },
      {
        kind: 'metric',
        name: `${request.scope}.loadavg.1m`,
        value: liveMetrics.loadAverage1m,
        unit: 'load',
        observedAt: processedAt,
        attributes: {
          platform: liveMetrics.platform,
        },
      },
    ];
  }

  private collectLiveMetrics(): DiagnosticsLiveSnapshotResult['liveMetrics'] {
    const memory = process.memoryUsage();
    return {
      pid: process.pid,
      uptimeSeconds: Number(process.uptime().toFixed(3)),
      platform: process.platform,
      memoryRssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      loadAverage1m: os.loadavg()[0] || 0,
    };
  }

  private resolveStatus(liveMetrics: DiagnosticsLiveSnapshotResult['liveMetrics']) {
    if (liveMetrics.memoryRssBytes <= 0 || liveMetrics.heapUsedBytes <= 0) {
      return 'failed' as const;
    }
    return 'healthy' as const;
  }

  private async storePrometheusArtifact(scope: string, text: string): Promise<DiagnosticsArtifactRef> {
    const artifactId = `diagnostics.prometheus.${scope}.${randomUUID()}`;
    const storageRef = path.join(this.artifactDir, `${artifactId}.prom`);
    await fs.promises.writeFile(storageRef, text, 'utf8');
    return {
      artifactId,
      contentType: 'text/plain; version=0.0.4',
      storageRef,
    };
  }
}
