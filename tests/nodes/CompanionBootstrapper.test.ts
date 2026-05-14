import fs from 'fs';
import os from 'os';
import path from 'path';
import { CompanionBootstrapper } from '../../src/nodes/companion/CompanionBootstrapper.js';

describe('CompanionBootstrapper', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('publishes heartbeat results after executing assignments in once mode', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-companion-'));
    tempDirs.push(root);
    const stateFile = path.join(root, 'companion-state.json');
    const fetchImpl = jest.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      if (!Array.isArray(body.results) || body.results.length === 0) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            heartbeat: {
              heartbeatIntervalMs: 7000,
              assignments: [
                {
                  id: 'inv-1',
                  capabilityId: 'clipboard.read',
                  action: 'invoke',
                  payload: { mode: 'text' },
                },
              ],
            },
          }),
        };
      }

      expect(body.results).toEqual([
        expect.objectContaining({
          invocationId: 'inv-1',
          ok: true,
        }),
      ]);

      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          heartbeat: {
            heartbeatIntervalMs: 7000,
            assignments: [],
          },
        }),
      };
    });

    const executeAssignment = jest.fn(async (assignment: { id: string }) => ({
      invocationId: assignment.id,
      ok: true,
      resultSummary: 'clipboard entregue',
      data: {
        content: 'hello',
      },
    }));

    const bootstrapper = new CompanionBootstrapper({
      once: true,
      workspaceRoot: root,
      stateFile,
      fetchImpl,
      capabilityService: {
        executeAssignment,
      } as any,
      pairingManager: {
        readCredentials: jest.fn(async () => ({
          nodeId: 'desktop-a',
          sharedSecret: 'sec_live_123',
          pairedAt: '2026-04-08T18:05:00.000Z',
          baseUrl: 'http://127.0.0.1:33333',
          heartbeatIntervalMs: 7000,
          capabilityIds: ['clipboard.read'],
          workspace: root,
          surface: 'desktop-companion',
          stateFile,
        })),
      } as any,
    });

    await bootstrapper.startCompanion();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(executeAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'inv-1',
        capabilityId: 'clipboard.read',
      }),
    );
    const persisted = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    expect(persisted).toEqual({ pendingResults: [] });
  });

  it('advertises the local allowlist and blocks assignments outside the approved capabilities', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-companion-policy-'));
    tempDirs.push(root);
    const stateFile = path.join(root, 'companion-state.json');
    const heartbeatBodies: any[] = [];
    const fetchImpl = jest.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      heartbeatBodies.push(body);

      if (heartbeatBodies.length === 1) {
        expect(body.capabilityIds).toEqual(['clipboard.read']);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            heartbeat: {
              heartbeatIntervalMs: 7000,
              assignments: [
                {
                  id: 'inv-blocked',
                  capabilityId: 'screen.capture',
                  action: 'invoke',
                  payload: { target: 'primary' },
                },
              ],
            },
          }),
        };
      }

      expect(body.results).toEqual([
        expect.objectContaining({
          invocationId: 'inv-blocked',
          ok: false,
          stderr: 'capability blocked locally: screen.capture',
        }),
      ]);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          heartbeat: {
            heartbeatIntervalMs: 7000,
            assignments: [],
          },
        }),
      };
    });

    const executeAssignment = jest.fn(async () => ({
      invocationId: 'should-not-run',
      ok: true,
      resultSummary: 'unexpected',
      data: null,
    }));

    const bootstrapper = new CompanionBootstrapper({
      once: true,
      workspaceRoot: root,
      stateFile,
      fetchImpl,
      capabilityService: {
        executeAssignment,
      } as any,
      pairingManager: {
        readCredentials: jest.fn(async () => ({
          nodeId: 'desktop-a',
          sharedSecret: 'sec_live_123',
          pairedAt: '2026-04-08T18:05:00.000Z',
          baseUrl: 'http://127.0.0.1:33333',
          heartbeatIntervalMs: 7000,
          capabilityIds: ['clipboard.read', 'screen.capture'],
          approvedCapabilityIds: ['clipboard.read'],
          workspace: root,
          surface: 'desktop-companion',
          stateFile,
        })),
      } as any,
    });

    await bootstrapper.startCompanion();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(executeAssignment).not.toHaveBeenCalled();
    const persistedPolicy = JSON.parse(
      fs.readFileSync(path.join(root, '.zavorth', 'device-capability-policy.json'), 'utf8'),
    );
    expect(persistedPolicy.policies['desktop-a']).toEqual(expect.objectContaining({
      allowedCapabilities: ['clipboard.read'],
    }));
  });
});
