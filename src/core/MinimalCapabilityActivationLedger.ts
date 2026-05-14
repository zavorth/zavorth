import fs from 'fs';
import path from 'path';
import { findProjectRoot } from '../config/configHelpers.js';
import type {
  MinimalCapabilityActivationMode,
  MinimalCapabilityActivationStatus,
} from './MinimalCapabilityActivationPlanner.js';
import type { MinimalCapabilityBootMode } from './MinimalCapabilityRegistry.js';
import type { MinimalSidecarSnapshot } from './MinimalSidecarManager.js';

export type MinimalCapabilityActivationOperation = 'plan' | 'activate' | 'replay' | 'rollback';

export type MinimalCapabilityActivationReceipt = {
  version: 1;
  id: string;
  createdAt: string;
  operation: MinimalCapabilityActivationOperation;
  profileId: string;
  capabilityId: string;
  label: string;
  kind: string;
  source: string;
  boot: MinimalCapabilityBootMode | 'missing';
  mode: MinimalCapabilityActivationMode;
  status: MinimalCapabilityActivationStatus;
  contractStatus: 'passed' | 'warning' | 'failed';
  dryRun: boolean;
  applied: boolean;
  action: string;
  message: string;
  entry: string | null;
  reasons: string[];
  nextSteps: string[];
  sidecar: MinimalCapabilityActivationReceiptSidecar | null;
  sidecarResult: MinimalCapabilityActivationReceiptSidecar | null;
};

export type MinimalCapabilityActivationReceiptSidecar = {
  id: string;
  state: string;
  launchable: boolean;
  running: boolean;
  ready: boolean;
  pid: number | null;
  command: string | null;
  cwd: string | null;
  statusFile: string;
};

export type MinimalCapabilityActivationReceiptInput = {
  operation: MinimalCapabilityActivationOperation;
  dryRun: boolean;
  applied: boolean;
  message: string;
  plan: {
    profileId: string;
    capabilityId: string;
    label: string;
    kind: string;
    source: string;
    boot: MinimalCapabilityBootMode | 'missing';
    mode: MinimalCapabilityActivationMode;
    status: MinimalCapabilityActivationStatus;
    contractStatus: 'passed' | 'warning' | 'failed';
    action: string;
    entry: string | null;
    reasons: string[];
    nextSteps: string[];
    sidecar: MinimalSidecarSnapshot | null;
  };
  sidecarResult?: MinimalSidecarSnapshot | null;
};

export type MinimalCapabilityActivationLedgerSnapshot = {
  version: 1;
  generatedAt: string;
  ledgerFile: string;
  status: 'passed' | 'failed';
  exists: boolean;
  total: number;
  returned: number;
  invalidLines: number;
  filteredByProfile: string | null;
  filteredByCapability: string | null;
  counts: {
    plan: number;
    activate: number;
    replay: number;
    rollback: number;
    dryRun: number;
    applied: number;
    active: number;
    ready: number;
    manual: number;
    disabled: number;
    missing: number;
    blocked: number;
  };
  receipts: MinimalCapabilityActivationReceipt[];
  errors: Array<{
    line: number;
    reason: string;
  }>;
};

export type MinimalCapabilityActivationLedgerOptions = {
  projectRoot?: string;
  dataDir?: string;
  ledgerFile?: string;
};

export type MinimalCapabilityActivationLedgerReadOptions = {
  limit?: number;
  profile?: string | null;
  capability?: string | null;
};

export class MinimalCapabilityActivationLedger {
  private readonly projectRoot: string;
  private readonly dataDir: string;
  private readonly ledgerFile: string;

  constructor(options: MinimalCapabilityActivationLedgerOptions = {}) {
    this.projectRoot = options.projectRoot || findProjectRoot();
    this.dataDir = options.dataDir || path.resolve(this.projectRoot, 'data', 'runtime');
    this.ledgerFile = options.ledgerFile || path.resolve(this.dataDir, 'capability-activation-ledger.jsonl');
  }

  public append(input: MinimalCapabilityActivationReceiptInput): MinimalCapabilityActivationReceipt {
    const receipt: MinimalCapabilityActivationReceipt = {
      version: 1,
      id: this.createReceiptId(input),
      createdAt: new Date().toISOString(),
      operation: input.operation,
      profileId: input.plan.profileId,
      capabilityId: input.plan.capabilityId,
      label: input.plan.label,
      kind: input.plan.kind,
      source: input.plan.source,
      boot: input.plan.boot,
      mode: input.plan.mode,
      status: input.plan.status,
      contractStatus: input.plan.contractStatus,
      dryRun: input.dryRun,
      applied: input.applied,
      action: input.plan.action,
      message: input.message,
      entry: input.plan.entry,
      reasons: input.plan.reasons,
      nextSteps: input.plan.nextSteps,
      sidecar: this.toReceiptSidecar(input.plan.sidecar),
      sidecarResult: this.toReceiptSidecar(input.sidecarResult || null),
    };

    fs.mkdirSync(path.dirname(this.ledgerFile), { recursive: true });
    fs.appendFileSync(this.ledgerFile, `${JSON.stringify(receipt)}\n`, 'utf8');
    return receipt;
  }

