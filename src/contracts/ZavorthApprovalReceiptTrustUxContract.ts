import type { ZavorthApprovalActionCardsUxSnapshot } from './ZavorthApprovalActionCardsUxContract.js';
import type { ZavorthVisualReceiptUxSnapshot } from './ZavorthVisualReceiptUxContract.js';

export const ZAVORTH_APPROVAL_RECEIPT_TRUST_UX_CONTRACT_VERSION = '2026-05-14.phase-5-approval-receipt-trust-ux' as const;

export type ZavorthApprovalReceiptTrustUxSnapshot = {
  contractVersion: typeof ZAVORTH_APPROVAL_RECEIPT_TRUST_UX_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'approval-receipt-trust-ux';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    pendingApprovals: number;
    receiptCards: number;
    highRiskApprovals: number;
    rollbackAvailable: number;
    rawSecretsSerialized: false;
  };
  simpleMode: {
    headline: string;
    primaryText: string;
    decisionHint: string;
  };
  advancedMode: {
    visibleByDefault: false;
    policyBrokerRequired: true;
    trustPlaneActive: true;
    exactScopeRequired: true;
    receiptRequired: true;
    rollbackEvidenceRequiredForMutations: true;
  };
  decisionFlow: {
    previewFirst: true;
    approveOnceEndpoint: '/api/v1/approvals/:id/approve';
    denyEndpoint: '/api/v1/approvals/:id/deny';
    receiptEndpoint: '/api/v1/receipts';
    approvalDoesNotExecuteTargetAction: true;
    targetActionRequiresRuntimeGate: true;
  };
  cards: ZavorthApprovalActionCardsUxSnapshot['cards'];
  receipts: ZavorthVisualReceiptUxSnapshot['cards'];
  safety: {
    commandCenterCanExecuteTargetAction: false;
    dashboardCanResolveApprovalOnlyThroughGateway: true;
    approvalScopedToExactAction: true;
    rawSecretsSerialized: false;
    telegramPrivileged: false;
  };
  nextAction: string;
};
