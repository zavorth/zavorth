export type PluginOsBridgePlugin = {
  pluginId: string;
  installed: boolean;
  enabled: boolean;
  trust: 'review' | 'trusted' | 'blocked' | string;
  runtimeState: string;
  loadEligible?: boolean;
  findings?: string[];
  installedRevision?: string | null;
  sourceLocator?: string | null;
  packageDir?: string | null;
};

export type PluginOsMarketplaceEntry = {
  id: string;
  name: string;
  summary?: string;
  tier?: string;
  moduleKind?: string;
  tags?: string[];
  enabled: boolean;
  installed: boolean;
  enableHint: string;
};

export type PluginOsMetricsSummary = {
  health: 'healthy' | 'degraded' | 'empty' | string;
  discovered: number;
  loadEligible: number;
  enabled: number;
  firstPartyEnabled: number;
  firstPartyTotal: number;
  mcpConfigured: number;
  mcpEnabled: number;
  forgeReceipts: number;
  hotFindings: number;
};

export type PluginOsPlanePanelData = {
  plugins: PluginOsBridgePlugin[];
  discovery: {
    total: number;
    valid: number;
    loadEligible: number;
    selected: number;
    failed?: number;
  } | null;
  generatedAt: string | null;
  root: string | null;
  commands: string[];
  marketplace: PluginOsMarketplaceEntry[];
  metrics: PluginOsMetricsSummary | null;
  deepLinks: string[];
};

export type PluginOsControlPlaneSnapshotLike = {
  generatedAt?: string;
  root?: string;
  plugins?: Array<Record<string, unknown>>;
  discovery?: {
    total?: number;
    valid?: number;
    loadEligible?: number;
    selected?: number;
    failed?: number;
  } | null;
  commands?: string[];
  curatedMarketplace?: Array<Record<string, unknown>>;
  metrics?: {
    health?: string;
    funnel?: {
      discovered?: number;
      loadEligible?: number;
      enabled?: number;
    };
    marketplace?: {
      firstPartyEnabled?: number;
      firstPartyTotal?: number;
    };
    mcp?: {
      serversConfigured?: number;
      serversEnabled?: number;
    };
    receipts?: {
      forgeReceiptFiles?: number;
    };
    hotFindings?: unknown[];
    deepLinks?: string[];
  } | null;
  deepLinks?: string[];
};

/**
 * Map Plugin OS control-plane snapshot JSON into panel props (pure, no Electron).
 */
export function mapPluginOsSnapshotToPanelData(
  snapshot: PluginOsControlPlaneSnapshotLike | null | undefined,
): PluginOsPlanePanelData {
  if (!snapshot || typeof snapshot !== 'object') {
    return {
      plugins: [],
      discovery: null,
      generatedAt: null,
      root: null,
      commands: [],
      marketplace: [],
      metrics: null,
      deepLinks: [],
    };
  }

  const plugins = Array.isArray(snapshot.plugins)
    ? snapshot.plugins.map(mapPluginEntry).filter((entry): entry is PluginOsBridgePlugin => Boolean(entry))
    : [];

  const discovery = snapshot.discovery
    ? {
      total: Number(snapshot.discovery.total || 0),
      valid: Number(snapshot.discovery.valid || 0),
      loadEligible: Number(snapshot.discovery.loadEligible || 0),
      selected: Number(snapshot.discovery.selected || 0),
      failed: snapshot.discovery.failed !== undefined
        ? Number(snapshot.discovery.failed)
        : undefined,
    }
    : null;

  const marketplace = Array.isArray(snapshot.curatedMarketplace)
    ? snapshot.curatedMarketplace
      .map(mapMarketplaceEntry)
      .filter((entry): entry is PluginOsMarketplaceEntry => Boolean(entry))
    : [];

  const metrics = snapshot.metrics
    ? {
      health: String(snapshot.metrics.health || 'empty'),
      discovered: Number(snapshot.metrics.funnel?.discovered || discovery?.total || 0),
      loadEligible: Number(snapshot.metrics.funnel?.loadEligible || discovery?.loadEligible || 0),
      enabled: Number(snapshot.metrics.funnel?.enabled || plugins.filter((p) => p.enabled).length),
      firstPartyEnabled: Number(snapshot.metrics.marketplace?.firstPartyEnabled || 0),
      firstPartyTotal: Number(snapshot.metrics.marketplace?.firstPartyTotal || 0),
      mcpConfigured: Number(snapshot.metrics.mcp?.serversConfigured || 0),
      mcpEnabled: Number(snapshot.metrics.mcp?.serversEnabled || 0),
      forgeReceipts: Number(snapshot.metrics.receipts?.forgeReceiptFiles || 0),
      hotFindings: Array.isArray(snapshot.metrics.hotFindings)
        ? snapshot.metrics.hotFindings.length
        : 0,
    }
    : null;

  const deepLinks = Array.isArray(snapshot.deepLinks)
    ? snapshot.deepLinks.map(String)
    : Array.isArray(snapshot.metrics?.deepLinks)
      ? snapshot.metrics!.deepLinks!.map(String)
      : [];

  return {
    plugins,
    discovery,
    generatedAt: snapshot.generatedAt ? String(snapshot.generatedAt) : null,
    root: snapshot.root ? String(snapshot.root) : null,
    commands: Array.isArray(snapshot.commands)
      ? snapshot.commands.map(String)
      : [],
    marketplace,
    metrics,
    deepLinks,
  };
}

