import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { ZavorthGatewayLauncherService } from '../../src/services/ZavorthGatewayLauncherService.js';

describe('ZavorthGatewayLauncherService', () => {
  const tempDirs: string[] = [];
  const originalEntrypoint = config.AIGatewayGatewayEntrypointFile;
  const originalReadyTimeout = config.AIGatewayGatewayReadyTimeoutMs;

  afterEach(() => {
    config.AIGatewayGatewayEntrypointFile = originalEntrypoint;
    config.AIGatewayGatewayReadyTimeoutMs = originalReadyTimeout;
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('launches the gateway entrypoint and waits until the status becomes ready', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-AIGateway-launcher-'));
    tempDirs.push(root);
    config.AIGatewayGatewayEntrypointFile = path.join(root, 'ai-gateway.js');
    config.AIGatewayGatewayReadyTimeoutMs = 1_000;
    fs.writeFileSync(config.AIGatewayGatewayEntrypointFile, '// stub gateway', 'utf8');

    let calls = 0;
    const gatewayService = {
      readStatus: jest.fn(() => {
        calls += 1;
        if (calls < 2) {
          return {
            enabled: true,
            ready: false,
            running: false,
            pid: null,
            host: '127.0.0.1',
            port: 21128,
            baseUrl: 'http://127.0.0.1:21128/v1',
            upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
            localOnly: true,
            overlayFile: 'C:/repo/config/AIGateway-overlay.json',
            checkedAt: '2026-04-05T12:00:00.000Z',
            message: 'Gateway ainda offline.',
          };
        }
        return {
          enabled: true,
          ready: true,
          running: true,
          pid: process.pid,
          host: '127.0.0.1',
          port: 21128,
          baseUrl: 'http://127.0.0.1:21128/v1',
          upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
          localOnly: true,
          overlayFile: 'C:/repo/config/AIGateway-overlay.json',
          checkedAt: '2026-04-05T12:00:01.000Z',
          message: 'Gateway own do AIGateway active.',
        };
      }),
    };
    const spawn = jest.fn(() => ({
      unref: jest.fn(),
    })) as any;

    const service = new ZavorthGatewayLauncherService({
      gatewayService: gatewayService as any,
      spawn,
      sleep: async () => undefined,
      fetchImpl: jest.fn(async () => ({
        ok: true,
      })) as any,
    });

    const status = await service.ensureStarted();

    expect(spawn).toHaveBeenCalled();
    expect(status.ready).toBe(true);
    expect(status.baseUrl).toBe('http://127.0.0.1:21128/v1');
  });
});
