import fs from 'node:fs';
import path from 'node:path';

const SLICE_DOC = 'docs/121-wave-1-handshake-boundary-slice.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentGatewayHandshakeBoundary.ts';
const FIXTURE_FILE = 'src/runtime/external-agents/ExternalAgentWave1GatewayCapabilityFixtures.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Wave 1 handshake boundary slice gate', () => {
  it('records gw-connect-handshake as the only selected implementation slice', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('Status: wave-1-handshake-boundary-ready');
    expect(content).toContain('gw-connect-handshake');
    expect(content).toContain('docs/119-wave-1-gateway-capability-test-design.md');
    expect(content).toContain('docs/120-wave-1-protocol-frame-boundary-slice.md');
    expect(content).toContain('This slice does not authorize a real sidecar');
    expect(content).not.toContain('provider-capability-contracts selected');
  });

  it('documents the Zavorth-owned handshake boundary, fixture handoff, and public export', () => {
    const content = read(SLICE_DOC);
    const boundary = read(BOUNDARY_FILE);
    const fixtures = read(FIXTURE_FILE);
    const index = read(INDEX_FILE);

    expect(content).toContain('ExternalAgentGatewayHandshakeBoundary.ts');
    expect(content).toContain('ExternalAgentWave1GatewayCapabilityFixtures.ts');
    expect(content).toContain('src/runtime/external-agents/index.ts');
    expect(boundary).toContain('normalizeExternalAgentGatewayHandshake');
    expect(boundary).toContain('sourceTokenAuthority: false');
    expect(boundary).toContain('source-token:${tokenEvidence}');
    expect(fixtures).toContain('normalizeExternalAgentGatewayHandshake(fixture');
    expect(index).toContain("from './ExternalAgentGatewayHandshakeBoundary.js'");
  });

  it('keeps live integration and source token authority blocked while naming the next narrow row', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('Zavorth remains the only trust authority');
    expect(content).toContain('Source tokens are never returned or promoted');
    expect(content).toContain('The boundary does not connect, execute, mutate, send, launch, or load source');
    expect(content).toContain('docs/122-wave-1-event-stream-boundary-slice.md');
    expect(content).toContain('docs/123-wave-1-plugin-manifest-registry-boundary-slice.md');
    expect(content).toContain('docs/124-wave-1-plugin-runtime-registry-boundary-slice.md');
    expect(content).toContain('selected covered Wave 1 row set is now closed');
    expect(content).toContain('Live source runtime integration remains blocked');
  });
});
