import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_CAPABILITY_LIFECYCLE_CONTRACT_VERSION,
  type ZavorthCapabilityLifecycleDecision,
  type ZavorthCapabilityLifecycleDecisionKind,
  type ZavorthCapabilityLifecyclePreview,
  type ZavorthCapabilityLifecycleReceipt,
  type ZavorthCapabilityLifecycleRunInput,
  type ZavorthCapabilityLifecycleSnapshot,
} from '../contracts/ZavorthCapabilityLifecycleContract.js';
import type {
  ZavorthCapabilityUsageActionSummary,
  ZavorthCapabilityUsageSignalsSnapshot,
} from '../contracts/ZavorthCapabilityUsageSignalsContract.js';
import { ZavorthCapabilityUsageSignalsService } from './ZavorthCapabilityUsageSignalsService.js';
import { ZavorthHomePathService } from './ZavorthHomePathService.js';
import { logger } from '../logger.js';

type Runtime = {
  projectRoot?: string;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  storeFile?: string;
  usageSignals?: Pick<ZavorthCapabilityUsageSignalsService, 'snapshot'>;
};

type Store = {
  contractVersion: typeof ZAVORTH_CAPABILITY_LIFECYCLE_CONTRACT_VERSION;
  updatedAt: string;
  decisions: ZavorthCapabilityLifecycleDecision[];
  receipts: ZavorthCapabilityLifecycleReceipt[];
};

const MAX_STORE_BYTES = 6 * 1024 * 1024;
const MAX_DECISIONS = 1_000;
const MAX_RECEIPTS = 1_000;

export class ZavorthCapabilityLifecycleService {
  private readonly now: () => Date;
  private readonly storeFile: string;
  private readonly usageSignals: Pick<ZavorthCapabilityUsageSignalsService, 'snapshot'>;

  public constructor(runtime: Runtime = {}) {
    const projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    const env = runtime.env || process.env;
    const paths = new ZavorthHomePathService({ projectRoot, env }).resolvePaths();
    this.now = runtime.now || (() => new Date());
    this.storeFile = path.resolve(runtime.storeFile || path.join(paths.runtimeDir, 'capability-lifecycle-decisions.json'));
    this.usageSignals = runtime.usageSignals || new ZavorthCapabilityUsageSignalsService({
      projectRoot,
      env,
      now: this.now,
    });
  }

  public snapshot(input: ZavorthCapabilityLifecycleRunInput = {}): ZavorthCapabilityLifecycleSnapshot {
    const store = this.readStore();
    return this.buildSnapshot(store, this.preview(input, store));
  }

  public preview(input: ZavorthCapabilityLifecycleRunInput = {}, store = this.readStore()): ZavorthCapabilityLifecyclePreview {
    const usage = this.usageSignals.snapshot();
    const actionIds = new Set((input.actionIds || []).map(safeId).filter(Boolean));
    const selected = usage.actions.filter((action) => actionIds.size === 0 || actionIds.has(action.actionId));
    const existingKeys = new Set(store.decisions.filter((decision) => decision.status === 'applied').map(decisionKey));
    let skippedExisting = 0;
    const decisions: ZavorthCapabilityLifecycleDecision[] = [];
    for (const action of selected) {
      const decision = this.decisionFromUsage(action);
      if (existingKeys.has(decisionKey(decision))) {
        skippedExisting += 1;
        continue;
      }
      decisions.push(decision);
    }
    return {
      generatedAt: this.timestamp(),
      selected: selected.length,
      planned: decisions.length,
      skippedExisting,
      decisions,
      lines: decisions.length > 0
        ? decisions.map((decision) => `${decision.kind}: ${decision.actionId} - ${decision.reason}`)
        : ['No new lifecycle decision is ready from current usage signals.'],
      safety: {
        localOnly: true,
        noLiveActivation: true,
        noDeletion: true,
        approvalBoundaryPreserved: true,
      },
    };
  }

  public apply(input: ZavorthCapabilityLifecycleRunInput = {}): ZavorthCapabilityLifecycleSnapshot {
    const actor = clean(input.actor || 'operator');
    const store = this.readStore();
    const preview = this.preview(input, store);
    if (preview.decisions.length === 0) {
      store.receipts.push(this.receipt(actor, 'skipped', null, null, 'No new capability lifecycle decision was ready.'));
      this.writeStore(store);
      return this.buildSnapshot(store, this.preview(input, store));
    }

    for (const planned of preview.decisions) {
      if (planned.requiresApproval && !clean(input.approvalId)) {
        const blocked = {
          ...planned,
          status: 'blocked' as const,
          nextSafeAction: 'Provide an approval id or inspect the preview before applying this lifecycle decision.',
        };
        store.decisions.push(blocked);
        store.receipts.push(this.receipt(actor, 'blocked', blocked.id, blocked.actionId, `Lifecycle decision ${blocked.kind} blocked until approval is provided.`));
        continue;
      }
      const applied = {
        ...planned,
        status: 'applied' as const,
        nextSafeAction: appliedNext(planned.kind),
      };
      store.decisions.push(applied);
      store.receipts.push(this.receipt(actor, 'applied', applied.id, applied.actionId, `Lifecycle decision ${applied.kind} applied from local usage signals.`));
    }
    this.writeStore(store);
    return this.buildSnapshot(this.readStore(), this.preview(input, this.readStore()));
  }

