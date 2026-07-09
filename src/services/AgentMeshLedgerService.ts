import { sanitizeReceiptText } from './AgentMeshExecutionService.js';
import { logger } from '../logger.js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config/index.js';
import type {
  AgentMeshExecutionReceipt,
  AgentMeshLedgerSnapshot,
} from '../contracts/AgentMeshExecutionContract.js';

export class AgentMeshLedgerService {
  private readonly ledgerPath: string;
  private readonly receipts: AgentMeshExecutionReceipt[] = [];
  private totalExecutions = 0;
  private blockedExecutions = 0;

  constructor(options: { ledgerPath?: string } = {}) {
    this.ledgerPath = options.ledgerPath || path.join(config.dataDir, 'runtime', 'agent-mesh-ledger.jsonl');
    this.loadLedger();
  }

  public recordReceipt(receipt: AgentMeshExecutionReceipt): void {
    const sanitized = sanitizeReceipt(receipt);
    this.receipts.push(sanitized);
    this.totalExecutions++;
    if (isBlockedStatus(sanitized.status)) {
      this.blockedExecutions++;
    }

    if (this.receipts.length > 1000) {
      this.receipts.shift();
    }

    this.appendToFile(sanitized);
  }

  public buildSnapshot(): AgentMeshLedgerSnapshot {
    return {
      generatedAt: new Date().toISOString(),
      contractVersion: '2026-05-09.agent-mesh-execution',
      totalExecutions: this.totalExecutions,
      blockedExecutions: this.blockedExecutions,
      recentReceipts: [...this.receipts].reverse().slice(0, 50).map(sanitizeReceipt),
      policy: {
        appendOnly: true,
        noPlaintextSecretsInLedger: true,
      },
    };
  }

  private loadLedger(): void {
    if (!fs.existsSync(this.ledgerPath)) {
      return;
    }
    try {
      const fileContent = fs.readFileSync(this.ledgerPath, 'utf8');
      const lines = fileContent.split('\n').filter(Boolean);
      this.totalExecutions = lines.length;

      for (const line of lines.slice(-1000)) {
        try {
          const receipt = sanitizeReceipt(JSON.parse(line) as AgentMeshExecutionReceipt);
          this.receipts.push(receipt);
          if (isBlockedStatus(receipt.status)) {
            this.blockedExecutions++;
          }
        } catch (error: unknown) {// Ignore malformed ledger lines.
      logger.warn('[Agent Mesh Ledger] JSON parse failed', error);
    }
      }
    } catch (error: unknown) {logger.error('Failed to load Agent Mesh Ledger:', error);
    }
  }

  private appendToFile(receipt: AgentMeshExecutionReceipt): void {
    try {
      const dir = path.dirname(this.ledgerPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(this.ledgerPath, `${JSON.stringify(sanitizeReceipt(receipt))}\n`);
    } catch (error: unknown) {logger.error('Failed to append to Agent Mesh Ledger:', error);
    }
  }
}

function sanitizeReceipt(receipt: AgentMeshExecutionReceipt): AgentMeshExecutionReceipt {
  return {
    ...receipt,
    finalResponseSummary: sanitizeReceiptText(receipt.finalResponseSummary),
    sandboxViolations: receipt.sandboxViolations.map(sanitizeReceiptText),
    budgetViolations: receipt.budgetViolations.map(sanitizeReceiptText),
    toolCallRecords: receipt.toolCallRecords.map((record) => ({ ...record })),
    policyDecision: {
      ...receipt.policyDecision,
      reasons: receipt.policyDecision.reasons.map(sanitizeReceiptText),
      requiredPermissions: receipt.policyDecision.requiredPermissions.slice(),
      deniedPermissions: receipt.policyDecision.deniedPermissions.slice(),
      criticalPermissions: receipt.policyDecision.criticalPermissions.slice(),
    },
    requiredPermissions: receipt.requiredPermissions.slice(),
    redactionApplied: true,
  };
}

function isBlockedStatus(status: AgentMeshExecutionReceipt['status']): boolean {
  return status === 'blocked_by_sandbox'
    || status === 'blocked_missing_consent'
    || status === 'interrupted_budget_exceeded'
    || status === 'interrupted_timeout'
    || status === 'blocked_by_policy'
    || status === 'failed_driver_unavailable';
}
