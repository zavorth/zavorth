import type { ZavorthDashboardProviderCockpitProjection } from './ZavorthDashboardProviderCockpitContract.js';

export const ZAVORTH_COMMAND_CENTER_VISUAL_APPROVAL_PACK_CONTRACT_VERSION = '2026-05-13.checkpoint-7' as const;

export type ZavorthDashboardVisualApprovalPackStatus = 'ready_for_review' | 'blocked';

export type ZavorthDashboardVisualApprovalBlock = {
  id: string;
  title: string;
  targetSurface: '/dashboard';
  sourceProjection: ZavorthDashboardProviderCockpitProjection['surface'];
  placement: 'right-rail' | 'main-panel' | 'details-drawer';
  visualChangeType: 'new-section' | 'new-card' | 'new-action-row';
  requiresOwnerApproval: true;
  implementationStatus: 'proposal_only';
  userVisible: false;
  summary: string;
  dataBindings: string[];
  interactionModel: Array<{
    id: string;
    label: string;
    command: string;
    dashboardCanExecute: false;
  }>;
  acceptanceCriteria: string[];
  rollbackPlan: string;
};

export type ZavorthDashboardVisualApprovalPack = {
  contractVersion: typeof ZAVORTH_COMMAND_CENTER_VISUAL_APPROVAL_PACK_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'dashboard-visual-approval-pack';
  generatedAt: string;
  status: ZavorthDashboardVisualApprovalPackStatus;
  approvalRequired: true;
  approved: false;
  visualMutationApplied: false;
  executionAuthority: false;
  sourceCockpitContractVersion: ZavorthDashboardProviderCockpitProjection['contractVersion'];
  target: {
    route: '/dashboard';
    ownerDecisionRequired: true;
    defaultDecision: 'do_not_render';
  };
  blocks: ZavorthDashboardVisualApprovalBlock[];
  reviewChecklist: string[];
  safety: {
    noDashboardExecutionAuthority: true;
    noProviderSecretSerialization: true;
    noLiveProbeOnRender: true;
    noLayoutMutationBeforeApproval: true;
  };
  receipts: Array<{
    id: string;
    kind: 'visual-proposal' | 'safety-gate' | 'rollback';
    status: 'recorded';
    detail: string;
  }>;
  nextAction: string;
};