  public renderText(snapshot = this.snapshot()): string {
    const lines = [
      'Zavorth Capability Lifecycle',
      '',
      `status=${snapshot.status}`,
      `decisions=${snapshot.summary.decisions} applied=${snapshot.summary.applied} receipts=${snapshot.summary.receipts}`,
      `promoted=${snapshot.summary.promoted} archived=${snapshot.summary.archived} inspect=${snapshot.summary.inspect} keep=${snapshot.summary.keep}`,
      '',
      'Pending preview:',
    ];
    if (snapshot.preview.decisions.length === 0) lines.push('- none');
    for (const decision of snapshot.preview.decisions) {
      lines.push(`- ${decision.kind} ${decision.actionId} (${decision.reason})`);
    }
    lines.push('', 'Recent decisions:');
    if (snapshot.decisions.length === 0) lines.push('- none yet');
    for (const decision of snapshot.decisions.slice(-12).reverse()) {
      lines.push(`- ${decision.kind} [${decision.status}] ${decision.actionId}`);
      lines.push(`  next=${decision.nextSafeAction}`);
    }
    lines.push('', 'Safety: local lifecycle decisions only; no deletion, live activation or network export.');
    return lines.join('\n');
  }

  private decisionFromUsage(action: ZavorthCapabilityUsageActionSummary): ZavorthCapabilityLifecycleDecision {
    const kind = kindFor(action.recommendation);
    const id = `capability-lifecycle:${kind}:${safeId(action.actionId)}:${safeId(action.lastSeenAt || this.timestamp())}`;
    return {
      id,
      at: this.timestamp(),
      actionId: safeId(action.actionId),
      capabilityId: safeId(action.capabilityId || action.actionId),
      title: clean(action.title || action.actionId),
      kind,
      status: 'proposed',
      reason: reasonFor(action),
      sourceRecommendation: action.recommendation,
      metrics: {
        events: totalEvents(action),
        previewRate: action.rates.previewRate,
        approvalRate: action.rates.approvalRate,
        successRate: action.rates.successRate,
        abandonmentRate: action.rates.abandonmentRate,
        blockRate: action.rates.blockRate,
        p95Ms: action.performance.p95Ms,
      },
      requiresApproval: kind === 'promote' || kind === 'archive',
      reversible: true,
      nextSafeAction: nextSafeAction(kind),
    };
  }

  private buildSnapshot(
    store: Store,
    preview: ZavorthCapabilityLifecyclePreview,
  ): ZavorthCapabilityLifecycleSnapshot {
    const decisions = clone(store.decisions).slice(-MAX_DECISIONS);
    const receipts = clone(store.receipts).slice(-MAX_RECEIPTS);
    const status = decisions.some((decision) => decision.status === 'blocked')
      ? 'attention'
      : decisions.length > 0 || preview.decisions.length > 0
        ? 'ready'
        : 'available';
    return {
      contractVersion: ZAVORTH_CAPABILITY_LIFECYCLE_CONTRACT_VERSION,
      generatedAt: this.timestamp(),
      surface: 'capability-lifecycle',
      status,
      storeFile: this.storeFile,
      summary: {
        decisions: decisions.length,
        applied: decisions.filter((decision) => decision.status === 'applied').length,
        promoted: decisions.filter((decision) => decision.kind === 'promote' && decision.status === 'applied').length,
        archived: decisions.filter((decision) => decision.kind === 'archive' && decision.status === 'applied').length,
        inspect: decisions.filter((decision) => decision.kind === 'inspect').length,
        keep: decisions.filter((decision) => decision.kind === 'keep').length,
        receipts: receipts.length,
      },
      decisions,
      receipts,
      preview,
      safety: {
        localOnly: true,
        usageSignalsOnly: true,
        noPromptContent: true,
        noSecrets: true,
        noNetworkUsed: true,
        noLiveActivation: true,
        noDeletion: true,
        reversibleReceipts: true,
      },
      commands: {
        status: 'zavorth actions lifecycle',
        preview: 'zavorth actions lifecycle --preview',
        apply: 'zavorth actions lifecycle --apply --approval-id <approval-id>',
        json: 'zavorth actions lifecycle --json',
      },
    };
  }

