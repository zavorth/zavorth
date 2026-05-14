import fs from 'node:fs';
import path from 'node:path';

const SLICE_DOC = 'docs/134-wave-1-provider-web-search-fetch-boundary-slice.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentProviderWebSearchFetchBoundary.ts';
const FIXTURE_FILE = 'src/runtime/external-agents/ExternalAgentWave1ProviderCapabilityFixtures.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Wave 1 provider web search/fetch boundary slice gate', () => {
  it('records provider-web-search-fetch-contracts as the only selected provider implementation slice', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('Status: wave-1-provider-web-search-fetch-boundary-ready');
    expect(content).toContain('provider-web-search-fetch-contracts');
    expect(content).toContain('docs/125-wave-0-provider-capability-contracts-matrix.md');
    expect(content).toContain('docs/126-wave-1-provider-capability-test-design.md');
    expect(content).toContain('docs/127-wave-1-provider-identity-catalog-boundary-slice.md');
    expect(content).toContain('docs/128-wave-1-provider-secret-ref-boundary-slice.md');
    expect(content).toContain('docs/129-wave-1-provider-embedding-contracts-boundary-slice.md');
    expect(content).toContain('docs/130-wave-1-provider-speech-transcription-boundary-slice.md');
    expect(content).toContain('docs/131-wave-1-provider-realtime-voice-boundary-slice.md');
    expect(content).toContain('docs/132-wave-1-provider-media-understanding-boundary-slice.md');
    expect(content).toContain('docs/133-wave-1-provider-generation-boundary-slice.md');
    expect(content).toContain('This slice does not authorize a real sidecar');
    expect(content).toContain('there is no remaining selected provider row');
  });

  it('documents the Zavorth-owned web search/fetch boundary, fixture handoff, and public export', () => {
    const content = read(SLICE_DOC);
    const boundary = read(BOUNDARY_FILE);
    const fixtures = read(FIXTURE_FILE);
    const index = read(INDEX_FILE);

    expect(content).toContain('ExternalAgentProviderWebSearchFetchBoundary.ts');
    expect(content).toContain('ExternalAgentWave1ProviderCapabilityFixtures.ts');
    expect(content).toContain('src/runtime/external-agents/index.ts');
    expect(boundary).toContain('normalizeExternalAgentProviderWebSearchFetchContracts');
    expect(boundary).toContain('ZavorthWebSearchFetchProviderContract/v1');
    expect(boundary).toContain('providerWebSearchFetchRuntimeIntroduced: false');
    expect(boundary).toContain('providerWebSearchFetchExecutionAuthority: false');
    expect(boundary).toContain('sourceWebSdkLoaded: false');
    expect(boundary).toContain('sourceFetcherLoaded: false');
    expect(boundary).toContain('sourceBrowserNetworkLoaded: false');
    expect(boundary).toContain('sourceNetworkAuthority: false');
    expect(boundary).toContain('sourceEndpointIdsStoredAsEvidenceOnly: true');
    expect(boundary).toContain('networkFetchBlocked: true');
    expect(fixtures).toContain('normalizeExternalAgentProviderWebSearchFetchContracts({');
    expect(index).toContain("from './ExternalAgentProviderWebSearchFetchBoundary.js'");
  });

  it('keeps live network, source fetchers, browser network clients, and endpoint authority blocked', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('provider SDK loader');
    expect(content).toContain('source fetcher');
    expect(content).toContain('source browser network');
    expect(content).toContain('source network authority');
    expect(content).toContain('source endpoint authority');
    expect(content).toContain('webSearchRequiresApproval: true');
    expect(content).toContain('networkFetchBlocked: true');
    expect(content).toContain('liveNetworkCallsAllowed: false');
    expect(content).toContain('sourceFetcherExecuted: false');
    expect(content).toContain('sourceFetcherLoaded: false');
    expect(content).toContain('sourceBrowserNetworkLoaded: false');
    expect(content).toContain('Recommended next matrix is `plugin-command-and-http-surfaces`');
    expect(content).toContain('Live provider calls, provider SDK loading');
  });
});
