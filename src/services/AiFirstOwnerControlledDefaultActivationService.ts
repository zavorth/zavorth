import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { findProjectRoot } from '../config/configHelpers.js';
import {
  AI_FIRST_OWNER_CONTROLLED_DEFAULT_ACTIVATION_CONTRACT_VERSION,
  type AiFirstOwnerControlledDefaultFinding,
  type AiFirstOwnerControlledDefaultLedgerSnapshot,
  type AiFirstOwnerControlledDefaultOperation,
  type AiFirstOwnerControlledDefaultReceipt,
  type AiFirstOwnerControlledDefaultResult,
  type AiFirstOwnerControlledDefaultResultStatus,
  type AiFirstOwnerControlledDefaultRouter,
  type AiFirstOwnerControlledDefaultState,
} from '../contracts/AiFirstOwnerControlledDefaultActivationContract.js';
import {
  AI_FIRST_FINAL_ACTIVATION_GATE_CONTRACT_VERSION,
  type AiFirstFinalActivationGateSnapshot,
} from '../contracts/AiFirstFinalActivationGateContract.js';
import { redactSensitiveText } from './AiFirstRoutePlanContractService.js';

type Runtime = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
};

export type AiFirstOwnerControlledDefaultActivationOptions = {
  projectRoot?: string;
  dataDir?: string;
  statePath?: string;
  ledgerPath?: string;
  runtime?: Runtime;
};

export type AiFirstOwnerControlledDefaultActivationInput = {
  snapshot?: AiFirstFinalActivationGateSnapshot | null;
  ownerApprovalId?: string | null;
  apply?: boolean | null;
  confirmOwnerControlledDefault?: boolean | null;
};

export type AiFirstOwnerControlledDefaultRollbackInput = {
  ownerApprovalId?: string | null;
  apply?: boolean | null;
  confirmRollback?: boolean | null;
  reason?: string | null;
};

export class AiFirstOwnerControlledDefaultActivationService {
  private readonly projectRoot: string;
  private readonly dataDir: string;
  private readonly statePath: string;
  private readonly ledgerPath: string;
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private sequence = 0;

  constructor(options: AiFirstOwnerControlledDefaultActivationOptions = {}) {
    this.projectRoot = options.projectRoot || findProjectRoot();
    this.dataDir = options.dataDir || path.resolve(this.projectRoot, 'data', 'runtime');
    this.statePath = options.statePath || path.resolve(this.dataDir, 'ai-first-owner-controlled-default-state.json');
    this.ledgerPath = options.ledgerPath || path.resolve(this.dataDir, 'ai-first-owner-controlled-default-ledger.jsonl');
    this.now = options.runtime?.now || (() => new Date());
    this.idFactory = options.runtime?.idFactory || ((prefix) => `${prefix}-${this.now().getTime().toString(36)}-${++this.sequence}`);
  }

  public plan(input: AiFirstOwnerControlledDefaultActivationInput): AiFirstOwnerControlledDefaultResult {
    return this.buildActivationResult('plan', input);
  }

  public activate(input: AiFirstOwnerControlledDefaultActivationInput): AiFirstOwnerControlledDefaultResult {
    const result = this.buildActivationResult('activate', input);
    if (!result.applied || result.status !== 'active' || !result.state || !result.receipt) {
      return result;
    }
    this.writeState(result.state);
    this.appendReceipt(result.receipt);
    return result;
  }

  public status(limit = 20): AiFirstOwnerControlledDefaultResult {
    const state = this.readState();
    const ledger = this.readLedger(limit);
    const status: AiFirstOwnerControlledDefaultResultStatus = state
      ? state.status === 'active'
        ? 'active'
        : state.status === 'rolled-back'
          ? 'rolled-back'
          : 'inactive'
      : 'missing';
    return {
      version: 1,
      contractVersion: AI_FIRST_OWNER_CONTROLLED_DEFAULT_ACTIVATION_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      operation: 'status',
      status,
      applied: false,
      dryRun: true,
      action: 'read-current-state',
      message: state
        ? `AI-first default state is ${state.status}.`
        : 'No AI-first owner-controlled default state exists yet.',
      state,
      receipt: null,
      ledger,
      findings: state ? [] : [this.finding('state-missing', 'medium', 'No activation state file exists.')],
      paths: this.paths(),
      commands: this.commands(),
    };
  }

