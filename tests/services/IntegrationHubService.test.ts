import { IntegrationHubService } from '../../src/services/IntegrationHubService.js';

describe('IntegrationHubService', () => {
  it('includes vendor plane metadata in the catalog snapshot and selected detail', () => {
    const manifest = {
      id: 'AIGateway',
      label: 'AIGateway',
      aliases: ['ai-gateway-local'],
      summary: 'Gateway local-first.',
      description: 'Vendor local.',
      supportLevel: 'native',
      category: 'local',
      tags: ['provider'],
      modes: [],
      defaultMode: 'cli',
      capabilities: ['chat'],
      binding: {
        kind: 'provider',
        key: 'AIGateway',
        status: 'ready',
        summary: 'ok',
      },
      requirements: [],
      onboardingQuestions: [],
      installSteps: [],
      safetyNotes: [],
      goodFor: [],
    } as any;
    const service = new IntegrationHubService({
      now: () => new Date('2026-04-07T19:00:00.000Z'),
      routerService: {
        listCatalogEntries: jest.fn(() => [
          {
            manifest,
            installed: null,
            doctor: {
              generatedAt: '2026-04-07T19:00:00.000Z',
              integrationId: 'AIGateway',
              label: 'AIGateway',
              nickname: null,
              status: 'warn',
              binding: manifest.binding,
              configured: false,
              selectedMode: null,
              enabledCapabilities: ['chat'],
              findings: [],
              nextAction: {
                label: 'Subir sidecar',
                command: 'usar fluxo assistido do Integration Hub',
                reason: 'Falta sidecar.',
              },
            },
            readiness: 'planned',
            vendor: {
              index: {
                vendorId: 'AIGateway',
                displayName: 'AIGateway',
              },
              license: {
                vendorId: 'AIGateway',
                allowCoreCopy: true,
                summary: 'Sync normal.',
              },
            },
          },
        ]),
      } as any,
      registryService: {
        getManifestById: jest.fn(() => manifest),
        getSuggestedTemplates: jest.fn(() => []),
        resolveRequestedIntegration: jest.fn(() => ({
          manifest,
        })),
      } as any,
      installerService: {
        getInstalled: jest.fn(() => null),
        getStoredSecretKeys: jest.fn(() => []),
      } as any,
      healthService: {
        buildDoctorSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-07T19:00:00.000Z',
          integrationId: 'AIGateway',
          label: 'AIGateway',
          nickname: null,
          status: 'warn',
          binding: manifest.binding,
          configured: false,
          selectedMode: null,
          enabledCapabilities: ['chat'],
          findings: [],
          nextAction: {
            label: 'Subir sidecar',
            command: 'usar fluxo assistido do Integration Hub',
            reason: 'Falta sidecar.',
          },
        })),
      } as any,
      actionService: {
        buildActionPlan: jest.fn(() => ({
          generatedAt: '2026-04-07T19:00:00.000Z',
          integrationId: 'AIGateway',
          primaryActionId: null,
          actions: [],
        })),
        buildActionMonitor: jest.fn(() => ({
          generatedAt: '2026-04-07T19:00:00.000Z',
          integrationId: 'AIGateway',
          latestAction: null,
          recentActions: [],
          logExcerpt: {
            logFile: null,
            lines: [],
          },
        })),
      } as any,
      providerControlPlaneService: {
        getCurrentModelForProvider: jest.fn(() => null),
        getUsageTargets: jest.fn(() => []),
      } as any,
      providerDoctorService: {
        inspect: jest.fn(() => ({
          activeProviderName: 'gemini',
          activeModelName: 'gemini-2.5-flash',
          preferredZavorthBridgeModel: null,
          recommendedProfile: {
            profile: {
              id: 'coding',
              label: 'Coding',
            },
            strategy: {
              providerName: 'gemini',
              modelName: 'gemini-2.5-flash',
              fallbackOrder: ['gemini'],
            },
          },
          readyProviders: [],
          pendingConfigProviders: [],
          probeProviders: [],
          profiles: [],
          recommendations: [],
          providers: [],
        })),
      } as any,
      mcpCapabilityControlPlaneService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-07T19:00:00.000Z',
          manifestPath: 'config/mcp-servers.json',
          summary: {
            total: 0,
            enabled: 0,
            connected: 0,
            failed: 0,
            disabled: 0,
            stopped: 0,
            toolCount: 0,
            capabilityCount: 0,
          },
          capabilities: [],
          entries: [],
          recommendations: [],
          narrative: {
            headline: 'MCP',
            operatorSummary: 'none',
          },
        })),
      } as any,
      vendorReleaseIndexService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-07T19:00:00.000Z',
          summary: {
            total: 1,
            updateAvailable: 1,
            live: 0,
            ready: 0,
            reviewRequired: 0,
            blockedForCoreCopy: 0,
          },
          entries: [
            {
              vendorId: 'AIGateway',
              displayName: 'AIGateway',
            },
          ],
        })),
        getEntry: jest.fn(() => ({
          vendorId: 'AIGateway',
          displayName: 'AIGateway',
        })),
      } as any,
      vendorLicenseGuardService: {
        getDecision: jest.fn(() => ({
          vendorId: 'AIGateway',
          allowCoreCopy: true,
          summary: 'Sync normal.',
        })),
      } as any,
    });

    const snapshot = service.buildCatalogSnapshot('AIGateway');

    expect(snapshot.vendors).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          total: 1,
          updateAvailable: 1,
        }),
      }),
    );
    expect(snapshot.selected?.vendor).toEqual(
      expect.objectContaining({
        index: expect.objectContaining({
          vendorId: 'AIGateway',
        }),
        license: expect.objectContaining({
          allowCoreCopy: true,
        }),
      }),
    );
  });

  it('renders the catalog report even when the MCP snapshot comes back without summary', () => {
    const service = new IntegrationHubService({
      routerService: {
        listCatalogEntries: jest.fn(() => []),
      } as any,
      registryService: {
        getSuggestedTemplates: jest.fn(() => []),
      } as any,
      providerControlPlaneService: {
        getCurrentModelForProvider: jest.fn(() => null),
        getUsageTargets: jest.fn(() => []),
      } as any,
      providerDoctorService: {
        inspect: jest.fn(() => ({
          activeProviderName: 'gemini',
          activeModelName: 'gemini-2.5-flash',
          preferredZavorthBridgeModel: null,
          recommendedProfile: {
            profile: {
              id: 'coding',
              label: 'Coding',
            },
            strategy: {
              providerName: 'gemini',
              modelName: 'gemini-2.5-flash',
              fallbackOrder: ['gemini'],
            },
          },
          readyProviders: [],
          pendingConfigProviders: [],
          probeProviders: [],
          profiles: [],
          recommendations: [],
          providers: [],
        })),
      } as any,
      mcpCapabilityControlPlaneService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-07T19:10:00.000Z',
          manifestPath: 'config/mcp-servers.json',
          capabilities: [],
          entries: [],
          recommendations: [],
          narrative: {
            headline: 'MCP',
            operatorSummary: 'none',
          },
        })),
      } as any,
      vendorReleaseIndexService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-07T19:10:00.000Z',
          summary: {
            total: 0,
            updateAvailable: 0,
            live: 0,
            ready: 0,
            reviewRequired: 0,
            blockedForCoreCopy: 0,
          },
          entries: [],
        })),
      } as any,
    });

    const report = service.renderCatalogReport();

    expect(report).toContain('MCP conectado: 0/0 | tools: 0');
  });
});
