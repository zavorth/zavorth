import fs from 'node:fs';
import path from 'node:path';

const SLICE_DOC = 'docs/131-wave-1-provider-realtime-voice-boundary-slice.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentProviderRealtimeVoiceBoundary.ts';
const FIXTURE_FILE = 'src/runtime/external-agents/ExternalAgentWave1ProviderCapabilityFixtures.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Wave 1 provider realtime voice boundary slice gate', () => {
  it('records provider-realtime-voice-contracts as the only selected provider implementation slice', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('Status: wave-1-provider-realtime-voice-boundary-ready');
    expect(content).toContain('provider-realtime-voice-contracts');
    expect(content).toContain('docs/125-wave-0-provider-capability-contracts-matrix.md');
    expect(content).toContain('docs/126-wave-1-provider-capability-test-design.md');
    expect(content).toContain('docs/127-wave-1-provider-identity-catalog-boundary-slice.md');
    expect(content).toContain('docs/128-wave-1-provider-secret-ref-boundary-slice.md');
    expect(content).toContain('docs/129-wave-1-provider-embedding-contracts-boundary-slice.md');
    expect(content).toContain('docs/130-wave-1-provider-speech-transcription-boundary-slice.md');
    expect(content).toContain('This slice does not authorize a real sidecar');
    expect(content).not.toContain('provider-media-understanding-contracts selected');
    expect(content).not.toContain('provider-generation-contracts selected');
    expect(content).not.toContain('provider-web-search-fetch-contracts selected');
  });

  it('documents the Zavorth-owned realtime voice boundary, fixture handoff, and public export', () => {
    const content = read(SLICE_DOC);
    const boundary = read(BOUNDARY_FILE);
    const fixtures = read(FIXTURE_FILE);
    const index = read(INDEX_FILE);

    expect(content).toContain('ExternalAgentProviderRealtimeVoiceBoundary.ts');
    expect(content).toContain('ExternalAgentWave1ProviderCapabilityFixtures.ts');
    expect(content).toContain('src/runtime/external-agents/index.ts');
    expect(boundary).toContain('normalizeExternalAgentProviderRealtimeVoiceContracts');
    expect(boundary).toContain('ZavorthRealtimeProviderContract/v1');
    expect(boundary).toContain('ZavorthRealtimeSessionContract/v1');
    expect(boundary).toContain('providerRealtimeRuntimeIntroduced: false');
    expect(boundary).toContain('providerRealtimeExecutionAuthority: false');
    expect(boundary).toContain('sourceRealtimeSdkLoaded: false');
    expect(boundary).toContain('sourceRealtimeClientLoaded: false');
    expect(boundary).toContain('sourceRealtimeSocketAuthority: false');
    expect(boundary).toContain('sourceRealtimeAudioStreamAuthority: false');
    expect(boundary).toContain('liveSocketAllowed: false');
    expect(boundary).toContain('audioStreamAllowed: false');
    expect(boundary).toContain('sourceEndpointIdsStoredAsEvidenceOnly: true');
    expect(fixtures).toContain('normalizeExternalAgentProviderRealtimeVoiceContracts({');
    expect(index).toContain("from './ExternalAgentProviderRealtimeVoiceBoundary.js'");
  });

  it('keeps SDKs, source clients, sockets, endpoint authority, and live audio blocked', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('provider SDK loader');
    expect(content).toContain('source realtime client');
    expect(content).toContain('source websocket');
    expect(content).toContain('live audio');
    expect(content).toContain('source endpoint authority');
    expect(content).toContain('realtimeExecutionAvailable: false');
    expect(content).toContain('providerRealtimeExecutionAuthority: false');
    expect(content).toContain('sourceRealtimeSdkLoaded: false');
    expect(content).toContain('sourceRealtimeClientLoaded: false');
    expect(content).toContain('sourceRealtimeSocketAuthority: false');
    expect(content).toContain('sourceRealtimeAudioStreamAuthority: false');
    expect(content).toContain('Media understanding contracts are the sixth provider slice');
    expect(content).toContain('docs/132-wave-1-provider-media-understanding-boundary-slice.md');
    expect(content).toContain('Live provider calls, provider SDK loading');
  });
});
