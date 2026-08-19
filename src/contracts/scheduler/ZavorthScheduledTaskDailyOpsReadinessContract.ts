import type { ZavorthScheduledTaskLiveTickCertificationSnapshot } from './ZavorthScheduledTaskLiveTickCertificationContract.js';

export const ZAVORTH_SCHEDULED_TASK_DAILY_OPS_READINESS_CONTRACT_VERSION =
  '2026-05-12.scheduled-task-daily-ops-readiness-gate-7' as const;

export type ZavorthScheduledTaskDailyOpsReadinessStatus =
  | 'ready'
  | 'attention'
  | 'blocked';

export type ZavorthScheduledTaskDailyOpsReadinessGateKind =
  | 'live-tick-certification'
  | 'surface-command-coverage'
  | 'lifecycle-command-coverage'
  | 'host-task-readiness'
  | 'no-zavorthControl-visual-mutation'
  | 'no-direct-dispatch';

export type ZavorthScheduledTaskDailyOpsReadinessGate = {
  id: string;
  kind: ZavorthScheduledTaskDailyOpsReadinessGateKind;
  status: 'pass' | 'warn' | 'fail';
  summary: string;
  recommendation: string | null;
};

export type ZavorthScheduledTaskDailyOpsReadinessSurface =
  | 'shared_surface'
  | 'telegram'
  | 'automation_control_plane'
  | 'cli'
  | 'dashboard_projection';

export type ZavorthScheduledTaskDailyOpsReadinessSurfaceCommand = {
  surface: ZavorthScheduledTaskDailyOpsReadinessSurface;
  command: string;
  status: 'ready' | 'projection_only';
  summary: string;
};

export type ZavorthScheduledTaskDailyOpsReadinessReceipt = {
  id: string;
  kind:
    | 'gate-7-scheduled-task-daily-ops-readiness'
    | 'gate-6-live-tick-consumed'
    | 'surface-commands-certified'
    | 'operator-runbook'
    | 'no-visual-mutation'
    | 'no-direct-dispatch';
  status: 'recorded' | 'ready' | 'attention' | 'blocked';
  summary: string;
};

export type ZavorthScheduledTaskDailyOpsReadinessInput = {
  taskId?: string | null;
  includeHostTask?: boolean | null;
  now?: string | null;
};

export type ZavorthScheduledTaskDailyOpsReadinessSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SCHEDULED_TASK_DAILY_OPS_READINESS_CONTRACT_VERSION;
  source: 'ZavorthScheduledTaskDailyOpsReadinessService';
  gate: 'scheduled-task-daily-ops-readiness';
  status: ZavorthScheduledTaskDailyOpsReadinessStatus;
  liveTickCertification: ZavorthScheduledTaskLiveTickCertificationSnapshot;
  hostTaskCertification: ZavorthScheduledTaskLiveTickCertificationSnapshot | null;
  gates: ZavorthScheduledTaskDailyOpsReadinessGate[];
  surfaces: ZavorthScheduledTaskDailyOpsReadinessSurfaceCommand[];
  runbook: {
    create: string;
    list: string;
    pause: string;
    resume: string;
    reapprove: string;
    revoke: string;
    certify: string;
  };
  summary: {
    gates: number;
    passedGates: number;
    warningGates: number;
    failedGates: number;
    surfaces: number;
    readySurfaces: number;
    dailyUseReady: boolean;
    hostTaskChecked: boolean;
  };
  receipts: ZavorthScheduledTaskDailyOpsReadinessReceipt[];
  safety: {
    consumesStage6LiveTickCertification: true;
    allUserActionsGoThroughGovernedSurfaces: true;
    hostTaskCertificationIsExplicit: true;
    noDashboardVisualMutation: true;
    noDirectDispatcherBypass: true;
    rawSecretsSerialized: false;
  };
  commands: {
    report: 'npx tsx scripts/zavorth-scheduled-task-daily-ops-readiness.ts';
    json: 'npx tsx scripts/zavorth-scheduled-task-daily-ops-readiness.ts --json';
    hostTask: 'npx tsx scripts/zavorth-scheduled-task-daily-ops-readiness.ts --json --task=<id>';
    check: 'node scripts/zavorth-scheduled-task-daily-ops-readiness-check.mjs';
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
