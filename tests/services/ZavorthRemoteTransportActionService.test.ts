import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthRemoteTransportActionService } from '../../src/services/ZavorthRemoteTransportActionService.js';

describe('ZavorthRemoteTransportActionService', () => {
  it('executes prepare/smoke flows against the selected remote transport and emits hook stages', async () => {
    const hookRun = jest.fn(async () => ({
      ok: true,
      event: 'transport.before_action',
      workspace: null,
      listenerCount: 0,
      workspaceHookCount: 0,
    }));
    const remoteTransportService = {
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => ({
        generatedAt: '2026-04-02T12:00:00.000Z',
        summary: {
          total: 4,
          ready: 2,
          partial: 1,
          planned: 1,
          disabled: 0,
          live: 2,
          reachable: 1,
        },
        entries: [],
        selected: {
          id: selectedId || 'AIGateway',
          label: 'AIGateway',
          kind: 'sidecar',
          transport: 'http-sidecar',
          direction: 'bidirectional',
          readiness: 'partial',
          available: false,
          endpoint: 'http://127.0.0.1:4100',
          operatorSummary: 'AIGateway existe localmente, mas ainda nao confirmou health pronto.',
          actionHint: '/connect AIGateway',
          telemetry: {
            updatedAt: '2026-04-02T11:59:00.000Z',
            pendingWork: 0,
            lastError: 'Health ainda nao confirmado.',
            statusLine: 'Sidecar ainda sem health pronto.',
          },
          details: ['Endpoint: http://127.0.0.1:4100.'],
          actions: [],
        },
        suggestedActions: [],
        narrative: {
          headline: 'Plano remoto.',
          operatorSummary: '1 transporte em preparo.',
        },
      })),
    };
    const service = new ZavorthRemoteTransportActionService({
      remoteTransportService: remoteTransportService as any,
      remoteTransportDoctorService: {
        run: jest.fn(async () => ({
          status: 'failed',
          summary: 'Doctor remoto encontrou pendencias.',
          items: [{ transportId: 'AIGateway', details: ['Health ainda nao confirmado.'] }],
        })),
        readLastReport: jest.fn(),
      } as any,
      AIGatewaySidecarService: {
        start: jest.fn(async () => ({
          ready: true,
          baseUrl: 'http://127.0.0.1:4100',
          advertisedBaseUrl: 'https://AIGateway.example',
          message: 'AIGateway iniciado pelo Zavorth.',
        })),
        stop: jest.fn(async () => undefined),
      } as any,
      GatewayCompatibilityDoctorService: {
        run: jest.fn(async () => ({
          ok: false,
          summary: 'Gateway proprio do AIGateway ainda nao passou na compatibilidade.',
        })),
        readLastReport: jest.fn(),
      } as any,
      hookPipelineService: { run: hookRun } as any,
    });

    const prepare = await service.execute({
      transportId: 'AIGateway',
      actionId: 'prepare',
      requestedBy: 'telegram-user',
    });
    const smoke = await service.execute({
      transportId: 'AIGateway',
      actionId: 'smoke',
      requestedBy: 'telegram-user',
    });
    const repair = await service.execute({
      transportId: 'AIGateway',
      actionId: 'repair',
      requestedBy: 'telegram-user',
    });

    expect(prepare.status).toBe('applied');
    expect(prepare.summary).toContain('foi preparado');
    expect(smoke.status).toBe('blocked');
    expect(smoke.ok).toBe(false);
    expect(repair.status).toBe('blocked');
    expect(repair.summary).toContain('executou repair');
    expect(hookRun).toHaveBeenCalledWith(expect.objectContaining({ event: 'transport.before_action' }));
    expect(hookRun).toHaveBeenCalledWith(expect.objectContaining({ event: 'transport.after_action' }));
  });

  it('persists action history and executes the real AIGateway flow through sidecar and doctor services', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-remote-transport-actions-'));
    const historyFilePath = path.join(root, 'history.json');
    const hookRun = jest.fn(async () => ({ ok: true }));
    const sidecarStart = jest.fn(async () => ({
      ready: true,
      baseUrl: 'http://127.0.0.1:4100',
      advertisedBaseUrl: 'https://AIGateway.example',
      message: 'AIGateway iniciado pelo Zavorth.',
    }));
    const sidecarStop = jest.fn(async () => undefined);
    const compatRun = jest.fn(async () => ({
      ok: true,
      summary: 'Gateway proprio do AIGateway respondeu pelo contrato OpenAI-compatible.',
    }));
    const remoteDoctorRun = jest.fn(async () => ({
      status: 'passed',
      summary: 'Doctor dos transportes remotos validou os transportes disponiveis.',
      items: [
        {
          transportId: 'AIGateway',
          details: ['Endpoint alcancavel e pipeline pronto.'],
        },
      ],
    }));
    const remoteTransportService = {
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => ({
        generatedAt: '2026-04-02T12:00:00.000Z',
        summary: {
          total: 4,
          ready: 2,
          partial: 1,
          planned: 1,
          disabled: 0,
          live: 2,
          reachable: 1,
        },
        entries: [],
        selected: {
          id: selectedId || 'AIGateway',
          label: 'AIGateway',
          kind: 'sidecar',
          transport: 'http-sidecar',
          direction: 'bidirectional',
          readiness: 'partial',
          available: false,
          endpoint: 'http://127.0.0.1:4100',
          operatorSummary: 'AIGateway existe localmente, mas ainda nao confirmou health pronto.',
          actionHint: '/connect AIGateway',
          telemetry: {
            updatedAt: '2026-04-02T11:59:00.000Z',
            pendingWork: 0,
            lastError: 'Health ainda nao confirmado.',
            statusLine: 'Sidecar ainda sem health pronto.',
          },
          details: ['Endpoint: http://127.0.0.1:4100.'],
          actions: [],
        },
        suggestedActions: [],
        narrative: {
          headline: 'Plano remoto.',
          operatorSummary: '1 transporte em preparo.',
        },
      })),
    };

    const service = new ZavorthRemoteTransportActionService({
      remoteTransportService: remoteTransportService as any,
      remoteTransportDoctorService: {
        run: remoteDoctorRun,
        readLastReport: jest.fn(),
      } as any,
      AIGatewaySidecarService: {
        start: sidecarStart,
        stop: sidecarStop,
      } as any,
      GatewayCompatibilityDoctorService: {
        run: compatRun,
        readLastReport: jest.fn(),
      } as any,
      hookPipelineService: { run: hookRun } as any,
      historyFilePath,
    });

    const prepare = await service.execute({
      transportId: 'AIGateway',
      actionId: 'prepare',
      requestedBy: 'dashboard',
    });
    const smoke = await service.execute({
      transportId: 'AIGateway',
      actionId: 'smoke',
      requestedBy: 'dashboard',
    });
    const repair = await service.execute({
      transportId: 'AIGateway',
      actionId: 'repair',
      requestedBy: 'dashboard',
    });
    const history = service.readHistory({ transportId: 'AIGateway', limit: 10 });

    expect(prepare.summary).toContain('foi preparado');
    expect(smoke.summary).toContain('Smoke real concluido');
    expect(repair.summary).toContain('foi reconciliado');
    expect(sidecarStart).toHaveBeenCalledTimes(2);
    expect(sidecarStop).toHaveBeenCalledTimes(1);
    expect(compatRun).toHaveBeenCalledTimes(2);
    expect(remoteDoctorRun).toHaveBeenCalledTimes(2);
    expect(history.summary.total).toBe(3);
    expect(history.entries[0]).toEqual(
      expect.objectContaining({
        actionId: 'repair',
        transportId: 'AIGateway',
      }),
    );
  });
});
