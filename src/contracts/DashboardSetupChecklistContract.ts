export const DASHBOARD_SETUP_CHECKLIST_VERSION = 'dashboard-setup-checklist/v1' as const;

export type DashboardSetupChecklistItemStatus =
  | 'done'
  | 'next'
  | 'needs-setup'
  | 'blocked';

export type DashboardSetupChecklistItem = {
  id: string;
  label: string;
  area:
    | 'channel'
    | 'provider'
    | 'execution-backend'
    | 'memory'
    | 'skill'
    | 'scheduler'
    | 'mission'
    | 'quality';
  status: DashboardSetupChecklistItemStatus;
  summary: string;
  nextAction: string;
  command: string;
  href: string;
  proof: string;
};

export type DashboardSetupChecklistSnapshot = {
  generatedAt: string;
  version: typeof DASHBOARD_SETUP_CHECKLIST_VERSION;
  status: 'ready' | 'needs-setup' | 'attention';
  headline: string;
  items: DashboardSetupChecklistItem[];
  summary: {
    total: number;
    done: number;
    next: number;
    needsSetup: number;
    blocked: number;
  };
  safety: {
    projectionOnly: true;
    rawSecretsSerialized: false;
    liveActionsRemainApprovalBound: true;
  };
};
