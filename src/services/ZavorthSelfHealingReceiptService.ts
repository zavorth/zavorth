import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { ExperienceReceipt } from './experience/ExperienceContracts.js';
import {
  sanitize,
} from './ZavorthSelfHealingUxService.js';
import { logger } from '../logger.js';
import type {
ZavorthSelfHealingAction,
  ZavorthSelfHealingIssueKind,
  ZavorthSelfHealingProjection,
} from '../contracts/ZavorthSelfHealingUxContract.js';

export const ZAVORTH_SELF_HEALING_RECEIPT_CONTRACT_VERSION = 'ZavorthSelfHealingReceipt/v1' as const;

export type ZavorthSelfHealingReceiptStatus =
  | 'proposed'
  | 'applied'
  | 'blocked'
  | 'failed'
  | 'needs_user'
  | 'skipped';

export type ZavorthSelfHealingReceipt = {
  contractVersion: typeof ZAVORTH_SELF_HEALING_RECEIPT_CONTRACT_VERSION;
  id: string;
  createdAt: string;
  issue: ZavorthSelfHealingIssueKind;
  attempted: string;
  status: ZavorthSelfHealingReceiptStatus;
  actionId: string | null;
  actionKind: string | null;
  applied: boolean;
  summary: string;
  nextSafeAction: string;
  approvalRequired: boolean;
  needsUserInput: boolean;
  fallbackProvider: string | null;
  receiptHash: string;
  rawSecretsSerialized: false;
};

export type ZavorthSelfHealingReceiptInput = {
  projection: ZavorthSelfHealingProjection;
  action?: ZavorthSelfHealingAction | null;
  status: ZavorthSelfHealingReceiptStatus;
  applied?: boolean;
  summary?: string | null;
  fallbackProvider?: string | null;
};

export type ZavorthSelfHealingReceiptRuntime = {
  now?: () => Date;
  storePath?: string | null;
};

export class ZavorthSelfHealingReceiptService {
  private readonly now: () => Date;
  private readonly storePath: string;

  constructor(runtime: ZavorthSelfHealingReceiptRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.storePath = runtime.storePath || path.join(process.cwd(), '.zavorth', 'receipts', 'self-healing.jsonl');
  }

  public append(input: ZavorthSelfHealingReceiptInput): ZavorthSelfHealingReceipt {
    const createdAt = this.now().toISOString();
    const action = input.action || input.projection.actions[0] || null;
    const seed = [
      createdAt,
      input.projection.issue,
      input.projection.attempted,
      action?.id || '',
      input.status,
      input.summary || '',
    ].join('|');
    const id = `self-healing:${crypto.createHash('sha1').update(seed).digest('hex').slice(0, 16)}`;
    const body: Omit<ZavorthSelfHealingReceipt, 'receiptHash'> = {
      contractVersion: ZAVORTH_SELF_HEALING_RECEIPT_CONTRACT_VERSION,
      id,
      createdAt,
      issue: input.projection.issue,
      attempted: sanitize(input.projection.attempted),
      status: input.status,
      actionId: action?.id || null,
      actionKind: action?.kind || null,
      applied: input.applied === true,
      summary: sanitize(input.summary || input.projection.problem),
      nextSafeAction: sanitize(input.projection.nextSafeAction),
      approvalRequired: action?.approvalRequired === true,
      needsUserInput: input.projection.needsUserInput === true || action?.needsUserInput === true,
      fallbackProvider: sanitize(input.fallbackProvider || input.projection.fallback?.selectedProvider || '') || null,
      rawSecretsSerialized: false,
    };
    const receipt: ZavorthSelfHealingReceipt = {
      ...body,
      receiptHash: crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex'),
    };
    this.write(receipt);
    return receipt;
  }

  public list(limit = 12): ZavorthSelfHealingReceipt[] {
    try {
      if (!fs.existsSync(this.storePath)) return [];
      const lines = fs.readFileSync(this.storePath, 'utf8').split(/\r?\n/).filter(Boolean);
      return lines
        .slice(-Math.max(0, limit))
        .map((line) => {
          try {
            return JSON.parse(line) as ZavorthSelfHealingReceipt;
          } catch (error: any) { logger.warn('[Zavorth Self Healing Receipt] JSON parse failed', error); return null; }
        })
        .filter((entry): entry is ZavorthSelfHealingReceipt => Boolean(entry))
        .reverse();
    } catch (error: any) { logger.warn('[Zavorth Self Healing Receipt] JSON parse failed', error); return []; }
  }

  public toExperienceReceipts(limit = 6): ExperienceReceipt[] {
    return this.list(limit).map((receipt) => ({
      id: receipt.id,
      title: this.title(receipt),
      detail: receipt.summary,
      status: this.toExperienceStatus(receipt.status),
      source: 'self-healing',
      createdAt: receipt.createdAt,
    }));
  }

  private write(receipt: ZavorthSelfHealingReceipt): void {
    try {
      fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
      fs.appendFileSync(this.storePath, `${JSON.stringify(receipt)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
      });
    } catch (error: any) {
      // Receipts must never break the user flow; failed receipt writes are surfaced by normal runtime checks.
      logger.warn('[Zavorth Self Healing Receipt] filesystem operation failed', error);
    }
  }

  private title(receipt: ZavorthSelfHealingReceipt): string {
    if (receipt.applied) return `Self-healing applied: ${receipt.issue}`;
    if (receipt.status === 'needs_user') return `Self-healing needs input: ${receipt.issue}`;
    if (receipt.status === 'failed') return `Self-healing failed: ${receipt.issue}`;
    return `Self-healing prepared: ${receipt.issue}`;
  }

  private toExperienceStatus(status: ZavorthSelfHealingReceiptStatus): ExperienceReceipt['status'] {
    if (status === 'applied' || status === 'skipped') return 'ready';
    if (status === 'failed') return 'failed';
    if (status === 'blocked') return 'blocked';
    return 'pending';
  }
}
