import fs from 'fs';
import path from 'path';
import { asErrorLike } from '../utils/errorLike.js';

type JsonObject = Record<string, unknown>;

export type MinimalDesktopResourceHistoryCompactionPolicy = {
  maxHistoryBytes: number;
  keepFullSnapshots: number;
  maxGroups: number;
  maxGroupItemSamples: number;
  maxGroupActions: number;
  maxTopConsumers: number;
  maxItemDetails: number;
  maxRecommendedActions: number;
  maxRecommendations: number;
  maxWarnings: number;
  maxSignalWarnings: number;
};

export type MinimalDesktopResourceHistoryCompactionPlanStatus =
  | 'missing'
  | 'kept'
  | 'planned'
  | 'manual'
  | 'applied'
  | 'skipped';

export type MinimalDesktopResourceHistoryCompactionPlan = {
  version: 1;
  historyFile: string;
  exists: boolean;
  status: MinimalDesktopResourceHistoryCompactionPlanStatus;
  currentBytes: number;
  estimatedBytes: number;
  lineCount: number;
  currentSnapshots: number;
  keptFullSnapshots: number;
  compactedSnapshots: number;
  newlyCompactableSnapshots: number;
  invalidLines: number;
  wouldMutate: boolean;
  backupFile: string | null;
  message: string;
  reason: string;
  errors: Array<{
    line: number;
    reason: string;
  }>;
};

export type MinimalDesktopResourceHistoryCompactorOptions = {
  historyFile: string;
  backupFile?: string;
  policy?: Partial<MinimalDesktopResourceHistoryCompactionPolicy>;
  now?: () => Date;
};

export type MinimalDesktopResourceHistoryCompactionOptions = {
  apply?: boolean;
};

export type MinimalDesktopResourceHistoryEntryOptions = {
  policy?: Partial<MinimalDesktopResourceHistoryCompactionPolicy>;
  now?: () => Date;
};

const COMPACTION_VERSION = 1;

const DEFAULT_POLICY: MinimalDesktopResourceHistoryCompactionPolicy = {
  maxHistoryBytes: 524_288,
  keepFullSnapshots: 2,
  maxGroups: 8,
  maxGroupItemSamples: 5,
  maxGroupActions: 3,
  maxTopConsumers: 8,
  maxItemDetails: 4,
  maxRecommendedActions: 8,
  maxRecommendations: 8,
  maxWarnings: 8,
  maxSignalWarnings: 4,
};

type PreparedCompaction = {
  plan: MinimalDesktopResourceHistoryCompactionPlan;
  entries: unknown[];
  payload: string;
};

type JsonlReadResult = {
  lineCount: number;
  objects: unknown[];
  errors: Array<{
    line: number;
    reason: string;
  }>;
};

export class MinimalDesktopResourceHistoryCompactor {
  private readonly historyFile: string;
  private readonly backupFile?: string;
  private readonly policy: MinimalDesktopResourceHistoryCompactionPolicy;
  private readonly now: () => Date;

  public constructor(options: MinimalDesktopResourceHistoryCompactorOptions) {
    this.historyFile = options.historyFile;
    this.backupFile = options.backupFile;
    this.policy = normalizePolicy(options.policy);
    this.now = options.now || (() => new Date());
  }

  public buildPlan(): MinimalDesktopResourceHistoryCompactionPlan {
    return this.prepare().plan;
  }

