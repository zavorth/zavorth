import { assertSurfaceApproveGate, isSurfaceHighRiskLevel } from '../../../src/services/surface/SurfaceApprovalGate.js';
import { HighRiskConfirmationService } from '../../../src/services/HighRiskConfirmationService.js';

describe('SurfaceApprovalGate (no TOTP)', () => {
  it('maps danger as high-risk', () => {
    expect(isSurfaceHighRiskLevel('danger')).toBe(true);
    expect(isSurfaceHighRiskLevel('high')).toBe(true);
    expect(isSurfaceHighRiskLevel('attention')).toBe(false);
  });

  it('allows one-click approve for high-risk', () => {
    const result = assertSurfaceApproveGate({
      surface: 'desktop',
      riskLevel: 'danger',
      approvalGranted: true,
    });
    expect(result.ok).toBe(true);
    expect(result.requiresTotp).toBe(false);
  });

  it('rejects when operator did not grant approve', () => {
    expect(() =>
      assertSurfaceApproveGate({
        surface: 'control',
        riskLevel: 'high',
        approvalGranted: false,
        highRisk: new HighRiskConfirmationService(),
      }),
    ).toThrow(/Approve|approval/i);
  });

  it('accepts strong confirmation phrase as explicit approve for CRITICAL host', () => {
    // When approvalGranted is true (button click), gate already passes.
    // strongConfirmationSatisfied is optional extra host UX.
    const result = assertSurfaceApproveGate({
      surface: 'desktop-host-command',
      riskLevel: 'critical',
      approvalGranted: true,
      strongConfirmationSatisfied: true,
    });
    expect(result.ok).toBe(true);
  });
});
