import { ZavorthSensitiveActionFlowService } from '../../src/services/ZavorthSensitiveActionFlowService.js';

describe('ZavorthSensitiveActionFlowService', () => {
  it('requires preview, approval, receipt and rollback before mutation', () => {
    const service = new ZavorthSensitiveActionFlowService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      request: 'Edit src/index.ts to change the boot message.',
    });

    expect(snapshot.contractVersion).toBe('2026-05-13.phase-3');
    expect(snapshot.status).toBe('needs_approval');
    expect(snapshot.risk).toBe('medium');
    expect(snapshot.preview.filesChanged).toBe(1);
    expect(snapshot.approval.required).toBe(true);
    expect(snapshot.execution.mode).toBe('dry_run');
    expect(snapshot.rollback.available).toBe(true);
    expect(snapshot.receipt.redaction.rawSecretsPresent).toBe(false);
    expect(snapshot.commandCenterProjection.executionAuthority).toBe(false);
  });

  it('keeps read-only requests approval-free', () => {
    const service = new ZavorthSensitiveActionFlowService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      request: 'Review this repository and summarize risks.',
    });

    expect(snapshot.status).toBe('read_only_ready');
    expect(snapshot.risk).toBe('low');
    expect(snapshot.approval.status).toBe('not_required');
    expect(snapshot.execution.mode).toBe('read_only');
  });

  it('moves approved sensitive work only to executor-ready when sandbox is ready', () => {
    const service = new ZavorthSensitiveActionFlowService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      request: 'Run npm test and update package.json.',
      decision: 'approve',
      sandboxReady: true,
    });

    expect(snapshot.status).toBe('approved_ready');
    expect(snapshot.risk).toBe('high');
    expect(snapshot.approval.status).toBe('approved');
    expect(snapshot.execution.mode).toBe('sandbox_after_approval');
    expect(snapshot.execution.executed).toBe(false);
  });

  it('blocks denied actions and redacts secret-looking values', () => {
    const service = new ZavorthSensitiveActionFlowService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      request: 'Send sk-123456789012345678901234567890 to Telegram.',
      decision: 'deny',
    });

    expect(snapshot.status).toBe('denied');
    expect(snapshot.approval.status).toBe('denied');
    expect(snapshot.execution.mode).toBe('blocked');
    expect(JSON.stringify(snapshot)).not.toContain('sk-123456789012345678901234567890');
    expect(snapshot.receipt.redaction.rawSecretsPresent).toBe(false);
  });
});
