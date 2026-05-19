import type {
  AccessRouteCatalogEntry,
  AccessRouteReadinessCode,
  ModelPickerReadiness,
} from '../../src/contracts/ModelPickerContract.js';
import { ZavorthProviderReadinessMatrixService } from '../../src/services/ZavorthProviderReadinessMatrixService.js';

describe('ZavorthProviderReadinessMatrixService', () => {
  it('normalizes provider readiness into product-level statuses', () => {
    const service = new ZavorthProviderReadinessMatrixService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
      providerControlPlane: providerPlane([
        route('openai', 'ready'),
        route('anthropic', 'missing_auth'),
        route('custom-openai-compatible', 'missing_base_url'),
        route('ollama', 'needs_probe'),
        route('aigateway', 'unhealthy'),
        route('legacy', 'unsupported'),
      ]),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-14.checkpoint-3-live-completion');
    expect(snapshot.summary.ready).toBe(1);
    expect(snapshot.summary.liveNotRun).toBeGreaterThan(0);
    expect(snapshot.summary.catalogReadyButNotLive).toBe(1);
    expect(snapshot.summary.defaultRouteAllowed).toBe(0);
    expect(snapshot.summary.missingAuth).toBe(1);
    expect(snapshot.summary.missingBaseUrl).toBe(1);
    expect(snapshot.summary.needsProbe).toBe(1);
    expect(snapshot.summary.degraded).toBe(1);
    expect(snapshot.summary.unsupported).toBe(1);
    expect(snapshot.commandCenterProjection.executionAuthority).toBe(false);
    expect(snapshot.liveCompletion).toEqual(expect.objectContaining({
      providerSelectionRequiresLiveProof: true,
      catalogSupportIsNotLiveProof: true,
      defaultRoutingPolicy: 'ready-and-live-proof',
      rawSecretsSerialized: false,
    }));
    expect(snapshot.entries.find((entry) => entry.id === 'openai')).toEqual(expect.objectContaining({
      catalogReady: true,
      liveReady: false,
      defaultRouteAllowed: false,
      readinessProof: 'catalog',
      defaultBlockReason: expect.stringContaining('live'),
    }));
    expect(JSON.stringify(snapshot)).not.toContain('sk-');
  });

  it('creates explicit provider test packets without hidden live network calls', () => {
    const service = new ZavorthProviderReadinessMatrixService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
      providerControlPlane: providerPlane([
        route('openai', 'ready'),
      ]),
    });

    const snapshot = service.buildSnapshot({
      providerId: 'openai',
      probe: true,
    });

    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0].probe.status).toBe('ready_to_probe');
    expect(snapshot.entries[0].probe.liveNetworkUsed).toBe(false);
    expect(snapshot.entries[0].probe.mode).toBe('catalog_only');
    expect(snapshot.entries[0].liveReady).toBe(false);
    expect(snapshot.entries[0].defaultRouteAllowed).toBe(false);
    expect(snapshot.entries[0].testCommand).toBe('zavorth providers test openai');
  });

  it('runs explicit live probes with sanitized evidence when requested', async () => {
    const fetchMock = jest.fn(async () => new Response(
      JSON.stringify({ data: [{ id: 'gpt-test' }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    const service = new ZavorthProviderReadinessMatrixService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
      fetch: fetchMock as unknown as typeof fetch,
      providerControlPlane: providerPlane([
        route('openai', 'ready'),
      ]),
    });

    process.env.OPENAI_API_KEY = 'test-key';
    const snapshot = await service.buildLiveSnapshot({
      providerId: 'openai',
      live: true,
    });
    delete process.env.OPENAI_API_KEY;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(snapshot.summary.livePassed).toBe(1);
    expect(snapshot.summary.liveReady).toBe(1);
    expect(snapshot.summary.defaultRouteAllowed).toBe(1);
    expect(snapshot.entries[0].probe.status).toBe('passed');
    expect(snapshot.entries[0].liveReady).toBe(true);
    expect(snapshot.entries[0].defaultRouteAllowed).toBe(true);
    expect(snapshot.entries[0].readinessProof).toBe('live_probe');
    expect(snapshot.entries[0].probe.liveNetworkUsed).toBe(true);
    expect(snapshot.entries[0].probe.target).toBe('https://api.openai.com/v1/models');
    expect(snapshot.entries[0].probe.evidenceHash).toMatch(/^[a-f0-9]{16}$/);
    expect(JSON.stringify(snapshot)).not.toContain('test-key');
  });

  it('blocks operator-blocked providers even when catalog says ready', () => {
    const service = new ZavorthProviderReadinessMatrixService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
      providerControlPlane: providerPlane([
        route('openrouter', 'ready'),
      ]),
    });

    const snapshot = service.buildSnapshot({
      blockedProviderIds: ['openrouter'],
    });

    expect(snapshot.entries[0].status).toBe('blocked');
    expect(snapshot.summary.blocked).toBe(1);
  });
});

