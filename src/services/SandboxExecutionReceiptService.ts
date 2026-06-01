import { createHash, randomUUID } from 'node:crypto';

import type { SandboxExecutionReceipt } from '../contracts/SandboxExecutionReceiptContract.js';

type SandboxReceiptInput = {
  backend?: SandboxExecutionReceipt['backend'];
  command: string | string[];
  timeoutMs?: number | null;
  memoryMb?: number | null;
  cpuCount?: number | null;
  pidsLimit?: number | null;
  networkPolicy?: SandboxExecutionReceipt['networkPolicy'];
  mountPolicy?: SandboxExecutionReceipt['mountPolicy'];
  exitCode?: number | null;
  cleanupStatus?: SandboxExecutionReceipt['cleanupStatus'];
  approvalId?: string | null;
  previewOnlyFallback?: boolean;
};

type SandboxExecutionReceiptServiceOptions = {
  now?: () => Date;
};

export class SandboxExecutionReceiptService {
  private readonly now: () => Date;

  constructor(options: SandboxExecutionReceiptServiceOptions = {}) {
    this.now = options.now || (() => new Date());
  }

  public createReceipt(input: SandboxReceiptInput): SandboxExecutionReceipt {
    const command = Array.isArray(input.command) ? input.command.join(' ') : String(input.command || '');
    const previewOnly = Boolean(input.previewOnlyFallback || input.backend === 'preview-only');
    const receiptId = `sandbox-receipt-${randomUUID()}`;
    return {
      contractVersion: 'sandbox-execution-receipt/1',
      id: receiptId,
      createdAt: this.now().toISOString(),
      backend: input.backend || (previewOnly ? 'preview-only' : 'docker'),
      command,
      commandDigest: createHash('sha256').update(command).digest('hex'),
      limits: {
        timeoutMs: Math.max(1, Number(input.timeoutMs || 60_000)),
        memoryMb: input.memoryMb ?? null,
        cpuCount: input.cpuCount ?? null,
        pidsLimit: input.pidsLimit ?? null,
      },
      networkPolicy: input.networkPolicy || 'none',
      mountPolicy: input.mountPolicy || 'tmp-only',
      exitCode: input.exitCode ?? null,
      cleanupStatus: input.cleanupStatus || (previewOnly ? 'preview_only' : 'not_started'),
      approvalId: input.approvalId || null,
      receiptId,
      safety: {
        sandboxFirst: true,
        previewOnlyFallback: previewOnly,
        hostEscapeDenied: true,
        unsafeMountsBlocked: true,
      },
    };
  }
}
