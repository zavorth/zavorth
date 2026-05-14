import fs from 'node:fs';
import path from 'node:path';

const SLICE_DOC = 'docs/120-wave-1-protocol-frame-boundary-slice.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentGatewayProtocolBoundary.ts';
const FIXTURE_FILE = 'src/runtime/external-agents/ExternalAgentWave1GatewayCapabilityFixtures.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Wave 1 protocol frame boundary slice gate', () => {
  it('records gw-protocol-frames as the only selected implementation slice', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('Status: wave-1-protocol-frame-boundary-ready');
    expect(content).toContain('gw-protocol-frames');
    expect(content).toContain('docs/119-wave-1-gateway-capability-test-design.md');
    expect(content).toContain('This slice does not authorize a real sidecar');
    expect(content).not.toContain('gw-connect-handshake selected');
  });

  it('documents the Zavorth-owned boundary, fixture handoff, and public export', () => {
    const content = read(SLICE_DOC);
    const boundary = read(BOUNDARY_FILE);
    const fixtures = read(FIXTURE_FILE);
    const index = read(INDEX_FILE);

    expect(content).toContain('ExternalAgentGatewayProtocolBoundary.ts');
    expect(content).toContain('ExternalAgentWave1GatewayCapabilityFixtures.ts');
    expect(content).toContain('src/runtime/external-agents/index.ts');
    expect(boundary).toContain('normalizeExternalAgentGatewayProtocolFrame');
    expect(fixtures).toContain('normalizeExternalAgentGatewayProtocolFrame(frame');
    expect(index).toContain("from './ExternalAgentGatewayProtocolBoundary.js'");
  });

  it('keeps live integration blocked and names the next narrow row only', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('The boundary does not connect, execute, mutate, send, launch, or load source');
    expect(content).toContain('docs/121-wave-1-handshake-boundary-slice.md');
    expect(content).toContain('docs/122-wave-1-event-stream-boundary-slice.md');
    expect(content).toContain('docs/123-wave-1-plugin-manifest-registry-boundary-slice.md');
    expect(content).toContain('docs/124-wave-1-plugin-runtime-registry-boundary-slice.md');
    expect(content).toContain('selected covered Wave 1 row set is now closed');
    expect(content).toContain('Live source runtime integration remains blocked');
    expect(content).toContain('Provider capability contracts and plugin command/HTTP surfaces remain');
  });
});
