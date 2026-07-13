import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginOsTelemetryService } from '../../src/services/PluginOsTelemetryService.js';

describe('PluginOsTelemetryService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('records events and aggregates recommend/enable counts', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-p6-tel-'));
    tempRoots.push(root);
    const service = new PluginOsTelemetryService({ projectRoot: root });

    service.recordEvent('recommend', { root, intent: 'search the web', counts: { recommendations: 2 } });
    service.recordEvent('recommend', { root, intent: 'search the web', counts: { recommendations: 1 } });
    service.recordEvent('enable', { root, pluginId: 'web-search' });
    service.recordEvent('sample', {
      root,
      health: 'healthy',
      counts: { enabled: 4, eligible: 5, firstPartyEnabled: 3 },
    });

    const aggregate = service.aggregate({ root, windowHours: 24 });
    expect(aggregate.eventCount).toBe(4);
    expect(aggregate.recommendCount).toBe(2);
    expect(aggregate.enableCount).toBe(1);
    expect(aggregate.samples).toBe(1);
    expect(aggregate.avgEnabled).toBeCloseTo(4);
    expect(aggregate.topIntents[0]?.intent).toContain('search');
    expect(aggregate.formatText()).toContain('telemetry');
    expect(fs.existsSync(service.ledgerPath(root))).toBe(true);

    const history = service.history({ root, windowHours: 24, bucketHours: 1 });
    expect(history.points.length).toBeGreaterThan(0);
    expect(history.formatText()).toContain('history');
  });
});
