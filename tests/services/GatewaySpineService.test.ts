import { GatewaySpineService } from '../../src/services/GatewaySpineService.js';
import type { GatewayChannelRegistrySnapshot } from '../../src/services/GatewayChannelRegistryService.js';

describe('GatewaySpineService', () => {
  it('builds a canonical gateway spine snapshot shared by Web, CLI and Telegram', () => {
    const service = new GatewaySpineService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      gatewayRuntimeSnapshot: {
        lifecycle: { status: 'running' },
        route: 'gateway-runtime',
        sessions: [
          {
            id: 'session-1',
            platform: 'telegram',
            label: 'Telegram support',
            updatedAt: '2026-05-13T11:59:00.000Z',
          },
        ],
      },
      channelRegistrySnapshot: channelSnapshot(),
    });

    expect(snapshot.contractVersion).toBe('2026-05-13.checkpoint-1');
    expect(snapshot.spine.singleSourceOfTruth).toBe(true);
    expect(snapshot.channels.summary.total).toBe(3);
    expect(snapshot.channels.summary.ready).toBe(2);
    expect(snapshot.sessions.total).toBe(1);
    expect(snapshot.commands.map((command) => command.id)).toEqual([
      'gateway.status',
      'gateway.sessions',
      'gateway.channels',
      'gateway.approvals',
      'gateway.receipts',
      'gateway.artifacts',
    ]);
    expect(surface(snapshot, 'web')?.stateSource).toBe('GatewaySpineSnapshot');
    expect(surface(snapshot, 'cli')?.stateSource).toBe('GatewaySpineSnapshot');
    expect(surface(snapshot, 'telegram')?.sameSourceOfTruth).toBe(true);
    expect(snapshot.invariants.find((entry) => entry.id === 'telegram-not-special')?.status).toBe('passed');
  });

  it('normalizes approvals, receipts and artifacts into the same gateway projection', () => {
    const service = new GatewaySpineService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      gatewayRuntimeSnapshot: { lifecycle: { status: 'running' } },
      channelRegistrySnapshot: channelSnapshot(),
      approvals: {
        entries: [
          {
            approval_id: 'approval-1',
            reason: 'Zavorth wants to edit two files.',
            status: 'pending',
            created_at: '2026-05-13T11:58:00.000Z',
          },
        ],
      },
      receipts: {
        entries: [
          {
            id: 'receipt-1',
            kind: 'policy',
            status: 'passed',
            generatedAt: '2026-05-13T11:59:00.000Z',
          },
        ],
      },
      artifacts: {
        entries: [
          {
            id: 'artifact-1',
            name: 'review.md',
            status: 'available',
            createdAt: '2026-05-13T12:00:00.000Z',
          },
        ],
      },
    });

    expect(snapshot.approvals.total).toBe(1);
    expect(snapshot.approvals.pending).toBe(1);
    expect(snapshot.receipts.total).toBe(1);
    expect(snapshot.artifacts.total).toBe(1);
    expect(snapshot.status).toBe('ready');
  });
});

function channelSnapshot(): GatewayChannelRegistrySnapshot {
  return {
    generatedAt: '2026-05-13T12:00:00.000Z',
    summary: {
      total: 3,
      ready: 2,
      partial: 1,
      planned: 0,
      disabled: 0,
    },
    channels: [
      {
        id: 'web',
        label: 'Command Center',
        readiness: 'ready',
        configured: true,
        transport: 'http',
        notes: [],
        features: {
          sessionList: true,
          sessionHistory: true,
          sessionSend: true,
          sessionSpawn: true,
          attachments: true,
          threads: true,
          groupPolicy: true,
        },
      },
      {
        id: 'cli',
        label: 'CLI',
        readiness: 'ready',
        configured: true,
        transport: 'stdio',
        notes: [],
        features: {
          sessionList: true,
          sessionHistory: true,
          sessionSend: true,
          sessionSpawn: true,
          attachments: false,
          threads: false,
          groupPolicy: false,
        },
      },
      {
        id: 'telegram',
        label: 'Telegram',
        readiness: 'partial',
        configured: false,
        transport: 'bot-api',
        notes: ['token missing'],
        features: {
          sessionList: true,
          sessionHistory: true,
          sessionSend: true,
          sessionSpawn: false,
          attachments: true,
          threads: false,
          groupPolicy: true,
        },
      },
    ],
    narrative: {
      headline: 'Gateway knows three channels.',
      operatorSummary: 'Two ready, one partial.',
    },
  };
}

function surface(snapshot: ReturnType<GatewaySpineService['buildSnapshot']>, name: string) {
  return snapshot.surfaces.find((entry) => entry.surface === name);
}
