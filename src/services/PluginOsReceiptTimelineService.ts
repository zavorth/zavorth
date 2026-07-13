import fs from 'node:fs';
import path from 'node:path';

export type PluginOsReceiptTimelineEntry = {
  id: string;
  kind: string;
  pluginId: string | null;
  createdAt: string;
  /** Human one-liner, e.g. "Plugin forge applied foo at 14:02". */
  headline: string;
  detail?: string;
  action?: string | null;
  source: 'ledger' | 'forge-file' | 'metrics' | 'telemetry';
};

export type PluginOsReceiptTimeline = {
  generatedAt: string;
  root: string;
  entries: PluginOsReceiptTimelineEntry[];
  formatText(): string;
};

export type PluginOsReceiptTimelineRuntime = {
  now?: () => Date;
  projectRoot?: string;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  readdirSync?: typeof fs.readdirSync;
};

/**
 * Human-readable Plugin OS activity timeline from ledgers and forge receipts.
 */
export class PluginOsReceiptTimelineService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly readdirSync: typeof fs.readdirSync;

  constructor(runtime: PluginOsReceiptTimelineRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
  }

  public buildTimeline(options: {
    root?: string;
    limit?: number;
  } = {}): PluginOsReceiptTimeline {
    const root = path.resolve(options.root || this.projectRoot);
    const limit = Math.max(5, Math.min(100, Number(options.limit) || 30));
    const entries: PluginOsReceiptTimelineEntry[] = [];

    // Shared plugins.jsonl ledger
    const ledgerPath = path.join(root, '.zavorth', 'receipts', 'plugins.jsonl');
    if (this.existsSync(ledgerPath)) {
      try {
        const lines = this.readFileSync(ledgerPath, 'utf8')
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        for (const line of lines) {
          try {
            const raw = JSON.parse(line) as Record<string, unknown>;
            const entry = fromLedger(raw);
            if (entry) entries.push(entry);
          } catch {
            /* skip bad line */
          }
        }
      } catch {
        /* soft */
      }
    }

    // Individual forge receipt files
    const forgeDir = path.join(root, '.zavorth', 'plugin-forge', 'receipts');
    if (this.existsSync(forgeDir)) {
      try {
        const files = this.readdirSync(forgeDir)
          .map(String)
          .filter((name) => name.endsWith('.json'))
          .sort();
        for (const name of files.slice(-40)) {
          try {
            const raw = JSON.parse(
              this.readFileSync(path.join(forgeDir, name), 'utf8'),
            ) as Record<string, unknown>;
            const entry = fromForgeFile(raw, name);
            if (entry && !entries.some((e) => e.id === entry.id)) {
              entries.push(entry);
            }
          } catch {
            /* skip */
          }
        }
      } catch {
        /* soft */
      }
    }

    // Metrics snapshot (single latest)
    const metricsPath = path.join(root, '.zavorth', 'receipts', 'plugin-os-metrics.json');
    if (this.existsSync(metricsPath)) {
      try {
        const raw = JSON.parse(this.readFileSync(metricsPath, 'utf8')) as Record<string, unknown>;
        const generatedAt = String(raw.generatedAt || this.now().toISOString());
        const health = String((raw as { health?: string }).health || 'unknown');
        const funnel = (raw as { funnel?: { enabled?: number; loadEligible?: number } }).funnel || {};
        entries.push({
          id: `metrics-${generatedAt}`,
          kind: 'plugin.os.metrics',
          pluginId: null,
          createdAt: generatedAt,
          headline: `Plugin OS health ${health} at ${formatClock(generatedAt)}`,
          detail: `enabled=${funnel.enabled ?? '?'} ready=${funnel.loadEligible ?? '?'}`,
          action: 'metrics',
          source: 'metrics',
        });
      } catch {
        /* soft */
      }
    }

    entries.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const sliced = entries.slice(0, limit);

    return {
      generatedAt: this.now().toISOString(),
      root,
      entries: sliced,
      formatText() {
        if (sliced.length === 0) {
          return 'Plugin OS activity: (none yet)';
        }
        const lines = [
          `Plugin OS activity (${sliced.length})`,
          ...sliced.map((entry) => `  · ${entry.headline}${entry.detail ? ` — ${entry.detail}` : ''}`),
        ];
        return lines.join('\n');
      },
    };
  }
}

