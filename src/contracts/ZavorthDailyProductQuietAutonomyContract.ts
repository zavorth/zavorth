import type {
  ProfileImprovementInterruptMode,
  ProfileImprovementLane,
  ProfileImprovementMode,
  ProfileImprovementRisk,
} from './ProfileManifestContract.js';

export const ZAVORTH_DAILY_PRODUCT_QUIET_AUTONOMY_VERSION = '2026-06-02.daily-product-quiet-autonomy.v1' as const;

export type ZavorthDailyProductStatus = 'ready' | 'attention' | 'blocked';

export type ZavorthDailyProductTabId =
  | 'chat'
  | 'work'
  | 'channels'
  | 'approvals'
  | 'history'
  | 'tools'
  | 'memory'
  | 'models'
  | 'settings';

export type ZavorthDailyProductTab = {
  id: ZavorthDailyProductTabId;
  label: string;
  purpose: string;
  showWhen: 'always' | 'has-data' | 'needs-setup';
  primaryAction: string;
};

export type ZavorthQuietAutonomyLane = {
  lane: ProfileImprovementLane;
  label: string;
  mode: 'silent' | 'digest' | 'approval';
  reversible: boolean;
  receipt: boolean;
  userVisibleSummary: string;
};

export type ZavorthQuietAutonomyProfilePolicy = {
  profileId: string;
  label: string;
  mode: ProfileImprovementMode;
  maxSilentRisk: ProfileImprovementRisk;
  interruptMode: ProfileImprovementInterruptMode;
  silentLanes: ZavorthQuietAutonomyLane[];
  digestLanes: ZavorthQuietAutonomyLane[];
  approvalLanes: ZavorthQuietAutonomyLane[];
  dailySummary: string;
};

export type ZavorthDailyProductQuietAutonomySnapshot = {
  contractVersion: typeof ZAVORTH_DAILY_PRODUCT_QUIET_AUTONOMY_VERSION;
  generatedAt: string;
  surface: 'daily-product-quiet-autonomy';
  status: ZavorthDailyProductStatus;
  activeProfileId: string;
  dailyProduct: {
    headline: string;
    primarySurface: 'chat';
    visibleTabs: ZavorthDailyProductTab[];
    collapsedTechnicalSurfaces: string[];
    emptyStateRules: string[];
    dashboardRule: string;
    tuiRule: string;
    cliRule: string;
  };
  quietAutonomy: {
    activePolicy: ZavorthQuietAutonomyProfilePolicy;
    profilePolicies: ZavorthQuietAutonomyProfilePolicy[];
    neverSilent: ProfileImprovementLane[];
    backgroundReceipts: {
      enabled: true;
      receiptKind: 'quiet-autonomy';
      rollbackRequired: true;
      rawSecretsSerialized: false;
    };
    llmGuidance: string;
  };
  commands: {
    status: 'zavorth daily';
    json: 'npm run zavorth:daily-product:json --silent';
    quietStatus: 'zavorth daily --profile personal --json';
    curator: 'zavorth skills curator status';
    qa: 'npm run qa:zavorth-daily-product-quiet-autonomy --silent';
  };
  safety: {
    readOnlySnapshot: true;
    riskyMutationStillApprovalGated: true;
    outboundStillPolicyGated: true;
    noRawSecretsSerialized: true;
    quietActionsMustBeReversible: true;
  };
};
