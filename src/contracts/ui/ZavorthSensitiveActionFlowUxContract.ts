import type {
  ZavorthSensitiveActionFlowSnapshot,
  ZavorthSensitiveActionFlowStatus,
} from '../ZavorthSensitiveActionFlowContract.js';
import type { ZavorthMissionRiskLevel } from '../ZavorthMissionContract.js';

export const ZAVORTH_SENSITIVE_ACTION_FLOW_UX_CONTRACT_VERSION = '2026-05-13.checkpoint-15';

export type ZavorthSensitiveActionFlowUxTone = 'ok' | 'info' | 'warn' | 'danger';

export type ZavorthSensitiveActionFlowUxStep = {
  id: 'request' | 'preview' | 'risk' | 'approval' | 'execution' | 'receipt' | 'rollback';
  label: string;
  status: 'done' | 'pending' | 'blocked';
  tone: ZavorthSensitiveActionFlowUxTone;
  summary: string;
};

export type ZavorthSensitiveActionFlowUxAction = {
  id: string;
  label: string;
  command: string;
  kind: 'preview' | 'approve_once' | 'deny' | 'rollback' | 'inspect_receipt';
  requiresApproval: boolean;
  mutatesState: boolean;
  zavorthControlCanExecute: false;
};

export type ZavorthSensitiveActionFlowUxCard = {
  id: string;
  title: string;
  subtitle: string;
  status: ZavorthSensitiveActionFlowStatus;
  risk: ZavorthMissionRiskLevel;
  tone: ZavorthSensitiveActionFlowUxTone;
  request: string;
  preview: {
    filesChanged: number;
    commands: number;
    networkCalls: number;
    messages: number;
    affectedResources: string[];
    rawSecretsPresent: false;
  };
  approval: {
    required: boolean;
    status: string;
    simpleText: string;
  };
  execution: {
    mode: string;
    executed: false;
    why: string;
  };
  rollback: {
    available: boolean;
    command: string | null;
    summary: string;
  };
  receipt: {
    id: string;
    simpleText: string;
    rollbackAvailable: boolean;
    rawSecretsPresent: boolean;
  };
  steps: ZavorthSensitiveActionFlowUxStep[];
  actions: ZavorthSensitiveActionFlowUxAction[];
  safety: {
    zavorthControlCanExecute: false;
    policyBrokerRequired: true;
    previewBeforeApply: true;
    receiptAlwaysGenerated: true;
    rawSecretsSerialized: false;
  };
};

export type ZavorthSensitiveActionFlowUxSnapshot = {
  contractVersion: typeof ZAVORTH_SENSITIVE_ACTION_FLOW_UX_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'sensitive-action-flow-ux';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  card: ZavorthSensitiveActionFlowUxCard;
  source: ZavorthSensitiveActionFlowSnapshot;
  zavorthControlProjection: {
    route: '/zavorthControl' | '/control';
    renderMode: 'action-card';
    executionAuthority: false;
  };
  nextAction: string;
};
