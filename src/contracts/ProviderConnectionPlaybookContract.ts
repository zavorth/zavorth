import type {
  ZavorthProviderProbeStatus,
  ZavorthProviderReadinessProof,
  ZavorthProviderReadinessStatus,
} from './ZavorthProviderReadinessMatrixContract.js';

export const PROVIDER_CONNECTION_PLAYBOOK_VERSION = 'provider-connection-playbook/v1' as const;

export type ProviderConnectionPlaybookStatus =
  | 'needs-provider'
  | 'needs-auth'
  | 'needs-base-url'
  | 'ready-to-probe'
  | 'live-ready'
  | 'default-route-ready'
  | 'blocked';

export type ProviderConnectionStepStatus = 'done' | 'next' | 'pending' | 'blocked';

export type ProviderConnectionStep = {
  id:
    | 'choose-provider'
    | 'add-credentials'
    | 'configure-base-url'
    | 'select-model'
    | 'run-safe-probe'
    | 'run-live-probe'
    | 'allow-default-route';
  label: string;
  status: ProviderConnectionStepStatus;
  command: string | null;
  details: string[];
};

export type ProviderConnectionPlaybook = {
  providerId: string;
  label: string;
  status: ProviderConnectionPlaybookStatus;
  providerStatus: ZavorthProviderReadinessStatus;
  defaultModel: string | null;
  summary: string;
  nextAction: string;
  requiredInputKeys: string[];
  missingInputKeys: string[];
  readiness: {
    authConfigured: boolean;
    baseUrlConfigured: boolean;
    liveReady: boolean;
    defaultRouteAllowed: boolean;
    readinessProof: ZavorthProviderReadinessProof;
    probeStatus: ZavorthProviderProbeStatus;
    defaultBlockReason: string | null;
  };
  commands: {
    inspect: string;
    safeProbe: string;
    liveProbe: string;
    selectDefault: string;
  };
  steps: ProviderConnectionStep[];
  safety: {
    rawSecretsSerialized: false;
    catalogSupportIsNotLiveProof: true;
    liveProbeRequiresExplicitAction: true;
    defaultRouteRequiresLiveProof: true;
  };
};

export type ProviderConnectionPlaybookSnapshot = {
  generatedAt: string;
  version: typeof PROVIDER_CONNECTION_PLAYBOOK_VERSION;
  status: 'ready' | 'needs-setup' | 'attention';
  selected: ProviderConnectionPlaybook | null;
  playbooks: ProviderConnectionPlaybook[];
  summary: {
    total: number;
    needsAuth: number;
    needsBaseUrl: number;
    readyToProbe: number;
    liveReady: number;
    defaultRouteAllowed: number;
  };
  operatorSummary: string;
};
