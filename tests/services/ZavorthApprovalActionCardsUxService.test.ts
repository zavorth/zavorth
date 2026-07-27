import { ZavorthApprovalActionCardsUxService } from '../../src/services/ZavorthApprovalActionCardsUxService.js';

describe('ZavorthApprovalActionCardsUxService', () => {
  it('builds approval cards with allow, deny, preview and receipt actions', () => {
    const service = new ZavorthApprovalActionCardsUxService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      approvals: [{
        id: 'approval_1',
        title: 'Edit config',
        reason: 'Zavorth wants to edit one file.',
        status: 'pending',
        risk: 'attention',
        scope: 'workspace',
      }],
      sensitiveActionFlowUx: {
        card: {
          id: 'saf_1',
          title: 'Approval needed',
          risk: 'medium',
          request: 'edit config',
          preview: { filesChanged: 1, commands: 0, networkCalls: 0, messages: 0 },
          rollback: { available: true, command: 'zavorth rollback preview', summary: 'Rollback ready.' },
          actions: [
            { id: 'view-preview', kind: 'preview', command: 'zavorth sensitive-flow --json' },
          ],
        },
      },
      visualReceipts: {
        cards: [{ id: 'receipt_1' }],
      },
    });

    expect(snapshot.status).toBe('attention');
    expect(snapshot.summary.pending).toBe(1);
    expect(snapshot.cards[0]?.actions.map((action) => action.kind)).toEqual(
      expect.arrayContaining(['view_preview', 'allow_once', 'deny', 'view_rollback', 'view_receipt']),
    );
    expect(snapshot.cards[0]?.actions.find((action) => action.kind === 'allow_once')?.dashboardCanResolveApproval).toBe(true);
    expect(snapshot.cards[0]?.actions.every((action) => action.dashboardCanExecuteTargetAction === false)).toBe(true);
    expect(snapshot.cards[0]?.actions.every((action) => action.zavorthControlCanExecuteTargetAction === false)).toBe(true);
    expect(snapshot.dashboardProjection.zavorthControlCanExecuteTargetAction).toBe(false);
  });

  it('can build from sensitive flow even when gateway approvals are absent', () => {
    const service = new ZavorthApprovalActionCardsUxService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      sensitiveActionFlowUx: {
        card: {
          id: 'saf_2',
          title: 'Approval needed',
          status: 'needs_approval',
          risk: 'high',
          request: 'run command',
          approval: { required: true, id: 'approval_saf', status: 'pending', simpleText: 'Allow once-' },
          preview: { filesChanged: 0, commands: 1, networkCalls: 0, messages: 0 },
          rollback: { available: false, command: null, summary: 'No rollback.' },
          actions: [],
        },
      },
    });

    expect(snapshot.summary.totalCards).toBe(1);
    expect(snapshot.cards[0]?.id).toBe('approval_saf');
    expect(snapshot.cards[0]?.risk).toBe('high');
  });

  it('redacts secret-like values from cards and commands', () => {
    const service = new ZavorthApprovalActionCardsUxService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      approvals: [{
        id: 'approval_secret',
        title: 'Use OPENAI_API_KEY=sk-secret-value',
        reason: 'send OPENAI_API_KEY=sk-secret-value',
        status: 'pending',
        risk: 'danger',
      }],
    });

    expect(JSON.stringify(snapshot)).not.toContain('sk-secret-value');
    expect(snapshot.summary.rawSecretsSerialized).toBe(false);
  });
});
