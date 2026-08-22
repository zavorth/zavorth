import type { PermissionRequest } from '../../contracts/PermissionRequest.js';
import type { Task } from '../../contracts/TaskContract.js';
import type { WorkflowRunService } from '../../runtime/workflows/WorkflowRunService.js';

export type TaskManagerLike = {
  getRecentTasks(limit?: number, userId?: string): Task[];
};

export type PermissionServiceLike = {
  listRequests(status?: 'pending' | 'approved' | 'rejected' | 'all', limit?: number): Promise<PermissionRequest[]>;
};

export type ProductObservabilityRuntime = {
  now?: () => Date;
  taskLimit?: number;
  permissionLimit?: number;
  workflowLimit?: number;
  windowHours?: number;
  workflowRunService?: Pick<WorkflowRunService, 'listRuns'>;
};

export type WeightedCount = {
  label: string;
  count: number;
  last_seen_at: string;
};

export type RouteSubtypeCount = WeightedCount & {
  kind: string;
};

export type ExecutorStat = {
  executor: string;
  total: number;
  completed: number;
  failed: number;
  waiting_approval: number;
  approval_friction: number;
  success_rate: number;
  last_seen_at: string;
};

export type ApprovalExecutorStat = {
  executor: string;
  pending: number;
  rejected: number;
  high_risk: number;
  permissions: number;
  last_seen_at: string;
};

export type ArtifactKindStat = WeightedCount & {
  type: string;
};

export type WorkflowOverview = {
  workflow_run_id: string;
  workflow: string;
  status: string;
  operator_state: 'active' | 'closed';
  operator_close_reason: string | null;
  completed_stages: number;
  total_stages: number;
  resume_stage_id: string | null;
  resume_stage_label: string | null;
  recovered_from_interruption: boolean;
  last_interrupted_stage_label: string | null;
  primary_artifact_name: string | null;
  updated_at: string;
};

export type SurfaceSourceStat = WeightedCount;

export type RouteLearningStat = {
  executor: string;
  source: string | null;
  source_surface: string | null;
  strategy: string | null;
  workflow: string | null;
  kind: string;
  subtype: string;
  total: number;
  completed: number;
  failed: number;
  waitingApproval: number;
  waitingPermission: number;
  rejected: number;
  approvalGranted: number;
  permissionGranted: number;
  highRisk: number;
  artifactful: number;
  gatedCompletion: number;
  gatedArtifactful: number;
  workflowRecovered: number;
  workflowRecoverySuccess: number;
  workflowRecoveryArtifactful: number;
  average_duration_ms: number;
  average_approval_wait_ms: number;
  average_post_approval_recovery_ms: number;
  average_artifact_delivery_after_approval_ms: number;
  operator_cost_score: number;
  evaluable_total: number;
  success_rate: number;
  friction_rate: number;
  last_seen_at: string;
  rationale: string;
};

export type MutableRouteLearningStat = RouteLearningStat & {
  approval_wait_total_ms: number;
  approval_wait_samples: number;
  post_approval_recovery_total_ms: number;
  post_approval_recovery_samples: number;
  artifact_delivery_after_approval_total_ms: number;
  artifact_delivery_after_approval_samples: number;
};

export type ApprovedPolicyStat = {
  executor: string;
  kind: string;
  scope: string;
  count: number;
  last_seen_at: string;
  rationale: string;
};

export type WorkflowResumeStageStat = {
  workflow: string;
  stage_label: string;
  count: number;
  approval_pending: number;
  blocked: number;
  failed: number;
  last_seen_at: string;
  rationale: string;
};

export type ProductObservabilityScope = {
  workspace: string | null;
  sourceSurface: string | null;
  executor: string | null;
  workflow: string | null;
};

export type ProductObservabilityBuildInput =
  | Date
  | Partial<ProductObservabilityScope & {
      referenceDate: Date;
    }>;

export type ProductObservabilitySnapshot = {
  generatedAt: string;
  windowHours: number;
  scope: ProductObservabilityScope & {
    scoped: boolean;
  };
  totals: {
    tasks: number;
    completed: number;
    failed: number;
    waitingApproval: number;
    workflowRuns: number;
    resumableWorkflowRuns: number;
    artifacts: number;
    approvals: number;
  };
  routes: {
    strategies: WeightedCount[];
    taskKinds: WeightedCount[];
    taskSubtypes: RouteSubtypeCount[];
  };
  workspaces: {
    top: WeightedCount[];
  };
  surfaces: {
    sources: SurfaceSourceStat[];
  };
  workflows: {
    active: number;
    resumable: number;
    completed: number;
    failed: number;
    recent: WorkflowOverview[];
  };
  executors: {
    top: ExecutorStat[];
    friction: ApprovalExecutorStat[];
  };
  approvals: {
    pending: number;
    approved: number;
    rejected: number;
    highRisk: number;
    permissionPending: number;
    permissionRejected: number;
  };
  operatorCost: {
    averageApprovalWaitMs: number;
    averageRecoveryMs: number;
    averageArtifactDeliveryMs: number;
    heaviestRoute: RouteLearningStat | null;
  };
  artifacts: {
    topKinds: ArtifactKindStat[];
    recent: Array<{
      name: string;
      kind: string;
      type: string;
      task_id: string | null;
      created_at: string;
    }>;
  };
  learning: {
    routes: {
      topSuccessful: RouteLearningStat[];
      highestFriction: RouteLearningStat[];
      highestOperatorCost: RouteLearningStat[];
    };
    approvedPolicies: ApprovedPolicyStat[];
    workflowResumeStages: WorkflowResumeStageStat[];
  };
  insights: string[];
};
