import fs from 'node:fs';
import path from 'node:path';

import {
  PluginOsObservabilityService,
  type PluginOsObservabilitySnapshot,
} from './PluginOsObservabilityService.js';

export type PluginOsTelemetryEventKind =
  | 'sample'
  | 'bootstrap'
  | 'recommend'
  | 'enable'
  | 'disable'
  | 'catalog-apply'
  | 'onboarding'
  | 'prompt-inject'
  | 'load';

export type PluginOsTelemetryEvent = {
  id: string;
  kind: PluginOsTelemetryEventKind;
  createdAt: string;
  pluginId?: string | null;
  intent?: string | null;
  health?: string | null;
  profile?: string | null;
  counts?: Record<string, number>;
  meta?: Record<string, unknown>;
};

export type PluginOsTelemetryAggregate = {
  generatedAt: string;
  root: string;
  windowHours: number;
  eventCount: number;
  samples: number;
  byKind: Record<string, number>;
  healthCounts: Record<string, number>;
  lastHealth: string | null;
  lastSampleAt: string | null;
  recommendCount: number;
  enableCount: number;
  disableCount: number;
  onboardingCount: number;
  promptInjectCount: number;
  avgEnabled: number | null;
  avgEligible: number | null;
  avgFirstPartyEnabled: number | null;
  topIntents: Array<{ intent: string; count: number }>;
  recent: PluginOsTelemetryEvent[];
  formatText(): string;
};

export type PluginOsTelemetryHistoryPoint = {
  bucketStart: string;
  samples: number;
  recommends: number;
  enables: number;
  avgEnabled: number | null;
  avgEligible: number | null;
  health: string | null;
};

export type PluginOsTelemetryHistory = {
  generatedAt: string;
  root: string;
  windowHours: number;
  bucketHours: number;
  points: PluginOsTelemetryHistoryPoint[];
  formatText(): string;
};

export type PluginOsTelemetryRuntime = {
  now?: () => Date;
  projectRoot?: string;
  observability?: PluginOsObservabilityService;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  appendFileSync?: typeof fs.appendFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  windowHours?: number;
  maxEvents?: number;
};

/**
 * Aggregated Plugin OS telemetry over a rolling JSONL ledger.
 * Soft-fail: never throws for missing files / partial lines.
 */
