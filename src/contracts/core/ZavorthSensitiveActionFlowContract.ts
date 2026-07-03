import type {
  SecurityPolicyBrokerAction,
  SecurityPolicyBrokerReceipt,
} from '../../security/SecurityPolicyBroker.js';
import type { ZavorthMissionRiskLevel } from '../ZavorthMissionContract.js';
import type { ZavorthVisualReceiptContract } from '../ZavorthVisualReceiptContract.js';

export const ZAVORTH_SENSITIVE_ACTION_FLOW_CONTRACT_VERSION = '2026-05-13.checkpoint-3' as const;

export type ZavorthSensitiveActionFlowStatus =
  | 'read_only_ready'
  | 'preview_ready'
  | 'needs_approval'
  | 'dry_run_only'
  | 'approved_ready'
  | 'denied'
  | 'blocked';

export type ZavorthSensitiveActionKind =
  | 'read'
  | 'write'
  | 'delete'
  | 'move'
  | 'command'
  | 'network'
  | 'message'
  | 'unknown';

export type ZavorthSensitiveActionFlowDecision = 'none' | 'approve' | 'deny';

export type ZavorthSensitiveActionPreview = {
  id: string;
  title: string;
  summary: string;
  requestedAction: string;
  actionKinds: ZavorthSensitiveActionKind[];
  affectedResources: string[];
  filesRead: number;
  filesChanged: number;
  commands: number;
  networkCalls: number;
  messages: number;
  secretsDetected: number;
  rawSecretsPresent: false;
};

export type ZavorthSensitiveActionApproval = {
  required: boolean;
  id: string | null;
  status: 'not_required' | 'pending' | 'approved' | 'denied';
  prompt: string;
  options: Array<'allow_once' | 'deny' | 'view_preview' | 'view_rollback'>;
  simpleText: string;
  advancedText: string;
};

export type ZavorthSensitiveActionExecution = {
  mode: 'read_only' | 'dry_run' | 'sandbox_after_approval' | 'blocked';
  zavorthControlCanExecute: false;
  policyBrokerRequired: true;
  approvalRequiredForMutation: boolean;
  executed: false;
  why: string;
};

export type ZavorthSensitiveActionRollback = {
  available: boolean;
  requiredBeforeApply: boolean;
  artifactId: string | null;
  summary: string;
  command: string | null;
};

export type ZavorthSensitiveActionFlowSnapshot = {
  contractVersion: typeof ZAVORTH_SENSITIVE_ACTION_FLOW_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'sensitive-action-flow';
  generatedAt: string;
  id: string;
  status: ZavorthSensitiveActionFlowStatus;
  request: string;
  risk: ZavorthMissionRiskLevel;
  decision: ZavorthSensitiveActionFlowDecision;
  preview: ZavorthSensitiveActionPreview;
  policy: {
    action: SecurityPolicyBrokerAction;
    allowed: boolean;
    receipt: SecurityPolicyBrokerReceipt;
  };
  approval: ZavorthSensitiveActionApproval;
  execution: ZavorthSensitiveActionExecution;
  rollback: ZavorthSensitiveActionRollback;
  receipt: ZavorthVisualReceiptContract;
  timeline: Array<{
    id: string;
    status: 'done' | 'pending' | 'blocked';
    summary: string;
  }>;
  zavorthControlProjection: {
    route: '/zavorthControl';
    endpoint: '/api/sensitive-action-flow';
    executionAuthority: false;
    renderAsActionCard: true;
  };
  zavorthControlProjection: {
    route: '/control';
    endpoint: '/api/sensitive-action-flow';
    executionAuthority: false;
    renderAsActionCard: true;
  };
  invariants: Array<{
    id: string;
    status: 'passed';
    detail: string;
  }>;
  nextAction: string;
};
