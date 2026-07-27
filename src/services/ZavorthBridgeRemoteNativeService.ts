import fs from 'fs';
import { config } from '../config/index.js';
import { ZavorthBridgeCompanionBridge } from '../agents/ZavorthBridgeCompanionBridge.js';
import type { TerminalSidecarSnapshot } from './TerminalSidecarService.js';
import { RemoteModeManager, type RemoteModeResult } from './RemoteModeManager.js';
import { WindowsSessionService, type WindowsSessionStatus } from './WindowsSessionService.js';
import { safeFetch } from '../security/SafeFetchService.js';
import { logger } from '../logger.js';

export type ZavorthBridgeRemoteNativeStatus = {
  checkedAt: string;
  sidecar: TerminalSidecarSnapshot | null;
  sidecarHealth: {
    ok: boolean;
    healthUrl: string;
  };
  bridge: {
    online: boolean;
    instanceId: string | null;
    processId: number | null;
    pendingHandoffs: number | null;
    lastSyncedHandoff: string | null;
    capabilities: string[];
  };
  remoteMode: {
    active: boolean | null;
    changed: boolean | null;
    message: string | null;
  };
  session: {
    accessible: boolean | null;
    lockedLikely: boolean | null;
    desktopName: string | null;
    message: string | null;
  };
  access: {
    localUrl: string | null;
    baseUrl: string;
    protectedByPassword: boolean;
    readyForRemoteUse: boolean;
    recommendations: string[];
  };
  summary: string;
};

type BridgeLike = Pick<ZavorthBridgeCompanionBridge, 'readStatus' | 'isOnline'>;
type RemoteModeLike = Pick<RemoteModeManager, 'status'>;
type SessionLike = Pick<WindowsSessionService, 'status'>;

type ZavorthBridgeRemoteNativeServiceOptions = {
  bridge?: BridgeLike;
  remoteModeManager?: RemoteModeLike;
  windowsSessionService?: SessionLike;
  sidecarStatusFilePath?: string;
  sidecarBaseUrl?: string;
};

export class ZavorthBridgeRemoteNativeService {
  private readonly bridge: BridgeLike;
  private readonly remoteModeManager: RemoteModeLike;
  private readonly windowsSessionService: SessionLike;
  private readonly sidecarStatusFilePath: string;
  private readonly sidecarBaseUrl: string;

  constructor(options: ZavorthBridgeRemoteNativeServiceOptions = {}) {
    this.bridge = options.bridge || new ZavorthBridgeCompanionBridge();
    this.remoteModeManager = options.remoteModeManager || new RemoteModeManager();
    this.windowsSessionService = options.windowsSessionService || new WindowsSessionService();
    this.sidecarStatusFilePath = options.sidecarStatusFilePath || config.ZavorthTerminalSidecarStatusFile;
    this.sidecarBaseUrl = options.sidecarBaseUrl || config.ZavorthTerminalBaseUrl;
  }

