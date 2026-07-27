export const ZAVORTH_CONTROL_EXPERIENCE_HOME_CONTRACT_VERSION = '2026-05-16.product-home.phase-a' as const;

export type ZavorthControlExperienceHomeAreaId =
  | 'inbox'
  | 'tasks'
  | 'approvals'
  | 'receipts'
  | 'connectors';

export type ZavorthControlExperienceHomeArea = {
  id: ZavorthControlExperienceHomeAreaId;
  label: string;
  summary: string;
  href: string;
  icon: string;
  statusLabel: string;
  primaryAction: string;
};

export type ZavorthControlExperienceHomeMission = {
  id: string;
  label: string;
  description: string;
  prompt: string;
  href: string;
  risk: 'low' | 'medium';
  approvalExpectation: string;
};

export type ZavorthControlExperienceHomeQuestion = {
  id: string;
  label: string;
  question: string;
  command: string;
};

export type ZavorthControlPermissionPanelItem = {
  id: 'permissions' | 'auto-approvals' | 'extreme-mode' | 'revoke' | 'receipts';
  label: string;
  summary: string;
  icon: string;
  href: string;
  statusLabel: string;
  actionLabel: string;
  risk: 'low' | 'medium' | 'critical';
};

export type ZavorthControlExperienceHomeFirstStep = {
  id: 'setup' | 'setup-checklist' | 'go' | 'demo' | 'connectors';
  label: string;
  summary: string;
  command: string;
  href: string;
  optional: boolean;
};

export type ZavorthControlExperienceHomeSnapshot = {
  contractVersion: typeof ZAVORTH_CONTROL_EXPERIENCE_HOME_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'zavorthControl-experience-home';
  generatedAt: string;
  route: '/control';
  greeting: string;
  promise: string;
  simpleNavigation: {
    headline: string;
    areas: ZavorthControlExperienceHomeArea[];
  };
  gettingStarted: {
    title: 'Getting started';
    summary: string;
    steps: ZavorthControlExperienceHomeFirstStep[];
  };
  primaryMissions: ZavorthControlExperienceHomeMission[];
  runtimeQuestions: ZavorthControlExperienceHomeQuestion[];
  permissionPanel: {
    title: 'Permissions';
    summary: string;
    items: ZavorthControlPermissionPanelItem[];
    defaultPosture: string;
  };
  quietReadiness: {
    title: string;
    bullets: string[];
    advancedRoute: string;
  };
  safety: {
    zavorthControlCanExecuteTargetAction: false;
    projectionOnly: true;
    policyBrokerRequiredForActions: true;
    rawSecretsSerialized: false;
  };
  invariants: string[];
};
