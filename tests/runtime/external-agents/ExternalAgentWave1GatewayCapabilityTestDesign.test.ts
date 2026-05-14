import fs from 'node:fs';
import path from 'node:path';

const WAVE0_DOC = 'docs/118-wave-0-gateway-capability-matrix.md';
const WAVE1_DOC = 'docs/119-wave-1-gateway-capability-test-design.md';

const SELECTED_WAVE1_ITEMS = [
  'gw-protocol-frames',
  'gw-connect-handshake',
  'gw-event-stream',
  'plugin-manifest-registry',
  'plugin-runtime-registry',
];

const DEFERRED_ITEMS = [
  'provider-capability-contracts',
  'plugin-command-and-http-surfaces',
];

const FUTURE_PARITY_TESTS = [
  'ExternalAgentGatewayProtocolFrameParity.test.ts',
  'ExternalAgentGatewayHandshakeTrust.test.ts',
  'ExternalAgentGatewayEventStreamProjection.test.ts',
  'ExternalAgentPluginManifestRegistryFixture.test.ts',
  'ExternalAgentPluginRuntimeRegistryFixture.test.ts',
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

describe('Wave 1 gateway and capability test design', () => {
  it('records a design-only gate and blocks live implementation work', () => {
    const content = readDoc(WAVE1_DOC);
    const lowerContent = content.toLowerCase();

    expect(content).toContain('Status: wave-1-covered-row-set-closed');
    expect(content).toContain(WAVE0_DOC);
    expect(content).toContain('does not authorize implementation');
    expect(lowerContent).toContain('no real sidecar, real adapter, source module copy');
    expect(lowerContent).toContain('no fixture may launch, connect to, execute, mutate, or send');
    expect(lowerContent).not.toContain('implementation is authorized');
  });

  it('matches the Wave 0 selected row decision exactly', () => {
    const wave0 = readDoc(WAVE0_DOC);
    const wave1 = readDoc(WAVE1_DOC);
    const selectedSection = sectionBetween(
      wave1,
      '## Selected Wave 1 Rows',
      'The following rows remain deferred',
    );

    SELECTED_WAVE1_ITEMS.forEach((itemId) => {
      expect(wave0).toContain(itemId);
      expect(selectedSection).toContain(`\`${itemId}\``);
    });

    DEFERRED_ITEMS.forEach((itemId) => {
      expect(selectedSection).not.toContain(`\`${itemId}\``);
    });
  });

  it('defines fixture sets, source evidence, Zavorth contracts, assertions, and blockers for each selected row', () => {
    const content = readDoc(WAVE1_DOC);

    SELECTED_WAVE1_ITEMS.forEach((itemId) => {
      const row = matrixRowFor(content, itemId);

      expect(row).toContain(`\`${itemId}\``);
      expect(row).toMatch(/`wave1\./);
      expect(row).toMatch(/src\//);
      expect(row).toMatch(/ExternalAgent|NormalizedInboundMessage|ToolExposurePolicyInput|Zavorth/);
      expect(row).toMatch(/Assert/);
      expect(row).toMatch(/Blocked until/);
    });
  });

  it('keeps deferred provider and command surfaces outside the Wave 1 fixture design', () => {
    const content = readDoc(WAVE1_DOC);
    const deferredSection = sectionBetween(content, 'The following rows remain deferred', '## Design Rules');
    const matrix = sectionBetween(content, '## Wave 1 Fixture Contract Matrix', '## Required Fixture Cases');

    DEFERRED_ITEMS.forEach((itemId) => {
      expect(deferredSection).toContain(`\`${itemId}\``);
      expect(matrix).not.toContain(`\`${itemId}\``);
    });
  });

  it('requires deterministic fixture parity tests before implementation can start', () => {
    const content = readDoc(WAVE1_DOC);

    FUTURE_PARITY_TESTS.forEach((testFile) => {
      expect(content).toContain(testFile);
    });
    expect(content).toContain('Completed fixture parity tests');
    expect(content).toMatch(/do not connect to a live\s+source runtime/);
    expect(content).toContain('no real sidecar, real adapter, source module copy, live source runtime dependency, or adapter removal');
    expect(content).toContain('docs/120-wave-1-protocol-frame-boundary-slice.md');
    expect(content).toContain('docs/121-wave-1-handshake-boundary-slice.md');
    expect(content).toContain('docs/122-wave-1-event-stream-boundary-slice.md');
    expect(content).toContain('docs/123-wave-1-plugin-manifest-registry-boundary-slice.md');
    expect(content).toContain('docs/124-wave-1-plugin-runtime-registry-boundary-slice.md');
  });
});
