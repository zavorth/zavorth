import {
  createWave1ProviderSecretRefFixtures,
  normalizeWave1ProviderSecretRefBoundary,
} from '../../../src/runtime/external-agents/index.js';

describe('Wave 1 provider SecretRef boundary fixture parity', () => {
  it('maps source credential evidence to Zavorth SecretRefs and sanitized diagnostics only', () => {
    const fixtures = createWave1ProviderSecretRefFixtures();
    const boundary = normalizeWave1ProviderSecretRefBoundary(fixtures);

    expect(fixtures.map((fixture) => fixture.fixtureCase)).toEqual([
      'secretref-env-mapping',
      'secretref-missing-secret',
    ]);
    expect(JSON.stringify(fixtures)).toContain('EXTERNAL_EXECUTOR_TEXT_API_KEY');
    expect(JSON.stringify(fixtures)).toContain('~/.external-executor/providers.json');
    expect(boundary).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthProviderSecretRefBoundary/v1',
      rawSecretValuesObserved: false,
      sourceCredentialPathsExposed: false,
      configStateMigrationRequired: false,
      sourceCredentialStoreIntroduced: false,
      sourceCredentialStoreAuthoritative: false,
      sourceConfigMigrationAuthority: false,
      executionGate: expect.objectContaining({
        providerSdkLoaded: false,
        liveProviderCallsAttempted: false,
        sourceModulesCopied: false,
        sourceStateMigrated: false,
        rawSecretsRead: false,
      }),
    }));
    expect(boundary.secretRefs).toEqual([
      expect.objectContaining({
        id: 'zavorth-provider:wave1-secret-mapped:secret:api-key',
        status: 'mapped',
        resolver: 'zavorth-secret-store',
        rawValueExposed: false,
        sourcePathExposed: false,
        sourceEnvNameStoredAsEvidenceOnly: true,
        sourceConfigStoredAsEvidenceOnly: true,
        nativeContract: 'ZavorthSecretRef/v1',
      }),
      expect.objectContaining({
        id: 'zavorth-provider:wave1-secret-mapped:secret:organization',
        status: 'mapped',
      }),
      expect.objectContaining({
        id: 'zavorth-provider:wave1-secret-missing:secret:api-key',
        status: 'missing',
      }),
    ]);
    expect(boundary.sanitizedDiagnostics).toEqual([
      {
        id: 'zavorth-provider:wave1-secret-missing:secret:api-key:missing',
        providerId: 'zavorth-provider:wave1-secret-missing',
        severity: 'warning',
        code: 'missing-provider-secret',
        detail: 'Provider credential is missing; configure the Zavorth SecretRef before runtime activation.',
      },
    ]);
    expect(JSON.stringify(boundary)).not.toContain('EXTERNAL_EXECUTOR');
    expect(JSON.stringify(boundary)).not.toContain('external-executor');
    expect(JSON.stringify(boundary)).not.toContain('~/.external-executor');
  });
});
