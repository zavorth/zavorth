import fs from 'node:fs';
import path from 'node:path';

const MATRIX_DOC = 'docs/118-wave-0-gateway-capability-matrix.md';

const REQUIRED_READY_ITEMS = [
  'gw-protocol-frames',
  'gw-connect-handshake',
  'gw-event-stream',
  'gw-chat-session-methods',
  'gw-channel-status',
  'gw-approval-methods',
  'gw-node-device-methods',
  'plugin-manifest-registry',
  'plugin-runtime-registry',
  'source-product-identity',
];

const REQUIRED_DEFERRED_ITEMS = [
  'provider-capability-contracts',
  'plugin-command-and-http-surfaces',
];

function readMatrixDoc(): string {
  return fs.readFileSync(path.join(process.cwd(), MATRIX_DOC), 'utf8');
}

function lineFor(content: string, itemId: string): string {
  return content.split(/\r?\n/).find((line) => line.includes(`\`${itemId}\``)) || '';
}

describe('Wave 0 gateway and capability matrix', () => {
  it('records the first scoped source area without authorizing implementation', () => {
    const content = readMatrixDoc();

    expect(content).toContain('Status: wave-0-ready-for-scoped-tests');
    expect(content).toContain('Gateway control plane events and capability metadata');
    expect(content).toContain('No real sidecar, real adapter, source module copy');
    expect(content).toContain('## Wave 1 Entry Criteria');
  });

  it('has required ready rows with decisions, Zavorth equivalents, tests, and no source-copy language', () => {
    const content = readMatrixDoc();

    REQUIRED_READY_ITEMS.forEach((itemId) => {
      const row = lineFor(content, itemId);
      expect(row).toContain(`\`${itemId}\``);
      expect(row).toMatch(/\| `(adapt|replace|externalize|reject)` \|/);
      expect(row).toMatch(/Zavorth|ExternalAgent|NormalizedInboundMessage|ReplyPipeline|ToolExposurePolicy/);
      expect(row).toMatch(/test|fixture|scan/i);
      expect(row).toContain('Wave-0-ready');
      expect(row.toLowerCase()).not.toContain('copy source module');
    });
  });

  it('keeps broad provider and command surfaces deferred until per-item matrices exist', () => {
    const content = readMatrixDoc();

    REQUIRED_DEFERRED_ITEMS.forEach((itemId) => {
      const row = lineFor(content, itemId);
      expect(row).toContain(`\`${itemId}\``);
      expect(row).toContain('Wave-0-deferred');
    });
    expect(content).toContain('defer provider-capability-contracts and plugin-command-and-http-surfaces');
  });
});