  public rollback(input: AiFirstOwnerControlledDefaultRollbackInput = {}): AiFirstOwnerControlledDefaultResult {
    const apply = input.apply === true;
    const state = this.readState();
    const findings: AiFirstOwnerControlledDefaultFinding[] = [];
    if (!state) {
      findings.push(this.finding('state-missing', 'high', 'No activation state exists to roll back.'));
    } else if (state.status !== 'active' || state.defaultRouter !== 'ai-first') {
      findings.push(this.finding('state-not-active', 'high', 'AI-first default is not active; rollback would be a no-op.'));
    }
    if (!clean(input.ownerApprovalId)) {
      findings.push(this.finding('owner-approval-missing', 'high', 'Rollback requires an owner approval id.'));
    }
    if (apply && input.confirmRollback !== true) {
      findings.push(this.finding('rollback-confirmation-missing', 'high', 'Applied rollback requires --confirm-rollback.'));
    }

    const blocked = findings.some((finding) => finding.severity === 'high');
    const receipt = this.createReceipt({
      operation: 'rollback',
      applied: apply && !blocked,
      dryRun: !apply,
      status: blocked ? 'blocked' : apply ? 'rolled-back' : 'ready',
      activationGateId: state?.activationGateId || null,
      activationSnapshotHash: state?.activationSnapshotHash || null,
      ownerApprovalId: clean(input.ownerApprovalId),
      previousDefaultRouter: state?.defaultRouter || null,
      nextDefaultRouter: 'current-runtime',
      findings,
      message: blocked
        ? 'Rollback blocked by missing state, approval or confirmation.'
        : apply
          ? 'AI-first default was rolled back to the current runtime.'
          : 'Dry-run: rollback would restore current runtime as default.',
    });
    const nextState = state && !blocked && apply
      ? this.createRolledBackState(state, receipt, clean(input.ownerApprovalId))
      : state;

    if (apply && !blocked && nextState) {
      this.writeState(nextState);
      this.appendReceipt(receipt);
    }

    return {
      version: 1,
      contractVersion: AI_FIRST_OWNER_CONTROLLED_DEFAULT_ACTIVATION_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      operation: 'rollback',
      status: receipt.status,
      applied: receipt.applied,
      dryRun: receipt.dryRun,
      action: blocked ? 'fix-blockers' : apply ? 'write-rollback' : 'preview-rollback',
      message: receipt.message,
      state: nextState,
      receipt,
      ledger: apply && !blocked ? this.readLedger(20) : null,
      findings,
      paths: this.paths(),
      commands: this.commands(),
    };
  }

  public readSnapshotFile(filePath: string): AiFirstFinalActivationGateSnapshot {
    const resolved = path.resolve(filePath);
    const raw = fs.readFileSync(resolved, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw) as AiFirstFinalActivationGateSnapshot;
  }

  public renderText(result: AiFirstOwnerControlledDefaultResult): string {
    const lines = [
      'Zavorth AI-first owner-controlled default',
      `Operation: ${result.operation}`,
      `Status: ${result.status}`,
      `Applied: ${String(result.applied)}`,
      `Dry-run: ${String(result.dryRun)}`,
      `State: ${result.state?.status || 'missing'} / default=${result.state?.defaultRouter || 'current-runtime'} / fallback=current-runtime`,
      `Owner approval: ${result.state?.ownerApprovalId || result.receipt?.ownerApprovalId || 'missing'}`,
      `State file: ${result.paths.statePath}`,
      `Ledger file: ${result.paths.ledgerPath}`,
      `Message: ${result.message}`,
      'Findings:',
      ...(result.findings.length > 0
        ? result.findings.map((finding) => `- ${finding.severity}/${finding.kind}: ${finding.detail}`)
        : ['- none']),
      'Commands:',
      `- plan: ${result.commands.plan}`,
      `- activate: ${result.commands.activate}`,
      `- status: ${result.commands.status}`,
      `- rollback: ${result.commands.rollback}`,
    ];
    return lines.join('\n');
  }

