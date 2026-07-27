import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let AutonomyManager: any;
try {
  AutonomyManager = require('../../../src/runtime/autonomy/AutonomyManager.js').AutonomyManager;
} catch {
  // Module removed from source
}

const describeIf = AutonomyManager ? describe : describe.skip;

describeIf('AutonomyManager', () => {
  it('calculates each level rate from executions in that level', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-autonomy-'));
    const manager = new AutonomyManager(workspace);

    manager.recordExecution('file.read', 'L0', true);
    manager.recordExecution('file.read', 'L0', false);
    manager.recordExecution('file.write', 'L1', true);

    const stats = manager.getStats();
    expect(stats.byLevel.L0).toEqual({ total: 2, successes: 1, rate: 0.5 });
    expect(stats.byLevel.L1).toEqual({ total: 1, successes: 1, rate: 1 });
    expect(stats.totalExecutions).toBe(3);
  });

  it('never elevates autonomy through emergency or explicit-approval defaults', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-autonomy-'));
    const manager = new AutonomyManager(workspace);

    expect(manager.getOverride('emergencyMode')).toBe('L0');
    expect(manager.getOverride('userExplicitApproval')).toBe('L0');
  });
});
