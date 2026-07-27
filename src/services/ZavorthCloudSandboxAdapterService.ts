
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

export type ZavorthCloudSandboxProviderId =
  | 'local'
  | 'local-docker'
  | 'daytona'
  | 'modal'
  | 'external';

export type ZavorthCloudSandboxLanguage = 'node' | 'python' | 'bash' | 'go';

export type ZavorthCloudSandboxNetworkPolicy = 'none' | 'egress';

export type ZavorthCloudSandboxProviderDescriptor = {
  id: ZavorthCloudSandboxProviderId;
  label: string;
  enabled: boolean;
  configured: boolean;
  cloud: boolean;
  sdkPackage: string | null;
  installCommand: string | null;
  disabledReason: string | null;
};

export type ZavorthCloudSandboxExecutorInput = {
  provider: ZavorthCloudSandboxProviderId;
  code: string;
  language: ZavorthCloudSandboxLanguage;
  timeoutMs: number;
  memoryMb: number;
  ttlMs: number;
  network: ZavorthCloudSandboxNetworkPolicy;
  env: Record<string, string>;
};

export type ZavorthCloudSandboxExecutorOutput = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

export type ZavorthCloudSandboxExecutionInput = {
  provider?: string | null;
  code: string;
  language?: string | null;
  timeoutMs?: number | null;
  memoryMb?: number | null;
  ttlMs?: number | null;
  network?: string | null;
  env?: Record<string, string> | null;
};

export type ZavorthCloudSandboxExecutionResult = {
  status: 'completed' | 'failed' | 'blocked';
  provider: ZavorthCloudSandboxProviderId;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  message: string;
  limits: {
    timeoutMs: number;
    memoryMb: number;
    ttlMs: number;
    network: ZavorthCloudSandboxNetworkPolicy;
  };
  redaction: {
    envSecretsStripped: true;
    rawSecretSerialized: false;
  };
};

type Runtime = {
  env?: Record<string, string | undefined>;
  now?: () => number;
  importer?: (moduleName: string) => Promise<any>;
  localExecutor?: (input: ZavorthCloudSandboxExecutorInput) => Promise<ZavorthCloudSandboxExecutorOutput>;
  localDockerExecutor?: (input: ZavorthCloudSandboxExecutorInput) => Promise<ZavorthCloudSandboxExecutorOutput>;
  fetcher?: typeof fetch;
};

