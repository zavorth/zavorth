import { config } from '../../src/config/index.js';
import { SatellitePwaRouteService } from '../../src/services/SatellitePwaRouteService.js';
import { DashboardService } from '../../src/services/DashboardService.js';
import {
  createTestLogRepo,
  fetchNoKeepAlive,
} from '../helpers/dashboardWebTestUtils.js';

describe('SatellitePwaRouteService', () => {
  const originalWebAuthToken = config.zavorthWebAuthToken;

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
  });

  it('resolves the PWA shell and static JavaScript asset', () => {
    const service = new SatellitePwaRouteService(process.cwd());

    const shell = service.resolveAsset('/satellite');
    const script = service.resolveAsset('/satellite/satellite.js');

    expect(shell?.contentType).toBe('text/html; charset=utf-8');
    expect(shell?.body.toString('utf8')).toContain('Zavorth Satellite');
    expect(script?.contentType).toBe('application/javascript; charset=utf-8');
    expect(script?.body.toString('utf8')).toContain('/api/web/satellite/ws');
  });

  it('serves /satellite through the dashboard web surface without dashboard auth', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const service = new DashboardService(createTestLogRepo());

    await service.start();
    const response = await fetchNoKeepAlive(`${service.getUrl()}/satellite`);
    const body = await response.text();
    await service.stopAsync();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(response.headers.get('x-zavorth-satellite-ws')).toBe('/api/web/satellite/ws');
    expect(body).toContain('Zavorth Satellite');
  });
});
