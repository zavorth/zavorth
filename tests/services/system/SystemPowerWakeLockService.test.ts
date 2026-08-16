import { SystemPowerWakeLockService } from '../../../src/services/system/SystemPowerWakeLockService.js';

describe('SystemPowerWakeLockService', () => {
  beforeEach(() => {
    SystemPowerWakeLockService.reset();
  });

  afterEach(() => {
    SystemPowerWakeLockService.reset();
  });

  it('should acquire a power wake-lock ticket and track it as active', () => {
    const ticket = SystemPowerWakeLockService.acquireLock('Test Swarm Execution');
    expect(ticket.id).toBeDefined();
    expect(ticket.reason).toBe('Test Swarm Execution');
    expect(ticket.active).toBe(true);
    expect(SystemPowerWakeLockService.hasActiveLocks()).toBe(true);

    const active = SystemPowerWakeLockService.getActiveLocks();
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(ticket.id);
  });

  it('should release an active wake-lock by ticket id', () => {
    const ticket = SystemPowerWakeLockService.acquireLock('Long Running Build');
    expect(SystemPowerWakeLockService.hasActiveLocks()).toBe(true);

    const released = SystemPowerWakeLockService.releaseLock(ticket.id);
    expect(released).toBe(true);
    expect(SystemPowerWakeLockService.hasActiveLocks()).toBe(false);
    expect(SystemPowerWakeLockService.getActiveLocks()).toHaveLength(0);
  });

  it('should handle release of non-existent or already released tickets gracefully', () => {
    expect(SystemPowerWakeLockService.releaseLock('invalid_id')).toBe(false);

    const ticket = SystemPowerWakeLockService.acquireLock('Quick Task');
    expect(SystemPowerWakeLockService.releaseLock(ticket.id)).toBe(true);
    expect(SystemPowerWakeLockService.releaseLock(ticket.id)).toBe(false);
  });

  it('should release all active locks on releaseAll', () => {
    SystemPowerWakeLockService.acquireLock('Task 1');
    SystemPowerWakeLockService.acquireLock('Task 2');
    SystemPowerWakeLockService.acquireLock('Task 3');
    expect(SystemPowerWakeLockService.getActiveLocks()).toHaveLength(3);

    SystemPowerWakeLockService.releaseAll();
    expect(SystemPowerWakeLockService.hasActiveLocks()).toBe(false);
    expect(SystemPowerWakeLockService.getActiveLocks()).toHaveLength(0);
  });
});
