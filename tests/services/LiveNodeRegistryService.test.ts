import { LiveNodeRegistryService } from '../../src/services/LiveNodeRegistryService.js';
import type { NodeMeshRegistryEntry } from '../../src/contracts/NodeMeshContract.js';

describe('LiveNodeRegistryService', () => {
  function node(input: Partial<NodeMeshRegistryEntry> & { id: string; label: string }): NodeMeshRegistryEntry {
    return {
      id: input.id,
      label: input.label,
      kind: input.kind || 'desktop',
      transport: input.transport || 'sidecar',
      status: input.status || 'online',
      pairingStatus: input.pairingStatus || 'paired',
      paired: input.paired ?? true,
      createdAt: input.createdAt || '2026-04-03T09:59:00.000Z',
      updatedAt: input.updatedAt || '2026-04-03T09:59:00.000Z',
      pairedAt: input.pairedAt || '2026-04-03T09:59:00.000Z',
      lastSeenAt: input.lastSeenAt || '2026-04-03T09:59:00.000Z',
      requestedBy: input.requestedBy || 'operator',
      capabilityIds: input.capabilityIds || [],
      approvedCapabilityIds: input.approvedCapabilityIds || [],
      hostHints: {
        hostname: 'node',
        platform: 'win32',
        workspace: null,
        surface: null,
        ...(input.hostHints || {}),
      },
      notes: input.notes || [],
      operatorSummary: input.operatorSummary || null,
    };
  }

  it('tracks connected node sessions, live events and delivery receipts', () => {
    const times = [
      '2026-04-03T10:00:00.000Z',
      '2026-04-03T10:00:01.000Z',
      '2026-04-03T10:00:02.000Z',
      '2026-04-03T10:00:03.000Z',
      '2026-04-03T10:00:04.000Z',
    ];
    let cursor = 0;
    const service = new LiveNodeRegistryService({
      now: () => new Date(times[Math.min(cursor++, times.length ? 1)]),
    });
    const observed: string[] = [];
    const unsubscribe = service.subscribe((event) => {
      observed.push(event.type);
    });

    service.recordClaim({
      node: node({
        id: 'desktop-node',
        label: 'Desktop Companion',
        capabilityIds: ['files.read'],
      }),
      transport: 'sse',
      assignmentsPending: 0,
    });
    service.recordHeartbeat({
      node: node({
        id: 'desktop-node',
        label: 'Desktop Companion',
        capabilityIds: ['files.read'],
      }),
      transport: 'sse',
      assignmentsPending: 1,
      acceptedResults: 0,
    });
    service.recordInvocationQueued({
      nodeId: 'desktop-node',
      invocationId: 'invoke-1',
      capabilityId: 'files.read',
      action: 'inspect',
    });
    service.recordInvocationCompleted({
      nodeId: 'desktop-node',
      invocationId: 'invoke-1',
      ok: true,
      resultSummary: 'Read completed.',
    });

    unsubscribe();

    const snapshot = service.buildSnapshot();
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        live: 1,
        online: 1,
        events: 4,
        reapprovalRequired: 0,
      }),
    );
    expect(snapshot.sessions).toEqual([
      expect.objectContaining({
        nodeId: 'desktop-node',
        label: 'Desktop Companion',
        transport: 'sse',
        status: 'online',
        assignmentsPending: 1,
      }),
    ]);
    expect(snapshot.recentEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'node.invocation.queued',
          payload: expect.objectContaining({
            invocationId: 'invoke-1',
            receiptId: expect.stringContaining('node.invocation.queued'),
          }),
        }),
        expect.objectContaining({
          type: 'node.invocation.completed',
          payload: expect.objectContaining({
            invocationId: 'invoke-1',
            receiptId: expect.stringContaining('node.invocation.completed'),
          }),
        }),
      ]),
    );
    expect(observed).toEqual([
      'node.claimed',
      'node.heartbeat',
      'node.invocation.queued',
      'node.invocation.completed',
    ]);
  });

  it('marks sessions as requiring reapproval when capabilities drift', () => {
    const service = new LiveNodeRegistryService({
      now: () => new Date('2026-04-03T10:10:00.000Z'),
    });
    service.recordHeartbeat({
      node: node({
        id: 'mobile-node',
        label: 'Mobile Companion',
        capabilityIds: ['device.info'],
        approvedCapabilityIds: ['device.info'],
      }),
      transport: 'sse',
      assignmentsPending: 0,
      acceptedResults: 0,
    });

    service.recordReapprovalRequired({
      node: node({
        id: 'mobile-node',
        label: 'Mobile Companion',
        status: 'blocked',
        capabilityIds: ['device.info', 'camera.capture'],
        approvedCapabilityIds: ['device.info'],
      }),
      delta: {
        added: ['camera.capture'],
        removed: [],
        unchanged: ['device.info'],
      },
      reason: 'New capability requires approval.',
    });

    expect(service.buildSnapshot().sessions[0]).toEqual(
      expect.objectContaining({
        status: 'blocked',
        reapprovalRequired: true,
        capabilityDelta: expect.objectContaining({
          added: ['camera.capture'],
        }),
      }),
    );
  });
});
