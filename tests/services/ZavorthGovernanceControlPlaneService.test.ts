import { ZavorthGovernanceControlPlaneService } from '../../src/services/ZavorthGovernanceControlPlaneService';

describe('ZavorthGovernanceControlPlaneService', () => {
  const createService = (overrides: Record<string, any> = {}) =>
    new ZavorthGovernanceControlPlaneService({
      now: () => new Date('2026-04-12T17:00:00.000Z'),
      workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      tenantGovernanceService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 1,
            shared: 0,
            personal: 1,
            pendingOnboarding: 0,
            restrictedShared: 0,
            publicServers: 0,
          },
          featuredRecipes: [],
          narrative: {
            nextAction: 'Manter tenants revisados.',
          },
        })),
      },
      trustPlaneService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            pendingApprovals: 0,
            highRiskCapabilities: 0,
            mcpProfile: 'safe',
            skillDefaultPolicy: 'deny',
            killSwitchActive: false,
            trustedPlugins: 1,
            installedPlugins: 1,
          },
          surfaces: {
            runtime: {
              trustBoundary: 'guarded-runtime',
            },
          },
        })),
      },
      channelMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            ready: 1,
            total: 1,
            groupPolicy: 1,
            sessionSendReady: 1,
          },
          entries: [
            {
              id: 'telegram',
              configured: true,
              readiness: 'ready',
              features: {
                groupPolicy: true,
              },
            },
          ],
        })),
      },
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            paired: 1,
            online: 1,
            staleQueued: 0,
          },
          entries: [
            {
              id: 'node-1',
              capabilityIds: ['system.run'],
              approvedCapabilityIds: ['system.run'],
            },
          ],
        })),
      },
      remoteTransportService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 1,
            ready: 1,
            pendingWork: 0,
          },
          entries: [
            {
              id: 'AIGateway',
              telemetry: {
                pendingWork: 0,
                lastError: null,
              },
            },
          ],
        })),
      },
      pluginRegistryService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            installed: 1,
            trusted: 1,
            catalogBacked: 1,
          },
        })),
      },
      platformRegistryService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 1,
            trusted: 1,
            reviewPending: 0,
          },
          catalogSync: {
            status: 'clean',
            sourceTrusted: true,
          },
        })),
      },
      teamCatalogService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 0,
            active: 0,
            resumable: 0,
          },
          narrative: {
            headline: 'Team catalog ready.',
          },
        })),
      },
      ...overrides,
    });

  it('builds a healthy governance snapshot across all Governance surfaces', () => {
    const service = createService();

    const snapshot = service.buildSnapshot({ limit: 12 });

    expect(snapshot.generatedAt).toBe('2026-04-12T17:00:00.000Z');
    expect(snapshot.summary.posture).toBe('healthy');
    expect(snapshot.summary.tenants).toBe(1);
    expect(snapshot.summary.mcpProfile).toBe('safe');
    expect(snapshot.decisions).toEqual([]);
    expect(snapshot.surfaces.map((entry) => entry.id)).toEqual([
      'tenants',
      'trust',
      'channels',
      'nodes',
      'plugins',
      'platform',
      'transports',
      'teams',
      'workspace',
    ]);
    expect(snapshot.actions.length).toBeGreaterThan(0);
    expect(service.renderReport()).toContain('Governance: Tenancy, governance e policy');
  });

  it('promotes critical governance decisions when trust and tenant boundaries are unsafe', () => {
    const service = createService({
      tenantGovernanceService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 2,
            shared: 1,
            personal: 1,
            pendingOnboarding: 1,
            restrictedShared: 1,
            publicServers: 1,
          },
          featuredRecipes: [{ id: 'recipe:tenant' }],
          narrative: {
            nextAction: 'Close onboarding.',
          },
        })),
      },
      trustPlaneService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            pendingApprovals: 2,
            highRiskCapabilities: 3,
            mcpProfile: 'dangerous',
            skillDefaultPolicy: 'allow',
            killSwitchActive: true,
            trustedPlugins: 1,
            installedPlugins: 3,
          },
          surfaces: {
            runtime: {
              trustBoundary: 'owner-host',
            },
          },
        })),
      },
      channelMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            ready: 1,
            total: 2,
            groupPolicy: 0,
            sessionSendReady: 1,
          },
          entries: [
            {
              id: 'discord',
              configured: true,
              readiness: 'ready',
              features: {
                groupPolicy: false,
              },
            },
          ],
        })),
      },
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            paired: 1,
            online: 1,
            staleQueued: 1,
          },
          entries: [
            {
              id: 'node-restricted',
              capabilityIds: ['system.run', 'browser.proxy'],
              approvedCapabilityIds: ['browser.proxy'],
            },
          ],
        })),
      },
      remoteTransportService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 1,
            ready: 0,
            pendingWork: 4,
          },
          entries: [
            {
              id: 'AIGateway',
              telemetry: {
                pendingWork: 4,
                lastError: 'bridge offline',
              },
            },
          ],
        })),
      },
      pluginRegistryService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            installed: 3,
            trusted: 1,
            catalogBacked: 1,
          },
        })),
      },
      platformRegistryService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 2,
            trusted: 1,
            reviewPending: 1,
          },
          catalogSync: {
            status: 'review',
            sourceTrusted: true,
          },
        })),
      },
      teamCatalogService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 1,
            active: 1,
            resumable: 1,
          },
          narrative: {
            headline: 'Team active.',
          },
        })),
      },
    });

    const snapshot = service.buildSnapshot();
    const decisionIds = snapshot.decisions.map((entry) => entry.id);

    expect(snapshot.summary.posture).toBe('critical');
    expect(decisionIds).toContain('tenant-restricted-shared');
    expect(decisionIds).toContain('tenant-onboarding');
    expect(decisionIds).toContain('kill-switch-active');
    expect(decisionIds).toContain('skills-default-allow');
    expect(decisionIds).toContain('remote-transport-attention');
    expect(snapshot.actions.length).toBeGreaterThan(0);
  });
});
