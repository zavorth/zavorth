import fs from 'fs';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import {
  execCommandSync,
  execNativeCommandSync,
  spawnCommand,
  spawnNativeCommand,
} from '../../core/CommandSpawn.js';
import { logger } from '../../logger.js';
import type {
ISandboxRuntime,
  SandboxLanguage,
  SandboxRequest,
  SandboxResult,
} from './ISandboxRuntime.js';

type DockerSyncResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
};

type DockerAsyncResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

type DockerSandboxRuntimeOptions = {
  syncRunner?: (command: string, args: string[], timeoutMs: number) => DockerSyncResult;
  asyncRunner?: (
    command: string,
    args: string[],
    timeoutMs: number,
  ) => Promise<DockerAsyncResult>;
  tempBasePath?: string;
  now?: () => number;
};

type DockerProbeCacheEntry = {
  checkedAt: number;
  result: DockerSyncResult;
};

type DockerExecError = Error & {
  status?: number | null;
  stdout?: string | Buffer;
  stderr?: string | Buffer;
  code?: string;
};

export type DockerSandboxStatus = {
  enabled: boolean;
  language: SandboxLanguage;
  image: string;
  dockerReachable: boolean;
  daemonReachable: boolean;
  imagePresent: boolean;
  autoPullEnabled: boolean;
  sandboxRuntime: string;
  canRun: boolean;
  detail: string;
};

export class DockerSandboxRuntime implements ISandboxRuntime {
  private static readonly WINDOWS_COLD_START_PROBE_TIMEOUT_MS = 20_000;
  private static readonly RETRY_PROBE_TIMEOUT_MS = 30_000;
  private static readonly STATUS_PROBE_CACHE_TTL_MS = 15_000;

  public readonly securityLevel = 'container' as const;
  private readonly syncRunner: (
    command: string,
    args: string[],
    timeoutMs: number,
  ) => DockerSyncResult;
  private readonly asyncRunner: (
    command: string,
    args: string[],
    timeoutMs: number,
  ) => Promise<DockerAsyncResult>;
  private readonly tempBasePath: string;
  private readonly imageReadyCache = new Set<string>();
  private readonly now: () => number;
  private versionProbeCache: DockerProbeCacheEntry | null = null;

  constructor(options: DockerSandboxRuntimeOptions = {}) {
    this.syncRunner = options.syncRunner || this.defaultSyncRunner;
    this.asyncRunner = options.asyncRunner || this.defaultAsyncRunner;
    this.tempBasePath =
      options.tempBasePath || path.join(os.tmpdir(), 'zavorth_docker_jails');
    this.now = options.now || (() => Date.now());
  }

  private usesWslDockerWrapper(): boolean {
    return String(config.dockerCliPath || '').toLowerCase().includes('docker-wsl-zavorth.cmd');
  }

  private normalizeHostMountPath(hostPath: string): string {
    const normalized = hostPath.replace(/\\/g, '/');
    if (!this.usesWslDockerWrapper()) {
      return normalized;
    }

    const match = normalized.match(/^([a-zA-Z]):\/(.*)$/);
    if (!match) {
      return normalized;
    }

    const drive = match[1].toLowerCase();
    return `/mnt/${drive}/${match[2]}`;
  }

  public isAvailable(language: SandboxLanguage = 'javascript'): boolean {
    return this.getStatus(language).canRun;
  }

  /**
   * Verifica se o runtime gVisor (runsc) esta realmente ativo no Docker daemon.
   * Retorna true se o Docker responde com runtime=runsc, false se nao.
   */
  public isGvisorActive(): boolean {
    if (!config.dockerSandboxRuntime || config.dockerSandboxRuntime !== 'runsc') {
      return false;
    }

    try {
      // Probe real: tenta rodar um container minimo com --runtime=runsc
      const result = this.runDockerSync(
        ['run', '--rm', '--runtime', 'runsc', 'busybox:latest', 'true'],
        config.dockerSandboxProbeTimeoutMs,
        {
          allowRetryOnTimeout: true,
          useColdStartFloor: true,
        },
      );
      return result.status === 0;
    } catch (error) { logger.warn('[Docker Sandbox Runtime] lifecycle operation failed', error); return false; }
  }

