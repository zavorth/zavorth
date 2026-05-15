export const ZAVORTH_DASHBOARD_EXPERIENCE_HOME_CONTRACT_VERSION = '2026-05-15.experience-layer.phase-12' as const;

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

export type ZavorthDashboardExperienceHomeSnapshot = {
  contractVersion: typeof ZAVORTH_DASHBOARD_EXPERIENCE_HOME_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'dashboard-experience-home';
  generatedAt: string;
  route: '/dashboard';
  greeting: string;
  promise: string;
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
