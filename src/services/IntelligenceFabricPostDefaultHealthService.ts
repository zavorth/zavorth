import type {
  UniversalAgentChannel,
  UniversalAgentRun,
} from '../runtime/agent/UniversalAgentRuntimeTypes.js';

export type IntelligenceFabricPostDefaultHealthStatus = 'ready' | 'attention' | 'degraded';
export type IntelligenceFabricPostDefaultHealthRecommendation = 'maintain_default' | 'observe' | 'auto_demote_controlled';

export type IntelligenceFabricPostDefaultHealthThresholds = {
  minRuns: number;
  maxFallbackRate: number;
  maxErrorFallbackRate: number;
  maxDisabledRate: number;
  maxAverageLatencyMs: number;
  maxP95LatencyMs: number;
};

export type IntelligenceFabricPostDefaultHealthSurface = {
  surface: UniversalAgentChannel;
  runs: number;
  observed: number;
  disabled: number;
  fallbackCurrentRuntime: number;
  errorFallback: number;
  oriented: number;
  averageLatencyMs: number;
};

export type IntelligenceFabricPostDefaultHealthSnapshot = {
  contractVersion: 'zavorth-intelligence-fabric-post-default-health/v1';
  generatedAt: string;
  status: IntelligenceFabricPostDefaultHealthStatus;
  recommendation: IntelligenceFabricPostDefaultHealthRecommendation;
  summary: {
    runs: number;
    fabricRuns: number;
    observedRuns: number;
    disabledRuns: number;
    fallbackCurrentRuntimeRuns: number;
    errorFallbackRuns: number;
    orientedRuns: number;
    fallbackRate: number;
    errorFallbackRate: number;
    disabledRate: number;
    orientationRate: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
  };
  thresholds: IntelligenceFabricPostDefaultHealthThresholds;
  surfaces: IntelligenceFabricPostDefaultHealthSurface[];
  findings: Array<{
    id: string;
    severity: 'info' | 'warning' | 'blocker';
    message: string;
  }>;
  rollback: {
    available: true;
    demoteMode: 'disabled';
    instruction: 'Set intelligenceFabricMode=disabled at runtime or request metadata.';
    destructive: false;
  };
  receipts: string[];
};

type Runtime = {
  now?: () => Date;
  thresholds?: Partial<IntelligenceFabricPostDefaultHealthThresholds> | null;
};

const DEFAULT_THRESHOLDS: IntelligenceFabricPostDefaultHealthThresholds = {
  minRuns: 3,
  maxFallbackRate: 0.25,
  maxErrorFallbackRate: 0.05,
  maxDisabledRate: 0.4,
  maxAverageLatencyMs: 250,
  maxP95LatencyMs: 600,
};

