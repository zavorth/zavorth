export const ZAVORTH_DASHBOARD_FINAL_PRODUCT_POLISH_CONTRACT_VERSION =
  '2026-05-14.phase-11-dashboard-final-product-polish' as const;

export type ZavorthDashboardFinalProductPolishStatus = 'passed' | 'attention' | 'blocked';

export type ZavorthDashboardFinalProductPolishEntryKind =
  | 'home'
  | 'mission'
  | 'readiness'
  | 'approval'
  | 'receipt'
  | 'advanced'
  | 'responsive'
  | 'safety';

export type ZavorthDashboardFinalProductPolishEntry = {
  id: string;
  label: string;
  kind: ZavorthDashboardFinalProductPolishEntryKind;
  status: ZavorthDashboardFinalProductPolishStatus;
  userVisible: boolean;
  defaultSimple: boolean;
  evidence: string[];
  blockers: string[];
};

export type ZavorthDashboardFinalProductPolishSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_DASHBOARD_FINAL_PRODUCT_POLISH_CONTRACT_VERSION;
  source: 'ZavorthDashboardFinalProductPolishService';
  status: ZavorthDashboardFinalProductPolishStatus;
  files: {
    indexHtml: string;
    pagesJs: string;
    pagesCss: string;
  };
  entries: ZavorthDashboardFinalProductPolishEntry[];
  summary: {
    entries: number;
    passed: number;
    attention: number;
    blocked: number;
    dashboardPath: '/dashboard';
    chatFirstHome: boolean;
    nextActionsReady: boolean;
    readinessSummaryReady: boolean;
    approvalsInboxReady: boolean;
    receiptsViewerReady: boolean;
    missionTimelineReady: boolean;
    advancedModeCollapsed: boolean;
    mobileResponsive: boolean;
    noControlSurfaceByDefault: boolean;
    dashboardCanExecute: false;
    rawSecretsSerialized: false;
  };
  safety: {
    commandCenterIsDisplayOnly: true;
    mutableExecutionStaysInRuntime: true;
    approvalsRemainPolicyBrokerBound: true;
    advancedDetailsOptional: true;
    noLegacyControlLinkInDashboard: boolean;
    rawSecretsSerialized: false;
  };
  commands: {
    inspect: 'npm run zavorth:dashboard-final-product-polish';
    inspectJson: 'npm run zavorth:dashboard-final-product-polish:json';
    check: 'npm run zavorth:dashboard-final-product-polish:check --silent';
    nextPhase: 'Phase 12 - CLI Final Product Polish';
  };
};