  /**
   * Constroi os argumentos de hardening do Docker container.
   * Centralizado para evitar duplicacao e garantir que todos os caminhos
   * de execucao apliquem as mesmas restricoes.
   */
  private buildHardenedArgs(): string[] {
    const args: string[] = [];

    // Runtime alternativo (gVisor/runsc)
    if (config.dockerSandboxRuntime) {
      args.push('--runtime', config.dockerSandboxRuntime);
    }

    // Rede desabilitada — nenhum acesso externo
    args.push('--network', 'none');

    // Limites de recursos
    args.push('--memory', `${Math.max(256, config.dockerSandboxMemoryMb)}m`);
    args.push('--cpus', String(config.dockerSandboxCpuLimit));
    args.push('--pids-limit', String(Math.max(16, config.dockerSandboxPidsLimit)));

    // Drop ALL capabilities — container nao precisa de nenhuma
    if (config.dockerSandboxCapDropAll) {
      args.push('--cap-drop', 'ALL');
    }

    // Impede escalacao de privilegios (suid, setuid, etc.)
    if (config.dockerSandboxNoNewPrivileges) {
      args.push('--security-opt', 'no-new-privileges');
    }

    // Filesystem read-only com tmpfs para /tmp (unico lugar onde pode escrever)
    if (config.dockerSandboxReadOnly) {
      args.push('--read-only');
      args.push('--tmpfs', '/tmp:rw,noexec,nosuid,size=64m');
    }

    return args;
  }

  public getStatus(language: SandboxLanguage = 'javascript'): DockerSandboxStatus {
    const image = this.getImageForLanguage(language);
    if (!config.dockerSandboxEnabled) {
      return {
        enabled: false,
        language,
        image,
        dockerReachable: false,
        daemonReachable: false,
        imagePresent: false,
        autoPullEnabled: config.dockerSandboxAutoPull,
        sandboxRuntime: config.dockerSandboxRuntime || 'runc',
        canRun: false,
        detail: 'docker sandbox desabilitado por configuracao.',
      };
    }

    const versionResult = this.getCachedVersionProbe();

    if (versionResult.error) {
      return {
        enabled: true,
        language,
        image,
        dockerReachable: false,
        daemonReachable: false,
        imagePresent: false,
        autoPullEnabled: config.dockerSandboxAutoPull,
        sandboxRuntime: config.dockerSandboxRuntime || 'runc',
        canRun: false,
        detail: `nao foi possivel iniciar o CLI Docker em "${config.dockerCliPath}": ${versionResult.error.message}`,
      };
    }

    if (versionResult.status !== 0) {
      return {
        enabled: true,
        language,
        image,
        dockerReachable: true,
        daemonReachable: false,
        imagePresent: false,
        autoPullEnabled: config.dockerSandboxAutoPull,
        sandboxRuntime: config.dockerSandboxRuntime || 'runc',
        canRun: false,
        detail: `daemon Docker indisponivel ou sem resposta valida: ${this.formatDockerError(versionResult)}`,
      };
    }

    if (this.imageReadyCache.has(image)) {
      return {
        enabled: true,
        language,
        image,
        dockerReachable: true,
        daemonReachable: true,
        imagePresent: true,
        autoPullEnabled: config.dockerSandboxAutoPull,
        sandboxRuntime: config.dockerSandboxRuntime || 'runc',
        canRun: true,
        detail: `daemon Docker acessivel e imagem ${image} pronta para ${language}. Runtime: ${config.dockerSandboxRuntime || 'runc (padrao)'}.`,
      };
    }

    const inspectResult = this.runDockerSync(
      ['image', 'inspect', image],
      config.dockerSandboxProbeTimeoutMs,
      { allowRetryOnTimeout: true, useColdStartFloor: true },
    );

    if (inspectResult.status === 0) {
      this.imageReadyCache.add(image);
      return {
        enabled: true,
        language,
        image,
        dockerReachable: true,
        daemonReachable: true,
        imagePresent: true,
        autoPullEnabled: config.dockerSandboxAutoPull,
        sandboxRuntime: config.dockerSandboxRuntime || 'runc',
        canRun: true,
        detail: `daemon Docker acessivel e imagem ${image} pronta para ${language}. Runtime: ${config.dockerSandboxRuntime || 'runc (padrao)'}.`,
      };
    }

    return {
      enabled: true,
      language,
      image,
      dockerReachable: true,
      daemonReachable: true,
      imagePresent: false,
      autoPullEnabled: config.dockerSandboxAutoPull,
      sandboxRuntime: config.dockerSandboxRuntime || 'runc',
      canRun: false,
      detail: config.dockerSandboxAutoPull
        ? `imagem ${image} ausente; auto-pull habilitado para a primeira execucao.`
        : `imagem ${image} ausente; rode "docker pull ${image}" ou habilite ZAVORTH_DOCKER_SANDBOX_AUTO_PULL.`,
    };
  }

