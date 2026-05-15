import type { ZavorthVisualReceiptContract } from '../../src/contracts/ZavorthVisualReceiptContract';
import { ZavorthVisualReceiptsV2Service } from '../../src/services/ZavorthVisualReceiptsV2Service';

describe('ZavorthVisualReceiptsV2Service', () => {
  it('turns legacy receipt UX into product cards without execution authority', () => {
    const googleToken = ['AI', 'za', '123456789012345678901234567890'].join('');
    const snapshot = new ZavorthVisualReceiptsV2Service().buildSnapshot({
      receipts: [receipt({
        simpleText: `Completed safely with token sk-secretshouldvanish123456 and Google key ${googleToken}.`,
        filesChanged: 0,
        approvals: 0,
        risk: 'low',
      })],
    });

    expect(snapshot.surface).toBe('visual-receipts-v2');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.summary.rawSecretsSerialized).toBe(false);
    expect(snapshot.safety.dashboardCanExecute).toBe(false);
    expect(snapshot.commandCenterProjection.executionAuthority).toBe(false);
    expect(snapshot.cards[0]?.confidence).toBe('clear');
    expect(snapshot.cards[0]?.safeActions.every((action) => action.dashboardCanExecute === false)).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('sk-secretshouldvanish');
    expect(JSON.stringify(snapshot)).not.toContain(googleToken);
    expect(JSON.stringify(snapshot)).toContain('[REDACTED_SECRET]');
  });

  it('marks approvals, mutations and rollback as review-worthy', () => {
    const snapshot = new ZavorthVisualReceiptsV2Service().buildSnapshot({
      includeAdvancedStory: true,
      receipts: [receipt({
        filesChanged: 2,
        approvals: 1,
        rollbackAvailable: true,
        risk: 'medium',
      })],
    });

    expect(snapshot.status).toBe('attention');
    expect(snapshot.summary.needsReview).toBe(1);
    expect(snapshot.summary.rollbackAvailable).toBe(1);
    expect(snapshot.cards[0]?.confidence).toBe('needs_review');
    expect(snapshot.cards[0]?.safeActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'rollback', requiresApproval: true, mutatesState: true, dashboardCanExecute: false }),
      expect.objectContaining({ kind: 'export', safeByDefault: true }),
    ]));
    expect(snapshot.cards[0]?.receiptStory.some((line) => line.includes('Policy Broker'))).toBe(true);
  });

  it('keeps high-risk or blocked receipts prominent', () => {
    const snapshot = new ZavorthVisualReceiptsV2Service().buildSnapshot({
      receipts: [receipt({
        risk: 'high',
        actionsBlocked: 1,
      })],
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.summary.blockedOrRisky).toBe(1);
    expect(snapshot.cards[0]?.tone).toBe('blocked');
    expect(snapshot.nextAction).toContain('Review blocked');
  });
});

function receipt(overrides: Partial<{
  risk: ZavorthVisualReceiptContract['summary']['risk'];
  simpleText: string;
  filesChanged: number;
  actionsBlocked: number;
  approvals: number;
  rollbackAvailable: boolean;
}> = {}): ZavorthVisualReceiptContract {
  return {
    schemaVersion: 1,
    surface: 'visual-receipt',
    id: 'receipt-v2-test',
    missionId: 'mission-v2-test',
    generatedAt: '2026-05-15T12:00:00.000Z',
    mode: 'simple',
    summary: {
      title: 'Mission receipt',
      risk: overrides.risk || 'low',
      outcome: 'completed',
      filesRead: 5,
      filesChanged: overrides.filesChanged ?? 0,
      actionsBlocked: overrides.actionsBlocked ?? 0,
      networkUsed: 0,
      networkBlocked: 0,
      approvals: overrides.approvals ?? 0,
      rollbackAvailable: overrides.rollbackAvailable ?? false,
    },
    simpleText: overrides.simpleText || 'Mission completed with evidence.',
    advanced: {
      policyBroker: 'required',
      trustPlane: 'active',
      commandCenterCanExecute: false,
      sandboxMutationMode: 'dry-run',
      approvalOptions: ['view_preview', 'deny'],
      artifacts: ['artifact-v2'],
    },
    redaction: {
      rawSecretsPresent: false,
      policy: 'secretrefs-only',
    },
  };
}
