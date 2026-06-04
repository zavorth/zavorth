import type { ZavorthProviderCapabilityModality } from '../services/providers/catalog/zavorthProviderCapabilityInventory.js';

export const ZAVORTH_PROVIDER_CAPABILITY_MATRIX_CONTRACT_VERSION =
  '2026-06-03.provider-capability-matrix.v1' as const;

export type ZavorthProviderCapabilityMatrixStatus = 'ready' | 'attention' | 'blocked';

export type ZavorthProviderCapabilityMatrixProviderState =
  | 'active'
  | 'configured'
  | 'needs-credential'
  | 'compatible'
  | 'blocked';

export type ZavorthProviderCapabilityMatrixProviderLevel =
  | 'runtime-native'
  | 'zavorth-native'
  | 'compatible-route'
  | 'local-runtime';

export type ZavorthProviderCapabilityMatrixCredentialKind =
  | 'none'
  | 'api-key'
  | 'local-endpoint'
  | 'oauth'
  | 'compatible';

export type ZavorthProviderCapabilityMatrixDashboardAction =
  | 'use'
  | 'configure'
  | 'doctor'
  | 'activate';

export type ZavorthProviderCapabilityMatrixProof = {
  available: boolean;
  command: string;
  liveNetworkUsedByDefault: boolean;
  requiresExplicitConfirmation?: boolean;
};

export type ZavorthProviderCapabilityMatrixProvider = {
  id: string;
  label: string;
  level: ZavorthProviderCapabilityMatrixProviderLevel;
  state: ZavorthProviderCapabilityMatrixProviderState;
  modalities: ZavorthProviderCapabilityModality[];
  modelCount: number;
  defaultModel: string | null;
  envRefs: string[];
  routeKind: string;
  credentialKind: ZavorthProviderCapabilityMatrixCredentialKind;
  statusReason: string;
  doctor: ZavorthProviderCapabilityMatrixProof;
  canary: ZavorthProviderCapabilityMatrixProof;
  dashboardAction: ZavorthProviderCapabilityMatrixDashboardAction;
};

export type ZavorthProviderCapabilityMatrixSnapshot = {
  contractVersion: typeof ZAVORTH_PROVIDER_CAPABILITY_MATRIX_CONTRACT_VERSION;
  generatedAt: string;
  surface: 'provider-capability-matrix';
  status: ZavorthProviderCapabilityMatrixStatus;
  summary: {
    total: number;
    active: number;
    configured: number;
    credentialRequired: number;
    compatible: number;
    blocked: number;
    doctorAvailable: number;
    canaryAvailable: number;
    modalityCounts: Record<ZavorthProviderCapabilityModality, number>;
  };
  providers: ZavorthProviderCapabilityMatrixProvider[];
  llmContextBlock: string;
  commands: {
    status: string;
    json: string;
    lookup: string;
    doctor: string;
    canary: string;
  };
  safety: {
    readOnlyInventory: true;
    noSecretsSerialized: true;
    liveProofRequiresExplicitCommand: true;
    compatibleDoesNotMeanDefaultEnabled: true;
  };
};
