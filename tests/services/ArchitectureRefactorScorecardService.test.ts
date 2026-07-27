import { ArchitectureRefactorScorecardService } from '../../src/observability/ArchitectureRefactorScorecardService';
import path from 'path';

describe('ArchitectureRefactorScorecardService', () => {
  it('summarizes hotspots, domain coverage and boundary ports in one baseline snapshot', () => {
    const service = new ArchitectureRefactorScorecardService({
      now: () => new Date('2026-04-15T09:00:00.000Z'),
      workspaceRoot: process.cwd(),
      srcRoot: path.join(process.cwd(), 'src'),
      readSourceFiles: () => [
        {
          absolutePath: 'C:\\TESTES DEV\\zavorth-core\\Zavorth\\src\\services\\ZavorthOperationalOverviewService.ts',
          relativePath: 'services/ZavorthOperationalOverviewService.ts',
          bytes: 10,
          lines: 2400,
          topLevelDirectory: 'services',
        },
        {
          absolutePath: 'C:\\TESTES DEV\\zavorth-core\\Zavorth\\src\\services\\SharedSurfaceCommandService.ts',
          relativePath: 'services/SharedSurfaceCommandService.ts',
          bytes: 10,
          lines: 1800,
          topLevelDirectory: 'services',
        },
        {
          absolutePath: 'C:\\TESTES DEV\\zavorth-core\\Zavorth\\src\\domain\\gateway\\GatewayFacade.ts',
          relativePath: 'domain/gateway/GatewayFacade.ts',
          bytes: 10,
          lines: 90,
          topLevelDirectory: 'domain',
        },
        {
          absolutePath: 'C:\\TESTES DEV\\zavorth-core\\Zavorth\\src\\api\\internal\\InternalSurfaceApiService.ts',
          relativePath: 'api/internal/InternalSurfaceApiService.ts',
          bytes: 10,
          lines: 120,
          topLevelDirectory: 'api',
        },
      ],
      buildPresentationBoundarySnapshot: () => ({
        generatedAt: '2026-04-15T09:00:00.000Z',
        summary: {
          posture: 'healthy',
          surfacesReady: 5,
          surfacesTotal: 5,
          auditedFiles: 12,
          violations: 0,
          allowedChannels: ['snapshot', 'action', 'event', 'stream', 'asset'],
        },
        surfaces: [],
        violations: [],
        narrative: {
          headline: 'Presentation Boundary Policy',
          operatorSummary: '5/5 surfaces visuais auditadas.',
          nextAction: 'Preservar o boundary.',
        },
      }),
      buildDependencyGraphSnapshot: () => ({
        generatedAt: '2026-04-15T09:00:00.000Z',
        summary: {
          posture: 'healthy',
          modulesTracked: 4,
          crossDomainEdges: 0,
          crossDomainViolations: 0,
          entrypointsTracked: 2,
          domainsTracked: 11,
          domainsAdopted: 7,
        },
        crossDomainEdges: [],
        violations: [],
        moduleHotspots: [
          {
            id: 'services/runtime',
            fileCount: 2,
            fanOut: 3,
            fanIn: 1,
            outgoingEdges: 4,
            incomingEdges: 1,
          },
        ],
        entrypointHotspots: [
          {
            path: 'services/SharedSurfaceCommandService.ts',
            kind: 'service',
            moduleId: 'services/SharedSurfaceCommandService.ts',
            fanIn: 2,
            fanOut: 5,
            score: 7,
          },
        ],
        domainMigration: [],
        narrative: {
          headline: 'Dependency graph arquitetural',
          operatorSummary: '4 monitored module(s), 0 edge(s) between domains e 0 cross-dependency item(s) not approved(s).',
          nextAction: 'Preserve domain boundaries and use fan-in/fan-out hotspots for new cuts.',
        },
      }),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.generatedAt).toBe('2026-04-15T09:00:00.000Z');
    expect(snapshot.summary.hotspotCount).toBe(2);
    expect(snapshot.summary.servicesFiles).toBe(2);
    expect(snapshot.summary.officialDomainOwnershipReady).toBe(0);
    expect(snapshot.summary.domainsAdopted).toBe(7);
    expect(snapshot.summary.domainDependencyViolations).toBe(0);
    expect(snapshot.rules.find((entry) => entry.id === 'line-limit')?.status).toBe('failed');
    expect(snapshot.rules.find((entry) => entry.id === 'official-domain-ownership')?.status).toBe('failed');
    expect(snapshot.rules.find((entry) => entry.id === 'architecture-onboarding-docs')?.status).toBe('passed');
    expect(snapshot.rules.find((entry) => entry.id === 'compatibility-facades')?.status).toBe('passed');
    expect(snapshot.rules.find((entry) => entry.id === 'domain-cross-dependencies')?.status).toBe('passed');
    expect(snapshot.rules.find((entry) => entry.id === 'presentation-boundary')?.status).toBe('passed');
    expect(snapshot.summary.presentationSurfacesReady).toBe(5);
    expect(snapshot.gate.status).toBe('warning');
    expect(snapshot.criticalFlows).toHaveLength(6);
    expect(service.renderReport()).toContain('Arquitetura e baseline de refatoraction');
    expect(service.renderReport()).toContain('Ownership oficial');
    expect(service.renderReport()).toContain('Top Modulos Por Dependencia');
    expect(service.renderReport()).toContain('Hotspots:');
  });

  it('freezes legacy hotspots under baseline and only fails new or regressed hotspots', () => {
    const service = new ArchitectureRefactorScorecardService({
      now: () => new Date('2026-04-15T09:00:00.000Z'),
      workspaceRoot: process.cwd(),
      srcRoot: path.join(process.cwd(), 'src'),
      readSourceFiles: () => [
        {
          absolutePath: path.join(process.cwd(), 'src/cli/ZavorthCliLiveNamespaces.ts'),
          relativePath: 'cli/ZavorthCliLiveNamespaces.ts',
          bytes: 10,
          lines: 4240,
          topLevelDirectory: 'cli',
        },
        {
          absolutePath: path.join(process.cwd(), 'src/cli/NewLargeEntrypoint.ts'),
          relativePath: 'cli/NewLargeEntrypoint.ts',
          bytes: 10,
          lines: 1501,
          topLevelDirectory: 'cli',
        },
      ],
      buildPresentationBoundarySnapshot: () => ({
        generatedAt: '2026-04-15T09:00:00.000Z',
        summary: {
          posture: 'healthy',
          surfacesReady: 5,
          surfacesTotal: 5,
          auditedFiles: 12,
          violations: 0,
          allowedChannels: ['snapshot', 'action', 'event', 'stream', 'asset'],
        },
        surfaces: [],
        violations: [],
        narrative: {
          headline: 'Presentation Boundary Policy',
          operatorSummary: '5/5 surfaces visuais auditadas.',
          nextAction: 'Preservar o boundary.',
        },
      }),
      buildDependencyGraphSnapshot: () => ({
        generatedAt: '2026-04-15T09:00:00.000Z',
        summary: {
          posture: 'healthy',
          modulesTracked: 2,
          crossDomainEdges: 0,
          crossDomainViolations: 0,
          entrypointsTracked: 1,
          domainsTracked: 11,
          domainsAdopted: 11,
        },
        crossDomainEdges: [],
        violations: [],
        moduleHotspots: [],
        entrypointHotspots: [],
        domainMigration: [],
        narrative: {
          headline: 'Dependency graph arquitetural',
          operatorSummary: '0 cross-dependency not approved.',
          nextAction: 'Preservar o boundary entre domains.',
        },
      }),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.legacyHotspotCount).toBe(1);
    expect(snapshot.summary.hotspotCount).toBe(1);
    expect(snapshot.hotspots[0]?.path).toBe('cli/NewLargeEntrypoint.ts');
    expect(snapshot.rules.find((entry) => entry.id === 'line-limit')?.status).toBe('failed');
  });

  it('fails the architecture gate when there is an unauthorized cross-domain dependency', () => {
    const service = new ArchitectureRefactorScorecardService({
      now: () => new Date('2026-04-15T09:00:00.000Z'),
      workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      srcRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth\\src',
      readSourceFiles: () => [
        {
          absolutePath: 'C:\\TESTES DEV\\zavorth-core\\Zavorth\\src\\domain\\execution\\application\\ExecutionUseCases.ts',
          relativePath: 'domain/execution/application/ExecutionUseCases.ts',
          bytes: 10,
          lines: 80,
          topLevelDirectory: 'domain',
        },
      ],
      buildPresentationBoundarySnapshot: () => ({
        generatedAt: '2026-04-15T09:00:00.000Z',
        summary: {
          posture: 'healthy',
          surfacesReady: 5,
          surfacesTotal: 5,
          auditedFiles: 12,
          violations: 0,
          allowedChannels: ['snapshot', 'action', 'event', 'stream', 'asset'],
        },
        surfaces: [],
        violations: [],
        narrative: {
          headline: 'Presentation Boundary Policy',
          operatorSummary: '5/5 surfaces visuais auditadas.',
          nextAction: 'Preservar o boundary.',
        },
      }),
      buildDependencyGraphSnapshot: () => ({
        generatedAt: '2026-04-15T09:00:00.000Z',
        summary: {
          posture: 'critical',
          modulesTracked: 2,
          crossDomainEdges: 1,
          crossDomainViolations: 1,
          entrypointsTracked: 1,
          domainsTracked: 11,
          domainsAdopted: 1,
        },
        crossDomainEdges: [
          {
            fromDomain: 'execution',
            toDomain: 'sessions',
            imports: 1,
            allowed: false,
            importers: ['domain/execution/application/ExecutionUseCases.ts'],
          },
        ],
        violations: [
          {
            importerPath: 'domain/execution/application/ExecutionUseCases.ts',
            importerDomain: 'execution',
            targetPath: 'domain/sessions/SessionsFacade.ts',
            targetDomain: 'sessions',
            specifier: '../../sessions/SessionsFacade.js',
            allowed: false,
          },
        ],
        moduleHotspots: [],
        entrypointHotspots: [],
        domainMigration: [],
        narrative: {
          headline: 'Dependency graph arquitetural',
          operatorSummary: '1 cross-dependency not approved.',
          nextAction: 'Remover importaction cruzada execution -> sessions.',
        },
      }),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.rules.find((entry) => entry.id === 'domain-cross-dependencies')?.status).toBe('failed');
    expect(snapshot.gate.status).toBe('failed');
    expect(snapshot.gate.blockingReasons.some((entry) => entry.includes('dependencia(s) cruzada(s)'))).toBe(true);
  });
});