export function mapPluginEntry(raw: Record<string, unknown> | null | undefined): PluginOsBridgePlugin | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const pluginId = String(raw.pluginId || raw.id || '').trim();
  if (!pluginId) {
    return null;
  }
  const findings = Array.isArray(raw.findings)
    ? raw.findings.map(String)
    : Array.isArray((raw as { doctor?: { findings?: unknown[] } }).doctor?.findings)
      ? ((raw as { doctor: { findings: unknown[] } }).doctor.findings.map(String))
      : [];

  return {
    pluginId,
    installed: Boolean(raw.installed),
    enabled: Boolean(raw.enabled),
    trust: String(raw.trust || 'review'),
    runtimeState: String(raw.runtimeState || raw.state || 'available'),
    loadEligible: raw.loadEligible === undefined ? undefined : Boolean(raw.loadEligible),
    findings,
    installedRevision: raw.installedRevision != null ? String(raw.installedRevision) : null,
    sourceLocator: raw.sourceLocator != null ? String(raw.sourceLocator) : null,
    packageDir: raw.packageDir != null ? String(raw.packageDir) : null,
  };
}

export function mapMarketplaceEntry(
  raw: Record<string, unknown> | null | undefined,
): PluginOsMarketplaceEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || raw.pluginId || '').trim();
  if (!id) return null;
  return {
    id,
    name: String(raw.name || id),
    summary: raw.summary != null ? String(raw.summary) : undefined,
    tier: raw.tier != null ? String(raw.tier) : undefined,
    moduleKind: raw.moduleKind != null ? String(raw.moduleKind) : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    enabled: Boolean(raw.enabled),
    installed: Boolean(raw.installed),
    enableHint: String(raw.enableHint || `zavorth plugins enable ${id} --yes`),
  };
}

export function summarizePluginOsPlane(data: PluginOsPlanePanelData): {
  total: number;
  installed: number;
  enabled: number;
  blocked: number;
  marketplaceOff: number;
  health: string;
} {
  return {
    total: data.plugins.length,
    installed: data.plugins.filter((plugin) => plugin.installed).length,
    enabled: data.plugins.filter((plugin) => plugin.enabled).length,
    blocked: data.plugins.filter((plugin) => plugin.trust === 'blocked').length,
    marketplaceOff: data.marketplace.filter((entry) => !entry.enabled).length,
    health: data.metrics?.health || 'unknown',
  };
}

/** Human-friendly row status for Plugin OS packages. */
export type HumanPluginStatus = 'active' | 'available' | 'needs_setup' | 'blocked';

export type HumanPluginStatusLabels = Partial<Record<HumanPluginStatus, string>>;

export type HumanTrustLabels = Partial<Record<'review' | 'trusted' | 'blocked' | string, string>>;

