import type { ZavorthVisualReceiptUxSnapshot } from './ZavorthVisualReceiptUxContract.js';

export const ZAVORTH_VISUAL_RECEIPTS_V2_CONTRACT_VERSION = '2026-05-15.experience-layer.checkpoint-9' as const;

export type ZavorthVisualReceiptV2Tone = 'calm' | 'attention' | 'risk' | 'blocked';

export type ZavorthVisualReceiptV2ImpactItem = {
  id: string;
  label: string;
  value: string;
  tone: ZavorthVisualReceiptV2Tone;
  plainMeaning: string;
};

export type ZavorthVisualReceiptV2Action = {
  id: string;
  label: string;
  command: string;
  kind: 'inspect' | 'export' | 'approval' | 'rollback' | 'next_step';
  safeByDefault: boolean;
  requiresApproval: boolean;
  mutatesState: boolean;
  dashboardCanExecute: false;
};

export type ZavorthVisualReceiptV2Card = {
  id: string;
  title: string;
  headline: string;
  statusLine: string;
  tone: ZavorthVisualReceiptV2Tone;
  confidence: 'clear' | 'needs_review' | 'blocked';
  receiptStory: string[];
  impact: ZavorthVisualReceiptV2ImpactItem[];
  safeActions: ZavorthVisualReceiptV2Action[];
  advancedSummary: {
    visibleByDefault: false;
    policyBroker: string;
    trustPlane: string;
    sandboxMutationMode: string;
    artifacts: string[];
    secretPolicy: string;
  };
};

export type ZavorthVisualReceiptsV2Snapshot = {
  contractVersion: typeof ZAVORTH_VISUAL_RECEIPTS_V2_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'visual-receipts-v2';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    totalReceipts: number;
    completed: number;
    needsReview: number;
    rollbackAvailable: number;
    blockedOrRisky: number;
    rawSecretsSerialized: false;
  };
  cards: ZavorthVisualReceiptV2Card[];
  plainLanguage: {
    userCanTrust: string;
    userShouldReview: string;
    userCanUndo: string;
  };
  sourceProjection: Pick<
    ZavorthVisualReceiptUxSnapshot,
    'surface' | 'contractVersion' | 'commandCenterProjection'
  >;
  commandCenterProjection: {
    route: '/dashboard';
    renderMode: 'product-cards';
    executionAuthority: false;
    advancedModeAvailable: true;
  };
  exportFormats: Array<'markdown' | 'json' | 'audit-json'>;
  safety: {
    projectionOnly: true;
    rawSecretsSerialized: false;
    dashboardCanExecute: false;
    approvalActionsStayScoped: true;
    rollbackRequiresApproval: true;
  };
  nextAction: string;
  invariants: string[];
};
