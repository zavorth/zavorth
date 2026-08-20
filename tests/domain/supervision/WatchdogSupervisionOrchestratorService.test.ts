import { WatchdogSupervisionOrchestratorService } from '../../../src/services/supervision/WatchdogSupervisionOrchestratorService.js';

describe('WatchdogSupervisionOrchestratorService', () => {
  let watchdog: WatchdogSupervisionOrchestratorService;

  beforeEach(() => {
    watchdog = new WatchdogSupervisionOrchestratorService();
  });

  afterEach(() => {
    watchdog.stopAll();
  });

  it('evaluates healthy watchdog job without firing alert notifications', async () => {
    watchdog.registerJob({
      id: 'job-health',
      name: 'Server Health Check',
      checkIntervalMs: 60000,
      checkFn: async () => ({ healthy: true, details: 'HTTP 200 OK' }),
      alertChannels: ['terminal', 'desktop'],
    });

    const result = await watchdog.evaluateJob('job-health');

    expect(result).not.toBeNull();
    expect(result?.healthy).toBe(true);
    expect(result?.alertDispatched).toBe(false);
    expect(result?.channelsNotified).toHaveLength(0);
  });

  it('detects unhealthy watchdog state and triggers alert listeners with channels', async () => {
    const alertHandler = jest.fn();
    watchdog.onAlert(alertHandler);

    watchdog.registerJob({
      id: 'job-db-disk',
      name: 'Database Disk Usage',
      checkIntervalMs: 60000,
      checkFn: async () => ({ healthy: false, details: 'Disk usage at 96% (> 90% threshold)' }),
      alertChannels: ['terminal', 'satellite'],
    });

    const result = await watchdog.evaluateJob('job-db-disk');

    expect(result).not.toBeNull();
    expect(result?.healthy).toBe(false);
    expect(result?.alertDispatched).toBe(true);
    expect(result?.channelsNotified).toContain('satellite');
    expect(alertHandler).toHaveBeenCalledTimes(1);
    expect(alertHandler).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 'job-db-disk',
      healthy: false,
    }));
  });
});
