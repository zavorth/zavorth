import { logger } from '../logger.js';
import fs from 'fs';
import path from 'path';
import { execFile, type ChildProcess } from 'child_process';
import { spawnCommand } from '../core/CommandSpawn.js';
import { config } from '../config/index.js';
import { LogRepository } from '../storage/LogRepository.js';
import { buildChildProcessEnv } from '../security/ChildProcessEnv.js';
import { safeFetch } from '../security/SafeFetchService.js';

export type AIGatewaySidecarSnapshot = {
  enabled: boolean;
  running: boolean;
  ready: boolean;
  spawnedByZavorth: boolean;
  pid: number | null;
  sourceDir: string | null;
  baseUrl: string;
  upstreamBaseUrl?: string;
  advertisedBaseUrl?: string;
  checkedAt: string;
  message: string;
};

export class AIGatewaySidecarService {
  private child: ChildProcess | null = null;
  private spawnedByZavorth = false;
  private readonly upstreamBaseUrl = config.AIGatewayUpstreamBaseUrl;

  constructor(private readonly logRepo?: LogRepository) {}

  public async start(): Promise<AIGatewaySidecarSnapshot> {
    if (!config.AIGatewaySidecarEnabled) {
      const snapshot = this.buildSnapshot(false, false, null, null, 'Sidecar AIGateway desativado.');
      this.writeStatus(snapshot);
      return snapshot;
    }

    if (await this.isHealthy()) {
      const snapshot = this.buildSnapshot(true, true, null, null, 'AIGateway ja estava online.');
      this.writeStatus(snapshot);
      this.log('info', snapshot.message);
      return snapshot;
    }

    const sourceDir = this.resolveSourceDir();
    if (!sourceDir) {
      throw new Error(
        'Nao encontrei um worktree local do AIGateway. Rode "node scripts/bootstrap-third-party.mjs" antes de iniciar o Zavorth.',
      );
    }

    await this.ensureDependencies(sourceDir);
    await this.spawn(sourceDir);
    await this.waitUntilHealthy(config.AIGatewaySidecarReadyTimeoutMs);

    const snapshot = this.buildSnapshot(true, true, this.child?.pid || null, sourceDir, 'AIGateway iniciado pelo Zavorth.');
    this.writeStatus(snapshot);
    this.log('info', snapshot.message);
    return snapshot;
  }

  public async stop(): Promise<void> {
    const child = this.child;
    if (child && this.spawnedByZavorth) {
      await this.terminateChild(child);
    } else {
      const persisted = this.readPersistedStatus();
      if (!persisted.pid || !persisted.spawnedByZavorth) {
        return;
      }
      await this.terminatePid(persisted.pid);
    }

    this.child = null;
    this.spawnedByZavorth = false;
    const snapshot = this.buildSnapshot(false, false, null, this.resolveSourceDir(), 'AIGateway sidecar encerrado.');
    this.writeStatus(snapshot);
    this.log('info', snapshot.message);
  }

  private readPersistedStatus(): AIGatewaySidecarSnapshot {
    const fallback = this.buildSnapshot(false, false, null, this.resolveSourceDir(), 'AIGateway ainda nao iniciou nesta sessao.');
    try {
      if (!fs.existsSync(config.AIGatewaySidecarStatusFile)) {
        return fallback;
      }
      const parsed = JSON.parse(fs.readFileSync(config.AIGatewaySidecarStatusFile, 'utf8')) as Partial<AIGatewaySidecarSnapshot>;
      return {
        ...fallback,
        ...parsed,
      };
    } catch {
      return fallback;
    }
  }

  private resolveSourceDir(): string | null {
    const candidate = path.resolve(config.AIGatewaySidecarWorktreeDir);
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }

