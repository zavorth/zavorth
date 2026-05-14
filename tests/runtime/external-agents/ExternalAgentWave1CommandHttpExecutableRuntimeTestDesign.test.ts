import fs from 'node:fs';
import path from 'node:path';

const WAVE0_EXEC_RUNTIME_DOC = 'docs/143-wave-0-command-http-executable-runtime-matrix.md';
const WAVE1_EXEC_RUNTIME_DOC = 'docs/144-wave-1-command-http-executable-runtime-test-design.md';

const SELECTED_EXEC_RUNTIME_ITEMS = [
  'command-http-invocation-envelope',
  'command-http-policy-preflight',
  'command-http-observability-projection',
];

const DEFERRED_OR_REJECTED_EXEC_RUNTIME_ITEMS = [
  'activation-setup-qa-runner-policy',
  'source-handler-adapter-contracts',
  'source-command-implementation-modules',
];

const REQUIRED_FIXTURE_CASES = [
  'invocation-envelope-zavorth-owned-id',
  'invocation-envelope-source-evidence-quarantine',
  'policy-preflight-safe-metadata',
  'policy-preflight-approval-required',
  'policy-preflight-blocked-invocation',
  'observability-projection-read-only',
  'execution-side-effects-blocked',
];

const PLANNED_PARITY_TESTS = [
  'ExternalAgentCommandHttpInvocationEnvelopeFixture.test.ts',
  'ExternalAgentCommandHttpPolicyPreflightFixture.test.ts',
  'ExternalAgentCommandHttpObservabilityProjectionFixture.test.ts',
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

describe('Wave 1 command/http executable runtime test design', () => {
  it('records an executable-runtime design-only gate and blocks live implementation work', () => {
    const content = readDoc(WAVE1_EXEC_RUNTIME_DOC);
    const lowerContent = content.toLowerCase();

    expect(content).toContain('Status: wave-1-command-http-executable-runtime-test-design-ready');
    expect(content).toContain(WAVE0_EXEC_RUNTIME_DOC);
    expect(content).toContain('does not authorize implementation');
    expect(lowerContent).toContain('source command execution');
    expect(lowerContent).toContain('source cli process spawn');
    expect(lowerContent).toContain('source http route registration');
    expect(lowerContent).toContain('source gateway method dispatch');
    expect(lowerContent).toContain('source service launch');
    expect(lowerContent).toContain('source tool execution');
    expect(lowerContent).not.toContain('runtime execution is authorized');
    expect(lowerContent).not.toContain('real adapter is authorized');
  });

  it('matches the Wave 0 executable-runtime selected row decision exactly', () => {
    const wave0 = readDoc(WAVE0_EXEC_RUNTIME_DOC);
    const wave1 = readDoc(WAVE1_EXEC_RUNTIME_DOC);
    const selectedSection = sectionBetween(
      wave1,
      '## Selected Executable-Runtime Rows',
      'The following executable-runtime rows remain deferred',
    );

    SELECTED_EXEC_RUNTIME_ITEMS.forEach((itemId) => {
      expect(wave0).toContain(itemId);
      expect(selectedSection).toContain(`\`${itemId}\``);
    });

    DEFERRED_OR_REJECTED_EXEC_RUNTIME_ITEMS.forEach((itemId) => {
      expect(selectedSection).not.toContain(`\`${itemId}\``);
    });
  });

  it('defines fixture sets, evidence, Zavorth contracts, assertions, and blockers for each selected row', () => {
    const content = readDoc(WAVE1_EXEC_RUNTIME_DOC);

    SELECTED_EXEC_RUNTIME_ITEMS.forEach((itemId) => {
      const row = matrixRowFor(content, itemId);

      expect(row).toContain(`\`${itemId}\``);
      expect(row).toMatch(/`wave1\.commandHttpRuntime\./);
      expect(row).toMatch(/docs\/137|docs\/142|fixture outputs/);
      expect(row).toMatch(/Zavorth|Command Center|ToolExposurePolicyInput|policy preflight/i);
      expect(row).toMatch(/Assert/);
      expect(row).toMatch(/Blocked until/);
    });
  });

  it('defines all required fixture cases for envelopes, policy preflight, approvals, blocks, and observability', () => {
    const content = readDoc(WAVE1_EXEC_RUNTIME_DOC);

    REQUIRED_FIXTURE_CASES.forEach((fixtureCase) => {
      expect(content).toContain(fixtureCase);
    });
    expect(content).toContain('approval-required');
    expect(content).toContain('blocked invocation');
    expect(content).toContain('observability projection');
    expect(content).toContain('no real execution');
    expect(content).toContain('no source handler');
    expect(content).toContain('no CLI spawn');
    expect(content).toContain('no HTTP route registration');
    expect(content).toContain('no gateway dispatch');
    expect(content).toContain('no service launch');
  });

  it('keeps setup runners, source handlers, source modules, and execution side effects blocked', () => {
    const content = readDoc(WAVE1_EXEC_RUNTIME_DOC);
    const deferredSection = sectionBetween(content, 'The following executable-runtime rows remain deferred', '## Design Rules');
    const matrix = sectionBetween(content, '## Wave 1 Executable Runtime Fixture Contract Matrix', '## Required Fixture Cases');

    DEFERRED_OR_REJECTED_EXEC_RUNTIME_ITEMS.forEach((itemId) => {
      expect(deferredSection).toContain(`\`${itemId}\``);
      expect(matrix).not.toContain(`\`${itemId}\``);
    });
    expect(content).toContain('must not execute source commands');
    expect(content).toContain('load source handlers');
    expect(content).toContain('spawn source CLI processes');
    expect(content).toContain('register source HTTP routes');
    expect(content).toContain('dispatch source gateway methods');
    expect(content).toContain('launch source services');
    expect(content).toContain('execute source tools');
    expect(content).toContain('source module copy');
  });

  it('names planned parity tests and the next narrow boundary slice without opening real adapters', () => {
    const content = readDoc(WAVE1_EXEC_RUNTIME_DOC);

    PLANNED_PARITY_TESTS.forEach((testFile) => {
      expect(content).toContain(testFile);
    });
    expect(content).toContain('ExternalAgentWave1CommandHttpExecutableRuntimeTestDesign.test.ts');
    expect(content).toContain('command/http executable runtime Wave 1 fixture test design is ready');
    expect(content).toContain('docs/145-wave-1-command-http-invocation-envelope-boundary-slice.md');
    expect(content).toContain('command-http-invocation-envelope');
    expect(content).toContain('docs/146-wave-1-command-http-policy-preflight-boundary-slice.md');
    expect(content).toContain('docs/147-wave-1-command-http-observability-projection-boundary-slice.md');
    expect(content).toContain('Only after `docs/147` closes should a real sidecar/adapter gate be evaluated.');
    expect(content).toContain('Live source runtime integration remains blocked');
  });
});
