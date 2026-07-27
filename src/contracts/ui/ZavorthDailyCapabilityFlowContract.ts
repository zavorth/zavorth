import type { RuntimeDeploymentTarget } from '../RuntimeProfilePlaybookContract.js';

export const ZAVORTH_DAILY_CAPABILITY_FLOW_VERSION = 'daily-capability-flow/v1' as const;

export type ZavorthDailyCapabilityFlowStatus = 'ready' | 'attention' | 'blocked';

export type ZavorthDailyCapabilityFlowStage = {
  id: 'observe' | 'draft' | 'evaluate' | 'approve' | 'apply' | 'measure' | 'rollback';
  label: string;
  status: 'done' | 'next' | 'pending' | 'blocked';
  summary: string;
  command: string | null;
};

export type ZavorthDailyCapabilityFlowWizardStep = {
  id: 'inspect' | 'select' | 'budget' | 'elevate';
  label: string;
  status: 'done' | 'next' | 'pending' | 'blocked';
  command: string | null;
  summary: string;
};

export type ZavorthDailyCapabilityFlowMcpItem = {
  id: string;
  name: string;
  displayStatus: 'needs-review' | 'blocked';
  risk: 'low' | 'medium' | 'high';
  tools: string[];
  executableToolsExposed: 0;
  nextAction: string;
  reviewCommand: string;
};

export type ZavorthDailyCapabilityFlowZavorthControlCard = {
  id:
    | 'improve-behavior'
    | 'memory-learning'
    | 'mcp-catalog'
    | 'skill-lifecycle'
    | 'runtime-wizard'
    | 'channel-wizard'
    | 'backend-wizard'
    | 'continuous-evals';
  title: string;
  area: 'learning' | 'memory' | 'skills' | 'runtime' | 'channels' | 'backends' | 'quality';
  status: ZavorthDailyCapabilityFlowStatus;
  summary: string;
  href: string;
  command: string;
  primaryAction: string;
  badges: string[];
  requiresApproval: boolean;
  mutatesState: false;
  executionAuthority: false;
};

export type ZavorthDailyCapabilityFlowSnapshot = {
  generatedAt: string;
  version: typeof ZAVORTH_DAILY_CAPABILITY_FLOW_VERSION;
  status: ZavorthDailyCapabilityFlowStatus;
  headline: string;
  selfImprovement: {
    title: 'Improve behavior';
    status: ZavorthDailyCapabilityFlowStatus;
    promptStatus: 'ready' | 'blocked' | 'needs-review';
    bestCandidateId: string | null;
    requiresApprovalForPromotion: true;
    noAutoApply: true;
    rollbackAvailable: true;
    stages: ZavorthDailyCapabilityFlowStage[];
  };
  runtimeSetup: {
    title: 'Light runtime';
    target: RuntimeDeploymentTarget;
    selectedProfile: string;
    fallbackProfile: string;
    alwaysOnReady: boolean;
    wizardSteps: ZavorthDailyCapabilityFlowWizardStep[];
  };
  mcpCatalog: {
    title: 'Add tool';
    status: ZavorthDailyCapabilityFlowStatus;
    scanned: number;
    blocked: number;
    needsReview: number;
    executableToolsExposed: 0;
    items: ZavorthDailyCapabilityFlowMcpItem[];
  };
  continuousEvals: {
    title: 'Run evaluations';
    status: ZavorthDailyCapabilityFlowStatus;
    commands: string[];
    summary: string;
  };
  zavorthControlProjection: {
    route: '/control';
    renderMode: 'daily-capability-flow';
    cards: ZavorthDailyCapabilityFlowZavorthControlCard[];
    safety: {
      projectionOnly: true;
      rawSecretsSerialized: false;
      liveActionsRemainApprovalBound: true;
    };
  };
  nextBestActions: string[];
  safety: {
    projectionOnly: true;
    noLiveActionExecuted: true;
    rawSecretsSerialized: false;
    approvalRequiredForBehaviorChange: true;
    runtimeProfileDoesNotGrantAuthority: true;
    externalToolsHeldForReviewBeforeExposure: true;
    continuousEvalDoesNotPersistByDefault: true;
  };
};
