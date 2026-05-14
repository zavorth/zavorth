import type { ScheduledTask } from '../storage/SchedulerRepository.js';
import type { ZavorthScheduledTaskOperationalGuardSnapshot } from './ZavorthScheduledTaskOperationalGuardContract.js';
import type { ZavorthScheduledTaskRuntimeSnapshot } from './ZavorthScheduledTaskRuntimeContract.js';

export const ZAVORTH_SCHEDULED_TASK_LIVE_TICK_CERTIFICATION_CONTRACT_VERSION =
  '2026-05-12.scheduled-task-live-tick-certification-phase-6' as const;

export type ZavorthScheduledTaskLiveTickCertificationStatus =
  | 'passed'
  | 'attention'
  | 'blocked'
  | 'failed';

export type ZavorthScheduledTaskLiveTickScenarioId =
  | 'valid_gateway_submit'
  | 'expired_approval_block'
  | 'scope_drift_block'
  | 'legacy_task_block'
  | 'failure_auto_pause_block'
  | 'host_task';

export type ZavorthScheduledTaskLiveTickScenarioStatus =
  | 'passed'
  | 'blocked'
  | 'auto_paused'
  | 'failed';

export type ZavorthScheduledTaskLiveTickBlockReason =
  | 'none'
  | 'legacy_task'
  | 'approval_expired'
  | 'approval_expiring'
  | 'auto_pause_required'
  | 'task_paused'
  | 'scope_drift'
  | 'missing_task'
  | 'runtime_not_ready'
  | 'gateway_rejected';

export type ZavorthScheduledTaskLiveTickScenario = {
  id: ZavorthScheduledTaskLiveTickScenarioId;
  label: string;
  status: ZavorthScheduledTaskLiveTickScenarioStatus;
  expectedBehaviorObserved: boolean;
  taskId: string | null;
  taskStatus: ScheduledTask['status'] | null;
  blockReason: ZavorthScheduledTaskLiveTickBlockReason;
  gatewayCalled: boolean;
  gatewayAllowed: boolean;
  executionPerformed: boolean;
  runtimeStatus: string | null;
  operationalStatus: string | null;
  scopeInvariant: boolean;
  autoPauseApplied: boolean;
  receiptIds: string[];
  summary: string;
};

export type ZavorthScheduledTaskLiveTickReceipt = {
  id: string;
  kind:
    | 'phase-6-scheduled-task-live-tick-certification'
    | 'operational-guard-consumed'
    | 'scope-drift-check'
    | 'execution-gateway-submit'
    | 'blocked-before-gateway'
    | 'auto-pause-applied'
    | 'no-direct-dispatch';
  status: 'recorded' | 'passed' | 'blocked' | 'applied' | 'failed';
  summary: string;
};

export type ZavorthScheduledTaskLiveTickCertificationInput = {
  scenario?: ZavorthScheduledTaskLiveTickScenarioId | 'all' | null;
  taskId?: string | null;
  dryRun?: boolean | null;
  applyAutoPause?: boolean | null;
  now?: string | null;
};

export type ZavorthScheduledTaskLiveTickCertificationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SCHEDULED_TASK_LIVE_TICK_CERTIFICATION_CONTRACT_VERSION;
  source: 'ZavorthScheduledTaskLiveTickCertificationService';
  phase: 'phase-6-scheduler-live-tick-certification';
  status: ZavorthScheduledTaskLiveTickCertificationStatus;
  summary: {
    scenarios: number;
    passedScenarios: number;
    blockedBeforeGateway: number;
    gatewaySubmitted: number;
    executionPerformed: number;
    autoPaused: number;
    hostTasksCertified: number;
  };
  guard: ZavorthScheduledTaskOperationalGuardSnapshot;
  scenarios: ZavorthScheduledTaskLiveTickScenario[];
  runtimeSnapshots: Array<{
    scenarioId: ZavorthScheduledTaskLiveTickScenarioId;
    status: string;
    gatewayCalled: boolean;
    executionPerformed: boolean;
    runtime: ZavorthScheduledTaskRuntimeSnapshot;
  }>;
  receipts: ZavorthScheduledTaskLiveTickReceipt[];
  safety: {
    consumesPersistedGovernedMetadata: true;
    appliesOperationalGuardBeforeGateway: true;
    validatesApprovalOnTick: true;
    blocksExpiredApproval: true;
    blocksScopeDrift: true;
    routesThroughExecutionGateway: true;
    noDirectDispatcherBypass: true;
    fixtureHasNoExternalIo: true;
    rawSecretsSerialized: false;
  };
  commands: {
    report: 'npx tsx scripts/zavorth-scheduled-task-live-tick-certification.ts';
    json: 'npx tsx scripts/zavorth-scheduled-task-live-tick-certification.ts --json';
    hostTask: 'npx tsx scripts/zavorth-scheduled-task-live-tick-certification.ts --json --task=<id>';
    check: 'node scripts/zavorth-scheduled-task-live-tick-certification-check.mjs';
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
