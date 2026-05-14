import fs from 'node:fs';
import path from 'node:path';

const MATRIX_DOC = 'docs/135-wave-0-plugin-command-http-surfaces-matrix.md';

const REQUIRED_READY_ITEMS = [
  'plugin-command-descriptors',
  'plugin-cli-command-surfaces',
  'plugin-gateway-method-surfaces',
  'plugin-http-route-surfaces',
  'plugin-service-surfaces',
  'plugin-tool-exposure-policy',
];

const REQUIRED_DEFERRED_OR_REJECTED_ITEMS = [
  'plugin-activation-setup-qa-runners',
  'plugin-source-command-implementation-modules',
];

function readMatrixDoc(): string {
  return fs.readFileSync(path.join(process.cwd(), MATRIX_DOC), 'utf8');
}

function lineFor(content: string, itemId: string): string {
  return content.split(/\r?\n/).find((line) => line.includes(`\`${itemId}\``)) || '';
}

describe('Wave 0 plugin command and HTTP surfaces matrix', () => {
  it('expands plugin-command-and-http-surfaces without authorizing execution', () => {
    const content = readMatrixDoc();
    const lower = content.toLowerCase();

    expect(content).toContain('Status: wave-0-plugin-command-http-surfaces-matrix-ready');
    expect(content).toContain('plugin-command-and-http-surfaces');
    expect(content).toContain('docs/118-wave-0-gateway-capability-matrix.md');
    expect(content).toContain('docs/134-wave-1-provider-web-search-fetch-boundary-slice.md');
    expect(lower).toContain('no real sidecar, real adapter');
    expect(lower).toContain('no source command execution');
    expect(lower).toContain('source http route registration');
    expect(lower).toContain('source service launch');
  });

  it('defines ready command/http rows with Zavorth contracts, decisions, and fixture gates', () => {
    const content = readMatrixDoc();

    REQUIRED_READY_ITEMS.forEach((itemId) => {
      const row = lineFor(content, itemId);
      expect(row).toContain(`\`${itemId}\``);
      expect(row).toMatch(/\| `(adapt|replace|externalize)` \|/);
      expect(row).toMatch(/Zavorth|ToolExposurePolicyInput|Command Center|Zavorth Agent Gateway/);
      expect(row).toMatch(/Add .* fixture before implementation/);
      expect(row).toContain('Wave-0-command-ready');
      expect(row.toLowerCase()).not.toContain('copy source module');
    });
  });

  it('keeps setup runners, implementation modules, and live integration blocked', () => {
    const content = readMatrixDoc();

    REQUIRED_DEFERRED_OR_REJECTED_ITEMS.forEach((itemId) => {
      const row = lineFor(content, itemId);
      expect(row).toContain(`\`${itemId}\``);
      expect(row).toMatch(/Wave-0-command-(deferred|rejected)/);
    });
    expect(content).toContain('docs/136-wave-1-plugin-command-http-surfaces-test-design.md');
    expect(content).toContain(
      'no real sidecar, real adapter, source command execution, source CLI execution, source HTTP route registration',
    );
    expect(content).toContain('plugin-cli-command-surfaces');
    expect(content).toContain('ExternalAgentPluginCliCommandSurfacesFixture.test.ts');
    expect(content).toContain('ExternalAgentPluginGatewayMethodSurfacesFixture.test.ts');
    expect(content).toContain('ExternalAgentPluginHttpRouteSurfacesFixture.test.ts');
    expect(content).toContain('ExternalAgentPluginServiceSurfacesFixture.test.ts');
    expect(content).toContain('ExternalAgentPluginToolExposurePolicyFixture.test.ts');
    expect(content).toContain('selected command/http fixture parity row set closed');
  });
});
