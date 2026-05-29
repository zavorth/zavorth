import type { ZavorthControlProviderCockpitProjection } from './ZavorthControlProviderCockpitContract.js';

export const ZAVORTH_ZAVORTH_CONTROL_VISUAL_APPROVAL_PACK_CONTRACT_VERSION = '2026-05-13.checkpoint-7' as const;

export type ZavorthControlVisualApprovalPackStatus = 'ready_for_review' | 'blocked';

export type ZavorthControlVisualApprovalBlock = {
  id: string;
  title: string;
  targetSurface: '/control';
  sourceProjection: ZavorthControlProviderCockpitProjection['surface'];
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
    zavorthControlCanExecute: false;
  }>;
  acceptanceCriteria: string[];
  rollbackPlan: string;
};

export type ZavorthControlVisualApprovalPack = {
  contractVersion: typeof ZAVORTH_ZAVORTH_CONTROL_VISUAL_APPROVAL_PACK_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'zavorthControl-visual-approval-pack';
  generatedAt: string;
  status: ZavorthControlVisualApprovalPackStatus;
  approvalRequired: true;
  approved: false;
  visualMutationApplied: false;
  executionAuthority: false;
  sourceCockpitContractVersion: ZavorthControlProviderCockpitProjection['contractVersion'];
  target: {
    route: '/control';
    ownerDecisionRequired: true;
    defaultDecision: 'do_not_render';
  };
  blocks: ZavorthControlVisualApprovalBlock[];
  reviewChecklist: string[];
  safety: {
    noZavorthControlExecutionAuthority: true;
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
