import { HighRiskConfirmationService } from '../../src/services/HighRiskConfirmationService';

describe('HighRiskConfirmationService', () => {
  it('labels high-risk tasks without requiring authenticator codes', () => {
    const service = new HighRiskConfirmationService();
    const task = {
      risk_level: 3,
      metadata: { requiresHighRiskPin: true },
    } as any;

    expect(service.requiresPin(task)).toBe(true);
    expect(service.isConfigured()).toBe(false);
    expect(service.validate(task, 'anything')).toBe(true);
    expect(service.describeRequirement()).toMatch(/Approve|high-risk/i);
    expect(service.describeRequirement()).not.toMatch(/TOTP|6-digit/i);
  });

  it('assertApprovalGate only requires explicit approve (one click)', () => {
    const service = new HighRiskConfirmationService();
    const task = {
      risk_level: 5,
      metadata: { requiresHighRiskPin: true },
    } as any;

    expect(service.assertApprovalGate({ task, approvalGranted: false }).ok).toBe(false);
    expect(service.assertApprovalGate({ task, approvalGranted: true }).ok).toBe(true);
    expect(service.assertApprovalGate({ task, approvalGranted: true }).requiresTotp).toBe(false);
  });

  it('maps danger as high-risk and attention as not', () => {
    const service = new HighRiskConfirmationService();
    expect(service.isHighRiskRiskLevel('danger')).toBe(true);
    expect(service.isHighRiskRiskLevel('high')).toBe(true);
    expect(service.isHighRiskRiskLevel('attention')).toBe(false);
    expect(service.isHighRiskRiskLevel('safe')).toBe(false);
  });
});
