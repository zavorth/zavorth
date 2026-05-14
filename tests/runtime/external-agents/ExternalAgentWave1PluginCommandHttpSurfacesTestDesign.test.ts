import fs from 'node:fs';
import path from 'node:path';

const WAVE0_COMMAND_HTTP_DOC = 'docs/135-wave-0-plugin-command-http-surfaces-matrix.md';
const WAVE1_COMMAND_HTTP_DOC = 'docs/136-wave-1-plugin-command-http-surfaces-test-design.md';

const SELECTED_COMMAND_HTTP_ITEMS = [
  'plugin-command-descriptors',
  'plugin-cli-command-surfaces',
  'plugin-gateway-method-surfaces',
  'plugin-http-route-surfaces',
  'plugin-service-surfaces',
  'plugin-tool-exposure-policy',
];

const DEFERRED_OR_REJECTED_COMMAND_HTTP_ITEMS = [
  'plugin-activation-setup-qa-runners',
  'plugin-source-command-implementation-modules',
];

const PLANNED_PARITY_TESTS = [
    'ExternalAgentPluginCommandDescriptorFixture.test.ts',
    'ExternalAgentPluginCliCommandSurfacesFixture.test.ts',
    'ExternalAgentPluginGatewayMethodSurfacesFixture.test.ts',
    'ExternalAgentPluginHttpRouteSurfacesFixture.test.ts',
    'ExternalAgentPluginServiceSurfacesFixture.test.ts',
    'ExternalAgentPluginToolExposurePolicyFixture.test.ts',
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

describe('Wave 1 plugin command and HTTP surfaces test design', () => {
  it('records a command/http design-only gate and blocks live implementation work', () => {
    const content = readDoc(WAVE1_COMMAND_HTTP_DOC);
    const lowerContent = content.toLowerCase();

    expect(content).toContain('Status: wave-1-plugin-command-http-fixture-parity-row-set-closed');
    expect(content).toContain(WAVE0_COMMAND_HTTP_DOC);
    expect(content).toContain('does not authorize implementation');
    expect(lowerContent).toContain('no fixture may execute a source command');
    expect(lowerContent).toContain('source cli execution');
    expect(lowerContent).toContain('source http route registration');
    expect(lowerContent).toContain('source state/config/credential migration');
    expect(lowerContent).not.toContain('implementation is authorized');
  });

  it('matches the Wave 0 command/http selected row decision exactly', () => {
    const wave0 = readDoc(WAVE0_COMMAND_HTTP_DOC);
    const wave1 = readDoc(WAVE1_COMMAND_HTTP_DOC);
    const selectedSection = sectionBetween(
      wave1,
      '## Selected Command/HTTP Rows',
      'The following command/HTTP rows remain deferred',
    );

    SELECTED_COMMAND_HTTP_ITEMS.forEach((itemId) => {
      expect(wave0).toContain(itemId);
      expect(selectedSection).toContain(`\`${itemId}\``);
    });

    DEFERRED_OR_REJECTED_COMMAND_HTTP_ITEMS.forEach((itemId) => {
      expect(selectedSection).not.toContain(`\`${itemId}\``);
    });
  });

  it('defines fixture sets, source evidence, Zavorth contracts, assertions, and blockers for each selected command/http row', () => {
    const content = readDoc(WAVE1_COMMAND_HTTP_DOC);

    SELECTED_COMMAND_HTTP_ITEMS.forEach((itemId) => {
      const row = matrixRowFor(content, itemId);

      expect(row).toContain(`\`${itemId}\``);
      expect(row).toMatch(/`wave1\.commandHttp\./);
      expect(row).toMatch(/src\/|extensions\/|external-executor\.mjs/);
      expect(row).toMatch(/Zavorth|ToolExposurePolicyInput|Command Center|Zavorth Agent Gateway|ZavorthWorkerStatus/);
      expect(row).toMatch(/Assert/);
      expect(row).toMatch(/Blocked until/);
    });
  });

  it('keeps setup runners, implementation modules, command execution, and route registration blocked', () => {
    const content = readDoc(WAVE1_COMMAND_HTTP_DOC);
    const deferredSection = sectionBetween(content, 'The following command/HTTP rows remain deferred', '## Design Rules');
    const matrix = sectionBetween(content, '## Wave 1 Command/HTTP Fixture Contract Matrix', '## Required Fixture Cases');

    DEFERRED_OR_REJECTED_COMMAND_HTTP_ITEMS.forEach((itemId) => {
      expect(deferredSection).toContain(`\`${itemId}\``);
      expect(matrix).not.toContain(`\`${itemId}\``);
    });
    expect(content).toContain('command-descriptor-handler-blocked');
    expect(content).toContain('cli-process-spawn-blocked');
    expect(content).toContain('gateway-method-dispatch-blocked');
    expect(content).toContain('http-route-registration-blocked');
    expect(content).toContain('service-launch-blocked');
    expect(content).toContain('tool-exposure-dangerous-command');
    expect(content).toContain('source implementation modules');
    expect(content).toContain('must not execute source commands');
    expect(content).toContain('register source HTTP routes');
  });

  it('requires deterministic command/http parity tests before any implementation slice can start', () => {
    const content = readDoc(WAVE1_COMMAND_HTTP_DOC);

    PLANNED_PARITY_TESTS.forEach((testFile) => {
      expect(content).toContain(testFile);
    });
    expect(content).toContain('Wave 1 command/http design gate');
    expect(content).toContain('ExternalAgentWave1PluginCommandHttpFixtures.ts');
    expect(content).toContain('plugin-command-and-http-surfaces Wave 1 fixture test design is ready');
    expect(content).toContain('plugin-command-descriptors fixture parity coverage closed through ExternalAgentPluginCommandDescriptorFixture.test.ts');
    expect(content).toContain('plugin-cli-command-surfaces fixture parity coverage closed through ExternalAgentPluginCliCommandSurfacesFixture.test.ts');
    expect(content).toContain('plugin-gateway-method-surfaces fixture parity coverage closed through ExternalAgentPluginGatewayMethodSurfacesFixture.test.ts');
    expect(content).toContain('plugin-http-route-surfaces fixture parity coverage closed through ExternalAgentPluginHttpRouteSurfacesFixture.test.ts');
    expect(content).toContain('plugin-service-surfaces fixture parity coverage closed through ExternalAgentPluginServiceSurfacesFixture.test.ts');
    expect(content).toContain('plugin-tool-exposure-policy fixture parity coverage closed through ExternalAgentPluginToolExposurePolicyFixture.test.ts');
    expect(content).toContain('selected command/http fixture parity row set closed');
    expect(content).toContain('next allowed step requires a later explicit command/http implementation slice gate');
    expect(content).toContain('no real sidecar, real adapter, source command execution');
    expect(content).toContain('source module copy');
  });
});
