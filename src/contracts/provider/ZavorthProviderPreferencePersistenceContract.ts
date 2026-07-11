export const ZAVORTH_PROVIDER_PREFERENCE_PERSISTENCE_CONTRACT_VERSION = '2026-05-13.checkpoint-12';

export type ZavorthProviderPreferenceApprovalMode = 'approval_id' | 'explicit_confirm';

export type ZavorthProviderPreferenceStatus =
  | 'preview'
  | 'applied'
  | 'rolled_back'
  | 'denied';

export type ZavorthProviderPreferenceValue = {
  providerId: string;
  modelId: string | null;
  secondaryModelId?: string | null;
  routeId: string | null;
  familyId: string | null;
  source: 'provider-selection-ux';
  updatedAt: string;
  receiptId: string;
};

export type ZavorthProviderPreferenceReceipt = {
  id: string;
  contractVersion: typeof ZAVORTH_PROVIDER_PREFERENCE_PERSISTENCE_CONTRACT_VERSION;
  status: ZavorthProviderPreferenceStatus;
  action: 'preview' | 'apply' | 'rollback';
  generatedAt: string;
  providerId: string;
  modelId: string | null;
  decision: string | null;
  approval: {
    required: boolean;
    satisfied: boolean;
    mode: ZavorthProviderPreferenceApprovalMode | null;
    approvalId: string | null;
  };
  previous: ZavorthProviderPreferenceValue | null;
  next: ZavorthProviderPreferenceValue | null;
  storage: {
    preferencePath: string;
    backupPath: string | null;
    ledgerPath: string;
  };
  rollback: {
    available: boolean;
    command: string | null;
    restoresProviderId: string | null;
    restoresModelId: string | null;
  };
  safety: {
    rawSecretsSerialized: false;
    writesSecrets: false;
    mutatesEnvFile: false;
    mutatesRuntimePreference: boolean;
    requiresExplicitApproval: true;
    reversible: boolean;
  };
  summary: string;
};

export type ZavorthProviderPreferencePersistenceSnapshot = {
  contractVersion: typeof ZAVORTH_PROVIDER_PREFERENCE_PERSISTENCE_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'provider-preference-persistence';
  generatedAt: string;
  status: ZavorthProviderPreferenceStatus;
  request: {
    providerId: string | null;
    modelId: string | null;
    dryRun: boolean;
  };
  preference: ZavorthProviderPreferenceValue | null;
  receipt: ZavorthProviderPreferenceReceipt;
  commands: Array<{
    id: string;
    label: string;
    command: string;
    mutatesConfig: boolean;
    reversible: boolean;
  }>;
  nextAction: string;
};