  private buildActivationResult(
    operation: 'plan' | 'activate',
    input: AiFirstOwnerControlledDefaultActivationInput,
  ): AiFirstOwnerControlledDefaultResult {
    const apply = operation === 'activate' && input.apply === true;
    const snapshot = input.snapshot || null;
    const previousState = this.readState();
    const findings = this.validateActivationInput(snapshot, input, previousState, apply);
    const blocked = findings.some((finding) => finding.severity === 'high');
    const snapshotHash = snapshot ? this.hashSnapshot(snapshot) : null;
    const status: AiFirstOwnerControlledDefaultResultStatus = blocked
      ? 'blocked'
      : apply
        ? 'active'
        : 'ready';
    const receipt = this.createReceipt({
      operation,
      applied: apply && !blocked,
      dryRun: !apply,
      status,
      activationGateId: snapshot?.activationGateId || null,
      activationSnapshotHash: snapshotHash,
      ownerApprovalId: clean(input.ownerApprovalId),
      previousDefaultRouter: previousState?.defaultRouter || 'current-runtime',
      nextDefaultRouter: blocked ? previousState?.defaultRouter || 'current-runtime' : 'ai-first',
      findings,
      message: blocked
        ? 'AI-first default activation is blocked by validation findings.'
        : apply
          ? 'AI-first router default was activated with current-runtime fallback.'
          : 'Dry-run: AI-first router default is ready for owner-controlled activation.',
    });
    const state = snapshot && !blocked
      ? this.createActiveState({
          snapshot,
          snapshotHash: snapshotHash || this.hashSnapshot(snapshot),
          ownerApprovalId: clean(input.ownerApprovalId),
          receipt,
        })
      : previousState;

    return {
      version: 1,
      contractVersion: AI_FIRST_OWNER_CONTROLLED_DEFAULT_ACTIVATION_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      operation,
      status,
      applied: receipt.applied,
      dryRun: receipt.dryRun,
      action: blocked ? 'fix-blockers' : apply ? 'write-owner-controlled-default' : 'preview-owner-controlled-default',
      message: receipt.message,
      state,
      receipt,
      ledger: apply && !blocked ? this.readLedger(20) : null,
      findings,
      paths: this.paths(),
      commands: this.commands(),
    };
  }

  private validateActivationInput(
    snapshot: AiFirstFinalActivationGateSnapshot | null,
    input: AiFirstOwnerControlledDefaultActivationInput,
    previousState: AiFirstOwnerControlledDefaultState | null,
    apply: boolean,
  ): AiFirstOwnerControlledDefaultFinding[] {
    const findings: AiFirstOwnerControlledDefaultFinding[] = [];
    if (!snapshot) {
      findings.push(this.finding('snapshot-missing', 'high', 'A Intent model0 activation snapshot is required.'));
    } else {
      if (
        snapshot.contractVersion !== AI_FIRST_FINAL_ACTIVATION_GATE_CONTRACT_VERSION
        || snapshot.source !== 'ai-first-final-activation-gate'
      ) {
        findings.push(this.finding('snapshot-source-invalid', 'high', 'Snapshot is not a valid Intent model0 final activation gate snapshot.'));
      }
      if (
        snapshot.recommendation.readiness !== 'ready-for-owner-controlled-default'
        || snapshot.recommendation.action !== 'prepare-owner-controlled-default'
      ) {
        findings.push(this.finding('snapshot-not-ready', 'high', `Snapshot readiness is ${snapshot.recommendation.readiness}.`));
      }
      if (snapshot.findings.length > 0 || snapshot.aggregate.finalFindingCount > 0) {
        findings.push(this.finding('snapshot-findings-present', 'high', 'Snapshot contains final activation findings.'));
      }
      if (
        snapshot.recommendation.defaultRuntimeChanged !== false
        || snapshot.recommendation.keepCurrentRuntimeDecision !== true
        || snapshot.recommendation.canExecuteNow !== false
        || snapshot.recommendation.activateAutomatically !== false
        || snapshot.recommendation.ownerApprovalRequired !== true
        || snapshot.recommendation.promoteDefaultRuntime !== false
        || snapshot.aggregate.allRuntimeInvariantsPreserved !== true
      ) {
        findings.push(this.finding('runtime-invariant-violation', 'high', 'Snapshot does not preserve owner-controlled runtime invariants.'));
      }
      if (hasSecretLikeValue(JSON.stringify(snapshot))) {
        findings.push(this.finding('secret-like-input', 'high', 'Snapshot contains secret-like material and cannot be persisted.'));
      }
    }
    if (!clean(input.ownerApprovalId)) {
      findings.push(this.finding('owner-approval-missing', 'high', 'Activation requires an owner approval id.'));
    }
    if (apply && input.confirmOwnerControlledDefault !== true) {
      findings.push(this.finding('activation-confirmation-missing', 'high', 'Applied activation requires --confirm-owner-controlled-default.'));
    }
    if (previousState?.status === 'active' && previousState.defaultRouter === 'ai-first') {
      findings.push(this.finding('already-active', 'medium', 'AI-first default is already active; activation would replace the active state.'));
    }
    return findings;
  }

