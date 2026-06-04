export type RuntimeAdapterProviderSecretPurpose =
  | 'api-key'
  | 'organization'
  | 'project'
  | 'endpoint';

export type RuntimeAdapterProviderSecretStatus = 'mapped' | 'missing';

export type RuntimeAdapterProviderSecretRefSourceEvidence = {
  sourceRuntimeName?: string;
  sourcePaths: string[];
  observedAt: string;
  sourceProviderId?: string;
  sourceEnvNames?: string[];
  sourceConfigIds?: string[];
  notes?: string[];
};

export type RuntimeAdapterProviderSecretRefEvidence = {
  fixtureCase?: string;
  sourceEvidence?: RuntimeAdapterProviderSecretRefSourceEvidence;
  publicProviderId: string;
  purposes: RuntimeAdapterProviderSecretPurpose[];
  secretStatus: RuntimeAdapterProviderSecretStatus;
  sourceCredentialPath?: string;
};

export type RuntimeAdapterProviderSecretRefExecutionGate = {
  providerSdkLoaded: false;
  liveProviderCallsAttempted: false;
  sourceModulesCopied: false;
  sourceStateMigrated: false;
  rawSecretsRead: false;
  setupCommandsExecuted: false;
  qaRunnersExecuted: false;
};

export type RuntimeAdapterProviderSecretRef = {
  id: string;
  providerId: string;
  purpose: RuntimeAdapterProviderSecretPurpose;
  status: RuntimeAdapterProviderSecretStatus;
  resolver: 'zavorth-secret-store';
  sourceEnvNameEvidenceId: string;
  rawValueExposed: false;
  sourcePathExposed: false;
  sourceEnvNameStoredAsEvidenceOnly: true;
  sourceConfigStoredAsEvidenceOnly: true;
  nativeContract: 'ZavorthSecretRef/v1';
};

export type RuntimeAdapterProviderSecretRefDiagnostic = {
  id: string;
  providerId: string;
  severity: 'warning';
  code: 'missing-provider-secret';
  detail: string;
};

export type RuntimeAdapterProviderSecretRefBoundaryNormalization = {
  nativeContract: 'ZavorthProviderSecretRefBoundary/v1';
  generatedAt: string;
  secretRefs: RuntimeAdapterProviderSecretRef[];
  sanitizedDiagnostics: RuntimeAdapterProviderSecretRefDiagnostic[];
  rawSecretValuesObserved: false;
  sourceCredentialPathsExposed: false;
  configStateMigrationRequired: false;
  sourceCredentialStoreIntroduced: false;
  sourceCredentialStoreAuthoritative: false;
  sourceConfigMigrationAuthority: false;
  executionGate: RuntimeAdapterProviderSecretRefExecutionGate;
};

export type RuntimeAdapterProviderSecretRefBoundaryOptions = {
  records: RuntimeAdapterProviderSecretRefEvidence[];
  generatedAt: string;
  createExecutionGate?: () => RuntimeAdapterProviderSecretRefExecutionGate;
};

function secretRefId(providerId: string, purpose: string): string {
  return `${providerId}:secret:${purpose}`;
}

function defaultExecutionGate(): RuntimeAdapterProviderSecretRefExecutionGate {
  return {
    providerSdkLoaded: false,
    liveProviderCallsAttempted: false,
    sourceModulesCopied: false,
    sourceStateMigrated: false,
    rawSecretsRead: false,
    setupCommandsExecuted: false,
    qaRunnersExecuted: false,
  };
}

export function normalizeRuntimeAdapterProviderSecretRefBoundary(
  options: RuntimeAdapterProviderSecretRefBoundaryOptions,
): RuntimeAdapterProviderSecretRefBoundaryNormalization {
  const secretRefs = options.records.flatMap((record) => record.purposes.map((purpose): RuntimeAdapterProviderSecretRef => ({
    id: secretRefId(record.publicProviderId, purpose),
    providerId: record.publicProviderId,
    purpose,
    status: record.secretStatus,
    resolver: 'zavorth-secret-store',
    sourceEnvNameEvidenceId: `${record.publicProviderId}:evidence:${purpose}`,
    rawValueExposed: false,
    sourcePathExposed: false,
    sourceEnvNameStoredAsEvidenceOnly: true,
    sourceConfigStoredAsEvidenceOnly: true,
    nativeContract: 'ZavorthSecretRef/v1',
  })));
  const sanitizedDiagnostics = secretRefs
    .filter((secretRef) => secretRef.status === 'missing')
    .map((secretRef): RuntimeAdapterProviderSecretRefDiagnostic => ({
      id: `${secretRef.id}:missing`,
      providerId: secretRef.providerId,
      severity: 'warning',
      code: 'missing-provider-secret',
      detail: 'Provider credential is missing; configure the Zavorth SecretRef before runtime activation.',
    }));

  return {
    nativeContract: 'ZavorthProviderSecretRefBoundary/v1',
    generatedAt: options.generatedAt,
    secretRefs,
    sanitizedDiagnostics,
    rawSecretValuesObserved: false,
    sourceCredentialPathsExposed: false,
    configStateMigrationRequired: false,
    sourceCredentialStoreIntroduced: false,
    sourceCredentialStoreAuthoritative: false,
    sourceConfigMigrationAuthority: false,
    executionGate: options.createExecutionGate?.() || defaultExecutionGate(),
  };
}