export class IntelligenceFabricPostDefaultHealthService {
  private readonly now: () => Date;
  private readonly thresholds: IntelligenceFabricPostDefaultHealthThresholds;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...(runtime.thresholds || {}),
    };
  }

  public buildSnapshot(runs: UniversalAgentRun[]): IntelligenceFabricPostDefaultHealthSnapshot {
    const fabricRuns = runs
      .map((run) => ({ run, metadata: readRecord(run.metadata.intelligenceFabricCanary) }))
      .filter((entry) => Object.keys(entry.metadata).length > 0);
    const observedRuns = fabricRuns.filter((entry) => entry.metadata.status === 'observed');
    const disabledRuns = fabricRuns.filter((entry) => entry.metadata.status === 'disabled');
    const fallbackCurrentRuntimeRuns = fabricRuns.filter((entry) => entry.metadata.selectedPath === 'current-runtime-fallback');
    const errorFallbackRuns = fabricRuns.filter((entry) => entry.metadata.status === 'fallback-current-runtime');
    const orientedRuns = fabricRuns.filter((entry) => readRecord(entry.metadata.orientation).applied === true);
    const latencies = fabricRuns
      .map((entry) => Number(readRecord(entry.metadata.metrics).totalLatencyMs))
      .filter((value) => Number.isFinite(value) && value >= 0);
    const summary = {
      runs: runs.length,
      fabricRuns: fabricRuns.length,
      observedRuns: observedRuns.length,
      disabledRuns: disabledRuns.length,
      fallbackCurrentRuntimeRuns: fallbackCurrentRuntimeRuns.length,
      errorFallbackRuns: errorFallbackRuns.length,
      orientedRuns: orientedRuns.length,
      fallbackRate: rate(fallbackCurrentRuntimeRuns.length, fabricRuns.length),
      errorFallbackRate: rate(errorFallbackRuns.length, fabricRuns.length),
      disabledRate: rate(disabledRuns.length, fabricRuns.length),
      orientationRate: rate(orientedRuns.length, fabricRuns.length),
      averageLatencyMs: average(latencies),
      p95LatencyMs: percentile(latencies, 0.95),
    };
    const findings = this.buildFindings(summary);
    const status = resolveStatus(findings, summary, this.thresholds);
    const recommendation = resolveRecommendation(status, findings);
    return {
      contractVersion: 'zavorth-intelligence-fabric-post-default-health/v1',
      generatedAt: this.now().toISOString(),
      status,
      recommendation,
      summary,
      thresholds: { ...this.thresholds },
      surfaces: buildSurfaceHealth(fabricRuns),
      findings,
      rollback: {
        available: true,
        demoteMode: 'disabled',
        instruction: 'Set intelligenceFabricMode=disabled at runtime or request metadata.',
        destructive: false,
      },
      receipts: [
        'intelligence-fabric-post-default-health',
        recommendation === 'auto_demote_controlled'
          ? 'intelligence-fabric-auto-demote-recommended'
          : 'intelligence-fabric-default-monitoring-retained',
      ],
    };
  }

  private buildFindings(summary: IntelligenceFabricPostDefaultHealthSnapshot['summary']): IntelligenceFabricPostDefaultHealthSnapshot['findings'] {
    const findings: IntelligenceFabricPostDefaultHealthSnapshot['findings'] = [];
    if (summary.fabricRuns < this.thresholds.minRuns) {
      findings.push({
        id: 'insufficient-sample',
        severity: 'warning',
        message: `Only ${summary.fabricRuns} Fabric run(s) observed; minimum is ${this.thresholds.minRuns}.`,
      });
    }
    if (summary.errorFallbackRate > this.thresholds.maxErrorFallbackRate) {
      findings.push({
        id: 'error-fallback-rate-high',
        severity: 'blocker',
        message: `Error fallback rate ${formatRate(summary.errorFallbackRate)} exceeds ${formatRate(this.thresholds.maxErrorFallbackRate)}.`,
      });
    }
    if (summary.fallbackRate > this.thresholds.maxFallbackRate) {
      findings.push({
        id: 'fallback-rate-high',
        severity: 'warning',
        message: `Fallback rate ${formatRate(summary.fallbackRate)} exceeds ${formatRate(this.thresholds.maxFallbackRate)}.`,
      });
    }
    if (summary.disabledRate > this.thresholds.maxDisabledRate) {
      findings.push({
        id: 'disabled-rate-high',
        severity: 'warning',
        message: `Disabled rate ${formatRate(summary.disabledRate)} exceeds ${formatRate(this.thresholds.maxDisabledRate)}.`,
      });
    }
    if (summary.averageLatencyMs > this.thresholds.maxAverageLatencyMs) {
      findings.push({
        id: 'average-latency-high',
        severity: 'warning',
        message: `Average Fabric latency ${summary.averageLatencyMs}ms exceeds ${this.thresholds.maxAverageLatencyMs}ms.`,
      });
    }
    if (summary.p95LatencyMs > this.thresholds.maxP95LatencyMs) {
      findings.push({
        id: 'p95-latency-high',
        severity: 'blocker',
        message: `P95 Fabric latency ${summary.p95LatencyMs}ms exceeds ${this.thresholds.maxP95LatencyMs}ms.`,
      });
    }
    if (findings.length === 0) {
      findings.push({
        id: 'post-default-health-ready',
        severity: 'info',
        message: 'Fabric default health is within thresholds.',
      });
    }
    return findings;
  }
}

function buildSurfaceHealth(
  entries: Array<{ run: UniversalAgentRun; metadata: Record<string, unknown> }>,
): IntelligenceFabricPostDefaultHealthSurface[] {
  const bySurface = new Map<UniversalAgentChannel, Array<{ run: UniversalAgentRun; metadata: Record<string, unknown> }>>();
  for (const entry of entries) {
    const list = bySurface.get(entry.run.channel) || [];
    list.push(entry);
    bySurface.set(entry.run.channel, list);
  }
  return Array.from(bySurface.entries())
    .map(([surface, list]) => {
      const latencies = list
        .map((entry) => Number(readRecord(entry.metadata.metrics).totalLatencyMs))
        .filter((value) => Number.isFinite(value) && value >= 0);
      return {
        surface,
        runs: list.length,
        observed: list.filter((entry) => entry.metadata.status === 'observed').length,
        disabled: list.filter((entry) => entry.metadata.status === 'disabled').length,
        fallbackCurrentRuntime: list.filter((entry) => entry.metadata.selectedPath === 'current-runtime-fallback').length,
        errorFallback: list.filter((entry) => entry.metadata.status === 'fallback-current-runtime').length,
        oriented: list.filter((entry) => readRecord(entry.metadata.orientation).applied === true).length,
        averageLatencyMs: average(latencies),
      };
    })
    .sort((a, b) => a.surface.localeCompare(b.surface));
}

function resolveStatus(
  findings: IntelligenceFabricPostDefaultHealthSnapshot['findings'],
  summary: IntelligenceFabricPostDefaultHealthSnapshot['summary'],
  thresholds: IntelligenceFabricPostDefaultHealthThresholds,
): IntelligenceFabricPostDefaultHealthStatus {
  if (findings.some((finding) => finding.severity === 'blocker')) {
    return 'degraded';
  }
  if (
    summary.fabricRuns < thresholds.minRuns
    || findings.some((finding) => finding.severity === 'warning')
  ) {
    return 'attention';
  }
  return 'ready';
}

function resolveRecommendation(
  status: IntelligenceFabricPostDefaultHealthStatus,
  findings: IntelligenceFabricPostDefaultHealthSnapshot['findings'],
): IntelligenceFabricPostDefaultHealthRecommendation {
  if (status === 'degraded' && findings.some((finding) => finding.severity === 'blocker')) {
    return 'auto_demote_controlled';
  }
  if (status === 'attention') {
    return 'observe';
  }
  return 'maintain_default';
}

function rate(count: number, total: number): number {
  return total > 0 ? round(count / total) : 0;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return Math.round(sorted[index]);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function formatRate(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
