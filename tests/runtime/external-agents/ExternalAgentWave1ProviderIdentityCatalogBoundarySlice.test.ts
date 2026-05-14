import fs from 'node:fs';
import path from 'node:path';

const SLICE_DOC = 'docs/127-wave-1-provider-identity-catalog-boundary-slice.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentProviderIdentityCatalogBoundary.ts';
const FIXTURE_FILE = 'src/runtime/external-agents/ExternalAgentWave1ProviderCapabilityFixtures.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Wave 1 provider identity catalog boundary slice gate', () => {
  it('records provider-identity-catalog as the only selected provider implementation slice', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('Status: wave-1-provider-identity-catalog-boundary-ready');
    expect(content).toContain('provider-identity-catalog');
    expect(content).toContain('docs/125-wave-0-provider-capability-contracts-matrix.md');
    expect(content).toContain('docs/126-wave-1-provider-capability-test-design.md');
    expect(content).toContain('This slice does not authorize a real sidecar');
    expect(content).not.toContain('provider-secret-ref-boundary selected');
    expect(content).not.toContain('provider-embedding-contracts selected');
    expect(content).not.toContain('provider-web-search-fetch-contracts selected');
  });

  it('documents the Zavorth-owned provider catalog boundary, fixture handoff, and public export', () => {
    const content = read(SLICE_DOC);
    const boundary = read(BOUNDARY_FILE);
    const fixtures = read(FIXTURE_FILE);
    const index = read(INDEX_FILE);

    expect(content).toContain('ExternalAgentProviderIdentityCatalogBoundary.ts');
    expect(content).toContain('ExternalAgentWave1ProviderCapabilityFixtures.ts');
    expect(content).toContain('src/runtime/external-agents/index.ts');
    expect(boundary).toContain('normalizeExternalAgentProviderIdentityCatalog');
    expect(boundary).toContain('ZavorthProviderCatalogRecord/v1');
    expect(boundary).toContain('sourceProviderIdsStoredAsEvidenceOnly: true');
    expect(boundary).toContain('liveProbePerformed: false');
    expect(boundary).toContain('sourceProviderCatalogIntroduced: false');
    expect(boundary).toContain('sourceProviderCatalogAuthoritative: false');
    expect(boundary).toContain('sourceProviderCatalogLiveProbeAuthority: false');
    expect(fixtures).toContain('normalizeExternalAgentProviderIdentityCatalog({');
    expect(index).toContain("from './ExternalAgentProviderIdentityCatalogBoundary.js'");
  });

  it('keeps provider SDKs, live probes, source catalogs, and credentials blocked', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('provider SDK loader');
    expect(content).toContain('source provider catalog import');
    expect(content).toContain('source state/config/credential migration');
    expect(content).toContain('liveProbePerformed: false');
    expect(content).toContain('liveProbeAllowed: false');
    expect(content).toContain('sourceProviderCatalogIntroduced: false');
    expect(content).toContain('sourceProviderCatalogAuthoritative: false');
    expect(content).toContain('sourceProviderCatalogLiveProbeAuthority: false');
    expect(content).toContain('docs/128-wave-1-provider-secret-ref-boundary-slice.md');
    expect(content).toContain('SecretRef is the second provider slice');
    expect(content).toContain('Live provider calls, provider SDK loading');
  });
});
