import fs from 'node:fs';
import path from 'node:path';

const SLICE_DOC = 'docs/142-wave-1-plugin-tool-exposure-policy-boundary-slice.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentPluginToolExposurePolicyBoundary.ts';
const FIXTURE_FILE = 'src/runtime/external-agents/ExternalAgentWave1PluginCommandHttpFixtures.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Wave 1 plugin tool exposure policy boundary slice gate', () => {
  it('records plugin-tool-exposure-policy as the only selected command/http implementation slice', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('Status: wave-1-plugin-tool-exposure-policy-boundary-ready');
    expect(content).toContain('plugin-tool-exposure-policy');
    expect(content).toContain('docs/135-wave-0-plugin-command-http-surfaces-matrix.md');
    expect(content).toContain('docs/136-wave-1-plugin-command-http-surfaces-test-design.md');
    expect(content).toContain('docs/137-wave-1-plugin-command-descriptor-boundary-slice.md');
    expect(content).toContain('docs/138-wave-1-plugin-cli-command-surfaces-boundary-slice.md');
    expect(content).toContain('docs/139-wave-1-plugin-gateway-method-surfaces-boundary-slice.md');
    expect(content).toContain('docs/140-wave-1-plugin-http-route-surfaces-boundary-slice.md');
    expect(content).toContain('docs/141-wave-1-plugin-service-surfaces-boundary-slice.md');
    expect(content).toContain('This slice does not authorize a real sidecar');
    expect(content).not.toContain('source tool execution authorized');
    expect(content).not.toContain('source approval authority granted');
  });

  it('documents the Zavorth-owned tool exposure policy boundary, fixture handoff, and public export', () => {
    const content = read(SLICE_DOC);
    const boundary = read(BOUNDARY_FILE);
    const fixtures = read(FIXTURE_FILE);
    const index = read(INDEX_FILE);

    expect(content).toContain('ExternalAgentPluginToolExposurePolicyBoundary.ts');
    expect(content).toContain('ExternalAgentWave1PluginCommandHttpFixtures.ts');
    expect(content).toContain('src/runtime/external-agents/index.ts');
    expect(boundary).toContain('normalizeExternalAgentPluginToolExposurePolicy');
    expect(boundary).toContain("nativeContract: 'ZavorthPluginToolExposurePolicyParity/v1'");
    expect(boundary).toContain('sourceApprovalHintsGrantAuthority: false');
    expect(boundary).toContain('sourceToolPolicyAuthority: false');
    expect(boundary).toContain('sourceToolsExecuted: false');
    expect(boundary).toContain('toolExposureRuntimeIntroduced: false');
    expect(fixtures).toContain('normalizeExternalAgentPluginToolExposurePolicyBoundary({');
    expect(index).toContain("from './ExternalAgentPluginToolExposurePolicyBoundary.js'");
  });

  it('keeps source policy authority and live integration blocked while closing the selected row set', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('source command execution');
    expect(content).toContain('source CLI process spawn');
    expect(content).toContain('source HTTP route registration');
    expect(content).toContain('source gateway method dispatch');
    expect(content).toContain('source service launch');
    expect(content).toContain('source tool execution');
    expect(content).toContain('source approval authority');
    expect(content).toContain('sourceApprovalHintsGrantAuthority: false');
    expect(content).toContain('sourceToolPolicyAuthority: false');
    expect(content).toContain('sourceToolsExecuted: false');
    expect(content).toContain('all six selected');
    expect(content).toContain('Live source runtime integration remains blocked');
  });
});
