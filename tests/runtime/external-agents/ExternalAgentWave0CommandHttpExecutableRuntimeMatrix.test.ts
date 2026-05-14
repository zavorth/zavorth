import fs from 'node:fs';
import path from 'node:path';

const MATRIX_DOC = 'docs/143-wave-0-command-http-executable-runtime-matrix.md';

const REQUIRED_READY_ITEMS = [
  'command-http-invocation-envelope',
  'command-http-policy-preflight',
  'command-http-observability-projection',
];

const REQUIRED_DEFERRED_OR_REJECTED_ITEMS = [
  'activation-setup-qa-runner-policy',
  'source-handler-adapter-contracts',
  'source-command-implementation-modules',
];

function readMatrixDoc(): string {
  return fs.readFileSync(path.join(process.cwd(), MATRIX_DOC), 'utf8');
}

function lineFor(content: string, itemId: string): string {
  return content.split(/\r?\n/).find((line) => line.includes(`\`${itemId}\``)) || '';
}

describe('Wave 0 command/http executable runtime matrix', () => {
  it('opens the executable runtime gate without authorizing executable runtime work', () => {
    const content = readMatrixDoc();
    const lower = content.toLowerCase();

    expect(content).toContain('Status: wave-0-command-http-executable-runtime-matrix-ready');
    expect(content).toContain('docs/142-wave-1-plugin-tool-exposure-policy-boundary-slice.md');
    expect(lower).toContain('does not implement executable runtime behavior');
    expect(lower).toContain('no real sidecar, real adapter');
    expect(lower).toContain('source command execution');
    expect(lower).toContain('source cli process spawn');
    expect(lower).toContain('source http route registration');
    expect(lower).toContain('source service launch');
    expect(lower).toContain('source tool execution');
    expect(lower).not.toContain('source command execution authorized');
    expect(lower).not.toContain('real adapter authorized');
  });

  it('selects only Zavorth-owned envelope, policy preflight, and observability rows for Wave 1 design', () => {
    const content = readMatrixDoc();

    REQUIRED_READY_ITEMS.forEach((itemId) => {
      const row = lineFor(content, itemId);

      expect(row).toContain(`\`${itemId}\``);
      expect(row).toMatch(/\| `(adapt|replace)` \|/);
      expect(row).toMatch(/Zavorth|Command Center|ToolExposurePolicyInput/);
      expect(row).toMatch(/fixture|Wave 1/i);
      expect(row).toContain('Wave-0-exec-ready');
    });
  });

  it('keeps runners, source handlers, source modules, and live integration deferred or rejected', () => {
    const content = readMatrixDoc();

    REQUIRED_DEFERRED_OR_REJECTED_ITEMS.forEach((itemId) => {
      const row = lineFor(content, itemId);

      expect(row).toContain(`\`${itemId}\``);
      expect(row).toMatch(/Wave-0-exec-(deferred|rejected)/);
    });
    expect(content).toContain('activation-setup-qa-runner-policy deferred to a later activation runner matrix');
    expect(content).toContain('source-handler-adapter-contracts deferred to a later adapter contract matrix');
    expect(content).toContain('source-command-implementation-modules rejected as source-copy material');
    expect(content).toContain('source module copy');
  });

  it('names docs/144 as the test-design handoff and keeps execution blocked', () => {
    const content = readMatrixDoc();

    expect(content).toContain('docs/144-wave-1-command-http-executable-runtime-test-design.md');
    expect(content).toContain('deterministic fixtures for invocation envelopes');
    expect(content).toContain('policy preflight');
    expect(content).toContain('read-only Command Center observability');
    expect(content).toContain('must not create runtime execution');
    expect(content).toContain('process spawn');
    expect(content).toContain('service launch');
    expect(content).toContain('setup/QA execution');
    expect(content).toContain('credential migration');
    expect(content).toContain('adapter removal');
    expect(content).toContain('docs/145-wave-1-command-http-invocation-envelope-boundary-slice.md');
    expect(content).toContain('command-http-invocation-envelope');
  });
});
