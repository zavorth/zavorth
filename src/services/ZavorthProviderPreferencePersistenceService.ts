import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import {
  ZAVORTH_PROVIDER_PREFERENCE_PERSISTENCE_CONTRACT_VERSION,
  type ZavorthProviderPreferenceApprovalMode,
  type ZavorthProviderPreferencePersistenceSnapshot,
  type ZavorthProviderPreferenceReceipt,
  type ZavorthProviderPreferenceValue,
} from '../contracts/ZavorthProviderPreferencePersistenceContract.js';
import type { ZavorthProviderSelectionUxSnapshot } from '../contracts/ZavorthProviderSelectionUxContract.js';
import { findProjectRoot } from '../config/configHelpers.js';
import { logger } from '../logger.js';
import {
ZavorthProviderSelectionUxService,
  type ZavorthProviderSelectionUxInput,
} from './ZavorthProviderSelectionUxService.js';

export type ZavorthProviderPreferencePersistenceInput = ZavorthProviderSelectionUxInput & {
  providerId?: string | null;
  modelId?: string | null;
  approvalId?: string | null;
  confirm?: boolean;
  dryRun?: boolean;
};

export type ZavorthProviderPreferenceRollbackInput = {
  receiptId?: string | null;
  approvalId?: string | null;
  confirm?: boolean;
  dryRun?: boolean;
};

export type ZavorthProviderPreferencePersistenceRuntime = {
  now?: () => Date;
  projectRoot?: string;
  selection?: Pick<ZavorthProviderSelectionUxService, 'buildSnapshot'>;
};

type LedgerRecord = ZavorthProviderPreferenceReceipt & {
  previousPreference: ZavorthProviderPreferenceValue | null;
  nextPreference: ZavorthProviderPreferenceValue | null;
};

