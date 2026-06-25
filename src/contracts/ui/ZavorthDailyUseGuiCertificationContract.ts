export type ZavorthDailyUseGuiCapabilityId =
  | 'status'
  | 'health'
  | 'providers'
  | 'channels'
  | 'approvals'
  | 'receipts'
  | 'missions'
  | 'chat'
  | 'events'
  | 'actions';

export type ZavorthDailyUseGuiCapabilityStatus = 'ready' | 'attention' | 'blocked';

export type ZavorthDailyUseGuiCapabilityCheck = {
  id: ZavorthDailyUseGuiCapabilityId;
  label: string;
  status: ZavorthDailyUseGuiCapabilityStatus;
  authority: 'runtime-api-v1' | 'web-adapter';
  evidence: string[];
  nextAction: string | null;
};

export type ZavorthDailyUseGuiCertificationSnapshot = {
  schemaVersion: 1;
  surface: 'daily-use-gui-certification-v1';
  generatedAt: string;
  summary: {
    status: 'ready' | 'attention' | 'blocked';
    ready: number;
    attention: number;
    blocked: number;
    total: number;
  };
  checks: ZavorthDailyUseGuiCapabilityCheck[];
  safety: {
    dashboardCanExecute: false;
    desktopCanBypassRuntime: false;
    policyBrokerRequiredForMutableActions: true;
    previewFirstChat: true;
    rawSecretsSerialized: false;
  };
};
