import type {
  AccessRouteCatalogEntry,
  AccessRouteReadinessCode,
  ModelPickerReadiness,
} from '../../src/contracts/ModelPickerContract.js';
import { ZavorthProviderSelectionUxService } from '../../src/services/ZavorthProviderSelectionUxService.js';

describe('ZavorthProviderSelectionUxService', () => {
  it('selects an explicit ready provider but recommends live proof when requested', async () => {
    const service = new ZavorthProviderSelectionUxService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
      readiness: readinessPlane([
        route('openai', 'ready'),
        route('gemini', 'ready'),
      ]),
    });

    const snapshot = await service.buildSnapshot({
      target: 'openai',
      requireLiveEvidence: true,
    });

    expect(snapshot.contractVersion).toBe('2026-05-13.phase-11');
    expect(snapshot.decision).toBe('test_first');
    expect(snapshot.selected?.providerId).toBe('openai');
    expect(snapshot.safety).toEqual(expect.objectContaining({
      catalogIsNotLiveProof: true,
      selectionDoesNotWriteConfig: true,
      liveProbeRequiresExplicitCommand: true,
      rawSecretsSerialized: false,
      dashboardExecutionAuthority: false,
    }));
    expect(snapshot.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'live-test-selected',
        command: 'zavorth providers test openai --live',
        liveNetworkUsed: true,
        mutatesConfig: false,
      }),
    ]));
  });

  it('chooses a fallback when the requested provider is missing credentials', async () => {
    const service = new ZavorthProviderSelectionUxService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
      readiness: readinessPlane([
        route('anthropic', 'missing_auth'),
        route('gemini', 'ready'),
      ]),
    });

    const snapshot = await service.buildSnapshot({
      target: 'anthropic',
      intent: 'smart',
    });

    expect(snapshot.selected?.providerId).toBe('anthropic');
    expect(snapshot.decision).toBe('choose_fallback');
    expect(snapshot.fallbacks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        providerId: 'gemini',
        canUseNow: true,
      }),
    ]));
    expect(snapshot.nextAction).toContain('fallback');
  });

  it('supports intent-based selection for local/private use without mutating config', async () => {
    const service = new ZavorthProviderSelectionUxService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
      readiness: readinessPlane([
        route('openai', 'ready'),
        route('ollama', 'needs_probe'),
      ]),
    });

    const snapshot = await service.buildSnapshot({
      intent: 'local',
    });

    expect(snapshot.selected?.providerId).toBe('ollama');
    expect(snapshot.decision).toBe('test_first');
    expect(snapshot.selected?.commands.liveTest).toBe('zavorth providers test ollama --live');
    expect(JSON.stringify(snapshot)).not.toContain('sk-');
  });
});

function readinessPlane(routes: AccessRouteCatalogEntry[]) {
  return {
    async buildLiveSnapshot(input: { providerId?: string | null }) {
      const entries = routes
        .filter((entry) => !input.providerId || entry.id === input.providerId || entry.providerId === input.providerId)
        .map((entry) => {
          const status = entry.readinessCode === 'ready'
            ? 'ready'
            : entry.readinessCode === 'needs_probe'
              ? 'needs_probe'
              : entry.readinessCode === 'missing_auth'
                ? 'missing_auth'
                : entry.readinessCode === 'missing_base_url'
                  ? 'missing_base_url'
                  : entry.readinessCode === 'unsupported'
                    ? 'unsupported'
                    : 'degraded';
          return {
            id: entry.id,
            label: entry.label,
            providerName: entry.providerName,
            providerId: entry.providerId,
            familyIds: entry.familyIds,
            routeKind: entry.routeKind,
            routeClass: entry.routeClass || 'unknown',
            mode: entry.mode,
            credentialKind: entry.credentialKind,
            credentialRefs: entry.credentialRefs,
            requirements: entry.requirements,
            currentModelName: entry.currentModelName,
            capabilities: entry.capabilities,
            status,
            catalogReady: entry.ready,
            authConfigured: entry.authConfigured,
            baseUrlConfigured: entry.baseUrlConfigured,
            discoverySupported: entry.discoverySupported,
            health: entry.health,
            issue: entry.issue,
            explanation: entry.explanation,
            userAction: entry.issue || `Use ${entry.id}`,
            testCommand: `zavorth providers test ${entry.id}`,
            probe: {
              status: status === 'ready' || status === 'needs_probe' ? 'ready_to_probe' : 'blocked',
              mode: 'catalog_only',
              liveNetworkUsed: false,
              requestedAt: null,
              completedAt: null,
              durationMs: null,
              target: null,
              httpStatus: null,
              modelCount: null,
              evidenceHash: null,
              summary: 'fixture probe',
            },
            rawSecretsPresent: false,
          };
        });
      return {
        contractVersion: '2026-05-13.phase-5',
        schemaVersion: 1,
        surface: 'provider-readiness-matrix',
        generatedAt: '2026-05-13T12:00:00.000Z',
        status: 'ready',
        activeProvider: 'gemini',
        activeModel: 'gemini-test',
        summary: {
          total: entries.length,
          ready: entries.filter((entry) => entry.status === 'ready').length,
          livePassed: 0,
          liveFailed: 0,
          liveBlocked: entries.filter((entry) => entry.probe.status === 'blocked').length,
          liveNotRun: entries.length,
          missingAuth: entries.filter((entry) => entry.status === 'missing_auth').length,
          missingBaseUrl: entries.filter((entry) => entry.status === 'missing_base_url').length,
          needsProbe: entries.filter((entry) => entry.status === 'needs_probe').length,
          degraded: 0,
          unsupported: 0,
          blocked: 0,
        },
        entries,
        profiles: [],
        simpleCatalog: {
          fastAndCheap: [],
          higherIntelligence: [],
          localPrivate: [],
          openAiCompatible: [],
        },
        commands: [],
        commandCenterProjection: {
          route: '/control',
          endpoint: '/api/providers/readiness',
          executionAuthority: false,
          canRenderTestButtons: true,
        },
        invariants: [],
        nextAction: 'fixture',
      } as any;
    },
  };
}

function route(id: string, code: AccessRouteReadinessCode): AccessRouteCatalogEntry {
  const readiness: ModelPickerReadiness = code === 'ready'
    ? 'ready'
    : code === 'needs_probe'
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
    requirements: [`${id.toUpperCase()}_API_KEY`],
    credentialKind: id === 'ollama' ? 'local_endpoint' : 'api_key',
    credentialRefs: [`${id.toUpperCase()}_API_KEY`],
    currentModelName: `${id}-model`,
    secondaryModelNames: [],
    fallbackModelNames: [],
    readiness,
    readinessCode: code,
    ready: code === 'ready',
    issue: code === 'ready' ? null : `Configure ${id}`,
    routeClass: id === 'ollama' ? 'local' : 'official',
    authConfigured: code !== 'missing_auth',
    baseUrlRef: null,
    baseUrlConfigured: code !== 'missing_base_url',
    discoverySupported: true,
    connectionId: null,
    providerNodeId: null,
    proxyId: null,
    health: null,
    explanation: [`explain:${code}`],
    capabilities: ['chat'],
    modalities: ['text'],
    limitations: [],
    fallbackRouteIds: [],
    catalogSource: 'provider_catalog',
  };
}
