import { ZavorthPowerLockTool } from '../../src/tools/ZavorthPowerLockTool.js';
import { SystemPowerWakeLockService } from '../../src/services/system/SystemPowerWakeLockService.js';

describe('ZavorthPowerLockTool', () => {
  beforeEach(() => {
    SystemPowerWakeLockService.reset();
  });

  afterEach(() => {
    SystemPowerWakeLockService.reset();
  });

  it('should acquire a power lock and return a success payload', async () => {
    const rawResult = await ZavorthPowerLockTool.execute({
      action: 'acquire',
      reason: 'Swarm Background Pipeline',
    });

    const result = JSON.parse(rawResult);
    expect(result.status).toBe('success');
    expect(result.action).toBe('acquire');
    expect(result.ticketId).toBeDefined();
    expect(result.reason).toBe('Swarm Background Pipeline');
    expect(SystemPowerWakeLockService.hasActiveLocks()).toBe(true);
  });

  it('should release an active power lock by ticketId', async () => {
    const acquireRaw = await ZavorthPowerLockTool.execute({
      action: 'acquire',
      reason: 'Temporary Lock',
    });
    const { ticketId } = JSON.parse(acquireRaw);

    const releaseRaw = await ZavorthPowerLockTool.execute({
      action: 'release',
      ticketId,
    });
    const releaseResult = JSON.parse(releaseRaw);
    expect(releaseResult.status).toBe('success');
    expect(releaseResult.action).toBe('release');
    expect(SystemPowerWakeLockService.hasActiveLocks()).toBe(false);
  });

  it('should inspect status of active power locks', async () => {
    await ZavorthPowerLockTool.execute({ action: 'acquire', reason: 'Task A' });
    await ZavorthPowerLockTool.execute({ action: 'acquire', reason: 'Task B' });

    const statusRaw = await ZavorthPowerLockTool.execute({ action: 'status' });
    const statusResult = JSON.parse(statusRaw);
    expect(statusResult.status).toBe('success');
    expect(statusResult.hasActiveLocks).toBe(true);
    expect(statusResult.totalActiveLocks).toBe(2);
    expect(statusResult.locks).toHaveLength(2);
  });
});
