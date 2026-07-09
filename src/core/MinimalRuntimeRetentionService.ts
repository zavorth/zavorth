import fs from 'fs';
import path from 'path';
import { findProjectRoot } from '../config/configHelpers.js';
import { MinimalDesktopResourceHistoryCompactor } from './MinimalDesktopResourceHistoryCompactor.js';
import {
  MinimalRuntimeArtifactRetentionCatalog,
  type MinimalRuntimeArtifactRetentionRule,
} from './MinimalRuntimeArtifactRetentionCatalog.js';
import { asErrorLike } from '../utils/errorLike.js';

export type MinimalRuntimeRetentionActionKind =
  | 'keep'
  | 'compact-activation-ledger'
  | 'compact-desktop-resource-history'
  | 'compact-agent-run-history'
  | 'compact-workflow-job-history'
  | 'compact-jsonl-tail'
  | 'review-jsonl'
  | 'review-log'
  | 'review-state';

export type MinimalRuntimeRetentionActionStatus = 'kept' | 'planned' | 'manual' | 'applied' | 'skipped';

export type MinimalRuntimeRetentionAction = {
  id: string;
  kind: MinimalRuntimeRetentionActionKind;
  status: MinimalRuntimeRetentionActionStatus;
  filePath: string;
  exists: boolean;
  sizeBytes: number;
  estimatedSizeBytes?: number;
  registeredArtifact: boolean;
  artifactOwner: string | null;
  artifactKind: string | null;
  retentionStrategy: string | null;
  budgetBytes: number | null;
  budgetLines: number | null;
  budgetItems: number | null;
  lineCount: number | null;
  currentItems: number | null;
  keepItems: number | null;
  wouldMutate: boolean;
  backupFile: string | null;
  message: string;
  reason: string;
};

export type MinimalRuntimeRetentionPolicy = {
  maxActivationReceipts: number;
  maxActivationLedgerBytes: number;
  maxGenericJsonlBytes: number;
  maxGenericJsonlLines: number;
  maxLogBytes: number;
  maxStateBytes: number;
};

export type MinimalRuntimeRetentionReport = {
  version: 1;
  generatedAt: string;
  status: 'passed' | 'failed';
  applied: boolean;
  dataDir: string;
  policy: MinimalRuntimeRetentionPolicy;
  totals: {
    files: number;
    bytes: number;
    registered: number;
    unregistered: number;
    registeredBytes: number;
    unregisteredBytes: number;
    planned: number;
    manual: number;
    applied: number;
    skipped: number;
    errors: number;
  };
  actions: MinimalRuntimeRetentionAction[];
  errors: Array<{
    filePath: string;
    reason: string;
  }>;
};

export type MinimalRuntimeRetentionServiceOptions = {
  projectRoot?: string;
  dataDir?: string;
  policy?: Partial<MinimalRuntimeRetentionPolicy>;
  artifactCatalog?: MinimalRuntimeArtifactRetentionCatalog;
};

export type MinimalRuntimeRetentionRunOptions = {
  apply?: boolean;
};

type JsonlReadResult = {
  lineCount: number;
  objects: unknown[];
  errors: Array<{
    line: number;
    reason: string;
  }>;
};

type MinimalRuntimeRetentionBareAction = Omit<
  MinimalRuntimeRetentionAction,
  | 'registeredArtifact'
  | 'artifactOwner'
  | 'artifactKind'
  | 'retentionStrategy'
  | 'budgetBytes'
  | 'budgetLines'
  | 'budgetItems'
>;

type JsonStateCompactionPlan = {
  status: MinimalRuntimeRetentionActionStatus;
  currentItems: number;
  keepItems: number;
  estimatedSizeBytes: number;
  wouldMutate: boolean;
  payload: string;
  message: string;
  reason: string;
};

const DEFAULT_POLICY: MinimalRuntimeRetentionPolicy = {
  maxActivationReceipts: 500,
  maxActivationLedgerBytes: 1_048_576,
  maxGenericJsonlBytes: 524_288,
  maxGenericJsonlLines: 5_000,
  maxLogBytes: 1_048_576,
  maxStateBytes: 262_144,
};

export class MinimalRuntimeRetentionService {
  private readonly projectRoot: string;
  private readonly dataDir: string;
  private readonly policy: MinimalRuntimeRetentionPolicy;
  private readonly artifactCatalog: MinimalRuntimeArtifactRetentionCatalog;

  constructor(options: MinimalRuntimeRetentionServiceOptions = {}) {
    this.projectRoot = options.projectRoot || findProjectRoot();
    this.dataDir = options.dataDir || path.resolve(this.projectRoot, 'data', 'runtime');
    this.policy = {
      ...DEFAULT_POLICY,
      ...(options.policy || {}),
    };
    this.artifactCatalog = options.artifactCatalog || new MinimalRuntimeArtifactRetentionCatalog();
  }

