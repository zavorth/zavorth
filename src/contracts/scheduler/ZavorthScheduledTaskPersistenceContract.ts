import type { ZavorthScheduledTaskRuntimeSnapshot } from './ZavorthScheduledTaskRuntimeContract.js';
import type { ZavorthScheduledTaskInput } from './ZavorthScheduledTaskContract.js';

export const ZAVORTH_SCHEDULED_TASK_PERSISTENCE_CONTRACT_VERSION =
  '2026-05-12.persisted-scheduled-task-registration-gate-3' as const;

export type ZavorthScheduledTaskPersistenceAction =
  | 'preview'
  | 'register'
  | 'pause'
  | 'resume'
  | 'revoke'
  | 'reapprove';

export type ZavorthScheduledTaskPersistenceStatus =
  | 'preview_ready'
  | 'persisted'
  | 'paused'
  | 'resumed'
  | 'revoked'
  | 'reapproved'
  | 'needs_reapproval'
  | 'expired'
  | 'blocked'
  | 'scheduler_unavailable';

export type ZavorthScheduledTaskPersistenceInput = {
  action?: ZavorthScheduledTaskPersistenceAction | null;
  taskId?: string | null;
  scheduledTask?: ZavorthScheduledTaskInput | null;
  scheduler?: {
    delivery?: 'telegram' | 'app' | 'email' | 'webhook' | null;
    deliveryTarget?: string | null;
  } | null;
};

export type ZavorthPersistedScheduledTask = {
  id: string;
  command: string;
  schedule: string;
  created_at: string;
  last_run: string | null;
  next_run: string | null;
  created_by: string | null;
  status: 'active' | 'paused';
  intent_text?: string | null;
  delivery?: string | null;
  delivery_target?: string | null;
  budget_json?: string | null;
  guardrail_json?: string | null;
};

export type ZavorthPersistedScheduledTaskGovernedMetadata = {
  contractVersion: string;
  gate: 'persisted-scheduled-task-registration';
  registryStatus: string;
  approvalId: string | null;
  approvalExpiresAt: string | null;
  approvalVerificationReason: string;
  approvedScopeHash: string;
  approvedScope: {
    intent: string;
    command: string;
    workspace: string;
    surface: string;
    createdBy: string;
    allowedTools: string[];
  };
  approvedBudget: {
    maxRuntimeMs: number;
    maxTokens: number;
    maxToolCalls: number;
    maxNetworkRequests: number;
    maxCommands: number;
    maxMutations: number;
    maxRetries: number;
  };
  renewalPolicy: string;
  receipts: Array<{
    id: string;
    kind: string;
    status: string;
  }>;
  persistedAt: string;
  executionGatewayRequired: true;
  noDirectToolDispatch: true;
};

export type ZavorthScheduledTaskPersistenceCheck = {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  kind:
    | 'runtime-ready'
    | 'scheduler-available'
    | 'action-supported'
    | 'task-found'
    | 'governed-metadata'
    | 'approval-fresh'
    | 'persistence'
    | 'no-direct-execution';
  summary: string;
  recommendation: string | null;
};

export type ZavorthScheduledTaskPersistenceReceipt = {
  id: string;
  kind:
    | 'gate-3-persisted-scheduled-task-registration'
    | 'runtime-consumed'
    | 'scheduler-task-created'
    | 'scheduler-task-paused'
    | 'scheduler-task-resumed'
    | 'scheduler-task-revoked'
    | 'scheduler-task-reapproved'
    | 'metadata-boundary'
    | 'execution-boundary';
  status: 'recorded' | 'persisted' | 'blocked' | 'skipped';
  summary: string;
};

export type ZavorthScheduledTaskPersistenceSafety = {
  persistsOnlyStage2ReadyRuntime: true;
  storesGovernedScopeInGuardrails: true;
  storesBudgetsInSchedulerMetadata: true;
  pauseResumeRevokeUseSchedulerService: true;
  reapprovalDoesNotChangeCommandOrSchedule: true;
  noDirectExecutionDuringRegistration: true;
  rawSecretsSerialized: false;
};

export type ZavorthScheduledTaskPersistenceSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SCHEDULED_TASK_PERSISTENCE_CONTRACT_VERSION;
  source: 'ZavorthScheduledTaskPersistenceService';
  gate: 'persisted-scheduled-task-registration';
  status: ZavorthScheduledTaskPersistenceStatus;
  action: ZavorthScheduledTaskPersistenceAction;
  runtime: ZavorthScheduledTaskRuntimeSnapshot;
  task: ZavorthPersistedScheduledTask | null;
  governedMetadata: ZavorthPersistedScheduledTaskGovernedMetadata | null;
  checks: ZavorthScheduledTaskPersistenceCheck[];
  receipts: ZavorthScheduledTaskPersistenceReceipt[];
  safety: ZavorthScheduledTaskPersistenceSafety;
  summary: {
    schedulerAvailable: boolean;
    runtimeReady: boolean;
    taskPersisted: boolean;
    taskGoverned: boolean;
    approvalFresh: boolean;
    executionPerformed: false;
  };
  commands: {
    report: 'npx tsx scripts/zavorth-scheduled-task-persistence.ts';
    json: 'npx tsx scripts/zavorth-scheduled-task-persistence.ts --json';
    register: 'npx tsx scripts/zavorth-scheduled-task-persistence.ts --json --action=register --owner-confirmed --approval=schedule-owner-ok';
    check: 'node scripts/zavorth-scheduled-task-persistence-check.mjs';
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