  private createActiveState(input: {
    snapshot: AiFirstFinalActivationGateSnapshot;
    snapshotHash: string;
    ownerApprovalId: string | null;
    receipt: AiFirstOwnerControlledDefaultReceipt;
  }): AiFirstOwnerControlledDefaultState {
    return {
      version: 1,
      contractVersion: AI_FIRST_OWNER_CONTROLLED_DEFAULT_ACTIVATION_CONTRACT_VERSION,
      source: 'ai-first-owner-controlled-default-state',
      updatedAt: this.now().toISOString(),
      status: 'active',
      defaultRouter: 'ai-first',
      fallbackRouter: 'current-runtime',
      activationGateId: input.snapshot.activationGateId,
      activationSnapshotHash: input.snapshotHash,
      ownerApprovalId: input.ownerApprovalId,
      activatedAt: this.now().toISOString(),
      rolledBackAt: null,
      rollbackOfReceiptId: null,
      lastReceiptId: input.receipt.id,
      runtime: {
        defaultRuntimeChanged: true,
        currentRuntimeFallbackRequired: true,
        canExecuteNow: false,
        activateAutomatically: false,
      },
      sourceSnapshot: {
        readiness: input.snapshot.recommendation.readiness,
        action: input.snapshot.recommendation.action,
        sampleCount: input.snapshot.aggregate.sampleCount,
        canaryEnabledRoutes: input.snapshot.aggregate.canaryEnabledRoutes,
        canarySelections: input.snapshot.aggregate.canarySelections,
        latestCanaryRate: input.snapshot.aggregate.latestCanaryRate,
        latestFallbackRate: input.snapshot.aggregate.latestFallbackRate,
      },
    };
  }

  private createRolledBackState(
    previous: AiFirstOwnerControlledDefaultState,
    receipt: AiFirstOwnerControlledDefaultReceipt,
    ownerApprovalId: string | null,
  ): AiFirstOwnerControlledDefaultState {
    return {
      ...previous,
      updatedAt: this.now().toISOString(),
      status: 'rolled-back',
      defaultRouter: 'current-runtime',
      fallbackRouter: 'current-runtime',
      ownerApprovalId,
      rolledBackAt: this.now().toISOString(),
      rollbackOfReceiptId: previous.lastReceiptId,
      lastReceiptId: receipt.id,
      runtime: {
        defaultRuntimeChanged: true,
        currentRuntimeFallbackRequired: true,
        canExecuteNow: false,
        activateAutomatically: false,
      },
    };
  }

  private createReceipt(input: {
    operation: AiFirstOwnerControlledDefaultOperation;
    applied: boolean;
    dryRun: boolean;
    status: AiFirstOwnerControlledDefaultResultStatus;
    activationGateId: string | null;
    activationSnapshotHash: string | null;
    ownerApprovalId: string | null;
    previousDefaultRouter: AiFirstOwnerControlledDefaultRouter | null;
    nextDefaultRouter: AiFirstOwnerControlledDefaultRouter;
    findings: AiFirstOwnerControlledDefaultFinding[];
    message: string;
  }): AiFirstOwnerControlledDefaultReceipt {
    return {
      version: 1,
      contractVersion: AI_FIRST_OWNER_CONTROLLED_DEFAULT_ACTIVATION_CONTRACT_VERSION,
      id: this.idFactory(`${input.operation}-receipt`),
      createdAt: this.now().toISOString(),
      operation: input.operation,
      applied: input.applied,
      dryRun: input.dryRun,
      status: input.status,
      activationGateId: input.activationGateId,
      activationSnapshotHash: input.activationSnapshotHash,
      ownerApprovalId: input.ownerApprovalId,
      previousDefaultRouter: input.previousDefaultRouter,
      nextDefaultRouter: input.nextDefaultRouter,
      statePath: this.statePath,
      ledgerPath: this.ledgerPath,
      findings: input.findings,
      message: input.message,
      invariants: {
        defaultRuntimeChangedOnlyWhenApplied: input.applied || input.dryRun || input.nextDefaultRouter === input.previousDefaultRouter,
        currentRuntimeFallbackRequired: true,
        canExecuteNow: false,
        activateAutomatically: false,
        noSecretValuesSerialized: true,
      },
    };
  }

