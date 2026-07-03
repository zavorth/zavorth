import type { ZavorthExperienceProfileId } from './ZavorthExperienceProfileContract.js';

export const ZAVORTH_DAILY_PRODUCT_EXPERIENCE_VERSION = 'daily-product-experience/v1' as const;

export type ZavorthDailyProductExperienceStatus =
  | 'ready'
  | 'attention'
  | 'needs-setup'
  | 'blocked';

export type ZavorthDailyProductExperienceStepStatus =
  | 'done'
  | 'next'
  | 'pending'
  | 'needs-setup'
  | 'blocked';

export type ZavorthDailyProductExperienceArea =
  | 'profile'
  | 'provider'
  | 'channel'
  | 'runtime'
  | 'memory'
  | 'skills'
  | 'scheduler'
  | 'quality';

export type ZavorthDailyProductExperienceSetupStep = {
  id:
    | 'choose-profile'
    | 'test-provider'
    | 'connect-channel'
    | 'configure-runtime'
    | 'review-memory'
    | 'review-tools'
    | 'schedule-routine'
    | 'run-evals';
  area: ZavorthDailyProductExperienceArea;
  label: string;
  status: ZavorthDailyProductExperienceStepStatus;
  summary: string;
  nextAction: string;
  command: string;
  href: string;
  proof: string;
};

export type ZavorthDailyProductExperienceLoopStep = {
  id:
    | 'ask'
    | 'understand'
    | 'choose-route'
    | 'work'
    | 'deliver'
    | 'receipt'
    | 'review';
  label: string;
  summary: string;
  quietByDefault: boolean;
  approvalAppearsFor: string[];
  visibleInZavorthControl: boolean;
};

export type ZavorthDailyProductExperienceReviewItem = {
  id:
    | 'learned-memory'
    | 'skill-lifecycle'
    | 'channel-readiness'
    | 'backend-readiness'
    | 'quality-evals'
    | 'receipts';
  label: string;
  status: ZavorthDailyProductExperienceStatus;
  summary: string;
  href: string;
  command: string;
  userQuestion: string;
};

export type ZavorthDailyProductExperienceZavorthControlCard = {
  id:
    | 'daily-start'
    | 'setup-guide'
    | 'daily-loop'
    | 'review-center'
    | 'quality-gates';
  title: string;
  summary: string;
  href: string;
  prompt: string;
  status: ZavorthDailyProductExperienceStatus;
  mutatesState: false;
  executionAuthority: false;
};

export type ZavorthDailyProductExperienceSnapshot = {
  generatedAt: string;
  version: typeof ZAVORTH_DAILY_PRODUCT_EXPERIENCE_VERSION;
  status: ZavorthDailyProductExperienceStatus;
  headline: string;
  selectedProfile: {
    profileId: ZavorthExperienceProfileId;
    label: string;
    autonomy: string;
    explanation: string;
    summary: string;
  };
  firstRun: {
    title: 'Start guided';
    summary: string;
    steps: ZavorthDailyProductExperienceSetupStep[];
  };
  dailyLoop: {
    title: 'Daily loop';
    summary: string;
    steps: ZavorthDailyProductExperienceLoopStep[];
  };
  reviewCenter: {
    title: 'Review center';
    summary: string;
    items: ZavorthDailyProductExperienceReviewItem[];
  };
  zavorthControlProjection: {
    route: '/control';
    renderMode: 'daily-product-experience';
    cards: ZavorthDailyProductExperienceZavorthControlCard[];
  };
  language: {
    publicTone: 'plain-product-language';
    defaultWords: string[];
    advancedWordsHiddenByDefault: string[];
    allowedWhenUserAsksForDetails: string[];
  };
  qualityGates: {
    commands: string[];
    covers: string[];
  };
  safety: {
    projectionOnly: true;
    noLiveActionExecuted: true;
    rawSecretsSerialized: false;
    setupDoesNotGrantAuthority: true;
    liveActionsRemainApprovalBound: true;
    memoryChangesRemainReviewable: true;
    externalToolsRemainPreviewUntilApproved: true;
  };
};
