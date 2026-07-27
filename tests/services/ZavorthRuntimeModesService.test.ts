import { ZavorthRuntimeModesService } from '../../src/services/ZavorthRuntimeModesService.js';

describe('ZavorthRuntimeModesService', () => {
  it('builds an operator-facing runtime mode catalog from health and integration state', () => {
    const service = new ZavorthRuntimeModesService({
      now: () => new Date('2026-04-02T18:00:00.000Z'),
      operationsHealthService: {
        readSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-02T17:59:00.000Z',
          sidecars: {},
          channels: {
            discordBridge: {
              mode: 'native',
              enabled: true,
              started: true,
              allowDirectMessages: false,
              allowedGuildIds: [],
              pendingInbox: 0,
              pendingOutbox: 0,
              lastError: null,
              updatedAt: '2026-04-02T17:59:00.000Z',
            },
          },
          docker: {
            enabled: true,
            required: false,
            available: true,
            canRun: true,
            detail: 'Docker endurecido com gVisor active.',
            sandboxRuntime: 'runsc',
            gvisorActive: true,
            hardeningActive: true,
            recommendedAction: 'npm run sandbox:doctor:smoke',
            languages: {
              javascript: { canRun: true, detail: 'ok', image: 'node:22-bullseye' },
              python: { canRun: true, detail: 'ok', image: 'python:3.12-slim' },
              shell: { canRun: true, detail: 'ok', image: 'bash:5.2' },
            },
          },
          firecracker: {
            enabled: true,
            available: true,
            canRun: true,
            detail: 'Firecracker ready via bridge WSL.',
            transport: 'wsl',
            bridgeReady: true,
            kvmAvailable: true,
            kernelPresent: true,
            rootfsPresent: true,
            recommendedAction: 'npm run sandbox:firecracker:smoke',
          },
          wasm: {
            enabled: true,
            available: true,
            canRun: true,
            detail: 'Tier Wasm ready para modulos WebAssembly literais e controlados.',
            runtime: 'node-webassembly',
            supportedLanguages: ['wasm'],
            recommendedAction: null,
          },
          publish: {} as any,
          maintenance: {} as any,
          maintenanceAutomation: {} as any,
          storage: {} as any,
          security: {} as any,
          errors: {
            lastError: null,
            recent: [],
          },
        })),
      } as any,
      integrationHubService: {
        buildCatalogSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-02T17:59:00.000Z',
          featuredIds: ['AIGateway', 'external_executor'],
          templateIds: [],
          selected: null,
          entries: [
            {
              manifest: {
                id: 'AIGateway',
                label: 'AIGateway',
                summary: 'Sidecar de roteamento remoto.',
                description: 'Conecta o Zavorth a um sidecar de roteamento.',
              },
              installed: { id: 'AIGateway' },
              readiness: 'ready',
              doctor: {
                nextAction: {
                  command: '/connect AIGateway',
                  reason: 'Ja esta ready para uso.',
                },
              },
            },
            {
              manifest: {
                id: 'external_executor',
                label: 'ExternalExecutor',
                summary: 'Remote code executor.',
                description: 'Expande o Zavorth com um executor remoto dedicado.',
              },
              installed: null,
              readiness: 'needs_configuration',
              doctor: {
                nextAction: {
                  command: '/connect external_executor',
                  reason: 'Falta close o binding.',
                },
              },
            },
          ],
        })),
      } as any,
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-02T17:59:00.000Z',
          summary: {
            total: 1,
            paired: 1,
            pending: 0,
            online: 0,
            offline: 1,
            invokable: 0,
            capabilities: 2,
          },
          entries: [
            {
              id: 'oracle-node',
              nextAction: 'Conectar transporte remoto.',
            },
          ],
          selected: {
            id: 'oracle-node',
            nextAction: 'Conectar transporte remoto.',
          },
          capabilityCatalog: [],
          suggestedActions: [],
          narrative: {
            headline: '1 node registrado.',
            operatorSummary: '1 node pareado.',
          },
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot).toEqual(
      expect.objectContaining({
        generatedAt: '2026-04-02T18:00:00.000Z',
        summary: expect.objectContaining({
          total: 6,
          ready: 5,
          partial: 1,
          coreReady: 3,
          extensionReady: 2,
        }),
        entries: expect.arrayContaining([
          expect.objectContaining({
            id: 'container-hardened',
            readiness: 'ready',
            tier: 'core',
          }),
          expect.objectContaining({
            id: 'microvm-firecracker',
            readiness: 'ready',
            available: true,
            tier: 'core',
          }),
          expect.objectContaining({
            id: 'wasm-sandbox',
            readiness: 'ready',
            tier: 'extension',
          }),
          expect.objectContaining({
            id: 'node-host',
            readiness: 'partial',
            actionHint: '/nodeinvoke oracle-node system.run',
            tier: 'extension',
          }),
          expect.objectContaining({
            id: 'remote-sidecar',
            readiness: 'ready',
            actionHint: '/connect AIGateway',
            tier: 'extension',
          }),
        ]),
        narrative: expect.objectContaining({
          headline: expect.stringContaining('Runtime & Security Mesh'),
        }),
      }),
    );
  });
});
