import { ZavorthTransactionPlanePolicyService } from '../../src/services/ZavorthTransactionPlanePolicyService.js';

describe('ZavorthTransactionPlanePolicyService', () => {
  it('builds a ready phase 0 snapshot', () => {
    const service = new ZavorthTransactionPlanePolicyService();
    const snapshot = service.buildSnapshot(new Date('2026-05-11T00:00:00.000Z'));

    expect(snapshot.status).toBe('ready');
    expect(snapshot.generatedAt).toBe('2026-05-11T00:00:00.000Z');
    expect(snapshot.phase0).toEqual(expect.objectContaining({
      liveExecutionAuthorizedByDefault: false,
      llmDirectExecutionAllowed: false,
      realMoneyRequiresExplicitApproval: true,
      rawSecretPersistenceAllowed: false,
      criticalValueMovementBlockedByDefault: true,
    }));
  });

  it('renders an operator-readable report', () => {
    const service = new ZavorthTransactionPlanePolicyService();
    const report = service.renderReport(service.buildSnapshot(new Date('2026-05-11T00:00:00.000Z')));

    expect(report).toContain('Phase 0 security contract');
    expect(report).toContain('llm direct execution: blocked');
    expect(report).toContain('real money approval: required');
    expect(report).toContain('critical value movement: blocked-by-default');
  });

  it('throws when a transaction violates the contract', () => {
    const service = new ZavorthTransactionPlanePolicyService();

    expect(() => service.assertAllowed({
      actor: 'llm',
      actionKind: 'payment-submit',
      executionMode: 'live',
      typedConnector: true,
      connectorTrusted: true,
      previewGenerated: true,
      approvalStatus: 'approved',
      ledgerEnabled: true,
    })).toThrow(/llm_direct_transaction_execution_blocked/);
  });

  it('allows a fully governed runtime-led live payment', () => {
    const service = new ZavorthTransactionPlanePolicyService();
    const decision = service.assertAllowed({
      actor: 'zavorth-runtime',
      actionKind: 'payment-submit',
      executionMode: 'live',
      typedConnector: true,
      connectorTrusted: true,
      previewGenerated: true,
      approvalStatus: 'approved',
      ledgerEnabled: true,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.status).toBe('allowed');
    expect(decision.requiredControls).toEqual([]);
  });
});
