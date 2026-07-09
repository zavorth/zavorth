import fs from 'fs';
import { config } from '../config/index.js';
import { spawnNativeCommand } from '../core/CommandSpawn.js';
import { logger } from '../logger.js';
import {
AIGatewayProxyService,
  type AIGatewayProxyStatus,
} from './AIGatewayProxyService.js';

type GatewayStatusLike = Pick<AIGatewayProxyService, 'readStatus'>;
type SpawnLike = typeof spawnNativeCommand;

type GatewayLauncherOptions = {
  gatewayService?: GatewayStatusLike;
  spawn?: SpawnLike;
  sleep?: (ms: number) => Promise<void>;
  fetchImpl?: typeof fetch;
};

export class ZavorthGatewayLauncherService {
  private readonly gatewayService: GatewayStatusLike;
  private readonly spawnImpl: SpawnLike;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GatewayLauncherOptions = {}) {
    this.gatewayService = options.gatewayService || new AIGatewayProxyService();
    this.spawnImpl = options.spawn || spawnNativeCommand;
    this.sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.fetchImpl = options.fetchImpl || fetch;
  }

  public readStatus(): AIGatewayProxyStatus {
    return this.gatewayService.readStatus();
  }

  public async ensureStarted(): Promise<AIGatewayProxyStatus> {
    const current = this.gatewayService.readStatus();
    if (current.ready && this.hasLiveGateway(current) && await this.isContractReady(current.baseUrl)) {
      return current;
    }
    if (current.running && this.hasLiveGateway(current)) {
      return this.waitForReady();
    }

    if (!fs.existsSync(config.AIGatewayGatewayEntrypointFile)) {
      return {
        ...current,
        message: `Entrypoint do gateway AIGateway ausente em ${config.AIGatewayGatewayEntrypointFile}. Rode npm run build antes de iniciar a rota propria.`,
      };
    }

    const child = this.spawnImpl(process.execPath, [config.AIGatewayGatewayEntrypointFile], {
      cwd: config.projectRoot,
      env: process.env,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    return this.waitForReady();
  }

  private async waitForReady(): Promise<AIGatewayProxyStatus> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < config.AIGatewayGatewayReadyTimeoutMs) {
      await this.sleep(250);
      const status = this.gatewayService.readStatus();
      if ((status.ready || status.running) && this.hasLiveGateway(status) && await this.isContractReady(status.baseUrl)) {
        return status;
      }
    }

    const latest = this.gatewayService.readStatus();
    return {
      ...latest,
      message: latest.message || 'O launcher do gateway AIGateway foi acionado, mas a rota propria ainda nao ficou pronta.',
    };
  }

  private hasLiveGateway(status: AIGatewayProxyStatus): boolean {
    return status.pid == null ? true : this.isPidAlive(status.pid);
  }

  private async isContractReady(baseUrl: string): Promise<boolean> {
    try {
      const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      const response = await this.fetchImpl(new URL('models', normalized).toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });
      return response.ok;
    } catch (error: unknown) {logger.warn('[Zavorth way Launcher] network request failed', error); return false; }
  }

  private isPidAlive(pid: number | null): boolean {
    if (!pid || !Number.isFinite(pid)) {
      return false;
    }
    try {
      process.kill(pid, 0);
      return true;
    } catch (error: unknown) {logger.warn('[Zavorth way Launcher] process signal failed', error); return false; }
  }
}
