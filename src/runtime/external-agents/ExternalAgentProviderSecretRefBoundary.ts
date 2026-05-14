export type ExternalAgentProviderSecretPurpose =
  | 'api-key'
  | 'organization'
  | 'project'
  | 'endpoint';

export type ExternalAgentProviderSecretStatus = 'mapped' | 'missing';

export type ExternalAgentProviderSecretRefSourceEvidence = {
  sourceRuntimeName?: string;
  sourcePaths: string[];
  observedAt: string;
  sourceProviderId?: string;
  sourceEnvNames?: string[];
  sourceConfigIds?: string[];
  notes?: string[];
};

export type ExternalAgentProviderSecretRefEvidence = {
  fixtureCase?: string;
  sourceEvidence?: ExternalAgentProviderSecretRefSourceEvidence;
  publicProviderId: string;
  purposes: ExternalAgentProviderSecretPurpose[];
  secretStatus: ExternalAgentProviderSecretStatus;
  sourceCredentialPath?: string;
};

export type ExternalAgentProviderSecretRefExecutionGate = {
  providerSdkLoaded: false;
  liveProviderCallsAttempted: false;
  sourceModulesCopied: false;
  sourceStateMigrated: false;
  rawSecretsRead: false;
  setupCommandsExecuted: false;
  qaRunnersExecuted: false;
};

export type ExternalAgentProviderSecretRef = {
  id: string;
  providerId: string;
  purpose: ExternalAgentProviderSecretPurpose;
  status: ExternalAgentProviderSecretStatus;
  resolver: 'zavorth-secret-store';
  sourceEnvNameEvidenceId: string;
  rawValueExposed: false;
  sourcePathExposed: false;
  sourceEnvNameStoredAsEvidenceOnly: true;
  sourceConfigStoredAsEvidenceOnly: true;
  nativeContract: 'ZavorthSecretRef/v1';
};

export type ExternalAgentProviderSecretRefDiagnostic = {
  id: string;
  providerId: string;
  severity: 'warning';
  code: 'missing-provider-secret';
  detail: string;
};

export type ExternalAgentProviderSecretRefBoundaryNormalization = {
  nativeContract: 'ZavorthProviderSecretRefBoundary/v1';
  generatedAt: string;
  secretRefs: ExternalAgentProviderSecretRef[];
  sanitizedDiagnostics: ExternalAgentProviderSecretRefDiagnostic[];
  rawSecretValuesObserved: false;
  sourceCredentialPathsExposed: false;
  configStateMigrationRequired: false;
  sourceCredentialStoreIntroduced: false;
  sourceCredentialStoreAuthoritative: false;
  sourceConfigMigrationAuthority: false;
  executionGate: ExternalAgentProviderSecretRefExecutionGate;
};

export type ExternalAgentProviderSecretRefBoundaryOptions = {
  records: ExternalAgentProviderSecretRefEvidence[];
  generatedAt: string;
  createExecutionGate?: () => ExternalAgentProviderSecretRefExecutionGate;
};

function secretRefId(providerId: string, purpose: string): string {
  return `${providerId}:secret:${purpose}`;
}

function defaultExecutionGate(): ExternalAgentProviderSecretRefExecutionGate {
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

export function normalizeExternalAgentProviderSecretRefBoundary(
  options: ExternalAgentProviderSecretRefBoundaryOptions,
): ExternalAgentProviderSecretRefBoundaryNormalization {
  const secretRefs = options.records.flatMap((record) => record.purposes.map((purpose): ExternalAgentProviderSecretRef => ({
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
    .map((secretRef): ExternalAgentProviderSecretRefDiagnostic => ({
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
