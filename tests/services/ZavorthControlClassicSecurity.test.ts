import { config } from '../../src/config/index.js';
import { ZavorthControlService } from '../../src/services/ZavorthControlService.js';
import {
  createTestLogRepo,
  fetchZavorthControlJson,
} from '../helpers/zavorthControlWebTestUtils.js';

describe('ZavorthControlService classic security', () => {
  const logRepo = createTestLogRepo();
  const originalWebAuthToken = config.zavorthWebAuthToken;

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
  });

  it('blocks classic zavorthControl endpoints when the request is not local and no token is provided', async () => {
    config.zavorthWebAuthToken = 'classic-secret';
    const service = new ZavorthControlService(logRepo, {
      operationsHealthService: {
        readSnapshot: jest.fn(() => ({ generatedAt: '2026-04-01T12:00:00.000Z' })),
      } as any,
    });
    (service as any).classicAccess.isLoopbackAddress = () => false;

    await service.start();
    const result = await fetchZavorthControlJson(service.getUrl(), '/api/operations/health');
    await service.stopAsync();

    expect(result.status).toBe(403);
    expect(result.payload).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining('ZavorthControl classico'),
      }),
    );
  });

  it('allows classic zavorthControl endpoints with a valid token even when the request is not local', async () => {
    config.zavorthWebAuthToken = 'classic-secret';
    const service = new ZavorthControlService(logRepo, {
      operationsHealthService: {
        readSnapshot: jest.fn(() => ({ generatedAt: '2026-04-01T12:00:00.000Z' })),
      } as any,
    });
    (service as any).classicAccess.isLoopbackAddress = () => false;

    await service.start();
    const result = await fetchZavorthControlJson(service.getUrl(), '/api/operations/health', {
      token: 'classic-secret',
    });
    await service.stopAsync();

    expect(result.status).toBe(200);
    expect(result.payload).toEqual(
      expect.objectContaining({
        generatedAt: expect.any(String),
      }),
    );
  });

  it.each(['/api/plugin-os/actions', '/api/skill-registry/actions'])(
    'requires a token for new control-plane mutations on %s',
    async (route) => {
      config.zavorthWebAuthToken = 'classic-secret';
      const service = new ZavorthControlService(logRepo);
      await service.start();

      const result = await fetchZavorthControlJson(service.getUrl(), route, {
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'refresh', approved: true }),
        },
      });
      await service.stopAsync();

      expect(result.status).toBe(403);
      expect(result.payload).toEqual(expect.objectContaining({ ok: false }));
    },
  );
});
