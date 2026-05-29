import { config } from '../../src/config/index.js';
import { ZavorthControlService } from '../../src/services/ZavorthControlService.js';
import {
  createTestLogRepo,
  fetchZavorthControlJson,
} from '../helpers/controlWebTestUtils.js';

describe('ZavorthControl gateway endpoints', () => {
  const logRepo = createTestLogRepo();
  const originalWebAuthToken = config.zavorthWebAuthToken;

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
  });

  it('serves unified gateway snapshots through operations and web endpoints', async () => {
    config.zavorthWebAuthToken = 'gateway-secret';
    const domainSummary = {
      generatedAt: '2026-04-02T12:00:00.000Z',
      summary: {
        total: 10,
        initialized: 10,
        pending: 0,
      },
      entries: [
        {
          id: 'gateway',
          label: 'Gateway',
          status: 'initialized',
        },
      ],
    };
    const domainSnapshot = {
      ...domainSummary,
      entries: [
        {
          id: 'gateway',
          label: 'Gateway',
          status: 'initialized',
          detail: {
            channels: 2,
            remoteTransports: 1,
          },
        },
      ],
    };
    const snapshot = {
      generatedAt: '2026-04-02T12:00:00.000Z',
      session: null,
      channels: { summary: { total: 2 } },
      capabilities: { summary: { total: 12 } },
      runtimeModes: { summary: { total: 5 } },
      teams: { summary: { total: 3 } },
      tools: { summary: { total: 9 } },
      hooks: { summary: { totalRegistered: 2 } },
      plugins: { summary: { capabilityPlugins: 1 } },
      domains: domainSummary,
      controlPlane: {
        generatedAt: '2026-04-02T12:00:00.000Z',
        summary: {
          hooksRegistered: 2,
          hooksCovered: 2,
          runtimeModesReady: 3,
          runtimeModesPartial: 1,
          securityLevel: 'strong',
          remoteTransportsReady: 2,
          remoteAttention: 1,
          remotePendingWork: 0,
          toolFamilies: 4,
        },
        hookPlane: { summary: { registeredHooks: 2 } },
        runtimeModes: { summary: { ready: 3 } },
        securityMesh: { posture: { level: 'strong' } },
        remoteTransports: { summary: { ready: 2 } },
        toolSurface: { summary: { families: 4 } },
        suggestedActions: [],
        narrative: {
          headline: 'Gateway / Hooks / Runtime / Transports',
          operatorSummary: '3 runtimes e 2 hooks registrados.',
        },
      },
      narrative: {
        headline: 'Gateway pronto.',
        operatorSummary: 'Snapshot unificado.',
      },
    };
    const gatewayService = {
      buildSnapshot: jest.fn(() => snapshot),
      buildHydratedSnapshot: jest.fn(async () => snapshot),
      buildDomainSummarySnapshot: jest.fn(() => domainSummary),
      buildDomainSnapshot: jest.fn(() => domainSnapshot),
    };
    const service = new ZavorthControlService(logRepo, {
      gatewayService: gatewayService as any,
    });

    await service.start();
    const baseUrl = service.getUrl();
    const { payload: operationsPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/operations/gateway',
    );
    const { payload: webPayload } = await fetchZavorthControlJson(baseUrl, '/api/web/gateway', {
      token: 'gateway-secret',
    });
    const { payload: operationsControlPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/operations/control-plane',
    );
    const { payload: operationsDomainPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/operations/gateway/domains',
    );
    const { payload: operationsDomainFullPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/operations/gateway/domains?detail=full',
    );
    const { payload: webControlPayload } = await fetchZavorthControlJson(baseUrl, '/api/web/control-plane', {
      token: 'gateway-secret',
    });

    await service.stopAsync();

    expect(operationsPayload.narrative.headline).toBe('Gateway pronto.');
    expect(operationsPayload.domains).toEqual(domainSummary);
    expect(operationsDomainPayload).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          total: 10,
          initialized: 10,
        }),
      }),
    );
    expect(operationsDomainFullPayload).toEqual(
      expect.objectContaining({
        entries: expect.arrayContaining([
          expect.objectContaining({
            id: 'gateway',
            detail: expect.objectContaining({
              channels: 2,
            }),
          }),
        ]),
      }),
    );
    expect(webPayload).toEqual(
      expect.objectContaining({
        ok: true,
        gateway: expect.objectContaining({
          narrative: expect.objectContaining({
            operatorSummary: 'Snapshot unificado.',
          }),
        }),
      }),
    );
    expect(operationsControlPayload).toEqual(
      expect.objectContaining({
        narrative: expect.objectContaining({
          headline: 'Gateway / Hooks / Runtime / Transports',
        }),
        summary: expect.objectContaining({
          runtimeModesReady: 3,
          hooksRegistered: 2,
        }),
      }),
    );
    expect(webControlPayload).toEqual(
      expect.objectContaining({
        ok: true,
        controlPlane: expect.objectContaining({
          summary: expect.objectContaining({
            remoteTransportsReady: 2,
          }),
        }),
        gateway: expect.objectContaining({
          controlPlane: expect.objectContaining({
            summary: expect.objectContaining({
              toolFamilies: 4,
            }),
          }),
        }),
      }),
    );
    expect(gatewayService.buildDomainSummarySnapshot).toHaveBeenCalledTimes(1);
    expect(gatewayService.buildDomainSnapshot).toHaveBeenCalledTimes(1);
  }, 15000);
});
