import { ZavorthRuntimeStabilityControlPlaneService } from '../../src/services/ZavorthRuntimeStabilityControlPlaneService.js';

describe('ZavorthRuntimeStabilityControlPlaneService', () => {
  it('summarizes fleet, transports, keepalive and recoverability in one snapshot', () => {
    const service = new ZavorthRuntimeStabilityControlPlaneService({
      now: () => new Date('2026-04-12T21:00:00.000Z'),
      workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 2,
            online: 1,
            paired: 2,
            queued: 3,
            staleQueued: 1,
          },
          entries: [
            { id: 'node-1', label: 'Node 1' },
            { id: 'node-2', label: 'Node 2' },
          ],
        })),
      } as any,
      nodeMeshRecoveryService: {
        runDoctor: jest.fn(() => ({
          status: 'attention',
          summary: 'Fila remota ainda tem uma pendencia recuperavel.',
          issues: [
            { id: 'stale-queue', recoverable: true },
          ],
        })),
      } as any,
      remoteTransportService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 4,
            ready: 2,
            attentionRequired: 2,
          },
          entries: [],
          suggestedActions: [],
        })),
      } as any,
      remoteTransportDoctorService: {
        readLastReport: jest.fn(() => ({
          status: 'ok',
          summary: 'Doctor recente sem falhas criticas.',
        })),
      } as any,
      keepaliveStatusService: {
        readSnapshot: jest.fn(() => ({
          ok: true,
          updatedAt: '2026-04-12T20:59:00.000Z',
          intervalMs: 60000,
          nodeHostId: 'node-host-1',
          notes: [],
          stale: false,
          summary: {
            total: 3,
            ready: 3,
            unhealthy: 0,
            restarts: 1,
          },
          processes: [],
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.generatedAt).toBe('2026-04-12T21:00:00.000Z');
    expect(snapshot.summary.posture).toBe('attention');
    expect(snapshot.summary.onlineNodes).toBe(1);
    expect(snapshot.summary.readyTransports).toBe(2);
    expect(snapshot.summary.keepaliveReadyProcesses).toBe(3);
    expect(snapshot.gate.status).toBe('warning');
    expect(snapshot.gate.canProceedToRollout).toBe(true);
    expect(snapshot.gate.warnings).toContain('Fila stale deve ficar em zero para rollout limpo.');
    expect(snapshot.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'node-doctor' }),
      ]),
    );
    expect(service.renderReport()).toContain('Fleet e transports supervisionados');
    expect(service.renderReport()).toContain('Gate: warning');
  });

  it('allows lazy paired nodes when there is no remote queue', () => {
    const service = new ZavorthRuntimeStabilityControlPlaneService({
      now: () => new Date('2026-04-12T22:00:00.000Z'),
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 2,
            online: 0,
            paired: 2,
            queued: 0,
            staleQueued: 0,
          },
          entries: [],
        })),
      } as any,
      nodeMeshRecoveryService: {
        runDoctor: jest.fn(() => ({
          status: 'healthy',
          summary: 'Sem pendencias recuperaveis.',
          issues: [],
        })),
      } as any,
      remoteTransportService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 1,
            ready: 1,
            attentionRequired: 0,
          },
          entries: [],
          suggestedActions: [],
        })),
      } as any,
      remoteTransportDoctorService: {
        readLastReport: jest.fn(() => ({
          status: 'ok',
          summary: 'Transports ok.',
        })),
      } as any,
      keepaliveStatusService: {
        readSnapshot: jest.fn(() => ({
          ok: true,
          updatedAt: '2026-04-12T21:59:00.000Z',
          intervalMs: 60000,
          nodeHostId: 'node-host-1',
          notes: [],
          stale: false,
          summary: {
            total: 1,
            ready: 1,
            unhealthy: 0,
            restarts: 0,
          },
          processes: [],
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.gate.status).toBe('warning');
    expect(snapshot.gate.canProceedToRollout).toBe(true);
    expect(snapshot.gate.warnings).toContain('Node pareado offline deixa a malha em modo lazy; ligue um node host para status passed.');
  });

  it('fails the stability gate when paired nodes are offline with queued remote work', () => {
    const service = new ZavorthRuntimeStabilityControlPlaneService({
      now: () => new Date('2026-04-12T22:00:00.000Z'),
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 2,
            online: 0,
            paired: 2,
            queued: 1,
            staleQueued: 0,
          },
          entries: [],
        })),
      } as any,
      nodeMeshRecoveryService: {
        runDoctor: jest.fn(() => ({
          status: 'healthy',
          summary: 'Sem pendencias recuperaveis.',
          issues: [],
        })),
      } as any,
      remoteTransportService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 1,
            ready: 1,
            attentionRequired: 0,
          },
          entries: [],
          suggestedActions: [],
        })),
      } as any,
      remoteTransportDoctorService: {
        readLastReport: jest.fn(() => ({
          status: 'ok',
          summary: 'Transports ok.',
        })),
      } as any,
      keepaliveStatusService: {
        readSnapshot: jest.fn(() => ({
          ok: true,
          updatedAt: '2026-04-12T21:59:00.000Z',
          intervalMs: 60000,
          nodeHostId: 'node-host-1',
          notes: [],
          stale: false,
          summary: {
            total: 1,
            ready: 1,
            unhealthy: 0,
            restarts: 0,
          },
          processes: [],
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.gate.status).toBe('failed');
    expect(snapshot.gate.canProceedToRollout).toBe(false);
    expect(snapshot.gate.blockingReasons).toContain('Node pareado offline bloqueia rollout somente quando existe fila remota ativa.');
  });
});