type ProviderConfig = {
  id: ZavorthCloudSandboxProviderId;
  label: string;
  cloud: boolean;
  enabled: boolean;
  configured: boolean;
  sdkPackage: string | null;
  installCommand: string | null;
  disabledReason: string | null;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MEMORY_MB = 256;
const DEFAULT_TTL_MS = 10 * 60_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 15 * 60_000;
const MIN_MEMORY_MB = 128;
const MAX_MEMORY_MB = 16 * 1024;
const MIN_TTL_MS = 5_000;
const MAX_TTL_MS = 24 * 60 * 60_000;

export class ZavorthCloudSandboxAdapterService {
  private readonly env: Record<string, string | undefined>;
  private readonly now: () => number;
  private readonly importer: (moduleName: string) => Promise<any>;
  private readonly localExecutor: (input: ZavorthCloudSandboxExecutorInput) => Promise<ZavorthCloudSandboxExecutorOutput>;
  private readonly localDockerExecutor: (input: ZavorthCloudSandboxExecutorInput) => Promise<ZavorthCloudSandboxExecutorOutput>;
  private readonly fetcher: typeof fetch;

  public constructor(runtime: Runtime = {}) {
    this.env = runtime.env || process.env;
    this.now = runtime.now || (() => Date.now());
    this.importer = runtime.importer || ((moduleName) => import(moduleName));
    this.localExecutor = runtime.localExecutor || defaultLocalExecutor;
    this.localDockerExecutor = runtime.localDockerExecutor || defaultLocalDockerExecutor;
    this.fetcher = runtime.fetcher || fetch;
  }

  public listProviders(): ZavorthCloudSandboxProviderDescriptor[] {
    return this.providerConfigs().map((provider) => ({ ...provider }));
  }

  public sanitizeEnv(input: Record<string, string> | null | undefined): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [rawKey, rawValue] of Object.entries(input || {})) {
      const key = String(rawKey || '').trim();
      if (!isValidEnvName(key) || isSecretEnvName(key)) {
        continue;
      }
      sanitized[key] = String(rawValue ?? '').slice(0, 4096);
    }
    return sanitized;
  }

  public resolveProvider(requested?: string | null): ZavorthCloudSandboxProviderId {
    const explicit = normalizeProvider(requested);
    if (explicit) {
      return explicit;
    }

    const configuredDefault = normalizeProvider(this.env.ZAVORTH_SANDBOX_CLOUD_DEFAULT_PROVIDER);
    if (!configuredDefault) {
      return 'local-docker';
    }

    const descriptor = this.providerConfig(configuredDefault);
    if (descriptor.cloud && !descriptor.enabled) {
      return 'local-docker';
    }
    return configuredDefault;
  }

  public async execute(input: ZavorthCloudSandboxExecutionInput): Promise<ZavorthCloudSandboxExecutionResult> {
    const provider = this.resolveProvider(input.provider);
    const code = String(input.code || '');
    const startedAt = this.now();
    const limits = normalizeLimits(input, provider);
    const sanitizedEnv = this.sanitizeEnv(input.env);

    if (!code.trim()) {
      return this.result('blocked', provider, startedAt, limits, {
        stdout: '',
        stderr: '',
        exitCode: null,
        message: 'Code is required for sandbox execution.',
      });
    }

    const descriptor = this.providerConfig(provider);
    if (descriptor.cloud && !descriptor.enabled) {
      return this.result('blocked', provider, startedAt, limits, {
        stdout: '',
        stderr: '',
        exitCode: null,
        message: descriptor.disabledReason || `${descriptor.label} is disabled by default.`,
      });
    }

    try {
      const request: ZavorthCloudSandboxExecutorInput = {
        provider,
        code,
        language: normalizeLanguage(input.language),
        timeoutMs: limits.timeoutMs,
        memoryMb: limits.memoryMb,
        ttlMs: limits.ttlMs,
        network: limits.network,
        env: sanitizedEnv,
      };
      const output = await this.executeWithProvider(request);
      return this.result(output.exitCode === 0 ? 'completed' : 'failed', provider, startedAt, limits, {
        ...output,
        message: output.exitCode === 0
          ? `${descriptor.label} sandbox execution completed.`
          : `${descriptor.label} sandbox execution exited non-zero.`,
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = redactSecrets(error instanceof Error ? err.message : String(error));
      return this.result('blocked', provider, startedAt, limits, {
        stdout: '',
        stderr: '',
        exitCode: null,
        message,
      });
    }
  }

  private async executeWithProvider(
    input: ZavorthCloudSandboxExecutorInput,
  ): Promise<ZavorthCloudSandboxExecutorOutput> {
    switch (input.provider) {
      case 'local':
        return this.localExecutor(input);
      case 'local-docker':
        return this.localDockerExecutor(input);
      case 'modal':
        return this.executeModal(input);
      case 'daytona':
        return this.executeDaytona(input);
      case 'external':
        return this.executeExternal(input);
    }
  }

  private async executeModal(
    input: ZavorthCloudSandboxExecutorInput,
  ): Promise<ZavorthCloudSandboxExecutorOutput> {
    const sdkPackage = String(this.env.ZAVORTH_MODAL_SDK_PACKAGE || 'modal');
    const mod = await this.importSdk(sdkPackage, 'npm install modal');
    const ModalClient = mod.ModalClient || mod.default?.ModalClient;
    if (typeof ModalClient !== 'function') {
      throw new Error(`Modal SDK package "${sdkPackage}" does not expose ModalClient. Update the package or set ZAVORTH_MODAL_SDK_PACKAGE to a compatible module.`);
    }

    const modal = new ModalClient();
    const appName = String(this.env.ZAVORTH_MODAL_APP || 'zavorth-sandbox');
    const imageName = String(this.env.ZAVORTH_MODAL_IMAGE || imageForLanguage(input.language));
    const app = await modal.apps.fromName(appName, { createIfMissing: true });
    const image = modal.images.fromRegistry(imageName);
    const sandbox = await modal.sandboxes.create(app, image, {
      environment: input.env,
      timeout: Math.ceil(input.ttlMs / 1000),
      networkAccess: input.network === 'egress',
      memory: input.memoryMb,
    });

    try {
      const process = await sandbox.exec(commandForLanguage(input.language, input.code), {
        timeout: Math.ceil(input.timeoutMs / 1000),
      });
      return {
        stdout: await readProcessText(process.stdout),
        stderr: await readProcessText(process.stderr),
        exitCode: normalizeExitCode(process.returncode ?? process.exitCode ?? process.status),
      };
    } finally {
      if (typeof sandbox.terminate === 'function') {
        await sandbox.terminate();
      }
    }
  }

  private async executeDaytona(
    input: ZavorthCloudSandboxExecutorInput,
  ): Promise<ZavorthCloudSandboxExecutorOutput> {
    const sdkPackage = String(this.env.ZAVORTH_DAYTONA_SDK_PACKAGE || '@daytona/sdk');
    const mod = await this.importSdk(sdkPackage, 'npm install @daytona/sdk');
    const Daytona = mod.Daytona || mod.default?.Daytona || mod.default;
    if (typeof Daytona !== 'function') {
      throw new Error(`Daytona SDK package "${sdkPackage}" does not expose Daytona. Update the package or set ZAVORTH_DAYTONA_SDK_PACKAGE to a compatible module.`);
    }

    const apiKey = String(this.env.ZAVORTH_DAYTONA_API_KEY || this.env.DAYTONA_API_KEY || '');
    const daytona = new Daytona({
      apiKey,
      apiUrl: this.env.ZAVORTH_DAYTONA_API_URL || this.env.DAYTONA_API_URL,
      target: this.env.ZAVORTH_DAYTONA_TARGET || this.env.DAYTONA_TARGET,
    });
    const sandbox = await daytona.create({
      language: daytonaLanguage(input.language),
      envVars: input.env,
      resources: {
        memory: input.memoryMb,
      },
      autoStopInterval: Math.ceil(input.ttlMs / 1000),
      network: input.network,
    });

    try {
      const response = await sandbox.process.executeCommand(commandLineForLanguage(input.language, input.code), {
        timeout: Math.ceil(input.timeoutMs / 1000),
      });
      return {
        stdout: String(response.result ?? response.stdout ?? ''),
        stderr: String(response.stderr ?? ''),
        exitCode: normalizeExitCode(response.exitCode ?? response.code ?? 0),
      };
    } finally {
      await cleanupDaytonaSandbox(daytona, sandbox);
    }
  }

  private async executeExternal(
    input: ZavorthCloudSandboxExecutorInput,
  ): Promise<ZavorthCloudSandboxExecutorOutput> {
    const endpoint = String(this.env.ZAVORTH_EXTERNAL_SANDBOX_ENDPOINT || '').trim();
    if (!endpoint) {
      throw new Error('External sandbox is disabled. Set ZAVORTH_EXTERNAL_SANDBOX_ENABLED=true and ZAVORTH_EXTERNAL_SANDBOX_ENDPOINT to use it.');
    }
    validateExternalSandboxEndpoint(endpoint);

    const response = await this.fetcher(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: input.code,
        language: input.language,
        env: input.env,
        limits: {
          timeoutMs: input.timeoutMs,
          memoryMb: input.memoryMb,
          ttlMs: input.ttlMs,
          network: input.network,
        },
      }),
    });
    const payload = await response.json() as Partial<ZavorthCloudSandboxExecutorOutput>;
    return {
      stdout: String(payload.stdout || ''),
      stderr: String(payload.stderr || ''),
      exitCode: typeof payload.exitCode === 'number' ? payload.exitCode : response.ok ? 0 : 1,
    };
  }

  private async importSdk(moduleName: string, installCommand: string): Promise<any> {
    try {
      return await this.importer(moduleName);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const code = (error as NodeJS.ErrnoException)?.code;
      const message = error instanceof Error ? err.message : String(error);
      if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND' || /cannot find module/i.test(message)) {
        throw new Error(`SDK package "${moduleName}" is not installed. Install it with "${installCommand}" and configure the provider before retrying.`);
      }
      throw error;
    }
  }

  private providerConfig(provider: ZavorthCloudSandboxProviderId): ProviderConfig {
    return this.providerConfigs().find((entry) => entry.id === provider)!;
  }

  private providerConfigs(): ProviderConfig[] {
    const modalFlag = isTruthy(this.env.ZAVORTH_MODAL_SANDBOX_ENABLED);
    const modalCredentialed = (
      Boolean(String(this.env.MODAL_TOKEN_ID || '').trim())
      && Boolean(String(this.env.MODAL_TOKEN_SECRET || '').trim())
    ) || Boolean(String(this.env.MODAL_TOKEN || this.env.ZAVORTH_MODAL_TOKEN || '').trim());
    const daytonaFlag = isTruthy(this.env.ZAVORTH_DAYTONA_SANDBOX_ENABLED);
    const daytonaCredentialed = Boolean(String(this.env.DAYTONA_API_KEY || this.env.ZAVORTH_DAYTONA_API_KEY || '').trim());
    const externalFlag = isTruthy(this.env.ZAVORTH_EXTERNAL_SANDBOX_ENABLED);
    const externalEndpoint = Boolean(String(this.env.ZAVORTH_EXTERNAL_SANDBOX_ENDPOINT || '').trim());

    return [
      {
        id: 'local',
        label: 'local supervised sandbox',
        enabled: true,
        configured: true,
        cloud: false,
        sdkPackage: null,
        installCommand: null,
        disabledReason: null,
      },
      {
        id: 'local-docker',
        label: 'local Docker sandbox',
        enabled: true,
        configured: true,
        cloud: false,
        sdkPackage: null,
        installCommand: null,
        disabledReason: null,
      },
      {
        id: 'daytona',
        label: 'Daytona cloud sandbox',
        enabled: daytonaFlag && daytonaCredentialed,
        configured: daytonaCredentialed,
        cloud: true,
        sdkPackage: String(this.env.ZAVORTH_DAYTONA_SDK_PACKAGE || '@daytona/sdk'),
        installCommand: 'npm install @daytona/sdk',
        disabledReason: daytonaFlag ? 'Daytona cloud sandbox is missing DAYTONA_API_KEY or ZAVORTH_DAYTONA_API_KEY.'
          : 'Daytona cloud sandbox is disabled by default. Set ZAVORTH_DAYTONA_SANDBOX_ENABLED=true and DAYTONA_API_KEY or ZAVORTH_DAYTONA_API_KEY to enable it.',
      },
      {
        id: 'modal',
        label: 'Modal cloud sandbox',
        enabled: modalFlag && modalCredentialed,
        configured: modalCredentialed,
        cloud: true,
        sdkPackage: String(this.env.ZAVORTH_MODAL_SDK_PACKAGE || 'modal'),
        installCommand: 'npm install modal',
        disabledReason: modalFlag ? 'Modal cloud sandbox is missing MODAL_TOKEN_ID/MODAL_TOKEN_SECRET or MODAL_TOKEN.'
          : 'Modal cloud sandbox is disabled by default. Set ZAVORTH_MODAL_SANDBOX_ENABLED=true and Modal credentials to enable it.',
      },
      {
        id: 'external',
        label: 'External cloud sandbox',
        enabled: externalFlag && externalEndpoint,
        configured: externalEndpoint,
        cloud: true,
        sdkPackage: null,
        installCommand: null,
        disabledReason: externalFlag ? 'External cloud sandbox is missing ZAVORTH_EXTERNAL_SANDBOX_ENDPOINT.'
          : 'External cloud sandbox is disabled by default. Set ZAVORTH_EXTERNAL_SANDBOX_ENABLED=true and ZAVORTH_EXTERNAL_SANDBOX_ENDPOINT to enable it.',
      },
    ];
  }

  private result(
    status: ZavorthCloudSandboxExecutionResult['status'],
    provider: ZavorthCloudSandboxProviderId,
    startedAt: number,
    limits: ZavorthCloudSandboxExecutionResult['limits'],
    output: ZavorthCloudSandboxExecutorOutput & { message: string },
  ): ZavorthCloudSandboxExecutionResult {
    return {
      status,
      provider,
      stdout: redactSecrets(output.stdout),
      stderr: redactSecrets(output.stderr),
      exitCode: output.exitCode,
      durationMs: Math.max(0, this.now() - startedAt),
      message: redactSecrets(output.message),
      limits,
      redaction: {
        envSecretsStripped: true,
        rawSecretSerialized: false,
      },
    };
  }
}

