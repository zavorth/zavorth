import type { SecurityPolicyBrokerReceipt } from '../security/SecurityPolicyBroker.js';

export const ZAVORTH_INVOCATION_RECEIPT_CONTRACT_VERSION =
  '2026-05-10.invocation-receipt-phases-4-9' as const;

export type ZavorthInvocationReceiptKind =
  | 'subagent-spawn'
  | 'subagent-wait'
  | 'subagent-send'
  | 'subagent-list'
  | 'subagent-cancel'
  | 'subagent-read'
  | 'subagent-summarize'
  | 'skill-selection'
  | 'skill-import'
  | 'skill-materialization'
  | 'skill-bridge-handoff'
  | 'live-use'
  | 'denial'
  | 'rollback'
  | 'cross-surface-command'
  | 'certification';

export type ZavorthInvocationReceiptStatus =
  | 'pass'
  | 'attention'
  | 'approval-required'
  | 'deny'
  | 'blocked'
  | 'failed'
  | 'rolled-back';

export type ZavorthInvocationReceipt = {
  id: string;
  contractVersion: typeof ZAVORTH_INVOCATION_RECEIPT_CONTRACT_VERSION;
  kind: ZavorthInvocationReceiptKind;
  status: ZavorthInvocationReceiptStatus;
  generatedAt: string;
  actorId: string | null;
  channel: string;
  target: string;
  action: string;
  policyBrokerReceipt: SecurityPolicyBrokerReceipt;
  approvalId: string | null;
  risk: 'safe' | 'review' | 'dangerous' | 'forbidden';
  reasons: string[];
  guarantees: {
    policyBrokerEvaluated: true;
    noSecretValuesSerialized: true;
    untrustedContentDelimited: boolean;
    workspaceMutationPerformed: boolean;
    externalIoPerformed: boolean;
    upstreamCodeExecuted: boolean;
  };
  evidence: Record<string, string | number | boolean | null>;
};

