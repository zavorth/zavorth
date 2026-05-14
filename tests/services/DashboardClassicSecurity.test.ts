import { config } from '../../src/config/index.js';
import { DashboardService } from '../../src/services/DashboardService.js';
import {
  createTestLogRepo,
  fetchDashboardJson,
} from '../helpers/dashboardWebTestUtils.js';

describe('DashboardService classic security', () => {
  const logRepo = createTestLogRepo();
  const originalWebAuthToken = config.zavorthWebAuthToken;

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
  });

  it('blocks classic dashboard endpoints when the request is not local and no token is provided', async () => {
    config.zavorthWebAuthToken = 'classic-secret';
    const service = new DashboardService(logRepo, {
      operationsHealthService: {
        readSnapshot: jest.fn(() => ({ generatedAt: '2026-04-01T12:00:00.000Z' })),
      } as any,
    });
    (service as any).classicAccess.isLoopbackAddress = () => false;

    await service.start();
    const result = await fetchDashboardJson(service.getUrl(), '/api/operations/health');
    await service.stopAsync();

    expect(result.status).toBe(403);
    expect(result.payload).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining('Dashboard classico'),
      }),
    );
  });

  it('allows classic dashboard endpoints with a valid token even when the request is not local', async () => {
    config.zavorthWebAuthToken = 'classic-secret';
    const service = new DashboardService(logRepo, {
      operationsHealthService: {
        readSnapshot: jest.fn(() => ({ generatedAt: '2026-04-01T12:00:00.000Z' })),
      } as any,
    });
    (service as any).classicAccess.isLoopbackAddress = () => false;

    await service.start();
    const result = await fetchDashboardJson(service.getUrl(), '/api/operations/health', {
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
});
