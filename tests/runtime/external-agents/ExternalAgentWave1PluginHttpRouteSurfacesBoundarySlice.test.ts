import fs from 'node:fs';
import path from 'node:path';

const SLICE_DOC = 'docs/140-wave-1-plugin-http-route-surfaces-boundary-slice.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentPluginHttpRouteSurfaceBoundary.ts';
const FIXTURE_FILE = 'src/runtime/external-agents/ExternalAgentWave1PluginCommandHttpFixtures.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Wave 1 plugin HTTP route surfaces boundary slice gate', () => {
  it('records plugin-http-route-surfaces as the only selected command/http implementation slice', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('Status: wave-1-plugin-http-route-surfaces-boundary-ready');
    expect(content).toContain('plugin-http-route-surfaces');
    expect(content).toContain('docs/135-wave-0-plugin-command-http-surfaces-matrix.md');
    expect(content).toContain('docs/136-wave-1-plugin-command-http-surfaces-test-design.md');
    expect(content).toContain('docs/137-wave-1-plugin-command-descriptor-boundary-slice.md');
    expect(content).toContain('docs/138-wave-1-plugin-cli-command-surfaces-boundary-slice.md');
    expect(content).toContain('docs/139-wave-1-plugin-gateway-method-surfaces-boundary-slice.md');
    expect(content).toContain('This slice does not authorize a real sidecar');
    expect(content).not.toContain('plugin-service-surfaces selected');
    expect(content).not.toContain('source HTTP route registration authorized');
  });

  it('documents the Zavorth-owned HTTP route surface boundary, fixture handoff, and public export', () => {
    const content = read(SLICE_DOC);
    const boundary = read(BOUNDARY_FILE);
    const fixtures = read(FIXTURE_FILE);
    const index = read(INDEX_FILE);

    expect(content).toContain('ExternalAgentPluginHttpRouteSurfaceBoundary.ts');
    expect(content).toContain('ExternalAgentWave1PluginCommandHttpFixtures.ts');
    expect(content).toContain('src/runtime/external-agents/index.ts');
    expect(boundary).toContain('normalizeExternalAgentPluginHttpRouteSurfaces');
    expect(boundary).toContain("nativeContract: 'ZavorthPluginHttpRouteSurfaceParity/v1'");
    expect(boundary).toContain('sourceHttpRoutesRegistered: false');
    expect(boundary).toContain('sourceHttpRouteAuthority: false');
    expect(boundary).toContain('httpRouteRuntimeIntroduced: false');
    expect(fixtures).toContain('normalizeExternalAgentPluginHttpRouteSurfaces({');
    expect(index).toContain("from './ExternalAgentPluginHttpRouteSurfaceBoundary.js'");
  });

  it('keeps source route registration and live integration blocked while naming the next narrow row', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('source command execution');
    expect(content).toContain('source CLI process spawn');
    expect(content).toContain('source HTTP route registration');
    expect(content).toContain('source gateway method dispatch');
    expect(content).toContain('source service launch');
    expect(content).toContain('sourceHttpRoutesRegistered: false');
    expect(content).toContain('sourceHttpRouteAuthority: false');
    expect(content).toContain('docs/141-wave-1-plugin-service-surfaces-boundary-slice.md');
    expect(content).toContain('plugin-service-surfaces');
    expect(content).toContain('Live source runtime integration remains blocked');
  });
});