function normalizeProvider(value: unknown): ZavorthCloudSandboxProviderId | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'docker' || normalized === 'local_docker' || normalized === 'local-docker') return 'local-docker';
  if (normalized === 'local') return 'local';
  if (normalized === 'daytona') return 'daytona';
  if (normalized === 'modal') return 'modal';
  if (normalized === 'external' || normalized === 'remote') return 'external';
  return null;
}

function normalizeLanguage(value: unknown): ZavorthCloudSandboxLanguage {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'python' || normalized === 'py') return 'python';
  if (normalized === 'bash' || normalized === 'shell' || normalized === 'sh') return 'bash';
  if (normalized === 'go' || normalized === 'golang') return 'go';
  return 'node';
}

function normalizeLimits(
  input: ZavorthCloudSandboxExecutionInput,
  provider: ZavorthCloudSandboxProviderId,
): ZavorthCloudSandboxExecutionResult['limits'] {
  const timeoutMs = clampInteger(input.timeoutMs, DEFAULT_TIMEOUT_MS, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS);
  const defaultMemory = provider === 'local' ? DEFAULT_MEMORY_MB : Math.max(DEFAULT_MEMORY_MB, 512);
  const memoryMb = clampInteger(input.memoryMb, defaultMemory, MIN_MEMORY_MB, MAX_MEMORY_MB);
  const ttlMs = clampInteger(input.ttlMs, DEFAULT_TTL_MS, MIN_TTL_MS, MAX_TTL_MS);
  const network = String(input.network || '').trim().toLowerCase() === 'egress' ? 'egress' : 'none';
  return { timeoutMs, memoryMb, ttlMs, network };
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.floor(number), min), max);
}

