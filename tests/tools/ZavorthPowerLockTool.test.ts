import { ZavorthPowerLockTool } from '../../src/tools/ZavorthPowerLockTool';
import { ZavorthSystemPowerService } from '../../src/services/power/ZavorthSystemPowerService';

describe('ZavorthPowerLockTool', () => {
  let tool: ZavorthPowerLockTool;
  let service: ZavorthSystemPowerService;

  beforeEach(() => {
    service = new ZavorthSystemPowerService();
    tool = new ZavorthPowerLockTool(service);
  });

  it('should acquire and release power locks via tool interface', async () => {
    const acquireRes = await tool.execute({
      action: 'acquire',
      tag: 'long-build-task',
      maxDurationMs: 60000,
    });

    const parsedAcquire = JSON.parse(acquireRes);
    expect(parsedAcquire.success).toBe(true);
    expect(parsedAcquire.lock.tag).toBe('long-build-task');

    const lockId = parsedAcquire.lock.lockId;
    const releaseRes = await tool.execute({
      action: 'release',
      lockId,
    });

    const parsedRelease = JSON.parse(releaseRes);
    expect(parsedRelease.success).toBe(true);
  });

  it('should report power status and throttle policy via tool interface', async () => {
    const statusRes = await tool.execute({ action: 'status' });
    const parsed = JSON.parse(statusRes);

    expect(parsed.success).toBe(true);
    expect(parsed.powerStatus).toBeDefined();
    expect(parsed.throttle).toBeDefined();
  });
});