  private writeState(state: AiFirstOwnerControlledDefaultState): void {
    fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
    fs.writeFileSync(this.statePath, `${redactSensitiveText(JSON.stringify(state, null, 2))}\n`, 'utf8');
  }

  private appendReceipt(receipt: AiFirstOwnerControlledDefaultReceipt): void {
    fs.mkdirSync(path.dirname(this.ledgerPath), { recursive: true });
    fs.appendFileSync(this.ledgerPath, `${redactSensitiveText(JSON.stringify(receipt))}\n`, 'utf8');
  }

  private readState(): AiFirstOwnerControlledDefaultState | null {
    if (!fs.existsSync(this.statePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(this.statePath, 'utf8')) as AiFirstOwnerControlledDefaultState;
  }

  private readLedger(limit = 20): AiFirstOwnerControlledDefaultLedgerSnapshot {
    if (!fs.existsSync(this.ledgerPath)) {
      return {
        version: 1,
        generatedAt: this.now().toISOString(),
        ledgerPath: this.ledgerPath,
        exists: false,
        total: 0,
        returned: 0,
        invalidLines: 0,
        receipts: [],
        errors: [],
      };
    }
    const receipts: AiFirstOwnerControlledDefaultReceipt[] = [];
    const errors: Array<{ line: number; reason: string }> = [];
    const lines = fs.readFileSync(this.ledgerPath, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!line.trim()) {
        return;
      }
      try {
        const parsed = JSON.parse(line) as AiFirstOwnerControlledDefaultReceipt;
        if (parsed.version !== 1 || !parsed.id || !parsed.operation) {
          throw new Error('Invalid receipt shape.');
        }
        receipts.push(parsed);
      } catch (error) {
        errors.push({
          line: index + 1,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    });
    const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 20;
    const returnedReceipts = receipts.slice(-normalizedLimit).reverse();
    return {
      version: 1,
      generatedAt: this.now().toISOString(),
      ledgerPath: this.ledgerPath,
      exists: true,
      total: receipts.length,
      returned: returnedReceipts.length,
      invalidLines: errors.length,
      receipts: returnedReceipts,
      errors,
    };
  }

  private hashSnapshot(snapshot: AiFirstFinalActivationGateSnapshot): string {
    const redacted = redactSensitiveText(JSON.stringify(snapshot));
    return crypto.createHash('sha256').update(redacted).digest('hex');
  }

  private finding(
    kind: AiFirstOwnerControlledDefaultFinding['kind'],
    severity: AiFirstOwnerControlledDefaultFinding['severity'],
    detail: string,
  ): AiFirstOwnerControlledDefaultFinding {
    return {
      id: `ai-first-default-${kind}-${this.sequence + 1}`,
      kind,
      severity,
      detail: redactSensitiveText(detail),
    };
  }

  private paths(): AiFirstOwnerControlledDefaultResult['paths'] {
    return {
      statePath: this.statePath,
      ledgerPath: this.ledgerPath,
    };
  }

  private commands(): AiFirstOwnerControlledDefaultResult['commands'] {
    return {
      plan: 'zavorth ai-first plan --snapshot <intent-model0.json> --owner-approval-id <id>',
      activate: 'zavorth ai-first activate --snapshot <intent-model0.json> --owner-approval-id <id> --apply --confirm-owner-controlled-default',
      status: 'zavorth ai-first status',
      rollback: 'zavorth ai-first rollback --owner-approval-id <id> --apply --confirm-rollback',
    };
  }
}

function clean(value: unknown): string | null {
  const text = redactSensitiveText(String(value || '').trim());
  return text ? text : null;
}

function hasSecretLikeValue(value: string): boolean {
  const redacted = redactSensitiveText(value);
  if (redacted !== value) {
    return true;
  }
  return /\bxox[pbarfs]-[A-Za-z0-9-]{6,}\b/i.test(value)
    || /\bsk-[A-Za-z0-9_-]{12,}\b/.test(value)
    || /\bgh[pousr]_[A-Za-z0-9_]{12,}\b/.test(value);
}
