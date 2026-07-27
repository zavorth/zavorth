import fs from 'fs';
import os from 'os';
import path from 'path';
import { NodeHeartbeatService } from '../../src/services/NodeHeartbeatService.js';
import { NodeInvocationStoreService } from '../../src/services/NodeInvocationStoreService.js';
import { NodeInvokeService } from '../../src/services/NodeInvokeService.js';
import { NodePairingService } from '../../src/services/NodePairingService.js';
import { NodeRegistryService } from '../../src/services/NodeRegistryService.js';

describe('NodeHeartbeatService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('claims a pairing and exchanges queued work through heartbeat', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-heartbeat-'));
    tempDirs.push(root);
    const now = () => new Date('2026-04-02T20:00:00.000Z');
    const registry = new NodeRegistryService({
      now,
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      secureStorageService: {
        encryptString: jest.fn((value: string) => `enc:${value}`),
        decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
      } as any,
    });
    const pairing = new NodePairingService({ now, registryService: registry });
    const store = new NodeInvocationStoreService({
      now,
      stateFile: path.join(root, 'node-mesh-invocations.json'),
    });
    const invoke = new NodeInvokeService({
      now,
      registryService: registry,
      invocationStoreService: store,
    });
    const heartbeat = new NodeHeartbeatService({
      now,
      registryService: registry,
      pairingService: pairing,
      invokeService: invoke,
      heartbeatIntervalMs: 9000,
    });

    const draft = pairing.createPairingDraft({
      label: 'Oracle Node',
      requestedBy: 'dashboard',
      capabilityIds: ['system.run'],
    });
    const claim = heartbeat.claimPairing({
      nodeId: draft.entry.id,
      pairingCode: draft.pairingCode,
      capabilityIds: ['system.run'],
      hostHints: {
        hostname: 'oracle',
        platform: 'linux',
        arch: 'x64',
        osRelease: '6.8.0',
      },
    });
    const queued = invoke.invoke({
      nodeId: draft.entry.id,
      capabilityId: 'system.run',
      action: 'run',
      payload: { command: 'echo NODE_OK' },
      requestedBy: 'dashboard',
    });
    const beat = heartbeat.receiveHeartbeat({
      nodeId: draft.entry.id,
      sharedSecret: claim?.sharedSecret || null,
      status: 'online',
      capabilityIds: ['system.run'],
      results: [],
    });
    const completionBeat = heartbeat.receiveHeartbeat({
      nodeId: draft.entry.id,
      sharedSecret: claim?.sharedSecret || null,
      status: 'online',
      capabilityIds: ['system.run'],
      results: beat?.assignments.map((assignment) => ({
        invocationId: assignment.id,
        ok: true,
        resultSummary: 'Executed on node host.',
        stdout: 'NODE_OK',
        exitCode: 0,
      })) || [],
    });

    expect(claim).toEqual(
      expect.objectContaining({
        sharedSecret: expect.any(String),
        node: expect.objectContaining({
          status: 'online',
          pairingStatus: 'paired',
          hostHints: expect.objectContaining({
            arch: 'x64',
            osRelease: '6.8.0',
          }),
        }),
      }),
    );
    expect(queued).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'queued',
      }),
    );
    expect(beat).toEqual(
      expect.objectContaining({
        acceptedResults: 0,
        assignments: [
          expect.objectContaining({
            action: 'run',
            status: 'claimed',
          }),
        ],
      }),
    );
    expect(completionBeat).toEqual(
      expect.objectContaining({
        acceptedResults: 1,
        assignments: [],
      }),
    );
  });
});