function fromLedger(raw: Record<string, unknown>): PluginOsReceiptTimelineEntry | null {
  const kind = String(raw.kind || raw.action || 'plugin.event');
  const pluginId = raw.pluginId != null ? String(raw.pluginId) : null;
  const createdAt = String(raw.createdAt || raw.generatedAt || '');
  if (!createdAt) return null;
  const id = String(raw.id || `${kind}-${pluginId || 'x'}-${createdAt}`);
  const action = raw.action != null ? String(raw.action) : null;
  const clock = formatClock(createdAt);

  let headline = `${humanKind(kind)}${pluginId ? ` · ${pluginId}` : ''} at ${clock}`;
  if (kind === 'plugin.forge.apply' || action === 'forge.apply') {
    headline = `Plugin forge applied ${pluginId || 'package'} at ${clock}`;
  } else if (action === 'enable' || kind.includes('enable')) {
    headline = `Enabled plugin ${pluginId || '?'} at ${clock}`;
  } else if (action === 'disable' || kind.includes('disable')) {
    headline = `Disabled plugin ${pluginId || '?'} at ${clock}`;
  } else if (kind === 'plugin.os.bootstrap' || action === 'bootstrap') {
    headline = `Plugin OS bootstrap finished at ${clock}`;
  } else if (kind === 'plugin.os.metrics') {
    headline = `Plugin OS metrics snapshot at ${clock}`;
  } else if (kind.includes('onboarding') || action === 'onboarding' || action === 'undo') {
    const undone = String((raw.meta as { action?: string } | undefined)?.action || action || '') === 'undo'
      || String(raw.action || '') === 'undo';
    headline = undone
      ? `Onboarding undone at ${clock}`
      : `Onboarding applied${pluginId ? ` (${pluginId})` : ''} at ${clock}`;
  }

  const detailParts = [
    raw.testOk === false ? 'tests soft-failed' : null,
    raw.enable === true ? 'also enabled' : null,
    raw.receiptPath ? `receipt ${raw.receiptPath}` : null,
  ].filter(Boolean);

  return {
    id,
    kind,
    pluginId,
    createdAt,
    headline,
    detail: detailParts.length ? detailParts.join(' · ') : undefined,
    action,
    source: 'ledger',
  };
}

function fromForgeFile(raw: Record<string, unknown>, fileName: string): PluginOsReceiptTimelineEntry | null {
  const pluginId = raw.pluginId != null ? String(raw.pluginId) : fileName.replace(/\.json$/u, '');
  const createdAt = String(raw.createdAt || '');
  if (!createdAt) return null;
  const clock = formatClock(createdAt);
  return {
    id: String(raw.receiptPath || `forge-file-${fileName}`),
    kind: String(raw.kind || 'plugin.forge.apply'),
    pluginId,
    createdAt,
    headline: `Plugin forge applied ${pluginId} at ${clock}`,
    detail: raw.enable === true ? 'enabled after apply' : 'not auto-enabled',
    action: 'forge.apply',
    source: 'forge-file',
  };
}

function humanKind(kind: string): string {
  const map: Record<string, string> = {
    'plugin.forge.apply': 'Forge apply',
    'plugin.os.metrics': 'Metrics',
    'plugin.os.bootstrap': 'Bootstrap',
    sample: 'Health sample',
    recommend: 'Recommend',
    enable: 'Enable',
    disable: 'Disable',
    onboarding: 'Onboarding',
  };
  return map[kind] || kind.replace(/^plugin\./u, '').replace(/\./gu, ' ');
}

function formatClock(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
