import type { ZavorthExperienceProfileId } from './ZavorthExperienceProfileContract.js';
import type { ZavorthMissionRiskLevel } from './ZavorthMissionContract.js';

export const ZAVORTH_GUIDED_MISSIONS_CONTRACT_VERSION = '2026-05-15.experience-layer.checkpoint-3' as const;

export type ZavorthGuidedMissionCategory =
  | 'daily-life'
  | 'documents'
  | 'development'
  | 'business'
  | 'automation'
  | 'security'
  | 'device-help';

export type ZavorthGuidedMissionId =
  | 'organize-my-day'
  | 'summarize-document'
  | 'organize-files-preview'
  | 'review-this-repository'
  | 'fix-a-bug-safely'
  | 'prepare-release-notes'
  | 'business-status-report'
  | 'audit-sensitive-change'
  | 'connect-a-channel'
  | 'create-safe-routine'
  | 'check-my-computer'
  | 'look-at-my-phone';

export type ZavorthGuidedMissionStep = {
  id: string;
  label: string;
  mode: 'read_only' | 'preview' | 'approval_required' | 'receipt';
  summary: string;
};

export type ZavorthGuidedMissionCard = {
  id: ZavorthGuidedMissionId;
  title: string;
  category: ZavorthGuidedMissionCategory;
  audience: ZavorthExperienceProfileId[];
  summary: string;
  prompt: string;
  defaultRisk: ZavorthMissionRiskLevel;
  mutatesByDefault: boolean;
  requiresNetworkByDefault: boolean;
  likelyCapabilities: string[];
  expectedArtifacts: string[];
  approvalSummary: string;
  safeFirstStep: string;
  steps: ZavorthGuidedMissionStep[];
  naturalAliases: string[];
};

export type ZavorthGuidedMissionSelection = {
  missionId: ZavorthGuidedMissionId;
  confidence: 'explicit' | 'high' | 'medium' | 'fallback';
  reason: string;
  matchedSignals: string[];
};

export type ZavorthGuidedMissionsContract = {
  contractVersion: typeof ZAVORTH_GUIDED_MISSIONS_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'guided-missions';
  selectedProfile: ZavorthExperienceProfileId;
  selection: ZavorthGuidedMissionSelection;
  recommended: ZavorthGuidedMissionCard;
  catalog: ZavorthGuidedMissionCard[];
  categories: Array<{
    id: ZavorthGuidedMissionCategory;
    title: string;
    count: number;
  }>;
  startProjection: {
    command: string;
    previewOnlyByDefault: true;
    dashboardRoute: '/dashboard';
    policyBrokerRequired: true;
    commandCenterCanExecute: false;
  };
  safety: {
    guidedDoesNotBypassPolicy: true;
    mutationRequiresApproval: true;
    receiptsRequired: true;
    rawSecretsSerialized: false;
  };
  invariants: string[];
};
