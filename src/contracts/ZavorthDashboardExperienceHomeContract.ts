export const ZAVORTH_DASHBOARD_EXPERIENCE_HOME_CONTRACT_VERSION = '2026-05-16.product-home.phase-a' as const;

export type ZavorthDashboardExperienceHomeAreaId =
  | 'inbox'
  | 'tasks'
  | 'approvals'
  | 'receipts'
  | 'connectors';

export type ZavorthDashboardExperienceHomeArea = {
  id: ZavorthDashboardExperienceHomeAreaId;
  label: string;
  summary: string;
  href: string;
  icon: string;
  statusLabel: string;
  primaryAction: string;
};

export type ZavorthDashboardExperienceHomeMission = {
  id: string;
  label: string;
  description: string;
  prompt: string;
  href: string;
  risk: 'low' | 'medium';
  approvalExpectation: string;
};

export type ZavorthDashboardExperienceHomeQuestion = {
  id: string;
  label: string;
  question: string;
  command: string;
};

export type ZavorthDashboardExperienceHomeFirstStep = {
  id: 'setup' | 'go' | 'demo' | 'connectors';
  label: string;
  summary: string;
  command: string;
  href: string;
  optional: boolean;
};

export type ZavorthDashboardExperienceHomeSnapshot = {
  contractVersion: typeof ZAVORTH_DASHBOARD_EXPERIENCE_HOME_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'dashboard-experience-home';
  generatedAt: string;
  route: '/dashboard';
  greeting: string;
  promise: string;
  simpleNavigation: {
    headline: string;
    areas: ZavorthDashboardExperienceHomeArea[];
  };
  gettingStarted: {
    title: 'Primeiros passos';
    summary: string;
    steps: ZavorthDashboardExperienceHomeFirstStep[];
  };
  primaryMissions: ZavorthDashboardExperienceHomeMission[];
  runtimeQuestions: ZavorthDashboardExperienceHomeQuestion[];
  quietReadiness: {
    title: string;
    bullets: string[];
    advancedRoute: string;
  };
  safety: {
    dashboardCanExecuteTargetAction: false;
    projectionOnly: true;
    policyBrokerRequiredForActions: true;
    rawSecretsSerialized: false;
  };
  invariants: string[];
};
