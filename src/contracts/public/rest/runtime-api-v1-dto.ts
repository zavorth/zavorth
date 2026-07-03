import type { PermissionRequest } from '../../PermissionRequest.js';
import type { ChannelMeshSnapshot } from '../../ChannelMeshContract.js';
import type { ZavorthMissionContract } from '../../ZavorthMissionContract.js';
import type { ZavorthProviderReadinessMatrixSnapshot } from '../../ZavorthProviderReadinessMatrixContract.js';
import type { ZavorthSubagentSkillLiveCompletionSnapshot } from '../../ZavorthSubagentSkillLiveCompletionContract.js';
import type { ZavorthVisualReceiptContract } from '../../ZavorthVisualReceiptContract.js';
import type { ZavorthVisualReceiptUxSnapshot } from '../../ZavorthVisualReceiptUxContract.js';
import type { ZavorthApprovalActionCardsUxSnapshot } from '../../ZavorthApprovalActionCardsUxContract.js';
import type { ZavorthApprovalReceiptTrustUxSnapshot } from '../../ZavorthApprovalReceiptTrustUxContract.js';
import type { ChannelMeshActionExecution } from '../../ChannelMeshContract.js';
import type { SecurityPolicyBrokerReceipt } from '../../../security/SecurityPolicyBroker.js';
import type { OpsHealthDTO } from './platform-ops-dto.js';
import type { GatewayStatusDTO } from './dto.js';
import type {
  ModelPickerContract,
  SelectedModelProfile,
} from '../../ModelPickerContract.js';

export type CanonicalRuntimeApiErrorDTO = {
  code: string;
  message: string;
  details?: unknown;
};

export type CanonicalRuntimeApiEnvelopeDTO<T> =
  | {
      ok: true;
      data: T;
      error: null;
      traceId: string;
    }
  | {
      ok: false;
      data: null;
      error: CanonicalRuntimeApiErrorDTO;
      traceId: string;
    };

export type CanonicalRuntimeStatusDTO = {
  schemaVersion: 1;
  surface: 'runtime-api-v1';
  version: string;
  generatedAt: string;
  status: 'ready' | 'starting' | 'maintenance' | 'error' | 'unavailable';
  runtime: {
    attached: boolean;
    localFirst: true;
    zavorthControlRoute: '/zavorthControl';
    executionAuthority: false;
  };
  gateway: GatewayStatusDTO;
  health: OpsHealthDTO;
  subagentSkillCompletion: ZavorthSubagentSkillLiveCompletionSnapshot | null;
};

export type CanonicalRuntimeHealthDTO = {
  schemaVersion: 1;
  surface: 'runtime-health-v1';
  generatedAt: string;
  mode: 'fast' | 'live';
  healthy: boolean;
  health: OpsHealthDTO;
  safety: {
    policyBrokerRequired: true;
    zavorthControlCanExecute: false;
    publicApiCanBypassPolicy: false;
  };
};

export type CanonicalProviderMeshDTO = {
  schemaVersion: 1;
  surface: 'provider-mesh-v1';
  generatedAt: string;
  summary: {
    total: number;
    ready: number;
    needsConfig: number;
    needsProbe: number;
    advancedHidden: number;
  };
  providers: unknown[];
  profiles: unknown[];
  selected: SelectedModelProfile | null;
  picker: ModelPickerContract | null;
  readinessMatrix: ZavorthProviderReadinessMatrixSnapshot | null;
  liveCompletion: ZavorthProviderReadinessMatrixSnapshot['liveCompletion'] | null;
  readinessStates: Array<'ready' | 'needs_config' | 'needs_probe'>;
  safety: {
    secretRefsOnly: true;
    rawSecretsSerialized: false;
    selectionRequiresGovernedApply: true;
    catalogSupportIsNotLiveProof: true;
    defaultRoutingRequiresLiveProof: true;
  };
};

export type CanonicalChannelMeshDTO = ChannelMeshSnapshot & {
  schemaVersion: 1;
  surface: 'channel-mesh-v1';
  safety: {
    zavorthControlCanExecute: false;
    liveBridgeRequiresPolicyBroker: true;
    telegramPrivileged: false;
    catalogSupportIsNotLiveProof: true;
    defaultRoutingRequiresLiveProof: true;
  };
};

