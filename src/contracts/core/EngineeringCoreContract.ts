import type { SystemOverlordActionRecord } from './SystemOverlordContract.js';
import type {
  SystemOverlordAutonomyLevel,
  SystemOverlordCapability,
} from './SystemOverlordContract.js';

export type EngineeringExecutionProfile = 'safe' | 'trusted' | 'dangerous' | 'owner';

export type EngineeringIntentKind =
  | 'create_project'
  | 'diagnose_build'
  | 'install_and_retry'
  | 'next_step'
  | 'undo_change'
  | 'system_overlord_operation'
  | 'generic_engineering';

export type EngineeringRunStatus =
  | 'planning'
  | 'running'
  | 'waiting_user'
  | 'ready'
  | 'session_ready'
  | 'dispatched'
  | 'completed'
  | 'failed';

export type EngineeringRunLoopStatus =
  | 'idle'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'no_action';

export type RequirementGapKind =
  | 'missing_docker'
  | 'missing_image'
  | 'missing_dependency'
  | 'missing_secret'
  | 'missing_toolchain'
  | 'approval_required'
  | 'human_step_required'
  | 'sandbox_insufficient'
  | 'external_transient_error';

export type RepairStrategyKind =
  | 'install_dependency'
  | 'rerun_in_container'
  | 'review_config'
  | 'provide_secret'
  | 'human_required'
  | 'propose_patch'
  | 'rerun_step';

export type EngineeringActionKind =
  | 'inspect_fs'
  | 'read_file'
  | 'search_files'
  | 'propose_patch'
  | 'apply_patch'
  | 'rollback_patch'
  | 'run_command'
  | 'install_dependency'
  | 'ask_user'
  | 'rerun_step'
  | 'finalize_run';

export type EngineeringConversationScope = {
  platform: string;
  chatId: string;
  userId: string;
};

export type EngineeringIntentRequest = {
  rawText: string;
  workspaceHint?: string | null;
  scope?: EngineeringConversationScope | null;
};

export type EngineeringIntent = {
  kind: EngineeringIntentKind;
  objective: string;
  mutating: boolean;
  requiresSession: boolean;
  preferredProfile: EngineeringExecutionProfile;
  preferredCapability?: SystemOverlordCapability | null;
  preferredAutonomyLevel?: SystemOverlordAutonomyLevel | null;
  workspaceHint?: string | null;
  suggestedCommands: string[];
};

export type EngineeringContextSnapshot = {
  workspace: string;
  workspaceName: string;
  packageJsonExists: boolean;
  packageManager: string | null;
  scripts: Record<string, string>;
  lockfiles: string[];
  tsconfigExists: boolean;
  detectedStacks: string[];
  frameworks: string[];
  languages: string[];
  importantPaths: string[];
  shallowTree: string[];
  instructionFile: string | null;
  instructionSources: string[];
  instructionSummary: string;
  instructionNotes: string[];
  skillDirectories: string[];
  contextLayers: Array<{ id: string; label: string; summary: string; source: string | null }>;
  workspaceCommands: Array<{ name: string; template: string }>;
  workspaceHooks: Array<{ event: string; command: string }>;
  autorepairSummary: string | null;
};

export type RequirementGap = {
  id: string;
  kind: RequirementGapKind;
  blocking: boolean;
  summary: string;
  detail: string;
  operatorAction: 'approve_install' | 'enable_docker' | 'provide_secret' | 'install_toolchain' | 'manual_step';
};

export type PatchProposal = {
  proposalId: string;
  previewId?: string | null;
  changeId?: string | null;
  mode?: 'file' | 'goal' | 'multi' | null;
  status?: 'previewed' | 'applied' | 'rolled_back' | 'failed' | null;
  summary: string;
  targetFiles: string[];
  diffSummary?: string | null;
  previewPath?: string | null;
};

export type RepairProposal = {
  kind: RepairStrategyKind;
  summary: string;
  confidence: number;
  actions: EngineeringAction[];
};

export type EngineeringAction = {
  kind: EngineeringActionKind;
  label: string;
  metadata?: Record<string, any>;
};

export type EngineeringPlan = {
  summary: string;
  profile: EngineeringExecutionProfile;
  actions: EngineeringAction[];
  patchProposal?: PatchProposal | null;
  repairProposal?: RepairProposal | null;
};

export type EngineeringRunLoopSnapshot = {
  status: EngineeringRunLoopStatus;
  attempt: number;
  maxAttempts: number;
  commandsPlanned: string[];
  commandsExecuted: string[];
  lastFailureSummary: string | null;
  nextStep: string | null;
};

export type EngineeringSessionSnapshot = {
  sessionId: string;
  live: boolean;
  recordingEnabled: boolean;
  recordingPath: string | null;
};

export type EngineeringRunSnapshot = {
  runId: string;
  scopeKey: string | null;
  createdAt: string;
  updatedAt: string;
  status: EngineeringRunStatus;
  request: EngineeringIntentRequest;
  intent: EngineeringIntent;
  context: EngineeringContextSnapshot;
  plan: EngineeringPlan;
  requirementGaps: RequirementGap[];
  linkedTaskId: string | null;
  session: EngineeringSessionSnapshot | null;
  hostActions?: SystemOverlordActionRecord[];
  loop?: EngineeringRunLoopSnapshot | null;
  replySummary: string;
};

export type EngineeringReplaySnapshot = {
  run: EngineeringRunSnapshot;
  session: any | null;
  recordings: Array<{ filename: string; path: string; sizeBytes: number }>;
};
