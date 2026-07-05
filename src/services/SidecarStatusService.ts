import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type { TerminalSidecarSnapshot } from './TerminalSidecarService.js';
import type { AIGatewaySidecarSnapshot } from './AIGatewaySidecarService.js';
import type { AIGatewayProxyStatus } from './AIGatewayProxyService.js';
import { logger } from '../logger.js';

export type SidecarStatusCard = {
  id: 'AIGateway' | 'zavorth-terminal' | 'runtime-shell-sidecar' | 'browser-sidecar';
  name: string;
  enabled: boolean;
  running: boolean;
  ready: boolean;
  spawnedByZavorth: boolean;
  pid: number | null;
  baseUrl: string | null;
  localUrl: string | null;
  sourceDir: string | null;
  checkedAt: string | null;
  message: string | null;
};

export type SidecarStatusSummary = {
  AIGateway: SidecarStatusCard;
  ZavorthTerminal: SidecarStatusCard;
  RuntimeShellSidecar: SidecarStatusCard;
  BrowserSidecar: SidecarStatusCard;
};

export class SidecarStatusService {
  public readSummary(): SidecarStatusSummary {
    return {
      AIGateway: this.readAIGatewayStatus(),
      ZavorthTerminal: this.readZavorthTerminalStatus(),
      RuntimeShellSidecar: this.readRuntimeShellSidecarStatus(),
      BrowserSidecar: this.readBrowserSidecarStatus(),
    };
  }

  public list(): SidecarStatusCard[] {
    const summary = this.readSummary();
    return [
      summary.AIGateway,
      summary.ZavorthTerminal,
      summary.RuntimeShellSidecar,
      summary.BrowserSidecar,
    ];
  }

  private readAIGatewayStatus(): SidecarStatusCard {
    const configEnabled = Boolean(config.AIGatewaySidecarEnabled || config.zavorthAIGatewayGatewayEnabled);
    if (!configEnabled) {
      return this.finalizeCard({
        id: 'AIGateway',
        name: 'AIGateway',
        enabled: false,
        running: false,
        ready: false,
        spawnedByZavorth: false,
        pid: null,
        baseUrl: null,
        localUrl: null,
        sourceDir: this.normalizeText(config.AIGatewaySidecarWorktreeDir),
        checkedAt: '',
        message: 'Sidecar AIGateway desativado por configuracao.',
      });
    }
    const fallback: AIGatewaySidecarSnapshot = {
      enabled: config.AIGatewaySidecarEnabled,
      running: false,
      ready: false,
      spawnedByZavorth: false,
      pid: null,
      sourceDir: config.AIGatewaySidecarWorktreeDir,
      baseUrl: config.AIGatewayBaseUrl,
      checkedAt: '',
      message: config.AIGatewaySidecarEnabled
        ? 'AIGateway ainda nao iniciou nesta sessao.'
        : 'Sidecar AIGateway desativado.',
    };
    const snapshot = this.readSnapshot<AIGatewaySidecarSnapshot>(config.AIGatewaySidecarStatusFile, fallback);
    const gatewayFallback: AIGatewayProxyStatus = {
      enabled: config.zavorthAIGatewayGatewayEnabled,
      ready: false,
      running: false,
      pid: null,
      host: config.zavorthAIGatewayGatewayHost,
      port: config.zavorthAIGatewayGatewayPort,
      baseUrl: config.zavorthAIGatewayGatewayBaseUrl,
      upstreamBaseUrl: config.AIGatewayUpstreamBaseUrl,
      localOnly: String(config.zavorthAIGatewayGatewayHost || '').trim() !== '0.0.0.0',
      overlayFile: config.AIGatewayOverlayFile,
      checkedAt: '',
      message: config.zavorthAIGatewayGatewayEnabled
        ? 'Gateway proprio do AIGateway ainda nao iniciou nesta sessao.'
        : 'Gateway proprio do AIGateway desativado.',
    };
    const gateway = this.readSnapshot<AIGatewayProxyStatus>(config.AIGatewayGatewayStatusFile, gatewayFallback);
    const gatewayReady = Boolean(gateway.enabled && gateway.ready);
    const running = Boolean(snapshot.running || gateway.running);
    const ready = gateway.enabled
      ? Boolean(gateway.ready && (!snapshot.enabled || snapshot.ready || !config.AIGatewaySidecarEnabled))
      : Boolean(snapshot.ready);
    const advertisedBaseUrl = gatewayReady
      ? this.normalizeUrl(gateway.baseUrl)
      : this.normalizeUrl(snapshot.advertisedBaseUrl || config.AIGatewayBaseUrl);
    return this.finalizeCard({
      id: 'AIGateway',
      name: 'AIGateway',
      enabled: Boolean(snapshot.enabled || gateway.enabled),
      running,
      ready,
      spawnedByZavorth: Boolean(snapshot.spawnedByZavorth),
      pid: typeof snapshot.pid === 'number' ? snapshot.pid : null,
      baseUrl: advertisedBaseUrl,
      localUrl: this.normalizeUrl(snapshot.upstreamBaseUrl || snapshot.baseUrl || gateway.upstreamBaseUrl),
      sourceDir: this.normalizeText(snapshot.sourceDir),
      checkedAt: this.normalizeText(gateway.checkedAt || snapshot.checkedAt),
      message: this.normalizeText(
        gatewayReady
          ? (snapshot.enabled
              ? 'Gateway proprio do AIGateway pronto sobre o upstream gerenciado pelo Zavorth.'
              : 'Gateway proprio do AIGateway pronto em modo gateway-only.')
          : gateway.enabled && !gateway.ready
            ? gateway.message
            : snapshot.message,
      ),
    });
  }

