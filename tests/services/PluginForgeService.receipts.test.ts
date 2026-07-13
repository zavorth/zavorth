import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginForgeService } from '../../src/services/PluginForgeService.js';

describe('PluginForgeService receipts (P4)', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes forge receipt and plugins.jsonl ledger on apply', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-p4-forge-receipt-'));
    tempRoots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'tmp', version: '0.0.0' }), 'utf8');

    const service = new PluginForgeService({ projectRoot: root });
    const plan = await service.plan('echo uppercase tool for tests', {
      root,
      id: 'forge-receipt-demo',
    });
    expect(plan.ok).toBe(true);

    const applied = await service.apply(plan.previewDir, {
      approved: true,
      root,
      enable: false,
    });

    expect(applied.ok).toBe(true);
    expect(applied.receiptPath).toBeTruthy();

    const receiptAbs = path.join(root, applied.receiptPath!);
    expect(fs.existsSync(receiptAbs)).toBe(true);
    const receipt = JSON.parse(fs.readFileSync(receiptAbs, 'utf8'));
    expect(receipt.kind).toBe('plugin.forge.apply');
    expect(receipt.pluginId).toBe('forge-receipt-demo');
    expect(receipt.packageDigest).toMatch(/^[a-f0-9]{64}$/);

    const ledgerPath = path.join(root, '.zavorth', 'receipts', 'plugins.jsonl');
    expect(fs.existsSync(ledgerPath)).toBe(true);
    const lines = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n');
    expect(lines.length).toBeGreaterThan(0);
    const last = JSON.parse(lines[lines.length - 1]);
    expect(last.kind).toBe('plugin.forge.apply');
    expect(last.action).toBe('forge.apply');
    expect(last.pluginId).toBe('forge-receipt-demo');
  });
});
