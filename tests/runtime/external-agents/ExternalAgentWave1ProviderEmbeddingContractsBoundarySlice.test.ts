import fs from 'node:fs';
import path from 'node:path';

const SLICE_DOC = 'docs/129-wave-1-provider-embedding-contracts-boundary-slice.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentProviderEmbeddingContractsBoundary.ts';
const FIXTURE_FILE = 'src/runtime/external-agents/ExternalAgentWave1ProviderCapabilityFixtures.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Wave 1 provider embedding contracts boundary slice gate', () => {
  it('records provider-embedding-contracts as the only selected provider implementation slice', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('Status: wave-1-provider-embedding-contracts-boundary-ready');
    expect(content).toContain('provider-embedding-contracts');
    expect(content).toContain('docs/125-wave-0-provider-capability-contracts-matrix.md');
    expect(content).toContain('docs/126-wave-1-provider-capability-test-design.md');
    expect(content).toContain('docs/127-wave-1-provider-identity-catalog-boundary-slice.md');
    expect(content).toContain('docs/128-wave-1-provider-secret-ref-boundary-slice.md');
    expect(content).toContain('This slice does not authorize a real sidecar');
    expect(content).not.toContain('provider-speech-transcription-contracts selected');
    expect(content).not.toContain('provider-realtime-voice-contracts selected');
    expect(content).not.toContain('provider-web-search-fetch-contracts selected');
  });

  it('documents the Zavorth-owned embedding boundary, fixture handoff, and public export', () => {
    const content = read(SLICE_DOC);
    const boundary = read(BOUNDARY_FILE);
    const fixtures = read(FIXTURE_FILE);
    const index = read(INDEX_FILE);

    expect(content).toContain('ExternalAgentProviderEmbeddingContractsBoundary.ts');
    expect(content).toContain('ExternalAgentWave1ProviderCapabilityFixtures.ts');
    expect(content).toContain('src/runtime/external-agents/index.ts');
    expect(boundary).toContain('normalizeExternalAgentProviderEmbeddingContracts');
    expect(boundary).toContain('ZavorthEmbeddingProviderContract/v1');
    expect(boundary).toContain('providerEmbeddingRuntimeIntroduced: false');
    expect(boundary).toContain('providerEmbeddingExecutionAuthority: false');
    expect(boundary).toContain('sourceEmbeddingSdkLoaded: false');
    expect(boundary).toContain('sourceEmbeddingClientModuleLoaded: false');
    expect(boundary).toContain('sourceEmbeddingModelsStoredAsEvidenceOnly: true');
    expect(boundary).toContain('vectorIndexMutationAllowed: false');
    expect(boundary).toContain("blockedToolReason: 'provider-runtime-not-implemented'");
    expect(fixtures).toContain('normalizeExternalAgentProviderEmbeddingContracts({');
    expect(index).toContain("from './ExternalAgentProviderEmbeddingContractsBoundary.js'");
  });

  it('keeps SDKs, execution, source modules, and vector writes blocked', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('provider SDK loader');
    expect(content).toContain('source embedding client module load');
    expect(content).toContain('source vector');
    expect(content).toContain('executionAvailable: false');
    expect(content).toContain('providerEmbeddingExecutionAuthority: false');
    expect(content).toContain('sourceEmbeddingSdkLoaded: false');
    expect(content).toContain('sourceEmbeddingClientModuleLoaded: false');
    expect(content).toContain('vectorIndexMutationAllowed');
    expect(content).toContain('provider.embedding.execute');
    expect(content).toContain('Speech/transcription contracts are the fourth provider slice');
    expect(content).toContain('docs/130-wave-1-provider-speech-transcription-boundary-slice.md');
    expect(content).toContain('Live provider calls, provider SDK loading');
  });
});
