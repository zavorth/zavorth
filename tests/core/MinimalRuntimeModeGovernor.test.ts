import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MinimalRuntimeModeGovernor } from '../../src/core/MinimalRuntimeModeGovernor.js';


describe('MinimalRuntimeModeGovernor', () => {
  function createGovernor() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-runtime-mode-'));
    return {
      tempDir,
      governor: new MinimalRuntimeModeGovernor({
        projectRoot: __dirname,
        dataDir: tempDir,
        manifestDir: path.join(__dirname, 'config', 'capability-manifests'),
        profileDir: path.join(__dirname, 'config', 'runtime-profiles'),
        now: () => new Date('2026-05-05T10:00:00.000Z'),
      }),
    };
  }

  it('plans a temporary browser lease from safe-8gb and keeps it dry by default', () => {
    const { governor } = createGovernor();

    const result = governor.elevate({
      fromProfile: 'safe-8gb',
      toProfile: 'browser',
      capability: 'browser',
      ttlMs: 5 * 60 * 1000,
    });

    expect(result.applied).toBe(false);
    expect(result.dryRun).toBe(true);
    expect(result.plan.status).toBe('ready');
    expect(result.plan.action).toBe('elevate');
    expect(result.plan.fromProfile).toBe('safe-8gb');
    expect(result.plan.toProfile).toBe('browser');
    expect(result.plan.returnProfile).toBe('safe-8gb');
    expect(result.lease).toEqual(expect.objectContaining({
      status: 'dry-run',
      dryRun: true,
      applied: false,
    }));
  });

  it('records and releases an applied temporary lease', () => {
    const { governor } = createGovernor();

    const opened = governor.elevate({
      fromProfile: 'safe-8gb',
      toProfile: 'browser',
      capability: 'browser',
      ttlMs: 5 * 60 * 1000,
      apply: true,
    });
    const released = governor.release(opened.lease?.id || '', { apply: true });
    const ledger = governor.buildLedgerSnapshot();

    expect(opened.applied).toBe(true);
    expect(opened.lease?.status).toBe('active');
    expect(released.applied).toBe(true);
    expect(released.lease).toEqual(expect.objectContaining({
      status: 'released',
      releaseOf: opened.lease?.id,
      returnProfile: 'safe-8gb',
    }));
    expect(ledger.total).toBe(2);
    expect(ledger.active).toBe(0);
    expect(ledger.released).toBe(1);
  });

  it('blocks direct automatic escalation from minimal to full', () => {
    const { governor } = createGovernor();

    const plan = governor.plan({
      fromProfile: 'minimal',
      toProfile: 'full',
      capability: 'browser',
    });

    expect(plan.status).toBe('blocked');
    expect(plan.action).toBe('blocked');
    expect(plan.message).toContain('blocked');
  });
});
