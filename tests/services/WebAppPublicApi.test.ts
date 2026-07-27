import { config } from '../../src/config/index.js';
import { DashboardService } from '../../src/services/DashboardService.js';
import { createTestLogRepo, fetchJson } from '../helpers/dashboardWebTestUtils.js';

/** Meets isWeakZavorthControlToken floor (length >= 32). */
const STRONG_PUBLIC_API_TOKEN = 'dashboard-secret-test-token-32chars!!';

describe('Web app canonical public api', () => {
  const logRepo = createTestLogRepo();
  const originalWebAuthToken = config.zavorthWebAuthToken;

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
  });

  it('exposes canonical v1 endpoints with live runtime-backed data behind public api auth', async () => {
    config.zavorthWebAuthToken = STRONG_PUBLIC_API_TOKEN;
    const publicApiAuthHeaders = {
      authorization: `Bearer ${STRONG_PUBLIC_API_TOKEN}`,
    };
    const operationsHealthService = {
      readSnapshotFast: jest.fn(() => ({
        maintenance: {
          startedAt: null,
          finishedAt: null,
        },
        errors: {
          lastError: null,
        },
      })),
      readSnapshotLive: jest.fn(() => ({
        maintenance: {
          startedAt: null,
          finishedAt: null,
        },
        errors: {
          lastError: null,
        },
      })),
    };
    const sessionPlaneService = {
      buildSnapshot: jest.fn(async () => ({
        generatedAt: '2026-04-08T20:00:00.000Z',
        sessions: {
          total: 1,
          entries: [
            {
              id: 'web:session-1',
              sessionId: 'session-1',
              label: 'Session Principal',
              latestStatus: 'running',
              updatedAt: '2026-04-08T19:59:00.000Z',
              platform: 'web',
              workspace: 'workspace-a',
            },
          ],
        },
      })),
    };
    const platformRegistryService = {
      buildSnapshot: jest.fn(() => ({
        catalogSync: {
          status: 'ready',
          syncedAt: '2026-04-08T20:00:00.000Z',
          checkedAt: '2026-04-08T20:00:00.000Z',
          summary: 'Remote catalog synced.',
          sourceTrusted: true,
          stale: false,
          entryCount: 1,
          collectionCount: 1,
          recipeCount: 1,
        },
        generatedAt: '2026-04-08T20:00:00.000Z',
        summary: {
          total: 1,
          plugins: 1,
          skills: 0,
          mcps: 0,
          trusted: 1,
          reviewPending: 0,
          quarantined: 0,
          learnedLocal: 0,
          collections: 1,
          featuredCollections: 1,
          recipes: 1,
          featuredRecipes: 1,
          ready: 1,
          partial: 0,
          planned: 0,
          disabled: 0,
          catalogBacked: 1,
          discoveryOnly: 0,
          featured: 1,
          official: 0,
          trustedThirdParty: 1,
        },
        entries: [
          {
            id: 'plugin:openrouter',
            label: 'OpenRouter',
            kind: 'plugin',
            summary: 'Gateway remoto ready.',
            registrySource: 'registry:local',
            source: 'workspace',
            origin: 'trusted-third-party',
            readiness: 'ready',
            installState: 'installed',
            trustState: 'trusted',
            reviewState: 'approved',
            signatureState: 'catalog-verified',
            runtimePermissionProfile: 'catalog-discovery',
            featured: true,
            discoveryOnly: false,
            provenance: {
              sourceTrusted: true,
              sourceLocator: 'registry:local/openrouter',
            },
          },
        ],
        collections: [
          {
            id: 'collection:remote-providers',
            label: 'Remote providers',
            source: 'registry:local',
            summary: 'Providers remotos confiaveis.',
            actionHint: 'Use to configure providers.',
            featured: true,
            itemCount: 1,
            readyCount: 1,
            adoptedCount: 1,
            missingCount: 0,
            kinds: ['plugin'],
            tags: ['providers'],
            capabilities: ['gateway.route'],
            entryIds: ['plugin:openrouter'],
          },
        ],
        recipes: [
          {
            id: 'recipe:provider-bootstrap',
            label: 'Provider bootstrap',
            source: 'registry:local',
            summary: 'Conecta um provider remoto.',
            actionHint: 'Siga a receita.',
            featured: true,
            itemCount: 1,
            readyCount: 1,
            adoptedCount: 1,
            missingCount: 0,
            tags: ['bootstrap'],
            steps: ['Registrar provider', 'Validar doctor'],
            targetIds: ['plugin:openrouter'],
          },
        ],
        narrative: {
          headline: 'Public catalog ready',
          operatorSummary: '1 plugin publico ready para integradores.',
        },
      })),
    };
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-08T20:00:00.000Z',
        summary: {
          total: 1,
        },
        entries: [
          {
            id: 'oracle-node',
            pairingStatus: 'paired',
            status: 'online',
            lastSeenAt: '2026-04-08T19:58:00.000Z',
            updatedAt: '2026-04-08T19:58:00.000Z',
            createdAt: '2026-04-08T19:00:00.000Z',
            hostHints: {
              arch: 'x64',
              osRelease: 'Ubuntu 24.04',
              deviceModel: 'Oracle VM',
              networkType: 'ethernet',
              locationLabel: 'sa-east',
            },
            capabilityIds: ['system.run', 'files.write'],
          },
        ],
      })),
    };
    const remoteTransportService = {
      buildSnapshot: jest.fn(() => ({
        entries: [
          {
            id: 'AIGateway',
            available: true,
            readiness: 'ready',
            endpoint: 'http://127.0.0.1:21128/v1',
            telemetry: {
              updatedAt: '2026-04-08T19:57:00.000Z',
            },
          },
          {
            id: 'node-host',
            available: false,
            readiness: 'partial',
            endpoint: null,
            telemetry: {
              updatedAt: '2026-04-08T19:56:00.000Z',
            },
          },
        ],
      })),
    };
    const gatewayService = {
      buildDomainSummarySnapshot: jest.fn(() => ({
        generatedAt: '2026-04-08T20:00:00.000Z',
        summary: {
          total: 10,
          initialized: 10,
          pending: 0,
        },
        domains: [
          {
            id: 'gateway',
            label: 'Gateway',
            initialized: true,
            initializedAt: '2026-04-08T19:50:00.000Z',
          },
          {
            id: 'sessions',
            label: 'Sessions',
            initialized: true,
            initializedAt: '2026-04-08T19:50:00.000Z',
          },
        ],
      })),
      buildDomainSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-08T20:00:00.000Z',
        summary: {
          total: 10,
          initialized: 10,
          pending: 0,
        },
        domains: {
          gateway: {
            id: 'gateway',
            label: 'Gateway',
            initialized: true,
            initializedAt: '2026-04-08T19:50:00.000Z',
            summary: 'Gateway consolidado.',
            details: [],
            metrics: {
              channels: 2,
            },
          },
          sessions: {
            id: 'sessions',
            label: 'Sessions',
            initialized: true,
            initializedAt: '2026-04-08T19:50:00.000Z',
            summary: 'Session plane ready.',
            details: [],
            metrics: {
              sessions: 1,
            },
          },
        },
      })),
      buildHydratedSnapshot: jest.fn(async () => ({
        generatedAt: '2026-04-08T20:00:00.000Z',
        memoryPlane: {
          artifacts: {
            recent: [
              {
                id: 'artifact-1',
                label: 'Report',
                kind: 'report',
                summary: 'Resumo final',
                path: 'C:/tmp/report.md',
                createdAt: '2026-04-08T19:55:00.000Z',
                sourceTaskId: 'task-1',
              },
            ],
          },
        },
      })),
    };
    const learningPlaneService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-08T20:00:00.000Z',
        summary: {
          total: 1,
          pending: 1,
          approved: 0,
          rejected: 0,
          promoted: 0,
          published: 0,
          quarantined: 0,
          highConfidence: 1,
        },
        candidates: [
          {
            id: 'candidate:wf-1',
            platformEntryId: 'skill:learned:ship:workspace-a:wf-1',
            title: 'Ship playbook para workspace-a',
            kind: 'playbook',
            summary: 'Playbook aprendido a partir de uma run completa.',
            score: 0.88,
            reviewState: 'pending',
            lifecycle: 'learned_draft',
            createdAt: '2026-04-08T19:00:00.000Z',
            updatedAt: '2026-04-08T19:59:00.000Z',
            lastValidatedAt: '2026-04-08T19:59:00.000Z',
            source: {
              workflowRunId: 'wf-1',
              workflow: 'ship',
              workspace: 'workspace-a',
              objective: 'Publicar o gateway.',
              artifactCount: 1,
              completedStages: 2,
              totalStages: 2,
              originTaskId: 'task-1',
              sourceSurface: 'web',
            },
            steps: ['Inspect runtime', 'Publish release'],
            details: ['Workflow: ship'],
          },
        ],
        narrative: {
          headline: 'Learning plane com 1 candidato.',
          operatorSummary: '1 candidato pendente de review.',
        },
      })),
      readMetrics: jest.fn(() => ({
        generatedAt: '2026-04-08T20:00:00.000Z',
        summary: {
          totalCandidates: 1,
          acceptedRate: 0,
          rejectedRate: 0,
          promotedRate: 0,
          averageScore: 0.88,
        },
        counts: {
          pending: 1,
          approved: 0,
          rejected: 0,
          promoted: 0,
          published: 0,
          quarantined: 0,
          highConfidence: 1,
        },
      })),
      executeAction: jest.fn(async () => ({
        generatedAt: '2026-04-08T20:01:00.000Z',
        candidateId: 'candidate:wf-1',
        actionId: 'approve',
        status: 'applied',
        ok: true,
        summary: 'Candidate approved.',
        details: ['Continua como learned_draft ate promote.'],
      })),
    };
    const layeredMemoryService = {
      buildStatus: jest.fn(async () => ({
        generatedAt: '2026-04-08T20:00:00.000Z',
        summary: {
          total: 5,
          episodic: 2,
          semantic: 2,
          procedural: 1,
        },
        budgets: {
          perLayer: 12,
          episodicUsage: 0.16,
          semanticUsage: 0.16,
          proceduralUsage: 0.08,
        },
        narrative: {
          headline: 'Layered memory ready para recall.',
          operatorSummary: '2 episodicos, 2 semanticos e 1 procedimento.',
        },
      })),
      readMetrics: jest.fn(async () => ({
        generatedAt: '2026-04-08T20:00:00.000Z',
        summary: {
          totalEntries: 5,
          episodic: 2,
          semantic: 2,
          procedural: 1,
          averageBudgetUsage: 0.133,
          pressure: 'ok',
        },
        budgets: {
          perLayer: 12,
          episodicUsage: 0.16,
          semanticUsage: 0.16,
          proceduralUsage: 0.08,
        },
        procedures: {
          total: 1,
          trustedLocal: 0,
          learnedDraft: 1,
          implicit: 0,
        },
      })),
      search: jest.fn(async () => ({
        generatedAt: '2026-04-08T20:00:00.000Z',
        query: 'gateway release',
        total: 2,
        data: [
          {
            id: 'timeline-1',
            label: 'Gateway release',
            summary: 'Release final do gateway.',
            memoryLayer: 'episodic',
            source: 'workflow',
            confidence: 0.74,
            lastValidatedAt: '2026-04-08T19:59:00.000Z',
          },
          {
            id: 'candidate:wf-1',
            label: 'Ship playbook para workspace-a',
            summary: 'Playbook aprendido a partir de uma run completa.',
            memoryLayer: 'procedural',
            source: 'learning-plane',
            confidence: 0.88,
            lastValidatedAt: '2026-04-08T19:59:00.000Z',
          },
        ],
      })),
      readProcedures: jest.fn(async () => ({
        generatedAt: '2026-04-08T20:00:00.000Z',
        total: 1,
        data: [
          {
            id: 'candidate:wf-1',
            label: 'Ship playbook para workspace-a',
            summary: 'Playbook aprendido a partir de uma run completa.',
            steps: ['Inspect runtime', 'Publish release'],
            memoryLayer: 'procedural',
            source: 'learning-plane',
            confidence: 0.88,
            lastValidatedAt: '2026-04-08T19:59:00.000Z',
          },
        ],
      })),
    };

    const service = new DashboardService(logRepo, {
      operationsHealthService: operationsHealthService as any,
      sessionPlaneService: sessionPlaneService as any,
      platformRegistryService: platformRegistryService as any,
      nodeMeshService: nodeMeshService as any,
      remoteTransportService: remoteTransportService as any,
      gatewayService: gatewayService as any,
      learningPlaneService: learningPlaneService as any,
      layeredMemoryService: layeredMemoryService as any,
    });

    await service.start();
    const baseUrl = service.getUrl();

    const canonicalStatus = await fetchJson(`${baseUrl}/api/v1/status`);
    const canonicalHealth = await fetchJson(`${baseUrl}/api/v1/health`);
    const canonicalProviders = await fetchJson(`${baseUrl}/api/v1/providers`, {
      headers: publicApiAuthHeaders,
    });
    const canonicalChannels = await fetchJson(`${baseUrl}/api/v1/channels`, {
      headers: publicApiAuthHeaders,
    });
    const canonicalChatPreview = await fetchJson(`${baseUrl}/api/v1/chat`, {
      method: 'POST',
      headers: {
        ...publicApiAuthHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Review this workspace safely.',
      }),
    });
    const canonicalEvents = await fetchJson(`${baseUrl}/api/v1/events-sessionId=session-1`, {
      headers: publicApiAuthHeaders,
    });
    const gatewayStatus = await fetchJson(`${baseUrl}/api/v1/gateway/status`);
    const gatewayDomains = await fetchJson(`${baseUrl}/api/v1/gateway/domains`, {
      headers: publicApiAuthHeaders,
    });
    const opsHealth = await fetchJson(`${baseUrl}/api/v1/ops/health`);
    const opsQuality = await fetchJson(`${baseUrl}/api/v1/ops/quality-sessionId=session-1`, {
      headers: publicApiAuthHeaders,
    });
    const sessions = await fetchJson(`${baseUrl}/api/v1/sessions-userId=attacker`, {
      headers: publicApiAuthHeaders,
    });
    const platform = await fetchJson(`${baseUrl}/api/v1/platform/status`);
    const nodes = await fetchJson(`${baseUrl}/api/v1/nodes`, {
      headers: publicApiAuthHeaders,
    });
    const transports = await fetchJson(`${baseUrl}/api/v1/transports`, {
      headers: publicApiAuthHeaders,
    });
    const artifacts = await fetchJson(`${baseUrl}/api/v1/artifacts-sessionId=session-1`, {
      headers: publicApiAuthHeaders,
    });
    const platformCatalog = await fetchJson(`${baseUrl}/api/v1/platform/catalog-q=openrouter`);
    const learningStatus = await fetchJson(`${baseUrl}/api/v1/learning/status`, {
      headers: publicApiAuthHeaders,
    });
    const learningCandidates = await fetchJson(`${baseUrl}/api/v1/learning/candidates`, {
      headers: publicApiAuthHeaders,
    });
    const learningMetrics = await fetchJson(`${baseUrl}/api/v1/learning/metrics`, {
      headers: publicApiAuthHeaders,
    });
    const learningAction = await fetchJson(`${baseUrl}/api/v1/learning/actions`, {
      method: 'POST',
      headers: {
        ...publicApiAuthHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        candidateId: 'candidate:wf-1',
        actionId: 'approve',
      }),
    });
    const memoryStatus = await fetchJson(`${baseUrl}/api/v1/memory/status-sessionId=session-1&userId=attacker`, {
      headers: publicApiAuthHeaders,
    });
    const memorySearch = await fetchJson(`${baseUrl}/api/v1/memory/search-q=gateway%20release&sessionId=session-1&userId=attacker`, {
      headers: publicApiAuthHeaders,
    });
    const memoryProcedures = await fetchJson(`${baseUrl}/api/v1/memory/procedures`, {
      headers: publicApiAuthHeaders,
    });
    const memoryMetrics = await fetchJson(`${baseUrl}/api/v1/memory/metrics-sessionId=session-1&userId=attacker`, {
      headers: publicApiAuthHeaders,
    });

    await service.stopAsync();

    expect(canonicalStatus.status).toBe(200);
    expect(canonicalStatus.payload).toEqual(expect.objectContaining({
      ok: true,
      data: expect.objectContaining({
        surface: 'runtime-api-v1',
        runtime: expect.objectContaining({
          executionAuthority: false,
        }),
      }),
      error: null,
      traceId: expect.stringMatching(/^api_/),
    }));
    expect(canonicalHealth.status).toBe(200);
    expect(canonicalHealth.payload).toEqual(expect.objectContaining({
      ok: true,
      data: expect.objectContaining({
        surface: 'runtime-health-v1',
        safety: expect.objectContaining({
          publicApiCanBypassPolicy: false,
        }),
      }),
    }));
    expect(canonicalProviders.status).toBe(200);
    expect(canonicalProviders.payload).toEqual(expect.objectContaining({
      ok: true,
      data: expect.objectContaining({
        surface: 'provider-mesh-v1',
        safety: expect.objectContaining({
          rawSecretsSerialized: false,
        }),
      }),
    }));
    expect(canonicalChannels.status).toBe(200);
    expect(canonicalChannels.payload).toEqual(expect.objectContaining({
      ok: true,
      data: expect.objectContaining({
        surface: 'channel-mesh-v1',
        safety: expect.objectContaining({
          telegramPrivileged: false,
        }),
      }),
    }));
    expect(canonicalChatPreview.status).toBe(200);
    expect(canonicalChatPreview.payload).toEqual(expect.objectContaining({
      ok: true,
      data: expect.objectContaining({
        surface: 'chat-v1',
        live: false,
        mode: 'preview',
      }),
    }));
    expect(canonicalEvents.status).toBe(200);
    expect(canonicalEvents.payload).toEqual(expect.objectContaining({
      ok: true,
      data: expect.objectContaining({
        surface: 'runtime-events-v1',
        streaming: expect.objectContaining({
          canonicalEventTypes: expect.arrayContaining(['approval.request', 'runtime.status']),
        }),
      }),
    }));
    expect(gatewayStatus.status).toBe(200);
    expect(gatewayStatus.payload).toEqual(
      expect.objectContaining({
        version: expect.any(String),
        status: expect.stringMatching(/^(ready|starting|error|maintenance)$/),
      }),
    );
    expect(gatewayDomains.status).toBe(200);
    expect(gatewayDomains.payload).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          total: 10,
          initialized: 10,
          pending: 0,
        }),
        domains: expect.arrayContaining([
          expect.objectContaining({
            id: 'gateway',
            label: 'Gateway',
          }),
        ]),
      }),
    );
    expect(opsHealth.status).toBe(200);
    expect(opsHealth.payload).toEqual(
      expect.objectContaining({
        healthy: false,
        components: expect.objectContaining({
          database: 'ok',
          eventBus: 'error',
        }),
      }),
    );
    expect(opsQuality.status).toBe(200);
    expect(opsQuality.payload).toEqual(
      expect.objectContaining({
        score: expect.any(Number),
        gate: expect.objectContaining({
          state: 'block',
          allowsPromotion: false,
          allowsPublishing: false,
          blockers: expect.arrayContaining([
            expect.stringContaining('Operations health degradado'),
          ]),
        }),
        summary: expect.objectContaining({
          learningPending: 1,
          memoryPressure: 'ok',
        }),
        learning: expect.objectContaining({
          totalCandidates: 1,
          averageScore: 0.88,
        }),
        memory: expect.objectContaining({
          totalEntries: 5,
          pressure: 'ok',
        }),
      }),
    );
    expect(sessions.status).toBe(200);
    expect(sessions.payload).toEqual(
      expect.objectContaining({
        total: 1,
        hasMore: false,
        data: [
          expect.objectContaining({
            id: 'session-1',
            title: 'Session Principal',
            status: 'active',
          }),
        ],
      }),
    );
    expect(platform.status).toBe(200);
    expect(platform.payload).toEqual(
      expect.objectContaining({
        registryConnected: true,
        summary: expect.objectContaining({
          total: 1,
          plugins: 1,
        }),
        plugins: [
          expect.objectContaining({
            id: 'openrouter',
            name: 'OpenRouter',
          }),
        ],
        items: expect.arrayContaining([
          expect.objectContaining({
            id: 'plugin:openrouter',
            origin: 'trusted-third-party',
            trustState: expect.stringMatching(/^(trusted|review|planned|quarantined)$/),
            signatureState: expect.stringMatching(/^(verified|catalog-verified|workspace|unsigned|none)$/),
          }),
        ]),
      }),
    );
    expect(nodes.status).toBe(200);
    expect(nodes.payload).toEqual(
      expect.objectContaining({
        total: 1,
        data: [
          expect.objectContaining({
            id: 'oracle-node',
            status: 'online',
            identity: expect.objectContaining({
              arch: 'x64',
            }),
          }),
        ],
      }),
    );
    expect(transports.status).toBe(200);
    expect(transports.payload).toEqual(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'AIGateway',
            status: 'connected',
          }),
          expect.objectContaining({
            id: 'node-host',
            status: 'degraded',
          }),
        ]),
      }),
    );
    expect(artifacts.status).toBe(200);
    expect(artifacts.payload).toEqual(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            id: 'artifact-1',
            sessionId: 'session-1',
            contentUri: 'C:/tmp/report.md',
          }),
        ],
      }),
    );
    expect(platformCatalog.status).toBe(200);
    expect(platformCatalog.payload).toEqual(
      expect.objectContaining({
        sync: expect.objectContaining({
          status: 'ready',
          entryCount: 1,
          collectionCount: 1,
          recipeCount: 1,
        }),
        collections: expect.arrayContaining([
          expect.objectContaining({
            id: 'collection:remote-providers',
            featured: true,
          }),
        ]),
        recipes: expect.arrayContaining([
          expect.objectContaining({
            id: 'recipe:provider-bootstrap',
            targetIds: expect.arrayContaining(['plugin:openrouter']),
          }),
        ]),
        narrative: expect.objectContaining({
          headline: 'Public catalog ready',
        }),
      }),
    );
    expect(learningStatus.status).toBe(200);
    expect(learningStatus.payload).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          total: 1,
          pending: 1,
        }),
      }),
    );
    expect(learningCandidates.status).toBe(200);
    expect(learningCandidates.payload).toEqual(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'candidate:wf-1',
            lifecycle: 'learned_draft',
          }),
        ]),
      }),
    );
    expect(learningMetrics.status).toBe(200);
    expect(learningMetrics.payload).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          totalCandidates: 1,
          averageScore: 0.88,
        }),
        counts: expect.objectContaining({
          pending: 1,
        }),
      }),
    );
    expect(learningAction.status).toBe(200);
    expect(learningAction.payload).toEqual(
      expect.objectContaining({
        candidateId: 'candidate:wf-1',
        actionId: 'approve',
        ok: true,
      }),
    );
    expect(memoryStatus.status).toBe(200);
    expect(memoryStatus.payload).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          total: 5,
          episodic: 2,
          procedural: 1,
        }),
      }),
    );
    expect(memorySearch.status).toBe(200);
    expect(memorySearch.payload).toEqual(
      expect.objectContaining({
        query: 'gateway release',
        data: expect.arrayContaining([
          expect.objectContaining({
            memoryLayer: 'episodic',
          }),
          expect.objectContaining({
            memoryLayer: 'procedural',
          }),
        ]),
      }),
    );
    expect(memoryProcedures.status).toBe(200);
    expect(memoryProcedures.payload).toEqual(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'candidate:wf-1',
            steps: expect.arrayContaining(['Inspect runtime', 'Publish release']),
          }),
        ]),
      }),
    );
    expect(memoryMetrics.status).toBe(200);
    expect(memoryMetrics.payload).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          totalEntries: 5,
          pressure: 'ok',
        }),
        procedures: expect.objectContaining({
          total: 1,
          learnedDraft: 1,
        }),
      }),
    );
    expect(sessionPlaneService.buildSnapshot).toHaveBeenCalled();
    expect(sessionPlaneService.buildSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'web-user',
    }));
    expect(gatewayService.buildDomainSummarySnapshot).toHaveBeenCalled();
    expect(gatewayService.buildDomainSnapshot).not.toHaveBeenCalled();
    expect(gatewayService.buildHydratedSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
      }),
    );
    expect(learningPlaneService.buildSnapshot).toHaveBeenCalled();
    expect(learningPlaneService.readMetrics).toHaveBeenCalled();
    expect(learningPlaneService.executeAction).toHaveBeenCalledWith({
      candidateId: 'candidate:wf-1',
      actionId: 'approve',
      approvalId: null,
    });
    expect(layeredMemoryService.buildStatus).toHaveBeenCalled();
    expect(layeredMemoryService.readMetrics).toHaveBeenCalled();
    expect(layeredMemoryService.search).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'gateway release',
        userId: 'web-user',
        sessionId: 'session-1',
      }),
    );
  });

  it('rejects sensitive canonical endpoints without public api auth', async () => {
    config.zavorthWebAuthToken = STRONG_PUBLIC_API_TOKEN;
    const service = new DashboardService(logRepo, {
      sessionPlaneService: {
        buildSnapshot: jest.fn(),
      } as any,
    });

    await service.start();
    const result = await fetchJson(`${service.getUrl()}/api/v1/sessions-userId=victim`);
    const providers = await fetchJson(`${service.getUrl()}/api/v1/providers`);
    await service.stopAsync();

    expect(result.status).toBe(401);
    expect(result.payload).toEqual(expect.objectContaining({
      error: expect.objectContaining({
        code: 'UNAUTHORIZED',
      }),
    }));
    expect(providers.status).toBe(401);
    expect(providers.payload).toEqual(expect.objectContaining({
      ok: false,
      data: null,
      error: expect.objectContaining({
        code: 'UNAUTHORIZED',
      }),
      traceId: expect.stringMatching(/^api_/),
    }));
  });

  it('keeps artifacts empty when the canonical request is not scoped to a session', async () => {
    config.zavorthWebAuthToken = STRONG_PUBLIC_API_TOKEN;
    const service = new DashboardService(logRepo, {
      gatewayService: {
        buildHydratedSnapshot: jest.fn(),
      } as any,
    });

    await service.start();
    const result = await fetchJson(`${service.getUrl()}/api/v1/artifacts`, {
      headers: {
        authorization: `Bearer ${STRONG_PUBLIC_API_TOKEN}`,
      },
    });
    await service.stopAsync();

    expect(result.status).toBe(200);
    expect(result.payload).toEqual({
      data: [],
    });
  });
});
