import fs from 'node:fs';
import path from 'node:path';

const SLICE_DOC = 'docs/128-wave-1-provider-secret-ref-boundary-slice.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentProviderSecretRefBoundary.ts';
const FIXTURE_FILE = 'src/runtime/external-agents/ExternalAgentWave1ProviderCapabilityFixtures.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Wave 1 provider SecretRef boundary slice gate', () => {
  it('records provider-secret-ref-boundary as the only selected provider implementation slice', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('Status: wave-1-provider-secret-ref-boundary-ready');
    expect(content).toContain('provider-secret-ref-boundary');
    expect(content).toContain('docs/125-wave-0-provider-capability-contracts-matrix.md');
    expect(content).toContain('docs/126-wave-1-provider-capability-test-design.md');
    expect(content).toContain('docs/127-wave-1-provider-identity-catalog-boundary-slice.md');
    expect(content).toContain('This slice does not authorize a real sidecar');
    expect(content).not.toContain('provider-embedding-contracts selected');
    expect(content).not.toContain('provider-realtime-voice-contracts selected');
    expect(content).not.toContain('provider-web-search-fetch-contracts selected');
  });

  it('documents the Zavorth-owned SecretRef boundary, fixture handoff, and public export', () => {
    const content = read(SLICE_DOC);
    const boundary = read(BOUNDARY_FILE);
    const fixtures = read(FIXTURE_FILE);
    const index = read(INDEX_FILE);

    expect(content).toContain('ExternalAgentProviderSecretRefBoundary.ts');
    expect(content).toContain('ExternalAgentWave1ProviderCapabilityFixtures.ts');
    expect(content).toContain('src/runtime/external-agents/index.ts');
    expect(boundary).toContain('normalizeExternalAgentProviderSecretRefBoundary');
    expect(boundary).toContain('ZavorthSecretRef/v1');
    expect(boundary).toContain('sourceEnvNameStoredAsEvidenceOnly: true');
    expect(boundary).toContain('sourceConfigStoredAsEvidenceOnly: true');
    expect(boundary).toContain('rawSecretValuesObserved: false');
    expect(boundary).toContain('sourceCredentialPathsExposed: false');
    expect(boundary).toContain('sourceCredentialStoreIntroduced: false');
    expect(boundary).toContain('sourceCredentialStoreAuthoritative: false');
    expect(boundary).toContain('sourceConfigMigrationAuthority: false');
    expect(fixtures).toContain('normalizeExternalAgentProviderSecretRefBoundary({');
    expect(index).toContain("from './ExternalAgentProviderSecretRefBoundary.js'");
  });

  it('keeps source credentials, config migration, SDKs, and live calls blocked', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('source credential store import');
    expect(content).toContain('source config');
    expect(content).toContain('source secret value read');
    expect(content).toContain('rawSecretValuesObserved: false');
    expect(content).toContain('sourceCredentialPathsExposed: false');
    expect(content).toContain('configStateMigrationRequired: false');
    expect(content).toContain('sourceCredentialStoreIntroduced: false');
    expect(content).toContain('sourceCredentialStoreAuthoritative: false');
    expect(content).toContain('sourceConfigMigrationAuthority: false');
    expect(content).toContain('docs/129-wave-1-provider-embedding-contracts-boundary-slice.md');
    expect(content).toContain('Embedding contracts are the third provider slice');
    expect(content).toContain('Live provider calls, provider SDK loading');
  });
});
