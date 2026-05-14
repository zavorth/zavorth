import type { ZavorthSubagentRuntimeMode } from './ZavorthSubagentRuntimeContract.js';

export const ZAVORTH_SUBAGENT_AUTO_INVOCATION_CONTRACT_VERSION =
  '2026-05-10.subagent-auto-invocation' as const;

export type ZavorthSubagentAutoInvocationAction =
  | 'skip'
  | 'invoke_live_subagents'
  | 'require_approval';

export type ZavorthSubagentAutoInvocationSelectionSource =
  | 'explicit-user-request'
  | 'implicit-complexity'
  | 'runtime-directed'
  | 'none';

export type ZavorthSubagentAutoInvocationRoleTelemetry = {
  roleId: string;
  label: string;
  whySelected: string;
};

export type ZavorthSubagentAutoInvocationTelemetry = {
  decisionId: string;
  generatedAt: string | null;
  source: 'ZavorthSubagentAutoInvocationPolicyService';
  action: ZavorthSubagentAutoInvocationAction;
  selectedBy: ZavorthSubagentAutoInvocationSelectionSource;
  channel: string;
  mode: ZavorthSubagentRuntimeMode;
  shouldInvoke: boolean;
  live: boolean;
  requiresApproval: boolean;
  confidence: number;
  roleIds: string[];
  roles: ZavorthSubagentAutoInvocationRoleTelemetry[];
  triggers: string[];
  riskSignals: string[];
  publicRationale: string;
  operatorSummary: string;
  dashboard: {
    title: string;
    status: 'auto-selected' | 'approval-required' | 'skipped';
    badges: string[];
    nextSafeAction: string;
  };
  cli: {
    headline: string;
    lines: string[];
  };
  safety: {
    noRawChainOfThought: true;
    noSecretValuesSerialized: true;
    readOnlyOnly: true;
    workspaceMutationRequiresApproval: true;
    commandExecutionRequiresApproval: true;
    sensitiveNetworkRequiresApproval: true;
    externalSideEffectsRequireApproval: true;
  };
};

export type ZavorthSubagentAutoInvocationDecision = {
  contractVersion: typeof ZAVORTH_SUBAGENT_AUTO_INVOCATION_CONTRACT_VERSION;
  action: ZavorthSubagentAutoInvocationAction;
  shouldInvoke: boolean;
  requiresApproval: boolean;
  explicitSubagentRequest: boolean;
  implicitComplexityMatch: boolean;
  live: boolean;
  mode: ZavorthSubagentRuntimeMode;
  roleIds: string[];
  maxLiveWorkers: number;
  confidence: number;
  reason: string;
  triggers: string[];
  riskSignals: string[];
  telemetry: ZavorthSubagentAutoInvocationTelemetry;
  safety: {
    readOnlyOnly: true;
    workspaceMutationRequiresApproval: true;
    commandExecutionRequiresApproval: true;
    sensitiveNetworkRequiresApproval: true;
    externalSideEffectsRequireApproval: true;
    directModeRequiresExplicitSubagents: true;
  };
};
