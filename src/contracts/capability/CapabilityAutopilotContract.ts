import type {
  CapabilityDefinition,
  CapabilityPolicy,
  CapabilityType,
} from './CapabilityContract.js';
import type { ExecutionRequest, ExecutionResult } from '../ExecutionContract.js';
import type {
  IntegrationBinding,
  IntegrationInstallStep,
  IntegrationManifest,
  IntegrationProbeSnapshot,
  IntegrationRequirement,
} from '../IntegrationHubContract.js';
import type { Plan } from '../PlanContract.js';
import type { Task } from '../TaskContract.js';

export type CapabilityAutopilotSurface =
  | 'chat'
  | 'assistant'
  | 'builder'
  | 'operator'
  | 'cli'
  | 'web'
  | 'telegram'
  | 'mobile'
  | 'api'
  | 'system';

export type CapabilityAutopilotAudience =
  | 'everyday_user'
  | 'technical_operator'
  | 'system';

export type CapabilityTrustLevel = 'protected' | 'collaborator' | 'overlord';

export type CapabilityPermissionScope =
  | 'once'
  | 'session'
  | 'path'
  | 'workspace'
  | 'app'
  | 'host'
  | 'persistent';

export type CapabilityReadinessStatus =
  | 'ready'
  | 'missing'
  | 'degraded'
  | 'blocked'
  | 'unknown';

export type CapabilityReadinessSeverity =
  | 'info'
  | 'warning'
  | 'error'
  | 'critical';

export type CapabilityEvidenceKind =
  | 'capability_registry'
  | 'lifecycle_manifest'
  | 'integration_registry'
  | 'integration_probe'
  | 'doctor'
  | 'executor'
  | 'environment'
  | 'filesystem'
  | 'command'
  | 'permission'
  | 'policy'
  | 'memory'
  | 'user_input'
  | 'manual';

export type CapabilityOperationalHookKind =
  | 'detect'
  | 'diagnose'
  | 'repair'
  | 'validate'
  | 'run'
  | 'fallback';

export type CapabilityOperationalHookOwner =
  | 'capability_registry'
  | 'capability_lifecycle'
  | 'integration_registry'
  | 'integration_installer'
  | 'integration_probe'
  | 'provider_doctor'
  | 'execution_gateway'
  | 'repair_planner'
  | 'permission_service'
  | 'memory_plane'
  | 'surface'
  | 'custom_adapter';

export type CapabilityFailureKind =
  | 'missing_binary'
  | 'missing_dependency'
  | 'missing_secret'
  | 'missing_auth'
  | 'missing_runtime'
  | 'missing_workspace'
  | 'path_not_found'
  | 'permission_required'
  | 'policy_blocked'
  | 'executor_unavailable'
  | 'network_unavailable'
  | 'remote_unhealthy'
  | 'probe_failed'
  | 'validation_failed'
  | 'unknown';

export type CapabilityRepairPlanStatus =
  | 'proposed'
  | 'approval_required'
  | 'approved'
  | 'running'
  | 'validated'
  | 'failed'
  | 'cancelled';

export type CapabilityRepairStepKind =
  | 'explain'
  | 'ask_user'
  | 'install_package'
  | 'install_binary'
  | 'set_env'
  | 'authenticate'
  | 'start_service'
  | 'restart_service'
  | 'run_command'
  | 'change_path'
  | 'switch_executor'
  | 'open_url'
  | 'manual'
  | 'validate'
  | 'resume_original_intent'
  | 'noop';

export type CapabilityReceiptStage =
  | 'intent'
  | 'preflight'
  | 'diagnosis'
  | 'permission'
  | 'repair'
  | 'validation'
  | 'fallback'
  | 'resume'
  | 'completed'
  | 'failed';

export type CapabilityFallbackMode =
  | 'ask_before_switch'
  | 'auto_if_policy_allows'
  | 'disabled';

export type CapabilityEvidence = {
  kind: CapabilityEvidenceKind;
  source: string;
  summary: string;
  detail?: string | null;
  checkedTarget?: string | null;
  status?: string | null;
  timestamp?: string | null;
  metadata?: Record<string, unknown>;
};

export type CapabilityOperationalHook = {
  id: string;
  kind: CapabilityOperationalHookKind;
  owner: CapabilityOperationalHookOwner;
  summary: string;
  command?: string | null;
  optional?: boolean;
  metadata?: Record<string, unknown>;
};

