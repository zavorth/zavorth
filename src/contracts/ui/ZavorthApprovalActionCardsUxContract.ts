import type { ZavorthMissionRiskLevel } from '../ZavorthMissionContract.js';

export const ZAVORTH_APPROVAL_ACTION_CARDS_UX_CONTRACT_VERSION = '2026-05-13.gate-17' as const;

export type ZavorthApprovalActionCardTone = 'ok' | 'info' | 'warn' | 'danger';

export type ZavorthApprovalActionCardAction = {
  id: string;
  label: string;
  kind: 'allow_once' | 'deny' | 'view_preview' | 'view_rollback' | 'view_receipt';
  command: string;
  approvalId: string | null;
  zavorthControlCanResolveApproval: boolean;
  zavorthControlCanExecuteTargetAction: false;
  requiresApproval: boolean;
};

export type ZavorthApprovalActionCard = {
  id: string;
  title: string;
  summary: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'not_required';
  risk: ZavorthMissionRiskLevel | 'unknown';
  tone: ZavorthApprovalActionCardTone;
  scope: string;
  preview: {
    available: boolean;
    command: string;
    filesChanged: number;
    commands: number;
    networkCalls: number;
    messages: number;
  };
  rollback: {
    available: boolean;
    command: string | null;
    summary: string;
  };
  receipt: {
    available: boolean;
    id: string | null;
    command: string;
  };
  actions: ZavorthApprovalActionCardAction[];
  safety: {
    policyBrokerRequired: true;
    zavorthControlCanExecuteTargetAction: false;
    rawSecretsSerialized: false;
    approvalScopeBound: true;
  };
};

export type ZavorthApprovalActionCardsUxSnapshot = {
  contractVersion: typeof ZAVORTH_APPROVAL_ACTION_CARDS_UX_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'approval-action-cards-ux';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    totalCards: number;
    pending: number;
    highRisk: number;
    previewAvailable: number;
    rollbackAvailable: number;
    rawSecretsSerialized: false;
  };
  cards: ZavorthApprovalActionCard[];
  zavorthControlProjection: {
    route: '/zavorthControl';
    renderMode: 'interactive-action-cards';
    executionAuthority: false;
    zavorthControlCanExecuteTargetAction: false;
    approvalResolutionAuthority: 'gateway-mediated';
  };
  nextAction: string;
};