  private readZavorthTerminalStatus(): SidecarStatusCard {
    const fallback: TerminalSidecarSnapshot = {
      enabled: config.ZavorthTerminalSidecarEnabled,
      running: false,
      ready: false,
      spawnedByZavorth: false,
      pid: null,
      sourceDir: config.ZavorthTerminalSidecarWorktreeDir,
      baseUrl: config.ZavorthTerminalBaseUrl,
      localUrl: config.ZavorthTerminalBaseUrl,
      checkedAt: '',
      message: config.ZavorthTerminalSidecarEnabled
        ? 'Sidecar remoto do ZavorthBridge ainda nao iniciou nesta sessao.'
        : 'Sidecar remoto do ZavorthBridge desativado.',
    };
    const snapshot = this.readSnapshot<TerminalSidecarSnapshot>(
      config.ZavorthTerminalSidecarStatusFile,
      fallback,
    );
    return this.finalizeCard({
      id: 'zavorth-terminal',
      name: 'ZavorthBridge Remote',
      enabled: Boolean(snapshot.enabled),
      running: Boolean(snapshot.running),
      ready: Boolean(snapshot.ready),
      spawnedByZavorth: Boolean(snapshot.spawnedByZavorth),
      pid: typeof snapshot.pid === 'number' ? snapshot.pid : null,
      baseUrl: this.normalizeUrl(snapshot.baseUrl),
      localUrl: this.normalizeUrl(snapshot.localUrl),
      sourceDir: this.normalizeText(snapshot.sourceDir),
      checkedAt: this.normalizeText(snapshot.checkedAt),
      message: this.normalizeText(snapshot.message),
    });
  }

