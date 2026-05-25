import { ZavorthApprovalActionCardsUxService } from '../../src/services/ZavorthApprovalActionCardsUxService.js';
import { ZavorthApprovalReceiptTrustUxService } from '../../src/services/ZavorthApprovalReceiptTrustUxService.js';
import { ZavorthVisualReceiptUxService } from '../../src/services/ZavorthVisualReceiptUxService.js';

describe('ZavorthApprovalReceiptTrustUxService', () => {
  it('joins approvals and receipts into a simple trust decision surface', () => {
    const now = () => new Date('2026-05-14T12:00:00.000Z');
    const approvalCards = new ZavorthApprovalActionCardsUxService({ now }).buildSnapshot({
      approvals: [{
        id: 'approval_1',
        title: 'Edit workspace',
        reason: 'Zavorth wants to edit two files. OPENAI_API_KEY=sk-secret-value',
        status: 'pending',
        risk: 'medium',
        scope: 'once',
      }],
    });
    const visualReceipts = new ZavorthVisualReceiptUxService({ now }).buildSnapshot();
    const snapshot = new ZavorthApprovalReceiptTrustUxService({ now }).buildSnapshot({
      approvalCards,
      visualReceipts,
    });

    expect(snapshot.contractVersion).toBe('2026-05-14.checkpoint-5-approval-receipt-trust-ux');
    expect(snapshot.status).toBe('attention');
    expect(snapshot.summary.pendingApprovals).toBe(1);
    expect(snapshot.simpleMode.primaryText).toContain('Approval is scoped to the exact action shown');
    expect(snapshot.decisionFlow).toEqual(expect.objectContaining({
      previewFirst: true,
      approveOnceEndpoint: '/api/v1/approvals/:id/approve',
      approvalDoesNotExecuteTargetAction: true,
      targetActionRequiresRuntimeGate: true,
    }));
    expect(snapshot.safety).toEqual(expect.objectContaining({
      dashboardCanExecuteTargetAction: false,
      dashboardCanResolveApprovalOnlyThroughGateway: true,
      approvalScopedToExactAction: true,
      rawSecretsSerialized: false,
    }));
    expect(JSON.stringify(snapshot)).not.toContain('sk-secret-value');
  });
});
