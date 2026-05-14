import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthEvalHistoryFileService } from '../../src/services/ZavorthEvalHistoryFileService.js';

describe('ZavorthEvalHistoryFileService', () => {
  it('captures eval windows and exposes trend deltas', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-eval-history-'));
    const filePath = path.join(tempDir, 'eval-history.json');
    let currentDate = new Date('2026-04-12T12:00:00.000Z');
    const service = new ZavorthEvalHistoryFileService({
      filePath,
      now: () => currentDate,
      captureIntervalMs: 60_000,
    });

    service.capture({
      generatedAt: '2026-04-12T12:00:00.000Z',
      windowHours: 168,
      summary: {
        posture: 'attention',
        scorecards: 3,
        datasets: 2,
        regressions: 1,
        telemetrySignals: 4,
      },
      telemetry: {
        traceCount: 2,
        failureEvents: 0,
      },
      narrative: {
        headline: 'Wave 4 com pontos de atencao',
      },
    });

    currentDate = new Date('2026-04-12T12:05:00.000Z');

    const snapshot = service.capture({
      generatedAt: '2026-04-12T12:05:00.000Z',
      windowHours: 168,
      summary: {
        posture: 'healthy',
        scorecards: 4,
        datasets: 3,
        regressions: 0,
        telemetrySignals: 5,
      },
      telemetry: {
        traceCount: 3,
        failureEvents: 0,
      },
      narrative: {
        headline: 'Wave 4 estavel',
      },
    });

    expect(snapshot.available).toBe(true);
    expect(snapshot.entries).toBe(2);
    expect(snapshot.latestPosture).toBe('healthy');
    expect(snapshot.delta.scorecards).toBe(1);
    expect(snapshot.delta.regressions).toBe(-1);
    expect(snapshot.trend).toHaveLength(2);
    expect(snapshot.baseline).toEqual(expect.objectContaining({
      available: true,
      comparableWindows: 2,
    }));
    expect(snapshot.retention).toEqual(expect.objectContaining({
      maxEntries: expect.any(Number),
      compacted: false,
    }));
    expect(snapshot.trend[0].manifestHash).toEqual(expect.any(String));
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
