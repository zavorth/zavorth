import type { ZavorthApprovalActionCard } from '../ZavorthApprovalActionCardsUxContract.js';
import type { ZavorthVisualReceiptV2Card } from '../ZavorthVisualReceiptsV2Contract.js';

export const ZAVORTH_SATELLITE_APPROVAL_COMPANION_CONTRACT_VERSION = '2026-05-15.experience-layer.gate-10' as const;

export type ZavorthSatelliteApprovalDecision = 'approve' | 'deny' | 'preview' | 'rollback_preview' | 'receipt';

export type ZavorthSatelliteApprovalButton = {
  id: string;
  label: string;
  decision: ZavorthSatelliteApprovalDecision;
  approvalId: string;
  endpoint: string;
  method: 'POST' | 'GET';
  websocketEnvelope: {
    type: 'capability.result';
    payload: {
      actionId: string;
      approvalId: string;
      decision: ZavorthSatelliteApprovalDecision;
      ok: boolean;
      source: 'satellite';
    };
  };
  requiresPolicyBroker: true;
  mutatesTargetAction: false;
};

export type ZavorthSatelliteApprovalCard = {
  id: string;
  approvalId: string;
  missionId: string | null;
  title: string;
  summary: string;
  risk: ZavorthApprovalActionCard['risk'];
  status: ZavorthApprovalActionCard['status'];
  badge: string;
  scope: {
    action: string;
    target: string;
    argsHash: string | null;
    ttl: string;
    user: string;
    surface: 'satellite';
  };
  buttons: ZavorthSatelliteApprovalButton[];
  receiptPreview: Pick<ZavorthVisualReceiptV2Card, 'id' | 'headline' | 'confidence' | 'tone'> | null;
  safety: {
    policyBrokerRequired: true;
    approvalScopeBound: true;
    satelliteCanExecuteTargetAction: false;
    targetActionResumesThroughRuntime: true;
    rawSecretsSerialized: false;
  };
};

export type ZavorthSatelliteApprovalCompanionSnapshot = {
  contractVersion: typeof ZAVORTH_SATELLITE_APPROVAL_COMPANION_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'satellite-approval-companion';
  generatedAt: string;
  route: '/satellite';
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    pending: number;
    totalCards: number;
    highRisk: number;
    receiptPreviews: number;
    rawSecretsSerialized: false;
  };
  cards: ZavorthSatelliteApprovalCard[];
  transport: {
    websocketUrl: '/api/web/satellite/ws';
    websocketDecisionEnvelopeType: 'capability.result';
    restApproveEndpointTemplate: '/api/v1/approvals/:id/approve';
    restDenyEndpointTemplate: '/api/v1/approvals/:id/deny';
    offlineQueueSupported: true;
  };
  companionProjection: {
    pwaRoute: '/satellite';
    mobileFirst: true;
    executionAuthority: false;
    approvalResolutionAuthority: 'gateway-mediated';
    runtimeSourceOfTruth: '/api/v1';
  };
  safety: {
    projectionOnly: true;
    policyBrokerRequired: true;
    satelliteCanExecuteTargetAction: false;
    targetActionResumesThroughRuntime: true;
    rawSecretsSerialized: false;
    secretsMustUseSecretRefs: true;
  };
  nextAction: string;
  invariants: string[];
};
