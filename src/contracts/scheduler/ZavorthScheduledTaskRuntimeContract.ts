import type { Plan } from '../PlanContract.js';
import type { Task } from '../TaskContract.js';
import type {
  ZavorthScheduledTaskInput,
  ZavorthScheduledTaskSnapshot,
} from './ZavorthScheduledTaskContract.js';

export const ZAVORTH_SCHEDULED_TASK_RUNTIME_CONTRACT_VERSION =
  '2026-05-12.scheduled-task-execution-gateway-checkpoint-2' as const;

export type ZavorthScheduledTaskRuntimeStatus =
  | 'ready'
  | 'not_due'
  | 'dry_run_submitted'
  | 'submitted'
  | 'completed'
  | 'gateway_blocked'
  | 'gateway_failed'
  | 'gateway_unavailable'
  | 'needs_reapproval'
  | 'expired'
  | 'blocked';

export type ZavorthScheduledTaskRuntimeMode =
  | 'hold'
  | 'not-due'
  | 'gateway-dry-run'
  | 'gateway-live'
  | 'gateway-block';

export type ZavorthScheduledTaskRuntimeInput = {
  scheduledTask?: ZavorthScheduledTaskInput | null;
  tick?: {
    taskId?: string | null;
    due?: boolean | null;
    submit?: boolean | null;
    dryRun?: boolean | null;
    killSwitchEnabled?: boolean | null;
    executor?: string | null;
    scopeOverride?: {
      command?: string | null;
      workspace?: string | null;
      schedule?: string | null;
    } | null;
  } | null;
};

export type ZavorthScheduledTaskGatewayDecisionSummary = {
  called: boolean;
  dryRun: boolean;
  allowed: boolean;
  requiresConfirmation: boolean;
  reason: string | null;
  traceId: string | null;
  executionSuccess: boolean | null;
  executionId: string | null;
  executor: string | null;
  rawDecisionSerialized: false;
};

export type ZavorthScheduledTaskRuntimeCheck = {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  kind:
    | 'registry-active'
    | 'due-window'
    | 'submit-request'
    | 'scope-envelope-fresh'
    | 'scope-invariance'
    | 'kill-switch'
    | 'budget-boundary'
    | 'execution-gateway'
    | 'no-direct-dispatch';
  summary: string;
  recommendation: string | null;
};

export type ZavorthScheduledTaskRuntimeReceipt = {
  id: string;
  kind:
    | 'checkpoint-2-scheduled-task-execution-gateway'
    | 'registry-consumed'
    | 'scope-revalidated'
    | 'gateway-submit'
    | 'gateway-result'
    | 'scope-invariance'
    | 'execution-boundary';
  status: 'recorded' | 'submitted' | 'blocked' | 'skipped' | 'failed';
  summary: string;
};

export type ZavorthScheduledTaskRuntimeSafety = {
  consumesStage1Registry: true;
  validatesEnvelopeOnEveryTick: true;
  preservesApprovedScope: true;
  usesExecutionGatewaySubmit: true;
  noDirectToolDispatch: true;
  dryRunIsDefaultWithoutHostGateway: true;
  killSwitchHonoredOnEveryTick: true;
  rawSecretsSerialized: false;
};

export type ZavorthScheduledTaskRuntimeSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SCHEDULED_TASK_RUNTIME_CONTRACT_VERSION;
  source: 'ZavorthScheduledTaskExecutionGatewayRuntimeService';
  gate: 'scheduled-task-execution-gateway';
  status: ZavorthScheduledTaskRuntimeStatus;
  mode: ZavorthScheduledTaskRuntimeMode;
  registry: ZavorthScheduledTaskSnapshot;
  task: Task;
  plan: Plan;
  gatewayDecision: ZavorthScheduledTaskGatewayDecisionSummary;
  checks: ZavorthScheduledTaskRuntimeCheck[];
  receipts: ZavorthScheduledTaskRuntimeReceipt[];
  safety: ZavorthScheduledTaskRuntimeSafety;
  summary: {
    registryActive: boolean;
    due: boolean;
    submitRequested: boolean;
    dryRun: boolean;
    scopeInvariant: boolean;
    gatewayCalled: boolean;
    gatewayAllowed: boolean;
    executionPerformed: boolean;
    blockedByKillSwitch: boolean;
  };
  commands: {
    report: 'npx tsx scripts/zavorth-scheduled-task-runtime.ts';
    json: 'npx tsx scripts/zavorth-scheduled-task-runtime.ts --json';
    submitDryRun: 'npx tsx scripts/zavorth-scheduled-task-runtime.ts --json --owner-confirmed --approval=schedule-owner-ok --submit';
    check: 'node scripts/zavorth-scheduled-task-runtime-check.mjs';
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
