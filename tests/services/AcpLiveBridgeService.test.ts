import { AcpLiveBridgeService } from '../../src/services/AcpLiveBridgeService.js';

describe('AcpLiveBridgeService', () => {
  const now = () => new Date('2026-05-16T22:00:00.000Z');

  it('stays disabled by default and performs no live execution', () => {
    const snapshot = new AcpLiveBridgeService({
      now,
      env: {},
    }).buildSnapshot();

    expect(snapshot.status).toBe('disabled');
    expect(snapshot.bridge.enabledByDefault).toBe(false);
    expect(snapshot.bridge.liveExecutionPerformed).toBe(false);
    expect(snapshot.receipt.executionAuthorityGranted).toBe(false);
    expect(snapshot.policy).toEqual(expect.objectContaining({
      ownerApprovalRequired: true,
      bypassPermissionsAllowed: false,
      rawSecretsSerialized: false,
    }));
  });

  it('blocks enabled ACP until owner approval and safety gates exist', () => {
    const snapshot = new AcpLiveBridgeService({
      now,
      env: {
        ZAVORTH_ACPX_BRIDGE_ENABLED: 'true',
      },
    }).buildSnapshot();

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.summary.requiredFailed).toBeGreaterThan(0);
    expect(snapshot.checks.find((check) => check.id === 'owner-approval')?.status).toBe('failed');
    expect(snapshot.receipt.executionAuthorityGranted).toBe(false);
  });

  it('becomes live-ready only after explicit owner-gated activation', () => {
    const snapshot = new AcpLiveBridgeService({
      now,
      env: {
        ZAVORTH_ACPX_BRIDGE_ENABLED: 'true',
        ZAVORTH_ACPX_BRIDGE_OWNER_APPROVED: 'true',
        ZAVORTH_ACPX_BRIDGE_CWD: 'C:/repo',
        ZAVORTH_ACPX_BRIDGE_WORKSPACE_ROOTS: 'C:/repo',
        ZAVORTH_ACPX_BRIDGE_ALLOWED_SERVERS: 'local-acp',
      },
    }).buildSnapshot();

    expect(snapshot.status).toBe('ready');
    expect(snapshot.summary.liveReady).toBe(true);
    expect(snapshot.receipt).toEqual(expect.objectContaining({
      executionAuthorityGranted: true,
      liveExecutionPerformed: false,
      approvalRef: 'owner-approved-env',
    }));
    expect(snapshot.checks.every((check) => check.status === 'passed')).toBe(true);
  });
});
