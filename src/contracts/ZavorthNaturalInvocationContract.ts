import type { ZavorthUniversalSkillBridgeSnapshot } from './ZavorthUniversalSkillBridgeRuntimeContract.js';
import type { ZavorthInvocationReceipt } from './ZavorthInvocationReceiptContract.js';
import type {
  ZavorthSubagentRuntimeSnapshot,
  ZavorthSubagentRuntimeMode,
} from './ZavorthSubagentRuntimeContract.js';
import type { ZavorthSubagentAutoInvocationTelemetry } from './ZavorthSubagentAutoInvocationContract.js';
import type { ZavorthSandboxLifecyclePlan } from './ZavorthSandboxLifecycleContract.js';

export const ZAVORTH_NATURAL_INVOCATION_CONTRACT_VERSION =
  '2026-05-10.natural-invocation-checkpoint-5' as const;

export type ZavorthNaturalInvocationAction =
  | 'answer_directly'
  | 'use_skill'
  | 'absorb_skill_preview'
  | 'absorb_skill_apply'
  | 'spawn_subagent'
  | 'spawn_team'
  | 'large_absorption'
  | 'sandbox_lifecycle'
  | 'ask_approval'
  | 'deny';

export type ZavorthNaturalInvocationStatus =
  | 'ready'
  | 'planned'
  | 'approval-required'
  | 'denied'
  | 'ambiguous';

export type ZavorthNaturalInvocationCandidate = {
  id: string;
  label: string;
  kind: 'skill' | 'subagent' | 'team' | 'absorption' | 'sandbox_lifecycle' | 'direct';
  confidence: number;
  reason: string;
  requiresApproval: boolean;
};

export type ZavorthNaturalInvocationSurfaceCommand = {
  id: string;
  command: string;
  label: string;
  description: string;
  channels: Array<'cli' | 'telegram' | 'discord' | 'whatsapp' | 'signal' | 'imessage' | 'web'>;
  interactiveWhenSupported: boolean;
  fallbackText: string;
  requiresApproval: boolean;
};

export type ZavorthNaturalInvocationPlan = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_NATURAL_INVOCATION_CONTRACT_VERSION;
  source: 'ZavorthNaturalInvocationRouter';
  status: ZavorthNaturalInvocationStatus;
  channel: string;
  actorId: string | null;
  requestText: string;
  primaryAction: ZavorthNaturalInvocationAction;
  actions: ZavorthNaturalInvocationAction[];
  confidence: number;
  candidates: ZavorthNaturalInvocationCandidate[];
  selectedSkillName: string | null;
  selectedSubagentMode: ZavorthSubagentRuntimeMode | null;
  selectedRoleIds: string[];
  subagentAutoInvocation: ZavorthSubagentAutoInvocationTelemetry | null;
  sourcePath: string | null;
  approval: {
    required: boolean;
    reason: string | null;
    approvalId: string | null;
  };
  safety: {
    policyBrokerRequired: true;
    skillContentIsUntrustedByDefault: true;
    importedSkillsAreInstructionsOnly: true;
    liveUseRequiresApproval: true;
    workspaceMutationRequiresApproval: true;
    sensitiveNetworkRequiresApproval: true;
  };
  execution: {
    subagentRuntime: ZavorthSubagentRuntimeSnapshot | null;
    skillBridge: ZavorthUniversalSkillBridgeSnapshot | null;
    sandboxLifecycle: ZavorthSandboxLifecyclePlan | null;
  };
  surfaceCommands: ZavorthNaturalInvocationSurfaceCommand[];
  receipts: ZavorthInvocationReceipt[];
  narrative: {
    headline: string;
    summary: string;
    nextAction: string;
  };
  commands: {
    invoke: 'npm run zavorth:natural-invocation -- --text "<request>"';
    invokeJson: 'npm run zavorth:natural-invocation:json -- --text "<request>"';
    check: 'npm run zavorth:natural-invocation:check --silent';
    nextStage: 'Runtime gateway - Absorption Materialization And Bridge Handoff';
  };
};
