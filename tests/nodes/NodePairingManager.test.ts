import fs from 'fs';
import os from 'os';
import path from 'path';
import { NodePairingManager } from '../../src/nodes/pairing/NodePairingManager.js';

describe('NodePairingManager', () => {
  const tempDirs: string[] = [];
  const originalCwd = process.cwd();

  afterEach(() => {
    process.chdir(originalCwd);
    jest.restoreAllMocks();
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('claims pairing against the real Node Mesh transport contract and persists credentials', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-pairing-'));
    tempDirs.push(root);
    const fetchImpl = jest.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      expect(body.nodeId).toBe('desktop-a');
      expect(body.pairingCode).toBe('PAIR123');
      expect(body.capabilityIds).toEqual(['clipboard.read']);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          claim: {
            claimedAt: '2026-04-08T18:00:00.000Z',
            sharedSecret: 'sec_live_123',
            heartbeatIntervalMs: 9000,
          },
        }),
      };
    });

    const manager = new NodePairingManager({
      configDir: root,
      baseUrl: 'http://127.0.0.1:33333',
      nodeId: 'desktop-a',
      capabilityIds: ['clipboard.read'],
      fetchImpl,
      now: () => new Date('2026-04-08T18:00:00.000Z'),
    });

    const credentials = await manager.initiatePairing('desktop-a:PAIR123');
    const persisted = await manager.readCredentials();
    const persistedPolicy = JSON.parse(fs.readFileSync(path.join(root, 'device-capability-policy.json'), 'utf8'));

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:33333/api/node-mesh/pairing/claim',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(credentials).toEqual(
      expect.objectContaining({
        nodeId: 'desktop-a',
        sharedSecret: 'sec_live_123',
        heartbeatIntervalMs: 9000,
        capabilityIds: ['clipboard.read'],
      }),
    );
    expect(persisted).toEqual(expect.objectContaining({
      nodeId: 'desktop-a',
      sharedSecret: 'sec_live_123',
    }));
    expect(persistedPolicy.policies['desktop-a']).toEqual(expect.objectContaining({
      nodeId: 'desktop-a',
      allowedCapabilities: ['clipboard.read'],
      source: 'pairing-credentials',
    }));
  });

  it('reads canonical .zavorth node credentials for default config', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-pairing-canonical-'));
    tempDirs.push(root);
    process.chdir(root);
    const canonicalDir = path.join(root, '.zavorth');
    const canonicalCredentialsFile = path.join(canonicalDir, 'node_credentials.json');
    fs.mkdirSync(canonicalDir, { recursive: true });
    fs.writeFileSync(
      canonicalCredentialsFile,
      `${JSON.stringify({
        nodeId: 'desktop-canonical',
        sharedSecret: 'sec_canonical',
        pairedAt: '2026-04-08T18:00:00.000Z',
        baseUrl: 'http://127.0.0.1:33333',
      }, null, 2)}\n`,
      'utf8',
    );

    const manager = new NodePairingManager();
    const credentials = await manager.readCredentials();

    expect(fs.existsSync(canonicalCredentialsFile)).toBe(true);
    expect(credentials).toEqual(expect.objectContaining({
      nodeId: 'desktop-canonical',
      sharedSecret: 'sec_canonical',
    }));
  });

  it('blocks unsafe pairing targets before the outbound request', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-pairing-ssrf-'));
    tempDirs.push(root);
    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, claim: { sharedSecret: 'should-not-there isppen' } }),
    } as any);
    const manager = new NodePairingManager({
      configDir: root,
      baseUrl: 'http://169.254.169.254',
      nodeId: 'desktop-a',
    });

    await expect(manager.initiatePairing('desktop-a:PAIR123')).rejects.toThrow('private or loopback');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
