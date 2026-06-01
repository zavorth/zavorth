import { SandboxExecutionReceiptService } from '../../src/services/SandboxExecutionReceiptService.js';

describe('SandboxExecutionReceiptService', () => {
  it('records command digest, limits, policies and cleanup state', () => {
    const receipt = new SandboxExecutionReceiptService({
      now: () => new Date('2026-05-31T12:00:00.000Z'),
    }).createReceipt({
      backend: 'docker',
      command: ['npm', 'test'],
      timeoutMs: 30_000,
      memoryMb: 512,
      cpuCount: 2,
      pidsLimit: 128,
      networkPolicy: 'none',
      mountPolicy: 'workspace-readonly',
      exitCode: 0,
      cleanupStatus: 'completed',
      approvalId: 'approval-sandbox-1',
    });

    expect(receipt.contractVersion).toBe('sandbox-execution-receipt/1');
    expect(receipt.commandDigest).toHaveLength(64);
    expect(receipt.limits).toEqual(expect.objectContaining({ timeoutMs: 30000, memoryMb: 512 }));
    expect(receipt.cleanupStatus).toBe('completed');
    expect(receipt.safety.hostEscapeDenied).toBe(true);
  });

  it('marks preview-only fallback honestly when no strong sandbox is available', () => {
    const receipt = new SandboxExecutionReceiptService().createReceipt({
      backend: 'preview-only',
      command: 'unknown installer',
      previewOnlyFallback: true,
    });

    expect(receipt.cleanupStatus).toBe('preview_only');
    expect(receipt.safety.previewOnlyFallback).toBe(true);
  });
});
