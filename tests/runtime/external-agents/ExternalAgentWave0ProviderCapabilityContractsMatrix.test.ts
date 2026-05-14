import fs from 'node:fs';
import path from 'node:path';

const MATRIX_DOC = 'docs/125-wave-0-provider-capability-contracts-matrix.md';

const REQUIRED_READY_ITEMS = [
  'provider-identity-catalog',
  'provider-secret-ref-boundary',
  'provider-embedding-contracts',
  'provider-speech-transcription-contracts',
  'provider-realtime-voice-contracts',
  'provider-media-understanding-contracts',
  'provider-generation-contracts',
  'provider-web-search-fetch-contracts',
];

const REQUIRED_DEFERRED_OR_REJECTED_ITEMS = [
  'provider-activation-setup-qa-runners',
  'provider-source-implementation-modules',
];

function readMatrixDoc(): string {
  return fs.readFileSync(path.join(process.cwd(), MATRIX_DOC), 'utf8');
}

function lineFor(content: string, itemId: string): string {
  return content.split(/\r?\n/).find((line) => line.includes(`\`${itemId}\``)) || '';
}

describe('Wave 0 provider capability contracts matrix', () => {
  it('expands provider-capability-contracts without authorizing implementation', () => {
    const content = readMatrixDoc();
    const lower = content.toLowerCase();

    expect(content).toContain('Status: wave-0-provider-capability-contracts-matrix-ready');
    expect(content).toContain('provider-capability-contracts');
    expect(content).toContain('docs/118-wave-0-gateway-capability-matrix.md');
    expect(content).toContain('docs/124-wave-1-plugin-runtime-registry-boundary-slice.md');
    expect(lower).toContain('no real sidecar, real adapter');
    expect(lower).toContain('no source provider sdk');
    expect(lower).toContain('live provider calls remain blocked');
  });

  it('defines ready provider rows with decisions, Zavorth contracts, SecretRef policy, and test gates', () => {
    const content = readMatrixDoc();

    REQUIRED_READY_ITEMS.forEach((itemId) => {
      const row = lineFor(content, itemId);
      expect(row).toContain(`\`${itemId}\``);
      expect(row).toMatch(/\| `(absorb|adapt|replace)` \|/);
      expect(row).toMatch(/Zavorth|ExternalAgent|ToolExposurePolicyInput|SecretRef/);
      expect(row).toMatch(/Add .* fixture test before implementation/);
      expect(row).toContain('Wave-0-provider-ready');
      expect(row.toLowerCase()).not.toContain('copy source module');
    });
  });

  it('keeps executable setup, command surfaces, source modules, and live integration blocked', () => {
    const content = readMatrixDoc();

    REQUIRED_DEFERRED_OR_REJECTED_ITEMS.forEach((itemId) => {
      const row = lineFor(content, itemId);
      expect(row).toContain(`\`${itemId}\``);
      expect(row).toMatch(/Wave-0-provider-(deferred|rejected)/);
    });
    expect(content).toContain('docs/126-wave-1-provider-capability-test-design.md');
    expect(content).toContain('Plugin command and HTTP surfaces remain deferred');
    expect(content).toContain('no real sidecar, real adapter, provider SDK load, live provider call');
  });
});