export class ZavorthProviderPreferencePersistenceService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly selection: Pick<ZavorthProviderSelectionUxService, 'buildSnapshot'>;

  constructor(runtime: ZavorthProviderPreferencePersistenceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || findProjectRoot());
    this.selection = runtime.selection || new ZavorthProviderSelectionUxService({ now: this.now });
  }

  public async preview(input: ZavorthProviderPreferencePersistenceInput = {}): Promise<ZavorthProviderPreferencePersistenceSnapshot> {
    return this.buildPersistenceSnapshot('preview', input);
  }

  public async apply(input: ZavorthProviderPreferencePersistenceInput = {}): Promise<ZavorthProviderPreferencePersistenceSnapshot> {
    return this.buildPersistenceSnapshot('apply', input);
  }

  public async rollback(input: ZavorthProviderPreferenceRollbackInput = {}): Promise<ZavorthProviderPreferencePersistenceSnapshot> {
    const paths = this.resolvePaths();
    const previous = await this.readPreference();
    const approval = resolveApproval(input);
    const generatedAt = this.now().toISOString();
    const ledgerRecord = await this.findLedgerRecord(input.receiptId || previous?.receiptId || null);
    const restored = ledgerRecord?.previousPreference || null;
    const receiptId = createReceiptId('rollback', ledgerRecord?.id || input.receiptId || 'latest', generatedAt);
    const denied = !approval.satisfied;
    const receipt = this.buildReceipt({
      id: receiptId,
      action: 'rollback',
      status: denied ? 'denied' : input.dryRun === true ? 'preview' : 'rolled_back',
      generatedAt,
      providerId: restored?.providerId || previous?.providerId || 'none',
      modelId: restored?.modelId || null,
      decision: denied ? 'approval_required' : 'rollback',
      approval,
      previous,
      next: denied ? previous : restored,
      backupPath: null,
      summary: denied
        ? 'Rollback blocked until the user explicitly confirms it.'
        : restored
          ? `Provider preference rollback restores ${restored.providerId}.`
          : 'Provider preference rollback clears the local runtime preference.',
    });

    if (!denied && input.dryRun !== true) {
      await this.writePreference(restored);
      await this.appendLedger(receipt, previous, restored);
    }

    return {
      contractVersion: ZAVORTH_PROVIDER_PREFERENCE_PERSISTENCE_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'provider-preference-persistence',
      generatedAt,
      status: receipt.status,
      request: {
        providerId: restored?.providerId || null,
        modelId: restored?.modelId || null,
        dryRun: input.dryRun === true,
      },
      preference: denied ? previous : restored,
      receipt,
      commands: [
        {
          id: 'inspect-preference',
          label: 'Inspect provider preference',
          command: 'zavorth providers preference --json',
          mutatesConfig: false,
          reversible: false,
        },
      ],
      nextAction: denied
        ? 'Run rollback with --confirm or an approval id.'
        : 'Provider preference rollback completed.',
    };
  }

  public async readPreference(): Promise<ZavorthProviderPreferenceValue | null> {
    const { preferencePath } = this.resolvePaths();
    try {
      const parsed = JSON.parse(await fs.promises.readFile(preferencePath, 'utf8')) as Partial<ZavorthProviderPreferenceValue>;
      const providerId = normalizeId(parsed.providerId);
      if (!providerId) {
        return null;
      }
      return {
        providerId,
        modelId: normalizeNullable(parsed.modelId),
        routeId: normalizeNullable(parsed.routeId),
        familyId: normalizeNullable(parsed.familyId),
        source: 'provider-selection-ux',
        updatedAt: normalizeNullable(parsed.updatedAt) || new Date(0).toISOString(),
        receiptId: normalizeNullable(parsed.receiptId) || 'unknown',
      };
    } catch (error) { logger.warn('[Zavorth  Preference Persistence] parsing failed', error); return null; }
  }

  public renderText(snapshot: ZavorthProviderPreferencePersistenceSnapshot): string {
    return [
      '[provider-preference]',
      `status=${snapshot.status}`,
      `provider=${snapshot.preference?.providerId || 'none'}`,
      `model=${snapshot.preference?.modelId || 'none'}`,
      `receipt=${snapshot.receipt.id}`,
      `approval=${snapshot.receipt.approval.satisfied ? 'satisfied' : 'required'}`,
      `rollback=${snapshot.receipt.rollback.available ? snapshot.receipt.rollback.command : 'none'}`,
      '',
      '[summary]',
      `- ${snapshot.receipt.summary}`,
      '',
      '[safety]',
      `- mutates_env_file=${snapshot.receipt.safety.mutatesEnvFile}`,
      `- writes_secrets=${snapshot.receipt.safety.writesSecrets}`,
      `- raw_secrets_serialized=${snapshot.receipt.safety.rawSecretsSerialized}`,
      `- reversible=${snapshot.receipt.safety.reversible}`,
      '',
      '[commands]',
      ...snapshot.commands.map((command) => `- ${command.id}: ${command.command} | mutates_config=${command.mutatesConfig}`),
      '',
      `next=${snapshot.nextAction}`,
      '',
    ].join('\n');
  }

  private async buildPersistenceSnapshot(
    action: 'preview' | 'apply',
    input: ZavorthProviderPreferencePersistenceInput,
  ): Promise<ZavorthProviderPreferencePersistenceSnapshot> {
    const providerId = normalizeId(input.providerId || input.target);
    const selection = await this.selection.buildSnapshot({
      ...input,
      target: providerId || input.target,
      providerId: providerId || input.providerId,
      requireLiveEvidence: input.requireLiveEvidence === true,
    });
    const previous = await this.readPreference();
    const approval = resolveApproval(input);
    const generatedAt = this.now().toISOString();
    const deniedReason = resolveDeniedReason(selection, approval, action);
    const next = deniedReason
      ? previous
      : buildPreference(selection, input.modelId, generatedAt, createReceiptId(action, selection.selected?.providerId || 'none', generatedAt));
    const receipt = this.buildReceipt({
      id: next?.receiptId || createReceiptId(action, providerId || 'none', generatedAt),
      action,
      status: deniedReason ? 'denied' : action === 'preview' || input.dryRun === true ? 'preview' : 'applied',
      generatedAt,
      providerId: selection.selected?.providerId || providerId || 'none',
      modelId: next?.modelId || selection.selected?.model || null,
      decision: deniedReason || selection.decision,
      approval,
      previous,
      next,
      backupPath: action === 'apply' && !deniedReason && input.dryRun !== true ? this.backupPath(next?.receiptId || 'unknown') : null,
      summary: buildSummary(selection, action, deniedReason),
    });

    if (action === 'apply' && !deniedReason && input.dryRun !== true) {
      await this.backupPreference(receipt.id, previous);
      await this.writePreference(next);
      await this.appendLedger(receipt, previous, next);
    }

    return {
      contractVersion: ZAVORTH_PROVIDER_PREFERENCE_PERSISTENCE_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'provider-preference-persistence',
      generatedAt,
      status: receipt.status,
      request: {
        providerId: selection.selected?.providerId || providerId || null,
        modelId: next?.modelId || input.modelId || null,
        dryRun: input.dryRun === true || action === 'preview',
      },
      preference: action === 'apply' && !deniedReason && input.dryRun !== true ? next : previous,
      receipt,
      commands: buildPersistenceCommands(selection, receipt),
      nextAction: buildPersistenceNextAction(receipt, selection),
    };
  }

  private buildReceipt(input: {
    id: string;
    action: 'preview' | 'apply' | 'rollback';
    status: 'preview' | 'applied' | 'rolled_back' | 'denied';
    generatedAt: string;
    providerId: string;
    modelId: string | null;
    decision: string | null;
    approval: ReturnType<typeof resolveApproval>;
    previous: ZavorthProviderPreferenceValue | null;
    next: ZavorthProviderPreferenceValue | null;
    backupPath: string | null;
    summary: string;
  }): ZavorthProviderPreferenceReceipt {
    const paths = this.resolvePaths();
    return {
      id: input.id,
      contractVersion: ZAVORTH_PROVIDER_PREFERENCE_PERSISTENCE_CONTRACT_VERSION,
      status: input.status,
      action: input.action,
      generatedAt: input.generatedAt,
      providerId: input.providerId,
      modelId: input.modelId,
      decision: input.decision,
      approval: {
        required: true,
        satisfied: input.approval.satisfied,
        mode: input.approval.mode,
        approvalId: input.approval.approvalId,
      },
      previous: input.previous,
      next: input.next,
      storage: {
        preferencePath: paths.preferencePath,
        backupPath: input.backupPath,
        ledgerPath: paths.ledgerPath,
      },
      rollback: {
        available: input.action === 'apply' && input.status === 'applied',
        command: input.action === 'apply' && input.status === 'applied'
          ? `zavorth providers rollback ${input.id} --confirm`
          : null,
        restoresProviderId: input.previous?.providerId || null,
        restoresModelId: input.previous?.modelId || null,
      },
      safety: {
        rawSecretsSerialized: false,
        writesSecrets: false,
        mutatesEnvFile: false,
        mutatesRuntimePreference: input.status === 'applied' || input.status === 'rolled_back',
        requiresExplicitApproval: true,
        reversible: input.action === 'apply' || input.action === 'rollback',
      },
      summary: input.summary,
    };
  }

  private resolvePaths(): { runtimeDir: string; preferencePath: string; ledgerPath: string; rollbackDir: string } {
    const runtimeDir = path.join(this.projectRoot, 'data', 'runtime');
    return {
      runtimeDir,
      preferencePath: path.join(runtimeDir, 'provider-selection-preferences.json'),
      ledgerPath: path.join(runtimeDir, 'provider-selection-receipts.jsonl'),
      rollbackDir: path.join(runtimeDir, 'provider-selection-rollbacks'),
    };
  }

  private backupPath(receiptId: string): string {
    return path.join(this.resolvePaths().rollbackDir, `${sanitizeFilePart(receiptId)}.json`);
  }

  private async backupPreference(receiptId: string, previous: ZavorthProviderPreferenceValue | null): Promise<void> {
    const backupPath = this.backupPath(receiptId);
    await fs.promises.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.promises.writeFile(backupPath, `${JSON.stringify(previous, null, 2)}\n`, 'utf8');
  }

  private async writePreference(preference: ZavorthProviderPreferenceValue | null): Promise<void> {
    const { runtimeDir, preferencePath } = this.resolvePaths();
    await fs.promises.mkdir(runtimeDir, { recursive: true });
    if (!preference) {
      await fs.promises.rm(preferencePath, { force: true });
      return;
    }
    const tmpPath = `${preferencePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.promises.writeFile(tmpPath, `${JSON.stringify(preference, null, 2)}\n`, 'utf8');
    await fs.promises.rename(tmpPath, preferencePath);
  }

  private async appendLedger(
    receipt: ZavorthProviderPreferenceReceipt,
    previousPreference: ZavorthProviderPreferenceValue | null,
    nextPreference: ZavorthProviderPreferenceValue | null,
  ): Promise<void> {
    const { runtimeDir, ledgerPath } = this.resolvePaths();
    await fs.promises.mkdir(runtimeDir, { recursive: true });
    const record: LedgerRecord = {
      ...receipt,
      previousPreference,
      nextPreference,
    };
    await fs.promises.appendFile(ledgerPath, `${JSON.stringify(record)}\n`, 'utf8');
  }

  private async findLedgerRecord(receiptId: string | null): Promise<LedgerRecord | null> {
    if (!receiptId) {
      return null;
    }
    const { ledgerPath } = this.resolvePaths();
    try {
      const lines = (await fs.promises.readFile(ledgerPath, 'utf8')).split(/\r?\n/).filter(Boolean);
      for (let index = lines.length - 1; index >= 0; index -= 1) {
        const parsed = JSON.parse(lines[index] || '{}') as LedgerRecord;
        if (parsed.id === receiptId) {
          return parsed;
        }
      }
    } catch (error) { logger.warn('[Zavorth  Preference Persistence] JSON parse failed', error); return null; }
    return null;
  }
}

function buildPreference(
  selection: ZavorthProviderSelectionUxSnapshot,
  modelId: string | null | undefined,
  updatedAt: string,
  receiptId: string,
): ZavorthProviderPreferenceValue | null {
  if (!selection.selected) {
    return null;
  }
  return {
    providerId: selection.selected.providerId,
    modelId: normalizeNullable(modelId) || normalizeNullable(selection.selected.model),
    routeId: selection.selected.providerId,
    familyId: selection.selected.providerId,
    source: 'provider-selection-ux',
    updatedAt,
    receiptId,
  };
}

function resolveDeniedReason(
  selection: ZavorthProviderSelectionUxSnapshot,
  approval: ReturnType<typeof resolveApproval>,
  action: 'preview' | 'apply',
): string | null {
  if (action === 'preview') {
    return null;
  }
  if (!approval.satisfied) {
    return 'approval_required';
  }
  if (!selection.selected) {
    return 'no_provider_selected';
  }
  if (selection.selected.requiresConfiguration || !selection.selected.canUseNow) {
    return 'provider_not_ready';
  }
  return null;
}

function resolveApproval(input: { approvalId?: string | null; confirm?: boolean }): {
  satisfied: boolean;
  mode: ZavorthProviderPreferenceApprovalMode | null;
  approvalId: string | null;
} {
  const approvalId = normalizeNullable(input.approvalId);
  if (approvalId) {
    return { satisfied: true, mode: 'approval_id', approvalId };
  }
  if (input.confirm === true) {
    return { satisfied: true, mode: 'explicit_confirm', approvalId: null };
  }
  return { satisfied: false, mode: null, approvalId: null };
}

function buildSummary(
  selection: ZavorthProviderSelectionUxSnapshot,
  action: 'preview' | 'apply',
  deniedReason: string | null,
): string {
  if (deniedReason === 'approval_required') {
    return 'Provider preference was not changed because explicit approval is required.';
  }
  if (deniedReason === 'provider_not_ready') {
    return 'Provider preference was not changed because the selected provider is not ready.';
  }
  if (!selection.selected) {
    return 'No provider preference can be changed because no provider was selected.';
  }
  if (action === 'preview') {
    return `Preview provider preference change to ${selection.selected.providerId}.`;
  }
  return `Provider preference changed to ${selection.selected.providerId}.`;
}

function buildPersistenceCommands(
  selection: ZavorthProviderSelectionUxSnapshot,
  receipt: ZavorthProviderPreferenceReceipt,
): ZavorthProviderPreferencePersistenceSnapshot['commands'] {
  const providerId = selection.selected?.providerId || receipt.providerId;
  const commands: ZavorthProviderPreferencePersistenceSnapshot['commands'] = [
    {
      id: 'preview-apply',
      label: 'Preview provider preference apply',
      command: `zavorth providers apply ${providerId}`,
      mutatesConfig: false,
      reversible: false,
    },
    {
      id: 'approved-apply',
      label: 'Apply provider preference after approval',
      command: `zavorth providers apply ${providerId} --confirm`,
      mutatesConfig: true,
      reversible: true,
    },
  ];
  if (receipt.rollback.command) {
    commands.push({
      id: 'rollback',
      label: 'Rollback provider preference',
      command: receipt.rollback.command,
      mutatesConfig: true,
      reversible: false,
    });
  }
  return commands;
}

function buildPersistenceNextAction(
  receipt: ZavorthProviderPreferenceReceipt,
  selection: ZavorthProviderSelectionUxSnapshot,
): string {
  if (receipt.status === 'applied') {
    return receipt.rollback.command || 'Provider preference applied.';
  }
  if (receipt.decision === 'approval_required') {
    return `Approve with: zavorth providers apply ${selection.selected?.providerId || receipt.providerId} --confirm`;
  }
  if (receipt.decision === 'provider_not_ready') {
    return selection.nextAction;
  }
  return `Review, then apply with: zavorth providers apply ${selection.selected?.providerId || receipt.providerId} --confirm`;
}

function createReceiptId(action: string, providerId: string, generatedAt: string): string {
  const digest = crypto
    .createHash('sha256')
    .update(`${action}:${providerId}:${generatedAt}`)
    .digest('hex')
    .slice(0, 12);
  return `provider-pref:${action}:${digest}`;
}

function normalizeId(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeNullable(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function sanitizeFilePart(value: string): string {
  return value.replace(/[^a-z0-9_.-]+/gi, '-').slice(0, 120) || 'provider-preference';
}
