import { ZavorthRuntimeReadinessService } from '../../src/services/ZavorthRuntimeReadinessService.js';
import { ZavorthRuntimeReadinessUxService } from '../../src/services/ZavorthRuntimeReadinessUxService.js';

describe('ZavorthRuntimeReadinessUxService', () => {
  it('projects technical readiness into operator cards for CLI, dashboard and Telegram', async () => {
    const readiness = await new ZavorthRuntimeReadinessService({
      now: () => new Date('2026-05-16T12:00:00.000Z'),
      env: {},
      projectRoot: process.cwd(),
      existsSync: (file) => String(file).endsWith('page.tsx'),
      providerReadiness: {
        buildSnapshot: () => providerSnapshot({ ready: 0, defaultRouteAllowed: 0, missingAuth: 1 }),
      },
    }).buildSnapshot();
    const service = new ZavorthRuntimeReadinessUxService();
    const ux = service.buildSnapshot(readiness);
    const cli = service.renderCli(ux);

    expect(ux.contractVersion).toBe('zavorth-runtime-readiness-ux/1');
    expect(ux.surface).toBe('runtime-readiness-operator-ux');
    expect(ux.status).toBe('attention');
    expect(ux.statusLabel).toBe('Atencao');
    expect(ux.dailyUseLabel).toBe('com attention');
    expect(ux.dashboardProjection).toEqual(expect.objectContaining({
      route: '/zavorthControl',
      endpoint: '/api/runtime/readiness',
      slot: 'runtime-readiness',
      renderMode: 'operator-cards',
      showTechnicalDetailsByDefault: false,
      executionAuthority: false,
    }));
    expect(ux.cards.find((card) => card.id === 'provider-mesh')).toEqual(expect.objectContaining({
      title: 'Provider',
      statusLabel: 'Atencao',
      href: '/dashboard/providers',
    }));
    expect(ux.telegramProjection).toEqual(expect.objectContaining({
      command: '/readiness',
      showTechnicalDetailsByDefault: false,
      executionAuthority: false,
    }));
    expect(ux.telegramProjection.replyMarkup.inline_keyboard.flat().map((button) => button.callback_data)).toEqual([
      '/zavorthControl',
      '/status',
      '/models',
      '/fixes',
      '/echoapprovals',
    ]);
    expect(cli).toContain('Zavorth usavel, com attention.');
    expect(cli).toContain('Provider: Atencao.');
    expect(cli).not.toContain('[checks]');
    expect(cli).not.toContain('defaultRouteAllowed');
    expect(cli).not.toContain('tokenPresent');
  });
});

function providerSnapshot(input: {
  ready: number;
  defaultRouteAllowed: number;
  missingAuth-: number;
}) {
  return {
    contractVersion: '2026-05-14.checkpoint-3-live-completion',
    schemaVersion: 1,
    surface: 'provider-readiness-matrix',
    generatedAt: '2026-05-16T12:00:00.000Z',
    status: input.ready > 0 ? 'ready' : 'attention',
    activeProvider: input.ready > 0 ? 'openai' : 'none',
    activeModel: input.ready > 0 ? 'gpt-test' : 'none',
    summary: {
      total: 1,
      ready: input.ready,
      livePassed: 0,
      liveFailed: 0,
      liveBlocked: 0,
      liveNotRun: 1,
      liveReady: 0,
      catalogReadyButNotLive: input.ready,
      defaultRouteAllowed: input.defaultRouteAllowed,
      missingAuth: input.missingAuth || 0,
      missingBaseUrl: 0,
      needsProbe: 0,
      degraded: 0,
      unsupported: 0,
      blocked: 0,
    },
    entries: [],
    profiles: [],
    simpleCatalog: {
      fastAndCheap: [],
      higherIntelligence: [],
      localPrivate: [],
      openAiCompatible: [],
    },
    liveCompletion: {
      providerSelectionRequiresLiveProof: true,
      catalogSupportIsNotLiveProof: true,
      liveProbeRequiresExplicitOperatorAction: true,
      rawSecretsSerialized: false,
      publicApiProviderTestEndpoint: '/api/v1/providers/:id/test',
      defaultRoutingPolicy: 'ready-and-live-proof',
      counts: {
        catalogReady: input.ready,
        liveReady: 0,
        catalogReadyButNotLive: input.ready,
        defaultRouteAllowed: input.defaultRouteAllowed,
      },
    },
    commands: [],
    dashboardProjection: {
      route: '/zavorthControl',
      endpoint: '/api/providers/readiness',
      executionAuthority: false,
      canRenderTestButtons: true,
    },
    invariants: [],
    nextAction: input.ready > 0 ? 'Provider ready.' : 'Configure provider credentials.',
  };
}