  public compact(options: MinimalDesktopResourceHistoryCompactionOptions = {}): MinimalDesktopResourceHistoryCompactionPlan {
    const prepared = this.prepare();
    if (!options.apply || !prepared.plan.wouldMutate) {
      return prepared.plan;
    }

    const backupFile = prepared.plan.backupFile || this.createBackupPath();
    try {
      fs.mkdirSync(path.dirname(this.historyFile), { recursive: true });
      fs.mkdirSync(path.dirname(backupFile), { recursive: true });
      fs.copyFileSync(this.historyFile, backupFile);
      fs.writeFileSync(this.historyFile, prepared.payload, 'utf8');
      const updatedStats = fs.statSync(this.historyFile);
      return {
        ...prepared.plan,
        status: 'applied',
        currentBytes: updatedStats.size,
        estimatedBytes: updatedStats.size,
        wouldMutate: false,
        backupFile,
        message: `Desktop resource history compacted to ${prepared.plan.currentSnapshots} snapshots; ${prepared.plan.keptFullSnapshots} recent snapshots kept full.`,
        reason: 'desktop-resource-history-compacted',
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      return {
        ...prepared.plan,
        status: 'skipped',
        wouldMutate: false,
        message: 'Desktop resource history compaction failed; original file was left unchanged.',
        reason: error instanceof Error ? err.message : String(error),
      };
    }
  }

  private prepare(): PreparedCompaction {
    if (!fs.existsSync(this.historyFile)) {
      const plan: MinimalDesktopResourceHistoryCompactionPlan = {
        version: 1,
        historyFile: this.historyFile,
        exists: false,
        status: 'missing',
        currentBytes: 0,
        estimatedBytes: 0,
        lineCount: 0,
        currentSnapshots: 0,
        keptFullSnapshots: 0,
        compactedSnapshots: 0,
        newlyCompactableSnapshots: 0,
        invalidLines: 0,
        wouldMutate: false,
        backupFile: null,
        message: 'Desktop resource history file does not exist.',
        reason: 'missing',
        errors: [],
      };
      return { plan, entries: [], payload: '' };
    }

    const stats = fs.statSync(this.historyFile);
    const read = this.readJsonl();
    if (read.errors.length > 0) {
      const plan: MinimalDesktopResourceHistoryCompactionPlan = {
        version: 1,
        historyFile: this.historyFile,
        exists: true,
        status: 'manual',
        currentBytes: stats.size,
        estimatedBytes: stats.size,
        lineCount: read.lineCount,
        currentSnapshots: read.objects.length,
        keptFullSnapshots: 0,
        compactedSnapshots: 0,
        newlyCompactableSnapshots: 0,
        invalidLines: read.errors.length,
        wouldMutate: false,
        backupFile: null,
        message: 'Desktop resource history has invalid JSONL lines; inspect before compaction.',
        reason: 'desktop-resource-history-invalid',
        errors: read.errors,
      };
      return { plan, entries: read.objects, payload: '' };
    }

    const entries = compactDesktopResourceHistoryEntries(read.objects, {
      policy: this.policy,
      now: this.now,
    });
    const payload = stringifyJsonl(entries);
    const estimatedBytes = Buffer.byteLength(payload, 'utf8');
    const compactedSnapshots = entries.filter(isCompactedSnapshot).length;
    const fullSnapshotCount = Math.max(0, Math.min(this.policy.keepFullSnapshots, read.objects.length));
    const compactableSnapshots = countNewlyCompactableSnapshots(read.objects, this.policy.keepFullSnapshots);
    const overPolicy = stats.size > this.policy.maxHistoryBytes;
    const canShrink = estimatedBytes < stats.size;
    const wouldMutate = compactableSnapshots > 0 && canShrink && overPolicy;
    const status = wouldMutate
      ? 'planned'
      : overPolicy && !canShrink
        ? 'manual'
        : 'kept';
    const reason = wouldMutate
      ? 'desktop-resource-history-over-policy'
      : overPolicy && !canShrink
        ? 'desktop-resource-history-over-policy-no-safe-shrink'
        : 'within-policy';
    const message = wouldMutate
      ? `Desktop resource history can shrink from ${stats.size} bytes to about ${estimatedBytes} bytes while keeping ${fullSnapshotCount} recent snapshots full.`
      : overPolicy && !canShrink
        ? 'Desktop resource history is above policy, but no safe compaction would reduce it.'
        : 'Desktop resource history is within retention policy.';

    return {
      plan: {
        version: 1,
        historyFile: this.historyFile,
        exists: true,
        status,
        currentBytes: stats.size,
        estimatedBytes,
        lineCount: read.lineCount,
        currentSnapshots: read.objects.length,
        keptFullSnapshots: fullSnapshotCount,
        compactedSnapshots,
        newlyCompactableSnapshots: compactableSnapshots,
        invalidLines: 0,
        wouldMutate,
        backupFile: wouldMutate ? this.createBackupPath() : null,
        message,
        reason,
        errors: [],
      },
      entries,
      payload,
    };
  }

  private readJsonl(): JsonlReadResult {
    const lines = fs.readFileSync(this.historyFile, 'utf8').split(/\r?\n/);
    const objects: unknown[] = [];
    const errors: JsonlReadResult['errors'] = [];
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }
      try {
        objects.push(JSON.parse(trimmed));
      } catch (error: unknown) {
        const err = asErrorLike(error);
        errors.push({
          line: index + 1,
          reason: error instanceof Error ? err.message : String(error),
        });
      }
    });
    return {
      lineCount: lines.filter((line) => line.trim()).length,
      objects,
      errors,
    };
  }

  private createBackupPath(): string {
    if (this.backupFile) {
      return this.backupFile;
    }
    const stamp = this.now().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
    return `${this.historyFile}.${stamp}.bak`;
  }
}

