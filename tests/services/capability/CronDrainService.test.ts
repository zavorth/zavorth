import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { AutonomySchedulePlane } from '../../../src/services/AutonomySchedulePlane.js';
import { CronDrainService, formatCronDrainForLog } from '../../../src/services/CronDrainService.js';

describe('CronDrainService + AutonomySchedulePlane drain', () => {
  let root: string;
  let plane: AutonomySchedulePlane;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-cron-drain-'));
    plane = new AutonomySchedulePlane({
      storageDir: path.join(root, 'cron'),
      taskPlane: null,
    });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('reports drain status with zero in-flight', () => {
    const drain = new CronDrainService({ plane });
    const snap = drain.buildSnapshot();
    expect(snap.processDueInFlight).toBe(0);
    expect(snap.totalRoutines).toBe(0);
    expect(formatCronDrainForLog(snap)).toContain('inFlight=0');
  });

  it('tracks processDue in-flight counter', () => {
    expect(plane.getDrainStatus().processDueInFlight).toBe(0);
    // processDue without task plane blocks quickly but still increments counter via try/finally
    const result = plane.processDue({ dryRun: true });
    expect(result.ok).toBe(false);
    expect(plane.getDrainStatus().processDueInFlight).toBe(0);
  });

  it('drainForShutdown completes when nothing in flight', async () => {
    const drain = new CronDrainService({ plane, sleep: async () => undefined });
    const result = await drain.drainForShutdown({ timeoutMs: 200 });
    expect(result.timedOut).toBe(false);
    expect(result.ok).toBe(true);
    expect(result.summary).toMatch(/clear|due/i);
  });
});
