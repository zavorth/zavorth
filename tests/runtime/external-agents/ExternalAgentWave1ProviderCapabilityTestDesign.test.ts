import fs from 'node:fs';
import path from 'node:path';

const WAVE0_PROVIDER_DOC = 'docs/125-wave-0-provider-capability-contracts-matrix.md';
const WAVE1_PROVIDER_DOC = 'docs/126-wave-1-provider-capability-test-design.md';

const SELECTED_PROVIDER_ITEMS = [
  'provider-identity-catalog',
  'provider-secret-ref-boundary',
  'provider-embedding-contracts',
  'provider-speech-transcription-contracts',
  'provider-realtime-voice-contracts',
  'provider-media-understanding-contracts',
  'provider-generation-contracts',
  'provider-web-search-fetch-contracts',
];

const DEFERRED_PROVIDER_ITEMS = [
  'provider-activation-setup-qa-runners',
  'provider-source-implementation-modules',
  'plugin-command-and-http-surfaces',
];

const PLANNED_PARITY_TESTS = [
  'ExternalAgentProviderIdentityCatalogFixture.test.ts',
  'ExternalAgentProviderSecretRefBoundaryFixture.test.ts',
  'ExternalAgentProviderEmbeddingContractsFixture.test.ts',
  'ExternalAgentProviderSpeechTranscriptionFixture.test.ts',
  'ExternalAgentProviderRealtimeVoiceFixture.test.ts',
  'ExternalAgentProviderMediaUnderstandingFixture.test.ts',
  'ExternalAgentProviderGenerationFixture.test.ts',
  'ExternalAgentProviderWebSearchFetchFixture.test.ts',
];

function readDoc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function sectionBetween(content: string, startMarker: string, endMarker: string): string {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker, start + startMarker.length);

  if (start === -1) {
    return '';
  }

  return content.slice(start, end === -1 ? undefined : end);
}

function matrixRowFor(content: string, itemId: string): string {
  return content.split(/\r?\n/).find((line) => line.startsWith(`| \`${itemId}\``)) || '';
}

