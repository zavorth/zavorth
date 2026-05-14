import fs from 'node:fs';
import path from 'node:path';

const SLICE_DOC = 'docs/130-wave-1-provider-speech-transcription-boundary-slice.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentProviderSpeechTranscriptionBoundary.ts';
const FIXTURE_FILE = 'src/runtime/external-agents/ExternalAgentWave1ProviderCapabilityFixtures.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Wave 1 provider speech/transcription boundary slice gate', () => {
  it('records provider-speech-transcription-contracts as the only selected provider implementation slice', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('Status: wave-1-provider-speech-transcription-boundary-ready');
    expect(content).toContain('provider-speech-transcription-contracts');
    expect(content).toContain('docs/125-wave-0-provider-capability-contracts-matrix.md');
    expect(content).toContain('docs/126-wave-1-provider-capability-test-design.md');
    expect(content).toContain('docs/127-wave-1-provider-identity-catalog-boundary-slice.md');
    expect(content).toContain('docs/128-wave-1-provider-secret-ref-boundary-slice.md');
    expect(content).toContain('docs/129-wave-1-provider-embedding-contracts-boundary-slice.md');
    expect(content).toContain('This slice does not authorize a real sidecar');
    expect(content).not.toContain('provider-realtime-voice-contracts selected');
    expect(content).not.toContain('provider-generation-contracts selected');
    expect(content).not.toContain('provider-web-search-fetch-contracts selected');
  });

  it('documents the Zavorth-owned speech/transcription boundary, fixture handoff, and public export', () => {
    const content = read(SLICE_DOC);
    const boundary = read(BOUNDARY_FILE);
    const fixtures = read(FIXTURE_FILE);
    const index = read(INDEX_FILE);

    expect(content).toContain('ExternalAgentProviderSpeechTranscriptionBoundary.ts');
    expect(content).toContain('ExternalAgentWave1ProviderCapabilityFixtures.ts');
    expect(content).toContain('src/runtime/external-agents/index.ts');
    expect(boundary).toContain('normalizeExternalAgentProviderSpeechTranscriptionContracts');
    expect(boundary).toContain('ZavorthSpeechProviderContract/v1');
    expect(boundary).toContain('providerSpeechRuntimeIntroduced: false');
    expect(boundary).toContain('providerSpeechExecutionAuthority: false');
    expect(boundary).toContain('sourceSpeechSdkLoaded: false');
    expect(boundary).toContain('sourceAudioHelpersLoaded: false');
    expect(boundary).toContain('sourceAudioOutputPathAuthority: false');
    expect(boundary).toContain('liveAudioTranscriptionAllowed: false');
    expect(boundary).toContain('sourceVoiceModelsStoredAsEvidenceOnly: true');
    expect(boundary).toContain('audioInputRequiresZavorthArtifact: true');
    expect(fixtures).toContain('normalizeExternalAgentProviderSpeechTranscriptionContracts({');
    expect(index).toContain("from './ExternalAgentProviderSpeechTranscriptionBoundary.js'");
  });

  it('keeps SDKs, live audio, source helpers, and source output paths blocked', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('provider SDK loader');
    expect(content).toContain('source TTS');
    expect(content).toContain('live audio');
    expect(content).toContain('source output path');
    expect(content).toContain('speechExecutionAvailable: false');
    expect(content).toContain('providerSpeechExecutionAuthority: false');
    expect(content).toContain('sourceSpeechSdkLoaded: false');
    expect(content).toContain('sourceAudioHelpersLoaded: false');
    expect(content).toContain('sourceAudioOutputPathAuthority: false');
    expect(content).toContain('liveAudioTranscriptionAllowed: false');
    expect(content).toContain('Realtime voice contracts are the fifth provider slice');
    expect(content).toContain('docs/131-wave-1-provider-realtime-voice-boundary-slice.md');
    expect(content).toContain('Live provider calls, provider SDK loading');
  });
});
