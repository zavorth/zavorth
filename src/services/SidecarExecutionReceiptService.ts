import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

export type SidecarExecutionKind = 'shell' | 'browser';
export type SidecarExecutionStatus = 'succeeded' | 'failed' | 'blocked';

export type SidecarExecutionReceipt = {
  id: string;
  sidecarId: 'runtime-shell-sidecar' | 'browser-sidecar';
  kind: SidecarExecutionKind;
  action: string;
  status: SidecarExecutionStatus;
  createdAt: string;
  auditId: string;
  runtime: string;
  isolationLevel: 'container' | 'microvm' | 'browser-sidecar' | 'unknown';
  durationMs: number | null;
  exitCode: number | null;
  summary: string;
  metadata?: Record<string, unknown>;
};

export type SidecarExecutionReceiptSnapshot = {
  contractVersion: 'sidecar-execution-receipts/v1';
  generatedAt: string;
  receiptFile: string;
  totalReceipts: number;
  recentReceipts: SidecarExecutionReceipt[];
  summary: {
    shellReceipts: number;
    browserReceipts: number;
    succeeded: number;
    failed: number;
    blocked: number;
  };
};

export class SidecarExecutionReceiptService {
  private readonly receiptFile: string;
  private readonly now: () => Date;

  constructor(options: {
    receiptFile?: string;
    now?: () => Date;
  } = {}) {
    this.receiptFile = options.receiptFile
      || process.env.ZAVORTH_SIDECAR_EXECUTION_RECEIPTS_FILE
      || path.resolve(config.projectRoot, 'data', 'runtime', 'sidecar-execution-receipts.jsonl');
    this.now = options.now || (() => new Date());
  }

  public createAuditId(seed: string): string {
    return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16);
  }

  public hashSensitiveValue(value: unknown): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(value ?? null))
      .digest('hex')
      .slice(0, 16);
  }

  public record(input: Omit<SidecarExecutionReceipt, 'id' | 'createdAt'> & {
    id?: string;
    createdAt?: string;
  }): SidecarExecutionReceipt {
    const createdAt = input.createdAt || this.now().toISOString();
    const id = input.id || [
      input.sidecarId,
      input.kind,
      input.status,
      input.auditId,
      createdAt,
    ].join(':');
    const receipt: SidecarExecutionReceipt = {
      ...input,
      id,
      createdAt,
    };
    fs.mkdirSync(path.dirname(this.receiptFile), { recursive: true });
    fs.appendFileSync(this.receiptFile, `${JSON.stringify(receipt)}\n`, 'utf8');
    return receipt;
  }

  public list(limit = 50): SidecarExecutionReceipt[] {
    if (!fs.existsSync(this.receiptFile)) {
      return [];
    }
    const receipts: SidecarExecutionReceipt[] = [];
    for (const line of fs.readFileSync(this.receiptFile, 'utf8').split(/\r?\n/u)) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      try {
        const parsed = JSON.parse(trimmed) as SidecarExecutionReceipt;
        if (this.isReceipt(parsed)) {
          receipts.push(parsed);
        }
      } catch (error) { // Ignore malformed historical lines; the ledger is append-only. logger.warn('[Sidecar Execution Receipt] JSON parse failed', error); }
    }
    return receipts
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(0, Math.floor(limit)));
  }

  public buildSnapshot(limit = 20): SidecarExecutionReceiptSnapshot {
    const recentReceipts = this.list(limit);
    return {
      contractVersion: 'sidecar-execution-receipts/v1',
      generatedAt: this.now().toISOString(),
      receiptFile: this.receiptFile,
      totalReceipts: this.countReceipts(),
      recentReceipts,
      summary: {
        shellReceipts: recentReceipts.filter((receipt) => receipt.kind === 'shell').length,
        browserReceipts: recentReceipts.filter((receipt) => receipt.kind === 'browser').length,
        succeeded: recentReceipts.filter((receipt) => receipt.status === 'succeeded').length,
        failed: recentReceipts.filter((receipt) => receipt.status === 'failed').length,
        blocked: recentReceipts.filter((receipt) => receipt.status === 'blocked').length,
      },
    };
  }

  private countReceipts(): number {
    if (!fs.existsSync(this.receiptFile)) {
      return 0;
    }
    return fs.readFileSync(this.receiptFile, 'utf8')
      .split(/\r?\n/u)
      .filter((line) => line.trim().length > 0)
      .length;
  }

  private isReceipt(value: unknown): value is SidecarExecutionReceipt {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    const record = value as Record<string, unknown>;
    return typeof record.id === 'string'
      && typeof record.sidecarId === 'string'
      && typeof record.kind === 'string'
      && typeof record.status === 'string'
      && typeof record.auditId === 'string'
      && typeof record.createdAt === 'string';
  }
}