export class PluginOsTelemetryService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly observability: PluginOsObservabilityService | null;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly appendFileSync: typeof fs.appendFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly windowHours: number;
  private readonly maxEvents: number;

  constructor(runtime: PluginOsTelemetryRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.observability = runtime.observability || null;
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.appendFileSync = runtime.appendFileSync || fs.appendFileSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.windowHours = Math.max(1, Number(runtime.windowHours) || 168);
    this.maxEvents = Math.max(50, Number(runtime.maxEvents) || 2000);
  }

  public ledgerPath(root?: string): string {
    return path.join(
      path.resolve(root || this.projectRoot),
      '.zavorth',
      'receipts',
      'plugin-os-telemetry.jsonl',
    );
  }

  public recordEvent(
    kind: PluginOsTelemetryEventKind,
    input: {
      root?: string;
      pluginId?: string | null;
      intent?: string | null;
      health?: string | null;
      profile?: string | null;
      counts?: Record<string, number>;
      meta?: Record<string, unknown>;
    } = {},
  ): PluginOsTelemetryEvent {
    const root = path.resolve(input.root || this.projectRoot);
    const createdAt = this.now().toISOString();
    const event: PluginOsTelemetryEvent = {
      id: `plugin-os-tel-${kind}-${createdAt.replace(/[:.]/gu, '')}-${Math.random().toString(36).slice(2, 8)}`,
      kind,
      createdAt,
      pluginId: input.pluginId ?? null,
      intent: input.intent ?? null,
      health: input.health ?? null,
      profile: input.profile ?? null,
      counts: input.counts || undefined,
      meta: input.meta || undefined,
    };

    try {
      const filePath = this.ledgerPath(root);
      this.mkdirSync(path.dirname(filePath), { recursive: true });
      this.appendFileSync(filePath, `${JSON.stringify(event)}\n`, 'utf8');
    } catch {
      /* soft-fail ledger */
    }

    return event;
  }

  public recordSample(options: {
    root?: string;
    snapshot?: PluginOsObservabilitySnapshot | null;
  } = {}): PluginOsTelemetryEvent {
    const root = path.resolve(options.root || this.projectRoot);
    let snapshot = options.snapshot || null;
    if (!snapshot) {
      try {
        const obs = this.observability || new PluginOsObservabilityService({
          now: this.now,
          projectRoot: root,
        });
        snapshot = obs.buildSnapshot(root);
      } catch {
        snapshot = null;
      }
    }

    return this.recordEvent('sample', {
      root,
      health: snapshot?.health || null,
      counts: snapshot
        ? {
          discovered: snapshot.funnel.discovered,
          eligible: snapshot.funnel.loadEligible,
          enabled: snapshot.funnel.enabled,
          firstPartyEnabled: snapshot.marketplace.firstPartyEnabled,
          firstPartyTotal: snapshot.marketplace.firstPartyTotal,
          mcpConfigured: snapshot.mcp.serversConfigured,
          mcpEnabled: snapshot.mcp.serversEnabled,
        }
        : undefined,
      meta: snapshot
        ? {
          bootstrapTargets: snapshot.bootstrap.targets,
          forgeReceipts: snapshot.receipts.forgeReceiptFiles,
        }
        : undefined,
    });
  }

  public history(options: {
    root?: string;
    windowHours?: number;
    bucketHours?: number;
  } = {}): PluginOsTelemetryHistory {
    const root = path.resolve(options.root || this.projectRoot);
    const windowHours = Math.max(1, Number(options.windowHours) || this.windowHours);
    const bucketHours = Math.max(1, Number(options.bucketHours) || 6);
    const cutoff = this.now().getTime() - windowHours * 3600_000;
    const events = this.readEvents(root).filter((event) => {
      const ts = Date.parse(event.createdAt);
      return Number.isFinite(ts) ? ts >= cutoff : false;
    });

    const bucketMs = bucketHours * 3600_000;
    const buckets = new Map<number, {
      samples: number;
      recommends: number;
      enables: number;
      sumEnabled: number;
      sumEligible: number;
      sampleWithCounts: number;
      lastHealth: string | null;
    }>();

    for (const event of events) {
      const ts = Date.parse(event.createdAt);
      if (!Number.isFinite(ts)) continue;
      const key = Math.floor(ts / bucketMs) * bucketMs;
      const bucket = buckets.get(key) || {
        samples: 0,
        recommends: 0,
        enables: 0,
        sumEnabled: 0,
        sumEligible: 0,
        sampleWithCounts: 0,
        lastHealth: null,
      };
      if (event.kind === 'sample') {
        bucket.samples += 1;
        if (event.health) bucket.lastHealth = event.health;
        if (event.counts) {
          bucket.sampleWithCounts += 1;
          bucket.sumEnabled += Number(event.counts.enabled || 0);
          bucket.sumEligible += Number(event.counts.eligible || 0);
        }
      }
      if (event.kind === 'recommend') bucket.recommends += 1;
      if (event.kind === 'enable') bucket.enables += 1;
      buckets.set(key, bucket);
    }

    const points: PluginOsTelemetryHistoryPoint[] = Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([start, bucket]) => ({
        bucketStart: new Date(start).toISOString(),
        samples: bucket.samples,
        recommends: bucket.recommends,
        enables: bucket.enables,
        avgEnabled: bucket.sampleWithCounts ? bucket.sumEnabled / bucket.sampleWithCounts : null,
        avgEligible: bucket.sampleWithCounts ? bucket.sumEligible / bucket.sampleWithCounts : null,
        health: bucket.lastHealth,
      }));

    return {
      generatedAt: this.now().toISOString(),
      root,
      windowHours,
      bucketHours,
      points,
      formatText() {
        const lines = [
          'Plugin OS telemetry history',
          `window=${windowHours}h bucket=${bucketHours}h points=${points.length}`,
          ...points.slice(-24).map((point) => (
            `  ${point.bucketStart} samples=${point.samples} rec=${point.recommends} en=${point.enables} avgEnabled=${point.avgEnabled == null ? 'n/a' : point.avgEnabled.toFixed(1)} health=${point.health || 'n/a'}`
          )),
        ];
        return lines.join('\n');
      },
    };
  }

  public aggregate(options: { root?: string; windowHours?: number } = {}): PluginOsTelemetryAggregate {
    const root = path.resolve(options.root || this.projectRoot);
    const windowHours = Math.max(1, Number(options.windowHours) || this.windowHours);
    const cutoff = this.now().getTime() - windowHours * 3600_000;
    const events = this.readEvents(root)
      .filter((event) => {
        const ts = Date.parse(event.createdAt);
        return Number.isFinite(ts) ? ts >= cutoff : true;
      })
      .slice(-this.maxEvents);

    const byKind: Record<string, number> = {};
    const healthCounts: Record<string, number> = {};
    const intentCounts = new Map<string, number>();
    let samples = 0;
    let sumEnabled = 0;
    let sumEligible = 0;
    let sumFp = 0;
    let sampleWithCounts = 0;
    let lastHealth: string | null = null;
    let lastSampleAt: string | null = null;

    for (const event of events) {
      byKind[event.kind] = (byKind[event.kind] || 0) + 1;
      if (event.health) {
        healthCounts[event.health] = (healthCounts[event.health] || 0) + 1;
        lastHealth = event.health;
      }
      if (event.kind === 'sample') {
        samples += 1;
        lastSampleAt = event.createdAt;
        if (event.counts) {
          sampleWithCounts += 1;
          sumEnabled += Number(event.counts.enabled || 0);
          sumEligible += Number(event.counts.eligible || 0);
          sumFp += Number(event.counts.firstPartyEnabled || 0);
        }
      }
      if (event.kind === 'recommend' && event.intent) {
        const key = event.intent.toLowerCase().slice(0, 80);
        intentCounts.set(key, (intentCounts.get(key) || 0) + 1);
      }
    }

    const topIntents = Array.from(intentCounts.entries())
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count || a.intent.localeCompare(b.intent))
      .slice(0, 10);

    const view: Omit<PluginOsTelemetryAggregate, 'formatText'> = {
      generatedAt: this.now().toISOString(),
      root,
      windowHours,
      eventCount: events.length,
      samples,
      byKind,
      healthCounts,
      lastHealth,
      lastSampleAt,
      recommendCount: byKind.recommend || 0,
      enableCount: byKind.enable || 0,
      disableCount: byKind.disable || 0,
      onboardingCount: byKind.onboarding || 0,
      promptInjectCount: byKind['prompt-inject'] || 0,
      avgEnabled: sampleWithCounts ? sumEnabled / sampleWithCounts : null,
      avgEligible: sampleWithCounts ? sumEligible / sampleWithCounts : null,
      avgFirstPartyEnabled: sampleWithCounts ? sumFp / sampleWithCounts : null,
      topIntents,
      recent: events.slice(-20).reverse(),
    };

    return {
      ...view,
      formatText: () => formatAggregate(view),
    };
  }

  private readEvents(root: string): PluginOsTelemetryEvent[] {
    const filePath = this.ledgerPath(root);
    if (!this.existsSync(filePath)) return [];
    try {
      const text = this.readFileSync(filePath, 'utf8');
      return text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as PluginOsTelemetryEvent;
          } catch {
            return null;
          }
        })
        .filter((entry): entry is PluginOsTelemetryEvent => Boolean(entry && entry.kind && entry.createdAt));
    } catch {
      return [];
    }
  }
}