  public buildSnapshot(options: MinimalCapabilityActivationLedgerReadOptions = {}): MinimalCapabilityActivationLedgerSnapshot {
    const parsed = this.readReceipts();
    const profile = this.normalizeFilter(options.profile);
    const capability = this.normalizeFilter(options.capability);
    const limit = this.normalizeLimit(options.limit);
    const filtered = parsed.receipts.filter((receipt) => {
      const profileMatches = !profile || receipt.profileId === profile;
      const capabilityMatches = !capability || receipt.capabilityId === capability;
      return profileMatches && capabilityMatches;
    });
    const receipts = filtered.slice(-limit).reverse();
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      ledgerFile: this.ledgerFile,
      status: parsed.errors.length === 0 ? 'passed' : 'failed',
      exists: fs.existsSync(this.ledgerFile),
      total: filtered.length,
      returned: receipts.length,
      invalidLines: parsed.errors.length,
      filteredByProfile: profile,
      filteredByCapability: capability,
      counts: this.countReceipts(filtered),
      receipts,
      errors: parsed.errors,
    };
  }

  private readReceipts(): {
    receipts: MinimalCapabilityActivationReceipt[];
    errors: Array<{ line: number; reason: string }>;
  } {
    if (!fs.existsSync(this.ledgerFile)) {
      return { receipts: [], errors: [] };
    }
    const receipts: MinimalCapabilityActivationReceipt[] = [];
    const errors: Array<{ line: number; reason: string }> = [];
    const lines = fs.readFileSync(this.ledgerFile, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!line.trim()) {
        return;
      }
      try {
        const parsed = JSON.parse(line) as MinimalCapabilityActivationReceipt;
        this.assertReceipt(parsed);
        receipts.push(parsed);
      } catch (error) {
        errors.push({
          line: index + 1,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    });
    return { receipts, errors };
  }

  private assertReceipt(receipt: MinimalCapabilityActivationReceipt): void {
    if (!receipt || typeof receipt !== 'object') {
      throw new Error('Receipt must be an object.');
    }
    if (receipt.version !== 1) {
      throw new Error('Receipt version must be 1.');
    }
    for (const field of ['id', 'createdAt', 'operation', 'profileId', 'capabilityId', 'mode', 'status'] as const) {
      if (!String(receipt[field] || '').trim()) {
        throw new Error(`Receipt field ${field} is required.`);
      }
    }
    if (!['plan', 'activate', 'replay', 'rollback'].includes(receipt.operation)) {
      throw new Error(`Receipt operation ${receipt.operation} is invalid.`);
    }
  }

  private countReceipts(receipts: MinimalCapabilityActivationReceipt[]): MinimalCapabilityActivationLedgerSnapshot['counts'] {
    return {
      plan: receipts.filter((receipt) => receipt.operation === 'plan').length,
      activate: receipts.filter((receipt) => receipt.operation === 'activate').length,
      replay: receipts.filter((receipt) => receipt.operation === 'replay').length,
      rollback: receipts.filter((receipt) => receipt.operation === 'rollback').length,
      dryRun: receipts.filter((receipt) => receipt.dryRun).length,
      applied: receipts.filter((receipt) => receipt.applied).length,
      active: receipts.filter((receipt) => receipt.status === 'active').length,
      ready: receipts.filter((receipt) => receipt.status === 'ready').length,
      manual: receipts.filter((receipt) => receipt.status === 'manual').length,
      disabled: receipts.filter((receipt) => receipt.status === 'disabled').length,
      missing: receipts.filter((receipt) => receipt.status === 'missing').length,
      blocked: receipts.filter((receipt) => receipt.status === 'blocked').length,
    };
  }

  private toReceiptSidecar(sidecar: MinimalSidecarSnapshot | null): MinimalCapabilityActivationReceiptSidecar | null {
    if (!sidecar) {
      return null;
    }
    return {
      id: sidecar.id,
      state: sidecar.state,
      launchable: sidecar.launchable,
      running: sidecar.running,
      ready: sidecar.ready,
      pid: sidecar.pid,
      command: sidecar.command,
      cwd: sidecar.cwd,
      statusFile: sidecar.statusFile,
    };
  }

  private createReceiptId(input: MinimalCapabilityActivationReceiptInput): string {
    const base = `${input.operation}-${input.plan.profileId}-${input.plan.capabilityId}-${process.pid}`;
    return `${Date.now().toString(36)}-${base.replace(/[^a-z0-9._:-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()}`;
  }

  private normalizeFilter(value: string | null | undefined): string | null {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized || null;
  }

  private normalizeLimit(value: number | null | undefined): number {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized > 0 ? Math.min(Math.floor(normalized), 500) : 20;
  }
}