/** Default English status labels (UI should prefer i18n via labels arg). */
export const DEFAULT_HUMAN_PLUGIN_STATUS_LABELS: Record<HumanPluginStatus, string> = {
  active: 'Active',
  available: 'Available',
  needs_setup: 'Needs setup',
  blocked: 'Blocked',
};

/** Default English trust value labels. */
export const DEFAULT_HUMAN_TRUST_LABELS: Record<string, string> = {
  review: 'Needs review',
  trusted: 'Trusted',
  blocked: 'Blocked',
};

/**
 * Map a plugin row to a simple human status:
 * Active / Available / Needs setup / Blocked.
 */
export function humanPluginStatus(
  plugin: Pick<PluginOsBridgePlugin, 'enabled' | 'installed' | 'trust' | 'loadEligible' | 'runtimeState'>,
): HumanPluginStatus {
  const trust = String(plugin.trust || '').toLowerCase();
  const runtime = String(plugin.runtimeState || '').toLowerCase();

  if (trust === 'blocked' || runtime === 'blocked') {
    return 'blocked';
  }
  if (plugin.enabled || runtime === 'enabled' || runtime === 'active') {
    return 'active';
  }
  // Installed but not ready, or still waiting on trust review.
  if (
    plugin.installed
    && (plugin.loadEligible === false || trust === 'review' || runtime === 'needs_setup' || runtime === 'error')
  ) {
    return 'needs_setup';
  }
  return 'available';
}

/** Resolve a localized (or default) label for {@link humanPluginStatus}. */
export function humanPluginStatusLabel(
  status: HumanPluginStatus,
  labels?: HumanPluginStatusLabels | null,
): string {
  return labels?.[status] || DEFAULT_HUMAN_PLUGIN_STATUS_LABELS[status] || status;
}

/**
 * Map raw trust tokens to human copy.
 * review → Needs review · trusted → Trusted · blocked → Blocked
 */
export function humanTrustLabel(
  trust: string | null | undefined,
  labels?: HumanTrustLabels | null,
): string {
  const key = String(trust || 'review').toLowerCase();
  if (labels?.[key]) return labels[key]!;
  if (DEFAULT_HUMAN_TRUST_LABELS[key]) return DEFAULT_HUMAN_TRUST_LABELS[key];
  return String(trust || 'review');
}

/**
 * Friendly metric strip keys → DEFAULT_LABELS / i18n field names.
 * Keeps panel free of "funnel" / "loadEligible" jargon in UI copy.
 */
export const FRIENDLY_METRICS_LABEL_KEYS = {
  health: 'health',
  /** Was "Load funnel" — show as Coverage / Status */
  coverage: 'coverage',
  /** alias retained for older call sites */
  funnel: 'coverage',
  firstParty: 'firstParty',
  mcp: 'mcp',
  forge: 'forge',
  /** Was "Load eligible" — Ready to load */
  readyToLoad: 'eligible',
} as const;

export type FriendlyMetricsLabelKey = keyof typeof FRIENDLY_METRICS_LABEL_KEYS;

/** Resolve which UI label field to use for a metrics strip cell. */
export function friendlyMetricsLabelField(metric: FriendlyMetricsLabelKey | string): string {
  if (metric in FRIENDLY_METRICS_LABEL_KEYS) {
    return FRIENDLY_METRICS_LABEL_KEYS[metric as FriendlyMetricsLabelKey];
  }
  return metric;
}

/**
 * Build the short status line used under a plugin name in the list row.
 * Example: "Trusted · Active"
 */
export function humanPluginStatusLine(
  plugin: Pick<PluginOsBridgePlugin, 'enabled' | 'installed' | 'trust' | 'loadEligible' | 'runtimeState'>,
  opts?: {
    statusLabels?: HumanPluginStatusLabels | null;
    trustLabels?: HumanTrustLabels | null;
  },
): string {
  const status = humanPluginStatus(plugin);
  const trustText = humanTrustLabel(plugin.trust, opts?.trustLabels);
  const statusText = humanPluginStatusLabel(status, opts?.statusLabels);
  return `${trustText} · ${statusText}`;
}
