import { ZavorthControlService } from '../../src/services/ZavorthControlService.js';
import {
  createTestLogRepo,
  fetchZavorthControlJson,
} from '../helpers/zavorthControlWebTestUtils.js';

function buildRemoteTransportSnapshot(selectedId: string | null = 'discord-transport') {
  return {
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
    selected: selectedId
      ? {
          id: selectedId,
          label: 'Discord transport',
          kind: 'bridge',
          transport: 'discord-native-gateway',
          direction: 'bidirectional',
          readiness: 'ready',
          available: true,
          endpoint: null,
          operatorSummary: 'Discord ready.',
          actionHint: '/status',
          details: ['Mode: native.'],
        }
      : null,
    suggestedActions: [],
    narrative: {
      headline: 'Zavorth exposes 4 transporte(s) remoto(s) no current plane.',
      operatorSummary: '2 ready(s), 1 em preparo e 0 desativado(s).',
    },
  };
}

function buildRemoteTransportHistory(transportId: string = 'discord-transport') {
  return {
    generatedAt: '2026-04-02T12:06:00.000Z',
    transportId,
    summary: {
      total: 2,
      ok: 2,
      blocked: 0,
    },
    entries: [
      {
        occurredAt: '2026-04-02T12:05:00.000Z',
        transportId,
        actionId: 'smoke',
        status: 'applied',
        ok: true,
        summary: 'Smoke executado com sucesso.',
        requestedBy: 'zavorthControl',
      },
      {
        occurredAt: '2026-04-02T12:04:00.000Z',
        transportId,
        actionId: 'inspect',
        status: 'manual',
        ok: true,
        summary: 'Inspecao registrada.',
        requestedBy: 'zavorthControl',
      },
    ],
  };
}

function buildRemoteTransportDoctorReport(transportId: string = 'discord-transport') {
  return {
    checkedAt: '2026-04-02T12:07:00.000Z',
    status: 'passed',
    summary: 'Doctor remoto validou o transporte selecionado.',
    command: 'npm run test:transports:smoke',
    file: 'C:/tmp/remote-transport-doctor-last.json',
    items: [
      {
        transportId,
        label: 'Discord transport',
        kind: 'bridge',
        transport: 'discord-native-gateway',
        readiness: 'ready',
        available: true,
        endpoint: null,
        status: 'passed',
        probeStatus: 'skipped',
        probeHttpStatus: null,
        summary: 'Discord validated.',
        error: null,
        recommendedAction: null,
        details: ['Bridge ready in the remote plan.'],
      },
    ],
  };
}

