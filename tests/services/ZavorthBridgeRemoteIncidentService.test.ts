import { ZavorthBridgeRemoteIncidentService } from '../../src/services/ZavorthBridgeRemoteIncidentService';

describe('ZavorthBridgeRemoteIncidentService', () => {
  it('classifies healthy remote status as info without repair actions', () => {
    const service = new ZavorthBridgeRemoteIncidentService();
    const result = service.classify({
      checkedAt: '2026-03-29T12:00:00.000Z',
      sidecar: {
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
      sidecarHealth: { ok: true, healthUrl: 'http://127.0.0.1:4747/health' },
      bridge: {
        online: true,
        instanceId: 'bridge-1',
        processId: 31337,
        pendingHandoffs: 0,
        lastSyncedHandoff: null,
        capabilities: ['canStartNewConversation'],
      },
      remoteMode: { active: true, changed: false, message: 'active' },
      session: { accessible: true, lockedLikely: false, desktopName: 'Default', message: 'ok' },
      access: {
        localUrl: 'http://192.168.0.10:4747',
        baseUrl: 'http://127.0.0.1:4747',
        protectedByPassword: true,
        readyForRemoteUse: true,
        recommendations: [],
      },
      summary: 'ready',
    });

    expect(result.primaryCode).toBe('healthy');
    expect(result.severity).toBe('info');
    expect(result.autoRepairableActions).toEqual([]);
  });

  it('classifies blocked remote status and proposes safe automatic actions', () => {
    const service = new ZavorthBridgeRemoteIncidentService();
    const result = service.classify({
      checkedAt: '2026-03-29T12:00:00.000Z',
      sidecar: null,
      sidecarHealth: { ok: false, healthUrl: 'http://127.0.0.1:4747/health' },
      bridge: {
        online: false,
        instanceId: null,
        processId: null,
        pendingHandoffs: null,
        lastSyncedHandoff: null,
        capabilities: [],
      },
      remoteMode: { active: false, changed: false, message: 'inactive' },
      session: { accessible: true, lockedLikely: false, desktopName: 'Default', message: 'ok' },
      access: {
        localUrl: null,
        baseUrl: 'http://127.0.0.1:4747',
        protectedByPassword: true,
        readyForRemoteUse: false,
        recommendations: ['pending items'],
      },
      summary: 'incompleto',
    });

    expect(result.primaryCode).toBe('bridge_offline');
    expect(result.severity).toBe('error');
    expect(result.codes).toEqual(
      expect.arrayContaining([
        'bridge_offline',
        'sidecar_http_unhealthy',
        'sidecar_unready',
        'remote_mode_inactive',
      ]),
    );
    expect(result.autoRepairableActions).toEqual(
      expect.arrayContaining([
        'launch-zavorth-bridge-app',
        'start-sidecar',
        'activate-remote-mode',
      ]),
    );
  });
});
