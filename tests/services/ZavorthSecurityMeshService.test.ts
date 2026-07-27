import { ZavorthSecurityMeshService } from '../../src/services/ZavorthSecurityMeshService.js';

describe('ZavorthSecurityMeshService', () => {
  it('builds an operator-facing security mesh snapshot with posture and suggested actions', () => {
    const service = new ZavorthSecurityMeshService({
      now: () => new Date('2026-04-02T18:30:00.000Z'),
      operationsHealthService: {
        readSnapshot: jest.fn(() => ({
          docker: {
            canRun: true,
            hardeningActive: true,
            gvisorActive: true,
            detail: 'Docker forte ready.',
            recommendedAction: 'npm run sandbox:doctor:smoke',
          },
          firecracker: {
            enabled: true,
            canRun: true,
            kernelPresent: true,
            rootfsPresent: true,
            detail: 'MicroVM ready.',
            recommendedAction: 'npm run sandbox:firecracker:smoke',
          },
          nodeMeshSmoke: {
            available: true,
            status: 'failed',
            checkedAt: '2026-04-02T18:28:00.000Z',
            summary: 'Smoke real do Node Mesh falhou.',
            command: 'npm run test:nodes:smoke',
            file: 'C:/runtime/node-mesh-smoke-last.json',
            nodeId: 'node-mesh-err',
            finalNodeStatus: 'offline',
            recentCapabilityId: 'system.run',
            error: 'system.run not retornou o marcador esperado no smoke real.',
            recommendedAction: 'npm run test:nodes:smoke',
          },
          wasm: {
            enabled: true,
            available: true,
            canRun: true,
            detail: 'Tier Wasm ready.',
            runtime: 'node-webassembly',
            supportedLanguages: ['wasm'],
            recommendedAction: 'npm run sandbox:wasm:smoke',
          },
          security: {
            lastAudit: {
              available: true,
              trailAvailable: true,
              ok: true,
              totalEvents: 3,
              latestEventType: 'PERMISSION_DECISION',
              latestTaskId: 'task-audit-1',
              latestTimestamp: '2026-04-02T18:29:00.000Z',
              latestChainHash: 'abcdef1234567890',
              recentChain: [
                {
                  eventId: 'audit-0000003',
                  eventType: 'PERMISSION_DECISION',
                  taskId: 'task-audit-1',
                  timestamp: '2026-04-02T18:29:00.000Z',
                  chainHash: 'abcdef1234567890',
                  previousChainHash: '1234567890abcdef',
                },
              ],
            },
          },
        })),
      } as any,
      runtimeModesService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 5,
            coreReady: 3,
            extensionReady: 1,
          },
          entries: [
            { id: 'local-jail', tier: 'core', family: 'local', available: true },
            { id: 'container-hardened', tier: 'core', family: 'container', available: true },
            { id: 'microvm-firecracker', tier: 'core', family: 'microvm', available: true },
            { id: 'remote-sidecar', tier: 'extension', family: 'remote-sidecar', available: true },
            { id: 'node-host', tier: 'extension', family: 'node-host', available: false },
          ],
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.generatedAt).toBe('2026-04-02T18:30:00.000Z');
    expect(snapshot.posture).toEqual(
      expect.objectContaining({
        level: 'zero-trust-ready',
      }),
    );
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        coreReady: 3,
        extensionsReady: 1,
        wasmReady: true,
        gvisorActive: true,
        firecrackerReady: true,
        neverDowngrade: true,
      }),
    );
    expect(snapshot.policies).toEqual(
      expect.objectContaining({
        lowRiskToLocalJail: true,
        mediumRiskToContainer: true,
        highRiskToMicrovm: true,
        wasmReady: true,
        remoteSidecarAvailable: true,
        nodeHostAvailable: false,
      }),
    );
    expect(snapshot.auditTrail).toEqual(
      expect.objectContaining({
        totalEvents: 3,
        latestEventType: 'PERMISSION_DECISION',
        latestTaskId: 'task-audit-1',
        latestChainHash: 'abcdef1234567890',
      }),
    );
    expect(snapshot.suggestedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'node-host-pair',
          command: '/nodepair headless',
        }),
        expect.objectContaining({
          id: 'validate-wasm-smoke',
          command: 'npm run sandbox:wasm:smoke',
        }),
        expect.objectContaining({
          id: 'node-mesh-validate',
          command: 'npm run test:nodes:smoke',
        }),
      ]),
    );
    expect(snapshot.narrative.operatorSummary).toContain('A malthere is de nodes falhou no ultimo smoke real');
    expect(snapshot.narrative.trustBoundary).toContain('microVM');
    expect(snapshot.narrative.trustBoundary).toContain('falhou');
  });

  it('treats stale Node Mesh validation as renewed caution in the security narrative', () => {
    const service = new ZavorthSecurityMeshService({
      now: () => new Date('2026-04-02T18:30:00.000Z'),
      operationsHealthService: {
        readSnapshot: jest.fn(() => ({
          docker: {
            canRun: true,
            hardeningActive: true,
            gvisorActive: true,
            detail: 'Docker forte ready.',
            recommendedAction: 'npm run sandbox:doctor:smoke',
          },
          firecracker: {
            enabled: true,
            canRun: true,
            kernelPresent: true,
            rootfsPresent: true,
            detail: 'MicroVM ready.',
            recommendedAction: 'npm run sandbox:firecracker:smoke',
          },
          nodeMeshSmoke: {
            available: true,
            status: 'passed',
            checkedAt: '2026-03-30T10:00:00.000Z',
            summary: 'Smoke real antigo.',
            command: 'npm run test:nodes:smoke',
            file: 'C:/runtime/node-mesh-smoke-last.json',
            nodeId: 'node-mesh-stale',
            finalNodeStatus: 'online',
            recentCapabilityId: 'files.write',
            error: null,
            stale: true,
            recommendedAction: 'npm run test:nodes:smoke',
          },
          wasm: {
            enabled: true,
            available: true,
            canRun: true,
            detail: 'Tier Wasm ready.',
            runtime: 'node-webassembly',
            supportedLanguages: ['wasm'],
            recommendedAction: 'npm run sandbox:wasm:smoke',
          },
          security: {
            lastAudit: {
              available: true,
              trailAvailable: true,
              ok: true,
              totalEvents: 1,
              latestEventType: 'PERMISSION_DECISION',
              latestTaskId: 'task-audit-2',
              latestTimestamp: '2026-04-02T18:29:00.000Z',
              latestChainHash: 'abcdef1234567890',
              recentChain: [],
            },
          },
        })),
      } as any,
      runtimeModesService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 5,
            coreReady: 3,
            extensionReady: 2,
          },
          entries: [
            { id: 'local-jail', tier: 'core', family: 'local', available: true },
            { id: 'container-hardened', tier: 'core', family: 'container', available: true },
            { id: 'microvm-firecracker', tier: 'core', family: 'microvm', available: true },
            { id: 'remote-sidecar', tier: 'extension', family: 'remote-sidecar', available: true },
            { id: 'node-host', tier: 'extension', family: 'node-host', available: true },
          ],
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.suggestedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'node-mesh-validate',
          command: 'npm run test:nodes:smoke',
        }),
      ]),
    );
    expect(snapshot.narrative.operatorSummary).toContain('report expired');
    expect(snapshot.narrative.trustBoundary).toContain('evidence operacional venceu');
  });
});
