export const ZAVORTH_CLOUD_WORKSPACE_BACKENDS_CONTRACT_VERSION =
  '2026-06-02.zavorth.cloud-workspace-backends.v1' as const;

export type ZavorthCloudWorkspaceBackendId =
  | 'cloud-function'
  | 'managed-workspace'
  | 'custom-remote-workspace'
  | 'modal'
  | 'daytona';

export type ZavorthCloudWorkspaceBackendStatus =
  | 'ready'
  | 'missing-config'
  | 'live-disabled';

export type ZavorthCloudWorkspaceBackendProbe = {
  configured: boolean;
  executableReady: boolean;
  credentialsReady: boolean;
  liveIoAllowed: boolean;
  missing: string[];
};

export type ZavorthCloudWorkspaceBackend = {
  id: ZavorthCloudWorkspaceBackendId;
  label: string;
  status: ZavorthCloudWorkspaceBackendStatus;
  isolation: 'serverless-container' | 'managed-dev-workspace' | 'remote-workspace' | 'cloud-function' | 'cloud-dev-workspace';
  adapterMode: 'doctor-only' | 'cli-live-ready';
  defaultCommand: string;
  envRefs: string[];
  probe: ZavorthCloudWorkspaceBackendProbe;
  nextAction: string;
};

export type ZavorthCloudWorkspaceBackendsSnapshot = {
  contractVersion: typeof ZAVORTH_CLOUD_WORKSPACE_BACKENDS_CONTRACT_VERSION;
  generatedAt: string;
  source: 'ZavorthCloudWorkspaceBackendsService';
  status: 'ready' | 'partial' | 'missing-config';
  summary: {
    total: number;
    ready: number;
    missingConfig: number;
    liveDisabled: number;
  };
  backends: ZavorthCloudWorkspaceBackend[];
  safety: {
    doctorDoesNotExecuteWorkload: true;
    liveIoRequiresExplicitFlag: true;
    noSecretValuesSerialized: true;
    neutralZavorthBackendNames: true;
  };
  commands: {
    doctor: 'zavorth cloud-workspace doctor';
    check: 'npm run zavorth:cloud-workspace-backends:check';
  };
};
