export const ZAVORTH_AGENT_MESH_EXECUTION_CONTRACT_VERSION = '2026-05-09.agent-mesh-execution' as const;

import type { AgentMeshPermission, AgentMeshPolicyDecision } from './AgentMeshConsentContract.js';

export type AgentMeshSandboxPolicy = {
  allowNetworkAccess: boolean;
  allowedNetworkDomains: string[];
  allowFileSystemWrites: boolean;
  allowedWritePaths: string[];
  allowProcessExecution: boolean;
  noSecretSerialization: true; // Strictly enforced: Secrets must be resolved via SecretRefs inside the proxy
  enforceDryRunFirstIfSupported: boolean;
};

export type AgentMeshExecutionBudget = {
  maxExecutionTimeMs: number;
  maxToolCalls: number;
  maxCostCents?: number;
};

export type AgentMeshExecutionIntent = {
  goal: string;
  context: string;
  requestedTools?: string[];
};

export type AgentMeshExecutionRequest = {
  id: string;
  requestedAt: string;
  traceId?: string | null;
  sessionId?: string | null;
  requestedBy?: string | null;
  surface?: string | null;
  targetBridgeId: string;
  intent: AgentMeshExecutionIntent;
  budget: AgentMeshExecutionBudget;
  sandbox: AgentMeshSandboxPolicy;
  isDryRunPreview: boolean;
  secretRefs: Record<string, string>; // Maps variable names to secret Vault/Ledger IDs, NOT the plain text value
};

export type AgentMeshExecutionStatus =
  | 'completed_successfully'
  | 'completed_partially'
  | 'failed_execution'
  | 'failed_driver_unavailable'
  | 'interrupted_timeout'
  | 'interrupted_budget_exceeded'
  | 'blocked_by_sandbox'
  | 'blocked_missing_consent'
  | 'blocked_by_policy';

export type AgentMeshToolCallRecord = {
  toolName: string;
  durationMs: number;
  sandboxVerdict: 'allowed' | 'blocked' | 'simulated_dry_run';
};

export type AgentMeshExecutionReceipt = {
  id: string;
  executionRequestId: string;
  bridgeId: string;
  timestamp: string;
  traceId: string | null;
  sessionId: string | null;
  requestedBy: string;
  surface: string;
  status: AgentMeshExecutionStatus;
  policyDecision: AgentMeshPolicyDecision;
  metrics: {
    totalDurationMs: number;
    toolCallsMade: number;
  };
  toolCallRecords: AgentMeshToolCallRecord[];
  finalResponseSummary: string; // A safe summary, no sensitive data
  sandboxViolations: string[];
  budgetViolations: string[];
  requiredPermissions: AgentMeshPermission[];
  redactionApplied: boolean;
  driverProtocol?: string | null;
};

export type AgentMeshLedgerSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_AGENT_MESH_EXECUTION_CONTRACT_VERSION;
  totalExecutions: number;
  blockedExecutions: number;
  recentReceipts: AgentMeshExecutionReceipt[];
  policy: {
    appendOnly: true;
    noPlaintextSecretsInLedger: true;
  };
};
