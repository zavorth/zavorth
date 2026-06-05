import type {
  ZavorthDepthModeBudgets,
  ZavorthDepthModeId,
  ZavorthDepthModeSnapshot,
  ZavorthMissionEffect,
  ZavorthMissionPattern,
} from './ZavorthDepthModeContract.js';

export const ZAVORTH_DYNAMIC_MISSION_HARNESS_VERSION = 'dynamic-mission-harness/v1' as const;
export const ZAVORTH_MISSION_MANIFEST_VERSION = 'zavorth-mission-manifest/v1' as const;

export type ZavorthDynamicMissionHarnessInput = {
  objective: string;
  mode?: ZavorthDepthModeId | null;
  requestedEffects?: ZavorthMissionEffect[];
  patternHints?: ZavorthMissionPattern[];
  contextArtifacts?: string[];
  requestedCaps?: Partial<Pick<ZavorthDepthModeBudgets, 'maxAgents' | 'maxDepth' | 'maxTokens' | 'maxCostUsd' | 'maxDurationMinutes'>>;
};

export type ZavorthMissionTaskRole =
  | 'classifier'
  | 'researcher'
  | 'planner'
  | 'implementer'
  | 'reviewer'
  | 'adversarial-verifier'
  | 'candidate-generator'
  | 'candidate-judge'
  | 'synthesis-lead'
  | 'loop-guard';

export type ZavorthMissionTask = {
  taskId: string;
  role: ZavorthMissionTaskRole;
  title: string;
  prompt: string;
  allowedEffects: ZavorthMissionEffect[];
  dependsOn: string[];
  checkpointId: string;
  worktreeIsolation: 'none' | 'recommended' | 'required';
  modelPreference: 'fast' | 'balanced' | 'strong';
  evidenceRequired: boolean;
};

export type ZavorthDynamicMissionHarnessSnapshot = {
  version: typeof ZAVORTH_DYNAMIC_MISSION_HARNESS_VERSION;
  generatedAt: string;
  missionId: string;
  status: 'preview' | 'needs-approval' | 'blocked';
  objectivePreview: string;
  mode: ZavorthDepthModeSnapshot;
  workflow: {
    format: typeof ZAVORTH_MISSION_MANIFEST_VERSION;
    execution: 'preview-only';
    patterns: ZavorthMissionPattern[];
    tasks: ZavorthMissionTask[];
  };
  budgets: ZavorthDepthModeBudgets;
  approval: {
    required: boolean;
    approvalId: string | null;
    reasons: string[];
  };
  resume: {
    durableQueue: 'workflow-run-service';
    resumable: true;
    checkpointIds: string[];
  };
  blockedReasons: string[];
  safety: {
    previewOnly: true;
    noArbitraryCodeExecution: true;
    secretsRedacted: true;
    externalIoRequiresApproval: true;
    mutationRequiresApproval: true;
    depthCapsEnforced: true;
    rawSecretsSerialized: false;
  };
};