  private readStore(): Store {
    try {
      const stats = fs.statSync(this.storeFile);
      if (!stats.isFile() || stats.size > MAX_STORE_BYTES) return this.emptyStore();
      const parsed = JSON.parse(fs.readFileSync(this.storeFile, 'utf8')) as Partial<Store>;
      return {
        contractVersion: ZAVORTH_CAPABILITY_LIFECYCLE_CONTRACT_VERSION,
        updatedAt: normalizeDate(parsed.updatedAt || this.timestamp()),
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions.map(normalizeDecision).filter(isDecision).slice(-MAX_DECISIONS) : [],
        receipts: Array.isArray(parsed.receipts) ? parsed.receipts.map(normalizeReceipt).filter(isReceipt).slice(-MAX_RECEIPTS) : [],
      };
    } catch (error: any) {
    logger.warn('[Zavorth Capability Lifecycle] parsing failed', error);
    return this.emptyStore();
  }
  }

  private writeStore(store: Store): void {
    const normalized: Store = {
      contractVersion: ZAVORTH_CAPABILITY_LIFECYCLE_CONTRACT_VERSION,
      updatedAt: this.timestamp(),
      decisions: store.decisions.slice(-MAX_DECISIONS),
      receipts: store.receipts.slice(-MAX_RECEIPTS),
    };
    fs.mkdirSync(path.dirname(this.storeFile), { recursive: true });
    const tempFile = `${this.storeFile}.${process.pid}.${randomUUID()}.tmp`;
    fs.writeFileSync(tempFile, `${JSON.stringify(redactSecrets(normalized), null, 2)}\n`, 'utf8');
    fs.renameSync(tempFile, this.storeFile);
  }

  private emptyStore(): Store {
    return {
      contractVersion: ZAVORTH_CAPABILITY_LIFECYCLE_CONTRACT_VERSION,
      updatedAt: this.timestamp(),
      decisions: [],
      receipts: [],
    };
  }

  private receipt(
    actor: string,
    status: ZavorthCapabilityLifecycleReceipt['status'],
    decisionId: string | null,
    actionId: string | null,
    summary: string,
  ): ZavorthCapabilityLifecycleReceipt {
    return {
      id: `capability-lifecycle-receipt:${randomUUID()}`,
      at: this.timestamp(),
      actor,
      operation: 'capability-lifecycle-decision',
      status,
      decisionId,
      actionId,
      summary: clean(summary),
    };
  }

  private timestamp(): string {
    return this.now().toISOString();
  }
}

function kindFor(recommendation: ZavorthCapabilityUsageActionSummary['recommendation']): ZavorthCapabilityLifecycleDecisionKind {
  if (recommendation === 'promote_candidate') return 'promote';
  if (recommendation === 'archive_candidate') return 'archive';
  if (recommendation === 'needs_attention') return 'inspect';
  return 'keep';
}

function reasonFor(action: ZavorthCapabilityUsageActionSummary): string {
  if (action.recommendation === 'promote_candidate') {
    return `Strong local success pattern: success ${percent(action.rates.successRate)}, block ${percent(action.rates.blockRate)}, p95 ${action.performance.p95Ms ?? 'n/a'}ms.`;
  }
  if (action.recommendation === 'archive_candidate') {
    return `Low adoption pattern: abandoned ${action.counters.abandoned} times without preview or approval.`;
  }
  if (action.recommendation === 'needs_attention') {
    return `Usage needs inspection: failed ${action.counters.failed}, blocked ${action.counters.blocked}, success ${action.counters.succeeded}.`;
  }
  return 'Usage pattern is not clear enough yet.';
}

function totalEvents(action: ZavorthCapabilityUsageActionSummary): number {
  return Object.values(action.counters).reduce((sum, value) => sum + value, 0);
}

function nextSafeAction(kind: ZavorthCapabilityLifecycleDecisionKind): string {
  if (kind === 'promote') return 'Review the promotion preview and apply with approval when the capability should become preferred.';
  if (kind === 'archive') return 'Review the archive preview and apply with approval when the candidate should be hidden from daily suggestions.';
  if (kind === 'inspect') return 'Inspect failures, setup and receipts before trying promotion again.';
  return 'Keep collecting usage signals until the capability has a stronger pattern.';
}

function appliedNext(kind: ZavorthCapabilityLifecycleDecisionKind): string {
  if (kind === 'promote') return 'Capability marked as promoted from local usage signals; keep receipts for rollback.';
  if (kind === 'archive') return 'Capability marked as archived from local usage signals; restore if new evidence appears.';
  if (kind === 'inspect') return 'Capability marked for inspection; do not promote until failures are addressed.';
  return 'Capability kept in learning mode.';
}

