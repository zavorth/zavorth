export const ZAVORTH_DYNAMIC_WORKFLOW_CONTRACT_VERSION = 'zavorth-dynamic-workflows/1' as const;

export type ZavorthDynamicWorkflowStatus = 'preview' | 'needs-approval' | 'blocked';

export type ZavorthDynamicWorkflowModelClass = 'cheap' | 'standard' | 'premium';

export type ZavorthDynamicWorkflowWorkerGroup = {
  groupId: string;
  label: string;
  roleIds: string[];
  objective: string;
  modelClass: ZavorthDynamicWorkflowModelClass;
  maxConcurrency: number;
  evidenceRequired: true;
};

export type ZavorthDynamicWorkflowSnapshot = {
  contractVersion: typeof ZAVORTH_DYNAMIC_WORKFLOW_CONTRACT_VERSION;
  generatedAt: string;
  workflowId: string;
  status: ZavorthDynamicWorkflowStatus;
  objectivePreview: string;
  scale: {
    requestedFanout: number;
    effectiveFanout: number;
    maxFanout: 300;
    requestedConcurrency: number;
    maxConcurrency: number;
    hardMaxConcurrency: 30;
    batchCount: number;
  };
  routing: {
    workers: {
      modelClass: ZavorthDynamicWorkflowModelClass;
      rationale: string;
    };
    synthesis: {
      modelClass: ZavorthDynamicWorkflowModelClass;
      rationale: string;
    };
  };
  budget: {
    status: 'within-budget' | 'approval-required' | 'blocked';
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    estimatedTotalTokens: number;
    estimatedUsd: number;
    maxCents: number;
    approvalRequiredAboveCents: number;
    stopWhenExceeded: true;
  };
  orchestration: {
    planFormat: 'zavorth-dynamic-workflow-plan/v1';
    arbitraryJavaScriptGenerated: false;
    generatedScript: 'none';
    workerGroups: ZavorthDynamicWorkflowWorkerGroup[];
    synthesisStage: {
      stageId: string;
      label: string;
      modelClass: ZavorthDynamicWorkflowModelClass;
      dependsOn: string[];
      objective: string;
      evidenceRequired: true;
    };
    connectedRuntime: {
      zavorthEnsemble: true;
      workflowRunService: true;
      receipts: true;
      replay: true;
    };
  };
  materialization: {
    ready: boolean;
    target: 'zavorth-ensemble-official';
    launchCommand: string;
    dryRunOnlyUntilApproval: true;
  };
  approval: {
    required: boolean;
    approvalId: string | null;
    reasons: string[];
  };
  blockedReasons: string[];
  safety: {
    noArbitraryCodeExecution: true;
    noImplicitExternalIo: true;
    noSecretSerialization: true;
    budgetHardCapEnforced: true;
    workerMutationRequiresApproval: true;
    synthesisCannotOverridePolicy: true;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: '/control...sector=workflow';
    receiptPreview: string;
  };
};

export type ZavorthDynamicWorkflowInput = {
  objective?: unknown;
  requestedFanout?: unknown;
  maxConcurrency?: unknown;
  maxCents?: unknown;
  workerModelClass?: unknown;
  synthesisModelClass?: unknown;
};

export type ZavorthDynamicWorkflowMaterializationResult = {
  status: 'materialized' | 'blocked';
  workflowId: string;
  receiptId: string | null;
  reason: string | null;
  swarmSnapshot: unknown | null;
  safety: {
    noDirectExecutionAuthority: true;
    approvalRequiredBeforeLaunch: true;
    budgetPassedToSwarm: true;
  };
};

export type ZavorthDynamicWorkflowSaveResult = {
  status: 'saved' | 'blocked';
  workflowId: string;
  path: string;
  receiptId: string | null;
  reason: string | null;
  safety: {
    noRawSecretSerialized: true;
    noLaunchPerformed: true;
  };
};
