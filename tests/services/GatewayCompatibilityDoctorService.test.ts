import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { GatewayCompatibilityDoctorService } from '../../src/services/GatewayCompatibilityDoctorService';

describe('GatewayCompatibilityDoctorService', () => {
  const originalCompatibilityStatusFile = config.AIGatewayCompatibilityStatusFile;
  const originalGatewayBaseUrl = config.zavorthAIGatewayGatewayBaseUrl;
  const originalUpstreamBaseUrl = config.AIGatewayUpstreamBaseUrl;
  const originalOverlayFile = config.AIGatewayOverlayFile;
  const tempDirs: string[] = [];

  afterEach(() => {
    config.AIGatewayCompatibilityStatusFile = originalCompatibilityStatusFile;
    config.zavorthAIGatewayGatewayBaseUrl = originalGatewayBaseUrl;
    config.AIGatewayUpstreamBaseUrl = originalUpstreamBaseUrl;
    config.AIGatewayOverlayFile = originalOverlayFile;
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('persists a passed compatibility report when the Zavorth-owned route responds', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-AIGateway-doctor-'));
    tempDirs.push(root);
    config.AIGatewayCompatibilityStatusFile = path.join(root, 'AIGateway-compat.json');
    config.zavorthAIGatewayGatewayBaseUrl = 'http://127.0.0.1:21128/v1';
    config.AIGatewayUpstreamBaseUrl = 'http://127.0.0.1:20128/v1';
    config.AIGatewayOverlayFile = path.join(root, 'AIGateway-overlay.json');

    const service = new GatewayCompatibilityDoctorService({
      gatewayService: {
        readStatus: () => ({
          enabled: true,
          ready: true,
          running: true,
          pid: 4512,
          host: '127.0.0.1',
          port: 21128,
          baseUrl: 'http://127.0.0.1:21128/v1',
          upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
          localOnly: true,
          overlayFile: config.AIGatewayOverlayFile,
          checkedAt: '2026-04-04T16:00:00.000Z',
          message: 'Gateway own do AIGateway active.',
        }),
      } as any,
      fetchImpl: jest.fn(async () => ({
        status: 200,
        ok: true,
      })) as any,
    });

    const report = await service.run();
    const persisted = JSON.parse(fs.readFileSync(config.AIGatewayCompatibilityStatusFile, 'utf8'));

    expect(report).toEqual(expect.objectContaining({
      ok: true,
      status: 'passed',
      checkedTarget: 'http://127.0.0.1:21128/v1/models',
    }));
    expect(persisted).toEqual(expect.objectContaining({
      ok: true,
      status: 'passed',
    }));
  });
});