export type CapabilityLifecycleBinding = {
  manifestId: string;
  label: string;
  state: 'declared' | 'dormant' | 'provisioning' | 'ready' | 'active' | 'degraded';
  activationMode: 'builtin' | 'lazy' | 'sidecar';
  approvalRequired: boolean;
  approvalScope: CapabilityPermissionScope | null;
  fallbackBehavior: string;
  provisioningRecipe?: {
    dependencies?: string[];
    commands?: string[];
    notes?: string;
  } | null;
};

export type CapabilityIntegrationBinding = {
  integrationId: string;
  label: string;
  binding: IntegrationBinding;
  manifest?: Pick<
    IntegrationManifest,
    | 'id'
    | 'label'
    | 'supportLevel'
    | 'category'
    | 'defaultMode'
    | 'capabilities'
    | 'requirements'
    | 'installSteps'
    | 'safetyNotes'
  > | null;
};

export type CapabilityExecutorBinding = {
  executorName: string;
  requestedExecutorName?: string | null;
  available: boolean | null;
  source: 'capability_policy' | 'plan' | 'registry' | 'manual' | 'fallback';
  notes?: string[];
};

export type CapabilityOperationalDescriptor = {
  capabilityId: string;
  label: string;
  type: CapabilityType;
  intent: string;
  summary: string;
  source: 'builtin' | 'plugin' | 'integration' | 'runtime' | 'manual';
  command?: string | null;
  tags: string[];
  capability?: Pick<
    CapabilityDefinition,
    | 'id'
    | 'label'
    | 'type'
    | 'intent'
    | 'description'
    | 'dispatch_mode'
    | 'executor_preference'
    | 'requires_planning'
  > | null;
  lifecycle?: CapabilityLifecycleBinding | null;
  integration?: CapabilityIntegrationBinding | null;
  executor?: CapabilityExecutorBinding | null;
  policy?: CapabilityPolicy | null;
  hooks: CapabilityOperationalHook[];
  fallbackMode: CapabilityFallbackMode;
  metadata?: Record<string, unknown>;
};

export type CapabilityCheckedTarget = {
  kind: 'binary' | 'env' | 'api' | 'path' | 'service' | 'docker' | 'mcp' | 'executor' | 'manual';
  label: string;
  value: string | null;
  required: boolean;
  status: CapabilityReadinessStatus;
  detail?: string | null;
};

export type CapabilityReadinessSnapshot = {
  capabilityId: string;
  generatedAt: string;
  status: CapabilityReadinessStatus;
  severity: CapabilityReadinessSeverity;
  ready: boolean;
  safeToRun: boolean;
  summary: string;
  detail: string;
  checkedTargets: CapabilityCheckedTarget[];
  missingRequirements: IntegrationRequirement[];
  blockingReason?: string | null;
  probe?: IntegrationProbeSnapshot | null;
  executor?: CapabilityExecutorBinding | null;
  evidence: CapabilityEvidence[];
  suggestedNextAction?: {
    label: string;
    reason: string;
    repairable: boolean;
  } | null;
  metadata?: Record<string, unknown>;
};

export type CapabilityDiagnosisNarrative = {
  audience: CapabilityAutopilotAudience;
  headline: string;
  explanation: string;
  technicalDetail?: string | null;
};

export type CapabilityDiagnosis = {
  diagnosisId: string;
  capabilityId: string;
  generatedAt: string;
  failureKind: CapabilityFailureKind;
  status: CapabilityReadinessStatus;
  rootCause: string;
  confidence: number;
  repairable: boolean;
  requiresUserInput: boolean;
  narratives: CapabilityDiagnosisNarrative[];
  evidence: CapabilityEvidence[];
  relatedExecution?: Pick<
    ExecutionResult,
    'executor' | 'success' | 'error_code' | 'error_message' | 'stderr'
  > | null;
  metadata?: Record<string, unknown>;
};

export type CapabilityPermissionRequirement = {
  id: string;
  kind: string;
  scope: CapabilityPermissionScope;
  reason: string;
  requestedValue?: string | null;
  resolvedValue?: string | null;
  riskLevel: number;
  trustLevelRequired: CapabilityTrustLevel;
  optional?: boolean;
  metadata?: Record<string, unknown>;
};