function formatAggregate(view: Omit<PluginOsTelemetryAggregate, 'formatText'>): string {
  const lines = [
    'Zavorth Plugin OS telemetry',
    `Generated: ${view.generatedAt}`,
    `Window: ${view.windowHours}h · events=${view.eventCount} samples=${view.samples}`,
    `Last health: ${view.lastHealth || 'n/a'} @ ${view.lastSampleAt || 'n/a'}`,
    `Recommend=${view.recommendCount} enable=${view.enableCount} disable=${view.disableCount} onboarding=${view.onboardingCount} promptInject=${view.promptInjectCount}`,
    view.avgEnabled != null ? `Averages: enabled=${view.avgEnabled.toFixed(1)} eligible=${(view.avgEligible || 0).toFixed(1)} firstParty=${(view.avgFirstPartyEnabled || 0).toFixed(1)}`
      : 'Averages: n/a (no samples with counts)',
    '',
    'By kind:',
    ...Object.entries(view.byKind)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([kind, count]) => ` ? ${kind}: ${count}`),
  ];

  if (Object.keys(view.healthCounts).length) {
    lines.push('', 'Health distribution:');
    for (const [health, count] of Object.entries(view.healthCounts).sort((a, b) => b[1] - a[1])) {
      lines.push(`  - ${health}: ${count}`);
    }
  }

  if (view.topIntents.length) {
    lines.push('', 'Top recommend intents:');
    for (const item of view.topIntents) {
      lines.push(`  - ${item.intent} (${item.count})`);
    }
  }

  return lines.join('\n');
}
