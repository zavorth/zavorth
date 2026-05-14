import fs from 'node:fs';
import path from 'node:path';

const SLICE_DOC = 'docs/137-wave-1-plugin-command-descriptor-boundary-slice.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentPluginCommandDescriptorBoundary.ts';
const FIXTURE_FILE = 'src/runtime/external-agents/ExternalAgentWave1PluginCommandHttpFixtures.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Wave 1 plugin command descriptor boundary slice gate', () => {
  it('records plugin-command-descriptors as the only selected command/http implementation slice', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('Status: wave-1-plugin-command-descriptor-boundary-ready');
    expect(content).toContain('plugin-command-descriptors');
    expect(content).toContain('docs/135-wave-0-plugin-command-http-surfaces-matrix.md');
    expect(content).toContain('docs/136-wave-1-plugin-command-http-surfaces-test-design.md');
    expect(content).toContain('This slice does not authorize a real sidecar');
    expect(content).not.toContain('plugin-cli-command-surfaces selected');
    expect(content).not.toContain('source command execution authorized');
  });

  it('documents the Zavorth-owned command descriptor boundary, fixture handoff, and public export', () => {
    const content = read(SLICE_DOC);
    const boundary = read(BOUNDARY_FILE);
    const fixtures = read(FIXTURE_FILE);
    const index = read(INDEX_FILE);

    expect(content).toContain('ExternalAgentPluginCommandDescriptorBoundary.ts');
    expect(content).toContain('ExternalAgentWave1PluginCommandHttpFixtures.ts');
    expect(content).toContain('src/runtime/external-agents/index.ts');
    expect(boundary).toContain('normalizeExternalAgentPluginCommandDescriptors');
    expect(boundary).toContain("nativeContract: 'ZavorthPluginCommandDescriptorParity/v1'");
    expect(boundary).toContain('sourceCommandHandlersLoaded: false');
    expect(boundary).toContain('sourceCommandExecutionAuthority: false');
    expect(boundary).toContain('commandRuntimeIntroduced: false');
    expect(fixtures).toContain('normalizeExternalAgentPluginCommandDescriptors({');
    expect(index).toContain("from './ExternalAgentPluginCommandDescriptorBoundary.js'");
  });

  it('keeps source handler execution and live integration blocked while naming the next narrow row', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('source command execution');
    expect(content).toContain('source CLI process spawn');
    expect(content).toContain('source HTTP route');
    expect(content).toContain('source gateway method dispatch');
    expect(content).toContain('source service launch');
    expect(content).toContain('sourceCommandHandlersLoaded: false');
    expect(content).toContain('sourceCommandExecutionAuthority: false');
    expect(content).toContain('docs/138-wave-1-plugin-cli-command-surfaces-boundary-slice.md');
    expect(content).toContain('plugin-cli-command-surfaces');
    expect(content).toContain('Live source runtime integration remains blocked');
  });
});
