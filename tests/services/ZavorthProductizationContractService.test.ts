import { ZavorthProductizationContractService } from '../../src/services/ZavorthProductizationContractService.js';

describe('ZavorthProductizationContractService', () => {
  const now = () => new Date('2026-05-03T19:40:00.000Z');

  function buildReadyInput() {
    const activeRun = {
      id: 'run-c9',
      traceId: 'trace-c9',
      requestId: 'request-c9',
      sessionId: 'session-c9',
      userId: 'grey',
      channel: 'web',
      title: 'C9 productization',
      input: 'mostre o estado do produto',
      status: 'completed',
      createdAt: '2026-05-03T19:35:00.000Z',
      updatedAt: '2026-05-03T19:36:00.000Z',
      summary: 'Contrato C9 pronto.',
      events: [
        {
          id: 'event-1',
          runId: 'run-c9',
          kind: 'status',
          title: 'Recebido',
          status: 'done',
          createdAt: '2026-05-03T19:35:00.000Z',
        },
      ],
      toolExposure: {
        mode: 'confirm',
        summary: 'Tools com approval.',
        tools: [
          {
            id: 'workspace.read',
            label: 'Workspace read',
            risk: 'safe',
            requiresApproval: false,
          },
          {
            id: 'workspace.write',
            label: 'Workspace write',
            risk: 'attention',
            requiresApproval: true,
          },
        ],
        blockedTools: [
          {
            id: 'imported.mcp',
            label: 'Imported MCP',
            reason: 'quarantine',
          },
        ],
        toolExposureGatedByImportedCapabilityTrust: true,
      },
      replyPorts: [],
      modelProfile: {
        providerLabel: 'OpenAI',
        modelLabel: 'gpt-5.2',
        routingPolicy: 'gateway',
        routeId: 'coding/default',
        familyId: 'coding',
      },
      approvals: [
        {
          id: 'approval-1',
          runId: 'run-c9',
          title: 'Workspace write',
          reason: 'Precisa editar arquivo.',
          risk: 'attention',
          status: 'pending',
          createdAt: '2026-05-03T19:35:30.000Z',
        },
      ],
      artifacts: [
        {
          id: 'artifact-1',
          title: 'receipt.json',
          kind: 'report',
          createdAt: '2026-05-03T19:36:00.000Z',
          status: 'ready',
        },
      ],
      memorySignals: [],
      metadata: {
        trustSlider: {
          level: 'collaborator',
          permissionScope: 'session',
        },
      },
    };

    return {
      runtimeSnapshot: {
        generatedAt: '2026-05-03T19:40:00.000Z',
        controlPlane: {
          preferredTransport: 'ws',
          availableTransports: ['http', 'sse', 'ws'],
          websocketPath: '/api/web/gateway/ws',
          ssePath: '/api/web/events',
          statePath: '/api/web/state',
          historyPath: '/api/web/gateway/sessions/history',
          sendPath: '/api/web/gateway/sessions/send',
          spawnPath: '/api/web/gateway/sessions/spawn',
          heartbeatIntervalMs: 15_000,
          reconnectStrategy: 'reuse-session-state',
          sessionId: 'session-c9',
          chatId: 'web:session-c9',
        },
      },
      gatewayControlApi: {
        ok: true,
        contractVersion: '2026-04-27.p2-006h',
        generatedAt: '2026-05-03T19:40:00.000Z',
        boundary: {
          stableEntry: 'fixture',
          currentCut: 'P2-006h',
          doNotBypass: [],
        },
        health: {
          status: 'ready',
          providerControlPlaneAttached: true,
          AIGateway: null,
          lastHealthyProvider: 'openai',
          issues: [],
        },
        providers: {
          source: 'provider-control-plane',
          includeAdvanced: false,
          currentProvider: 'openai',
          currentModel: 'gpt-5.2',
          summary: {
            total: 1,
            ready: 1,
            needsConfig: 0,
            needsProbe: 0,
          },
          entries: [],
        },
        models: {
          source: 'provider-control-plane',
          entries: [
            {
              providerId: 'openai',
              providerLabel: 'OpenAI',
              model: 'gpt-5.2',
              ready: true,
              modality: 'chat',
            },
          ],
        },
        modelPicker: {
          schemaVersion: 1,
          selected: {
            providerLabel: 'OpenAI',
            modelLabel: 'gpt-5.2',
            familyId: 'coding',
            routeId: 'coding/default',
            source: 'current-config',
          },
          families: [],
          routes: [],
          onboarding: {} as any,
        } as any,
        profiles: [],
        combos: {
          status: 'available',
          sourceRoutes: ['/api/combos'],
          entries: [],
          warnings: [],
        },
        cache: {
          status: 'available',
          sourceRoutes: ['/api/cache/stats'],
          semanticStats: null,
          warnings: [],
        },
        rateLimits: {
          status: 'available',
          sourceRoutes: ['/api/rate-limits'],
          entries: [],
          warnings: [],
        },
        operations: [
          {
            id: 'providers.list',
            method: 'GET',
            path: '/api/gateway-control/providers',
            risk: 'read',
            requiresApproval: false,
            status: 'available',
            source: 'provider-control-plane',
            summary: 'providers',
          },
          {
            id: 'providers.test',
            method: 'POST',
            path: '/api/gateway-control/providers/test',
            risk: 'sensitive',
            requiresApproval: true,
            status: 'available',
            source: 'ai-gateway-route',
            summary: 'test',
          },
        ],
        warnings: [],
      },
      agentGatewaySnapshot: {
        generatedAt: '2026-05-03T19:40:00.000Z',
        source: {
          kind: 'universal-agent-runtime',
          label: 'Zavorth Agent Gateway',
        },
        activeRun,
        runs: [activeRun],
        runObservatory: {
          generatedAt: '2026-05-03T19:40:00.000Z',
          query: { limit: 50 },
          totalRuns: 1,
          matchedRuns: 1,
          indexes: {
            runIds: ['run-c9'],
            traceIds: ['trace-c9'],
            sessionIds: ['session-c9'],
            statuses: [{ status: 'completed', count: 1 }],
          },
          runs: [{ run: activeRun, matchedBy: ['recent'] }],
        },
        capabilityLoopGovernance: null,
        runtimePromotionGovernance: {
          schemaVersion: 1,
          generatedAt: '2026-05-03T19:40:00.000Z',
          source: 'RuntimePromotionGovernanceService',
          entries: [],
          officialItemIds: [],
          experimentalItemIds: [],
          blockedItemIds: [],
          prohibitedPublicClaims: [],
          summary: 'fixture',
        },
        workflowJobs: [],
        workflowQueue: {
          kind: 'memory',
          status: 'ready',
          queued: 0,
          running: 0,
          waitingApproval: 0,
          failed: 0,
        },
      },
      firstRunSnapshot: {
        stage: '48',
        surface: 'first-run-onboarding',
        generatedAt: '2026-05-03T19:40:00.000Z',
        status: 'ready',
        websiteRoot: 'C:/repo/zavorth-website',
        summary: {
          ok: true,
          passed: 8,
          warnings: 0,
          failed: 0,
        },
        route: '/start',
        fixturePath: 'data/first-run.ts',
        requiredStates: ['Ready'],
        requiredArtifacts: ['fixture/zavorth-first-run-workspace'],
        screenshots: [],
        checks: [],
        nextRecommendedStage: {
          stage: '49',
          title: 'External Docs',
          reason: 'fixture',
        },
      },
      websiteSnapshot: {
        stage: '46',
        surface: 'website-public',
        generatedAt: '2026-05-03T19:40:00.000Z',
        status: 'ready',
        websiteRoot: 'C:/repo/zavorth-website',
        summary: {
          ok: true,
          passed: 10,
          warnings: 0,
          failed: 0,
        },
        canonicalBase: {
          repoName: 'zavorth-website',
          envOverride: 'ZAVORTH_WEBSITE_REPO_ROOT',
          expectedPackageName: 'zavorth-website',
        },
        narrative: {
          headline: 'Zavorth',
          promise: 'preview publico',
          requiredSections: [],
        },
        requiredRoutes: [],
        requiredLinks: [],
        screenshots: [],
        forbiddenClaims: [],
        checks: [
          {
            id: 'website:forbidden-claims',
            title: 'claims proibidas',
            status: 'pass',
            reason: 'sem claims proibidas',
          },
        ],
        nextRecommendedStage: {
          stage: '47',
          title: 'Public demo',
          reason: 'fixture',
        },
      },
      sandboxSnapshot: {
        generatedAt: '2026-05-03T19:40:00.000Z',
        workspaceRoot: 'C:/repo',
        platform: 'win32',
        summary: {
          posture: 'healthy',
          preferredProfile: 'wasm',
          availableProfiles: 1,
          strongProfilesReady: 1,
          untrustedExecutionReady: true,
          heavyRuntimesStarted: false,
          doctorStatus: 'ready',
        },
        policy: {
          defaultNetworkPolicy: 'none',
          allowedNetworkPolicies: ['none'],
          filesystem: {
            tempWorkspaceOnly: true,
            hostMountsReadOnly: true,
            deniedHostWrite: true,
            artifactCollection: 'explicit',
            defaultTempRoot: 'C:/repo/data/runtime/sandbox-runs',
          },
          mutation: {
            dangerousCommandsRequirePlan: true,
            trustPlaneDomain: 'sandbox',
            approvalRequiredFor: ['execute-untrusted'],
          },
          cleanup: {
            killOnTimeout: true,
            removeWorkspace: true,
            removeContainerOrVm: true,
            ttlMs: 1000,
          },
        },
        budgets: {
          maxDurationMs: 1000,
          memoryMb: 256,
          cpuCores: 1,
          maxNetworkCalls: 0,
        },
        profiles: [],
        doctor: {
          ready: ['wasm'],
          dormant: [],
          disabled: [],
          notInstalled: [],
          unsupported: [],
          degraded: [],
          recommendedCommands: [],
        },
        envelopePreview: null,
        actions: [],
        narrative: {
          headline: 'Sandbox',
          operatorSummary: 'ready',
          nextAction: 'none',
        },
      } as any,
    } as any;
  }

  it('builds a ready C9 productization contract when runtime, CLI, onboarding, docs and website align', () => {
    const snapshot = new ZavorthProductizationContractService({ now }).buildSnapshot(buildReadyInput());

    expect(snapshot.phase).toBe('C9');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.control.items.map((item) => item.id)).toEqual([
      'experience-mode',
      'trust-posture',
      'active-permissions',
      'pending-approvals',
      'run-receipts',
      'sandbox-posture',
      'provider-route',
      'capabilities',
    ]);
    expect(snapshot.cli).toEqual(expect.objectContaining({
      sameContract: true,
      command: 'zavorth productization --json',
    }));
    expect(snapshot.onboarding.areas.map((area) => area.id)).toEqual(expect.arrayContaining([
      'host',
      'providers',
      'channels',
      'workspace',
      'safety-posture',
    ]));
    expect(snapshot.website).toEqual(expect.objectContaining({
      promisePolicy: 'stable-or-preview-only',
      forbiddenClaimsBlocked: true,
    }));
    expect(snapshot.acceptance).toEqual({
      commonUserUnderstands: true,
      operatorCanAudit: true,
      docsUiRuntimeAgree: true,
    });
  });

  it('keeps missing product surfaces explicit instead of pretending C9 is ready', () => {
    const input = buildReadyInput();
    delete (input as any).websiteSnapshot;
    delete (input as any).sandboxSnapshot;

    const snapshot = new ZavorthProductizationContractService({ now }).buildSnapshot(input);

    expect(snapshot.status).toBe('partial');
    expect(snapshot.website.status).toBe('blocked');
    expect(snapshot.control.items.find((item) => item.id === 'sandbox-posture')?.status).toBe('blocked');
    expect(snapshot.blockers).toEqual(expect.arrayContaining([
      'WebsitePublicContractSnapshot ausente.',
      'Sandbox posture nao esta conectada ao contrato de produto.',
    ]));
  });
});
