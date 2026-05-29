import { ZavorthControlService } from '../../../../../src/services/ZavorthControlService.js';
import {
  createTestLogRepo,
  fetchZavorthControlJson,
} from '../../../../helpers/zavorthControlWebTestUtils.js';

describe('ZavorthControl operational maturity route', () => {
  it('exposes the canonical maturity snapshot for ZavorthControl surfaces', async () => {
    const service = new ZavorthControlService(createTestLogRepo());

    try {
      await service.start();
      const { status, payload } = await fetchZavorthControlJson(
        service.getUrl(),
        '/api/v2/maturity/snapshot',
      );

      expect(status).toBe(200);
      expect(payload).toEqual(expect.objectContaining({
        ok: true,
        data: expect.objectContaining({
          schemaVersion: 'operational-maturity.v1',
          invariants: expect.objectContaining({
            nexusIsSurfaceOnly: true,
            echoIsEdgeLayerOnly: true,
            noParallelRuntimeClaim: true,
          }),
        }),
      }));
      expect(payload.data.capabilities).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'nexus-surface', status: 'stable' }),
        expect.objectContaining({ id: 'echo-edge-layer', status: 'stable' }),
      ]));
    } finally {
      await service.stopAsync();
    }
  });
});
