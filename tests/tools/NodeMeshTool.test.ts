
import fs from 'fs';
import os from 'os';
import path from 'path';
import { NodeMeshTool } from '../../src/tools/NodeMeshTool.js';
import { LiveNodeRegistryService } from '../../src/services/LiveNodeRegistryService.js';
import { NodeInvocationStoreService } from '../../src/services/NodeInvocationStoreService.js';
import { NodeInvokeService } from '../../src/services/NodeInvokeService.js';
import { NodeRegistryService } from '../../src/services/NodeRegistryService.js';
import { ZavorthNodeMeshService } from '../../src/services/ZavorthNodeMeshService.js';

describe('NodeMeshTool', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  function createServices(root: string) {
    const now = () => new Date('2026-04-03T12:00:00.000Z');
    const registryService = new NodeRegistryService({
      now,
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      secureStorageService: {
        encryptString: jest.fn((value: string) => `enc:${value}`),
        decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
      } as any,
    });
    registryService.upsertNode({
      id: 'desktop-node',
      label: 'Desktop Companion',
      kind: 'desktop',
      transport: 'sidecar',
      status: 'online',
      pairingStatus: 'paired',
      paired: true,
      createdAt: '2026-04-03T11:55:00.000Z',
      updatedAt: '2026-04-03T11:55:00.000Z',
      pairedAt: '2026-04-03T11:55:00.000Z',
      lastSeenAt: '2026-04-03T11:55:00.000Z',
      requestedBy: 'operator',
      capabilityIds: ['files.read'],
      approvedCapabilityIds: ['files.read'],
      hostHints: {
        hostname: 'desktop',
        platform: 'win32',
        workspace: root,
        surface: 'desktop-companion',
      },
      notes: [],
      operatorSummary: 'Ready.',
    });
    const invocationStoreService = new NodeInvocationStoreService({
      now,
      stateFile: path.join(root, 'node-mesh-invocations.json'),
    });
    const liveNodeRegistry = new LiveNodeRegistryService({ now });
    const invokeService = new NodeInvokeService({
      now,
      registryService,
      invocationStoreService,
      liveNodeRegistry,
    });
    const nodeMeshService = new ZavorthNodeMeshService({
      now,
      registryService,
      invokeService,
    });
    return {
      liveNodeRegistry,
      registryService,
      invokeService,
      nodeMeshService,
    };
  }

  it('exposes live node state and queues governed invocations for the LLM tool loop', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-nodes-tool-'));
    tempDirs.push(root);
    const services = createServices(root);
    const tool = new NodeMeshTool(services);

    const live = JSON.parse(await tool.execute({ action: 'live' }));
    expect(live.ok).toBe(true);
    expect(live.live.summary.live).toBe(0);

    const queued = JSON.parse(await tool.execute({
      action: 'invoke',
      nodeId: 'desktop-node',
      capabilityId: 'files.read',
      nodeAction: 'inspect',
      payloadJson: '{"path":"README.md"}',
    }));

    expect(queued.ok).toBe(true);
    expect(queued.result).toEqual(
      expect.objectContaining({
        status: 'queued',
        nodeId: 'desktop-node',
        capabilityId: 'files.read',
        action: 'inspect',
      }),
    );
    expect(services.liveNodeRegistry.buildSnapshot()).toEqual(
      expect.objectContaining({
        recentEvents: expect.arrayContaining([
          expect.objectContaining({
            type: 'node.invocation.queued',
            payload: expect.objectContaining({
              nodeId: 'desktop-node',
              capabilityId: 'files.read',
              action: 'inspect',
            }),
          }),
        ]),
      }),
    );
  });

  it('keeps malformed payloads out of node invocation', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-nodes-tool-invalid-'));
    tempDirs.push(root);
    const tool = new NodeMeshTool(createServices(root));

    const result = JSON.parse(await tool.execute({
      action: 'invoke',
      nodeId: 'desktop-node',
      capabilityId: 'files.read',
      nodeAction: 'inspect',
      payloadJson: '{not-json',
    }));

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining('Invalid payloadJson'),
      }),
    );
  });
});