  public buildReport(options: MinimalRuntimeRetentionRunOptions = {}): MinimalRuntimeRetentionReport {
    const errors: MinimalRuntimeRetentionReport['errors'] = [];
    const actions: MinimalRuntimeRetentionAction[] = [];
    const files = this.listRuntimeFiles();
    for (const filePath of files) {
      try {
        actions.push(this.buildActionForFile(filePath));
      } catch (error: unknown) {
        const err = asErrorLike(error);
        errors.push({
          filePath,
          reason: error instanceof Error ? err.message : String(error),
        });
      }
    }

    const applied = options.apply === true;
    const finalActions = applied
      ? actions.map((action) => this.applyAction(action, errors))
      : actions;
    const stats = this.computeTotals(finalActions, errors);
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      status: errors.length === 0 ? 'passed' : 'failed',
      applied,
      dataDir: this.dataDir,
      policy: this.policy,
      totals: stats,
      actions: finalActions,
      errors,
    };
  }

  private buildActionForFile(filePath: string): MinimalRuntimeRetentionAction {
    const stats = fs.statSync(filePath);
    const basename = path.basename(filePath).toLowerCase();
    const artifactRule = this.artifactCatalog.lookup(basename);
    if (!artifactRule) {
      return this.buildUnregisteredArtifactAction(filePath, stats.size);
    }
    if (basename === 'capability-activation-ledger.jsonl') {
      return this.decorateAction(this.buildActivationLedgerAction(filePath, stats.size, artifactRule), artifactRule);
    }
    if (basename === 'desktop-resource-history.jsonl') {
      return this.decorateAction(this.buildDesktopResourceHistoryAction(filePath, stats.size, artifactRule), artifactRule);
    }
    if (artifactRule.strategy === 'agent-run-history-compactor') {
      return this.decorateAction(this.buildJsonStateHistoryAction({
        filePath,
        sizeBytes: stats.size,
        artifactRule,
        arrayKey: 'runs',
        actionKind: 'compact-agent-run-history',
        compactRecord: (record, shouldCompact) => shouldCompact ? compactRunHistoryRecord(record) : record,
        isActiveRecord: isActiveRunRecord,
        label: 'Universal agent run history',
      }), artifactRule);
    }
    if (artifactRule.strategy === 'workflow-job-history-compactor') {
      return this.decorateAction(this.buildJsonStateHistoryAction({
        filePath,
        sizeBytes: stats.size,
        artifactRule,
        arrayKey: 'jobs',
        actionKind: 'compact-workflow-job-history',
        compactRecord: (record, shouldCompact) => shouldCompact ? compactWorkflowJobRecord(record) : record,
        isActiveRecord: isActiveWorkflowJobRecord,
        label: 'Universal workflow job history',
      }), artifactRule);
    }
    if (artifactRule.strategy === 'jsonl-tail-compactor') {
      return this.decorateAction(this.buildJsonlTailAction(filePath, stats.size, artifactRule), artifactRule);
    }
    if (basename.endsWith('.jsonl')) {
      const lineCount = this.countLines(filePath);
      const maxBytes = this.resolveByteBudget(artifactRule, this.policy.maxGenericJsonlBytes);
      const maxLines = artifactRule.maxLines || this.policy.maxGenericJsonlLines;
      const oversized = stats.size > maxBytes || lineCount > maxLines;
      return this.decorateAction({
        id: this.actionId('review-jsonl', filePath),
        kind: oversized ? 'review-jsonl' : 'keep',
        status: oversized ? 'manual' : 'kept',
        filePath,
        exists: true,
        sizeBytes: stats.size,
        lineCount,
        currentItems: lineCount,
        keepItems: maxLines,
        wouldMutate: false,
        backupFile: null,
        message: oversized
          ? 'JSONL runtime file is above the lightweight retention policy and should get a domain-specific compactor.'
          : 'JSONL runtime file is within retention policy.',
        reason: oversized ? 'generic-jsonl-over-policy' : 'within-policy',
      }, artifactRule);
    }
    if (basename.endsWith('.log')) {
      const maxBytes = this.resolveByteBudget(artifactRule, this.policy.maxLogBytes);
      const oversized = stats.size > maxBytes;
      return this.decorateAction({
        id: this.actionId('review-log', filePath),
        kind: oversized ? 'review-log' : 'keep',
        status: oversized ? 'manual' : 'kept',
        filePath,
        exists: true,
        sizeBytes: stats.size,
        lineCount: null,
        currentItems: null,
        keepItems: null,
        wouldMutate: false,
        backupFile: null,
        message: oversized ? 'Log file is above retention policy and should be rotated.' : 'Log file is within retention policy.',
        reason: oversized ? 'log-over-policy' : 'within-policy',
      }, artifactRule);
    }
    if (basename.endsWith('.json')) {
      const maxBytes = this.resolveByteBudget(artifactRule, this.policy.maxStateBytes);
      const oversized = stats.size > maxBytes;
      return this.decorateAction({
        id: this.actionId('review-state', filePath),
        kind: oversized ? 'review-state' : 'keep',
        status: oversized ? 'manual' : 'kept',
        filePath,
        exists: true,
        sizeBytes: stats.size,
        lineCount: null,
        currentItems: null,
        keepItems: null,
        wouldMutate: false,
        backupFile: null,
        message: oversized ? 'JSON state file is above retention policy and should be trimmed by its owner.' : 'JSON state file is within retention policy.',
        reason: oversized ? 'state-over-policy' : 'within-policy',
      }, artifactRule);
    }
    return this.buildRegisteredSizeGateAction(filePath, stats.size, artifactRule);
  }

  private buildUnregisteredArtifactAction(filePath: string, sizeBytes: number): MinimalRuntimeRetentionAction {
    return {
      id: this.actionId('unregistered-artifact', filePath),
      kind: 'review-state',
      status: 'manual',
      filePath,
      exists: true,
      sizeBytes,
      registeredArtifact: false,
      artifactOwner: null,
      artifactKind: null,
      retentionStrategy: null,
      budgetBytes: null,
      budgetLines: null,
      budgetItems: null,
      lineCount: null,
      currentItems: null,
      keepItems: null,
      wouldMutate: false,
      backupFile: null,
      message: 'Runtime artifact is not registered in the retention catalog; add owner, kind, and budget before relying on it.',
      reason: 'unregistered-runtime-artifact',
    };
  }

  private buildRegisteredSizeGateAction(
    filePath: string,
    sizeBytes: number,
    artifactRule: MinimalRuntimeArtifactRetentionRule,
  ): MinimalRuntimeRetentionAction {
    const oversized = sizeBytes > artifactRule.maxBytes;
    return this.decorateAction({
      id: this.actionId('keep', filePath),
      kind: oversized ? 'review-state' : 'keep',
      status: oversized ? 'manual' : 'kept',
      filePath,
      exists: true,
      sizeBytes,
      lineCount: null,
      currentItems: null,
      keepItems: null,
      wouldMutate: false,
      backupFile: null,
      message: oversized
        ? 'Registered runtime artifact is above its retention budget and should be trimmed by its owner.'
        : 'Registered runtime artifact is within retention policy.',
      reason: oversized ? 'registered-artifact-over-policy' : 'within-policy',
    }, artifactRule);
  }

  private buildActivationLedgerAction(
    filePath: string,
    sizeBytes: number,
    artifactRule: MinimalRuntimeArtifactRetentionRule,
  ): MinimalRuntimeRetentionBareAction {
    const jsonl = this.readJsonl(filePath);
    const maxItems = Math.min(artifactRule.maxItems || this.policy.maxActivationReceipts, this.policy.maxActivationReceipts);
    const maxBytes = this.resolveByteBudget(artifactRule, this.policy.maxActivationLedgerBytes);
    const overItems = jsonl.objects.length > maxItems;
    const overBytes = sizeBytes > maxBytes;
    const invalid = jsonl.errors.length > 0;
    const shouldCompact = !invalid && (overItems || overBytes);
    return {
      id: this.actionId('compact-activation-ledger', filePath),
      kind: shouldCompact ? 'compact-activation-ledger' : 'keep',
      status: shouldCompact ? 'planned' : invalid ? 'manual' : 'kept',
      filePath,
      exists: true,
      sizeBytes,
      lineCount: jsonl.lineCount,
      currentItems: jsonl.objects.length,
      keepItems: shouldCompact ? maxItems : jsonl.objects.length,
      wouldMutate: shouldCompact,
      backupFile: shouldCompact ? this.backupPath(filePath) : null,
      message: invalid
        ? 'Activation ledger has invalid JSONL lines; inspect before compaction.'
        : shouldCompact
          ? 'Activation ledger can be compacted by keeping the most recent receipts.'
          : 'Activation ledger is within retention policy.',
      reason: invalid ? 'activation-ledger-invalid' : shouldCompact ? 'activation-ledger-over-policy' : 'within-policy',
    };
  }

  private buildDesktopResourceHistoryAction(
    filePath: string,
    sizeBytes: number,
    artifactRule: MinimalRuntimeArtifactRetentionRule,
  ): MinimalRuntimeRetentionBareAction {
    const maxHistoryBytes = this.resolveByteBudget(artifactRule, this.policy.maxGenericJsonlBytes);
    const plan = new MinimalDesktopResourceHistoryCompactor({
      historyFile: filePath,
      policy: {
        maxHistoryBytes,
      },
    }).buildPlan();
    const status: MinimalRuntimeRetentionActionStatus = plan.status === 'planned'
      ? 'planned'
      : plan.status === 'manual'
        ? 'manual'
        : 'kept';
    return {
      id: this.actionId('compact-desktop-resource-history', filePath),
      kind: status === 'kept' ? 'keep' : 'compact-desktop-resource-history',
      status,
      filePath,
      exists: plan.exists,
      sizeBytes,
      estimatedSizeBytes: plan.estimatedBytes,
      lineCount: plan.lineCount,
      currentItems: plan.currentSnapshots,
      keepItems: plan.keptFullSnapshots,
      wouldMutate: plan.wouldMutate,
      backupFile: plan.backupFile,
      message: plan.message,
      reason: plan.reason,
    };
  }

  private buildJsonlTailAction(
    filePath: string,
    sizeBytes: number,
    artifactRule: MinimalRuntimeArtifactRetentionRule,
  ): MinimalRuntimeRetentionBareAction {
    const jsonl = this.readJsonl(filePath);
    const maxBytes = this.resolveByteBudget(artifactRule, this.policy.maxGenericJsonlBytes);
    const keepItems = artifactRule.maxItems || artifactRule.maxLines || this.policy.maxGenericJsonlLines;
    const overItems = jsonl.objects.length > keepItems;
    const overBytes = sizeBytes > maxBytes;
    const invalid = jsonl.errors.length > 0;
    const shouldCompact = !invalid && (overItems || overBytes);
    return {
      id: this.actionId('compact-jsonl-tail', filePath),
      kind: shouldCompact ? 'compact-jsonl-tail' : 'keep',
      status: shouldCompact ? 'planned' : invalid ? 'manual' : 'kept',
      filePath,
      exists: true,
      sizeBytes,
      lineCount: jsonl.lineCount,
      currentItems: jsonl.objects.length,
      keepItems: shouldCompact ? keepItems : jsonl.objects.length,
      wouldMutate: shouldCompact,
      backupFile: shouldCompact ? this.backupPath(filePath) : null,
      message: invalid
        ? 'JSONL history has invalid lines; inspect before compaction.'
        : shouldCompact
          ? 'JSONL history can be compacted by keeping the newest valid entries.'
          : 'JSONL history is within its owner retention policy.',
      reason: invalid ? 'jsonl-tail-invalid' : shouldCompact ? 'jsonl-tail-over-policy' : 'within-policy',
    };
  }

  private buildJsonStateHistoryAction(options: {
    filePath: string;
    sizeBytes: number;
    artifactRule: MinimalRuntimeArtifactRetentionRule;
    arrayKey: string;
    actionKind: Extract<MinimalRuntimeRetentionActionKind, 'compact-agent-run-history' | 'compact-workflow-job-history'>;
    compactRecord: (record: unknown, shouldCompact: boolean) => unknown;
    isActiveRecord: (record: unknown) => boolean;
    label: string;
  }): MinimalRuntimeRetentionBareAction {
    const maxBytes = this.resolveByteBudget(options.artifactRule, this.policy.maxStateBytes);
    const keepItems = options.artifactRule.maxItems || 10;
    const plan = this.buildJsonStateCompactionPlan({
      filePath: options.filePath,
      currentSizeBytes: options.sizeBytes,
      maxBytes,
      keepItems,
      arrayKey: options.arrayKey,
      compactRecord: options.compactRecord,
      isActiveRecord: options.isActiveRecord,
      label: options.label,
    });
    return {
      id: this.actionId(options.actionKind, options.filePath),
      kind: plan.wouldMutate ? options.actionKind : 'keep',
      status: plan.status,
      filePath: options.filePath,
      exists: true,
      sizeBytes: options.sizeBytes,
      estimatedSizeBytes: plan.estimatedSizeBytes,
      lineCount: null,
      currentItems: plan.currentItems,
      keepItems: plan.keepItems,
      wouldMutate: plan.wouldMutate,
      backupFile: plan.wouldMutate ? this.backupPath(options.filePath) : null,
      message: plan.message,
      reason: plan.reason,
    };
  }

  private buildJsonStateCompactionPlan(options: {
    filePath: string;
    currentSizeBytes: number;
    maxBytes: number;
    keepItems: number;
    arrayKey: string;
    compactRecord: (record: unknown, shouldCompact: boolean) => unknown;
    isActiveRecord: (record: unknown) => boolean;
    label: string;
  }): JsonStateCompactionPlan {
    const raw = fs.readFileSync(options.filePath, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      return {
        status: 'manual',
        currentItems: 0,
        keepItems: options.keepItems,
        estimatedSizeBytes: options.currentSizeBytes,
        wouldMutate: false,
        payload: '',
        message: `${options.label} has invalid JSON; inspect before compaction.`,
        reason: error instanceof Error ? `json-state-invalid:${err.message}` : 'json-state-invalid',
      };
    }

    const root = isRecord(parsed) ? parsed : {};
    const records = Array.isArray(root[options.arrayKey])
      ? (root[options.arrayKey] as unknown[])
      : Array.isArray(parsed)
        ? parsed
        : [];
    if (records.length === 0) {
      return {
        status: options.currentSizeBytes > options.maxBytes ? 'manual' : 'kept',
        currentItems: 0,
        keepItems: options.keepItems,
        estimatedSizeBytes: options.currentSizeBytes,
        wouldMutate: false,
        payload: '',
        message: options.currentSizeBytes > options.maxBytes
          ? `${options.label} is over budget, but no ${options.arrayKey} array was found for safe compaction.`
          : `${options.label} is within retention policy.`,
        reason: options.currentSizeBytes > options.maxBytes ? 'json-state-missing-array' : 'within-policy',
      };
    }

    const recentIds = new Set(
      [...records]
        .sort((left, right) => recordUpdatedAt(right).localeCompare(recordUpdatedAt(left)))
        .slice(0, options.keepItems)
        .map(recordId)
        .filter((id): id is string => Boolean(id)),
    );
    let compacted = 0;
    const nextRecords = records.map((record) => {
      const shouldCompact = !options.isActiveRecord(record) && !recentIds.has(recordId(record) || '');
      if (shouldCompact) {
        compacted += 1;
      }
      return options.compactRecord(record, shouldCompact);
    });
    const nextRoot = Array.isArray(parsed)
      ? nextRecords
      : {
          ...root,
          savedAt: new Date().toISOString(),
          [options.arrayKey]: nextRecords,
        };
    const payload = `${JSON.stringify(nextRoot, null, 2)}\n`;
    const estimatedSizeBytes = Buffer.byteLength(payload, 'utf8');
    const overPolicy = options.currentSizeBytes > options.maxBytes;
    const canShrink = compacted > 0 && estimatedSizeBytes < options.currentSizeBytes;
    const wouldMutate = overPolicy && canShrink;
    return {
      status: wouldMutate ? 'planned' : overPolicy ? 'manual' : 'kept',
      currentItems: records.length,
      keepItems: options.keepItems,
      estimatedSizeBytes,
      wouldMutate,
      payload,
      message: wouldMutate
        ? `${options.label} can shrink from ${options.currentSizeBytes} bytes to about ${estimatedSizeBytes} bytes while preserving active and recent records.`
        : overPolicy
          ? `${options.label} is over budget, but no safe compaction would reduce it.`
          : `${options.label} is within retention policy.`,
      reason: wouldMutate
        ? 'json-state-history-over-policy'
        : overPolicy
          ? 'json-state-history-over-policy-no-safe-shrink'
          : 'within-policy',
    };
  }

  private decorateAction(
    action: MinimalRuntimeRetentionBareAction,
    artifactRule: MinimalRuntimeArtifactRetentionRule,
  ): MinimalRuntimeRetentionAction {
    return {
      ...action,
      registeredArtifact: true,
      artifactOwner: artifactRule.owner,
      artifactKind: artifactRule.kind,
      retentionStrategy: artifactRule.strategy,
      budgetBytes: this.resolveActionByteBudget(action.filePath, artifactRule),
      budgetLines: this.resolveActionLineBudget(action.filePath, artifactRule),
      budgetItems: this.resolveActionItemBudget(artifactRule),
    };
  }

  private resolveByteBudget(artifactRule: MinimalRuntimeArtifactRetentionRule, fallbackBytes: number): number {
    return artifactRule.maxBytes || fallbackBytes;
  }

  private resolveActionByteBudget(filePath: string, artifactRule: MinimalRuntimeArtifactRetentionRule): number {
    const basename = path.basename(filePath).toLowerCase();
    if (artifactRule.strategy === 'activation-ledger-compactor') {
      return this.resolveByteBudget(artifactRule, this.policy.maxActivationLedgerBytes);
    }
    if (artifactRule.strategy === 'desktop-resource-history-compactor' || basename.endsWith('.jsonl')) {
      return this.resolveByteBudget(artifactRule, this.policy.maxGenericJsonlBytes);
    }
    if (basename.endsWith('.log')) {
      return this.resolveByteBudget(artifactRule, this.policy.maxLogBytes);
    }
    if (basename.endsWith('.json')) {
      return this.resolveByteBudget(artifactRule, this.policy.maxStateBytes);
    }
    return artifactRule.maxBytes;
  }

  private resolveActionLineBudget(filePath: string, artifactRule: MinimalRuntimeArtifactRetentionRule): number | null {
    if (!path.basename(filePath).toLowerCase().endsWith('.jsonl')) {
      return null;
    }
    return artifactRule.maxLines || this.policy.maxGenericJsonlLines;
  }

  private resolveActionItemBudget(artifactRule: MinimalRuntimeArtifactRetentionRule): number | null {
    if (artifactRule.strategy === 'activation-ledger-compactor') {
      return artifactRule.maxItems || this.policy.maxActivationReceipts;
    }
    return artifactRule.maxItems || null;
  }

  private applyAction(
    action: MinimalRuntimeRetentionAction,
    errors: MinimalRuntimeRetentionReport['errors'],
  ): MinimalRuntimeRetentionAction {
    if (!action.wouldMutate) {
      return action.status === 'planned'
        ? { ...action, status: 'skipped', message: `${action.message} Apply handler is not available for this action.` }
        : action;
    }
    if (
      action.kind === 'compact-agent-run-history'
      || action.kind === 'compact-workflow-job-history'
      || action.kind === 'compact-jsonl-tail'
    ) {
      return this.applyPlannedCompactionAction(action, errors);
    }
    if (action.kind === 'compact-desktop-resource-history') {
      try {
        const plan = new MinimalDesktopResourceHistoryCompactor({
          historyFile: action.filePath,
          backupFile: action.backupFile || undefined,
          policy: {
            maxHistoryBytes: action.budgetBytes || this.policy.maxGenericJsonlBytes,
          },
        }).compact({ apply: true });
        if (plan.status !== 'applied') {
          return {
            ...action,
            status: 'skipped',
            wouldMutate: false,
            message: plan.message,
          };
        }
        return {
          ...action,
          status: 'applied',
          sizeBytes: plan.currentBytes,
          estimatedSizeBytes: plan.estimatedBytes,
          currentItems: plan.currentSnapshots,
          keepItems: plan.keptFullSnapshots,
          wouldMutate: false,
          backupFile: plan.backupFile,
          message: plan.message,
          reason: plan.reason,
        };
      } catch (error: unknown) {
        const err = asErrorLike(error);
        errors.push({
          filePath: action.filePath,
          reason: error instanceof Error ? err.message : String(error),
        });
        return {
          ...action,
          status: 'skipped',
          wouldMutate: false,
          message: 'Desktop resource history compaction failed; original file was left unchanged.',
        };
      }
    }
    if (action.kind !== 'compact-activation-ledger') {
      return action.status === 'planned'
        ? { ...action, status: 'skipped', message: `${action.message} Apply handler is not available for this action.` }
        : action;
    }
    try {
      const jsonl = this.readJsonl(action.filePath);
      if (jsonl.errors.length > 0) {
        return {
          ...action,
          status: 'skipped',
          message: 'Skipped compaction because the ledger has invalid lines.',
        };
      }
      const backupFile = action.backupFile || this.backupPath(action.filePath);
      const keepItems = action.keepItems || this.policy.maxActivationReceipts;
      const kept = jsonl.objects.slice(-keepItems);
      this.copyFileWithBackup(action.filePath, backupFile);
      fs.writeFileSync(action.filePath, `${kept.map((entry) => JSON.stringify(entry)).join('\n')}\n`, 'utf8');
      const updatedStats = fs.statSync(action.filePath);
      return {
        ...action,
        status: 'applied',
        sizeBytes: updatedStats.size,
        currentItems: kept.length,
        keepItems: kept.length,
        wouldMutate: false,
        backupFile,
        message: `Activation ledger compacted to ${kept.length} receipts.`,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      errors.push({
        filePath: action.filePath,
        reason: error instanceof Error ? err.message : String(error),
      });
      return {
        ...action,
        status: 'skipped',
        message: 'Compaction failed; original file was left unchanged.',
      };
    }
  }

  private applyPlannedCompactionAction(
    action: MinimalRuntimeRetentionAction,
    errors: MinimalRuntimeRetentionReport['errors'],
  ): MinimalRuntimeRetentionAction {
    try {
      const artifactRule = this.artifactCatalog.lookup(action.filePath);
      if (!artifactRule) {
        return {
          ...action,
          status: 'skipped',
          wouldMutate: false,
          message: 'Skipped compaction because the artifact is no longer registered.',
        };
      }
      let payload = '';
      let currentItems = action.currentItems || 0;
      let keepItems = action.keepItems || artifactRule.maxItems || 0;
      if (action.kind === 'compact-jsonl-tail') {
        const jsonl = this.readJsonl(action.filePath);
        if (jsonl.errors.length > 0) {
          return {
            ...action,
            status: 'skipped',
            wouldMutate: false,
            message: 'Skipped JSONL compaction because the file has invalid lines.',
          };
        }
        currentItems = jsonl.objects.length;
        keepItems = action.keepItems || artifactRule.maxItems || artifactRule.maxLines || this.policy.maxGenericJsonlLines;
        const kept = jsonl.objects.slice(-keepItems);
        payload = kept.length > 0 ? `${kept.map((entry) => JSON.stringify(entry)).join('\n')}\n` : '';
        currentItems = kept.length;
      } else {
        const arrayKey = action.kind === 'compact-agent-run-history' ? 'runs' : 'jobs';
        const plan = this.buildJsonStateCompactionPlan({
          filePath: action.filePath,
          currentSizeBytes: action.sizeBytes,
          maxBytes: action.budgetBytes || artifactRule.maxBytes,
          keepItems,
          arrayKey,
          compactRecord: action.kind === 'compact-agent-run-history'
            ? (record, shouldCompact) => shouldCompact ? compactRunHistoryRecord(record) : record
            : (record, shouldCompact) => shouldCompact ? compactWorkflowJobRecord(record) : record,
          isActiveRecord: action.kind === 'compact-agent-run-history' ? isActiveRunRecord : isActiveWorkflowJobRecord,
          label: action.kind === 'compact-agent-run-history' ? 'Universal agent run history' : 'Universal workflow job history',
        });
        if (!plan.wouldMutate || !plan.payload) {
          return {
            ...action,
            status: 'skipped',
            wouldMutate: false,
            estimatedSizeBytes: plan.estimatedSizeBytes,
            message: plan.message,
            reason: plan.reason,
          };
        }
        payload = plan.payload;
        currentItems = plan.currentItems;
        keepItems = plan.keepItems;
      }
      const backupFile = action.backupFile || this.backupPath(action.filePath);
      this.copyFileWithBackup(action.filePath, backupFile);
      fs.writeFileSync(action.filePath, payload, 'utf8');
      const updatedStats = fs.statSync(action.filePath);
      return {
        ...action,
        status: 'applied',
        sizeBytes: updatedStats.size,
        estimatedSizeBytes: updatedStats.size,
        currentItems,
        keepItems,
        wouldMutate: false,
        backupFile,
        message: `Runtime artifact compacted safely to ${updatedStats.size} bytes.`,
        reason: 'runtime-artifact-compacted',
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      errors.push({
        filePath: action.filePath,
        reason: error instanceof Error ? err.message : String(error),
      });
      return {
        ...action,
        status: 'skipped',
        wouldMutate: false,
        message: 'Compaction failed; original file was left unchanged.',
      };
    }
  }

  private listRuntimeFiles(): string[] {
    if (!fs.existsSync(this.dataDir)) {
      return [];
    }
    return fs.readdirSync(this.dataDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.resolve(this.dataDir, entry.name))
      .sort((left, right) => left.localeCompare(right));
  }

  private readJsonl(filePath: string): JsonlReadResult {
    if (!fs.existsSync(filePath)) {
      return { lineCount: 0, objects: [], errors: [] };
    }
    const objects: unknown[] = [];
    const errors: JsonlReadResult['errors'] = [];
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!line.trim()) {
        return;
      }
      try {
        objects.push(JSON.parse(line));
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

  private countLines(filePath: string): number {
    if (!fs.existsSync(filePath)) {
      return 0;
    }
    return fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .length;
  }

  private computeTotals(
    actions: MinimalRuntimeRetentionAction[],
    errors: MinimalRuntimeRetentionReport['errors'],
  ): MinimalRuntimeRetentionReport['totals'] {
    return {
      files: actions.length,
      bytes: actions.reduce((total, action) => total + action.sizeBytes, 0),
      registered: actions.filter((action) => action.registeredArtifact).length,
      unregistered: actions.filter((action) => !action.registeredArtifact).length,
      registeredBytes: actions
        .filter((action) => action.registeredArtifact)
        .reduce((total, action) => total + action.sizeBytes, 0),
      unregisteredBytes: actions
        .filter((action) => !action.registeredArtifact)
        .reduce((total, action) => total + action.sizeBytes, 0),
      planned: actions.filter((action) => action.status === 'planned').length,
      manual: actions.filter((action) => action.status === 'manual').length,
      applied: actions.filter((action) => action.status === 'applied').length,
      skipped: actions.filter((action) => action.status === 'skipped').length,
      errors: errors.length,
    };
  }

  private actionId(prefix: string, filePath: string): string {
    return `${prefix}:${path.basename(filePath).toLowerCase()}`;
  }

  private backupPath(filePath: string): string {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
    return path.resolve(path.dirname(filePath), 'retention-backups', `${path.basename(filePath)}.${stamp}.bak`);
  }

  private copyFileWithBackup(filePath: string, backupFile: string): void {
    fs.mkdirSync(path.dirname(backupFile), { recursive: true });
    fs.copyFileSync(filePath, backupFile);
  }
}

function compactRunHistoryRecord(record: unknown): unknown {
  if (!isRecord(record)) {
    return record;
  }
  const events = Array.isArray(record.events) ? record.events.slice(-10).map(compactEventRecord) : [];
  const approvals = Array.isArray(record.approvals) ? record.approvals.filter(hasPendingStatus).slice(-10) : [];
  const artifacts = Array.isArray(record.artifacts) ? record.artifacts.slice(-20).map(compactFlatRecord) : [];
  const memorySignals = Array.isArray(record.memorySignals) ? record.memorySignals.slice(-20).map(compactFlatRecord) : [];
  return compactObject({
    id: readString(record.id),
    traceId: readString(record.traceId),
    requestId: readString(record.requestId),
    sessionId: readString(record.sessionId),
    userId: readString(record.userId),
    channel: readString(record.channel),
    title: truncateText(readString(record.title), 240),
    input: truncateText(readString(record.input), 500),
    workspace: readString(record.workspace),
    status: readString(record.status),
    createdAt: readString(record.createdAt),
    updatedAt: readString(record.updatedAt),
    summary: truncateText(readString(record.summary), 1_000),
    events,
    toolExposure: compactToolExposure(record.toolExposure),
    replyPorts: Array.isArray(record.replyPorts) ? record.replyPorts.slice(0, 8).map(compactFlatRecord) : [],
    modelProfile: compactFlatRecord(record.modelProfile),
    approvals,
    artifacts,
    memorySignals,
    metadata: compactMetadataMarker(record.metadata),
  });
}

function compactWorkflowJobRecord(record: unknown): unknown {
  if (!isRecord(record)) {
    return record;
  }
  const request = isRecord(record.request)
    ? compactObject({
        requestId: readString(record.request.requestId),
        traceId: readString(record.request.traceId),
        userId: readString(record.request.userId),
        sessionId: readString(record.request.sessionId),
        channel: readString(record.request.channel),
        text: truncateText(readString(record.request.text), 500),
        workspace: readString(record.request.workspace),
        requestedTools: Array.isArray(record.request.requestedTools)
          ? record.request.requestedTools.filter((tool): tool is string => typeof tool === 'string').slice(0, 20)
          : [],
        metadata: compactMetadataMarker(record.request.metadata),
      })
    : undefined;
  return compactObject({
    id: readString(record.id),
    kind: readString(record.kind),
    runId: readString(record.runId),
    approvalId: readString(record.approvalId),
    request,
    status: readString(record.status),
    createdAt: readString(record.createdAt),
    updatedAt: readString(record.updatedAt),
    attempts: typeof record.attempts === 'number' ? record.attempts : undefined,
    maxAttempts: typeof record.maxAttempts === 'number' ? record.maxAttempts : undefined,
    completedAt: readString(record.completedAt),
    failedAt: readString(record.failedAt),
    cancelledAt: readString(record.cancelledAt),
    lastError: truncateText(readString(record.lastError), 500),
    resultRunStatus: readString(record.resultRunStatus),
    metadata: compactMetadataMarker(record.metadata),
  });
}

function compactEventRecord(record: unknown): unknown {
  if (!isRecord(record)) {
    return record;
  }
  return compactObject({
    id: readString(record.id),
    runId: readString(record.runId),
    kind: readString(record.kind),
    title: truncateText(readString(record.title), 240),
    detail: truncateText(readString(record.detail), 500),
    status: readString(record.status),
    createdAt: readString(record.createdAt),
  });
}

function compactToolExposure(value: unknown): unknown {
  if (!isRecord(value)) {
    return undefined;
  }
  return compactObject({
    mode: readString(value.mode),
    summary: truncateText(readString(value.summary), 500),
    tools: Array.isArray(value.tools) ? value.tools.slice(0, 40).map(compactFlatRecord) : [],
    blockedTools: Array.isArray(value.blockedTools) ? value.blockedTools.slice(0, 40).map(compactFlatRecord) : [],
  });
}

function compactMetadataMarker(value: unknown): unknown {
  if (!isRecord(value)) {
    return undefined;
  }
  return {
    compacted: true,
    originalKeys: Object.keys(value).sort(),
  };
}

function compactFlatRecord(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') {
      output[key] = truncateText(entry, 300);
    } else if (typeof entry === 'number' || typeof entry === 'boolean' || entry === null) {
      output[key] = entry;
    } else if (Array.isArray(entry)) {
      output[key] = entry.slice(0, 8).map((item) => typeof item === 'string' ? truncateText(item, 160) : item);
    } else if (isRecord(entry)) {
      output[key] = compactMetadataMarker(entry);
    }
  }
  return output;
}

function isActiveRunRecord(record: unknown): boolean {
  const status = isRecord(record) ? readString(record.status) : '';
  return status === 'queued' || status === 'thinking' || status === 'running' || status === 'waiting_approval';
}

function isActiveWorkflowJobRecord(record: unknown): boolean {
  const status = isRecord(record) ? readString(record.status) : '';
  return status === 'waiting_approval' || status === 'queued' || status === 'running';
}

function hasPendingStatus(record: unknown): boolean {
  return isRecord(record) && readString(record.status) === 'pending';
}

function recordUpdatedAt(record: unknown): string {
  if (!isRecord(record)) {
    return '';
  }
  return readString(record.updatedAt) || readString(record.createdAt);
}

function recordId(record: unknown): string | null {
  return isRecord(record) ? readString(record.id) || null : null;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function truncateText(value: string, maxLength: number): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 3))}...` : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function compactObject<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => (
      entry !== undefined
      && entry !== ''
      && !(Array.isArray(entry) && entry.length === 0)
    )),
  );
}