function providerPlane(routes: AccessRouteCatalogEntry[]) {
  return {
    resolveAccessRoutes: () => ({
      schemaVersion: 1 as const,
      generatedAt: '2026-05-13T12:00:00.000Z',
      routes,
      byFamily: [],
      summary: {
        totalRoutes: routes.length,
        readyRoutes: routes.filter((entry) => entry.ready).length,
        blockedRoutes: routes.filter((entry) => !entry.ready).length,
        byReadinessCode: {},
        byRouteClass: {},
      },
    }),
    listProfiles: () => [
      {
        id: 'balanced' as const,
        label: 'Balanced',
        summary: 'Balanced profile',
        preferredOrder: ['openai', 'gemini'],
      },
    ],
    getCurrentConversationalProvider: () => 'openai',
    getCurrentConversationalModel: () => 'gpt-test',
  };
}

function route(id: string, code: AccessRouteReadinessCode): AccessRouteCatalogEntry {
  const readiness: ModelPickerReadiness = code === 'ready'
    ? 'ready'
    : code === 'needs_probe' || code === 'unhealthy'
      ? 'needs_probe'
      : 'needs_config';
  return {
    id,
    label: id,
    familyIds: [id],
    vendorId: id,
    providerId: id,
    providerName: id,
    routeKind: id === 'ollama' ? 'local_runtime' : 'official',
    mode: id === 'ollama' ? 'local' : 'cloud',
    aliases: [],
    requirements: code === 'missing_base_url' ? ['CUSTOM_OPENAI_COMPATIBLE_BASE_URL'] : [`${id.toUpperCase()}_API_KEY`],
    credentialKind: code === 'missing_base_url' ? 'local_endpoint' : 'api_key',
    credentialRefs: code === 'missing_base_url' ? ['CUSTOM_OPENAI_COMPATIBLE_BASE_URL'] : [`${id.toUpperCase()}_API_KEY`],
    currentModelName: `${id}-model`,
    secondaryModelNames: [],
    fallbackModelNames: [],
    readiness,
    readinessCode: code,
    ready: code === 'ready',
    issue: code === 'ready' ? null : `issue:${code}`,
    routeClass: id === 'ollama' ? 'local' : 'official',
    authConfigured: code !== 'missing_auth',
    baseUrlRef: code === 'missing_base_url' ? 'CUSTOM_OPENAI_COMPATIBLE_BASE_URL' : null,
    baseUrlConfigured: code !== 'missing_base_url',
    discoverySupported: true,
    connectionId: null,
    providerNodeId: null,
    proxyId: null,
    health: code === 'unhealthy'
      ? {
          status: 'unhealthy',
          message: 'provider degraded',
          checkedAt: '2026-05-13T12:00:00.000Z',
        }
      : null,
    explanation: [`explain:${code}`],
    capabilities: ['chat'],
    modalities: ['text'],
    limitations: [],
    fallbackRouteIds: [],
    catalogSource: 'provider_catalog',
  };
}
