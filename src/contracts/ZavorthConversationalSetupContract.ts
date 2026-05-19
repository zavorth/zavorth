import type {
  ZavorthExperienceProfileContract,
  ZavorthExperienceProfileId,
} from './ZavorthExperienceProfileContract.js';

export const ZAVORTH_CONVERSATIONAL_SETUP_CONTRACT_VERSION = '2026-05-15.experience-layer.checkpoint-2' as const;

export type ZavorthConversationalSetupLanguage = 'en-US';

export type ZavorthConversationalSetupStatus =
  | 'needs_input'
  | 'ready'
  | 'blocked'
  | 'applied';

export type ZavorthConversationalSetupQuestionId =
  | 'agent-name'
  | 'user-name'
  | 'preferred-language'
  | 'experience-profile'
  | 'detail-level'
  | 'primary-use'
  | 'approval-channel'
  | 'first-safe-mission';

export type ZavorthConversationalSetupQuestion = {
  id: ZavorthConversationalSetupQuestionId;
  label: string;
  prompt: string;
  kind: 'text' | 'choice';
  required: boolean;
  status: 'answered' | 'pending';
  answerPreview: string | null;
  choices?: string[];
};

export type ZavorthConversationalSetupAnswers = {
  agentName: string | null;
  userName: string | null;
  preferredAddress: string | null;
  uiLanguage: ZavorthConversationalSetupLanguage;
  preferredLanguage: string | null;
  primaryUse: string | null;
  approvalChannel: string | null;
  firstSafeMission: string | null;
  detailLevel: 'simple' | 'advanced';
  experienceProfileId: ZavorthExperienceProfileId;
};

export type ZavorthConversationalSetupWritePlan = {
  previewOnly: boolean;
  requiresExplicitApply: true;
  requiresLocalProfileConfirmation: true;
  targets: Array<{
    file: 'IDENTITY.md' | 'USER.md' | 'SOUL.md';
    purpose: string;
    action: 'upsert-markdown-fields';
  }>;
};

export type ZavorthConversationalSetupSafety = {
  rawSecretsSerialized: false;
  rawSecretDetected: boolean;
  blockedReason: string | null;
  secretHandling: string;
  storesOnlyLocalProfile: true;
  mutatesOnlyAfterConfirmation: true;
};

export type ZavorthConversationalSetupApplyResult = {
  applied: boolean;
  writtenFiles: string[];
  removedBootstrap: boolean;
  summary: string[];
};

export type ZavorthConversationalSetupContract = {
  contractVersion: typeof ZAVORTH_CONVERSATIONAL_SETUP_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'conversational-setup';
  status: ZavorthConversationalSetupStatus;
  uiLanguage: ZavorthConversationalSetupLanguage;
  experience: ZavorthExperienceProfileContract;
  answers: ZavorthConversationalSetupAnswers;
  questions: ZavorthConversationalSetupQuestion[];
  writePlan: ZavorthConversationalSetupWritePlan;
  safety: ZavorthConversationalSetupSafety;
  applyResult: ZavorthConversationalSetupApplyResult | null;
  preview: {
    agentIntroduction: string;
    userSummary: string;
    operatingStyle: string;
    firstMission: string;
  };
  commands: Array<{
    command: string;
    purpose: string;
    mutatesLocalProfile: boolean;
  }>;
  invariants: string[];
};
