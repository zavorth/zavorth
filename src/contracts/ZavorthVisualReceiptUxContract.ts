import type { ZavorthMissionRiskLevel } from './ZavorthMissionContract.js';
import type { ZavorthVisualReceiptContract } from './ZavorthVisualReceiptContract.js';

export const ZAVORTH_VISUAL_RECEIPT_UX_CONTRACT_VERSION = '2026-05-13.phase-14';

export type ZavorthVisualReceiptUxTone = 'ok' | 'info' | 'warn' | 'danger';

export type ZavorthVisualReceiptUxEvidenceRow = {
  id: string;
  label: string;
  value: string;
  tone: ZavorthVisualReceiptUxTone;
  detail: string;
};

export type ZavorthVisualReceiptUxAction = {
  id: string;
  label: string;
  command: string;
  kind: 'inspect' | 'approval' | 'rollback' | 'export';
  requiresApproval: boolean;
  mutatesState: boolean;
  dashboardCanExecute: false;
};

export type ZavorthVisualReceiptUxCard = {
  id: string;
  title: string;
  subtitle: string;
  risk: ZavorthMissionRiskLevel;
  tone: ZavorthVisualReceiptUxTone;
  outcome: string;
  simpleText: string;
  evidence: ZavorthVisualReceiptUxEvidenceRow[];
  actions: ZavorthVisualReceiptUxAction[];
  advanced: {
    visible: boolean;
    policyBroker: ZavorthVisualReceiptContract['advanced']['policyBroker'];
    trustPlane: ZavorthVisualReceiptContract['advanced']['trustPlane'];
    sandboxMutationMode: ZavorthVisualReceiptContract['advanced']['sandboxMutationMode'];
    approvalOptions: string[];
    artifacts: string[];
  };
  safety: {
    rawSecretsSerialized: false;
    secretPolicy: ZavorthVisualReceiptContract['redaction']['policy'];
    commandCenterCanExecute: false;
    projectionOnly: true;
  };
};

export type ZavorthVisualReceiptUxSnapshot = {
  contractVersion: typeof ZAVORTH_VISUAL_RECEIPT_UX_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'visual-receipt-ux';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    totalReceipts: number;
    highRisk: number;
    rollbackAvailable: number;
    approvalsPending: number;
    rawSecretsSerialized: false;
  };
  cards: ZavorthVisualReceiptUxCard[];
  commandCenterProjection: {
    route: '/dashboard';
    renderMode: 'projection-only';
    executionAuthority: false;
    visualReceiptBlocksReady: true;
  };
  nextAction: string;
};