function isTruthy(value: unknown): boolean {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

function isValidEnvName(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function isSecretEnvName(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes('secret')
    || normalized.includes('token')
    || normalized.includes('password')
    || normalized.includes('credential')
    || normalized.includes('api_key')
    || normalized.endsWith('_key')
    || normalized.startsWith('aws_')
    || normalized.includes('private');
}

function imageForLanguage(language: ZavorthCloudSandboxLanguage): string {
  if (language === 'python') return 'python:3.12-slim';
  if (language === 'bash') return 'bash:latest';
  if (language === 'go') return 'golang:1.22-alpine';
  return 'node:22-slim';
}

function daytonaLanguage(language: ZavorthCloudSandboxLanguage): string {
  if (language === 'python') return 'python';
  if (language === 'go') return 'go';
  return 'typescript';
}

function commandForLanguage(language: ZavorthCloudSandboxLanguage, code: string): string[] {
  if (language === 'python') return ['python', '-c', code];
  if (language === 'bash') return ['bash', '-lc', code];
  if (language === 'go') {
    return ['sh', '-lc', `cat > /tmp/zavorth-main.go <<'EOF'\n${code}\nEOF\ngo run /tmp/zavorth-main.go`];
  }
  return ['node', '-e', code];
}

function commandLineForLanguage(language: ZavorthCloudSandboxLanguage, code: string): string {
  return commandForLanguage(language, code).map(shellQuote).join(' ');
}

function shellQuote(value: string): string {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function validateExternalSandboxEndpoint(endpoint: string): void {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch (error: unknown) {throw new Error('External sandbox endpoint must be a valid URL.');
  }

  const host = url.hostname.toLowerCase();
  const isLoopback =
    host === 'localhost'
    || host === '127.0.0.1'
    || host === '::1'
    || host.endsWith('.localhost');
  if (url.protocol === 'https:' || isLoopback) {
    return;
  }

  throw new Error('External sandbox endpoint must use HTTPS unless it targets localhost.');
}

async function readProcessText(stream: unknown): Promise<string> {
  if (!stream) return '';
  if (typeof stream === 'string') return stream;
  if (typeof (stream as { readText?: unknown }).readText === 'function') {
    return String(await (stream as { readText: () => Promise<string> }).readText());
  }
  if (typeof (stream as { text?: unknown }).text === 'function') {
    return String(await (stream as { text: () => Promise<string> }).text());
  }
  return String(stream);
}

function normalizeExitCode(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function cleanupDaytonaSandbox(daytona: any, sandbox: any): Promise<void> {
  if (typeof sandbox.delete === 'function') {
    await sandbox.delete();
    return;
  }
  if (typeof sandbox.stop === 'function') {
    await sandbox.stop();
    return;
  }
  if (typeof sandbox.destroy === 'function') {
    await sandbox.destroy();
    return;
  }
  if (typeof daytona.delete === 'function') {
    await daytona.delete(sandbox);
  }
}

async function defaultLocalExecutor(
  input: ZavorthCloudSandboxExecutorInput,
): Promise<ZavorthCloudSandboxExecutorOutput> {
  const ext = input.language === 'python' ? '.py' : input.language === 'bash' ? '.sh' : input.language === 'go' ? '.go' : '.js';
  const scriptFile = path.join(os.tmpdir(), `zavorth_sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  fs.writeFileSync(scriptFile, input.code, 'utf8');
  try {
    const command = localCommand(input.language);
    const output = execFileSync(command[0], [...command.slice(1), scriptFile], {
      timeout: input.timeoutMs,
      maxBuffer: 5 * 1024 * 1024,
      env: {
        ...minimalLocalEnv(),
        ...input.env,
      },
      windowsHide: true,
      encoding: 'utf8',
    });
    return { stdout: String(output), stderr: '', exitCode: 0 };
  } finally {
    try {
      fs.unlinkSync(scriptFile);
    } catch (error: unknown) {// ignore cleanup failures for temporary sandbox files
      logger.warn('[Zavorth Cloud Sandbox Adapter] file cleanup failed', error);
    }
  }
}

async function defaultLocalDockerExecutor(
  input: ZavorthCloudSandboxExecutorInput,
): Promise<ZavorthCloudSandboxExecutorOutput> {
  const ext = input.language === 'python' ? '.py' : input.language === 'bash' ? '.sh' : input.language === 'go' ? '.go' : '.js';
  const scriptFile = path.join(os.tmpdir(), `zavorth_sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  fs.writeFileSync(scriptFile, input.code, 'utf8');
  try {
    const containerPath = `/code/script${ext}`;
    const args = [
      'run',
      '--rm',
      '--network',
      input.network === 'egress' ? 'bridge' : 'none',
      '--memory',
      `${input.memoryMb}m`,
      '--cpus',
      '0.5',
      '-v',
      `${scriptFile}:${containerPath}:ro`,
      imageForLanguage(input.language),
      ...dockerEntry(input.language, containerPath),
    ];
    const output = execFileSync('docker', args, {
      timeout: input.timeoutMs,
      maxBuffer: 5 * 1024 * 1024,
      windowsHide: true,
      encoding: 'utf8',
    });
    return { stdout: String(output), stderr: '', exitCode: 0 };
  } finally {
    try {
      fs.unlinkSync(scriptFile);
    } catch (error: unknown) {// ignore cleanup failures for temporary sandbox files
      logger.warn('[Zavorth Cloud Sandbox Adapter] file cleanup failed', error);
    }
  }
}

function localCommand(language: ZavorthCloudSandboxLanguage): string[] {
  if (language === 'python') return [process.platform === 'win32' ? 'python' : 'python3'];
  if (language === 'bash') return [process.platform === 'win32' ? 'bash' : 'bash'];
  if (language === 'go') return ['go', 'run'];
  return ['node'];
}

function dockerEntry(language: ZavorthCloudSandboxLanguage, filePath: string): string[] {
  if (language === 'python') return ['python', filePath];
  if (language === 'bash') return ['bash', filePath];
  if (language === 'go') return ['go', 'run', filePath];
  return ['node', filePath];
}

function minimalLocalEnv(): Record<string, string> {
  const env: Record<string, string> = {
    PATH: process.env.PATH || process.env.Path || '',
    NO_COLOR: '1',
  };
  if (process.platform === 'win32') {
    env.SystemRoot = process.env.SystemRoot || 'C:\\Windows';
    env.ComSpec = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';
    env.PATHEXT = process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD';
  } else {
    env.HOME = os.tmpdir();
  }
  return env;
}

function redactSecrets(value: string): string {
  return String(value || '')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted-secret]')
    .replace(/\bhf_[A-Za-z0-9]{8,}\b/g, '[redacted-secret]')
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g, '[redacted-secret]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{8,}\b/g, '[redacted-secret]')
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, '[redacted-secret]')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[redacted-secret]')
    .replace(/\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g, '[redacted-secret]');
}
