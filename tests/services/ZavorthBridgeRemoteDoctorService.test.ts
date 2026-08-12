import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthBridgeRemoteDoctorService } from '../../src/services/ZavorthBridgeRemoteDoctorService';

describe('ZavorthBridgeRemoteDoctorService', () => {
  it('returns a diagnostic report without repair when repair is not requested', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-zavorth-bridge-doctor-'));
    try {
      const reportFilePath = path.join(root, 'doctor-report.json');
      const historyFilePath = path.join(root, 'doctor-history.json');
      const initialStatus = {
        checkedAt: '2026-03-29T12:00:00.000Z',
        sidecar: null,
        sidecarHealth: {
          ok: false,
          healthUrl: 'http://127.0.0.1:4747/health',
        },
        bridge: {
          online: false,
          instanceId: null,
          processId: null,
          pendingHandoffs: null,
          lastSyncedHandoff: null,
          capabilities: [],
        },
        remoteMode: {
          active: false,
          changed: false,
          message: 'Modo remoto inativo.',
        },
        session: {
          accessible: true,
          lockedLikely: false,
          desktopName: 'Default',
          message: 'Sessao acessivel.',
        },
        access: {
          localUrl: null,
          baseUrl: 'http://127.0.0.1:4747',
          protectedByPassword: true,
          readyForRemoteUse: false,
          recommendations: ['Suba o sidecar remoto do ZavorthBridge antes de tentar acesso externo.'],
        },
        summary: 'sidecar incompleto | bridge offline | modo remoto inativo | sessao ok | sem url local',
      };

      const service = new ZavorthBridgeRemoteDoctorService({
        nativeService: {
          getStatus: jest.fn().mockResolvedValue(initialStatus),
        } as any,
        sidecarService: {
          start: jest.fn(),
        } as any,
        remoteModeManager: {
          activate: jest.fn(),
        } as any,
        appLauncher: {
          launch: jest.fn(),
        } as any,
        reportFilePath,
        historyFilePath,
      });

      const report = await service.run(false);

      expect(report.repairRequested).toBe(false);
      expect(report.initialStatus).toEqual(initialStatus);
      expect(report.finalStatus).toEqual(initialStatus);
      expect(report.actions).toEqual([]);
      expect(report.readyBefore).toBe(false);
      expect(report.readyAfter).toBe(false);
      expect(report.initialIncidents.primaryCode).toBe('bridge_offline');
      expect(report.finalIncidents.primaryCode).toBe('bridge_offline');
      expect(report.repairPolicy.cooldownActive).toBe(false);
      expect(report.forceRepair).toBe(false);
      expect(report.playbook.title).toContain('Bridge');
      expect(report.summary).toContain('Diagnosis complete');

      const persisted = JSON.parse(fs.readFileSync(reportFilePath, 'utf8'));
      expect(persisted.repairRequested).toBe(false);
      expect(persisted.readyAfter).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('repairs sidecar and remote mode when safe automatic actions are available', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-zavorth-bridge-doctor-'));
    try {
      const reportFilePath = path.join(root, 'doctor-report.json');
      const historyFilePath = path.join(root, 'doctor-history.json');
      const initialStatus = {
        checkedAt: '2026-03-29T12:00:00.000Z',
        sidecar: null,
        sidecarHealth: {
          ok: false,
          healthUrl: 'http://127.0.0.1:4747/health',
        },
        bridge: {
          online: false,
          instanceId: 'bridge-1',
          processId: 4242,
          pendingHandoffs: 0,
          lastSyncedHandoff: null,
          capabilities: ['canStartNewConversation'],
        },
        remoteMode: {
          active: false,
          changed: false,
          message: 'Modo remoto inativo.',
        },
        session: {
          accessible: true,
          lockedLikely: false,
          desktopName: 'Default',
          message: 'Sessao acessivel.',
        },
        access: {
          localUrl: null,
          baseUrl: 'http://127.0.0.1:4747',
          protectedByPassword: true,
          readyForRemoteUse: false,
          recommendations: [
            'Suba o sidecar remoto do ZavorthBridge antes de tentar acesso externo.',
            'Ative o modo remoto antes de usar o ZavorthBridge fora da sessao local.',
          ],
        },
        summary: 'sidecar incompleto | bridge online | modo remoto inativo | sessao ok | sem url local',
      };
      const finalStatus = {
        ...initialStatus,
        checkedAt: '2026-03-29T12:01:00.000Z',
        sidecar: {
          enabled: true,
          running: true,
          ready: true,
          spawnedByZavorth: true,
          pid: 5151,
          sourceDir: 'C:/vendors/omni-zavorthBridge',
          baseUrl: 'http://127.0.0.1:4747',
          localUrl: 'http://192.168.0.10:4747',
          checkedAt: '2026-03-29T12:01:00.000Z',
          message: 'ok',
        },
        sidecarHealth: {
          ok: true,
          healthUrl: 'http://127.0.0.1:4747/health',
        },
        remoteMode: {
          active: true,
          changed: true,
          message: 'Modo remoto ativo.',
        },
        access: {
          localUrl: 'http://192.168.0.10:4747',
          baseUrl: 'http://127.0.0.1:4747',
          protectedByPassword: true,
          readyForRemoteUse: true,
          recommendations: ['Mantenha a senha do remoto guardada; o status mostra a URL, mas nao expoe o segredo.'],
        },
        summary: 'sidecar pronto | bridge online | modo remoto ok | sessao ok | url local http://192.168.0.10:4747',
      };

      const getStatus = jest
        .fn()
        .mockResolvedValueOnce(initialStatus)
        .mockResolvedValueOnce(finalStatus);
      const sidecarStart = jest.fn().mockResolvedValue({
        ready: true,
        running: true,
        message: 'Zavorth Remote Terminal Sidecar iniciado pelo Zavorth.',
      });
      const activate = jest.fn().mockResolvedValue({
        ok: true,
        active: true,
        changed: true,
        message: 'Modo remoto ativo.',
      });
      const launch = jest.fn().mockResolvedValue({
        ok: true,
        pid: 9292,
        message: 'ZavorthBridge enviado para background no modo de depuracao remota.',
      });

      const service = new ZavorthBridgeRemoteDoctorService({
        nativeService: {
          getStatus,
        } as any,
        sidecarService: {
          start: sidecarStart,
        } as any,
        remoteModeManager: {
          activate,
        } as any,
        appLauncher: {
          launch,
        } as any,
        reportFilePath,
        historyFilePath,
      });

      const report = await service.run(true);

      expect(launch).toHaveBeenCalledTimes(1);
      expect(sidecarStart).toHaveBeenCalledTimes(1);
      expect(activate).toHaveBeenCalledTimes(1);
      expect(report.readyBefore).toBe(false);
      expect(report.readyAfter).toBe(true);
      expect(report.repaired).toBe(true);
      expect(report.repairPolicy.cooldownActive).toBe(false);
      expect(report.playbook.title).toContain('saudavel');
      expect(report.actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'launch-zavorth-bridge-app',
            ok: true,
          }),
          expect.objectContaining({
            key: 'start-sidecar',
            ok: true,
          }),
          expect.objectContaining({
            key: 'activate-remote-mode',
            ok: true,
          }),
        ]),
      );
      expect(report.summary).toContain('became ready');

      const persisted = JSON.parse(fs.readFileSync(reportFilePath, 'utf8'));
      expect(persisted.repaired).toBe(true);
      expect(persisted.finalStatus.access.readyForRemoteUse).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('suppresses automatic repair when cooldown is active after recent repeated failure', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-zavorth-bridge-doctor-'));
    try {
      const reportFilePath = path.join(root, 'doctor-report.json');
      const historyFilePath = path.join(root, 'doctor-history.json');
      fs.writeFileSync(
        historyFilePath,
        JSON.stringify([
          {
            checkedAt: new Date().toISOString(),
            repairRequested: true,
            readyBefore: false,
            readyAfter: false,
            repaired: false,
            summary: 'falhou',
            actions: [],
            remainingRecommendations: [],
            sidecarReady: true,
            sidecarHealthOk: true,
            bridgeOnline: true,
            remoteModeActive: false,
            sessionAccessible: true,
            incidentSeverity: 'warning',
            primaryIncidentCode: 'remote_mode_inactive',
          },
        ]),
        'utf8',
      );

      const initialStatus = {
        checkedAt: '2026-03-29T12:00:00.000Z',
        sidecar: {
          enabled: true,
          running: true,
          ready: true,
          spawnedByZavorth: false,
          pid: null,
          sourceDir: null,
          baseUrl: 'http://127.0.0.1:4747',
          localUrl: 'http://192.168.0.10:4747',
          checkedAt: '2026-03-29T12:00:00.000Z',
          message: 'ok',
        },
        sidecarHealth: {
          ok: true,
          healthUrl: 'http://127.0.0.1:4747/health',
        },
        bridge: {
          online: true,
          instanceId: 'bridge-1',
          processId: 4242,
          pendingHandoffs: 0,
          lastSyncedHandoff: null,
          capabilities: ['canStartNewConversation'],
        },
        remoteMode: {
          active: false,
          changed: false,
          message: 'Modo remoto inativo.',
        },
        session: {
          accessible: true,
          lockedLikely: false,
          desktopName: 'Default',
          message: 'Sessao acessivel.',
        },
        access: {
          localUrl: 'http://192.168.0.10:4747',
          baseUrl: 'http://127.0.0.1:4747',
          protectedByPassword: true,
          readyForRemoteUse: false,
          recommendations: ['Ative o modo remoto antes de usar o ZavorthBridge fora da sessao local.'],
        },
        summary: 'modo remoto inativo',
      };

      const activate = jest.fn();
      const service = new ZavorthBridgeRemoteDoctorService({
        nativeService: {
          getStatus: jest.fn().mockResolvedValue(initialStatus),
        } as any,
        sidecarService: {
          start: jest.fn(),
        } as any,
        remoteModeManager: {
          activate,
        } as any,
        appLauncher: {
          launch: jest.fn(),
        } as any,
        reportFilePath,
        historyFilePath,
      });

      const report = await service.run(true);

      expect(activate).not.toHaveBeenCalled();
      expect(report.repairPolicy.cooldownActive).toBe(true);
      expect(report.actions).toEqual([]);
      expect(report.summary).toContain('Cooldown ativo');
      expect(report.playbook.retryGuidance).toContain('Cooldown ativo');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('allows a forced repair attempt even when cooldown is active', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-zavorth-bridge-doctor-'));
    try {
      const reportFilePath = path.join(root, 'doctor-report.json');
      const historyFilePath = path.join(root, 'doctor-history.json');
      fs.writeFileSync(
        historyFilePath,
        JSON.stringify([
          {
            checkedAt: new Date().toISOString(),
            repairRequested: true,
            readyBefore: false,
            readyAfter: false,
            repaired: false,
            summary: 'falhou',
            actions: [],
            remainingRecommendations: [],
            sidecarReady: true,
            sidecarHealthOk: true,
            bridgeOnline: true,
            remoteModeActive: false,
            sessionAccessible: true,
            incidentSeverity: 'warning',
            primaryIncidentCode: 'remote_mode_inactive',
          },
        ]),
        'utf8',
      );

      const initialStatus = {
        checkedAt: '2026-03-29T12:00:00.000Z',
        sidecar: {
          enabled: true,
          running: true,
          ready: true,
          spawnedByZavorth: false,
          pid: null,
          sourceDir: null,
          baseUrl: 'http://127.0.0.1:4747',
          localUrl: 'http://192.168.0.10:4747',
          checkedAt: '2026-03-29T12:00:00.000Z',
          message: 'ok',
        },
        sidecarHealth: { ok: true, healthUrl: 'http://127.0.0.1:4747/health' },
        bridge: {
          online: true,
          instanceId: 'bridge-1',
          processId: 4242,
          pendingHandoffs: 0,
          lastSyncedHandoff: null,
          capabilities: ['canStartNewConversation'],
        },
        remoteMode: { active: false, changed: false, message: 'Modo remoto inativo.' },
        session: { accessible: true, lockedLikely: false, desktopName: 'Default', message: 'Sessao acessivel.' },
        access: {
          localUrl: 'http://192.168.0.10:4747',
          baseUrl: 'http://127.0.0.1:4747',
          protectedByPassword: true,
          readyForRemoteUse: false,
          recommendations: ['Ative o modo remoto.'],
        },
        summary: 'modo remoto inativo',
      };
      const finalStatus = {
        ...initialStatus,
        remoteMode: { active: true, changed: true, message: 'Modo remoto ativo.' },
        access: {
          ...initialStatus.access,
          readyForRemoteUse: true,
          recommendations: [],
        },
      };

      const activate = jest.fn().mockResolvedValue({
        ok: true,
        active: true,
        changed: true,
        message: 'Modo remoto ativo.',
      });
      const service = new ZavorthBridgeRemoteDoctorService({
        nativeService: {
          getStatus: jest.fn().mockResolvedValueOnce(initialStatus).mockResolvedValueOnce(finalStatus),
        } as any,
        sidecarService: {
          start: jest.fn(),
        } as any,
        remoteModeManager: {
          activate,
        } as any,
        appLauncher: {
          launch: jest.fn(),
        } as any,
        reportFilePath,
        historyFilePath,
      });

      const report = await service.run(true, true);

      expect(activate).toHaveBeenCalledTimes(1);
      expect(report.forceRepair).toBe(true);
      expect(report.readyAfter).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
