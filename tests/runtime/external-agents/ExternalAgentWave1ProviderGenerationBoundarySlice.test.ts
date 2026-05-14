import fs from 'node:fs';
import path from 'node:path';

const SLICE_DOC = 'docs/133-wave-1-provider-generation-boundary-slice.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentProviderGenerationBoundary.ts';
const FIXTURE_FILE = 'src/runtime/external-agents/ExternalAgentWave1ProviderCapabilityFixtures.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Wave 1 provider generation boundary slice gate', () => {
  it('records provider-generation-contracts as the only selected provider implementation slice', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('Status: wave-1-provider-generation-boundary-ready');
    expect(content).toContain('provider-generation-contracts');
    expect(content).toContain('docs/125-wave-0-provider-capability-contracts-matrix.md');
    expect(content).toContain('docs/126-wave-1-provider-capability-test-design.md');
    expect(content).toContain('docs/127-wave-1-provider-identity-catalog-boundary-slice.md');
    expect(content).toContain('docs/128-wave-1-provider-secret-ref-boundary-slice.md');
    expect(content).toContain('docs/129-wave-1-provider-embedding-contracts-boundary-slice.md');
    expect(content).toContain('docs/130-wave-1-provider-speech-transcription-boundary-slice.md');
    expect(content).toContain('docs/131-wave-1-provider-realtime-voice-boundary-slice.md');
    expect(content).toContain('docs/132-wave-1-provider-media-understanding-boundary-slice.md');
    expect(content).toContain('This slice does not authorize a real sidecar');
    expect(content).not.toContain('provider-web-search-fetch-contracts selected');
  });

  it('documents the Zavorth-owned generation boundary, fixture handoff, and public export', () => {
    const content = read(SLICE_DOC);
    const boundary = read(BOUNDARY_FILE);
    const fixtures = read(FIXTURE_FILE);
    const index = read(INDEX_FILE);

    expect(content).toContain('ExternalAgentProviderGenerationBoundary.ts');
    expect(content).toContain('ExternalAgentWave1ProviderCapabilityFixtures.ts');
    expect(content).toContain('src/runtime/external-agents/index.ts');
    expect(boundary).toContain('normalizeExternalAgentProviderGenerationContracts');
    expect(boundary).toContain('ZavorthGenerationProviderContract/v1');
    expect(boundary).toContain('providerGenerationRuntimeIntroduced: false');
    expect(boundary).toContain('providerGenerationExecutionAuthority: false');
    expect(boundary).toContain('sourceGenerationSdkLoaded: false');
    expect(boundary).toContain('sourceGenerationClientLoaded: false');
    expect(boundary).toContain('sourceOutputPathAuthority: false');
    expect(boundary).toContain("generatedMediaArtifactAuthority: 'ZavorthArtifact'");
    expect(boundary).toContain('liveGenerationCallsAllowed: false');
    expect(fixtures).toContain('normalizeExternalAgentProviderGenerationContracts({');
    expect(index).toContain("from './ExternalAgentProviderGenerationBoundary.js'");
  });

  it('keeps SDKs, source clients, output paths, media writers, and live generation blocked', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('provider SDK loader');
    expect(content).toContain('source generation client');
    expect(content).toContain('source output path authority');
    expect(content).toContain('source media writer');
    expect(content).toContain('generationExecutionAvailable: false');
    expect(content).toContain('providerGenerationExecutionAuthority: false');
    expect(content).toContain('sourceGenerationSdkLoaded');
    expect(content).toContain('sourceGenerationClientLoaded: false');
    expect(content).toContain('sourceOutputPathAuthority: false');
    expect(content).toContain('liveGenerationCallsAllowed: false');
    expect(content).toContain('Web search/fetch contracts are the eighth provider slice');
    expect(content).toContain('docs/134-wave-1-provider-web-search-fetch-boundary-slice.md');
    expect(content).toContain('Live provider calls, provider SDK loading');
  });
});