    return null;
  }

  private async ensureDependencies(sourceDir: string): Promise<void> {
    const nodeModulesDir = path.join(sourceDir, 'node_modules');
    if (!config.AIGatewaySidecarInstallOnBoot || fs.existsSync(nodeModulesDir)) {
      return;
    }

    this.log('info', `Instalando dependencias do AIGateway em ${sourceDir}...`);
    await this.runCommand(
      config.AIGatewaySidecarBootstrapCommand,
      config.AIGatewaySidecarBootstrapArgs,
      sourceDir,
      false,
    );
  }

  private async spawn(sourceDir: string): Promise<void> {
    await fs.promises.mkdir(path.dirname(config.AIGatewaySidecarLogFile), { recursive: true });
    const logStream = fs.createWriteStream(config.AIGatewaySidecarLogFile, { flags: 'a' });

    const env = buildChildProcessEnv({
      explicitEnv: {
        PORT: this.resolvePort().toString(),
      },
    });

    const child = spawnCommand(
      config.AIGatewaySidecarStartCommand,
      config.AIGatewaySidecarStartArgs,
      {
        cwd: sourceDir,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    this.child = child;
    this.spawnedByZavorth = true;

    child.stdout?.on('data', (chunk) => logStream.write(chunk));
    child.stderr?.on('data', (chunk) => logStream.write(chunk));
    child.on('error', (error) => {
      const message = `[AIGatewaySidecar] ${error.message}\n`;
      logStream.write(message);
      this.log('error', message.trim());
    });
    child.on('exit', (code, signal) => {
      const message = `AIGateway sidecar saiu (code=${code}, signal=${signal}).`;
      logStream.write(`${message}\n`);
      this.log(code === 0 || signal === 'SIGTERM' ? 'info' : 'warn', message);
      logStream.end();
      this.child = null;
      this.spawnedByZavorth = false;
      const snapshot = this.buildSnapshot(false, false, null, sourceDir, message);
      this.writeStatus(snapshot);
    });

    this.log('info', `Subindo AIGateway de ${sourceDir}...`);
  }

  private async waitUntilHealthy(timeoutMs: number): Promise<void> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      if (await this.isHealthy()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    throw new Error(`AIGateway nao respondeu em ${timeoutMs}ms em ${this.upstreamBaseUrl}.`);
  }

  private async isHealthy(): Promise<boolean> {
    try {
      const url = this.buildModelsUrl();
      const response = await safeFetch(url, { method: 'GET' }, {
        serviceName: 'AI Gateway sidecar healthcheck',
        allowLoopback: true,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private buildModelsUrl(): string {
    const normalized = this.upstreamBaseUrl.endsWith('/') ? this.upstreamBaseUrl : `${this.upstreamBaseUrl}/`;
    return new URL('models', normalized).toString();
  }

  private resolvePort(): number {
    try {
      const parsed = new URL(this.upstreamBaseUrl);
      const port = parsed.port ? Number(parsed.port) : 80;
      return Number.isFinite(port) && port > 0 ? port : 20128;
    } catch {
      return 20128;
    }
  }

  private buildSnapshot(
    running: boolean,
    ready: boolean,
    pid: number | null,
    sourceDir: string | null,
    message: string,
  ): AIGatewaySidecarSnapshot {
    return {
      enabled: config.AIGatewaySidecarEnabled,
      running,
      ready,
      spawnedByZavorth: this.spawnedByZavorth,
      pid,
      sourceDir,
      baseUrl: this.upstreamBaseUrl,
      upstreamBaseUrl: this.upstreamBaseUrl,
      advertisedBaseUrl: config.AIGatewayBaseUrl,
      checkedAt: new Date().toISOString(),
      message,
    };
  }

  private writeStatus(snapshot: AIGatewaySidecarSnapshot): void {
    fs.mkdirSync(path.dirname(config.AIGatewaySidecarStatusFile), { recursive: true });
    fs.writeFileSync(config.AIGatewaySidecarStatusFile, JSON.stringify(snapshot, null, 2), 'utf8');
  }

  private async runCommand(
    command: string,
    args: string[],
    cwd: string,
    allowFailure: boolean,
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawnCommand(command, args, {
        cwd,
        env: buildChildProcessEnv(),
        stdio: 'inherit',
      });

      child.on('error', (error) => {
        if (allowFailure) {
          this.log('warn', `Falha tolerada ao executar ${command}: ${error.message}`);
          resolve();
          return;
        }
        reject(error);
      });

      child.on('exit', (code) => {
        if (code === 0 || allowFailure) {
          resolve();
          return;
        }
        reject(new Error(`${command} ${args.join(' ')} saiu com codigo ${code}`));
      });
    });
  }

  private async terminateChild(child: ChildProcess): Promise<void> {
    await new Promise<void>((resolve) => {
      let settled = false;
      const finalize = () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };

      const timeout = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch (err) { logger.warn("[auto-fix] Empty catch block", err); }
        finalize();
      }, 5000);

      child.once('exit', () => {
        clearTimeout(timeout);
        finalize();
      });

      if (process.platform === 'win32' && child.pid) {
        execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], () => {
          // exit listener or timeout resolves the promise
        });
        return;
      }

      try {
        child.kill('SIGTERM');
      } catch {
        clearTimeout(timeout);
        finalize();
      }
    });
  }

  private async terminatePid(pid: number): Promise<void> {
    await new Promise<void>((resolve) => {
      if (process.platform === 'win32') {
        execFile('taskkill', ['/PID', String(pid), '/T', '/F'], () => resolve());
        return;
      }

      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        resolve();
        return;
      }
      resolve();
    });
  }

  private log(level: 'info' | 'warn' | 'error', message: string): void {
    if (this.logRepo) {
      this.logRepo.log(level, 'AIGatewaySidecar', message);
      return;
    }

    const method = level === 'error' ? logger.error : level === 'warn' ? logger.warn : logger.info;
    method(`[AIGatewaySidecar] ${message}`);
  }
}