export function compactDesktopResourceHistoryEntries(
  snapshots: unknown[],
  options: MinimalDesktopResourceHistoryEntryOptions = {},
): unknown[] {
  const policy = normalizePolicy(options.policy);
  const compactedAt = (options.now || (() => new Date()))().toISOString();
  const keepFullSnapshots = Math.max(0, Math.min(policy.keepFullSnapshots, snapshots.length));
  const firstFullIndex = Math.max(0, snapshots.length - keepFullSnapshots);

  return snapshots.map((snapshot, index) => {
    if (index >= firstFullIndex || isCompactedSnapshot(snapshot)) {
      return snapshot;
    }
    return compactDesktopResourceSnapshotForHistory(snapshot, {
      policy,
      compactedAt,
    });
  });
}

export function compactDesktopResourceSnapshotForHistory(
  snapshot: unknown,
  options: {
    policy?: Partial<MinimalDesktopResourceHistoryCompactionPolicy>;
    compactedAt?: string;
  } = {},
): unknown {
  const policy = normalizePolicy(options.policy);
  const compactedAt = options.compactedAt || new Date().toISOString();
  if (!isRecord(snapshot)) {
    return snapshot;
  }

  const groups = asArray(snapshot.groups);
  const items = asArray(snapshot.items);
  const topConsumers = asArray(snapshot.topConsumers);
  const recommendedActions = asArray(snapshot.recommendedActions);
  const warnings = toStringList(snapshot.warnings, policy.maxWarnings);
  const recommendations = toStringList(snapshot.recommendations, policy.maxRecommendations);

  return compactObject({
    version: snapshot.version || 1,
    generatedAt: snapshot.generatedAt,
    compacted: true,
    compactionVersion: COMPACTION_VERSION,
    compactedAt,
    host: compactHost(snapshot.host),
    signals: compactSignals(snapshot.signals, policy),
    totals: isRecord(snapshot.totals) ? snapshot.totals : undefined,
    groups: groups
      .filter(isRecord)
      .slice(0, policy.maxGroups)
      .map((group) => compactGroup(group, policy)),
    topConsumers: topConsumers
      .filter(isRecord)
      .slice(0, policy.maxTopConsumers)
      .map((item) => compactItem(item, policy)),
    recommendedActions: recommendedActions
      .filter(isRecord)
      .slice(0, policy.maxRecommendedActions)
      .map((action) => compactAction(action)),
    warnings,
    recommendations,
    originalCounts: {
      groups: groups.length,
      items: items.length,
      topConsumers: topConsumers.length,
      recommendedActions: recommendedActions.length,
      warnings: Array.isArray(snapshot.warnings) ? snapshot.warnings.length : 0,
      recommendations: Array.isArray(snapshot.recommendations) ? snapshot.recommendations.length : 0,
    },
  });
}

function normalizePolicy(policy: Partial<MinimalDesktopResourceHistoryCompactionPolicy> = {}): MinimalDesktopResourceHistoryCompactionPolicy {
  const merged = {
    ...DEFAULT_POLICY,
    ...policy,
  };
  return {
    maxHistoryBytes: positiveInteger(merged.maxHistoryBytes, DEFAULT_POLICY.maxHistoryBytes),
    keepFullSnapshots: nonNegativeInteger(merged.keepFullSnapshots, DEFAULT_POLICY.keepFullSnapshots),
    maxGroups: nonNegativeInteger(merged.maxGroups, DEFAULT_POLICY.maxGroups),
    maxGroupItemSamples: nonNegativeInteger(merged.maxGroupItemSamples, DEFAULT_POLICY.maxGroupItemSamples),
    maxGroupActions: nonNegativeInteger(merged.maxGroupActions, DEFAULT_POLICY.maxGroupActions),
    maxTopConsumers: nonNegativeInteger(merged.maxTopConsumers, DEFAULT_POLICY.maxTopConsumers),
    maxItemDetails: nonNegativeInteger(merged.maxItemDetails, DEFAULT_POLICY.maxItemDetails),
    maxRecommendedActions: nonNegativeInteger(merged.maxRecommendedActions, DEFAULT_POLICY.maxRecommendedActions),
    maxRecommendations: nonNegativeInteger(merged.maxRecommendations, DEFAULT_POLICY.maxRecommendations),
    maxWarnings: nonNegativeInteger(merged.maxWarnings, DEFAULT_POLICY.maxWarnings),
    maxSignalWarnings: nonNegativeInteger(merged.maxSignalWarnings, DEFAULT_POLICY.maxSignalWarnings),
  };
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function nonNegativeInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function stringifyJsonl(entries: unknown[]): string {
  return entries.length > 0 ? `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n` : '';
}

function countNewlyCompactableSnapshots(snapshots: unknown[], keepFullSnapshots: number): number {
  const fullSnapshotCount = Math.max(0, Math.min(nonNegativeInteger(keepFullSnapshots, 0), snapshots.length));
  const firstFullIndex = Math.max(0, snapshots.length - fullSnapshotCount);
  return snapshots
    .slice(0, firstFullIndex)
    .filter((snapshot) => !isCompactedSnapshot(snapshot))
    .length;
}

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isCompactedSnapshot(value: unknown): boolean {
  return isRecord(value) && value.compacted === true && value.compactionVersion === COMPACTION_VERSION;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function compactObject(value: JsonObject): JsonObject {
  const compacted: JsonObject = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined && entry !== null) {
      compacted[key] = entry;
    }
  }
  return compacted;
}

