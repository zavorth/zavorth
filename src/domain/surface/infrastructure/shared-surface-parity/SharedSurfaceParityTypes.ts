import type { SharedSurfaceCommandContractEntry } from '../../../../services/SharedSurfaceCommandContract.js';

export type SurfaceParityCategory =
  | 'chat'
  | 'workflow'
  | 'runtime'
  | 'operations'
  | 'control-plane';

export type SurfaceParityCommandSnapshot = {
  commandType: string;
  surfaceCommand: string;
  description: string;
  handler: SharedSurfaceCommandContractEntry['handler'];
  category: SurfaceParityCategory;
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

export type SurfaceParityActionType =
  | 'continue-official-access'
  | 'open-official-app'
  | 'continue-latest-context'
  | 'resume-workflow'
  | 'restart-workflow-stage'
  | 'close-blocked-workflow'
  | 'approve-pending-task'
  | 'reject-pending-task'
  | 'open-latest-artifact';

export type SurfaceParityActionCategory =
  | 'access'
  | 'continuity'
  | 'workflow'
  | 'approval'
  | 'artifact';

export type SurfaceParitySurfaceActionMode =
  | 'prompt'
  | 'command'
  | 'inline'
  | 'slash'
  | 'hidden';

export type SurfaceParitySurfaceActionSnapshot = {
  mode: SurfaceParitySurfaceActionMode;
  label: string;
  value: string | null;
};

export type SurfaceParityActionContextTask = {
  task_id?: string | null;
  raw_message?: string | null;
  approval_status?: string | null;
  artifacts?: Array<{
    id?: string | null;
    path?: string | null;
    name?: string | null;
    summary?: string | null;
  }> | null;
  metadata?: Record<string, any> | null;
};

export type SurfaceParityActionContextPermission = {
  permission_id?: string | null;
  task_id?: string | null;
  scope?: string | null;
  reason?: string | null;
  status?: string | null;
};

export type SurfaceParityActionContextWorkflow = {
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

export type SurfaceParityActionContextContinuity = {
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

export type SurfaceParityActionContextAccess = {
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

export type SurfaceParityActionContext = {
  access?: SurfaceParityActionContextAccess | null;
  continuity?: SurfaceParityActionContextContinuity | null;
  tasks?: SurfaceParityActionContextTask[] | null;
  permissions?: SurfaceParityActionContextPermission[] | null;
  workflowRuns?: SurfaceParityActionContextWorkflow[] | null;
};

export type SurfaceParityActionSnapshot = {
  actionId: string;
  actionType: SurfaceParityActionType;
  title: string;
  description: string;
  category: SurfaceParityActionCategory;
  availability: {
    web: 'ready' | 'pending';
    telegram: 'ready' | 'pending';
    discord: 'slash' | 'hidden';
  };
  equivalents: {
    web: SurfaceParitySurfaceActionSnapshot;
    telegram: SurfaceParitySurfaceActionSnapshot;
    discord: SurfaceParitySurfaceActionSnapshot;
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

export type SurfaceParityManifest = {
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
  actions: SurfaceParityActionSnapshot[];
  recommended: SurfaceParityCommandSnapshot[];
  commands: SurfaceParityCommandSnapshot[];
};

export type SharedSurfaceParityOptions = {
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

export type SharedSurfaceParityManifestOptions = {
  context?: SurfaceParityActionContext | null;
};

export type SurfaceParityReadiness = {
  webReady: boolean;
  telegramReady: boolean;
};

export type SurfaceParityDiscordReadiness = {
  enabled: boolean;
  commandExposure: 'none' | 'minimal' | 'operator';
  publicServerMode: boolean;
  summary: (slashReadyCount: number) => string;
};

export type SurfaceParityLatestArtifact = {
  taskId: string;
  artifactId: string;
  path: string | null;
  name: string | null;
  summary: string | null;
};

export type SurfaceParityWorkflowStage = {
  id: string;
  label: string;
  status: string;
  reason: string | null;
  task_id: string | null;
};