describe('ZavorthControl remote transport endpoint', () => {
  const logRepo = createTestLogRepo();

  it('serves the remote transport plane through operations endpoint', async () => {
    const remoteTransportService = {
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => buildRemoteTransportSnapshot(selectedId || 'discord-transport')),
    };

    const service = new ZavorthControlService(logRepo, {
      remoteTransportService: remoteTransportService as any,
    });

    await service.start();
    const { status, payload } = await fetchZavorthControlJson(
      service.getUrl(),
      '/api/operations/transports-selectedId=discord-transport',
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(remoteTransportService.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedId: 'discord-transport',
      }),
    );
    expect(payload).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          total: 4,
          ready: 2,
        }),
        selected: expect.objectContaining({
          id: 'discord-transport',
        }),
      }),
    );
  });

  it('executes remote transport actions through operations endpoint', async () => {
    const remoteTransportService = {
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => buildRemoteTransportSnapshot(selectedId || 'discord-transport')),
    };
    const remoteTransportActionService = {
      execute: jest.fn(async () => ({
        generatedAt: '2026-04-02T12:05:00.000Z',
        transportId: 'discord-transport',
        actionId: 'smoke',
        status: 'applied',
        ok: true,
        summary: 'Smoke leve completed para Discord transport.',
        details: ['Discord ready.'],
        selected: buildRemoteTransportSnapshot('discord-transport').selected,
        snapshot: buildRemoteTransportSnapshot('discord-transport'),
      })),
    };

    const service = new ZavorthControlService(logRepo, {
      remoteTransportService: remoteTransportService as any,
      remoteTransportActionService: remoteTransportActionService as any,
    });

    await service.start();
    const { status, payload } = await fetchZavorthControlJson(
      service.getUrl(),
      '/api/operations/transports/actions',
      {
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transportId: 'discord-transport',
            actionId: 'smoke',
          }),
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(remoteTransportActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        transportId: 'discord-transport',
        actionId: 'smoke',
        requestedBy: 'zavorthControl',
      }),
    );
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          summary: 'Smoke leve completed para Discord transport.',
        }),
        transports: expect.objectContaining({
          selected: expect.objectContaining({
            id: 'discord-transport',
          }),
        }),
      }),
    );
  });

  it('serves per-transport history and last doctor report through operations endpoint', async () => {
    const remoteTransportService = {
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => buildRemoteTransportSnapshot(selectedId || 'discord-transport')),
    };
    const remoteTransportActionService = {
      execute: jest.fn(),
      readHistory: jest.fn(({ transportId }: any = {}) => buildRemoteTransportHistory(transportId || 'discord-transport')),
    };
    const remoteTransportDoctorService = {
      run: jest.fn(),
      readLastReport: jest.fn(({ selectedId }: any = {}) => buildRemoteTransportDoctorReport(selectedId || 'discord-transport')),
    };

    const service = new ZavorthControlService(logRepo, {
      remoteTransportService: remoteTransportService as any,
      remoteTransportActionService: remoteTransportActionService as any,
      remoteTransportDoctorService: remoteTransportDoctorService as any,
    });

    await service.start();
    const { status, payload } = await fetchZavorthControlJson(
      service.getUrl(),
      '/api/operations/transports/discord-transport/history',
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(remoteTransportActionService.readHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        transportId: 'discord-transport',
        limit: 10,
      }),
    );
    expect(remoteTransportDoctorService.readLastReport).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedId: 'discord-transport',
      }),
    );
    expect(payload).toEqual(
      expect.objectContaining({
        transport: expect.objectContaining({
          id: 'discord-transport',
        }),
        history: expect.objectContaining({
          transportId: 'discord-transport',
        }),
        doctor: expect.objectContaining({
          status: 'passed',
        }),
      }),
    );
  });

  it('runs remote transport doctor through operations endpoint', async () => {
    const remoteTransportService = {
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => buildRemoteTransportSnapshot(selectedId || 'discord-transport')),
    };
    const remoteTransportDoctorService = {
      run: jest.fn(async ({ selectedId }: any = {}) => buildRemoteTransportDoctorReport(selectedId || 'discord-transport')),
      readLastReport: jest.fn(),
    };

    const service = new ZavorthControlService(logRepo, {
      remoteTransportService: remoteTransportService as any,
      remoteTransportDoctorService: remoteTransportDoctorService as any,
    });

    await service.start();
    const { status, payload } = await fetchZavorthControlJson(
      service.getUrl(),
      '/api/operations/transports/discord-transport/doctor',
      {
        init: {
          method: 'POST',
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(remoteTransportDoctorService.run).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedId: 'discord-transport',
      }),
    );
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        report: expect.objectContaining({
          status: 'passed',
        }),
      }),
    );
  });

  it('executes per-transport recover through operations endpoint', async () => {
    const remoteTransportService = {
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => buildRemoteTransportSnapshot(selectedId || 'discord-transport')),
    };
    const remoteTransportActionService = {
      execute: jest.fn(async () => ({
        generatedAt: '2026-04-02T12:08:00.000Z',
        transportId: 'discord-transport',
        actionId: 'repair',
        status: 'applied',
        ok: true,
        summary: 'Discord transport received canonical repair.',
        details: ['Bridge reconciliada.'],
        selected: buildRemoteTransportSnapshot('discord-transport').selected,
        snapshot: buildRemoteTransportSnapshot('discord-transport'),
      })),
      readHistory: jest.fn(({ transportId }: any = {}) => buildRemoteTransportHistory(transportId || 'discord-transport')),
    };

    const service = new ZavorthControlService(logRepo, {
      remoteTransportService: remoteTransportService as any,
      remoteTransportActionService: remoteTransportActionService as any,
    });

    await service.start();
    const { status, payload } = await fetchZavorthControlJson(
      service.getUrl(),
      '/api/operations/transports/discord-transport/recover',
      {
        init: {
          method: 'POST',
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(remoteTransportActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        transportId: 'discord-transport',
        actionId: 'repair',
        requestedBy: 'zavorthControl',
      }),
    );
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          summary: 'Discord transport received canonical repair.',
        }),
        history: expect.objectContaining({
          transportId: 'discord-transport',
        }),
      }),
    );
  });
});
