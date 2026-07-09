
import { execFileSync } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { BaseTool } from './BaseTool.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

export type BackendType = 'local' | 'docker' | 'ssh' | 'wsl' | 'singularity' | 'modal';

export interface BackendConfig {
  type: BackendType;
  name: string;
  connected: boolean;
  options: Record<string, unknown>;
}

export interface ExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  backend: BackendType;
  duration_ms: number;
}

export class ZavorthTerminalBackendsTool extends BaseTool {
  public readonly name = 'terminal_backends';
  public readonly description = 'Manage and execute commands across multiple terminal backends (local, Docker, SSH, WSL, Singularity, Modal).';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['connect', 'disconnect', 'status', 'execute', 'log', 'stats'],
        description: 'Action to perform on terminal backends.',
      },
      backend: {
        type: 'string',
        enum: ['local', 'docker', 'ssh', 'wsl', 'singularity', 'modal'],
        description: 'Backend type to operate on.',
      },
      command: {
        type: 'string',
        description: 'Command to execute (required for "execute" action).',
      },
      options: {
        type: 'object',
        description: 'Backend-specific options (e.g., host, port, container, image).',
      },
      timeout_ms: {
        type: 'number',
        description: 'Execution timeout in milliseconds (default: 30000, max: 120000).',
      },
      working_directory: {
        type: 'string',
        description: 'Working directory for command execution (local backend only).',
      },
    },
    required: ['action'],
  };
  private backends: Map<BackendType, BackendConfig> = new Map();
  private executionLog: Array<{ backend: BackendType; command: string; result: ExecuteResult; timestamp: string }> = [];
  private readonly MAX_LOG = 200;

  constructor() {
    super();
    this.backends.set('local', { type: 'local', name: 'Local Shell', connected: true, options: {} });
    this.backends.set('docker', { type: 'docker', name: 'Docker', connected: false, options: {} });
    this.backends.set('ssh', { type: 'ssh', name: 'SSH Remote', connected: false, options: {} });
    this.backends.set('wsl', { type: 'wsl', name: 'WSL', connected: false, options: {} });
    this.backends.set('singularity', { type: 'singularity', name: 'Singularity', connected: false, options: {} });
    this.backends.set('modal', { type: 'modal', name: 'Modal', connected: false, options: {} });
  }

  public connect(backend: BackendType, options?: Record<string, unknown>): string {
    const config = this.backends.get(backend);
    if (!config) return `Error: unknown backend "${backend}".`;

    try {
      switch (backend) {
        case 'local':
          config.connected = true;
          return 'Local shell connected.';

        case 'docker':
          execFileSync('docker', ['info'], { timeout: 10000, windowsHide: true, stdio: 'pipe' });
          config.connected = true;
          config.options = options || {};
          return `Docker connected. Version: ${this.getDockerVersion()}.`;

        case 'ssh': {
          const host = String(options?.host || '');
          const user = String(options?.user || os.userInfo().username);
          if (!host) return 'Error: SSH requires "host" option.';
          const port = String(options?.port || '22');
          execFileSync('ssh', ['-o', 'ConnectTimeout=5', '-o', 'BatchMode=yes', '-p', port, `${user}@${host}`, 'echo', 'ok'], { timeout: 15000, windowsHide: true, stdio: 'pipe' });
          config.connected = true;
          config.options = { host, user, port, keyPath: options?.keyPath || '' };
          return `SSH connected to ${user}@${host}:${port}.`;
        }

        case 'wsl':
          if (os.platform() !== 'win32') return 'Error: WSL is only available on Windows.';
          execFileSync('wsl', ['--', 'echo', 'ok'], { timeout: 10000, windowsHide: true, stdio: 'pipe' });
          config.connected = true;
          config.options = { distribution: options?.distribution || 'default' };
          return `WSL connected. Distribution: ${config.options.distribution}.`;

        case 'singularity':
          execFileSync('singularity', ['--version'], { timeout: 10000, windowsHide: true, stdio: 'pipe' });
          config.connected = true;
          config.options = { image: options?.image || '' };
          return `Singularity connected. Version: ${this.getSingularityVersion()}.`;

        case 'modal':
          try {
            execFileSync('modal', ['--version'], { timeout: 10000, windowsHide: true, stdio: 'pipe' });
          } catch (error: unknown) {execFileSync('python', ['-m', 'modal', '--version'], { timeout: 10000, windowsHide: true, stdio: 'pipe' });
          }
          config.connected = true;
          config.options = options || {};
          return 'Modal connected.';
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Terminal Backends] process execution failed', error);
    const message = error instanceof Error ? err.message : String(error);
      return `Error connecting to ${backend}: ${message}`;
  }
  }

  public disconnect(backend: BackendType): string {
    const config = this.backends.get(backend);
    if (!config) return `Error: unknown backend "${backend}".`;
    if (!config.connected) return `Backend "${backend}" is not connected.`;

    config.connected = false;
    config.options = {};
    return `Disconnected from ${backend}.`;
  }

  public status(): string {
    const lines: string[] = ['Terminal Backends Status:'];
    for (const [type, config] of this.backends) {
      const statusIcon = config.connected ? '[ON]' : '[OFF]';
      const details = this.getBackendDetails(config);
      lines.push(`  ${statusIcon} ${type}: ${config.name}${details ? ` | ${details}` : ''}`);
    }
    lines.push(`  Execution log: ${this.executionLog.length} entries`);
    return lines.join('\n');
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    const backend = String(args.backend || '') as BackendType;
    const command = String(args.command || '');
    const options = args.options as Record<string, unknown> | undefined;
    const timeout_ms = Number(args.timeout_ms) || 30000;
    const working_directory = String(args.working_directory || '');

    switch (action) {
      case 'connect':
        return this.connect(backend, options);
      case 'disconnect':
        return this.disconnect(backend);
      case 'status':
        return this.status();
      case 'execute': {
        if (!backend) return 'Error: "backend" is required for execute action.';
        if (!command) return 'Error: "command" is required for execute action.';
        const result = this.executeOnBackend(backend, command, { timeout_ms, working_directory, ...options });
        return this.executeAsString(backend, command, { timeout_ms, working_directory });
      }
      case 'log':
        return this.getExecutionLog();
      case 'stats':
        return this.getStats();
      default:
        return `Error: unknown action "${action}". Valid actions: connect, disconnect, status, execute, log, stats`;
    }
  }

  public executeOnBackend(backend: BackendType, command: string, options?: { timeout_ms?: number; working_directory?: string }): ExecuteResult {
    const config = this.backends.get(backend);
    if (!config) return this.errorResult(backend, `Unknown backend "${backend}".`);
    if (!config.connected) return this.errorResult(backend, `Backend "${backend}" is not connected. Call connect() first.`);

    const timeout = Math.min(Math.max(options?.timeout_ms || 30000, 1000), 120000);
    const startTime = Date.now();

    try {
      let result: ExecuteResult;

      switch (backend) {
        case 'local':
          result = this.executeLocal(command, timeout, options?.working_directory);
          break;
        case 'docker':
          result = this.executeDocker(command, timeout, config.options);
          break;
        case 'ssh':
          result = this.executeSSH(command, timeout, config.options);
          break;
        case 'wsl':
          result = this.executeWSL(command, timeout);
          break;
        case 'singularity':
          result = this.executeSingularity(command, timeout, config.options);
          break;
        case 'modal':
          result = this.executeModal(command, timeout);
          break;
        default:
          return this.errorResult(backend, `Execution not implemented for "${backend}".`);
      }

      result.duration_ms = Date.now() - startTime;
      this.logExecution(backend, command, result);
      return result;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      const result = this.errorResult(backend, message);
      result.duration_ms = Date.now() - startTime;
      this.logExecution(backend, command, result);
      return result;
    }
  }

  public executeAsString(backend: BackendType, command: string, options?: { timeout_ms?: number; working_directory?: string }): string {
    const result = this.executeOnBackend(backend, command, options);
    const lines: string[] = [`[${backend}] Exit: ${result.exitCode} (${result.duration_ms}ms)`];
    if (result.stdout) lines.push(`[STDOUT]\n${result.stdout}`);
    if (result.stderr) lines.push(`[STDERR]\n${result.stderr}`);
    return lines.join('\n');
  }

  public getExecutionLog(limit: number = 20): string {
    if (this.executionLog.length === 0) return 'No executions logged.';

    const recent = this.executionLog.slice(-limit);
    const lines: string[] = [`Execution log (last ${recent.length}):`];
    for (const entry of recent) {
      const icon = entry.result.exitCode === 0 ? '[OK]' : '[ERR]';
      lines.push(`  ${icon} [${entry.backend}] ${entry.command.slice(0, 60)}${entry.command.length > 60 ? '...' : ''} (${entry.result.duration_ms}ms)`);
    }
    return lines.join('\n');
  }

  public getStats(): string {
    let totalExecs = 0;
    let successExecs = 0;
    const backendCounts: Record<string, number> = {};

    for (const entry of this.executionLog) {
      totalExecs++;
      if (entry.result.exitCode === 0) successExecs++;
      backendCounts[entry.backend] = (backendCounts[entry.backend] || 0) + 1;
    }

    const backendLines = Object.entries(backendCounts).map(([b, n]) => `    ${b}: ${n}`).join('\n');
    const connectedCount = Array.from(this.backends.values()).filter((b) => b.connected).length;

    return [
      `Terminal Backends Stats:`,
      `  Backends: ${this.backends.size} total, ${connectedCount} connected`,
      `  Total executions: ${totalExecs}`,
      `  Success rate: ${totalExecs > 0 ? ((successExecs / totalExecs) * 100).toFixed(0) : 0}%`,
      `  By backend:\n${backendLines}`,
    ].join('\n');
  }

  private executeLocal(command: string, timeout: number, cwd?: string): ExecuteResult {
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    const args = os.platform() === 'win32' ? ['-Command', command] : ['-c', command];
    const result = execFileSync(shell, args, { timeout, windowsHide: true, maxBuffer: 5 * 1024 * 1024, cwd: cwd || process.cwd(), encoding: 'utf-8' });
    return { stdout: String(result), stderr: '', exitCode: 0, backend: 'local', duration_ms: 0 };
  }

  private executeDocker(command: string, timeout: number, options: Record<string, unknown>): ExecuteResult {
    const container = String(options.container || '');
    if (!container) {
      return this.errorResult('docker', 'No container specified. Pass "container" in connect options.');
    }
    const result = execFileSync('docker', ['exec', container, 'sh', '-c', command], { timeout, windowsHide: true, maxBuffer: 5 * 1024 * 1024, encoding: 'utf-8' });
    return { stdout: String(result), stderr: '', exitCode: 0, backend: 'docker', duration_ms: 0 };
  }

  private executeSSH(command: string, timeout: number, options: Record<string, unknown>): ExecuteResult {
    const host = String(options.host || '');
    const user = String(options.user || os.userInfo().username);
    const port = String(options.port || '22');
    const keyPath = String(options.keyPath || '');

    const sshArgs: string[] = ['-o', 'ConnectTimeout=5', '-o', 'StrictHostKeyChecking=no', '-p', port];
    if (keyPath && fs.existsSync(keyPath)) sshArgs.push('-i', keyPath);
    sshArgs.push(`${user}@${host}`, command);

    const result = execFileSync('ssh', sshArgs, { timeout, windowsHide: true, maxBuffer: 5 * 1024 * 1024, encoding: 'utf-8' });
    return { stdout: String(result), stderr: '', exitCode: 0, backend: 'ssh', duration_ms: 0 };
  }

  private executeWSL(command: string, timeout: number): ExecuteResult {
    const distro = 'default';
    const result = execFileSync('wsl', ['--', 'bash', '-c', command], { timeout, windowsHide: true, maxBuffer: 5 * 1024 * 1024, encoding: 'utf-8' });
    return { stdout: String(result), stderr: '', exitCode: 0, backend: 'wsl', duration_ms: 0 };
  }

  private executeSingularity(command: string, timeout: number, options: Record<string, unknown>): ExecuteResult {
    const image = String(options.image || '');
    if (!image) {
      return this.errorResult('singularity', 'No image specified. Pass "image" in connect options.');
    }
    const result = execFileSync('singularity', ['exec', image, 'bash', '-c', command], { timeout, windowsHide: true, maxBuffer: 5 * 1024 * 1024, encoding: 'utf-8' });
    return { stdout: String(result), stderr: '', exitCode: 0, backend: 'singularity', duration_ms: 0 };
  }

  private executeModal(command: string, timeout: number): ExecuteResult {
    const scriptContent = `import subprocess; result = subprocess.run(${JSON.stringify(command.split(' '))}, capture_output=True, text=True); print(result.stdout); exit(result.returncode)`;
    const tmpFile = path.join(os.tmpdir(), `modal_exec_${Date.now()}.py`);
    fs.writeFileSync(tmpFile, scriptContent, 'utf-8');
    try {
      const result = execFileSync('modal', ['run', tmpFile], { timeout, windowsHide: true, maxBuffer: 5 * 1024 * 1024, encoding: 'utf-8' });
      return { stdout: String(result), stderr: '', exitCode: 0, backend: 'modal', duration_ms: 0 };
    } finally {
      try { fs.unlinkSync(tmpFile); } catch (error: unknown) {/* ignore */ logger.warn('[Zavorth Terminal Backends] file cleanup failed', error); }
    }
  }

  private errorResult(backend: BackendType, message: string): ExecuteResult {
    return { stdout: '', stderr: message, exitCode: -1, backend, duration_ms: 0 };
  }

  private logExecution(backend: BackendType, command: string, result: ExecuteResult): void {
    this.executionLog.push({ backend, command, result, timestamp: new Date().toISOString() });
    if (this.executionLog.length > this.MAX_LOG) {
      this.executionLog.splice(0, this.executionLog.length - this.MAX_LOG);
    }
  }

  private getDockerVersion(): string {
    try {
      return execFileSync('docker', ['version', '--format', '{{.Server.Version}}'], { timeout: 5000, windowsHide: true, encoding: 'utf-8' }).trim();
    } catch (error: unknown) {logger.warn('[Zavorth Terminal Backends] process execution failed', error); return 'unknown'; }
  }

  private getSingularityVersion(): string {
    try {
      return execFileSync('singularity', ['--version'], { timeout: 5000, windowsHide: true, encoding: 'utf-8' }).trim();
    } catch (error: unknown) {logger.warn('[Zavorth Terminal Backends] process execution failed', error); return 'unknown'; }
  }

  private getBackendDetails(config: BackendConfig): string {
    if (!config.connected) return '';
    switch (config.type) {
      case 'docker': return config.options.container ? `container: ${config.options.container}` : 'no container set';
      case 'ssh': return config.options.host ? `${config.options.user}@${config.options.host}:${config.options.port}` : '';
      case 'wsl': return `distro: ${config.options.distribution || 'default'}`;
      case 'singularity': return config.options.image ? `image: ${config.options.image}` : 'no image set';
      case 'modal': return 'serverless';
      default: return '';
    }
  }
}