export type CanonicalApprovalsDTO = {
  schemaVersion: 1;
  surface: 'approvals-v1';
  generatedAt: string;
  status: PermissionRequest['status'] | 'all';
  total: number;
  data: PermissionRequest[];
  actions: Array<'allow_once' | 'deny' | 'view_preview' | 'view_rollback'>;
  approvalCards: ZavorthApprovalActionCardsUxSnapshot;
  trustUx: ZavorthApprovalReceiptTrustUxSnapshot;
  safety: {
    approvalScopedToExactAction: true;
    zavorthControlCanExecute: false;
    approvalDoesNotExecuteTargetAction: true;
    receiptsRequiredForTrustDecisions: true;
  };
};

export type CanonicalReceiptsDTO = ZavorthVisualReceiptUxSnapshot & {
  apiSurface: 'receipts-v1';
  trustUx?: ZavorthApprovalReceiptTrustUxSnapshot;
};

export type CanonicalMissionsDTO = {
  schemaVersion: 1;
  surface: 'missions-v1';
  generatedAt: string;
  total: number;
  data: ZavorthMissionContract[];
  projection: {
    zavorthControlCanExecute: false;
    approvalsRequiredForMutableActions: true;
    sourceOfTruth: 'runtime-api';
  };
};

export type CanonicalChatMode =
  | 'preview'
  | 'approval_required'
  | 'dry_run_only'
  | 'blocked'
  | 'submitted'
  | 'runtime_unavailable';

export type CanonicalChatPreviewDTO = {
  schemaVersion: 1;
  surface: 'chat-v1';
  generatedAt: string;
  accepted: boolean;
  live: boolean;
  sessionId: string | null;
  taskId: string | null;
  mission: ZavorthMissionContract;
  receipt: ZavorthVisualReceiptContract;
  snapshot?: unknown;
  mode: CanonicalChatMode;
  nextAction: string;
  flow: {
    stage: CanonicalChatMode;
    previewFirst: true;
    sourceOfTruth: 'runtime-api';
    approvalGate: {
      required: boolean;
      id: string | null;
      status: 'not_required' | 'pending' | 'approved' | 'denied' | 'blocked';
      risk: ZavorthMissionContract['risk'];
      options: string[];
    };
    receiptReady: boolean;
    artifactCount: number;
    eventTypes: Array<'mission.updated' | 'approval.request' | 'receipt.ready'>;
  };
  safety: {
    dryRunByDefault: true;
    liveRequiresExplicitFlag: true;
    zavorthControlCanExecute: false;
    policyBrokerRequiredForTools: true;
  };
};

export type CanonicalGovernedActionStatus =
  | 'applied'
  | 'denied'
  | 'needs_approval'
  | 'blocked'
  | 'not_found'
  | 'runtime_unavailable';

export type CanonicalGovernedActionReceiptDTO = {
  id: string;
  generatedAt: string;
  operation: string;
  target: string;
  status: CanonicalGovernedActionStatus;
  summary: string;
  policyReceipt: SecurityPolicyBrokerReceipt;
  rawSecretsSerialized: false;
  zavorthControlCanExecute: false;
};

export type CanonicalGovernedActionResultDTO<T = unknown> = {
  schemaVersion: 1;
  surface: 'governed-action-v1';
  generatedAt: string;
  action: string;
  target: string;
  ok: boolean;
  status: CanonicalGovernedActionStatus;
  result: T | null;
  receipt: CanonicalGovernedActionReceiptDTO;
  nextAction: string;
  safety: {
    controllerMutatedDirectly: false;
    policyBrokerEvaluated: true;
    rawSecretsSerialized: false;
  };
};

export type CanonicalApprovalDecisionResultDTO = CanonicalGovernedActionResultDTO<PermissionRequest>;

export type CanonicalMissionCancelResultDTO = CanonicalGovernedActionResultDTO<unknown>;

export type CanonicalProviderTestResultDTO = CanonicalGovernedActionResultDTO<ZavorthProviderReadinessMatrixSnapshot>;

export type CanonicalChannelActionResultDTO = CanonicalGovernedActionResultDTO<ChannelMeshActionExecution>;
