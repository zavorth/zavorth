import { ZavorthSystemPowerService } from '../../../src/services/power/ZavorthSystemPowerService';

describe('ZavorthSystemPowerService', () => {
  let service: ZavorthSystemPowerService;

  beforeEach(() => {
    service = new ZavorthSystemPowerService();
  });

  it('should acquire and release power wake locks reliably', () => {
    const lock = service.acquireWakeLock('subagent-swarm-mission');
    expect(lock.tag).toBe('subagent-swarm-mission');
    expect(service.getActiveLocks().length).toBe(1);

    const released = service.releaseWakeLock(lock.lockId);
    expect(released).toBe(true);
    expect(service.getActiveLocks().length).toBe(0);
  });

  it('should evaluate throttle policy accurately based on battery level', () => {
    // Test AC power
    service.setMockStatus({
      powerSource: 'AC_POWER',
      batteryPercent: 100,
      isCharging: true,
      isLowBattery: false,
    });
    const acPolicy = service.evaluateThrottlePolicy();
    expect(acPolicy.isThrottled).toBe(false);
    expect(acPolicy.maxConcurrentSubagents).toBe(8);

    // Test Low Battery
    service.setMockStatus({
      powerSource: 'BATTERY',
      batteryPercent: 15,
      isCharging: false,
      isLowBattery: true,
    });
    const lowBatPolicy = service.evaluateThrottlePolicy();
    expect(lowBatPolicy.isThrottled).toBe(true);
    expect(lowBatPolicy.maxConcurrentSubagents).toBe(1);
    expect(lowBatPolicy.throttleReason).toContain('critically low');
  });

  it('should automatically expire stale wake locks past their max duration', async () => {
    service.acquireWakeLock('quick-task', 1); // 1ms duration
    expect(service.getActiveLocks().length).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(service.getActiveLocks().length).toBe(0);
  });
});
