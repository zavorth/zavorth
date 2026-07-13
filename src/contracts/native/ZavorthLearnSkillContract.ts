import type {
  CapabilityFabricSnapshot,
} from '../UniversalCapabilityFabricContract.js';

export const ZAVORTH_LEARN_SKILL_CONTRACT_VERSION = 'zavorth-learn-skill/1' as const;

export type ZavorthLearnSkillSourceKind =
  | 'path'
  | 'archive'
  | 'https-url'
  | 'git-url'
  | 'inline-text'
  | 'auto';

export type ZavorthLearnSkillStatus =
  | 'preview'
  | 'approval-required'
  | 'quarantined'
  | 'installed'
  | 'blocked'
  | 'partial';

export type ZavorthLearnSkillInput = {
  source: string;
  apply?: boolean;
  consent?: boolean;
  approvalId?: string | null;
  confirmLiveNetwork?: boolean;
  allowExecutable?: boolean;
  allowAllCandidates?: boolean;
  overwrite?: boolean;
  label?: string;
  projectRoot?: string;
};

export type ZavorthLearnSkillExtract = {
  performed: boolean;
  title: string | null;
  contentChars: number;
  liveNetworkPerformed: boolean;
  reason: string;
};

export type ZavorthLearnSkillSnapshot = {
  contractVersion: typeof ZAVORTH_LEARN_SKILL_CONTRACT_VERSION;
  generatedAt: string;
  source: 'ZavorthLearnSkillService';
  status: ZavorthLearnSkillStatus;
  sourceKind: ZavorthLearnSkillSourceKind;
  sourceLabel: string;
  applyRequested: boolean;
  consentGranted: boolean;
  approvalId: string | null;
  extract: ZavorthLearnSkillExtract;
  fabric: CapabilityFabricSnapshot;
  safety: {
    quarantineRequired: true;
    previewBeforeInstall: true;
    applyRequiresConsentOrApproval: true;
    rawSecretsSerialized: false;
    liveNetworkRequiresConfirm: true;
  };
  commands: {
    preview: string;
    apply: string;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextStep: string;
  };
};
