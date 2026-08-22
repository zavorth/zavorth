import type { SharedSurfaceCommandContractEntry } from '../../../../services/SharedSurfaceCommandContract.js';

export type SurfaceConsistencyCategory =
  | 'chat'
  | 'workflow'
  | 'runtime'
  | 'operations'
  | 'control-plane';

export type SurfaceConsistencyCommandSnapshot = {
  commandType: string;
  surfaceCommand: string;
  description: string;
  handler: SharedSurfaceCommandContractEntry['handler'];
  category: SurfaceConsistencyCategory;
  equivalents: {
    webPrompt: string;
    telegramCommand: string;
    discordSlashCommand: string | null;
  };
  availability: {
    web: 'ready' | 'pending';
    telegram: 'ready' | 'pending';
    discord: 'slash' | 'hidden';
  };
  discord: {
    slashName: string | null;
    visibility: SharedSurfaceCommandContractEntry['discordSlashVisibility'];
  };
};

export type SurfaceConsistencyActionType =
  | 'continue-official-access'
  | 'open-official-app'
  | 'continue-latest-context'
  | 'resume-workflow'
  | 'restart-workflow-stage'
  | 'close-blocked-workflow'
  | 'approve-pending-task'
  | 'reject-pending-task'
  | 'open-latest-artifact';

export type SurfaceConsistencyActionCategory =
  | 'access'
  | 'continuity'
  | 'workflow'
  | 'approval'
  | 'artifact';

export type SurfaceConsistencySurfaceActionMode =
  | 'prompt'
  | 'command'
  | 'inline'
  | 'slash'
  | 'hidden';

export type SurfaceConsistencySurfaceActionSnapshot = {
  mode: SurfaceConsistencySurfaceActionMode;
  label: string;
  value: string | null;
};

export type SurfaceConsistencyActionContextTask = {
  task_id?: string | null;
  raw_message?: string | null;
  approval_status?: string | null;
  artifacts?: Array<{
    id?: string | null;
    path?: string | null;
    name?: string | null;
    summary?: string | null;
  }> | null;
  metadata?: Record<string, unknown> | null;
};

export type SurfaceConsistencyActionContextPermission = {
  permission_id?: string | null;
  task_id?: string | null;
  scope?: string | null;
  reason?: string | null;
  status?: string | null;
};

export type SurfaceConsistencyActionContextWorkflow = {
  workflow_run_id?: string | null;
  workflow_name?: string | null;
  status?: string | null;
  operator_state?: string | null;
  actionable_stages?: Array<{
    id?: string | null;
    label?: string | null;
    status?: string | null;
    reason?: string | null;
    task_id?: string | null;
  }> | null;
  stages?: Array<{
    id?: string | null;
    label?: string | null;
    status?: string | null;
    result_summary?: string | null;
    handoff_summary?: string | null;
    task_id?: string | null;
  }> | null;
  resume_stage?: {
    id?: string | null;
    label?: string | null;
    reason?: string | null;
  } | null;
  resume_prompt?: string | null;
};

export type SurfaceConsistencyActionContextContinuity = {
  suggestedAction?: {
    label?: string;
    reason?: string;
    prompt?: string | null;
  } | null;
  workspaceContext?: {
    followupPrompt?: string | null;
    recentArtifact?: string | {
      name?: string | null;
      kind?: string | null;
      path?: string | null;
      taskId?: string | null;
    } | null;
    activeFocus?: string | {
      label?: string | null;
      reason?: string | null;
      taskId?: string | null;
      source?: string | null;
    } | null;
  } | null;
  latestTelegramTask?: {
    taskId?: string;
  } | null;
  focusTask?: {
    taskId?: string;
  } | null;
};

export type SurfaceConsistencyActionContextAccess = {
  recommendedPlan?: {
    primaryAction?: string | null;
    primaryLabel?: string | null;
    primarySummary?: string | null;
    primaryCommand?: string | null;
    openTarget?: string | null;
  } | null;
  local?: {
    appUrl?: string | null;
  } | null;
  remote?: {
    appUrl?: string | null;
  } | null;
};

export type SurfaceConsistencyActionContext = {
  access?: SurfaceConsistencyActionContextAccess | null;
  continuity?: SurfaceConsistencyActionContextContinuity | null;
  tasks?: SurfaceConsistencyActionContextTask[] | null;
  permissions?: SurfaceConsistencyActionContextPermission[] | null;
  workflowRuns?: SurfaceConsistencyActionContextWorkflow[] | null;
};

export type SurfaceConsistencyActionSnapshot = {
  actionId: string;
  actionType: SurfaceConsistencyActionType;
  title: string;
  description: string;
  category: SurfaceConsistencyActionCategory;
  availability: {
    web: 'ready' | 'pending';
    telegram: 'ready' | 'pending';
    discord: 'slash' | 'hidden';
  };
  equivalents: {
    web: SurfaceConsistencySurfaceActionSnapshot;
    telegram: SurfaceConsistencySurfaceActionSnapshot;
    discord: SurfaceConsistencySurfaceActionSnapshot;
  };
  context: {
    taskId: string | null;
    permissionId: string | null;
    workflowRunId: string | null;
    workflowStageId: string | null;
    artifactId: string | null;
    artifactPath: string | null;
    reason: string | null;
  };
};

export type SurfaceConsistencyManifest = {
  generatedAt: string;
  summary: string;
  surfaces: {
    web: {
      ready: boolean;
      summary: string;
    };
    telegram: {
      ready: boolean;
      summary: string;
    };
    discord: {
      enabled: boolean;
      commandExposure: 'none' | 'minimal' | 'operator';
      publicServerMode: boolean;
      slashReadyCount: number;
      summary: string;
    };
  };
  counts: {
    total: number;
    webReady: number;
    telegramReady: number;
    discordSlashReadyCount: number;
  };
  actions: SurfaceConsistencyActionSnapshot[];
  recommended: SurfaceConsistencyCommandSnapshot[];
  commands: SurfaceConsistencyCommandSnapshot[];
};

export type SharedSurfaceConsistencyOptions = {
  now?: () => Date;
  surfaceReadiness?: Partial<{
    web: {
      ready: boolean;
      summary?: string;
    };
    telegram: {
      ready: boolean;
      summary?: string;
    };
    discord: {
      enabled?: boolean;
      summary?: string;
      commandExposure?: 'none' | 'minimal' | 'operator';
      publicServerMode?: boolean;
    };
  }>;
};

export type SharedSurfaceConsistencyManifestOptions = {
  context?: SurfaceConsistencyActionContext | null;
};

export type SurfaceConsistencyReadiness = {
  webReady: boolean;
  telegramReady: boolean;
};

export type SurfaceConsistencyDiscordReadiness = {
  enabled: boolean;
  commandExposure: 'none' | 'minimal' | 'operator';
  publicServerMode: boolean;
  summary: (slashReadyCount: number) => string;
};

export type SurfaceConsistencyLatestArtifact = {
  taskId: string;
  artifactId: string;
  path: string | null;
  name: string | null;
  summary: string | null;
};

export type SurfaceConsistencyWorkflowStage = {
  id: string;
  label: string;
  status: string;
  reason: string | null;
  task_id: string | null;
};
