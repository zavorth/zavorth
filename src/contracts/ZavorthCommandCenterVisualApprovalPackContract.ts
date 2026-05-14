import type { ZavorthCommandCenterProviderCockpitProjection } from './ZavorthCommandCenterProviderCockpitContract.js';

export const ZAVORTH_COMMAND_CENTER_VISUAL_APPROVAL_PACK_CONTRACT_VERSION = '2026-05-13.phase-7' as const;

export type ZavorthCommandCenterVisualApprovalPackStatus = 'ready_for_review' | 'blocked';

export type ZavorthCommandCenterVisualApprovalBlock = {
  id: string;
  title: string;
  targetSurface: '/dashboard';
  sourceProjection: ZavorthCommandCenterProviderCockpitProjection['surface'];
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

export type ZavorthCommandCenterVisualApprovalPack = {
  contractVersion: typeof ZAVORTH_COMMAND_CENTER_VISUAL_APPROVAL_PACK_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'command-center-visual-approval-pack';
  generatedAt: string;
  status: ZavorthCommandCenterVisualApprovalPackStatus;
  approvalRequired: true;
  approved: false;
  visualMutationApplied: false;
  executionAuthority: false;
  sourceCockpitContractVersion: ZavorthCommandCenterProviderCockpitProjection['contractVersion'];
  target: {
    route: '/dashboard';
    ownerDecisionRequired: true;
    defaultDecision: 'do_not_render';
  };
  blocks: ZavorthCommandCenterVisualApprovalBlock[];
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
