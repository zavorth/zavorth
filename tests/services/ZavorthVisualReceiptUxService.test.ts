import type { ZavorthVisualReceiptContract } from '../../src/contracts/ZavorthVisualReceiptContract.js';
import { ZavorthVisualReceiptUxService } from '../../src/services/ZavorthVisualReceiptUxService.js';

describe('ZavorthVisualReceiptUxService', () => {
  it('builds simple and advanced receipt cards without leaking secrets or execution authority', () => {
    const service = new ZavorthVisualReceiptUxService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      includeAdvanced: true,
      receipts: [receipt({
        simpleText: 'Changed files after approval. token sk-thisshouldberemoved1234567890',
        filesChanged: 2,
        approvals: 1,
        rollbackAvailable: true,
      })],
    });

    expect(snapshot.contractVersion).toBe('2026-05-13.checkpoint-14');
    expect(snapshot.surface).toBe('visual-receipt-ux');
    expect(snapshot.status).toBe('attention');
    expect(snapshot.summary).toEqual(expect.objectContaining({
      totalReceipts: 1,
      rollbackAvailable: 1,
      approvalsPending: 1,
      rawSecretsSerialized: false,
    }));
    expect(snapshot.dashboardProjection).toEqual(expect.objectContaining({
      route: '/zavorthControl',
      executionAuthority: false,
      zavorthControlCanExecute: false,
      renderMode: 'projection-only',
    }));
    expect(snapshot.zavorthControlProjection).toEqual(expect.objectContaining({
      route: '/control',
      executionAuthority: false,
      zavorthControlCanExecute: false,
      renderMode: 'projection-only',
    }));
    expect(snapshot.cards[0]).toEqual(expect.objectContaining({
      safety: expect.objectContaining({
        rawSecretsSerialized: false,
        dashboardCanExecute: false,
        zavorthControlCanExecute: false,
        projectionOnly: true,
      }),
      advanced: expect.objectContaining({
        visible: true,
        policyBroker: 'required',
        trustPlane: 'active',
      }),
    }));
    expect(snapshot.cards[0]?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'inspect', mutatesState: false, dashboardCanExecute: false, zavorthControlCanExecute: false }),
      expect.objectContaining({ kind: 'rollback', mutatesState: true, dashboardCanExecute: false, zavorthControlCanExecute: false }),
    ]));
    expect(JSON.stringify(snapshot)).not.toContain('sk-thisshouldberemoved');
    expect(JSON.stringify(snapshot)).toContain('[REDACTED_SECRET]');
  });

  it('keeps read-only receipts calm and actionable', () => {
    const service = new ZavorthVisualReceiptUxService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      receipts: [receipt({
        risk: 'low',
        filesChanged: 0,
        approvals: 0,
        rollbackAvailable: false,
      })],
    });

    expect(snapshot.status).toBe('ready');
    expect(snapshot.cards[0]?.tone).toBe('ok');
    expect(snapshot.cards[0]?.actions.some((action) => action.kind === 'rollback')).toBe(false);
    expect(snapshot.nextAction).toContain('Inspect');
  });
});

function receipt(overrides: Partial<{
  risk: ZavorthVisualReceiptContract['summary']['risk'];
  simpleText: string;
  filesChanged: number;
  approvals: number;
  rollbackAvailable: boolean;
}> = {}): ZavorthVisualReceiptContract {
  return {
    schemaVersion: 1,
    surface: 'visual-receipt',
    id: 'receipt-test',
    missionId: 'mission-test',
    generatedAt: '2026-05-13T12:00:00.000Z',
    mode: 'simple',
    summary: {
      title: 'Daily receipt',
      risk: overrides.risk || 'medium',
      outcome: 'completed',
      filesRead: 3,
      filesChanged: overrides.filesChanged ?? 1,
      actionsBlocked: 0,
      networkUsed: 0,
      networkBlocked: 0,
      approvals: overrides.approvals ?? 0,
      rollbackAvailable: overrides.rollbackAvailable ?? false,
    },
    simpleText: overrides.simpleText || 'Zavorth recorded a safe action.',
    advanced: {
      policyBroker: 'required',
      trustPlane: 'active',
      dashboardCanExecute: false,
      sandboxMutationMode: 'dry-run',
      approvalOptions: ['view_preview'],
      artifacts: ['artifact-1'],
    },
    redaction: {
      rawSecretsPresent: false,
      policy: 'secretrefs-only',
    },
  };
}
