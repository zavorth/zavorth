import type { ZavorthGuidedMissionTemplateId } from '../ZavorthFirstRunProductJourneyContract.js';
import type { ZavorthSandboxMutationMode } from '../ZavorthSandboxReadinessContract.js';

export type ZavorthMissionStatus =
  | 'draft'
  | 'ready'
  | 'running'
  | 'needs_approval'
  | 'dry_run'
  | 'completed'
  | 'blocked';

export type ZavorthMissionRiskLevel = 'low' | 'medium' | 'high';

export type ZavorthMissionTimelineEvent = {
  id: string;
  at: string;
  status: 'done' | 'pending' | 'blocked';
  title: string;
  summary: string;
};

export type ZavorthMissionApproval = {
  id: string;
  status: 'not_required' | 'pending' | 'approved' | 'denied';
  risk: ZavorthMissionRiskLevel;
  prompt: string;
  options: Array<'allow_once' | 'deny' | 'view_preview' | 'view_rollback'>;
};

export type ZavorthMissionArtifact = {
  id: string;
  kind: 'preview' | 'report' | 'receipt' | 'rollback';
  label: string;
  status: 'expected' | 'ready' | 'blocked';
};

export type ZavorthMissionContract = {
  schemaVersion: 1;
  surface: 'mission';
  id: string;
  templateId: ZavorthGuidedMissionTemplateId;
  title: string;
  request: string;
  source: 'cli' | 'web' | 'channel' | 'scheduler' | 'internal';
  status: ZavorthMissionStatus;
  risk: ZavorthMissionRiskLevel;
  execution: {
    readOnly: boolean;
    mutationMode: ZavorthSandboxMutationMode;
    zavorthControlCanExecute: false;
    policyBrokerRequired: true;
  };
  timeline: ZavorthMissionTimelineEvent[];
  approvals: ZavorthMissionApproval[];
  artifacts: ZavorthMissionArtifact[];
  receiptId: string;
  nextAction: string;
};
