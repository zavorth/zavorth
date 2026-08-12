import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthCapabilityUsageSignalsService } from '../../src/services/ZavorthCapabilityUsageSignalsService.js';

describe('ZavorthCapabilityUsageSignalsService', () => {
  test('records local adoption and performance signals without prompt content', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-capability-usage-signals-test-'));
    const storeFile = path.join(tmp, 'usage.json');
    const service = new ZavorthCapabilityUsageSignalsService({
      storeFile,
      now: fixedClock([
        '2026-06-02T12:00:00.000Z',
        '2026-06-02T12:00:01.000Z',
        '2026-06-02T12:00:02.000Z',
        '2026-06-02T12:00:03.000Z',
        '2026-06-02T12:00:04.000Z',
        '2026-06-02T12:00:05.000Z',
      ]),
      actionSurface: {
        buildSnapshot: () => ({
          items: [
            {
              actionId: 'capability.candidate.research-pack',
              title: 'Research pack',
            },
          ],
        } as any),
      },
    });

    service.record({
      actionId: 'capability.candidate.research-pack',
      kind: 'shown',
      surface: 'dashboard',
      metadata: {
        title: 'Research pack',
        prompt: 'never store this prompt text',
        token: 'secret-token',
      },
    });
    service.record({
      actionId: 'capability.candidate.research-pack',
      kind: 'previewed',
      durationMs: 100,
    });
    service.record({
      actionId: 'capability.candidate.research-pack',
      kind: 'succeeded',
      durationMs: 250,
      receiptId: 'receipt:research-pack',
    });
    service.record({
      actionId: 'capability.candidate.research-pack',
      kind: 'succeeded',
      durationMs: 300,
      receiptId: 'receipt:research-pack-2',
    });

    const snapshot = service.snapshot();

    expect(snapshot.surface).toBe('capability-usage-signals');
    expect(snapshot.summary.events).toBe(4);
    expect(snapshot.summary.activeActions).toBe(1);
    expect(snapshot.actions[0]).toMatchObject({
      actionId: 'capability.candidate.research-pack',
      title: 'Research pack',
      status: 'active',
      recommendation: 'promote_candidate',
      counters: {
        shown: 1,
        previewed: 1,
        succeeded: 2,
      },
      rates: {
        previewRate: 1,
        successRate: 1,
      },
      performance: {
        samples: 3,
        p50Ms: 250,
        p95Ms: 300,
      },
    });
    expect(JSON.stringify(snapshot)).not.toContain('never store this prompt text');
    expect(JSON.stringify(snapshot)).not.toContain('secret-token');
    expect(snapshot.safety).toMatchObject({
      localOnly: true,
      noPromptContent: true,
      noSecrets: true,
      noNetworkUsed: true,
    });
  });

  test('marks noisy or blocked capability usage as attention', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-capability-usage-signals-test-'));
    const service = new ZavorthCapabilityUsageSignalsService({
      storeFile: path.join(tmp, 'usage.json'),
      actionSurface: { buildSnapshot: () => ({ items: [] }) as any },
    });

    service.record({
      actionId: 'capability.candidate.channel-send',
      kind: 'failed',
      status: 'attention',
      durationMs: 500,
    });
    service.record({
      actionId: 'capability.candidate.channel-send',
      kind: 'blocked',
      status: 'blocked',
      durationMs: 20,
    });

    const snapshot = service.snapshot();

    expect(snapshot.status).toBe('attention');
    expect(snapshot.summary.attentionActions).toBe(1);
    expect(snapshot.actions[0]).toMatchObject({
      actionId: 'capability.candidate.channel-send',
      status: 'blocked',
      recommendation: 'needs_attention',
    });
  });
});

function fixedClock(values: string[]): () => Date {
  let index = 0;
  return () => new Date(values[Math.min(index++, values.length - 1)]);
}