export type CapabilityRepairCommand = {
  executor: string;
  command: string;
  cwd?: string | null;
  envKeys?: string[];
  dryRun?: boolean;
  timeoutSeconds?: number | null;
};

export type CapabilityRepairStep = {
  id: string;
  kind: CapabilityRepairStepKind;
  title: string;
  summary: string;
  command?: CapabilityRepairCommand | null;
  installStep?: IntegrationInstallStep | null;
  permissionIds: string[];
  expectedOutcome: string;
  rollbackHint?: string | null;
  optional?: boolean;
  metadata?: Record<string, unknown>;
};

export type CapabilityValidationStep = {
  id: string;
  title: string;
  kind: 'probe' | 'doctor' | 'command' | 'executor_smoke' | 'manual';
  target: string | null;
  command?: CapabilityRepairCommand | null;
  successCondition: string;
  required: boolean;
};

export type CapabilityFallbackOption = {
  id: string;
  label: string;
  executorName?: string | null;
  capabilityId?: string | null;
  reason: string;
  requiresPermission: boolean;
  policyAllowed: boolean | null;
};

export type CapabilityRepairPlan = {
  repairPlanId: string;
  capabilityId: string;
  diagnosisId?: string | null;
  createdAt: string;
  status: CapabilityRepairPlanStatus;
  summary: string;
  riskLevel: number;
  trustLevelRequired: CapabilityTrustLevel;
  permissionRequirements: CapabilityPermissionRequirement[];
  steps: CapabilityRepairStep[];
  validators: CapabilityValidationStep[];
  fallbackOptions: CapabilityFallbackOption[];
  resumeIntent?: OriginalIntentEnvelope | null;
  metadata?: Record<string, unknown>;
};

export type CapabilityRepairRunStatus =
  | 'blocked'
  | 'dry_run'
  | 'completed'
  | 'partial'
  | 'failed';

export type CapabilityRepairRunStepStatus =
  | 'blocked'
  | 'skipped'
  | 'dry_run'
  | 'succeeded'
  | 'failed';

export type CapabilityRepairRunStepResult = {
  stepId: string;
  kind: CapabilityRepairStepKind;
  title: string;
  status: CapabilityRepairRunStepStatus;
  startedAt: string;
  finishedAt: string;
  summary: string;
  detail?: string | null;
  permissionIds: string[];
  command?: CapabilityRepairCommand | null;
  evidence?: CapabilityEvidence[];
  metadata?: Record<string, unknown>;
};

export type CapabilityRepairRunResult = {
  repairRunId: string;
  repairPlanId: string;
  capabilityId: string;
  startedAt: string;
  finishedAt: string;
  status: CapabilityRepairRunStatus;
  dryRun: boolean;
  approved: boolean;
  permissionStatus: 'not_required' | 'missing' | 'pending' | 'approved' | 'rejected';
  steps: CapabilityRepairRunStepResult[];
  validationRequired: boolean;
  resumeIntent?: OriginalIntentEnvelope | null;
  metadata?: Record<string, unknown>;
};

export type OriginalIntentEnvelope = {
  intentId: string;
  createdAt: string;
  surface: CapabilityAutopilotSurface;
  audience: CapabilityAutopilotAudience;
  userId?: string | null;
  sessionId?: string | null;
  taskId?: string | null;
  rawText: string;
  normalizedText: string;
  commandType?: string | null;
  requestedCapabilityId?: string | null;
  requestedExecutorName?: string | null;
  workspace?: string | null;
  task?: Pick<
    Task,
    | 'task_id'
    | 'source'
    | 'command_type'
    | 'intent'
    | 'workspace'
    | 'risk_level'
    | 'requires_approval'
  > | null;
  plan?: Pick<
    Plan,
    | 'plan_id'
    | 'objective'
    | 'executor_recommendation'
    | 'workspace_recommendation'
    | 'risk_level'
    | 'requires_approval'
  > | null;
  executionRequest?: Pick<
    ExecutionRequest,
    'executor' | 'workspace' | 'objective' | 'instructions' | 'metadata'
  > | null;
  metadata?: Record<string, unknown>;
};

