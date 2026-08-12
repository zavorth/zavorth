import fs from 'fs';
import os from 'os';
import path from 'path';
import { NodeInvocationStoreService } from '../../src/services/NodeInvocationStoreService.js';

describe('NodeInvocationStoreService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('queues, claims and completes invocation records persistently', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-invocations-'));
    tempDirs.push(root);
    const service = new NodeInvocationStoreService({
      now: () => new Date('2026-04-02T19:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-invocations.json'),
    });

    const queued = service.enqueue({
      nodeId: 'oracle-node',
      capabilityId: 'system.run',
      action: 'diagnose',
      payload: { command: 'echo ok' },
      requestedBy: 'dashboard',
      transport: 'bridge',
    });
    const claimed = service.claimPending('oracle-node', 2);
    const completed = service.complete('oracle-node', {
      invocationId: queued.id,
      ok: true,
      resultSummary: 'Executado.',
      stdout: 'ok',
      exitCode: 0,
    });

    expect(claimed).toEqual([
      expect.objectContaining({
        id: queued.id,
        status: 'claimed',
      }),
    ]);
    expect(completed).toEqual(
      expect.objectContaining({
        id: queued.id,
        status: 'completed',
        ok: true,
        resultSummary: 'Executado.',
        output: expect.objectContaining({
          stdout: 'ok',
          exitCode: 0,
        }),
      }),
    );
    expect(service.summarizeNode('oracle-node')).toEqual(
      expect.objectContaining({
        pending: 0,
        claimed: 0,
        completedRecently: 1,
        stalePending: 0,
        staleClaimed: 0,
        recent: expect.objectContaining({
          id: queued.id,
          status: 'completed',
        }),
      }),
    );
  });

  it('cancels stale pending invocations and still surfaces claimed debt in node summaries', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-invocations-stale-'));
    tempDirs.push(root);
    const service = new NodeInvocationStoreService({
      now: () => new Date('2026-04-02T22:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-invocations.json'),
      pendingStaleMs: 1000 * 60 * 30,
      claimedStaleMs: 1000 * 60 * 10,
    });

    const state = service.readState();
    state.entries['pending-old'] = {
      id: 'pending-old',
      nodeId: 'oracle-node',
      capabilityId: 'system.run',
      action: 'run',
      payload: null,
      requestedBy: 'dashboard',
      transport: 'bridge',
      status: 'pending',
      requestedAt: '2026-04-02T20:30:00.000Z',
      queuedAt: '2026-04-02T20:30:00.000Z',
      claimedAt: null,
      completedAt: null,
      ok: null,
      resultSummary: null,
      output: null,
    };
    state.entries['claimed-old'] = {
      id: 'claimed-old',
      nodeId: 'oracle-node',
      capabilityId: 'files.write',
      action: 'persist',
      payload: null,
      requestedBy: 'dashboard',
      transport: 'bridge',
      status: 'claimed',
      requestedAt: '2026-04-02T21:00:00.000Z',
      queuedAt: '2026-04-02T21:00:00.000Z',
      claimedAt: '2026-04-02T21:20:00.000Z',
      completedAt: null,
      ok: null,
      resultSummary: null,
      output: null,
    };
    (service as any).writeState(state);

    const summary = service.summarizeNode('oracle-node');
    const refreshedState = service.readState();

    expect(summary).toEqual(
      expect.objectContaining({
        pending: 0,
        claimed: 1,
        stalePending: 1,
        staleClaimed: 1,
      }),
    );
    expect(refreshedState.entries['pending-old']).toEqual(
      expect.objectContaining({
        status: 'cancelled',
        staleReason: 'pending-expired',
        ok: false,
      }),
    );
  });

  it('requeues stale claimed invocations back to pending with stale markers cleared', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-invocations-requeue-'));
    tempDirs.push(root);
    const service = new NodeInvocationStoreService({
      now: () => new Date('2026-04-02T22:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-invocations.json'),
      claimedStaleMs: 1000 * 60 * 10,
    });

    const state = service.readState();
    state.entries['claimed-old'] = {
      id: 'claimed-old',
      nodeId: 'oracle-node',
      capabilityId: 'files.write',
      action: 'persist',
      payload: null,
      requestedBy: 'dashboard',
      transport: 'bridge',
      status: 'claimed',
      requestedAt: '2026-04-02T21:00:00.000Z',
      queuedAt: '2026-04-02T21:00:00.000Z',
      claimedAt: '2026-04-02T21:20:00.000Z',
      completedAt: null,
      ok: null,
      resultSummary: null,
      output: null,
      staleAt: '2026-04-02T21:40:00.000Z',
      staleReason: 'heartbeat-lost',
    };
    state.entries['claimed-fresh'] = {
      id: 'claimed-fresh',
      nodeId: 'oracle-node',
      capabilityId: 'system.run',
      action: 'run',
      payload: null,
      requestedBy: 'dashboard',
      transport: 'bridge',
      status: 'claimed',
      requestedAt: '2026-04-02T21:55:00.000Z',
      queuedAt: '2026-04-02T21:55:00.000Z',
      claimedAt: '2026-04-02T21:56:00.000Z',
      completedAt: null,
      ok: null,
      resultSummary: null,
      output: null,
      staleAt: null,
      staleReason: null,
    };
    (service as any).writeState(state);

    const requeued = service.requeueStaleClaimed('oracle-node', 10);
    const refreshedState = service.readState();

    expect(requeued).toEqual([
      expect.objectContaining({
        id: 'claimed-old',
        status: 'pending',
        claimedAt: null,
        staleAt: null,
        staleReason: null,
      }),
    ]);
    expect(refreshedState.entries['claimed-old']).toEqual(
      expect.objectContaining({
        status: 'pending',
        claimedAt: null,
        staleAt: null,
        staleReason: null,
      }),
    );
    expect(refreshedState.entries['claimed-fresh']).toEqual(
      expect.objectContaining({
        status: 'claimed',
      }),
    );
  });

  it('prunes terminal invocation history for removed nodes while preserving active queues', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-invocations-prune-'));
    tempDirs.push(root);
    const service = new NodeInvocationStoreService({
      now: () => new Date('2026-04-14T22:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-invocations.json'),
    });

    const state = service.readState();
    state.entries['revoked-terminal'] = {
      id: 'revoked-terminal',
      nodeId: 'revoked-node',
      capabilityId: 'system.run',
      action: 'run',
      payload: null,
      requestedBy: 'dashboard',
      transport: 'bridge',
      status: 'cancelled',
      requestedAt: '2026-04-05T21:00:00.000Z',
      queuedAt: '2026-04-05T21:00:00.000Z',
      claimedAt: null,
      completedAt: '2026-04-05T22:00:00.000Z',
      ok: false,
      resultSummary: 'Historico cancelado.',
      output: null,
      staleAt: '2026-04-05T22:00:00.000Z',
      staleReason: 'pending-expired',
    };
    state.entries['active-pending'] = {
      id: 'active-pending',
      nodeId: 'active-node',
      capabilityId: 'files.write',
      action: 'persist',
      payload: null,
      requestedBy: 'dashboard',
      transport: 'bridge',
      status: 'pending',
      requestedAt: '2026-04-14T21:50:00.000Z',
      queuedAt: '2026-04-14T21:50:00.000Z',
      claimedAt: null,
      completedAt: null,
      ok: null,
      resultSummary: null,
      output: null,
      staleAt: null,
      staleReason: null,
    };
    (service as any).writeState(state);

    const result = service.pruneByNodeIds(['revoked-node', 'active-node']);
    const refreshedState = service.readState();

    expect(result).toEqual({
      removedInvocationIds: ['revoked-terminal'],
      removedEntries: 1,
      blockedNodeIds: ['active-node'],
    });
    expect(refreshedState.entries['revoked-terminal']).toBeUndefined();
    expect(refreshedState.entries['active-pending']).toEqual(
      expect.objectContaining({
        status: 'pending',
      }),
    );
  });
});
