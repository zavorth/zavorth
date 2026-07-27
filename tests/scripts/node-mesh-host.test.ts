import fs from 'fs';
import os from 'os';
import path from 'path';
import { runNodeMeshHost } from '../../scripts/node-mesh-host.js';

describe('node-mesh-host script flow', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('flushes maintenance results on the second heartbeat in once mode', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-host-script-'));
    tempDirs.push(root);
    const stateFile = path.join(root, 'node-host-state.json');
    const apiPostImpl = jest.fn(async (_baseUrl: string, endpoint: string, _token: string | null, body: any) => {
      expect(endpoint).toBe('/api/node-mesh/heartbeat');
      if (apiPostImpl.mock.calls.length === 1) {
        expect(body.results).toEqual([]);
        return {
          heartbeat: {
            heartbeatIntervalMs: 1,
            assignments: [
              {
                id: 'invoke-maint-1',
                capabilityId: 'node.maintenance',
                action: 'repair',
                payload: null,
              },
            ],
          },
        };
      }

      expect(body.results).toEqual([
        expect.objectContaining({
          invocationId: 'invoke-maint-1',
          ok: true,
        }),
      ]);
      return {
        heartbeat: {
          heartbeatIntervalMs: 1,
          assignments: [],
        },
      };
    });
    const capabilityService = {
      executeAssignment: jest.fn(async () => ({
        invocationId: 'invoke-maint-1',
        ok: true,
        resultSummary: 'Repair completed.',
        stdout: null,
        stderr: null,
        exitCode: 0,
        data: {
          repairedAt: '2026-04-05T10:10:00.000Z',
        },
      })),
    };

    await runNodeMeshHost(
      {
        baseUrl: 'http://127.0.0.1:33333',
        token: 'smoke-token',
        nodeId: 'oracle-node',
        pairingCode: null,
        sharedSecret: 'shared-secret',
        capabilities: ['node.maintenance'],
        intervalMs: 1,
        once: true,
        workspace: root,
        surface: 'node-host',
        hostname: 'oracle-host',
        label: 'Oracle Node',
        stateFile,
      },
      {
        apiPostImpl,
        capabilityService: capabilityService as any,
        sleep: async () => undefined,
      },
    );

    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));

    expect(apiPostImpl).toHaveBeenCalledTimes(2);
    expect(capabilityService.executeAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        capabilityId: 'node.maintenance',
        action: 'repair',
      }),
    );
    expect(state.pendingResults).toEqual([]);
  });
});
