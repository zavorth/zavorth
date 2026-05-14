import fs from 'node:fs';
import path from 'node:path';

const GATE_DOC = 'docs/148-wave-0-real-sidecar-adapter-gate.md';

const TEST_DESIGN_READY_ROWS = [
  'sidecar-process-lifecycle-contract',
  'adapter-transport-handshake-contract',
  'secretref-config-state-contract',
  'execution-policy-binding',
  'observability-audit-rollback',
];

const BLOCKED_OR_REJECTED_ROWS = [
  'live-source-handler-loading',
  'source-module-copy',
  'source-runtime-default-dependency',
  'adapter-removal',
];

const REQUIRED_TEST_DESIGN_CASES = [
  'sidecar-lifecycle-dry-run',
  'transport-handshake-fixture-only',
  'secretref-config-state-quarantine',
  'policy-preflight-binding-required',
  'observability-audit-rollback-read-only',
  'source-handler-loading-blocked',
  'source-module-copy-rejected',
];

function readGateDoc(): string {
  return fs.readFileSync(path.join(process.cwd(), GATE_DOC), 'utf8');
}

function lineFor(content: string, itemId: string): string {
  return content.split(/\r?\n/).find((line) => line.includes(`\`${itemId}\``)) || '';
}

describe('Wave 0 real sidecar/adapter gate', () => {
  it('opens the macro gate without authorizing live sidecar or adapter work', () => {
    const content = readGateDoc();
    const lower = content.toLowerCase();

    expect(content).toContain('Status: wave-0-real-sidecar-adapter-gate-ready');
    expect(content).toContain('docs/147-wave-1-command-http-observability-projection-boundary-slice.md');
    expect(content).toContain('real sidecar implementation: no-go');
    expect(content).toContain('real adapter implementation: no-go');
    expect(content).toContain('live source runtime connection: no-go');
    expect(lower).toContain('source handler loading');
    expect(lower).toContain('source module copy');
    expect(lower).not.toContain('real sidecar implementation: go');
    expect(lower).not.toContain('real adapter implementation: go');
    expect(lower).not.toContain('live source runtime connection: go');
  });

  it('selects only contract/test-design rows for future Wave 1 work', () => {
    const content = readGateDoc();

    TEST_DESIGN_READY_ROWS.forEach((itemId) => {
      const row = lineFor(content, itemId);

      expect(row).toContain(`\`${itemId}\``);
      expect(row).toMatch(/\| `(adapt|replace)` \|/);
      expect(row).toMatch(/Zavorth|SecretRef|policy|observability|rollback|handshake|lifecycle/i);
      expect(row).toMatch(/fixture|test design|deterministic/i);
      expect(row).toContain('Wave-0-adapter-test-design-ready');
    });
  });

  it('keeps source handlers, source modules, default dependency, and adapter removal blocked', () => {
    const content = readGateDoc();

    BLOCKED_OR_REJECTED_ROWS.forEach((itemId) => {
      const row = lineFor(content, itemId);

      expect(row).toContain(`\`${itemId}\``);
      expect(row).toMatch(/Wave-0-adapter-(blocked|rejected)/);
    });
    expect(content).toContain('No source handler, dispatcher, service, route, CLI binary, or tool module is loaded by this gate.');
    expect(content).toContain('Source modules are not copied, imported, renamed into Zavorth');
    expect(content).toContain('Zavorth must remain functional with source runtime unavailable');
    expect(content).toContain('No adapter is removed by this gate');
  });

  it('requires SecretRef, policy preflight, observability, rollback, and source-copy blocking', () => {
    const content = readGateDoc();

    REQUIRED_TEST_DESIGN_CASES.forEach((fixtureCase) => {
      expect(content).toContain(fixtureCase);
    });
    expect(content).toContain('`SecretRef` is the only credential boundary');
    expect(content).toContain('Raw secrets, source credential files, and source credential migration remain');
    expect(content).toContain('invocation envelope normalization');
    expect(content).toContain('policy preflight');
    expect(content).toContain('read-only observability');
    expect(content).toContain('executionAuthority: false');
    expect(content).toContain('source runtime default dependency');
    expect(content).toContain('adapter removal remain blocked');
  });

  it('names docs/149 as test-design handoff and continues blocking live integration', () => {
    const content = readGateDoc();
    const lower = content.toLowerCase();

    expect(content).toContain('docs/149-wave-1-real-sidecar-adapter-test-design.md');
    expect(content).toContain('deterministic fixtures and gates for future');
    expect(content).toContain('must not create a real sidecar');
    expect(content).toContain('raw secret loading');
    expect(content).toContain('config');
    expect(content).toContain('state migration');
    expect(content).toContain('source runtime default dependency');
    expect(content).toContain('Live source runtime integration remains blocked');
    expect(lower).not.toContain('live source runtime integration is authorized');
    expect(lower).not.toContain('source module copy authorized');
  });
});
