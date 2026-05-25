import fs from 'fs';
import os from 'os';
import path from 'path';
import { NodeCapabilityReapprovalService } from '../../src/services/NodeCapabilityReapprovalService.js';
import { NodeRegistryService } from '../../src/services/NodeRegistryService.js';

describe('NodeCapabilityReapprovalService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  function createRegistry(root: string): NodeRegistryService {
    return new NodeRegistryService({
      now: () => new Date('2026-04-03T11:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      secureStorageService: {
        encryptString: jest.fn((value: string) => `enc:${value}`),
        decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
      } as any,
    });
  }

  it('blocks a paired node when it declares new unapproved capabilities', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-reapproval-'));
    tempDirs.push(root);
    const registry = createRegistry(root);
    registry.upsertNode({
      id: 'desktop-node',
      label: 'Desktop Companion',
      kind: 'desktop',
      transport: 'sidecar',
      status: 'online',
      pairingStatus: 'paired',
      paired: true,
      createdAt: '2026-04-03T10:55:00.000Z',
      updatedAt: '2026-04-03T10:55:00.000Z',
      pairedAt: '2026-04-03T10:55:00.000Z',
      lastSeenAt: '2026-04-03T10:55:00.000Z',
      requestedBy: 'operator',
      capabilityIds: ['files.read'],
      approvedCapabilityIds: ['files.read'],
      allowlistAudit: {
        approvedAt: '2026-04-03T10:55:00.000Z',
        approvedBy: 'operator',
        reason: 'Initial pairing',
        mode: 'pairing',
      },
      hostHints: {
        hostname: 'desktop',
        platform: 'win32',
        workspace: 'C:/repo',
        surface: 'desktop-companion',
      },
      notes: [],
      operatorSummary: 'Ready.',
    });

    const result = new NodeCapabilityReapprovalService({ registryService: registry }).reconcileHeartbeat({
      nodeId: 'desktop-node',
      declaredCapabilityIds: ['files.read', 'screen.capture'],
    });

    expect(result).toEqual(
      expect.objectContaining({
        allowed: false,
        reason: expect.stringContaining('screen.capture'),
        commandHint: expect.stringContaining('Approve the new node allowlist'),
        delta: expect.objectContaining({
          added: ['screen.capture'],
          unchanged: ['files.read'],
        }),
      }),
    );
    expect(registry.getNode('desktop-node')).toEqual(
      expect.objectContaining({
        status: 'blocked',
        capabilityIds: ['files.read', 'screen.capture'],
        approvedCapabilityIds: ['files.read'],
        allowlistAudit: expect.objectContaining({
          mode: 'reapproval-required',
        }),
      }),
    );
  });

  it('allows a heartbeat when declared capabilities stay inside the approved set', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-reapproval-allowed-'));
    tempDirs.push(root);
    const registry = createRegistry(root);
    registry.upsertNode({
      id: 'mobile-node',
      label: 'Mobile Companion',
      kind: 'mobile',
      transport: 'remote',
      status: 'online',
      pairingStatus: 'paired',
      paired: true,
      createdAt: '2026-04-03T10:55:00.000Z',
      updatedAt: '2026-04-03T10:55:00.000Z',
      pairedAt: '2026-04-03T10:55:00.000Z',
      lastSeenAt: '2026-04-03T10:55:00.000Z',
      requestedBy: 'operator',
      capabilityIds: ['device.info'],
      approvedCapabilityIds: ['device.info'],
      hostHints: {
        hostname: 'phone',
        platform: 'android',
        workspace: null,
        surface: 'mobile-companion',
      },
      notes: [],
      operatorSummary: 'Ready.',
    });

    expect(new NodeCapabilityReapprovalService({ registryService: registry }).reconcileHeartbeat({
      nodeId: 'mobile-node',
      declaredCapabilityIds: ['device.info'],
    })).toEqual(
      expect.objectContaining({
        allowed: true,
        delta: expect.objectContaining({
          added: [],
        }),
      }),
    );
  });
});
