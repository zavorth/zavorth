import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { ZavorthBridgeMobileAccessService } from '../../src/services/ZavorthBridgeMobileAccessService.js';
import { ZavorthBridgeAccessLeaseService } from '../../src/services/ZavorthBridgeAccessLeaseService.js';
import { ZavorthBridgeTunnelBrokerService } from '../../src/services/ZavorthBridgeTunnelBrokerService.js';

describe('ZavorthBridgeMobileAccessService', () => {
  const tempDirs: string[] = [];
  const originalPassword = config.ZavorthTerminalAppPassword;

  afterEach(() => {
    config.ZavorthTerminalAppPassword = originalPassword;
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('starts a mobile lease using the public ZavorthBridge URL when the doctor leaves the remote ready', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ag-mobile-'));
    tempDirs.push(root);
    config.ZavorthTerminalAppPassword = 'mobile-secret';

    const leaseService = new ZavorthBridgeAccessLeaseService({
      leaseFile: path.join(root, 'lease.json'),
      historyFile: path.join(root, 'lease-history.jsonl'),
      ttlMs: 60_000,
    });
    const service = new ZavorthBridgeMobileAccessService({
      leaseService,
      tunnelBroker: new ZavorthBridgeTunnelBrokerService({
        publicUrl: 'https://ag.example.com',
      }),
      verificationService: {
        verify: jest.fn(async () => ({
          checkedAt: '2026-04-05T12:00:00.000Z',
          targetUrl: 'https://ag.example.com',
          route: 'root',
          ok: true,
          httpStatus: 200,
          summary: 'URL final validada com HTTP 200 na rota principal.',
          error: null,
        })),
      } as any,
      publicTunnelService: {
        ensureStarted: jest.fn(async () => ({
          started: false,
          ready: false,
          running: false,
          publicUrl: null,
        })),
        stop: jest.fn(async () => undefined),
      } as any,
      doctorService: {
        run: jest.fn(async () => ({
          summary: 'Doctor concluiu e deixou o remoto pronto.',
          playbook: {
            manualSteps: [],
          },
          initialStatus: {
            sidecar: { ready: false },
            remoteMode: { active: false },
          },
          finalStatus: {
            sidecar: { ready: true },
            remoteMode: { active: true },
            access: {
              readyForRemoteUse: true,
              protectedByPassword: true,
              recommendations: [],
              baseUrl: 'http://127.0.0.1:4747',
              localUrl: 'http://192.168.0.20:4747',
            },
          },
        })),
      } as any,
    });

    const result = await service.start({ requestedBy: 'operator-1' });

    expect(result.ok).toBe(true);
    expect(result.state).toBe('active');
    expect(result.mode).toBe('public');
    expect(result.accessUrl).toBe('https://ag.example.com');
    expect(result.verification?.ok).toBe(true);
    expect(result.secret).toBe('mobile-secret');
    expect(result.lease.active).toBe(true);
    expect(result.lease.requestedBy).toBe('operator-1');
  });

  it('returns a blocked result when the remote still is not ready after repair', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ag-mobile-blocked-'));
    tempDirs.push(root);

    const leaseService = new ZavorthBridgeAccessLeaseService({
      leaseFile: path.join(root, 'lease.json'),
      historyFile: path.join(root, 'lease-history.jsonl'),
    });
    const service = new ZavorthBridgeMobileAccessService({
      leaseService,
      verificationService: {
        verify: jest.fn(),
      } as any,
      publicTunnelService: {
        ensureStarted: jest.fn(async () => ({
          started: false,
          ready: false,
          running: false,
          publicUrl: null,
        })),
        stop: jest.fn(async () => undefined),
      } as any,
      doctorService: {
        run: jest.fn(async () => ({
          summary: 'Ainda existem pendencias no remoto.',
          playbook: {
            manualSteps: ['Desbloqueie a sessao do Windows.'],
          },
          initialStatus: {
            sidecar: { ready: false },
            remoteMode: { active: false },
          },
          finalStatus: {
            sidecar: { ready: false },
            remoteMode: { active: false },
            access: {
              readyForRemoteUse: false,
              protectedByPassword: false,
              recommendations: ['Suba o sidecar remoto do ZavorthBridge antes de tentar acesso externo.'],
              baseUrl: 'http://127.0.0.1:4747',
              localUrl: null,
            },
          },
        })),
      } as any,
    });

    const result = await service.start();

    expect(result.ok).toBe(false);
    expect(result.state).toBe('blocked');
    expect(result.guide.steps).toContain('Desbloqueie a sessao do Windows.');
  });

  it('stops the mobile lease and restores the runtime state owned by the lease', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ag-mobile-stop-'));
    tempDirs.push(root);

    const leaseService = new ZavorthBridgeAccessLeaseService({
      leaseFile: path.join(root, 'lease.json'),
      historyFile: path.join(root, 'lease-history.jsonl'),
    });
    leaseService.issue({
      requestedBy: 'operator-1',
      mode: 'lan',
      accessUrl: 'http://192.168.0.20:4747',
      localUrl: 'http://192.168.0.20:4747',
      baseUrl: 'http://127.0.0.1:4747',
      requiresPassword: false,
      startedSidecar: true,
      activatedRemoteMode: true,
      startedPublicTunnel: true,
    });

    const stopSidecar = jest.fn(async () => undefined);
    const restoreRemoteMode = jest.fn(async () => ({ ok: true, active: false, changed: true, message: 'restored' }));
    const stopPublicTunnel = jest.fn(async () => undefined);
    const service = new ZavorthBridgeMobileAccessService({
      leaseService,
      sidecarService: {
        stop: stopSidecar,
      } as any,
      verificationService: {
        verify: jest.fn(),
      } as any,
      publicTunnelService: {
        ensureStarted: jest.fn(),
        stop: stopPublicTunnel,
      } as any,
      remoteModeManager: {
        restore: restoreRemoteMode,
      } as any,
      nativeService: {
        getStatus: jest.fn(async () => ({
          access: {
            readyForRemoteUse: false,
            protectedByPassword: false,
            recommendations: ['Rode /agmobile start para reabrir o acesso.'],
            baseUrl: 'http://127.0.0.1:4747',
            localUrl: 'http://192.168.0.20:4747',
          },
        })),
      } as any,
      tunnelBroker: new ZavorthBridgeTunnelBrokerService(),
    });

    const result = await service.stop({ requestedBy: 'operator-1' });

    expect(stopSidecar).toHaveBeenCalled();
    expect(stopPublicTunnel).toHaveBeenCalled();
    expect(restoreRemoteMode).toHaveBeenCalled();
    expect(result.state).toBe('stopped');
    expect(result.lease.active).toBe(false);
    expect(result.lease.status).toBe('revoked');
  });

  it('starts the public tunnel automatically when the remote is ready and no explicit public URL exists', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ag-mobile-tunnel-'));
    tempDirs.push(root);

    const leaseService = new ZavorthBridgeAccessLeaseService({
      leaseFile: path.join(root, 'lease.json'),
      historyFile: path.join(root, 'lease-history.jsonl'),
      ttlMs: 60_000,
    });
    const ensureStarted = jest.fn(async () => ({
      started: true,
      enabled: true,
      running: true,
      ready: true,
      pid: 4201,
      tunnelPid: 4202,
      cliPath: 'cloudflared',
      hostScriptPath: 'C:/repo/scripts/zavorth-bridge-public-tunnel-host.mjs',
      publicUrl: 'https://ag-public.trycloudflare.com',
      targetUrl: 'http://127.0.0.1:4747',
      checkedAt: '2026-04-05T12:00:00.000Z',
      message: 'Tunel pronto.',
      stateFile: path.join(root, 'ag-tunnel.json'),
      logFile: path.join(root, 'ag-tunnel.log'),
    }));
    const service = new ZavorthBridgeMobileAccessService({
      leaseService,
      verificationService: {
        verify: jest.fn(async () => ({
          checkedAt: '2026-04-05T12:00:01.000Z',
          targetUrl: 'https://ag-public.trycloudflare.com',
          route: 'root',
          ok: true,
          httpStatus: 200,
          summary: 'URL final validada com HTTP 200 na rota principal.',
          error: null,
        })),
      } as any,
      publicTunnelService: {
        ensureStarted,
        stop: jest.fn(async () => undefined),
      } as any,
      tunnelBroker: new ZavorthBridgeTunnelBrokerService({
        publicTunnelService: {
          readStatus: jest.fn(() => ({
            enabled: true,
            running: true,
            ready: true,
            pid: 4201,
            tunnelPid: 4202,
            cliPath: 'cloudflared',
            hostScriptPath: 'C:/repo/scripts/zavorth-bridge-public-tunnel-host.mjs',
            publicUrl: 'https://ag-public.trycloudflare.com',
            targetUrl: 'http://127.0.0.1:4747',
            checkedAt: '2026-04-05T12:00:00.000Z',
            message: 'Tunel pronto.',
            stateFile: path.join(root, 'ag-tunnel.json'),
            logFile: path.join(root, 'ag-tunnel.log'),
          })),
        } as any,
      }),
      doctorService: {
        run: jest.fn(async () => ({
          summary: 'Doctor concluiu e deixou o remoto pronto.',
          playbook: { manualSteps: [] },
          initialStatus: {
            sidecar: { ready: true },
            remoteMode: { active: true },
          },
          finalStatus: {
            sidecar: { ready: true },
            remoteMode: { active: true },
            access: {
              readyForRemoteUse: true,
              protectedByPassword: false,
              recommendations: [],
              baseUrl: 'http://127.0.0.1:4747',
              localUrl: 'http://192.168.0.20:4747',
            },
          },
        })),
      } as any,
    });

    const result = await service.start({ requestedBy: 'operator-2' });

    expect(ensureStarted).toHaveBeenCalledWith({
      targetUrl: 'http://127.0.0.1:4747',
    });
    expect(result.mode).toBe('public');
    expect(result.accessUrl).toBe('https://ag-public.trycloudflare.com');
    expect(result.lease.startedPublicTunnel).toBe(true);
    expect(result.verification?.ok).toBe(true);
  });
});
