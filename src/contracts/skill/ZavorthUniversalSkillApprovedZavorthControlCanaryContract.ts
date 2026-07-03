import type { ZavorthUniversalSkillExpansionQaStatus } from './ZavorthUniversalSkillExpansionQaContract.js';
import type {
  ZavorthUniversalSkillZavorthControlReviewItem,
  ZavorthUniversalSkillScaleBatch,
  ZavorthUniversalSkillScaleHardeningSnapshot,
} from './ZavorthUniversalSkillScaleHardeningContract.js';

export const ZAVORTH_UNIVERSAL_SKILL_APPROVED_ZAVORTH_CONTROL_CANARY_CONTRACT_VERSION =
  '2026-05-10.checkpoint-10' as const;

export type ZavorthUniversalSkillApprovedZavorthControlCanaryStatus =
  ZavorthUniversalSkillExpansionQaStatus;

export type ZavorthUniversalSkillZavorthControlCanaryMode =
  | 'zavorthControl-only'
  | 'dry-run'
  | 'live';

export type ZavorthUniversalSkillZavorthControlCanaryStatus =
  | 'zavorthControl-ready'
  | 'dry-run-ready'
  | 'approval-required'
  | 'live-prepared'
  | 'blocked';

export type ZavorthUniversalSkillZavorthControlCard = {
  id: string;
  label: string;
  value: number | string | boolean;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  evidence: string;
};

export type ZavorthUniversalSkillZavorthControlTableRow = {
  id: string;
  sourceLabel: string;
  candidateRange: string;
  candidateEstimate: number;
  mode: string;
  approvalRequired: boolean;
  status: ZavorthUniversalSkillExpansionQaStatus;
};

export type ZavorthUniversalSkillZavorthControlFilter = {
  id: string;
  label: string;
  options: string[];
};

export type ZavorthUniversalSkillZavorthControlAction = {
  id: string;
  label: string;
  command: string;
  apiPath: string;
  enabled: boolean;
  requiresApproval: boolean;
  reason: string;
};

export type ZavorthUniversalSkillApprovedZavorthControlCanarySnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_UNIVERSAL_SKILL_APPROVED_ZAVORTH_CONTROL_CANARY_CONTRACT_VERSION;
  status: ZavorthUniversalSkillApprovedZavorthControlCanaryStatus;
  projectRoot: string;
  channel: string;
  scale: ZavorthUniversalSkillScaleHardeningSnapshot;
  zavorthControlImplementation: {
    endpoint: '/api/skills/scale-hardening';
    approvedItemIds: string[];
    pendingItemIds: string[];
    implementedItems: ZavorthUniversalSkillZavorthControlReviewItem[];
    visualFilesChanged: false;
    layoutMutationPerformed: false;
    cards: ZavorthUniversalSkillZavorthControlCard[];
    table: {
      id: 'scale-canary-batches';
      rows: ZavorthUniversalSkillZavorthControlTableRow[];
    };
    filters: ZavorthUniversalSkillZavorthControlFilter[];
    actions: ZavorthUniversalSkillZavorthControlAction[];
  };
  canary: {
    mode: ZavorthUniversalSkillZavorthControlCanaryMode;
    status: ZavorthUniversalSkillZavorthControlCanaryStatus;
    selectedBatch: ZavorthUniversalSkillScaleBatch | null;
    approvalId: string | null;
    dryRunPrepared: boolean;
    livePrepared: boolean;
    liveExecutionPerformed: false;
    upstreamExecutionPerformed: false;
    receiptId: string;
    reason: string;
    commands: {
      dryRun: string | null;
      live: string | null;
      requestApproval: string | null;
    };
  };
  rollout: {
    readyForZavorthControlUse: boolean;
    readyForLiveCanary: boolean;
    nextActions: string[];
  };
  report: {
    persisted: boolean;
    path: string | null;
    rawSecretsSerialized: false;
  };
  policy: {
    certificationMatrixScaleHardeningIsAuthority: true;
    approvedZavorthControlItemsOnly: true;
    endpointRequiresManagementAuth: true;
    noLayoutMutationPerformed: true;
    noCssMutationPerformed: true;
    liveCanaryRequiresApprovalId: true;
    canaryPreparationDoesNotExecuteSkills: true;
    noExecutionPerformed: true;
    noDirectUpstreamRuntimeUse: true;
    noRawSecretsSerialized: true;
  };
  commands: {
    run: 'npm run zavorth:universal-skill-approved-zavorthControl-canary -- --discover';
    runJson: 'npm run zavorth:universal-skill-approved-zavorthControl-canary:json -- --discover';
    check: 'npm run zavorth:universal-skill-approved-zavorthControl-canary:check --silent';
    nextStage: 'Intent model1 - ZavorthControl Visual Rendering Approval and Canary Monitoring';
  };
};
