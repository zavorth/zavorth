export const ZAVORTH_CONTROL_FINAL_PRODUCT_POLISH_CONTRACT_VERSION =
  '2026-05-14.checkpoint-11-zavorthControl-final-product-polish' as const;

export type ZavorthControlFinalProductPolishStatus = 'passed' | 'attention' | 'blocked';

export type ZavorthControlFinalProductPolishEntryKind =
  | 'home'
  | 'mission'
  | 'readiness'
  | 'approval'
  | 'receipt'
  | 'advanced'
  | 'responsive'
  | 'safety';

export type ZavorthControlFinalProductPolishEntry = {
  id: string;
  label: string;
  kind: ZavorthControlFinalProductPolishEntryKind;
  status: ZavorthControlFinalProductPolishStatus;
  userVisible: boolean;
  defaultSimple: boolean;
  evidence: string[];
  blockers: string[];
};

export type ZavorthControlFinalProductPolishSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_CONTROL_FINAL_PRODUCT_POLISH_CONTRACT_VERSION;
  source: 'ZavorthControlFinalProductPolishService';
  status: ZavorthControlFinalProductPolishStatus;
  files: {
    indexHtml: string;
    pagesJs: string;
    chatSurfaceJs: string;
    contextRailJs: string;
    pagesCss: string;
    runtimeBridgeJs: string;
  };
  entries: ZavorthControlFinalProductPolishEntry[];
  summary: {
    entries: number;
    passed: number;
    attention: number;
    blocked: number;
    zavorthControlPath: '/control';
    chatFirstHome: boolean;
    nextActionsReady: boolean;
    readinessSummaryReady: boolean;
    approvalsInboxReady: boolean;
    receiptsViewerReady: boolean;
    missionTimelineReady: boolean;
    advancedModeCollapsed: boolean;
    mobileResponsive: boolean;
    noControlSurfaceByDefault: boolean;
    zavorthControlCanExecute: false;
    rawSecretsSerialized: false;
  };
  safety: {
    zavorthControlIsDisplayOnly: true;
    mutableExecutionStaysInRuntime: true;
    approvalsRemainPolicyBrokerBound: true;
    advancedDetailsOptional: true;
    noLegacyControlLinkInZavorthControl: boolean;
    rawSecretsSerialized: false;
  };
  commands: {
    inspect: 'npm run zavorth:zavorthControl-final-product-polish';
    inspectJson: 'npm run zavorth:zavorthControl-final-product-polish:json';
    check: 'npm run zavorth:zavorthControl-final-product-polish:check --silent';
    nextStage: 'Zavorth Control live visual QA and route alias verification';
  };
};
