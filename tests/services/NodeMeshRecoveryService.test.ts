import { NodeMeshRecoveryService } from '../../src/services/NodeMeshRecoveryService.js';

describe('NodeMeshRecoveryService', () => {
  it('reports stale pairing drafts and stale queue debt in doctor mode', () => {
    const service = new NodeMeshRecoveryService({
      now: () => new Date('2026-04-05T10:00:00.000Z'),
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          entries: [
            {
              id: 'desktop-node',
              label: 'Desktop Node',
              pairingStatus: 'pending',
              lifecycle: { pairingDraftStale: true },
              operatorSummary: 'Draft antigo.',
              nextAction: 'Gerar novo pairing.',
              capabilityIds: ['system.run'],
              stalePendingInvocations: 0,
              staleClaimedInvocations: 0,
            },
            {
              id: 'oracle-node',
              label: 'Oracle Node',
              lifecycle: { pairingDraftStale: false },
              operatorSummary: 'Fila presa.',
              nextAction: 'Clean queue.',
              capabilityIds: ['node.maintenance'],
              stalePendingInvocations: 1,
              staleClaimedInvocations: 2,
            },
          ],
        })),
      } as any,
    });

    const report = service.runDoctor();

    expect(report).toEqual(
      expect.objectContaining({
        status: 'attention',
        issues: expect.arrayContaining([
          expect.objectContaining({
            kind: 'expired-pairing-draft',
            nodeId: 'desktop-node',
            recoverKind: 'regenerate-pairing-draft',
          }),
          expect.objectContaining({
            kind: 'stale-queue-debt',
            nodeId: 'oracle-node',
            recoverable: true,
            recoverKind: 'queue-node-host-maintenance',
          }),
        ]),
      }),
    );
  });

  it('ignores stale pairing lifecycle markers once the draft was already revoked', () => {
    const service = new NodeMeshRecoveryService({
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          entries: [
            {
              id: 'desktop-node',
              label: 'Desktop Node',
              pairingStatus: 'revoked',
              lifecycle: { pairingDraftStale: true },
              operatorSummary: 'Draft expirado e ja revogado.',
              nextAction: 'Noa.',
              capabilityIds: ['system.run'],
              stalePendingInvocations: 0,
              staleClaimedInvocations: 0,
            },
          ],
          selected: null,
        })),
      } as any,
    });

    const report = service.runDoctor();

    expect(report.status).toBe('healthy');
    expect(report.issues).toEqual([]);
  });

  it('regenerates pairing drafts and refreshes the selected node snapshot', () => {
    const nodePairingService = {
      regeneratePairingDraft: jest.fn(() => ({
        generatedAt: '2026-04-05T10:05:00.000Z',
        pairingCode: 'PAIR-NEW',
        entry: {
          id: 'desktop-node',
        },
      })),
    };
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({ entries: [], selected: { id: 'desktop-node' } })),
    };
    const service = new NodeMeshRecoveryService({
      nodeMeshService: nodeMeshService as any,
      nodePairingService: nodePairingService as any,
    });

    const result = service.recover({
      kind: 'regenerate-pairing-draft',
      nodeId: 'desktop-node',
      profileId: 'desktop-companion',
    });

    expect(result.ok).toBe(true);
    expect(nodePairingService.regeneratePairingDraft).toHaveBeenCalledWith(
      'desktop-node',
      expect.objectContaining({
        profileId: 'desktop-companion',
      }),
    );
    expect(result.action).toEqual(
      expect.objectContaining({
        kind: 'regenerate-pairing-draft',
      }),
    );
    expect(nodeMeshService.buildSnapshot).toHaveBeenCalledWith({ selectedNodeId: 'desktop-node' });
    expect(result.result).toEqual(
      expect.objectContaining({
        pairingCode: 'PAIR-NEW',
      }),
    );
  });

  it('requeues stale claimed work and returns the refreshed node mesh snapshot', () => {
    const nodeInvokeService = {
      requeueStaleClaimed: jest.fn(() => ([
        {
          id: 'invoke-1',
          nodeId: 'oracle-node',
          status: 'pending',
        },
      ])),
    };
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({ entries: [], selected: { id: 'oracle-node' } })),
    };
    const service = new NodeMeshRecoveryService({
      nodeMeshService: nodeMeshService as any,
      nodeInvokeService: nodeInvokeService as any,
    });

    const result = service.recover({
      kind: 'release-stale-claims',
      nodeId: 'oracle-node',
      limit: 3,
    });

    expect(result.ok).toBe(true);
    expect(nodeInvokeService.requeueStaleClaimed).toHaveBeenCalledWith('oracle-node', 3);
    expect(result.action).toEqual(
      expect.objectContaining({
        kind: 'release-stale-claims',
      }),
    );
    expect(result.result).toEqual(
      expect.objectContaining({
        nodeId: 'oracle-node',
        requeuedCount: 1,
      }),
    );
  });

  it('queues node host maintenance through the invoke plane when requested', () => {
    const nodeInvokeService = {
      requeueStaleClaimed: jest.fn(),
      invoke: jest.fn(() => ({
        ok: true,
        status: 'queued',
        nodeId: 'oracle-node',
        capabilityId: 'node.maintenance',
        action: 'repair',
        invocationId: 'invoke-maint-1',
      })),
    };
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({ entries: [], selected: { id: 'oracle-node' } })),
    };
    const service = new NodeMeshRecoveryService({
      nodeMeshService: nodeMeshService as any,
      nodeInvokeService: nodeInvokeService as any,
    });

    const result = service.recover({
      kind: 'queue-node-host-maintenance',
      nodeId: 'oracle-node',
    });

    expect(result.ok).toBe(true);
    expect(nodeInvokeService.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'oracle-node',
        capabilityId: 'node.maintenance',
        action: 'repair',
      }),
    );
    expect(result.action).toEqual(
      expect.objectContaining({
        kind: 'queue-node-host-maintenance',
      }),
    );
    expect(result.result).toEqual(
      expect.objectContaining({
        invocationId: 'invoke-maint-1',
      }),
    );
  });

  it('returns a stable no-op result for unknown recover actions', () => {
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({ entries: [] })),
    };
    const service = new NodeMeshRecoveryService({
      nodeMeshService: nodeMeshService as any,
    });

    const result = service.recover({
      kind: 'unknown-action',
      nodeId: 'oracle-node',
    });

    expect(result.ok).toBe(false);
    expect(result.action).toBeNull();
    expect(nodeMeshService.buildSnapshot).toHaveBeenCalledWith();
  });
});
