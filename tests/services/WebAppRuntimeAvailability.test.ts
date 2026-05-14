import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { DashboardService } from '../../src/services/DashboardService.js';
import { createTestLogRepo, fetchDashboardJson } from '../helpers/dashboardWebTestUtils.js';

describe('WebApp runtime availability', () => {
  const logRepo = createTestLogRepo();
  const originalWebAuthToken = config.zavorthWebAuthToken;
  const originalDashboardRuntimeStateFile = config.dashboardRuntimeStateFile;
  const tempDirs: string[] = [];

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
    config.dashboardRuntimeStateFile = originalDashboardRuntimeStateFile;
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('returns 503 for runtime-bound web endpoints when chat runtime is not attached', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-runtime-availability-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const service = new DashboardService(logRepo);
    await service.start();

    const [
      { status: sessionStatus, payload: sessionPayload },
      { status: hostStatusStatus, payload: hostStatusPayload },
    ] = await Promise.all([
      fetchDashboardJson(service.getUrl(), '/api/web/session', { token: 'web-secret' }),
      fetchDashboardJson(service.getUrl(), '/api/web/host/status', { token: 'web-secret' }),
    ]);
    await service.stopAsync();

    expect(sessionStatus).toBe(503);
    expect(hostStatusStatus).toBe(503);
    expect(sessionPayload).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining('gateway principal'),
      }),
    );
    expect(hostStatusPayload).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining('gateway principal'),
      }),
    );
  });
});
