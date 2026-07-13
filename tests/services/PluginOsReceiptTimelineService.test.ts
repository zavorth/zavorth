import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginOsReceiptTimelineService } from '../../src/services/PluginOsReceiptTimelineService.js';

describe('PluginOsReceiptTimelineService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('formats forge ledger lines as human headlines', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-c-receipts-'));
    tempRoots.push(root);
    const receiptsDir = path.join(root, '.zavorth', 'receipts');
    fs.mkdirSync(receiptsDir, { recursive: true });
    fs.writeFileSync(
      path.join(receiptsDir, 'plugins.jsonl'),
      `${JSON.stringify({
        id: 'plugin-forge-demo-1',
        kind: 'plugin.forge.apply',
        pluginId: 'forge-demo',
        action: 'forge.apply',
        createdAt: '2026-07-12T14:02:00.000Z',
        enable: false,
      })}\n`,
      'utf8',
    );

    const timeline = new PluginOsReceiptTimelineService({ projectRoot: root }).buildTimeline({ root });
    expect(timeline.entries.length).toBeGreaterThan(0);
    expect(timeline.entries[0].headline).toMatch(/forge applied forge-demo/i);
    expect(timeline.formatText()).toContain('Plugin OS activity');
  });
});
