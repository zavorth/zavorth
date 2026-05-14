import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { config } from '../../../../../src/config/index';
import { DashboardService } from '../../../../../src/services/DashboardService';
import {
  createTestLogRepo,
  fetchNoKeepAlive,
} from '../../../../helpers/dashboardWebTestUtils';

jest.setTimeout(30000);

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

describe('DashboardService hardening', () => {
  const originalDashboardRuntimeStateFile = config.dashboardRuntimeStateFile;
  const tempDirs: string[] = [];

  afterEach(() => {
    config.dashboardRuntimeStateFile = originalDashboardRuntimeStateFile;
    jest.restoreAllMocks();
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('presents 0.0.0.0 listeners through a local browser-safe URL', () => {
    const service = new DashboardService(createTestLogRepo());
    (service as any).host = '0.0.0.0';
    (service as any).port = 45678;

    expect(service.getUrl()).toBe('http://127.0.0.1:45678');
  });

  it('returns a JSON 500 instead of crashing when route handling throws', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-hardening-'));
    tempDirs.push(root);
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');
    const logRepo = createTestLogRepo();
    const service = new DashboardService(logRepo);
    (service as any).host = '127.0.0.1';
    (service as any).port = await getFreePort();
    (service as any).routeRequest = jest.fn().mockRejectedValue(new Error('forced route failure'));

    await service.start();
    const response = await fetchNoKeepAlive(`${service.getUrl()}/anything`);
    const payload = await response.json();
    await service.stopAsync();

    expect(response.status).toBe(500);
    expect(payload).toEqual({ error: 'Internal Server Error' });
    expect(logRepo.log).toHaveBeenCalledWith(
      'error',
      'DashboardService',
      expect.stringContaining('forced route failure'),
    );
    expect(fs.existsSync(config.dashboardRuntimeStateFile)).toBe(false);
  });

  it('keeps stopAsync idempotent when the server was never started', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-stop-'));
    tempDirs.push(root);
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');
    const service = new DashboardService(createTestLogRepo());

    await expect(service.stopAsync()).resolves.toBeUndefined();
    await expect(service.stopAsync()).resolves.toBeUndefined();
    expect(fs.existsSync(config.dashboardRuntimeStateFile)).toBe(false);
  });
});