function decisionKey(decision: Pick<ZavorthCapabilityLifecycleDecision, 'actionId' | 'kind' | 'sourceRecommendation'>): string {
  return `${decision.actionId}:${decision.kind}:${decision.sourceRecommendation}`;
}

function normalizeDecision(input: unknown): ZavorthCapabilityLifecycleDecision | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Partial<ZavorthCapabilityLifecycleDecision>;
  const actionId = safeId(value.actionId);
  const kind = isKind(value.kind) ? value.kind : 'keep';
  if (!actionId) return null;
  return {
    id: clean(value.id || `capability-lifecycle:${kind}:${actionId}`),
    at: normalizeDate(value.at),
    actionId,
    capabilityId: safeId(value.capabilityId || actionId),
    title: clean(value.title || actionId),
    kind,
    status: isStatus(value.status) ? value.status : 'proposed',
    reason: clean(value.reason || 'Usage pattern imported from local signals.'),
    sourceRecommendation: isRecommendation(value.sourceRecommendation) ? value.sourceRecommendation : 'keep_learning',
    metrics: {
      events: numberValue(value.metrics?.events),
      previewRate: rateValue(value.metrics?.previewRate),
      approvalRate: rateValue(value.metrics?.approvalRate),
      successRate: rateValue(value.metrics?.successRate),
      abandonmentRate: rateValue(value.metrics?.abandonmentRate),
      blockRate: rateValue(value.metrics?.blockRate),
      p95Ms: typeof value.metrics?.p95Ms === 'number' && Number.isFinite(value.metrics.p95Ms) ? Math.max(0, Math.round(value.metrics.p95Ms)) : null,
    },
    requiresApproval: Boolean(value.requiresApproval),
    reversible: true,
    nextSafeAction: clean(value.nextSafeAction || nextSafeAction(kind)),
  };
}

function normalizeReceipt(input: unknown): ZavorthCapabilityLifecycleReceipt | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Partial<ZavorthCapabilityLifecycleReceipt>;
  if (!clean(value.id)) return null;
  return {
    id: clean(value.id),
    at: normalizeDate(value.at),
    actor: clean(value.actor || 'operator'),
    operation: 'capability-lifecycle-decision',
    status: value.status === 'applied' ? 'applied' : value.status === 'skipped' ? 'skipped' : 'blocked',
    decisionId: value.decisionId ? clean(value.decisionId) : null,
    actionId: value.actionId ? safeId(value.actionId) : null,
    summary: clean(value.summary || ''),
  };
}

function isDecision(value: ZavorthCapabilityLifecycleDecision | null): value is ZavorthCapabilityLifecycleDecision {
  return Boolean(value);
}

function isReceipt(value: ZavorthCapabilityLifecycleReceipt | null): value is ZavorthCapabilityLifecycleReceipt {
  return Boolean(value);
}

function isKind(value: unknown): value is ZavorthCapabilityLifecycleDecisionKind {
  return ['promote', 'archive', 'inspect', 'keep'].includes(String(value || ''));
}

function isStatus(value: unknown): value is ZavorthCapabilityLifecycleDecision['status'] {
  return ['proposed', 'applied', 'skipped', 'blocked'].includes(String(value || ''));
}

function isRecommendation(value: unknown): value is ZavorthCapabilityUsageActionSummary['recommendation'] {
  return ['promote_candidate', 'keep_learning', 'needs_attention', 'archive_candidate'].includes(String(value || ''));
}

function numberValue(value: unknown): number {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function rateValue(value: unknown): number {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, Math.round(number * 1000) / 1000)) : 0;
}

function normalizeDate(value: unknown): string {
  const date = new Date(String(value || ''));
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function redact(value: unknown): string {
  return String(value || '')
    .replace(/\bsk-[A-Za-z0-9_-]{6,}\b/gu, '[REDACTED]')
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{6,}\b/gu, '[REDACTED]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{6,}\b/gu, '[REDACTED]')
    .replace(/\bAIza[0-9A-Za-z_-]{8,}\b/gu, '[REDACTED]')
    .replace(/\b(token|secret|password|api[_ -]?key|credential|prompt|content|message)\s*[:=]\s*[^\s,;]+/giu, '$1=[REDACTED]')
    .trim()
    .slice(0, 1_000);
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        /(token|secret|password|pass|api[_-]?key|credential|prompt|content|message)/iu.test(key) ? '***' : redactSecrets(entry),
      ]),
    );
  }
  return typeof value === 'string' ? redact(value) : value;
}

function safeId(value: unknown): string {
  return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9._:-]+/gu, '-').replace(/^-+|-+$/gu, '').slice(0, 200);
}

function clean(value: unknown): string {
  return redact(value).replace(/\s+/gu, ' ').trim();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
