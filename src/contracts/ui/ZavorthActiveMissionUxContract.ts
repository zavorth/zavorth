import type { ZavorthMissionRiskLevel } from '../ZavorthMissionContract.js';

export const ZAVORTH_ACTIVE_MISSION_UX_CONTRACT_VERSION = '2026-05-13.checkpoint-16' as const;

export type ZavorthActiveMissionUxTone = 'ok' | 'info' | 'warn' | 'danger';

export type ZavorthActiveMissionUxStatus =
  | 'idle'
  | 'running'
  | 'needs_approval'
  | 'dry_run'
  | 'completed'
  | 'blocked';

export type ZavorthActiveMissionUxTimelineEvent = {
  id: string;
  label: string;
  summary: string;
  status: 'done' | 'running' | 'pending' | 'blocked';
  tone: ZavorthActiveMissionUxTone;
  source: 'run' | 'sensitive-flow' | 'receipt' | 'provider' | 'system';
};

export type ZavorthActiveMissionUxAction = {
  id: string;
  label: string;
  command: string;
  kind: 'inspect_run' | 'inspect_receipts' | 'inspect_preview' | 'approve_once' | 'deny' | 'rollback' | 'provider_status';
  requiresApproval: boolean;
  mutatesState: boolean;
  zavorthControlCanExecute: false;
};

export type ZavorthActiveMissionUxSnapshot = {
  contractVersion: typeof ZAVORTH_ACTIVE_MISSION_UX_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'active-mission-ux';
  generatedAt: string;
  status: ZavorthActiveMissionUxStatus;
  tone: ZavorthActiveMissionUxTone;
  mission: {
    id: string;
    title: string;
    summary: string;
    request: string;
    runId: string | null;
    traceId: string | null;
    sessionId: string | null;
    providerLabel: string;
    modelLabel: string;
    risk: ZavorthMissionRiskLevel | 'unknown';
  };
  counts: {
    timelineEvents: number;
    approvalsPending: number;
    artifactsReady: number;
    receiptsReady: number;
    blockers: number;
  };
  timeline: ZavorthActiveMissionUxTimelineEvent[];
  actions: ZavorthActiveMissionUxAction[];
  zavorthControlProjection: {
    route: '/zavorthControl';
    renderMode: 'mission-timeline';
    executionAuthority: false;
  };
  safety: {
    projectionOnly: true;
    zavorthControlCanExecute: false;
    rawSecretsSerialized: false;
    approvalsStillRequired: true;
  };
  nextAction: string;
};