  public async getStatus(): Promise<ZavorthBridgeRemoteNativeStatus> {
    const [sidecar, sidecarHealth, bridgeStatus, remoteMode, session] = await Promise.all([
      this.readSidecarSnapshot(),
      this.isSidecarHealthy(),
      this.readBridgeStatus(),
      this.safeRemoteModeStatus(),
      this.safeSessionStatus(),
    ]);

    const capabilities = Object.entries(bridgeStatus?.capabilities || {})
      .filter(([, enabled]) => enabled === true)
      .map(([name]) => name)
      .sort((left, right) => left.localeCompare(right));

    const localUrl = sidecar?.localUrl || null;
    const protectedByPassword = Boolean(String(config.ZavorthTerminalAppPassword || '').trim());
    const readyForRemoteUse = Boolean(
      sidecar?.ready
      && sidecarHealth.ok
      && bridgeStatus?.online
      && remoteMode?.active !== false
      && session?.accessible !== false,
    );

    const recommendations: string[] = [];
    if (!sidecar?.ready) {
      recommendations.push('Start the ZavorthBridge remote sidecar before trying external access.');
    }
    if (!sidecarHealth.ok) {
      recommendations.push('Check the ZavorthBridge remote /health route and confirm that the HTTP server is responding.');
    }
    if (!bridgeStatus?.online) {
      recommendations.push('Open ZavorthBridge with the bridge active to expose status, handoffs, and native commands.');
    }
    if (remoteMode?.active === false) {
      recommendations.push('Enable remote mode before using ZavorthBridge outside the local session.');
    }
    if (session?.accessible === false) {
      recommendations.push('Unlock the Windows session to allow automation and ZavorthBridge window control.');
    }
    if (protectedByPassword) {
      recommendations.push('Keep the remote password stored safely; status shows the URL but does not expose the secret.');
    }

    const summaryParts = [
      sidecar?.ready && sidecarHealth.ok ? 'sidecar ready' : 'sidecar incompleto',
      bridgeStatus?.online ? 'bridge online' : 'bridge offline',
      remoteMode?.active === false ? 'modo remote inactive' : 'modo remote ok',
      session?.accessible === false ? 'session blocked' : 'session ok',
      localUrl ? `url local ${localUrl}` : 'without url local',
    ];

    return {
      checkedAt: new Date().toISOString(),
      sidecar,
      sidecarHealth,
      bridge: {
        online: Boolean(bridgeStatus?.online),
        instanceId: bridgeStatus?.instanceId || null,
        processId: bridgeStatus?.processId || null,
        pendingHandoffs: typeof bridgeStatus?.pendingHandoffs === 'number' ? bridgeStatus.pendingHandoffs : null,
        lastSyncedHandoff: bridgeStatus?.lastSyncedHandoff || null,
        capabilities,
      },
      remoteMode: {
        active: remoteMode?.active ?? null,
        changed: remoteMode?.changed ?? null,
        message: remoteMode?.message || null,
      },
      session: {
        accessible: session?.accessible ?? null,
        lockedLikely: session?.lockedLikely ?? null,
        desktopName: session?.desktopName || null,
        message: session?.message || null,
      },
      access: {
        localUrl,
        baseUrl: config.ZavorthTerminalBaseUrl,
        protectedByPassword,
        readyForRemoteUse,
        recommendations,
      },
      summary: summaryParts.join(' | '),
    };
  }

  private async readSidecarSnapshot(): Promise<TerminalSidecarSnapshot | null> {
    const statusFile = this.sidecarStatusFilePath;
    if (!fs.existsSync(statusFile)) {
      return null;
    }

    try {
      const raw = await fs.promises.readFile(statusFile, 'utf8');
      return JSON.parse(raw) as TerminalSidecarSnapshot;
    } catch (error: unknown) {logger.warn('[Zavorth Bridge Remote Native] JSON parse failed', error); return null; }
  }

  private async isSidecarHealthy(): Promise<{ ok: boolean; healthUrl: string }> {
    const healthUrl = new URL(
      'health',
      this.sidecarBaseUrl.endsWith('/') ? this.sidecarBaseUrl : `${this.sidecarBaseUrl}/`,
    ).toString();

    try {
      const response = await safeFetch(healthUrl, { method: 'GET' }, {
        serviceName: 'ZavorthBridge remote sidecar healthcheck',
        allowLoopback: true,
      });
      return {
        ok: response.status > 0 && response.status < 500,
        healthUrl,
      };
    } catch (error: unknown) {logger.warn('[Zavorth Bridge Remote Native] network request failed', error);
    return {
        ok: false,
        healthUrl,
      };
  }
  }

  private async readBridgeStatus(): Promise<{
    online: boolean;
    instanceId?: string;
    processId?: number;
    pendingHandoffs?: number;
    lastSyncedHandoff?: string | null;
    capabilities?: Record<string, boolean>;
  } | null> {
    try {
      const [online, status] = await Promise.all([
        this.bridge.isOnline(),
        this.bridge.readStatus(),
      ]);

      return {
        online,
        instanceId: status?.instanceId,
        processId: status?.processId,
        pendingHandoffs: status?.pendingHandoffs,
        lastSyncedHandoff: status?.lastSyncedHandoff || null,
        capabilities: status?.capabilities || {},
      };
    } catch (error: unknown) {logger.warn('[Zavorth Bridge Remote Native] filesystem check failed', error); return null; }
  }

  private async safeRemoteModeStatus(): Promise<RemoteModeResult | null> {
    try {
      return await this.remoteModeManager.status();
    } catch (error: unknown) {logger.warn('[Zavorth Bridge Remote Native] filesystem check failed', error); return null; }
  }

  private async safeSessionStatus(): Promise<WindowsSessionStatus | null> {
    try {
      return await this.windowsSessionService.status();
    } catch (error: unknown) {logger.warn('[Zavorth Bridge Remote Native] filesystem check failed', error); return null; }
  }
}
