import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile, type ChildProcess } from 'child_process';
import { spawnCommand } from '../core/CommandSpawn.js';
import { config } from '../config/index.js';
import { LogRepository } from '../storage/LogRepository.js';
import { buildChildProcessEnv } from '../security/ChildProcessEnv.js';
import { safeFetch } from '../security/SafeFetchService.js';

export type TerminalSidecarSnapshot = {
  enabled: boolean;
  running: boolean;
  ready: boolean;
  spawnedByZavorth: boolean;
  pid: number | null;
  sourceDir: string | null;
  baseUrl: string;
  localUrl: string;
  checkedAt: string;
  message: string;
};

export class TerminalSidecarService {
  private child: ChildProcess | null = null;
  private spawnedByZavorth = false;
  private readonly baseUrl = config.ZavorthTerminalBaseUrl;

  constructor(private readonly logRepo?: LogRepository) {}

  public async start(): Promise<TerminalSidecarSnapshot> {
    if (!config.ZavorthTerminalSidecarEnabled) {
      const snapshot = this.buildSnapshot(false, false, null, null, 'Sidecar remoto do ZavorthBridge desativado.');
      this.writeStatus(snapshot);
      return snapshot;
    }

    if (await this.isHealthy()) {
      const snapshot = this.buildSnapshot(true, true, null, null, 'Zavorth Remote Terminal Sidecar ja estava online.');
      this.writeStatus(snapshot);
      this.log('info', snapshot.message);
      return snapshot;
    }

    const sourceDir = this.resolveSourceDir();
    if (!sourceDir) {
      throw new Error(
        'Nao encontrei um worktree local do Zavorth Remote Terminal Sidecar. Rode "node scripts/bootstrap-third-party.mjs" antes de iniciar o Zavorth.',
      );
    }

    await this.ensureDependencies(sourceDir);
    await this.spawn(sourceDir);
    await this.waitUntilHealthy(config.ZavorthTerminalSidecarReadyTimeoutMs);

    const snapshot = this.buildSnapshot(
      true,
      true,
      this.child?.pid || null,
      sourceDir,
      'Zavorth Remote Terminal Sidecar iniciado pelo Zavorth.',
    );
    this.writeStatus(snapshot);
    this.log('info', `${snapshot.message} URL local: ${snapshot.localUrl}`);
    return snapshot;
  }

  public async stop(): Promise<void> {
    const child = this.child;
    if (!child || !this.spawnedByZavorth) {
      return;
    }

    await this.terminateChild(child);

    this.child = null;
    this.spawnedByZavorth = false;
    const snapshot = this.buildSnapshot(false, false, null, this.resolveSourceDir(), 'Zavorth Remote Terminal Sidecar encerrado.');
    this.writeStatus(snapshot);
    this.log('info', snapshot.message);
  }

  private resolveSourceDir(): string | null {
    const candidate = path.resolve(config.ZavorthTerminalSidecarWorktreeDir);
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }

    return null;
  }

  private async ensureDependencies(sourceDir: string): Promise<void> {
    const nodeModulesDir = path.join(sourceDir, 'node_modules');
    if (!config.ZavorthTerminalSidecarInstallOnBoot || fs.existsSync(nodeModulesDir)) {
      return;
    }

    this.log('info', `Instalando dependencias do Zavorth Remote Terminal Sidecar em ${sourceDir}...`);
    await this.runCommand(
      config.ZavorthTerminalSidecarBootstrapCommand,
      config.ZavorthTerminalSidecarBootstrapArgs,
      sourceDir,
    );
  }

  private async spawn(sourceDir: string): Promise<void> {
    await fs.promises.mkdir(path.dirname(config.ZavorthTerminalSidecarLogFile), { recursive: true });
    const logStream = fs.createWriteStream(config.ZavorthTerminalSidecarLogFile, { flags: 'a' });
    const env = buildChildProcessEnv({
      explicitEnv: {
        PORT: this.resolvePort().toString(),
        APP_PASSWORD: config.ZavorthTerminalAppPassword,
      },
    });

    const child = spawnCommand(
      config.ZavorthTerminalSidecarStartCommand,
      config.ZavorthTerminalSidecarStartArgs,
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
      const message = `[ZavorthTerminalSidecar] ${error.message}\n`;
      logStream.write(message);
      this.log('error', message.trim());
    });
    child.on('exit', (code, signal) => {
      const message = `Zavorth Remote Terminal Sidecar saiu (code=${code}, signal=${signal}).`;
      logStream.write(`${message}\n`);
      this.log(code === 0 || signal === 'SIGTERM' ? 'info' : 'warn', message);
      logStream.end();
      this.child = null;
      this.spawnedByZavorth = false;
      const snapshot = this.buildSnapshot(false, false, null, sourceDir, message);
      this.writeStatus(snapshot);
    });

    this.log('info', `Subindo Zavorth Remote Terminal Sidecar de ${sourceDir}...`);
  }

  private async waitUntilHealthy(timeoutMs: number): Promise<void> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      if (await this.isHealthy()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    throw new Error(`Zavorth Remote Terminal Sidecar nao respondeu em ${timeoutMs}ms em ${this.baseUrl}.`);
  }

  private async isHealthy(): Promise<boolean> {
    try {
      const response = await safeFetch(this.buildHealthUrl(), { method: 'GET' }, {
        serviceName: 'Terminal sidecar healthcheck',
        allowLoopback: true,
      });
      return response.status > 0 && response.status < 500;
    } catch {
      return false;
    }
  }

  private buildHealthUrl(): string {
    const normalized = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    return new URL('health', normalized).toString();
  }

  private resolvePort(): number {
    try {
      const parsed = new URL(this.baseUrl);
      const port = parsed.port ? Number(parsed.port) : 80;
      return Number.isFinite(port) && port > 0 ? port : 4747;
    } catch {
      return 4747;
    }
  }

  private resolveLocalUrl(): string {
    try {
      const parsed = new URL(this.baseUrl);
      const port = parsed.port || '4747';
      return `http://${this.getLocalIp()}:${port}`;
    } catch {
      return this.baseUrl;
    }
  }

  private getLocalIp(): string {
    const interfaces = os.networkInterfaces();
    const candidates: string[] = [];

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          candidates.push(iface.address);
        }
      }
    }

    const preferred =
      candidates.find((value) => value.startsWith('192.168.')) ||
      candidates.find((value) => value.startsWith('10.')) ||
      candidates[0];

    return preferred || '127.0.0.1';
  }

  private buildSnapshot(
    running: boolean,
    ready: boolean,
    pid: number | null,
    sourceDir: string | null,
    message: string,
  ): TerminalSidecarSnapshot {
    return {
      enabled: config.ZavorthTerminalSidecarEnabled,
      running,
      ready,
      spawnedByZavorth: this.spawnedByZavorth,
      pid,
      sourceDir,
      baseUrl: this.baseUrl,
      localUrl: this.resolveLocalUrl(),
      checkedAt: new Date().toISOString(),
      message,
    };
  }

  private writeStatus(snapshot: TerminalSidecarSnapshot): void {
    fs.mkdirSync(path.dirname(config.ZavorthTerminalSidecarStatusFile), { recursive: true });
    fs.writeFileSync(config.ZavorthTerminalSidecarStatusFile, JSON.stringify(snapshot, null, 2), 'utf8');
  }

  private async runCommand(command: string, args: string[], cwd: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawnCommand(command, args, {
        cwd,
        env: buildChildProcessEnv(),
        stdio: 'inherit',
      });

      child.on('error', reject);
      child.on('exit', (code) => {
        if (code === 0) {
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
        } catch {}
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

  private log(level: 'info' | 'warn' | 'error', message: string): void {
    if (this.logRepo) {
      this.logRepo.log(level, 'ZavorthTerminalSidecar', message);
      return;
    }

    const method = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    method(`[ZavorthTerminalSidecar] ${message}`);
  }
}
