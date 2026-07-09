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
      recommendations.push('Suba o sidecar remoto do ZavorthBridge antes de tentar acesso externo.');
    }
    if (!sidecarHealth.ok) {
      recommendations.push('Verifique a rota /health do remoto do ZavorthBridge e confirme que o servidor HTTP esta respondendo.');
    }
    if (!bridgeStatus?.online) {
      recommendations.push('Abra o ZavorthBridge com a bridge ativa para expor status, handoffs e comandos nativos.');
    }
    if (remoteMode?.active === false) {
      recommendations.push('Ative o modo remoto antes de usar o ZavorthBridge fora da sessao local.');
    }
    if (session?.accessible === false) {
      recommendations.push('Desbloqueie a sessao do Windows para permitir automacao e controle da janela do ZavorthBridge.');
    }
    if (protectedByPassword) {
      recommendations.push('Mantenha a senha do remoto guardada; o status mostra a URL, mas nao expoe o segredo.');
    }

    const summaryParts = [
      sidecar?.ready && sidecarHealth.ok ? 'sidecar pronto' : 'sidecar incompleto',
      bridgeStatus?.online ? 'bridge online' : 'bridge offline',
      remoteMode?.active === false ? 'modo remoto inativo' : 'modo remoto ok',
      session?.accessible === false ? 'sessao bloqueada' : 'sessao ok',
      localUrl ? `url local ${localUrl}` : 'sem url local',
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
    } catch (error: any) { logger.warn('[Zavorth Bridge Remote Native] JSON parse failed', error); return null; }
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
    } catch (error: any) {
    logger.warn('[Zavorth Bridge Remote Native] network request failed', error);
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
    } catch (error: any) { logger.warn('[Zavorth Bridge Remote Native] filesystem check failed', error); return null; }
  }

  private async safeRemoteModeStatus(): Promise<RemoteModeResult | null> {
    try {
      return await this.remoteModeManager.status();
    } catch (error: any) { logger.warn('[Zavorth Bridge Remote Native] filesystem check failed', error); return null; }
  }

  private async safeSessionStatus(): Promise<WindowsSessionStatus | null> {
    try {
      return await this.windowsSessionService.status();
    } catch (error: any) { logger.warn('[Zavorth Bridge Remote Native] filesystem check failed', error); return null; }
  }
}