describe('Wave 1 provider capability test design', () => {
  it('records a provider design-only gate and blocks live implementation work', () => {
    const content = readDoc(WAVE1_PROVIDER_DOC);
    const lowerContent = content.toLowerCase();

    expect(content).toContain('Status: wave-1-provider-web-search-fetch-boundary-ready');
    expect(content).toContain(WAVE0_PROVIDER_DOC);
    expect(content).toContain('does not authorize implementation');
    expect(lowerContent).toContain('no fixture may load a provider sdk');
    expect(lowerContent).toContain('live provider call');
    expect(lowerContent).toContain('source state/config/credential migration');
    expect(lowerContent).not.toContain('implementation is authorized');
  });

  it('matches the Wave 0 provider selected row decision exactly', () => {
    const wave0 = readDoc(WAVE0_PROVIDER_DOC);
    const wave1 = readDoc(WAVE1_PROVIDER_DOC);
    const selectedSection = sectionBetween(
      wave1,
      '## Selected Provider Rows',
      'The following provider rows remain deferred',
    );

    SELECTED_PROVIDER_ITEMS.forEach((itemId) => {
      expect(wave0).toContain(itemId);
      expect(selectedSection).toContain(`\`${itemId}\``);
    });

    DEFERRED_PROVIDER_ITEMS.forEach((itemId) => {
      expect(selectedSection).not.toContain(`\`${itemId}\``);
    });
  });

  it('defines fixture sets, source evidence, Zavorth contracts, assertions, and blockers for each selected provider row', () => {
    const content = readDoc(WAVE1_PROVIDER_DOC);

    SELECTED_PROVIDER_ITEMS.forEach((itemId) => {
      const row = matrixRowFor(content, itemId);

      expect(row).toContain(`\`${itemId}\``);
      expect(row).toMatch(/`wave1\.providers\./);
      expect(row).toMatch(/src\/|extensions\//);
      expect(row).toMatch(/Zavorth|ExternalAgent|SecretRef|ToolExposurePolicyInput/);
      expect(row).toMatch(/Assert/);
      expect(row).toMatch(/Blocked until/);
    });
  });

  it('keeps credentials as SecretRef contracts and blocks source modules, setup commands, SDKs, and live calls', () => {
    const content = readDoc(WAVE1_PROVIDER_DOC);
    const deferredSection = sectionBetween(content, 'The following provider rows remain deferred', '## Design Rules');
    const matrix = sectionBetween(content, '## Wave 1 Provider Fixture Contract Matrix', '## Required Fixture Cases');

    DEFERRED_PROVIDER_ITEMS.forEach((itemId) => {
      expect(deferredSection).toContain(`\`${itemId}\``);
      expect(matrix).not.toContain(`\`${itemId}\``);
    });
    expect(content).toContain('Zavorth `SecretRef`');
    expect(content).toContain('secretref-env-mapping');
    expect(content).toContain('secretref-missing-secret');
    expect(content).toContain('Provider SDK/client hints remain blocked');
    expect(content).toContain('must not connect to a live provider');
    expect(content).toContain('must not');
    expect(content).toContain('import source modules into Zavorth source code');
  });

  it('requires deterministic provider parity tests before the identity-catalog slice can start', () => {
    const content = readDoc(WAVE1_PROVIDER_DOC);

    PLANNED_PARITY_TESTS.forEach((testFile) => {
      expect(content).toContain(testFile);
    });
    expect(content).toContain('Wave 1 provider design gate');
    expect(content).toContain('ExternalAgentWave1ProviderCapabilityFixtures.ts');
    expect(content).toContain('provider-identity-catalog selected and implemented as a Zavorth-owned provider identity catalog boundary in docs/127');
    expect(content).toContain('provider-secret-ref-boundary selected and implemented as a Zavorth-owned provider SecretRef boundary in docs/128');
    expect(content).toContain('provider-embedding-contracts selected and implemented as a Zavorth-owned provider embedding contracts boundary in docs/129');
    expect(content).toContain('provider-speech-transcription-contracts selected and implemented as a Zavorth-owned provider speech/transcription contracts boundary in docs/130');
    expect(content).toContain('provider-realtime-voice-contracts selected and implemented as a Zavorth-owned provider realtime voice contracts boundary in docs/131');
    expect(content).toContain('provider-media-understanding-contracts selected and implemented as a Zavorth-owned provider media understanding contracts boundary in docs/132');
    expect(content).toContain('provider-generation-contracts selected and implemented as a Zavorth-owned provider generation contracts boundary in docs/133');
    expect(content).toContain('provider-web-search-fetch-contracts selected and implemented as a Zavorth-owned provider web search/fetch contracts boundary in docs/134');
    expect(content).toContain('selected provider implementation row set closed; no remaining selected provider row in this design');
    expect(content).toContain('docs/127-wave-1-provider-identity-catalog-boundary-slice.md');
    expect(content).toContain('docs/128-wave-1-provider-secret-ref-boundary-slice.md');
    expect(content).toContain('docs/129-wave-1-provider-embedding-contracts-boundary-slice.md');
    expect(content).toContain('docs/130-wave-1-provider-speech-transcription-boundary-slice.md');
    expect(content).toContain('docs/131-wave-1-provider-realtime-voice-boundary-slice.md');
    expect(content).toContain('docs/132-wave-1-provider-media-understanding-boundary-slice.md');
    expect(content).toContain('docs/133-wave-1-provider-generation-boundary-slice.md');
    expect(content).toContain('docs/134-wave-1-provider-web-search-fetch-boundary-slice.md');
    expect(content).toContain('recommended next matrix after provider row-set closure: plugin-command-and-http-surfaces');
    expect(content).toContain('no real sidecar, real adapter, provider SDK load, live provider call');
    expect(content).toContain('source module copy');
  });
});
