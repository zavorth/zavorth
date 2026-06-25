export const ZAVORTH_EFFORT_CONTROL_CONTRACT_VERSION = 'zavorth-effort-control/1' as const;

export type ZavorthEffortLevel = 'low' | 'standard' | 'high' | 'ultra-code';

export type ZavorthInternalEffort = 'light' | 'standard' | 'heavy';

export type ZavorthEffortModelClass = 'cheap' | 'standard' | 'premium';

export type ZavorthEffortControlSnapshot = {
  contractVersion: typeof ZAVORTH_EFFORT_CONTROL_CONTRACT_VERSION;
  generatedAt: string;
  requestedLevel: string | null;
  effectiveLevel: ZavorthEffortLevel;
  requestPreview: string | null;
  profile: string | null;
  runtime: {
    internalEffort: ZavorthInternalEffort;
    operationalReasoningSummary: string;
    exposeChainOfThought: false;
  };
  routing: {
    workerModelClass: ZavorthEffortModelClass;
    synthesisModelClass: ZavorthEffortModelClass;
    dynamicWorkflowsRecommended: boolean;
    agentTeamsRecommended: boolean;
    subagentsRecommended: boolean;
    routeReason: string;
  };
  budget: {
    maxCents: number;
    approvalRequiredAboveCents: number;
    maxSubagents: number;
    maxToolCalls: number;
    maxContextWindows: number;
    stopWhenExceeded: true;
  };
  approval: {
    required: boolean;
    reasons: string[];
  };
  safety: {
    noChainOfThoughtExposure: true;
    noPolicyBypass: true;
    costGuardRequired: true;
    dynamicWorkflowBudgetRequired: true;
    liveMutationStillRequiresApproval: true;
    externalIoStillRequiresApproval: true;
    rawSecretsSerialized: false;
  };
  commandPreview: {
    effort: string;
    costGuard: string;
    dynamicWorkflow: string;
    agentTeam: string;
  };
};

export type ZavorthEffortControlInput = {
  level?: unknown;
  request?: unknown;
  profile?: unknown;
  maxCents?: unknown;
};
