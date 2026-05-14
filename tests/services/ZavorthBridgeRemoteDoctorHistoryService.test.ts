import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthBridgeRemoteDoctorHistoryService } from '../../src/services/ZavorthBridgeRemoteDoctorHistoryService';

describe('ZavorthBridgeRemoteDoctorHistoryService', () => {
  it('appends reports and summarizes recent doctor history', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-zavorth-bridge-doctor-history-'));
    try {
      const historyFilePath = path.join(root, 'doctor-history.json');
      const service = new ZavorthBridgeRemoteDoctorHistoryService();

      await service.appendReport(
        historyFilePath,
        {
          checkedAt: '2026-03-29T12:00:00.000Z',
          repairRequested: true,
          initialStatus: {
            checkedAt: '2026-03-29T12:00:00.000Z',
            sidecar: null,
            sidecarHealth: { ok: false, healthUrl: 'http://127.0.0.1:4747/health' },
            bridge: {
              online: true,
              instanceId: null,
              processId: null,
              pendingHandoffs: null,
              lastSyncedHandoff: null,
              capabilities: [],
            },
            remoteMode: { active: false, changed: false, message: 'inativo' },
            session: { accessible: true, lockedLikely: false, desktopName: 'Default', message: 'ok' },
            access: {
              localUrl: null,
              baseUrl: 'http://127.0.0.1:4747',
              protectedByPassword: true,
              readyForRemoteUse: false,
              recommendations: ['Suba o sidecar'],
            },
            summary: 'incompleto',
          },
          finalStatus: {
            checkedAt: '2026-03-29T12:01:00.000Z',
            sidecar: {
              enabled: true,
              running: true,
              ready: true,
              spawnedByZavorth: true,
              pid: 4242,
              sourceDir: 'C:/vendors/omni-zavorthBridge',
              baseUrl: 'http://127.0.0.1:4747',
              localUrl: 'http://192.168.0.10:4747',
              checkedAt: '2026-03-29T12:01:00.000Z',
              message: 'ok',
            },
            sidecarHealth: { ok: true, healthUrl: 'http://127.0.0.1:4747/health' },
            bridge: {
              online: true,
              instanceId: null,
              processId: null,
              pendingHandoffs: null,
              lastSyncedHandoff: null,
              capabilities: [],
            },
            remoteMode: { active: true, changed: true, message: 'ativo' },
            session: { accessible: true, lockedLikely: false, desktopName: 'Default', message: 'ok' },
            access: {
              localUrl: 'http://192.168.0.10:4747',
              baseUrl: 'http://127.0.0.1:4747',
              protectedByPassword: true,
              readyForRemoteUse: true,
              recommendations: [],
            },
            summary: 'pronto',
          },
          initialIncidents: {
            primaryCode: 'sidecar_http_unhealthy',
            severity: 'error',
            codes: ['sidecar_http_unhealthy', 'sidecar_unready', 'remote_mode_inactive'],
            autoRepairableActions: ['start-sidecar', 'activate-remote-mode'],
          },
          finalIncidents: {
            primaryCode: 'healthy',
            severity: 'info',
            codes: ['healthy'],
            autoRepairableActions: [],
          },
          repairPolicy: {
            cooldownActive: false,
            cooldownUntil: null,
            flappingLikely: false,
            matchingRecentFailures: 1,
            reason: null,
          },
          actions: [
            {
              key: 'start-sidecar',
              attempted: true,
              changed: true,
              ok: true,
              message: 'subiu',
            },
          ],
          readyBefore: false,
          readyAfter: true,
          repaired: true,
          remainingRecommendations: [],
          summary: 'Reparo automatico concluiu e o remoto do ZavorthBridge ficou pronto.',
        },
        10,
      );

      await service.appendReport(
        historyFilePath,
        {
          checkedAt: '2026-03-29T13:00:00.000Z',
          repairRequested: false,
          initialStatus: {
            checkedAt: '2026-03-29T13:00:00.000Z',
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
            remoteMode: { active: false, changed: false, message: 'inativo' },
            session: { accessible: true, lockedLikely: false, desktopName: 'Default', message: 'ok' },
            access: {
              localUrl: null,
              baseUrl: 'http://127.0.0.1:4747',
              protectedByPassword: true,
              readyForRemoteUse: false,
              recommendations: ['Verifique o remoto'],
            },
            summary: 'incompleto',
          },
          finalStatus: {
            checkedAt: '2026-03-29T13:00:00.000Z',
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
            remoteMode: { active: false, changed: false, message: 'inativo' },
            session: { accessible: true, lockedLikely: false, desktopName: 'Default', message: 'ok' },
            access: {
              localUrl: null,
              baseUrl: 'http://127.0.0.1:4747',
              protectedByPassword: true,
              readyForRemoteUse: false,
              recommendations: ['Verifique o remoto'],
            },
            summary: 'incompleto',
          },
          initialIncidents: {
            primaryCode: 'sidecar_http_unhealthy',
            severity: 'error',
            codes: ['sidecar_http_unhealthy', 'sidecar_unready', 'bridge_offline', 'remote_mode_inactive'],
            autoRepairableActions: ['launch-zavorth-bridge-app', 'start-sidecar', 'activate-remote-mode'],
          },
          finalIncidents: {
            primaryCode: 'sidecar_http_unhealthy',
            severity: 'error',
            codes: ['sidecar_http_unhealthy', 'sidecar_unready', 'bridge_offline', 'remote_mode_inactive'],
            autoRepairableActions: ['launch-zavorth-bridge-app', 'start-sidecar', 'activate-remote-mode'],
          },
          repairPolicy: {
            cooldownActive: false,
            cooldownUntil: null,
            flappingLikely: false,
            matchingRecentFailures: 1,
            reason: null,
          },
          actions: [],
          readyBefore: false,
          readyAfter: false,
          repaired: false,
          remainingRecommendations: ['Verifique o remoto'],
          summary: 'Diagnostico concluido; existem pendencias para o remoto do ZavorthBridge.',
        },
        10,
      );

      const history = service.readHistory(historyFilePath);
      const summary = service.summarize(history);

      expect(history).toHaveLength(2);
      expect(history[0].checkedAt).toBe('2026-03-29T13:00:00.000Z');
      expect(summary.totalRuns).toBe(2);
      expect(summary.repairedRuns).toBe(1);
      expect(summary.readyRuns).toBe(1);
      expect(summary.degradedRuns).toBe(1);
      expect(summary.latest?.readyAfter).toBe(false);
      expect(summary.latest?.primaryIncidentCode).toBe('sidecar_http_unhealthy');
      expect(summary.latest?.incidentSeverity).toBe('error');
      expect(summary.stability.dominantIncidentCode).toBe('sidecar_http_unhealthy');
      expect(summary.stability.flappingLikely).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('recommends cooldown when repeated repair failures happened recently', () => {
    const service = new ZavorthBridgeRemoteDoctorHistoryService();
    const history = [
      {
        checkedAt: '2026-03-29T13:08:00.000Z',
        repairRequested: true,
        readyBefore: false,
        readyAfter: false,
        repaired: false,
        summary: 'falhou',
        actions: [],
        remainingRecommendations: [],
        sidecarReady: true,
        sidecarHealthOk: false,
        bridgeOnline: true,
        remoteModeActive: false,
        sessionAccessible: true,
        incidentSeverity: 'warning' as const,
        primaryIncidentCode: 'remote_mode_inactive' as const,
      },
      {
        checkedAt: '2026-03-29T13:04:00.000Z',
        repairRequested: false,
        readyBefore: false,
        readyAfter: false,
        repaired: false,
        summary: 'falhou',
        actions: [],
        remainingRecommendations: [],
        sidecarReady: true,
        sidecarHealthOk: false,
        bridgeOnline: true,
        remoteModeActive: false,
        sessionAccessible: true,
        incidentSeverity: 'warning' as const,
        primaryIncidentCode: 'remote_mode_inactive' as const,
      },
      {
        checkedAt: '2026-03-29T13:00:00.000Z',
        repairRequested: false,
        readyBefore: false,
        readyAfter: false,
        repaired: false,
        summary: 'falhou',
        actions: [],
        remainingRecommendations: [],
        sidecarReady: true,
        sidecarHealthOk: false,
        bridgeOnline: true,
        remoteModeActive: false,
        sessionAccessible: true,
        incidentSeverity: 'warning' as const,
        primaryIncidentCode: 'remote_mode_inactive' as const,
      },
    ];

    const policy = service.recommendRepairPolicy(
      history,
      {
        primaryCode: 'remote_mode_inactive',
        severity: 'warning',
        codes: ['remote_mode_inactive'],
        autoRepairableActions: ['activate-remote-mode'],
      },
      {
        now: new Date('2026-03-29T13:10:00.000Z'),
        cooldownMinutes: 10,
        flappingWindowMinutes: 20,
        flappingThreshold: 3,
      },
    );

    expect(policy.cooldownActive).toBe(true);
    expect(policy.flappingLikely).toBe(true);
    expect(policy.matchingRecentFailures).toBe(3);
    expect(policy.reason).toContain('Cooldown ativo');
  });
});