function pick(record: JsonObject, keys: string[]): JsonObject {
  const result: JsonObject = {};
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      result[key] = record[key];
    }
  }
  return result;
}

function compactHost(value: unknown): JsonObject | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return pick(value, [
    'hostname',
    'platform',
    'totalVisibleMemoryMb',
    'freePhysicalMemoryMb',
    'totalPhysicalMemoryMb',
    'memoryLoadPercent',
    'pressure',
    'usedPhysicalMemoryMb',
  ]);
}

function compactSignals(value: unknown, policy: MinimalDesktopResourceHistoryCompactionPolicy): JsonObject | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return compactObject({
    wsl: compactWslSignal(value.wsl, policy),
    docker: compactDockerSignal(value.docker, policy),
  });
}

function compactWslSignal(value: unknown, policy: MinimalDesktopResourceHistoryCompactionPolicy): JsonObject | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const distros = asArray(value.distros).filter(isRecord);
  const compactDistros = distros.slice(0, 3).map((distro) => pick(distro, ['name', 'state', 'version', 'isDefault']));
  return compactObject({
    ok: value.ok,
    message: value.message,
    distroCount: distros.length,
    runningDistroCount: distros.filter((distro) => String(distro.state || '').toLowerCase() === 'running').length,
    defaultDistro: distros.find((distro) => distro.isDefault === true)?.name,
    distros: compactDistros,
    warnings: toStringList(value.warnings, policy.maxSignalWarnings),
  });
}

function compactDockerSignal(value: unknown, policy: MinimalDesktopResourceHistoryCompactionPolicy): JsonObject | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return compactObject({
    detected: value.detected,
    status: value.status,
    runningContainerCount: value.runningContainerCount,
    contextName: value.contextName,
    warnings: toStringList(value.warnings, policy.maxSignalWarnings),
  });
}

function compactGroup(group: JsonObject, policy: MinimalDesktopResourceHistoryCompactionPolicy): JsonObject {
  const itemIds = toStringList(group.itemIds, policy.maxGroupItemSamples);
  return compactObject({
    ...pick(group, ['id', 'label', 'owner', 'pressure', 'summary', 'itemCount']),
    metrics: compactMetrics(group.metrics),
    sampleItemIds: itemIds,
    actions: asArray(group.actions)
      .filter(isRecord)
      .slice(0, policy.maxGroupActions)
      .map((action) => compactAction(action)),
  });
}

function compactItem(item: JsonObject, policy: MinimalDesktopResourceHistoryCompactionPolicy): JsonObject {
  return compactObject({
    ...pick(item, ['id', 'label', 'owner', 'kind', 'pressure', 'controlId', 'status', 'summary']),
    details: toStringList(item.details, policy.maxItemDetails),
    metrics: compactMetrics(item.metrics),
    process: compactProcess(item.process),
  });
}

function compactMetrics(value: unknown): JsonObject | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return pick(value, [
    'cpuSeconds',
    'workingSetMb',
    'pagedMemoryMb',
    'privateMemoryMb',
    'readTransferMb',
    'writeTransferMb',
  ]);
}

function compactProcess(value: unknown): JsonObject | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return pick(value, ['pid', 'processName', 'mainWindowTitle']);
}

function compactAction(action: JsonObject): JsonObject {
  return pick(action, ['actionId', 'label', 'description', 'safety', 'requiresApproval', 'controlId']);
}

function toStringList(value: unknown, limit: number): string[] {
  return asArray(value)
    .filter((entry): entry is string => typeof entry === 'string')
    .slice(0, limit);
}