export type CapabilityValidationResult = {
  capabilityId: string;
  generatedAt: string;
  success: boolean;
  summary: string;
  results: Array<{
    validationStepId: string;
    status: 'passed' | 'failed' | 'skipped';
    detail: string;
    evidence?: CapabilityEvidence[];
  }>;
  readiness?: CapabilityReadinessSnapshot | null;
};

export type CapabilityReceiptTimelineEntry = {
  at: string;
  phase: CapabilityReceiptStage;
  status: 'pending' | 'running' | 'completed' | 'blocked' | 'failed' | 'skipped';
  summary: string;
  detail?: string | null;
};

export type CapabilityReceipt = {
  receiptId: string;
  generatedAt: string;
  phase: CapabilityReceiptStage;
  surface: CapabilityAutopilotSurface;
  audience: CapabilityAutopilotAudience;
  capabilityId: string;
  capabilityLabel: string;
  headline: string;
  userSummary: string;
  technicalSummary: string;
  trustLevel: CapabilityTrustLevel;
  readiness?: CapabilityReadinessSnapshot | null;
  diagnosis?: CapabilityDiagnosis | null;
  repairPlan?: CapabilityRepairPlan | null;
  validation?: CapabilityValidationResult | null;
  selectedFallback?: CapabilityFallbackOption | null;
  resumeIntent?: OriginalIntentEnvelope | null;
  timeline: CapabilityReceiptTimelineEntry[];
  metadata?: Record<string, unknown>;
};

export type CapabilitySurfaceUxActionKind =
  | 'approve_permission'
  | 'reject_permission'
  | 'view_plan'
  | 'view_details'
  | 'run_validation'
  | 'choose_fallback'
  | 'resume_intent'
  | 'open_docs';

export type CapabilitySurfaceUxAction = {
  id: string;
  kind: CapabilitySurfaceUxActionKind;
  label: string;
  description: string;
  requiresExplicitUserAction: boolean;
  enabled: boolean;
  command?: string | null;
  route?: string | null;
  callbackData?: string | null;
  metadata?: Record<string, unknown>;
};

export type CapabilitySurfaceUxPayload = {
  generatedAt: string;
  surface: CapabilityAutopilotSurface;
  audience: CapabilityAutopilotAudience;
  capabilityId: string;
  capabilityLabel: string;
  phase: CapabilityReceiptStage;
  tone: 'neutral' | 'attention' | 'blocked' | 'success';
  headline: string;
  body: string;
  technicalBody?: string | null;
  permissionSummary?: string | null;
  fallbackSummary?: string | null;
  timelineSummary: string[];
  actions: CapabilitySurfaceUxAction[];
  receipt: CapabilityReceipt;
  metadata?: Record<string, unknown>;
};

export type CapabilityMemoryOutcome =
  | 'ready'
  | 'permission_required'
  | 'needs_repair'
  | 'fallback_selected'
  | 'failed';

export type CapabilityMemorySignal = {
  id: string;
  kind: 'readiness' | 'diagnosis' | 'permission' | 'repair' | 'validation' | 'surface' | 'fallback';
  summary: string;
  weight: number;
  metadata?: Record<string, unknown>;
};

export type CapabilityMemoryRecord = {
  memoryId: string;
  generatedAt: string;
  capabilityId: string;
  capabilityLabel: string;
  workspaceHash: string | null;
  intentFingerprint: string | null;
  outcome: CapabilityMemoryOutcome;
  phase: CapabilityReceiptStage;
  failureKind?: CapabilityFailureKind | null;
  readinessStatus?: CapabilityReadinessStatus | null;
  permissionCount: number;
  fallbackCount: number;
  signals: CapabilityMemorySignal[];
  lesson: string;
  replayable: boolean;
  privacy: {
    rawIntentStored: false;
    rawWorkspaceStored: false;
    redacted: true;
  };
  source: {
    receiptId: string;
    repairPlanId?: string | null;
    validationGeneratedAt?: string | null;
  };
  metadata?: Record<string, unknown>;
};

export type CapabilityReplayFrame = {
  replayId: string;
  generatedAt: string;
  capabilityId: string;
  outcome: CapabilityMemoryOutcome;
  replayable: boolean;
  recommendedNextAction: string;
  safeSummary: string;
  signals: CapabilityMemorySignal[];
  sourceMemoryId: string;
};
