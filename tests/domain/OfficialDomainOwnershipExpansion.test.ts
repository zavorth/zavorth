import { GatewayFacade } from '../../src/domain/gateway';
import { MemoryFacade } from '../../src/domain/memory';
import { ObservabilityFacade } from '../../src/domain/observability';
import { PlatformEcosystemFacade } from '../../src/domain/platform-ecosystem';
import { SurfaceFacade } from '../../src/domain/surface';
import { TransportsFacade } from '../../src/domain/transports';
import { TrustGovernanceFacade } from '../../src/domain/trust-governance';

describe('official domain ownership expansion facades', () => {
  it('builds the surface snapshot through the layered boundary adapter', () => {
    const snapshot = new SurfaceFacade({
      now: () => new Date('2026-04-17T18:00:00.000Z'),
      supportedCommands: ['chat', 'control', 'sessions'],
      boundaryPortsReady: true,
    }).buildSnapshot();

    expect(snapshot.metrics.supportedCommands).toBe(3);
    expect(snapshot.metrics.boundaryPortsReady).toBe(true);
    expect(snapshot.summary).toContain('Surface domain ready');
  });

  it('builds the gateway snapshot through the runtime adapter', () => {
    const snapshot = new GatewayFacade({
      now: () => new Date('2026-04-17T18:00:00.000Z'),
      gatewayRuntime: {
        buildCoreSnapshot: () => ({
          lifecycle: { state: 'healthy' },
          channels: { total: 2 },
          sessions: { total: 3 },
        }),
      },
      gatewayService: {
        buildSnapshot: () => ({
          summary: {
            channelsTotal: 4,
            sessionTargets: 5,
            memoryArtifacts: 6,
            remoteTransportsReady: 7,
          },
          narrative: {
            operatorSummary: 'Gateway ready via domain.',
          },
        }),
      },
    }).buildSnapshot();

    expect(snapshot.metrics.channels).toBe(4);
    expect(snapshot.metrics.sessions).toBe(5);
    expect(snapshot.metrics.memoryArtifacts).toBe(6);
    expect(snapshot.metrics.remoteTransportsReady).toBe(7);
    expect(snapshot.summary).toBe('Gateway ready via domain.');
  });

  it('builds the memory snapshot through the memory plane adapter', () => {
    const snapshot = new MemoryFacade({
      now: () => new Date('2026-04-17T18:00:00.000Z'),
      memoryPlaneService: {
        buildSnapshotFast: () => ({
          generatedAt: '2026-04-17T18:00:00.000Z',
          summary: {
            persistedMemories: 11,
            relevantMemories: 7,
            artifacts: 4,
            workflowRuns: 2,
            timelineEvents: 9,
          },
          narrative: {
            headline: 'Consolidated memory.',
            operatorSummary: 'Memory ready through domain.',
          },
        }),
      },
    }).buildSnapshot();

    expect(snapshot.metrics.persistedMemories).toBe(11);
    expect(snapshot.metrics.relevantMemories).toBe(7);
    expect(snapshot.metrics.timelineEvents).toBe(9);
    expect(snapshot.summary).toBe('Memory ready through domain.');
  });

  it('builds the transports snapshot through the remote transport adapter', () => {
    const snapshot = new TransportsFacade({
      now: () => new Date('2026-04-17T18:00:00.000Z'),
      remoteTransportService: {
        buildSnapshot: () => ({
          generatedAt: '2026-04-17T18:00:00.000Z',
          summary: {
            total: 5,
            ready: 3,
            partial: 1,
            attentionRequired: 1,
            pendingWork: 2,
          },
          narrative: {
            headline: 'Transportes observados.',
            operatorSummary: 'Transports ready through domain.',
          },
          selected: {
            operatorSummary: 'Discord bridge operante.',
          },
        }),
      },
    }).buildSnapshot();

    expect(snapshot.metrics.total).toBe(5);
    expect(snapshot.metrics.ready).toBe(3);
    expect(snapshot.metrics.pendingWork).toBe(2);
    expect(snapshot.summary).toBe('Transports ready through domain.');
  });

  it('builds the trust-governance snapshot through the trust and governance planes', () => {
    const snapshot = new TrustGovernanceFacade({
      now: () => new Date('2026-04-17T18:00:00.000Z'),
      trustPlaneService: {
        buildSnapshot: () => ({
          generatedAt: '2026-04-17T18:00:00.000Z',
          summary: {
            posture: 'healthy',
            skillAllowedSources: 4,
          },
          narrative: {
            headline: 'Trust plane operando.',
            operatorSummary: 'Trust visible.',
          },
        }),
      },
      governanceControlPlaneService: {
        buildSnapshot: () => ({
          generatedAt: '2026-04-17T18:00:00.000Z',
          summary: {
            posture: 'attention',
            decisions: 6,
          },
          narrative: {
            headline: 'Governance control plane operando.',
            operatorSummary: 'Governance visible.',
          },
        }),
      },
    }).buildSnapshot();

    expect(snapshot.metrics.trustReady).toBe(true);
    expect(snapshot.metrics.governanceReady).toBe(true);
    expect(snapshot.metrics.policiesTracked).toBe(6);
    expect(snapshot.summary).toBe('Governance visible.');
  });

  it('builds the platform ecosystem snapshot through registry and ecosystem planes', () => {
    const snapshot = new PlatformEcosystemFacade({
      now: () => new Date('2026-04-17T18:00:00.000Z'),
      platformRegistryService: {
        buildSnapshot: () => ({
          generatedAt: '2026-04-17T18:00:00.000Z',
          summary: {
            total: 12,
            ready: 8,
            collections: 3,
            recipes: 2,
            reviewPending: 1,
          },
          narrative: {
            headline: 'Registry publicdo.',
            operatorSummary: 'Registry ready.',
          },
        }),
      },
      ecosystemControlPlaneService: {
        buildSnapshot: () => ({
          generatedAt: '2026-04-17T18:00:00.000Z',
          summary: {
            registryEntries: 12,
            readyEntries: 8,
            sdkFilesReady: 5,
            sdkFilesExpected: 6,
            publishArtifacts: 2,
            recipeCoverageMissing: 1,
          },
          narrative: {
            headline: 'Ecossistema publicdo.',
            operatorSummary: 'Ecosystem ready.',
          },
        }),
      },
    }).buildSnapshot();

    expect(snapshot.metrics.registryReady).toBe(true);
    expect(snapshot.metrics.sdkSurfaces).toBe(5);
    expect(snapshot.metrics.vendorBundles).toBe(5);
    expect(snapshot.summary).toBe('Ecosystem ready.');
  });

  it('builds the observability snapshot through scorecard and health services', () => {
    const snapshot = new ObservabilityFacade({
      now: () => new Date('2026-04-17T18:00:00.000Z'),
      operationsHealthService: {
        readSnapshot: () => ({
          generatedAt: '2026-04-17T18:00:00.000Z',
          narrative: {
            headline: 'Operations health verde.',
            operatorSummary: 'Health visible.',
          },
        }),
      },
      architectureScorecardService: {
        buildSnapshot: () => ({
          generatedAt: '2026-04-17T18:00:00.000Z',
          summary: {
            controlPlaneFamiliesReady: 5,
            controlPlaneFamiliesTotal: 5,
          },
          narrative: {
            operatorSummary: 'Scorecard visible.',
          },
        }),
      },
      integrationHealthService: {
        listDoctorSnapshots: () => ([{ id: 'discord' }]),
      },
    }).buildSnapshot();

    expect(snapshot.metrics.controlPlanes).toBe(5);
    expect(snapshot.metrics.scorecards).toBe(2);
    expect(snapshot.metrics.healthSignalsReady).toBe(true);
    expect(snapshot.summary).toBe('Scorecard visible.');
  });
});
