import type { ZavorthUniversalSkillExpansionQaStatus } from './ZavorthUniversalSkillExpansionQaContract.js';
import type {
  ZavorthUniversalSkillDashboardReviewItem,
  ZavorthUniversalSkillScaleBatch,
  ZavorthUniversalSkillScaleHardeningSnapshot,
} from './ZavorthUniversalSkillScaleHardeningContract.js';

export const ZAVORTH_UNIVERSAL_SKILL_APPROVED_DASHBOARD_CANARY_CONTRACT_VERSION =
  '2026-05-10.phase-10' as const;

export type ZavorthUniversalSkillApprovedDashboardCanaryStatus =
  ZavorthUniversalSkillExpansionQaStatus;

export type ZavorthUniversalSkillCanaryMode =
  | 'dashboard-only'
  | 'dry-run'
  | 'live';

export type ZavorthUniversalSkillCanaryStatus =
  | 'dashboard-ready'
  | 'dry-run-ready'
  | 'approval-required'
  | 'live-prepared'
  | 'blocked';

export type ZavorthUniversalSkillDashboardCard = {
  id: string;
  label: string;
  value: number | string | boolean;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  evidence: string;
};

export type ZavorthUniversalSkillDashboardTableRow = {
  id: string;
  sourceLabel: string;
  candidateRange: string;
  candidateEstimate: number;
  mode: string;
  approvalRequired: boolean;
  status: ZavorthUniversalSkillExpansionQaStatus;
};

export type ZavorthUniversalSkillDashboardFilter = {
  id: string;
  label: string;
  options: string[];
};

export type ZavorthUniversalSkillDashboardAction = {
  id: string;
  label: string;
  command: string;
  apiPath: string;
  enabled: boolean;
  requiresApproval: boolean;
  reason: string;
};

export type ZavorthUniversalSkillApprovedDashboardCanarySnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_UNIVERSAL_SKILL_APPROVED_DASHBOARD_CANARY_CONTRACT_VERSION;
  status: ZavorthUniversalSkillApprovedDashboardCanaryStatus;
  projectRoot: string;
  channel: string;
  scale: ZavorthUniversalSkillScaleHardeningSnapshot;
  dashboardImplementation: {
    endpoint: '/api/skills/scale-hardening';
    approvedItemIds: string[];
    pendingItemIds: string[];
    implementedItems: ZavorthUniversalSkillDashboardReviewItem[];
    visualFilesChanged: false;
    layoutMutationPerformed: false;
    cards: ZavorthUniversalSkillDashboardCard[];
    table: {
      id: 'scale-canary-batches';
      rows: ZavorthUniversalSkillDashboardTableRow[];
    };
    filters: ZavorthUniversalSkillDashboardFilter[];
    actions: ZavorthUniversalSkillDashboardAction[];
  };
  canary: {
    mode: ZavorthUniversalSkillCanaryMode;
    status: ZavorthUniversalSkillCanaryStatus;
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
    readyForDashboardUse: boolean;
    readyForLiveCanary: boolean;
    nextActions: string[];
  };
  report: {
    persisted: boolean;
    path: string | null;
    rawSecretsSerialized: false;
  };
  policy: {
    phase9ScaleHardeningIsAuthority: true;
    approvedDashboardItemsOnly: true;
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
    run: 'npm run zavorth:universal-skill-approved-dashboard-canary -- --discover';
    runJson: 'npm run zavorth:universal-skill-approved-dashboard-canary:json -- --discover';
    check: 'npm run zavorth:universal-skill-approved-dashboard-canary:check --silent';
    nextPhase: 'Phase 11 - Dashboard Visual Rendering Approval and Canary Monitoring';
  };
};
