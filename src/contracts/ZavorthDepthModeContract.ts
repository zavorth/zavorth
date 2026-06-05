export const ZAVORTH_DEPTH_MODE_VERSION = 'depth-mode/v1' as const;

export type ZavorthDepthModeId = 'normal' | 'deep' | 'mission' | 'adversarial';

export type ZavorthMissionEffect = 'read' | 'write' | 'shell' | 'network' | 'external-send' | 'provider-change';

export type ZavorthMissionPattern =
  | 'classify-and-act'
  | 'fanout-and-synthesize'
  | 'adversarial-verification'
  | 'generate-and-filter'
  | 'tournament'
  | 'loop-until-done';

export type ZavorthDepthModeInput = {
  mode?: ZavorthDepthModeId | null;
  objective: string;
  requestedEffects?: ZavorthMissionEffect[];
};

export type ZavorthDepthModeBudgets = {
  maxAgents: number;
  maxDepth: number;
  maxTokens: number;
  maxCostUsd: number;
  maxDurationMinutes: number;
  checkpointEveryMinutes: number;
  isolatedWorktreeRequired: boolean;
};

export type ZavorthDepthModeSnapshot = {
  version: typeof ZAVORTH_DEPTH_MODE_VERSION;
  generatedAt: string;
  mode: ZavorthDepthModeId;
  label: string;
  objectivePreview: string;
  patterns: ZavorthMissionPattern[];
  budgets: ZavorthDepthModeBudgets;
  approvals: {
    previewRequired: true;
    mutationApprovalRequired: boolean;
    externalIoApprovalRequired: boolean;
    highCostApprovalRequired: boolean;
  };
  reviewCopy: {
    headline: string;
    userFacingRisk: 'quiet' | 'review' | 'approval';
    nextAction: string;
  };
  safety: {
    noDepthModeBypassesPolicy: true;
    budgetsHardCapped: true;
    rawSecretsSerialized: false;
  };
};