  private readRuntimeShellSidecarStatus(): SidecarStatusCard {
    const statusFile = path.resolve(config.projectRoot, 'data', 'runtime', 'sidecar-docker-bootstrap-last.json');
    const fallback = {
      checkedAt: '',
      ready: false,
      docker: {
        enabled: Boolean(config.dockerSandboxEnabled),
        canRun: false,
        image: '',
        detail: 'Bootstrap Docker de sidecars ainda nao foi executado.',
      },
      firecracker: {
        enabled: Boolean(config.firecrackerEnabled),
        canRun: false,
        detail: 'Bootstrap MicroVM ainda nao foi executado.',
      },
    };
    const snapshot = this.readSnapshot<typeof fallback>(statusFile, fallback);
    const enabled = Boolean(snapshot.docker.enabled || snapshot.firecracker.enabled);
    const ready = Boolean(snapshot.ready || snapshot.docker.canRun || snapshot.firecracker.canRun);
    const detail = ready
      ? `Shell sidecar pronto: ${snapshot.docker.canRun ? 'container' : ''}${snapshot.docker.canRun && snapshot.firecracker.canRun ? ' + ' : ''}${snapshot.firecracker.canRun ? 'microvm' : ''}.`
      : snapshot.docker.detail || snapshot.firecracker.detail;
    return this.finalizeCard({
      id: 'runtime-shell-sidecar',
      name: 'Runtime Shell Sidecar',
      enabled,
      running: ready,
      ready,
      spawnedByZavorth: false,
      pid: null,
      baseUrl: null,
      localUrl: null,
      sourceDir: config.projectRoot,
      checkedAt: this.normalizeText(snapshot.checkedAt),
      message: this.normalizeText(detail),
    });
  }

  private readBrowserSidecarStatus(): SidecarStatusCard {
    const statusFile = path.resolve(config.projectRoot, 'data', 'runtime', 'browser-sidecar.json');
    const baseUrl = String(process.env.ZAVORTH_BROWSER_SIDECAR_URL || '').trim().replace(/\/+$/u, '');
    const fallback = {
      enabled: baseUrl.length > 0,
      running: false,
      ready: false,
      spawnedByZavorth: false,
      pid: null as number | null,
      baseUrl,
      localUrl: baseUrl,
      checkedAt: '',
      message: baseUrl
        ? 'Browser sidecar configurado, mas sem status salvo nesta sessao.'
        : 'Browser sidecar desativado: defina ZAVORTH_BROWSER_SIDECAR_URL ou inicie npm run browser:sidecar.',
    };
    const snapshot = this.readSnapshot<typeof fallback>(statusFile, fallback);
    return this.finalizeCard({
      id: 'browser-sidecar',
      name: 'Browser Sidecar',
      enabled: Boolean(snapshot.enabled),
      running: Boolean(snapshot.running),
      ready: Boolean(snapshot.ready),
      spawnedByZavorth: Boolean(snapshot.spawnedByZavorth),
      pid: typeof snapshot.pid === 'number' ? snapshot.pid : null,
      baseUrl: this.normalizeUrl(snapshot.baseUrl || baseUrl),
      localUrl: this.normalizeUrl(snapshot.localUrl || snapshot.baseUrl || baseUrl),
      sourceDir: config.projectRoot,
      checkedAt: this.normalizeText(snapshot.checkedAt),
      message: this.normalizeText(snapshot.message),
    });
  }

  private readSnapshot<T>(filePath: string, fallback: T): T {
    try {
      if (!fs.existsSync(filePath)) {
        return fallback;
      }

      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<T>;
      return {
        ...fallback,
        ...parsed,
      };
    } catch (error) { logger.warn('[Sidecar Status] JSON parse failed', error); return fallback; }
  }

  private normalizeText(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeUrl(value: unknown): string | null {
    const normalized = String(value || '').trim().replace(/\/+$/, '');
    return normalized.length > 0 ? normalized : null;
  }

  private finalizeCard(card: SidecarStatusCard): SidecarStatusCard {
    if (card.pid && !this.isProcessAlive(card.pid)) {
      return {
        ...card,
        running: false,
        ready: false,
        message: 'O ultimo processo registrado nao esta mais ativo.',
      };
    }

    return card;
  }

  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) { logger.warn('[Sidecar Status] filesystem check failed', error); return error?.code !== 'ESRCH'; }
  }
}
