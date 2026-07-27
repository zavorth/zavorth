import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthBridgeRemoteNativeService } from '../../src/services/ZavorthBridgeRemoteNativeService';

describe('ZavorthBridgeRemoteNativeService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('combines sidecar, bridge, remote mode and session into one native remote status', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-zavorth-bridge-remote-'));
    try {
      const statusFile = path.join(root, 'omni-zavorth-bridge-remote-sidecar.json');
      fs.writeFileSync(
        statusFile,
        JSON.stringify(
          {
            enabled: true,
            running: true,
            ready: true,
            spawnedByZavorth: true,
            pid: 4242,
            sourceDir: 'C:/vendors/omni-zavorthBridge',
            baseUrl: 'http://127.0.0.1:4747',
            localUrl: 'http://192.168.0.10:4747',
            checkedAt: '2026-03-29T12:00:00.000Z',
            message: 'ok',
          },
          null,
          2,
        ),
        'utf8',
      );

      global.fetch = jest.fn().mockResolvedValue({ status: 200 }) as any;

      const service = new ZavorthBridgeRemoteNativeService({
        sidecarStatusFilePath: statusFile,
        sidecarBaseUrl: 'http://127.0.0.1:4747',
        bridge: {
          isOnline: jest.fn().mockResolvedValue(true),
          readStatus: jest.fn().mockResolvedValue({
            instanceId: 'ag-instance-1',
            processId: 31337,
            pendingHandoffs: 2,
            lastSyncedHandoff: 'handoff-42',
            capabilities: {
              canStartNewConversation: true,
              canOpenQuickSettings: true,
            },
          }),
        } as any,
        remoteModeManager: {
          status: jest.fn().mockResolvedValue({
            active: true,
            changed: false,
            message: 'Modo remoto active.',
          }),
        } as any,
        windowsSessionService: {
          status: jest.fn().mockResolvedValue({
            accessible: true,
            lockedLikely: false,
            desktopName: 'Default',
            message: 'Session accessible.',
          }),
        } as any,
      });

      const result = await service.getStatus();

      expect(result.sidecar?.ready).toBe(true);
      expect(result.sidecarHealth.ok).toBe(true);
      expect(result.bridge.online).toBe(true);
      expect(result.bridge.instanceId).toBe('ag-instance-1');
      expect(result.bridge.capabilities).toEqual([
        'canOpenQuickSettings',
        'canStartNewConversation',
      ]);
      expect(result.remoteMode.active).toBe(true);
      expect(result.session.accessible).toBe(true);
      expect(result.access.localUrl).toBe('http://192.168.0.10:4747');
      expect(result.access.readyForRemoteUse).toBe(true);
      expect(result.summary).toContain('sidecar ready');
      expect(result.summary).toContain('bridge online');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
