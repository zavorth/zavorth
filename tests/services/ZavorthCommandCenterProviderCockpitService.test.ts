import type { ZavorthProviderReadinessMatrixSnapshot } from '../../src/contracts/ZavorthProviderReadinessMatrixContract.js';
import { ZavorthCommandCenterProviderCockpitService } from '../../src/services/ZavorthCommandCenterProviderCockpitService.js';

describe('ZavorthCommandCenterProviderCockpitService', () => {
  it('projects provider live matrix into a read-only Command Center cockpit contract', async () => {
    const service = new ZavorthCommandCenterProviderCockpitService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
      providerReadiness: {
        buildLiveSnapshot: jest.fn(async () => matrixFixture()),
      },
    });

    const projection = await service.buildProjection({
      selectedProviderId: 'openai',
    });

    expect(projection).toEqual(expect.objectContaining({
      contractVersion: '2026-05-13.checkpoint-6',
      surface: 'command-center-provider-cockpit',
      executionAuthority: false,
      visualMutationApplied: false,
      selectedProviderId: 'openai',
      commandCenterProjection: expect.objectContaining({
        route: '/control',
        visualApprovalRequired: true,
      }),
      safety: expect.objectContaining({
        noRawProviderSecrets: true,
        commandCenterCannotExecuteProviderCalls: true,
      }),
    }));
    expect(projection.cards).toEqual([
      expect.objectContaining({
        providerId: 'openai',
        liveStatus: 'passed',
        evidence: expect.objectContaining({
          target: 'https://api.openai.com/v1/models',
          evidenceHash: 'evidence-123',
        }),
        actions: expect.arrayContaining([
          expect.objectContaining({
            kind: 'live_probe',
            dashboardCanExecute: false,
          }),
        ]),
      }),
    ]);
    expect(JSON.stringify(projection)).not.toContain('sk-test');
  });

  it('keeps blocked provider actions as guidance instead of dashboard execution authority', async () => {
    const service = new ZavorthCommandCenterProviderCockpitService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
      providerReadiness: {
        buildLiveSnapshot: jest.fn(async () => ({
          ...matrixFixture(),
          summary: {
            ...matrixFixture().summary,
            ready: 0,
            livePassed: 0,
            liveBlocked: 1,
            missingAuth: 1,
          },
          entries: [
            {
              ...matrixFixture().entries[0],
              id: 'anthropic',
              label: 'Anthropic',
              status: 'missing_auth',
              userAction: 'Configure ANTHROPIC_API_KEY.',
              probe: {
                ...matrixFixture().entries[0].probe,
                status: 'blocked',
                liveNetworkUsed: false,
                summary: 'Provider live probe is blocked until credentials are configured.',
              },
            },
          ],
        })),
      },
    });

    const projection = await service.buildProjection();

    expect(projection.status).toBe('attention');
    expect(projection.cards[0].actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'configure',
        dashboardCanExecute: false,
      }),
    ]));
    expect(projection.actions.every((action) => action.dashboardCanExecute === false)).toBe(true);
  });
});

function matrixFixture(): ZavorthProviderReadinessMatrixSnapshot {
  return {
    contractVersion: '2026-05-13.checkpoint-5',
    schemaVersion: 1,
    surface: 'provider-readiness-matrix',
    generatedAt: '2026-05-13T12:00:00.000Z',
    status: 'ready',
    activeProvider: 'openai',
    activeModel: 'gpt-test',
    summary: {
      total: 1,
      ready: 1,
      livePassed: 1,
      liveFailed: 0,
      liveBlocked: 0,
      liveNotRun: 0,
      missingAuth: 0,
      missingBaseUrl: 0,
      needsProbe: 0,
      degraded: 0,
      unsupported: 0,
      blocked: 0,
    },
    entries: [
      {
        id: 'openai',
        label: 'OpenAI',
        providerName: 'openai',
        providerId: 'openai',
        familyIds: ['openai'],
        routeKind: 'official',
        routeClass: 'official',
        mode: 'cloud',
        credentialKind: 'api_key',
        credentialRefs: ['OPENAI_API_KEY'],
        requirements: ['OPENAI_API_KEY'],
        currentModelName: 'gpt-test',
        capabilities: ['chat'],
        status: 'ready',
        catalogReady: true,
        authConfigured: true,
        baseUrlConfigured: true,
        discoverySupported: true,
        health: null,
        issue: null,
        explanation: [],
        userAction: 'Provider can be selected.',
        testCommand: 'zavorth providers test openai',
        probe: {
          status: 'passed',
          mode: 'explicit_live_probe',
          liveNetworkUsed: true,
          requestedAt: '2026-05-13T12:00:00.000Z',
          completedAt: '2026-05-13T12:00:01.000Z',
          durationMs: 1000,
          target: 'https://api.openai.com/v1/models',
          httpStatus: 200,
          modelCount: 1,
          evidenceHash: 'evidence-123',
          summary: 'Live probe passed.',
        },
        rawSecretsPresent: false,
      },
    ],
    profiles: [],
    simpleCatalog: {
      fastAndCheap: ['openai'],
      higherIntelligence: ['openai'],
      localPrivate: [],
      openAiCompatible: ['openai'],
    },
    commands: [],
    commandCenterProjection: {
      route: '/control',
      endpoint: '/api/providers/readiness',
      executionAuthority: false,
      canRenderTestButtons: true,
    },
    invariants: [],
    nextAction: 'Provider live evidence is available.',
  };
}
