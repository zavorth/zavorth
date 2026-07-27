import { ZavorthGatewayService } from '../../src/services/ZavorthGatewayService.js';

describe('ZavorthGatewayService', () => {
  it('aggregates gateway slices and forwards the effective workspace to team snapshots', () => {
    const buildTeamSnapshot = jest.fn(() => ({
      generatedAt: '2026-04-02T12:00:00.000Z',
      summary: {
        total: 3,
        active: 1,
        resumable: 1,
        completedRecently: 1,
        executors: ['codex', 'external_executor'],
      },
      teams: [],
      narrative: {
        headline: '3 composed teams.',
        operatorSummary: '1 resumption pronta.',
      },
    }));

    const service = new ZavorthGatewayService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      capabilityCatalogService: {
        buildSnapshot: jest.fn(() => ({
          integrations: { ready: 2 },
        })),
      } as any,
      runtimeModesService: {
        buildSnapshot: jest.fn(() => ({
          summary: { ready: 4, partial: 1 },
          entries: [],
        })),
      } as any,
      securityMeshService: {
        buildSnapshot: jest.fn(() => ({
          posture: {
            level: 'strong',
            label: 'Strong',
          },
          suggestedActions: [
            {
              id: 'security-review',
              label: 'Revisar policy',
              command: '/runtime',
              severity: 'warn',
              reason: 'Runtime principal exige review.',
            },
          ],
        })),
      } as any,
      teamCatalogService: {
        buildSnapshot: buildTeamSnapshot,
      } as any,
      sessionToolsService: {
        buildSnapshot: jest.fn(() => ({
          sessions: [{ id: 'session-1' }],
          continuity: {
            focusTask: {
              workspace: 'workspace-alpha',
            },
          },
        })),
      } as any,
      toolSurfaceService: {
        buildSnapshot: jest.fn(() => ({
          summary: { families: 7 },
        })),
      } as any,
      hookPlaneService: {
        buildSnapshot: jest.fn(() => ({
          summary: { supportedEvents: 2, coveredEvents: 2, registeredHooks: 3 },
        })),
      } as any,
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 2,
            paired: 1,
            pending: 1,
            online: 1,
            offline: 0,
            invokable: 1,
            capabilities: 3,
          },
          entries: [],
          selected: {
            id: 'node-alpha',
            maintenance: {
              supported: true,
              pending: 0,
              claimed: 0,
              latestStatus: 'completed',
              latestAction: 'repair',
              latestResultSummary: 'Repair completed.',
              recoverKind: null,
            },
          },
          capabilityCatalog: [],
          suggestedActions: [],
          narrative: {
            headline: '2 nodes no control plane.',
            operatorSummary: '1 node pareado.',
          },
        })),
      } as any,
      pluginRegistryService: {
        buildSnapshot: jest.fn(() => ({
          summary: { total: 1 },
        })),
      } as any,
      remoteTransportService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 3,
            ready: 2,
            partial: 1,
            planned: 0,
            disabled: 0,
            live: 2,
            reachable: 1,
            attentionRequired: 1,
            pendingWork: 2,
          },
          entries: [],
          selected: null,
          suggestedActions: [
            {
              id: 'transport-repair',
              label: 'Reparar transporte',
              command: '/transports repair node-host',
              severity: 'warn',
              reason: 'Node host waiting for heartbeat.',
            },
          ],
          narrative: {
            headline: 'Transportes remotos readys.',
            operatorSummary: '2 readys.',
          },
        })),
      } as any,
      platformCapabilityService: {
        getCapabilities: jest.fn(() => [
          { platform: 'telegram', readiness: 'ready' },
          { platform: 'discord', readiness: 'partial' },
        ]),
        getSummary: jest.fn(),
      } as any,
    });

    const snapshot = service.buildSnapshot({
      sessionId: 'session-web-1',
      chatId: 'web:session-web-1',
      userId: 'telegram-admin',
    });

    expect(snapshot.generatedAt).toBe('2026-04-02T12:00:00.000Z');
    expect(snapshot.sessionTools).not.toBeNull();
    expect(snapshot.summary.channelsReady).toBe(2);
    expect(snapshot.summary.nodesPaired).toBe(1);
    expect(snapshot.summary.remoteTransportsReady).toBe(2);
    expect(snapshot.summary.sessionTargets).toBe(1);
    expect(snapshot.domains.summary).toEqual({
      total: 12,
      initialized: 12,
      pending: 0,
    });
    expect(snapshot.remoteTransports.summary.ready).toBe(2);
    expect(snapshot.controlPlane.summary).toEqual(
      expect.objectContaining({
        hooksRegistered: 3,
        hooksCovered: 2,
        runtimeModesReady: 4,
        runtimeModesPartial: 1,
        securityLevel: 'strong',
        remoteTransportsReady: 2,
        remoteAttention: 1,
        remotePendingWork: 2,
        toolFamilies: 7,
      }),
    );
    expect(snapshot.controlPlane.suggestedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'security-review' }),
        expect.objectContaining({ id: 'transport-repair' }),
      ]),
    );
    expect(snapshot.controlPlane.narrative.operatorSummary).toContain('4 runtime(s) ready(s)');
    expect(snapshot.narrative.operatorSummary).toContain('Workspace em foco: workspace-alpha.');
    expect(buildTeamSnapshot).toHaveBeenCalledWith({ workspace: 'workspace-alpha' });
  });

  it('accepts an explicit workspace hint even without session context', () => {
    const buildTeamSnapshot = jest.fn(() => ({
      generatedAt: '2026-04-02T12:00:00.000Z',
      summary: {
        total: 1,
        active: 0,
        resumable: 0,
        completedRecently: 0,
        executors: ['codex'],
      },
      teams: [],
      narrative: {
        headline: '1 team composto.',
        operatorSummary: 'idle',
      },
    }));

    const service = new ZavorthGatewayService({
      teamCatalogService: {
        buildSnapshot: buildTeamSnapshot,
      } as any,
      capabilityCatalogService: {
        buildSnapshot: jest.fn(() => ({
          integrations: { ready: 0 },
        })),
      } as any,
      runtimeModesService: {
        buildSnapshot: jest.fn(() => ({
          summary: { ready: 0 },
          entries: [],
        })),
      } as any,
      securityMeshService: {
        buildSnapshot: jest.fn(() => ({
          posture: {
            level: 'guarded',
            label: 'Guarded',
          },
        })),
      } as any,
      toolSurfaceService: {
        buildSnapshot: jest.fn(() => ({
          summary: { families: 3 },
        })),
      } as any,
      hookPlaneService: {
        buildSnapshot: jest.fn(() => ({
          summary: { supportedEvents: 1 },
        })),
      } as any,
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 0,
            paired: 0,
            pending: 0,
            online: 0,
            offline: 0,
            invokable: 0,
            capabilities: 0,
          },
          entries: [],
          selected: null,
          capabilityCatalog: [],
          suggestedActions: [],
          narrative: {
            headline: 'Sem nodes.',
            operatorSummary: 'Nada pareado.',
          },
        })),
      } as any,
      pluginRegistryService: {
        buildSnapshot: jest.fn(() => ({
          summary: { total: 0 },
        })),
      } as any,
      platformCapabilityService: {
        getCapabilities: jest.fn(() => []),
        getSummary: jest.fn(),
      } as any,
    });

    service.buildSnapshot({ workspaceHint: 'workspace-explicit' });

    expect(buildTeamSnapshot).toHaveBeenCalledWith({ workspace: 'workspace-explicit' });
  });

  it('hydrates the memory plane when a full builder is available', async () => {
    const service = new ZavorthGatewayService({
      memoryPlaneService: {
        buildSnapshotFast: jest.fn(() => ({
          generatedAt: '2026-04-02T12:00:00.000Z',
          summary: {
            persistedMemories: 0,
            relevantMemories: 0,
            replayTasks: 0,
            workflowRuns: 0,
            artifacts: 0,
            workspaceSignals: 0,
          },
          memory: { recent: [], relevant: [], categories: [], vectorRecall: false },
          replay: null,
          artifacts: { recent: [], kinds: [], latestLabel: null, reusableCount: 0 },
          workspace: null,
          suggestedActions: [],
          narrative: {
            headline: 'fast',
            operatorSummary: 'snapshot rapido',
          },
        })),
        buildSnapshot: jest.fn(async () => ({
          generatedAt: '2026-04-02T12:00:00.000Z',
          summary: {
            persistedMemories: 2,
            relevantMemories: 1,
            replayTasks: 1,
            workflowRuns: 1,
            artifacts: 3,
            workspaceSignals: 2,
          },
          memory: { recent: [], relevant: [], categories: ['workspace'], vectorRecall: true },
          replay: null,
          artifacts: { recent: [], kinds: ['doc'], latestLabel: 'briefing.md', reusableCount: 3 },
          workspace: null,
          suggestedActions: [],
          narrative: {
            headline: 'Memory, Replay & Artifacts',
            operatorSummary: 'snapshot hidratado',
          },
        })),
      } as any,
      capabilityCatalogService: {
        buildSnapshot: jest.fn(() => ({
          integrations: { ready: 0 },
        })),
      } as any,
      runtimeModesService: {
        buildSnapshot: jest.fn(() => ({
          summary: { ready: 0 },
          entries: [],
        })),
      } as any,
      securityMeshService: {
        buildSnapshot: jest.fn(() => ({
          posture: {
            level: 'guarded',
            label: 'Guarded',
          },
        })),
      } as any,
      toolSurfaceService: {
        buildSnapshot: jest.fn(() => ({
          summary: { families: 1 },
        })),
      } as any,
      hookPlaneService: {
        buildSnapshot: jest.fn(() => ({
          summary: { supportedEvents: 0 },
        })),
      } as any,
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 0,
            paired: 0,
            pending: 0,
            online: 0,
            offline: 0,
            invokable: 0,
            capabilities: 0,
          },
          entries: [],
          selected: null,
          capabilityCatalog: [],
          suggestedActions: [],
          narrative: {
            headline: 'Sem nodes.',
            operatorSummary: 'Nada pareado.',
          },
        })),
      } as any,
      pluginRegistryService: {
        buildSnapshot: jest.fn(() => ({
          summary: { total: 0 },
        })),
      } as any,
      platformCapabilityService: {
        getCapabilities: jest.fn(() => []),
        getSummary: jest.fn(),
      } as any,
    });

    const snapshot = await service.buildHydratedSnapshot({
      sessionId: 'session-web-1',
      chatId: 'web:session-web-1',
      userId: 'telegram-admin',
    });

    expect(snapshot.memoryPlane.narrative.operatorSummary).toBe('snapshot hidratado');
    expect(snapshot.summary.memoryArtifacts).toBe(3);
  });

  it('prioritizes node mesh maintenance state for node host repair actions in the control plane', () => {
    const service = new ZavorthGatewayService({
      capabilityCatalogService: {
        buildSnapshot: jest.fn(() => ({
          integrations: { ready: 0 },
        })),
      } as any,
      runtimeModesService: {
        buildSnapshot: jest.fn(() => ({
          summary: { ready: 1, partial: 0 },
          entries: [],
        })),
      } as any,
      securityMeshService: {
        buildSnapshot: jest.fn(() => ({
          posture: {
            level: 'guarded',
            label: 'Guarded',
          },
          suggestedActions: [],
        })),
      } as any,
      toolSurfaceService: {
        buildSnapshot: jest.fn(() => ({
          summary: { families: 2 },
        })),
      } as any,
      hookPlaneService: {
        buildSnapshot: jest.fn(() => ({
          summary: { supportedEvents: 2, coveredEvents: 1, registeredHooks: 1 },
        })),
      } as any,
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 2,
            paired: 2,
            pending: 0,
            online: 2,
            offline: 0,
            invokable: 2,
            capabilities: 4,
          },
          entries: [
            {
              id: 'node-host-alpha',
              label: 'Node Host Alpha',
              kind: 'headless',
              transport: 'remote',
              status: 'online',
              pairingStatus: 'paired',
              paired: true,
              createdAt: '2026-04-05T12:00:00.000Z',
              updatedAt: '2026-04-05T12:10:00.000Z',
              pairedAt: '2026-04-05T12:01:00.000Z',
              lastSeenAt: '2026-04-05T12:10:00.000Z',
              requestedBy: 'ops',
              capabilityIds: ['node.maintenance'],
              hostHints: {
                hostname: 'alpha',
                platform: 'linux',
                workspace: 'workspace-alpha',
                surface: 'node-host',
              },
              notes: [],
              operatorSummary: 'Host waiting for repair operacional.',
              capabilities: [],
              canInvoke: true,
              nextAction: 'Trigger repair do host alpha.',
              trustLabel: 'trusted',
              pendingInvocations: 1,
              claimedInvocations: 0,
              recentInvocation: null,
              maintenance: {
                supported: true,
                pending: 1,
                claimed: 0,
                latestStatus: 'failed',
                latestAction: 'repair',
                latestResultSummary: 'Repair falhou no host.',
                recoverKind: 'queue-node-host-maintenance',
              },
            },
          ],
          selected: {
            id: 'node-passive',
            label: 'Node Passive',
            kind: 'desktop',
            transport: 'local',
            status: 'online',
            pairingStatus: 'paired',
            paired: true,
            createdAt: '2026-04-05T12:00:00.000Z',
            updatedAt: '2026-04-05T12:10:00.000Z',
            pairedAt: '2026-04-05T12:01:00.000Z',
            lastSeenAt: '2026-04-05T12:10:00.000Z',
            requestedBy: 'ops',
            capabilityIds: ['system.run'],
            hostHints: {
              hostname: 'passive',
              platform: 'windows',
              workspace: 'workspace-beta',
              surface: 'desktop',
            },
            notes: [],
            operatorSummary: 'Node passivo.',
            capabilities: [],
            canInvoke: true,
            nextAction: 'Track queue.',
            trustLabel: 'trusted',
            pendingInvocations: 0,
            claimedInvocations: 0,
            recentInvocation: null,
            maintenance: {
              supported: false,
              pending: 0,
              claimed: 0,
              latestStatus: null,
              latestAction: null,
              latestResultSummary: null,
              recoverKind: null,
            },
          },
          capabilityCatalog: [],
          suggestedActions: [],
          selectedActivity: null,
          narrative: {
            headline: '2 nodes no control plane.',
            operatorSummary: 'Node host needs de repair.',
          },
        })),
      } as any,
      pluginRegistryService: {
        buildSnapshot: jest.fn(() => ({
          summary: { total: 0 },
        })),
      } as any,
      remoteTransportService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 1,
            ready: 0,
            partial: 1,
            planned: 0,
            disabled: 0,
            live: 1,
            reachable: 0,
            attentionRequired: 1,
            pendingWork: 1,
          },
          entries: [],
          selected: null,
          suggestedActions: [
            {
              id: 'node-host-repair',
              label: 'Repair fallback remoto',
              command: '/transports repair node-host',
              severity: 'warn',
              reason: 'Remote plan fallback.',
            },
          ],
          narrative: {
            headline: 'Transportes remotos com attention.',
            operatorSummary: 'Node host waiting for recover.',
          },
        })),
      } as any,
      platformCapabilityService: {
        getCapabilities: jest.fn(() => []),
        getSummary: jest.fn(),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.controlPlane.suggestedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'node-host-repair',
          label: 'Trigger repair do node host',
          reason: 'Trigger repair do host alpha.',
        }),
      ]),
    );
    expect(snapshot.controlPlane.suggestedActions.filter((entry) => entry.id === 'node-host-repair')).toHaveLength(1);
    expect(snapshot.controlPlane.narrative.operatorSummary).toContain('repair');
    expect(snapshot.controlPlane.narrative.operatorSummary).toContain('Node Host Alpha');
    expect(snapshot.narrative.operatorSummary).toContain('repair');
  });

  it('builds a domain snapshot from injected gateway-adjacent services', () => {
    const service = new ZavorthGatewayService({
      channelRegistryService: {
        listChannels: jest.fn(() => [
          { id: 'telegram', readiness: 'ready' },
          { id: 'web', readiness: 'ready' },
        ]),
      } as any,
      sessionPlaneService: {
        buildStatusSummaryFast: jest.fn(() => ({
          summary: {
            sessions: 3,
            historyItems: 8,
            sendReady: true,
            spawnReady: true,
          },
          narrative: {
            headline: 'Sessions ready.',
            operatorSummary: '3 visible sessions.',
          },
        })),
      } as any,
      memoryPlaneService: {
        buildSnapshotFast: jest.fn(() => ({
          generatedAt: '2026-04-08T12:00:00.000Z',
          summary: {
            persistedMemories: 4,
            relevantMemories: 2,
            replayTasks: 1,
            workflowRuns: 1,
            artifacts: 5,
            workspaceSignals: 1,
            timelineEvents: 6,
            historicalEvents: 2,
            changedFacts: 1,
          },
          memory: { recent: [], relevant: [], categories: [], vectorRecall: true },
          timeline: { recent: [], conflicts: [], latestHistoricalAt: null },
          replay: null,
          artifacts: { recent: [], kinds: ['doc'], latestLabel: 'briefing.md', reusableCount: 5 },
          workspace: null,
          suggestedActions: [],
          narrative: {
            headline: 'Memory plane',
            operatorSummary: '5 artifacts and 4 memories.',
          },
        })),
      } as any,
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 2,
            paired: 1,
            pending: 1,
            online: 1,
            offline: 1,
            invokable: 1,
            queued: 2,
            capabilities: 4,
          },
          entries: [],
          selected: null,
          capabilityCatalog: [],
          suggestedActions: [],
          narrative: {
            headline: 'Nodes actives.',
            operatorSummary: '1 node pareado.',
          },
        })),
      } as any,
      remoteTransportService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 2,
            ready: 1,
            partial: 1,
            planned: 0,
            disabled: 0,
            live: 1,
            reachable: 1,
            attentionRequired: 1,
            pendingWork: 1,
          },
          entries: [],
          selected: null,
          suggestedActions: [],
          narrative: {
            headline: 'Transportes actives.',
            operatorSummary: '1 transporte ready.',
          },
        })),
      } as any,
      securityMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            totalModes: 3,
            coreReady: 2,
            extensionsReady: 1,
            gvisorActive: true,
            firecrackerReady: false,
            neverDowngrade: true,
          },
          posture: {
            level: 'strong',
            label: 'Strong',
          },
          narrative: {
            operatorSummary: 'Security forte.',
            trustBoundary: 'Boundary forte.',
          },
        })),
      } as any,
      platformRegistryService: {
        buildStatusSummarySnapshot: jest.fn(() => ({
          summary: {
            total: 6,
            plugins: 2,
            skills: 2,
            mcps: 1,
            collections: 1,
            recipes: 3,
          },
          catalogSync: {
            summary: 'ready',
          },
          narrative: {
            headline: 'Platform ready.',
            operatorSummary: '2 plugins actives.',
          },
        })),
      } as any,
      operationsHealthService: {
        readSnapshotFast: jest.fn(() => ({
          sidecars: {
            AIGateway: { enabled: true, ready: true },
            ZavorthTerminal: { enabled: true, ready: false },
          },
          errors: {
            recent: [{ message: 'last' }],
          },
          nodeMeshSmoke: {
            status: 'passed',
          },
          channels: {
            telegram: { enabled: true, ready: true },
            discordBridge: { enabled: true, configured: true },
            whatsapp: { enabled: true, started: true },
            slack: { enabled: false, ready: false },
          },
          storage: { freePercent: 42 },
          publish: { available: true, publishedAt: '2026-04-08T12:00:00.000Z' },
          remoteTransportDoctor: { summary: 'Remote ok.' },
          security: { needsAttention: false },
        })),
      } as any,
      providerControlPlaneService: {
        listProviders: jest.fn(() => [
          { id: 'openai', ready: true },
          { id: 'AIGateway', ready: true },
          { id: 'gemini', ready: false },
        ]),
        listProfiles: jest.fn(() => [
          { id: 'default', label: 'Default' },
          { id: 'coding', label: 'Coding' },
        ]),
        getCurrentConversationalProvider: jest.fn(() => 'AIGateway'),
        getCurrentConversationalModel: jest.fn(() => 'gpt-5.4'),
      } as any,
    });

    const snapshot = service.buildDomainSnapshot();

    expect(snapshot.summary).toEqual({
      total: 12,
      initialized: 12,
      pending: 0,
    });
    expect(snapshot.domains.gateway.metrics.channels).toBe(2);
    expect(snapshot.domains.execution.metrics.decisionPipelineReady).toBe(true);
    expect(snapshot.domains.sessions.metrics.sessions).toBe(3);
    expect(snapshot.domains.memory.metrics.artifacts).toBe(5);
    expect(snapshot.domains.platform.metrics.plugins).toBe(2);
    expect(snapshot.domains.channels.metrics.remoteReady).toBeGreaterThanOrEqual(0);
    expect(snapshot.domains.nodes.metrics.queued).toBe(2);
    expect(snapshot.domains.transports.metrics.ready).toBe(1);
    expect(snapshot.domains.security.metrics.gvisorActive).toBe(true);
    expect(snapshot.domains.ops.metrics.nodeMeshReady).toBe(true);
    expect(snapshot.domains.providers.metrics.currentProvider).toBe('AIGateway');
  });
});
