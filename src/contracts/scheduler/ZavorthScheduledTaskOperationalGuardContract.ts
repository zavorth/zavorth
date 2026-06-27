import type { ZavorthCrossSurfaceProjectionSurface } from '../ZavorthCrossSurfaceRuntimeProjectionContract.js';

export const ZAVORTH_SCHEDULED_TASK_OPERATIONAL_GUARD_CONTRACT_VERSION =
  '2026-05-12.scheduled-task-operational-guard-checkpoint-5' as const;

export type ZavorthScheduledTaskOperationalGuardStatus =
  | 'healthy'
  | 'attention'
  | 'critical';

export type ZavorthScheduledTaskOperationalTaskStatus =
  | 'healthy'
  | 'legacy'
  | 'approval_expiring'
  | 'approval_expired'
  | 'auto_pause_recommended'
  | 'auto_paused';

export type ZavorthScheduledTaskOperationalGuardInput = {
  applyAutoPause?: boolean | null;
  requestedBy?: string | null;
  surface?: ZavorthCrossSurfaceProjectionSurface | null;
  approvalExpiryWarningMs?: number | null;
};

export type ZavorthScheduledTaskOperationalGuardTask = {
  id: string;
  shortId: string;
  command: string;
  schedule: string;
  status: string;
  operationalStatus: ZavorthScheduledTaskOperationalTaskStatus;
  governed: boolean;
  approvalId: string | null;
  approvalExpiresAt: string | null;
  approvalExpired: boolean;
  approvalExpiringSoon: boolean;
  consecutiveFailures: number;
  autoPauseThreshold: number;
  pausedReason: string | null;
  recommendedCommand: string | null;
  detail: string;
};

export type ZavorthScheduledTaskOperationalGuardReceipt = {
  id: string;
  kind:
    | 'checkpoint-5-scheduled-task-operational-guard'
    | 'approval-expiry-check'
    | 'auto-pause-check'
    | 'auto-pause-applied'
    | 'legacy-task-detected'
    | 'no-workload-execution';
  status: 'recorded' | 'recommended' | 'applied' | 'blocked';
  summary: string;
};

export type ZavorthScheduledTaskOperationalGuardSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SCHEDULED_TASK_OPERATIONAL_GUARD_CONTRACT_VERSION;
  source: 'ZavorthScheduledTaskOperationalGuardService';
  phase: 'checkpoint-5-renewal-expiry-auto-pause';
  status: ZavorthScheduledTaskOperationalGuardStatus;
  summary: {
    totalTasks: number;
    governedTasks: number;
    legacyTasks: number;
    approvalExpiredTasks: number;
    approvalExpiringTasks: number;
    autoPauseRecommendedTasks: number;
    autoPausedTasks: number;
    workloadExecutionPerformed: false;
  };
  tasks: ZavorthScheduledTaskOperationalGuardTask[];
  receipts: ZavorthScheduledTaskOperationalGuardReceipt[];
  safety: {
    noWorkloadExecution: true;
    onlySchedulerLifecycleMutation: true;
    explicitApplyRequiredForAutoPause: true;
    reapprovalUsesSurfaceLifecycle: true;
    rawSecretsSerialized: false;
  };
  commands: {
    report: 'node scripts/zavorth-scheduled-task-operational-guard-check.mjs';
    reapprove: '/automations reapprove <id>';
    pause: '/automations pause <id>';
    applyAutoPause: 'npx tsx scripts/zavorth-scheduled-task-operational-guard.ts --apply-auto-pause';
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
