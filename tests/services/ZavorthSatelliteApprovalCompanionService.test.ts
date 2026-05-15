import { ZavorthSatelliteApprovalCompanionService } from '../../src/services/ZavorthSatelliteApprovalCompanionService';

describe('ZavorthSatelliteApprovalCompanionService', () => {
  it('projects scoped approvals for Satellite without target execution authority', () => {
    const snapshot = new ZavorthSatelliteApprovalCompanionService({
      now: () => new Date('2026-05-15T12:00:00.000Z'),
    }).buildSnapshot({
      user: 'Grey Vritra',
      missionId: 'mission-satellite-test',
      approvals: [{
        id: 'approval-satellite-test',
        title: 'Edit two files',
        reason: 'Zavorth wants to apply a scoped patch.',
        status: 'pending',
        risk: 'medium',
        scope: 'workspace.write:two-files',
      }],
    });

    expect(snapshot.surface).toBe('satellite-approval-companion');
    expect(snapshot.route).toBe('/satellite');
    expect(snapshot.summary.pending).toBe(1);
    expect(snapshot.companionProjection.executionAuthority).toBe(false);
    expect(snapshot.safety.satelliteCanExecuteTargetAction).toBe(false);
    expect(snapshot.cards[0]?.safety.satelliteCanExecuteTargetAction).toBe(false);
    expect(snapshot.cards[0]?.scope.user).toBe('Grey Vritra');
    expect(snapshot.cards[0]?.buttons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        decision: 'approve',
        endpoint: '/api/v1/approvals/approval-satellite-test/approve',
        mutatesTargetAction: false,
        websocketEnvelope: expect.objectContaining({ type: 'capability.result' }),
      }),
      expect.objectContaining({
        decision: 'deny',
        endpoint: '/api/v1/approvals/approval-satellite-test/deny',
        mutatesTargetAction: false,
      }),
    ]));
  });

  it('marks high-risk approvals as blocked/attention-worthy and keeps secrets redacted', () => {
    const googleToken = ['AI', 'za', '123456789012345678901234567890'].join('');
    const snapshot = new ZavorthSatelliteApprovalCompanionService().buildSnapshot({
      user: 'API_KEY=sk-secretshouldnotleak123456789',
      approvals: [{
        id: 'approval-high-risk',
        title: 'Send external message',
        reason: `Use token sk-secretshouldnotleak123456789 and ${googleToken} to continue.`,
        status: 'pending',
        risk: 'high',
        scope: 'external.message:customer',
      }],
    });
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.summary.highRisk).toBe(1);
    expect(snapshot.summary.rawSecretsSerialized).toBe(false);
    expect(serialized).not.toContain('sk-secretshouldnotleak');
    expect(serialized).not.toContain(googleToken);
    expect(serialized).toContain('[REDACTED');
  });

  it('documents the runtime handoff invariant', () => {
    const snapshot = new ZavorthSatelliteApprovalCompanionService().buildSnapshot();

    expect(snapshot.transport.websocketDecisionEnvelopeType).toBe('capability.result');
    expect(snapshot.safety.targetActionResumesThroughRuntime).toBe(true);
    expect(snapshot.invariants).toEqual(expect.arrayContaining([
      expect.stringContaining('not a second runtime'),
      expect.stringContaining('does not execute the target action'),
    ]));
  });
});