  public getImageForLanguage(language: SandboxLanguage): string {
    if (language === 'python') {
      return config.dockerSandboxPythonImage;
    }

    if (language === 'shell') {
      return config.dockerSandboxShellImage;
    }

    return config.dockerSandboxJavascriptImage;
  }

  public buildWrappedCommand(
    command: string,
    workspace: string,
    language: SandboxLanguage = 'javascript',
  ): string {
    const invocation = this.buildWrappedInvocation(command, workspace, language);
    const dockerCli =
      process.platform === 'win32' && !String(invocation.command || '').includes(' ')
        ? invocation.command
        : `"${String(invocation.command || 'docker').replace(/"/g, '\\"')}"`;

    return [
      dockerCli,
      ...invocation.args.map((arg) => {
        if (!/[\s"]/g.test(arg)) {
          return arg;
        }
        return `"${arg.replace(/"/g, '\\"')}"`;
      }),
    ].join(' ');
  }

  public buildWrappedInvocation(
    command: string,
    workspace: string,
    language: SandboxLanguage = 'javascript',
  ): { command: string; args: string[] } {
    const hostWorkspace = this.normalizeHostMountPath(workspace);
    const image = this.getImageForLanguage(language);

    return {
      command: String(config.dockerCliPath || 'docker'),
      args: [
        'run',
        '--rm',
        ...this.buildHardenedArgs(),
        '-v',
        `${hostWorkspace}:${config.dockerSandboxWorkspacePath}:ro`,
        '-w',
        config.dockerSandboxWorkspacePath,
        image,
        'sh',
        '-lc',
        command,
      ],
    };
  }

  public buildLegacyWrappedCommand(
    command: string,
    workspace: string,
    language: SandboxLanguage = 'javascript',
  ): string {
    const quotedWorkspace = this.normalizeHostMountPath(workspace).replace(/"/g, '""');
    const escapedCommand = command.replace(/"/g, '\\"');
    const image = this.getImageForLanguage(language);
    const dockerCli =
      process.platform === 'win32' && !String(config.dockerCliPath || '').includes(' ')
        ? String(config.dockerCliPath || 'docker')
        : `"${String(config.dockerCliPath || 'docker').replace(/"/g, '\\"')}"`;

    const hardenParts: string[] = [];
    if (config.dockerSandboxRuntime) {
      hardenParts.push(`--runtime ${config.dockerSandboxRuntime}`);
    }
    if (config.dockerSandboxCapDropAll) {
      hardenParts.push('--cap-drop ALL');
    }
    if (config.dockerSandboxNoNewPrivileges) {
      hardenParts.push('--security-opt no-new-privileges');
    }
    if (config.dockerSandboxReadOnly) {
      hardenParts.push('--read-only', '--tmpfs /tmp:rw,noexec,nosuid,size=64m');
    }

    return [
      `${dockerCli} run --rm`,
      ...hardenParts,
      '--network none',
      `--memory ${Math.max(256, config.dockerSandboxMemoryMb)}m`,
      `--cpus ${config.dockerSandboxCpuLimit}`,
      `--pids-limit ${Math.max(16, config.dockerSandboxPidsLimit)}`,
      `-v "${quotedWorkspace}:${config.dockerSandboxWorkspacePath}:ro"`,
      `-w ${config.dockerSandboxWorkspacePath}`,
      image,
      `sh -lc "${escapedCommand}"`,
    ].join(' ');
  }

  public async execute(request: SandboxRequest): Promise<SandboxResult> {
    const status = this.getStatus(request.language);
    if (!status.enabled) {
      throw new Error(status.detail);
    }
    if (!status.daemonReachable) {
      throw new Error(status.detail);
    }

    const image = await this.ensureImageReady(request.language);
    const tempDir = path.join(this.tempBasePath, `ctr_${uuidv4().slice(0, 8)}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const prepared = this.prepareScript(request.language, request.code, tempDir);
    const containerWorkspace = config.dockerSandboxWorkspacePath;
    const hostMount = this.normalizeHostMountPath(tempDir);
    const dockerArgs = [
      'run',
      '--rm',
      ...this.buildHardenedArgs(),
      '-v',
      `${hostMount}:${containerWorkspace}`,
      '-w',
      containerWorkspace,
      image,
      prepared.entryCommand,
      ...prepared.entryArgs,
    ];

    const startedAt = Date.now();

    try {
      const result = await this.asyncRunner(
        config.dockerCliPath,
        dockerArgs,
        request.timeoutMs || 20_000,
      );
      return {
        ...result,
        executionTimeMs: Date.now() - startedAt,
        securityLevel: this.securityLevel,
        runtime: 'DockerSandboxRuntime',
      };
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (error) { // ignore cleanup failures for ephemeral docker sandboxes logger.warn('[Docker Sandbox Runtime] process execution failed', error); }
    }
  }

  private async ensureImageReady(language: SandboxLanguage): Promise<string> {
    const status = this.getStatus(language);
    if (status.canRun) {
      return status.image;
    }

    if (!status.daemonReachable) {
      throw new Error(status.detail);
    }

    if (!config.dockerSandboxAutoPull) {
      throw new Error(status.detail);
    }

    const pullResult = this.runDockerSync(['pull', status.image], config.dockerSandboxPullTimeoutMs);

    if (pullResult.status !== 0) {
      throw new Error(
        `nao foi possivel baixar a imagem ${status.image}: ${this.formatDockerError(pullResult)}`,
      );
    }

    this.imageReadyCache.add(status.image);
    return status.image;
  }

  private prepareScript(language: SandboxLanguage, code: string, tempDir: string): {
    entryCommand: string;
    entryArgs: string[];
  } {
    if (language === 'javascript') {
      fs.writeFileSync(path.join(tempDir, 'index.js'), code, 'utf8');
      return {
        entryCommand: 'node',
        entryArgs: ['index.js'],
      };
    }

    if (language === 'python') {
      fs.writeFileSync(path.join(tempDir, 'main.py'), code, 'utf8');
      return {
        entryCommand: 'python',
        entryArgs: ['main.py'],
      };
    }

    fs.writeFileSync(path.join(tempDir, 'script.sh'), `#!/usr/bin/env bash\nset -e\n${code}\n`, 'utf8');
    return {
      entryCommand: 'bash',
      entryArgs: ['script.sh'],
    };
  }

  private formatDockerError(result: DockerSyncResult): string {
    return String(result.stderr || result.stdout || 'sem detalhes').trim();
  }

  private runDockerSync(
    args: string[],
    timeoutMs: number,
    options: {
      allowRetryOnTimeout?: boolean;
      useColdStartFloor?: boolean;
    } = {},
  ): DockerSyncResult {
    const initialTimeout =
      options.useColdStartFloor && process.platform === 'win32'
        ? Math.max(timeoutMs, DockerSandboxRuntime.WINDOWS_COLD_START_PROBE_TIMEOUT_MS)
        : timeoutMs;

    let result = this.syncRunner(config.dockerCliPath, args, initialTimeout);
    if (options.allowRetryOnTimeout && this.isTimeoutResult(result)) {
      const retryTimeout = Math.max(initialTimeout * 2, DockerSandboxRuntime.RETRY_PROBE_TIMEOUT_MS);
      result = this.syncRunner(config.dockerCliPath, args, retryTimeout);
    }

    return result;
  }

  private getCachedVersionProbe(): DockerSyncResult {
    if (
      this.versionProbeCache
      && (this.now() - this.versionProbeCache.checkedAt) < DockerSandboxRuntime.STATUS_PROBE_CACHE_TTL_MS
    ) {
      return this.versionProbeCache.result;
    }

    const result = this.runDockerSync(
      ['version', '--format', '{{.Server.Version}}'],
      config.dockerSandboxProbeTimeoutMs,
      { allowRetryOnTimeout: true, useColdStartFloor: true },
    );
    this.versionProbeCache = {
      checkedAt: this.now(),
      result,
    };
    return result;
  }

  private isTimeoutResult(result: DockerSyncResult): boolean {
    const error = result.error as DockerExecError | undefined;
    const errorCode = String(error?.code || '').toUpperCase();
    const errorMessage = String(error?.message || '').toUpperCase();
    return errorCode === 'ETIMEDOUT' || errorMessage.includes('ETIMEDOUT');
  }

  private shouldUseWindowsShell(command: string): boolean {
    return process.platform === 'win32' && /\.(cmd|bat)$/i.test(String(command || ''));
  }

  private defaultSyncRunner(command: string, args: string[], timeoutMs: number): DockerSyncResult {
    try {
      const output = this.shouldUseWindowsShell(command)
        ? execCommandSync(command, args, {
            timeout: timeoutMs,
            windowsHide: true,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
          })
        : execNativeCommandSync(command, args, {
            timeout: timeoutMs,
            windowsHide: true,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
          });
      return {
        status: 0,
        stdout: String(output || ''),
        stderr: '',
      };
    } catch (error: unknown) {
      const execError = error as DockerExecError;
      return {
        status: typeof execError?.status === 'number' ? execError.status : null,
        stdout: String(execError?.stdout || ''),
        stderr: String(execError?.stderr || ''),
        error: execError as Error,
      };
    }
  }

  private defaultAsyncRunner(
    command: string,
    args: string[],
    timeoutMs: number,
  ): Promise<DockerAsyncResult> {
    return new Promise((resolve) => {
      const child = this.shouldUseWindowsShell(command)
        ? spawnCommand(command, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
          })
        : spawnNativeCommand(command, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
          });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      const timeout = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch (error) { // ignore timeout kill failures logger.warn('[Docker Sandbox Runtime] operation failed', error); }

        resolve({
          stdout,
          stderr: `${stderr}\n[DockerSandbox] Timeout apos ${timeoutMs}ms.`,
          exitCode: null,
        });
      }, timeoutMs);

      child.on('close', (code) => {
        clearTimeout(timeout);
        resolve({ stdout, stderr, exitCode: code });
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          stdout,
          stderr: `${stderr}\n[DockerSandbox] Falha ao iniciar processo Docker: ${error.message}`,
          exitCode: -1,
        });
      });
    });
  }
}
