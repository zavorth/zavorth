import type {
  ZavorthNaturalFirstTransactionRoute,
  ZavorthTransactionIntent,
  ZavorthTransactionIntentCondition,
  ZavorthTransactionIntentKind,
  ZavorthTransactionIntentLimit,
  ZavorthTransactionIntentTarget,
  ZavorthTransactionIntentTargetKind,
  ZavorthTransactionIntentWindow,
} from './ZavorthTransactionIntentContract.js';
import type {
  ZavorthTransactionActionKind,
  ZavorthTransactionApprovalStatus,
  ZavorthTransactionPlaneSafetyDecision,
  ZavorthTransactionRiskLevel,
} from './ZavorthTransactionPlaneContract.js';

export const ZAVORTH_TRANSACTION_PREVIEW_CONTRACT_VERSION = 'zavorth-transaction-preview/checkpoint-2' as const;

export type ZavorthTransactionPreviewStatus = 'ready-for-review' | 'needs-clarification' | 'blocked';

export type ZavorthTransactionConnectorKind =
  | 'market-data'
  | 'commerce'
  | 'payment'
  | 'exchange'
  | 'currency-exchange'
  | 'subscription'
  | 'wallet'
  | 'unknown';

export type ZavorthTransactionQuoteStatus = 'estimated' | 'not-required' | 'missing-limit' | 'unknown';

export type ZavorthTransactionConnectorRequirement = {
  kind: ZavorthTransactionConnectorKind;
  requiredForLive: boolean;
  trustedConnectorRequired: boolean;
  credentialRefRequired: boolean;
  rawSecretAllowed: false;
  suggestedAdapterIds: string[];
  notes: string[];
};

export type ZavorthTransactionPreviewQuote = {
  status: ZavorthTransactionQuoteStatus;
  amount?: number;
  currency?: string;
  feeStatus: 'not-required' | 'not-quoted' | 'estimated';
  feeAmount?: number;
  feeCurrency?: string;
  notes: string[];
};

export type ZavorthTransactionApprovalEnvelope = {
  required: boolean;
  status: ZavorthTransactionApprovalStatus;
  scope: 'none' | 'single-preview' | 'future-mandate';
  reason: string;
  approvalId?: string;
  approvalPrompt: string;
};

export type ZavorthTransactionPreviewPolicy = {
  decision: ZavorthTransactionPlaneSafetyDecision;
  requiredControls: string[];
  blockers: string[];
  liveActionApplied: false;
  executableNow: false;
};

export type ZavorthTransactionPreviewValidation = {
  canAskApproval: boolean;
  canCreateLiveExecutionPlan: boolean;
  missingFields: string[];
  warnings: string[];
};

export type ZavorthTransactionPreviewReceipt = {
  id: string;
  summary: string;
};

export type ZavorthTransactionPreviewIntentSnapshot = {
  intentId: string;
  kind: ZavorthTransactionIntent['kind'];
  actionKind: ZavorthTransactionActionKind;
  target: ZavorthTransactionIntentTarget;
  conditions: ZavorthTransactionIntentCondition[];
  limits: ZavorthTransactionIntentLimit[];
  window?: ZavorthTransactionIntentWindow;
  naturalFirstRoute: ZavorthNaturalFirstTransactionRoute;
  riskLevel: ZavorthTransactionRiskLevel;
  sourceText: string;
};

export type ZavorthTransactionPreview = {
  version: typeof ZAVORTH_TRANSACTION_PREVIEW_CONTRACT_VERSION;
  id: string;
  createdAt: string;
  status: ZavorthTransactionPreviewStatus;
  title: string;
  summary: string;
  intent: ZavorthTransactionPreviewIntentSnapshot;
  connector: ZavorthTransactionConnectorRequirement;
  quote: ZavorthTransactionPreviewQuote;
  approval: ZavorthTransactionApprovalEnvelope;
  policy: ZavorthTransactionPreviewPolicy;
  validation: ZavorthTransactionPreviewValidation;
  receipts: ZavorthTransactionPreviewReceipt[];
  operatorReview: string[];
  nextSteps: string[];
};

export type ZavorthTransactionPreviewBuildInput = {
  text?: string;
  /** Structured product kind — free text never activates transaction kinds. */
  kind?: ZavorthTransactionIntentKind;
  actionKind?: ZavorthTransactionActionKind;
  targetKind?: ZavorthTransactionIntentTargetKind;
  intent?: ZavorthTransactionIntent;
  channel?: string;
  now?: Date;
};

export type ZavorthTransactionPreviewContractSnapshot = {
  version: typeof ZAVORTH_TRANSACTION_PREVIEW_CONTRACT_VERSION;
  summary: string;
  statuses: ZavorthTransactionPreviewStatus[];
  connectorKinds: ZavorthTransactionConnectorKind[];
  invariants: string[];
};

export function buildZavorthTransactionPreviewContractSnapshot(): ZavorthTransactionPreviewContractSnapshot {
  return {
    version: ZAVORTH_TRANSACTION_PREVIEW_CONTRACT_VERSION,
    summary: 'Human-reviewable transaction preview contract for Zavorth Transaction Plane Preview engine.',
    statuses: ['ready-for-review', 'needs-clarification', 'blocked'],
    connectorKinds: [
      'market-data',
      'commerce',
      'payment',
      'exchange',
      'currency-exchange',
      'subscription',
      'wallet',
      'unknown',
    ],
    invariants: [
      'A preview never applies a live transaction effect.',
      'A preview must carry the parsed intent snapshot and Security contract policy decision.',
      'A preview must expose connector, amount, target, approval and blocker information.',
      'Real-money previews require explicit approval before any live execution plan can exist.',
      'Raw secrets are never allowed in connector requirements, quote, approval or receipts.',
    ],
  };
}
