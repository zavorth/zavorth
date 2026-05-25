import type {
  ZavorthCapabilityStoreCard,
  ZavorthCapabilityStoreCategoryId,
} from './ZavorthCapabilityStoreContract.js';
import type {
  ZavorthExperienceAutonomyLevel,
  ZavorthExperienceProfileId,
} from './ZavorthExperienceProfileContract.js';

export const ZAVORTH_TRUST_PANEL_CONTRACT_VERSION = '2026-05-15.experience-layer.checkpoint-6' as const;

export type ZavorthTrustPanelBucketId =
  | 'can_do_alone'
  | 'asks_first'
  | 'blocked'
  | 'needs_setup';

export type ZavorthTrustPanelRuleSource =
  | 'policy-broker'
  | 'capability-store'
  | 'experience-profile'
  | 'runtime-contract';

export type ZavorthTrustPanelRule = {
  id: string;
  title: string;
  bucket: ZavorthTrustPanelBucketId;
  summary: string;
  examples: string[];
  source: ZavorthTrustPanelRuleSource;
  receiptExpected: boolean;
  approvalRequired: boolean;
};

export type ZavorthTrustPanelBucket = {
  id: ZavorthTrustPanelBucketId;
  title: string;
  plainLanguage: string;
  count: number;
  rules: ZavorthTrustPanelRule[];
};

export type ZavorthTrustPanelContract = {
  contractVersion: typeof ZAVORTH_TRUST_PANEL_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'trust-panel';
  selectedProfile: ZavorthExperienceProfileId;
  autonomy: ZavorthExperienceAutonomyLevel;
  query: string | null;
  category: ZavorthCapabilityStoreCategoryId | null;
  summary: {
    headline: string;
    safeToAssume: string;
    userControl: string;
    approvalTone: string;
  };
  buckets: ZavorthTrustPanelBucket[];
  capabilitySignals: {
    total: number;
    available: number;
    needsSetup: number;
    needsTest: number;
    blocked: number;
    approvalGated: number;
  };
  setupHighlights: ZavorthCapabilityStoreCard[];
  approvalLanguage: {
    allowOnce: string;
    deny: string;
    preview: string;
    rollback: string;
  };
  advanced: {
    policyBrokerAuthority: true;
    dashboardRoute: '/dashboard';
    dashboardCanExecute: false;
    rawSecretsSerialized: false;
    approvalScope: string[];
    receiptEvents: string[];
  };
  safety: {
    projectionOnly: true;
    liveActionsRequirePolicyBroker: true;
    externalActionsRequireApproval: true;
    destructiveActionsBlockedByDefault: true;
    importedSkillsAreInstructionOnly: true;
  };
  invariants: string[];
};
