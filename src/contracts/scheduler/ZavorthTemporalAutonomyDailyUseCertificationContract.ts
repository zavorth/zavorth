import type { ChannelCapabilitySnapshot } from '../ChannelCapabilityContract.js';
import type { ZavorthContextRecoverySnapshot } from '../ZavorthContextRecoveryAssimilationContract.js';
import type { ZavorthScheduledTaskSnapshot } from './ZavorthScheduledTaskContract.js';
import type { ZavorthScheduledTaskDailyOpsReadinessSnapshot } from './ZavorthScheduledTaskDailyOpsReadinessContract.js';
import type { ZavorthScheduledTaskLiveTickCertificationSnapshot } from './ZavorthScheduledTaskLiveTickCertificationContract.js';

export const ZAVORTH_TEMPORAL_AUTONOMY_DAILY_USE_CERTIFICATION_CONTRACT_VERSION =
  '2026-05-12.temporal-autonomy-daily-use-certification-checkpoint-8' as const;

export type ZavorthTemporalAutonomyDailyUseCertificationStatus =
  | 'certified'
  | 'attention'
  | 'blocked';

export type ZavorthTemporalAutonomyDailyUseMatrixArea =
  | 'scheduled_tasks'
  | 'approvals'
  | 'rollback'
  | 'acp_bridge'
  | 'mcp_governance'
  | 'channel_ux'
  | 'agentrun_resilience';

export type ZavorthTemporalAutonomyDailyUseAbuseScenarioId =
  | 'cron_permission_escalation'
  | 'cron_creates_cron'
  | 'expired_approval'
  | 'acp_bypass'
  | 'channel_without_button_fallback';

export type ZavorthTemporalAutonomyDailyUseMatrixEntry = {
  area: ZavorthTemporalAutonomyDailyUseMatrixArea;
  status: 'pass' | 'warn' | 'fail';
  summary: string;
  evidence: string[];
  recommendation: string | null;
};

export type ZavorthTemporalAutonomyDailyUseAbuseScenario = {
  id: ZavorthTemporalAutonomyDailyUseAbuseScenarioId;
  status: 'passed' | 'blocked' | 'failed';
  blocked: boolean;
  gatewayCalled: boolean;
  executionPerformed: boolean;
  receiptIds: string[];
  policySurface:
    | 'scheduler'
    | 'approval'
    | 'agent-runtime-bridge'
    | 'channel-renderer';
  summary: string;
};

export type ZavorthTemporalAutonomyDailyUseReceipt = {
  id: string;
  kind:
    | 'gate-8-daily-use-certification'
    | 'scheduled-task-certification-consumed'
    | 'channel-capability-consumed'
    | 'abuse-scenario'
    | 'consistency-matrix'
    | 'no-zavorthControl-visual-mutation';
  status: 'recorded' | 'passed' | 'attention' | 'blocked';
  summary: string;
};

export type ZavorthTemporalAutonomyDailyUseCertificationInput = {
  now?: string | null;
  taskId?: string | null;
};

export type ZavorthTemporalAutonomyDailyUseCertificationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_TEMPORAL_AUTONOMY_DAILY_USE_CERTIFICATION_CONTRACT_VERSION;
  source: 'ZavorthTemporalAutonomyDailyUseCertificationService';
  gate: 'checkpoint-8-certification-and-daily-use-gate';
  status: ZavorthTemporalAutonomyDailyUseCertificationStatus;
  dailyOpsReadiness: ZavorthScheduledTaskDailyOpsReadinessSnapshot;
  liveTickCertification: ZavorthScheduledTaskLiveTickCertificationSnapshot;
  channelCapability: ChannelCapabilitySnapshot;
  agentRunRecovery: ZavorthContextRecoverySnapshot;
  noCompoundPreview: ZavorthScheduledTaskSnapshot;
  matrix: ZavorthTemporalAutonomyDailyUseMatrixEntry[];
  abuseScenarios: ZavorthTemporalAutonomyDailyUseAbuseScenario[];
  summary: {
    matrixAreas: number;
    passedMatrixAreas: number;
    warningMatrixAreas: number;
    failedMatrixAreas: number;
    abuseScenarios: number;
    blockedAbuseScenarios: number;
    passedAbuseScenarios: number;
    failedAbuseScenarios: number;
    dailyUseCertified: boolean;
  };
  receipts: ZavorthTemporalAutonomyDailyUseReceipt[];
  safety: {
    consumesStage6LiveTickCertification: true;
    consumesDailyOpsReadiness: true;
    consumesChannelCapabilityAwareness: true;
    acpBridgeGovernedByMcp: true;
    noDirectSchedulerDispatch: true;
    noCronPrivilegeEscalation: boolean;
    noCompoundScheduling: boolean;
    expiredApprovalBlocksBeforeGateway: boolean;
    channelFallbackWithoutButtons: boolean;
    noZavorthControlVisualMutation: true;
    rawSecretsSerialized: false;
  };
  commands: {
    report: 'npx tsx scripts/zavorth-temporal-autonomy-daily-use-certification.ts';
    json: 'npx tsx scripts/zavorth-temporal-autonomy-daily-use-certification.ts --json';
    hostTask: 'npx tsx scripts/zavorth-temporal-autonomy-daily-use-certification.ts --json --task=<id>';
    check: 'node scripts/zavorth-temporal-autonomy-daily-use-certification-check.mjs';
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
