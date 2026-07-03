export const ZAVORTH_CONTROL_SETUP_CHECKLIST_VERSION = 'zavorthControl-setup-checklist/v1' as const;

export type ZavorthControlSetupChecklistItemStatus =
  | 'done'
  | 'next'
  | 'needs-setup'
  | 'blocked';

export type ZavorthControlSetupChecklistItem = {
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
  status: ZavorthControlSetupChecklistItemStatus;
  summary: string;
  nextAction: string;
  command: string;
  href: string;
  proof: string;
};

export type ZavorthControlSetupChecklistSnapshot = {
  generatedAt: string;
  version: typeof ZAVORTH_CONTROL_SETUP_CHECKLIST_VERSION;
  status: 'ready' | 'needs-setup' | 'attention';
  headline: string;
  items: ZavorthControlSetupChecklistItem[];
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
