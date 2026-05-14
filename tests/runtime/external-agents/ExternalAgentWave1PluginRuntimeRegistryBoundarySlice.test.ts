import fs from 'node:fs';
import path from 'node:path';

const SLICE_DOC = 'docs/124-wave-1-plugin-runtime-registry-boundary-slice.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentPluginRuntimeRegistryBoundary.ts';
const FIXTURE_FILE = 'src/runtime/external-agents/ExternalAgentWave1GatewayCapabilityFixtures.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Wave 1 plugin runtime registry boundary slice gate', () => {
  it('records plugin-runtime-registry as the only selected implementation slice', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('Status: wave-1-plugin-runtime-registry-boundary-ready');
    expect(content).toContain('plugin-runtime-registry');
    expect(content).toContain('docs/119-wave-1-gateway-capability-test-design.md');
    expect(content).toContain('docs/120-wave-1-protocol-frame-boundary-slice.md');
    expect(content).toContain('docs/121-wave-1-handshake-boundary-slice.md');
    expect(content).toContain('docs/122-wave-1-event-stream-boundary-slice.md');
    expect(content).toContain('docs/123-wave-1-plugin-manifest-registry-boundary-slice.md');
    expect(content).toContain('This slice does not authorize a real sidecar');
    expect(content).not.toContain('provider-capability-contracts selected');
    expect(content).not.toContain('plugin-command-and-http-surfaces selected');
  });

  it('documents the Zavorth-owned runtime registry boundary, fixture handoff, and public export', () => {
    const content = read(SLICE_DOC);
    const boundary = read(BOUNDARY_FILE);
    const fixtures = read(FIXTURE_FILE);
    const index = read(INDEX_FILE);

    expect(content).toContain('ExternalAgentPluginRuntimeRegistryBoundary.ts');
    expect(content).toContain('ExternalAgentWave1GatewayCapabilityFixtures.ts');
    expect(content).toContain('src/runtime/external-agents/index.ts');
    expect(boundary).toContain('normalizeExternalAgentPluginRuntimeRegistry');
    expect(boundary).toContain('sourceRuntimeRegistryIntroduced: false');
    expect(boundary).toContain('sourceRuntimeImplementationsLoaded: false');
    expect(boundary).toContain('sourceRuntimeExecutionAuthority: false');
    expect(boundary).toContain('metadataOnlyRecords');
    expect(fixtures).toContain('normalizeExternalAgentPluginRuntimeRegistry({');
    expect(index).toContain("from './ExternalAgentPluginRuntimeRegistryBoundary.js'");
  });

  it('keeps live integration blocked and closes the covered Wave 1 row set', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('source runtime registry import');
    expect(content).toContain('The boundary does not connect, execute, mutate, send, launch, load source');
    expect(content).toContain('sourceRuntimeRegistryIntroduced: false');
    expect(content).toContain('sourceRuntimeImplementationsLoaded: false');
    expect(content).toContain('sourceRuntimeExecutionAuthority: false');
    expect(content).toContain('No additional Wave 1 implementation slice is authorized');
    expect(content).toContain('fresh Wave 0 submatrix');
    expect(content).toContain('Live source runtime integration');
  });
});
