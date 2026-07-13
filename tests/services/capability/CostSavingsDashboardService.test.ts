import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CostSavingsDashboardService } from '../../../src/services/CostSavingsDashboardService.js';

describe('CostSavingsDashboardService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-cost-dash-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('aggregates session ledgers and estimates savings', () => {
    fs.writeFileSync(path.join(root, 's1.json'), JSON.stringify({
      sessionId: 's1',
      route: null,
      usage: [],
      totalsByModel: {
        'openai/gpt-4o-mini': {
          calls: 3,
          inputTokens: 300,
          outputTokens: 150,
          estimatedCostUsd: 0.002,
        },
      },
      updatedAt: new Date().toISOString(),
    }), 'utf8');

    const snap = new CostSavingsDashboardService({
      storageDir: root,
      frontierCostPer1kOut: 0.03,
    }).buildSnapshot();

    expect(snap.sessionsScanned).toBe(1);
    expect(snap.totals.calls).toBe(3);
    expect(snap.totals.outputTokens).toBe(150);
    expect(snap.totals.estimatedCostUsd).toBeCloseTo(0.002, 5);
    expect(snap.totals.estimatedSavingsUsd).toBeGreaterThan(0);
    expect(snap.byModel[0].modelKey).toContain('gpt-4o-mini');
  });
});
