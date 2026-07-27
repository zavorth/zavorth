import type { ZavorthCrossSurfaceProjectionSurface } from '../ZavorthCrossSurfaceRuntimeProjectionContract.js';

export const ZAVORTH_SCHEDULED_TASK_CONTRACT_VERSION =
  '2026-05-12.governed-scheduled-task-gate-1' as const;

export const ZAVORTH_SCHEDULED_TASK_APPROVAL_TOOL =
  'zavorth.scheduled-task.scope' as const;

export type ZavorthScheduledTaskStatus =
  | 'active'
  | 'paused'
  | 'expired'
  | 'revoked'
  | 'needs_reapproval'
  | 'blocked';

export type ZavorthScheduledTaskScheduleKind =
  | 'interval_minutes'
  | 'interval_hours'
  | 'daily'
  | 'weekly'
  | 'cron';

export type ZavorthScheduledTaskRenewalPolicy =
  | 'require_reapproval'
  | 'expire_and_notify'
  | 'auto_renew_disabled';

export type ZavorthScheduledTaskApprovalEnvelope = {
  kind: 'tool-security-approval';
  version: 1;
  approved: true;
  toolName: string;
  argsHash: string;
  issuedAt: string;
  expiresAt: string | null;
  approvalId: string | null;
  approvedBy: string | null;
  signature: string;
};

export type ZavorthScheduledTaskApprovalVerification = {
  ok: boolean;
  reason: string;
};

export type ZavorthScheduledTaskBudget = {
  maxRuntimeMs: number;
  maxTokens: number;
  maxToolCalls: number;
  maxNetworkRequests: number;
  maxCommands: number;
  maxMutations: number;
  maxRetries: number;
};

export type ZavorthScheduledTaskScope = {
  intent: string;
  command: string;
  workspace: string;
  surface: ZavorthCrossSurfaceProjectionSurface;
  createdBy: string;
  allowedTools: string[];
  maxMutations: number;
  maxCommands: number;
  maxNetworkRequests: number;
  maxTokens: number;
};

export type ZavorthScheduledTaskInput = {
  intent?: string | null;
  command?: string | null;
  schedule?: string | null;
  workspace?: string | null;
  surface?: ZavorthCrossSurfaceProjectionSurface | null;
  createdBy?: string | null;
  allowedTools?: string[] | null;
  budget?: Partial<ZavorthScheduledTaskBudget> | null;
  approval?: {
    ownerConfirmed?: boolean | null;
    approvalId?: string | null;
    approvedBy?: string | null;
    ttlMs?: number | null;
    envelope?: ZavorthScheduledTaskApprovalEnvelope | null;
  } | null;
  policy?: {
    requireApproval?: boolean | null;
    killSwitchEnabled?: boolean | null;
    noCompound?: boolean | null;
    renewalPolicy?: ZavorthScheduledTaskRenewalPolicy | null;
  } | null;
};

export type ZavorthScheduledTaskSchedule = {
  raw: string;
  normalized: string;
  kind: ZavorthScheduledTaskScheduleKind;
  intervalMs: number;
  localTime: string | null;
  nextRunPreview: string;
};

export type ZavorthScheduledTaskCheck = {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  kind:
    | 'schedule-parse'
    | 'scope-boundary'
    | 'approval-envelope'
    | 'budget-boundary'
    | 'no-compound'
    | 'kill-switch'
    | 'scheduler-adapter'
    | 'no-execution';
  summary: string;
  recommendation: string | null;
};

export type ZavorthScheduledTaskReceipt = {
  id: string;
  kind:
    | 'gate-1-governed-scheduled-task-contract'
    | 'scope-envelope'
    | 'registration-preview'
    | 'policy-boundary'
    | 'no-compound-boundary'
    | 'budget-boundary'
    | 'scheduler-adapter'
    | 'execution-boundary';
  status: 'recorded' | 'ready' | 'requires-approval' | 'blocked' | 'skipped';
  summary: string;
};

export type ZavorthScheduledTaskRegistrationPlan = {
  recorded: boolean;
  schedulerServiceCompatible: boolean;
  schedulerCommand: string;
  schedulerSchedule: string;
  schedulerUserId: string;
  schedulerOptions: {
    intentText: string;
    delivery: 'telegram' | 'web' | 'cli' | 'api' | null;
    budget: {
      maxRuntimeMs: number;
      retries: number;
      maxConcurrentRuns: 1;
      maxPerTaskConcurrentRuns: 1;
    };
  };
  executionPerformed: false;
  persistedToScheduler: false;
  nextAction: 'gate-2-execution-gateway-integration';
};

export type ZavorthScheduledTaskSafety = {
  preApprovedScopeOnly: true;
  noCompoundScheduling: true;
  globalKillSwitchHonored: true;
  approvalTtlRequired: true;
  budgetBoundariesRequired: true;
  noImplicitExecution: true;
  noZavorthControlVisualMutation: true;
  rawSecretsSerialized: false;
};

export type ZavorthScheduledTaskSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SCHEDULED_TASK_CONTRACT_VERSION;
  source: 'ZavorthGovernedScheduledTaskRegistryService';
  gate: 'governed-scheduled-task-contract';
  status: ZavorthScheduledTaskStatus;
  schedule: ZavorthScheduledTaskSchedule | null;
  scope: ZavorthScheduledTaskScope;
  budget: ZavorthScheduledTaskBudget;
  renewalPolicy: ZavorthScheduledTaskRenewalPolicy;
  approvalEnvelope: ZavorthScheduledTaskApprovalEnvelope | null;
  approvalVerification: ZavorthScheduledTaskApprovalVerification;
  checks: ZavorthScheduledTaskCheck[];
  registration: ZavorthScheduledTaskRegistrationPlan;
  receipts: ZavorthScheduledTaskReceipt[];
  safety: ZavorthScheduledTaskSafety;
  summary: {
    checks: number;
    passedChecks: number;
    warningChecks: number;
    failedChecks: number;
    approvalVerified: boolean;
    registrationReady: boolean;
    blockedByKillSwitch: boolean;
    blockedByNoCompound: boolean;
    expiredApproval: boolean;
    executionPerformed: false;
  };
  commands: {
    report: 'npx tsx scripts/zavorth-governed-scheduled-tasks.ts';
    json: 'npx tsx scripts/zavorth-governed-scheduled-tasks.ts --json';
    approvedPreview: 'npx tsx scripts/zavorth-governed-scheduled-tasks.ts --json --owner-confirmed --approval=schedule-owner-ok';
    check: 'node scripts/zavorth-governed-scheduled-tasks-check.mjs';
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
