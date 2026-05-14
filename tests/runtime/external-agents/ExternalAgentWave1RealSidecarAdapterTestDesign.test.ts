import fs from 'node:fs';
import path from 'node:path';

const WAVE0_GATE_DOC = 'docs/148-wave-0-real-sidecar-adapter-gate.md';
const WAVE1_TEST_DESIGN_DOC = 'docs/149-wave-1-real-sidecar-adapter-test-design.md';

const SELECTED_BOUNDARY_PACK_ROWS = [
  'sidecar-process-descriptor',
  'sidecar-health-probe-contract',
  'sidecar-capability-snapshot-contract',
  'sidecar-event-pull-contract',
  'sidecar-secret-ref-runtime-config-boundary',
  'sidecar-failure-degraded-rollback-model',
  'sidecar-observability-projection',
];

const DESIGN_ONLY_ROWS = [
  'sidecar-action-dispatch-contract',
];

const REQUIRED_FIXTURE_CASES = [
  'process-descriptor-optional-disabled',
  'process-descriptor-no-spawn',
  'health-probe-to-health-snapshot',
  'health-probe-no-authority',
  'capability-snapshot-policy-input',
  'event-pull-boundary-only',
  'action-dispatch-blocked-no-executor',
  'secret-ref-no-raw-value',
  'runtime-config-state-migration-blocked',
  'failure-degraded-rollback-metadata',
  'observability-zavorth-terms-read-only',
  'source-module-copy-rejected',
  'live-connection-blocked',
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

describe('Wave 1 real sidecar/adapter test design', () => {
  it('records a test-design-only acceleration gate and blocks live sidecar/adapter work', () => {
    const content = readDoc(WAVE1_TEST_DESIGN_DOC);
    const lowerContent = content.toLowerCase();

    expect(content).toContain('Status: wave-1-real-sidecar-adapter-test-design-ready');
    expect(content).toContain(WAVE0_GATE_DOC);
    expect(content).toContain('test design only');
    expect(content).toContain('docs/150-wave-1-sidecar-read-only-boundary-pack.md');
    expect(content).toContain('docs/151-wave-1-live-read-only-external-executor-probe.md');
    expect(lowerContent).toContain('does not implement or authorize a real sidecar');
    expect(lowerContent).toContain('real process spawn');
    expect(lowerContent).toContain('http call');
    expect(lowerContent).toContain('websocket connection');
    expect(lowerContent).toContain('provider execution');
    expect(lowerContent).toContain('source tool execution');
    expect(lowerContent).toMatch(/raw secret\s+loading/);
    expect(lowerContent).toContain('config/state migration');
    expect(lowerContent).toContain('source module copy');
    expect(lowerContent).toContain('adapter removal');
    expect(lowerContent).not.toContain('live source runtime connection authorized');
    expect(lowerContent).not.toContain('real sidecar implementation is authorized');
  });

  it('merges the old 150-156 concepts into one boundary pack without dropping subgates', () => {
    const content = readDoc(WAVE1_TEST_DESIGN_DOC);
    const selectedSection = sectionBetween(
      content,
      '## Selected Boundary Pack Rows',
      'The following row remains design-only',
    );

    expect(content).toContain('The old conceptual slices `150` through `156` are merged into one boundary pack');
    expect(content).toMatch(/Coverage is measured\s+by invariants and tests, not by document count\./);
    SELECTED_BOUNDARY_PACK_ROWS.forEach((itemId) => {
      expect(selectedSection).toContain(`\`${itemId}\``);
    });
    DESIGN_ONLY_ROWS.forEach((itemId) => {
      expect(content).toContain(`\`${itemId}\``);
    });
    expect(content).toMatch(/No action may reach an\s+executor in `docs\/150`\./);
  });

  it('defines fixture sets, source evidence, Zavorth contracts, assertions, and blockers for every subgate row', () => {
    const content = readDoc(WAVE1_TEST_DESIGN_DOC);

    [...SELECTED_BOUNDARY_PACK_ROWS, ...DESIGN_ONLY_ROWS].forEach((itemId) => {
      const row = matrixRowFor(content, itemId);

      expect(row).toContain(`\`${itemId}\``);
      expect(row).toMatch(/`wave1\.sidecarReadOnly\./);
      expect(row).toMatch(/Source|Fixture|Invocation|SecretRef|Read-only|startup|health|capability|protocol|snapshot|failure|Command Center/i);
      expect(row).toMatch(/Zavorth|ExternalAgentHealthSnapshot|SecretRef|ToolExposurePolicyInput|policy preflight|rollback|observability/i);
      expect(row).toMatch(/Assert/);
      expect(row).toMatch(/Must be covered|Design-only/);
    });
  });

  it('defines required fixture cases for descriptor, health, snapshots, events, blocked actions, secrets, rollback, and observability', () => {
    const content = readDoc(WAVE1_TEST_DESIGN_DOC);

    REQUIRED_FIXTURE_CASES.forEach((fixtureCase) => {
      expect(content).toContain(fixtureCase);
    });
    expect(content).toContain('Sidecar presence is optional');
    expect(content).toContain('Zavorth must run without it');
    expect(content).toContain('Health probes normalize fixture health into `ExternalAgentHealthSnapshot`');
    expect(content).toContain('Capabilities enter as Zavorth-owned snapshots');
    expect(content).toContain('Events enter through Zavorth-owned envelopes/events');
    expect(content).toContain('Action dispatch is represented only as blocked/preflight metadata');
    expect(content).toContain('Secrets and runtime config are represented as `SecretRef`');
    expect(content).toContain('Failures produce degraded/offline/retryable/rollback metadata');
    expect(content).toContain('Observability is projected in Zavorth/Command Center terms');
  });

  it('keeps live process, transport, providers, tools, secrets, config/state, source copy, and adapter removal blocked', () => {
    const content = readDoc(WAVE1_TEST_DESIGN_DOC);

    expect(content).toContain('process spawn blocked');
    expect(content).toContain('HTTP/WebSocket live transport blocked');
    expect(content).toContain('provider execution blocked');
    expect(content).toContain('command/tool execution blocked');
    expect(content).toContain('raw secret read blocked');
    expect(content).toContain('config/state migration blocked');
    expect(content).toContain('source module copy rejected');
    expect(content).toContain('adapter removal blocked');
    expect(content).toContain('must not start a process');
    expect(content).toContain('connect to a source runtime');
    expect(content).toContain('call ExternalExecutor');
    expect(content).toMatch(/open\s+HTTP\/WebSocket transport/);
    expect(content).toContain('execute provider/command/tool');
    expect(content).toContain('copy source modules');
  });

  it('names the consolidated boundary pack test and keeps the live probe separated', () => {
    const content = readDoc(WAVE1_TEST_DESIGN_DOC);

    expect(content).toContain('ExternalAgentWave1RealSidecarAdapterTestDesign.test.ts');
    expect(content).toContain('ExternalAgentWave1SidecarReadOnlyBoundaryPack.test.ts');
    expect(content).toContain('explicit subgates for descriptor, health');
    expect(content).toContain('docs/150-wave-1-sidecar-read-only-boundary-pack.md');
    expect(content).toContain('docs/151-wave-1-live-read-only-external-executor-probe.md');
    expect(content).toContain('`docs/151` may only start after the `150` boundary pack passes.');
  });
});
