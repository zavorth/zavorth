import type { OperatorBriefSnapshot } from '../../../../observability/OperatorBriefService.js';
import type { ProductObservabilitySnapshot } from '../../../../observability/ProductObservabilityService.js';
import type { SessionContinuitySnapshot } from '../../../../runtime/context/SessionContinuityService.js';

export type OperationsReportRuntime = {
  now?: () => Date;
};

export type PermissionListEntry = {
  permission_id?: string;
  executor?: string;
  kind?: string;
  reason?: string;
};

export type OperationsReportOverviewAction = {
  source: string;
  label: string;
  command: string | null;
  reason: string;
};

export type OperationsReportOverviewSnapshotLike = {
  generatedAt?: string | null;
  summary?: {
    posture?: string | null;
  } | null;
  narrative?: {
    headline?: string | null;
    operatorSummary?: string | null;
    nextAction?: string | null;
  } | null;
  actions?: Array<{
    source?: string | null;
    label?: string | null;
    command?: string | null;
    reason?: string | null;
  }> | null;
} | null;

export type OperationsReportOverviewReaders = {
  readOperationalOverviewSnapshot?: (() => Promise<OperationsReportOverviewSnapshotLike> | OperationsReportOverviewSnapshotLike) | null;
  readTrustOverviewSnapshot?: (() => Promise<OperationsReportOverviewSnapshotLike> | OperationsReportOverviewSnapshotLike) | null;
  readProductOverviewSnapshot?: (() => Promise<OperationsReportOverviewSnapshotLike> | OperationsReportOverviewSnapshotLike) | null;
};

export type OperationsReportOverviewSection = {
  generatedAt: string | null;
  posture: string;
  headline: string;
  operatorSummary: string;
  nextAction: string | null;
  actions: OperationsReportOverviewAction[];
};

export type OperationsReportSnapshot = {
  generatedAt: string;
  headline: string;
  operatorBrief: {
    posture: OperatorBriefSnapshot['posture'];
    headline: string;
    nextAction: {
      label: string;
      command: string;
      reason: string;
    };
  } | null;
  continuity: SessionContinuitySnapshot | null;
  executiveSummary: string[];
  runtime: {
    uptimeLabel: string;
    memoryLabel: string;
    platformLabel: string;
  };
  operations: {
    sidecarsLabel: string;
    channelsLabel: string;
    channelProviderDoctorLabel: string;
    remoteTransportDoctorLabel: string;
    tenantsLabel: string;
    nodeMeshSmokeLabel: string;
    publishLabel: string;
    storageLabel: string;
    automationLabel: string;
  };
  tenants: {
    totalCount: number;
    sharedCount: number;
    personalCount: number;
    pendingOnboardingCount: number;
    publicServerCount: number;
    byPlatform: Record<string, number>;
    recent: Array<{
      tenantId: string;
      platform: string;
      policyProfile: string;
      onboardingStatus: string;
      lastSeenAt: string;
    }>;
  };
  tasks: {
    activeCount: number;
    completedLast24h: number;
    failedLast24h: number;
    waitingApprovalLast24h: number;
    topExecutors: string[];
  };
  productObservability: {
    routeHeadline: string | null;
    workflowHeadline: string | null;
    executorHeadline: string | null;
    approvalsHeadline: string | null;
    artifactHeadline: string | null;
    topRoutes: string[];
    recentWorkflows: string[];
    topExecutors: string[];
    insights: string[];
  } | null;
  overviews: {
    operational: OperationsReportOverviewSection | null;
    trust: OperationsReportOverviewSection | null;
    product: OperationsReportOverviewSection | null;
  };
  pendingPermissions: Array<{
    executor: string;
    kind: string;
    reason: string;
  }>;
  alerts: Array<{
    source: string;
    title: string;
    detail: string;
  }>;
  actions: Array<{
    label: string;
    command: string;
    reason: string;
  }>;
  text: string;
};

export type OperationsReportTextInput = Pick<
  OperationsReportSnapshot,
  | 'generatedAt'
  | 'operatorBrief'
  | 'continuity'
  | 'executiveSummary'
  | 'runtime'
  | 'operations'
  | 'tenants'
  | 'tasks'
  | 'productObservability'
  | 'overviews'
  | 'pendingPermissions'
  | 'alerts'
  | 'actions'
>;

export type OperationsReportProductSupport = {
  buildProductExecutiveSummary: (snapshot: ProductObservabilitySnapshot) => string[];
  buildProductObservabilitySummary: (
    snapshot: ProductObservabilitySnapshot,
  ) => NonNullable<OperationsReportSnapshot['productObservability']>;
};
