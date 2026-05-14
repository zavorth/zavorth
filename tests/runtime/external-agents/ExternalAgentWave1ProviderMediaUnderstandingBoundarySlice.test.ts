import fs from 'node:fs';
import path from 'node:path';

const SLICE_DOC = 'docs/132-wave-1-provider-media-understanding-boundary-slice.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentProviderMediaUnderstandingBoundary.ts';
const FIXTURE_FILE = 'src/runtime/external-agents/ExternalAgentWave1ProviderCapabilityFixtures.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Wave 1 provider media understanding boundary slice gate', () => {
  it('records provider-media-understanding-contracts as the only selected provider implementation slice', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('Status: wave-1-provider-media-understanding-boundary-ready');
    expect(content).toContain('provider-media-understanding-contracts');
    expect(content).toContain('docs/125-wave-0-provider-capability-contracts-matrix.md');
    expect(content).toContain('docs/126-wave-1-provider-capability-test-design.md');
    expect(content).toContain('docs/127-wave-1-provider-identity-catalog-boundary-slice.md');
    expect(content).toContain('docs/128-wave-1-provider-secret-ref-boundary-slice.md');
    expect(content).toContain('docs/129-wave-1-provider-embedding-contracts-boundary-slice.md');
    expect(content).toContain('docs/130-wave-1-provider-speech-transcription-boundary-slice.md');
    expect(content).toContain('docs/131-wave-1-provider-realtime-voice-boundary-slice.md');
    expect(content).toContain('This slice does not authorize a real sidecar');
    expect(content).not.toContain('provider-generation-contracts selected');
    expect(content).not.toContain('provider-web-search-fetch-contracts selected');
  });

  it('documents the Zavorth-owned media understanding boundary, fixture handoff, and public export', () => {
    const content = read(SLICE_DOC);
    const boundary = read(BOUNDARY_FILE);
    const fixtures = read(FIXTURE_FILE);
    const index = read(INDEX_FILE);

    expect(content).toContain('ExternalAgentProviderMediaUnderstandingBoundary.ts');
    expect(content).toContain('ExternalAgentWave1ProviderCapabilityFixtures.ts');
    expect(content).toContain('src/runtime/external-agents/index.ts');
    expect(boundary).toContain('normalizeExternalAgentProviderMediaUnderstandingContracts');
    expect(boundary).toContain('ZavorthMediaUnderstandingProviderContract/v1');
    expect(boundary).toContain('providerMediaUnderstandingRuntimeIntroduced: false');
    expect(boundary).toContain('providerMediaUnderstandingExecutionAuthority: false');
    expect(boundary).toContain('sourceMediaSdkLoaded: false');
    expect(boundary).toContain('sourceFileProcessorsLoaded: false');
    expect(boundary).toContain('sourceFileHandlersLoaded: false');
    expect(boundary).toContain('sourceFilePathAuthority: false');
    expect(boundary).toContain('attachmentInputsRequireZavorthArtifacts: true');
    expect(boundary).toContain('unsafeFileHandlersBlocked: true');
    expect(fixtures).toContain('normalizeExternalAgentProviderMediaUnderstandingContracts({');
    expect(index).toContain("from './ExternalAgentProviderMediaUnderstandingBoundary.js'");
  });

  it('keeps SDKs, file handlers, file processors, and source paths blocked', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('provider SDK loader');
    expect(content).toContain('source file handler');
    expect(content).toContain('source file processor');
    expect(content).toContain('source file path authority');
    expect(content).toContain('mediaUnderstandingExecutionAvailable: false');
    expect(content).toContain('providerMediaUnderstandingExecutionAuthority: false');
    expect(content).toContain('sourceMediaSdkLoaded: false');
    expect(content).toContain('sourceFileProcessorsLoaded: false');
    expect(content).toContain('sourceFileHandlersLoaded: false');
    expect(content).toContain('sourceFilePathAuthority: false');
    expect(content).toContain('Generation contracts are the seventh provider slice');
    expect(content).toContain('docs/133-wave-1-provider-generation-boundary-slice.md');
    expect(content).toContain('Live provider calls, provider SDK loading');
  });
});
