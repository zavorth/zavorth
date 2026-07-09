import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { config } from '../config/index.js';
import { spawnCommand } from '../core/CommandSpawn.js';
import type { DockerSandboxStatus, DockerSandboxRuntime } from '../services/sandbox/DockerSandboxRuntime.js';
import type {
  ZavorthSpeculativeValidationResult,
  ZavorthSpeculativeCommandRunnerInput,
  ZavorthSpeculativeDockerValidationRunnerInput,
  ZavorthSpeculativeSandboxBackendReceipt,
  ZavorthSpeculativeSandboxIsolation,
  ParsedSpeculativeValidationCommand,
  ZavorthSpeculativeCommandRunner,
  ZavorthSpeculativeDockerValidationRunner,
} from './ZavorthSpeculativeAutonomyService.js';
import { asErrorLike } from '../utils/errorLike.js';

const MAX_VALIDATION_COMMANDS = 3;
const MAX_AST_FILES = 80;
const MAX_DIFF_CHARS = 100000;
const MAX_STDIO_CHARS = 12000;
const MAX_EDIT_BYTES = 1024 * 1024;

const IGNORED_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-ops',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
  '.tmp',
  'tmp',
]);

const IGNORED_RELATIVE_PREFIXES = [
  'data/runtime/',
  'data\\runtime\\',
];

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts'];

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizePortablePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\//g, '/');
}

function looksLikeSecret(value: string): boolean {
  return /\b(?:\.env|id_rsa|credentials\.json|secrets?\.json|token|secret|password|api[_-]?key|sk-[a-z0-9_-]{12,})\b/i.test(value);
}

function clampText(value: unknown, maxChars = MAX_STDIO_CHARS): string {
  const text = String(value ?? '');
  return text.length <= maxChars ? text : text.slice(0, maxChars - 20) + '\n[truncated]';
}

function normalizeSandboxIsolation(value: unknown): 'container' | 'local-copy' | 'microvm' | 'auto' {
  const text = normalizeText(value).toLowerCase();
  if (text === 'container' || text === 'docker') {
    return 'container';
  }
  if (text === 'host' || text === 'local' || text === 'local-copy') {
    return 'local-copy';
  }
  if (text === 'microvm' || text === 'firecracker') {
    return 'microvm';
  }
  return 'auto';
}

function redactSensitiveText(value: unknown, maxChars = MAX_STDIO_CHARS): string {
  let text = clampText(value, maxChars);
  text = text.replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[redacted-secret]');
  text = text.replace(/\b(?:ghp|github_pat|glpat|xox[baprs])-[A-Za-z0-9_-]{12,}\b/gi, '[redacted-secret]');
  text = text.replace(/\bAKIA[0-9A-Z]{16}\b/g, '[redacted-secret]');
  text = text.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/gi, 'Bearer [redacted-secret]');
  text = text.replace(
    /\b((?:api[_-]?key|token|secret|password|passwd|credential)\s*[:=]\s*["']?)([^"'\s]{6,})/gi,
    '$1[redacted-secret]',
  );
  return text;
}

function redactValidationResult(result: ZavorthSpeculativeValidationResult): ZavorthSpeculativeValidationResult {
  return {
    ...result,
    command: redactSensitiveText(result.command, 1200),
    stdout: redactSensitiveText(result.stdout),
    stderr: redactSensitiveText(result.stderr),
  };
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function skippedValidation(reason: string): ZavorthSpeculativeValidationResult {
  return {
    command: 'skipped',
    status: 'skipped',
    exitCode: null,
    stdout: '',
    stderr: reason,
    durationMs: 0,
  };
}

export async function runValidationCommands(input: {
    originalWorkspace: string;
    sandboxWorkspace: string;
    commands: string[];
    sandboxBackend: ZavorthSpeculativeSandboxBackendReceipt;
    timeoutMs: number;
    commandRunner: ZavorthSpeculativeCommandRunner;
    dockerRunner: ZavorthSpeculativeDockerValidationRunner;
  }): Promise<ZavorthSpeculativeValidationResult[]> {
    if (input.commands.length === 0) {
      return [skippedValidation('No validation command was detected for this workspace.')];
    }
    const results: ZavorthSpeculativeValidationResult[] = [];
    for (const command of input.commands.slice(0, MAX_VALIDATION_COMMANDS)) {
      const parsed = parseSpeculativeValidationCommand(command);
      if (!parsed) {
        results.push({
          command: redactSensitiveText(command, 1200),
          status: 'blocked',
          exitCode: 126,
          stdout: '',
          stderr: 'Validation command blocked because it contains advanced shell syntax or a command outside the allowlist.',
          durationMs: 0,
        });
        continue;
      }
      if (input.sandboxBackend.validationExecution === 'blocked') {
        results.push({
          command: redactSensitiveText(command, 1200),
          status: 'blocked',
          exitCode: 126,
          stdout: '',
          stderr: input.sandboxBackend.detail,
          durationMs: 0,
        });
        continue;
      }

      const result = input.sandboxBackend.validationExecution === 'container'
        ? await runDockerValidationCommand({
          command,
          parsed,
          sandboxWorkspace: input.sandboxWorkspace,
          sandboxBackend: input.sandboxBackend,
          timeoutMs: input.timeoutMs,
          dockerRunner: input.dockerRunner,
        })
        : await input.commandRunner({
          command,
          cwd: input.sandboxWorkspace,
          timeoutMs: input.timeoutMs,
          env: buildValidationEnv(input.originalWorkspace),
        });
      results.push(redactValidationResult(result));
    }
    return results;
  }

export function buildValidationEnv(originalWorkspace: string): NodeJS.ProcessEnv {
    const nodeBin = path.join(originalWorkspace, 'node_modules', '.bin');
    const nodePath = path.join(originalWorkspace, 'node_modules');
    return {
      ...process.env,
      CI: 'true',
      NODE_PATH: [nodePath, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
      PATH: [nodeBin, process.env.PATH].filter(Boolean).join(path.delimiter),
    };
  }

export function resolveSandboxBackend(input: {
    requested: ZavorthSpeculativeSandboxIsolation;
    validationMode: 'auto' | 'provided' | 'skip';
    dockerRuntime: Pick<DockerSandboxRuntime, 'getStatus'> | null;
  }): ZavorthSpeculativeSandboxBackendReceipt {
    const requested = normalizeSandboxIsolation(input.requested);
    if (input.validationMode === 'skip') {
      return {
        ...buildLocalSandboxReceipt(requested, 'Validation was explicitly skipped; no backend executed commands.'),
        validationExecution: 'skipped',
      };
    }

    if (requested === 'local-copy') {
      return buildLocalSandboxReceipt(requested, 'The speculative sandbox uses a governed temporary local copy.');
    }

    if (requested === 'microvm') {
      return {
        kind: 'microvm',
        requested,
        validationExecution: 'blocked',
        runtime: 'FirecrackerWorkspaceBackend',
        hardened: true,
        detail: 'A microVM was requested, but the Firecracker speculative workspace backend is not available on this host yet. Use container or local-copy.',
        fallbackFrom: null,
        docker: null,
      };
    }

    const dockerStatus = safeDockerStatus(input.dockerRuntime);
    if (dockerStatus && canUseDockerForSpeculativeValidation(dockerStatus)) {
      return {
        kind: 'container',
        requested,
        validationExecution: 'container',
        runtime: 'DockerSpeculativeSandboxBackend',
        hardened: true,
        detail: `Speculative validation will run in a hardened Docker container (${dockerStatus.sandboxRuntime || 'runc'}), without network access, with a temporary workspace mounted rw.`,
        fallbackFrom: null,
        docker: {
          image: dockerStatus.image,
          sandboxRuntime: dockerStatus.sandboxRuntime || 'runc',
          daemonReachable: dockerStatus.daemonReachable,
          canRun: dockerStatus.canRun,
          network: 'none',
          readOnlyRootfs: config.dockerSandboxReadOnly,
        },
      };
    }

    if (requested === 'container' || config.dockerSandboxRequired) {
      return {
        kind: 'container',
        requested,
        validationExecution: 'blocked',
        runtime: 'DockerSpeculativeSandboxBackend',
        hardened: true,
        detail: dockerStatus?.detail || 'Docker is unavailable for required speculative validation.',
        fallbackFrom: null,
        docker: dockerStatus
          ? {
            image: dockerStatus.image,
            sandboxRuntime: dockerStatus.sandboxRuntime || 'runc',
            daemonReachable: dockerStatus.daemonReachable,
            canRun: dockerStatus.canRun,
            network: 'none',
            readOnlyRootfs: config.dockerSandboxReadOnly,
          }
          : null,
      };
    }

    return {
      ...buildLocalSandboxReceipt(requested, `Docker is unavailable for auto mode; falling back to a governed local copy. ${dockerStatus?.detail || ''}`.trim()),
      fallbackFrom: 'container',
    };
  }

export function buildLocalSandboxReceipt(
    requested: ZavorthSpeculativeSandboxIsolation,
    detail: string,
  ): ZavorthSpeculativeSandboxBackendReceipt {
    return {
      kind: 'local-copy',
      requested,
      validationExecution: 'host',
      runtime: 'LocalCopySpeculativeSandboxBackend',
      hardened: false,
      detail,
      fallbackFrom: null,
      docker: null,
    };
  }

export async function runDockerValidationCommand(input: {
    command: string;
    parsed: ParsedSpeculativeValidationCommand;
    sandboxWorkspace: string;
    sandboxBackend: ZavorthSpeculativeSandboxBackendReceipt;
    timeoutMs: number;
    dockerRunner: ZavorthSpeculativeDockerValidationRunner;
  }): Promise<ZavorthSpeculativeValidationResult> {
    const image = input.sandboxBackend.docker?.image || config.dockerSandboxJavascriptImage;
    const dockerArgs = buildDockerValidationArgs({
      image,
      parsed: input.parsed,
      sandboxWorkspace: input.sandboxWorkspace,
    });
    return input.dockerRunner({
      command: config.dockerCliPath,
      args: dockerArgs,
      timeoutMs: input.timeoutMs,
      originalCommand: input.command,
    });
  }

export function canUseDockerForSpeculativeValidation(status: DockerSandboxStatus): boolean {
    return Boolean(status.enabled && status.daemonReachable && (status.canRun || status.autoPullEnabled));
  }

export function safeDockerStatus(dockerRuntime: Pick<DockerSandboxRuntime, 'getStatus'> | null): DockerSandboxStatus | null {
    if (!dockerRuntime) {
      return null;
    }
    try {
      return dockerRuntime.getStatus('javascript');
    } catch (error: unknown) {return null;
    }
  }

export function defaultCommandRunner(
  input: ZavorthSpeculativeCommandRunnerInput,
): Promise<ZavorthSpeculativeValidationResult> {
  const startedAt = Date.now();
  const parsed = parseSpeculativeValidationCommand(input.command);
  if (!parsed) {
    return Promise.resolve({
      command: redactSensitiveText(input.command, 1200),
      status: 'blocked',
      exitCode: 126,
      stdout: '',
      stderr: 'Validation command blocked before spawn.',
      durationMs: 0,
    });
  }
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    const child = spawn(resolveExecutableForPlatform(parsed.executable), parsed.args, {
      cwd: input.cwd,
      env: input.env || process.env,
      shell: false,
      windowsHide: true,
    });
    const finish = (result: ZavorthSpeculativeValidationResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, input.timeoutMs);
    child?.stdout?.on('data', (chunk) => {
      stdout = clampText(`${stdout}${String(chunk)}`);
    });
    child?.stderr?.on('data', (chunk) => {
      stderr = clampText(`${stderr}${String(chunk)}`);
    });
    child?.on('error', (error) => {
      finish({
        command: redactSensitiveText(input.command, 1200),
        status: 'failed',
        exitCode: 1,
        stdout: redactSensitiveText(stdout),
        stderr: redactSensitiveText(error.message || stderr),
        durationMs: Date.now() - startedAt,
        timedOut,
      });
    });
    child?.on('close', (code) => {
      finish({
        command: redactSensitiveText(input.command, 1200),
        status: code === 0 && !timedOut ? 'passed' : 'failed',
        exitCode: typeof code === 'number' ? code : timedOut ? 124 : null,
        stdout: redactSensitiveText(stdout),
        stderr: timedOut ? redactSensitiveText(`${stderr}\nValidation timed out.`) : redactSensitiveText(stderr),
        durationMs: Date.now() - startedAt,
        timedOut,
      });
    });
  });
}

export function defaultDockerValidationRunner(
  input: ZavorthSpeculativeDockerValidationRunnerInput,
): Promise<ZavorthSpeculativeValidationResult> {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let child: ReturnType<typeof spawnCommand> | null = null;

    const finish = (result: ZavorthSpeculativeValidationResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(redactValidationResult(result));
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child?.kill('SIGTERM');
    }, input.timeoutMs);

    try {
      child = spawnCommand(input.command, input.args, {
        env: process.env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      finish({
        command: input.originalCommand,
        status: 'failed',
        exitCode: 1,
        stdout: '',
        stderr: error instanceof Error ? err.message : String(error),
        durationMs: Date.now() - startedAt,
        timedOut,
      });
      return;
    }

    child.stdout?.on('data', (chunk) => {
      stdout = clampText(`${stdout}${String(chunk)}`);
    });
    child.stderr?.on('data', (chunk) => {
      stderr = clampText(`${stderr}${String(chunk)}`);
    });
    child.on('error', (error) => {
      finish({
        command: input.originalCommand,
        status: 'failed',
        exitCode: 1,
        stdout,
        stderr: error.message || stderr,
        durationMs: Date.now() - startedAt,
        timedOut,
      });
    });
    child.on('close', (code) => {
      finish({
        command: input.originalCommand,
        status: code === 0 && !timedOut ? 'passed' : 'failed',
        exitCode: typeof code === 'number' ? code : timedOut ? 124 : null,
        stdout,
        stderr: timedOut ? `${stderr}\nDocker validation timed out.` : stderr,
        durationMs: Date.now() - startedAt,
        timedOut,
      });
    });
  });
}

export function isAllowedValidationCommand(command: string): boolean {
  return parseSpeculativeValidationCommand(command) !== null;
}

export function parseSpeculativeValidationCommand(command: string): ParsedSpeculativeValidationCommand | null {
  const normalized = normalizeText(command);
  if (!normalized || /[\r\n]/.test(normalized)) {
    return null;
  }
  if (/[;&|`<>]/.test(normalized)) {
    return null;
  }
  if (/\b(?:rm|del|erase|format|shutdown|curl|wget|powershell|cmd|bash|sh)\b/i.test(normalized)) {
    return null;
  }
  const tokens = splitValidationCommand(normalized);
  if (!tokens || tokens.length === 0) {
    return null;
  }
  const executable = tokens[0].toLowerCase();
  if (!new Set(['npm', 'npx', 'yarn', 'pnpm', 'node', 'tsc', 'jest', 'vitest']).has(executable)) {
    return null;
  }
  if (tokens.slice(1).some((token) => /^--?(?:token|secret|password|passwd|api[_-]?key|credential)(?:=|$)/i.test(token))) {
    return null;
  }
  if (tokens.some((token) => looksLikeSecret(token))) {
    return null;
  }
  return {
    executable,
    args: tokens.slice(1),
  };
}

export function splitValidationCommand(command: string): string[] | null {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (const char of command) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (quote === '"' && char === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }

  if (quote || escaped) {
    return null;
  }
  if (current) {
    tokens.push(current);
  }
  return tokens;
}

export function resolveExecutableForPlatform(executable: string): string {
  if (process.platform !== 'win32') {
    return executable;
  }
  if (['npm', 'npx', 'yarn', 'pnpm', 'tsc', 'jest', 'vitest'].includes(executable.toLowerCase())) {
    return `${executable}.cmd`;
  }
  return executable;
}

export function buildSpeculativeDockerValidationArgs(input: {
  image: string;
  parsed: ParsedSpeculativeValidationCommand;
  sandboxWorkspace: string;
}): string[] {
  const containerWorkspace = config.dockerSandboxWorkspacePath || '/workspace';
  return [
    'run',
    '--rm',
    ...buildSpeculativeDockerHardeningArgs(),
    '-v',
    `${normalizeDockerHostMountPath(input.sandboxWorkspace)}:${containerWorkspace}:rw`,
    '-w',
    containerWorkspace,
    '-e',
    'CI=true',
    '-e',
    'NO_UPDATE_NOTIFIER=1',
    '-e',
    'NPM_CONFIG_FUND=false',
    '-e',
    'NPM_CONFIG_AUDIT=false',
    '-e',
    'NPM_CONFIG_CACHE=/tmp/npm-cache',
    '-e',
    'HOME=/tmp',
    input.image,
    input.parsed.executable,
    ...input.parsed.args,
  ];
}

export function buildDockerValidationArgs(input: {
  image: string;
  parsed: ParsedSpeculativeValidationCommand;
  sandboxWorkspace: string;
}): string[] {
  return buildSpeculativeDockerValidationArgs(input);
}

export function buildSpeculativeDockerHardeningArgs(): string[] {
  const args: string[] = [];
  if (config.dockerSandboxRuntime) {
    args.push('--runtime', config.dockerSandboxRuntime);
  }
  args.push('--network', 'none');
  args.push('--memory', `${Math.max(256, config.dockerSandboxMemoryMb)}m`);
  args.push('--cpus', String(config.dockerSandboxCpuLimit));
  args.push('--pids-limit', String(Math.max(16, config.dockerSandboxPidsLimit)));
  if (config.dockerSandboxCapDropAll) {
    args.push('--cap-drop', 'ALL');
  }
  if (config.dockerSandboxNoNewPrivileges) {
    args.push('--security-opt', 'no-new-privileges');
  }
  if (config.dockerSandboxReadOnly) {
    args.push('--read-only');
    args.push('--tmpfs', '/tmp:rw,nosuid,size=128m');
  }
  return args;
}

export function normalizeDockerHostMountPath(hostPath: string): string {
  const normalized = path.resolve(hostPath).replace(/\\/g, '/');
  if (!String(config.dockerCliPath || '').toLowerCase().includes('docker-wsl-zavorth.cmd')) {
    return normalized;
  }
  const match = normalized.match(/^([a-zA-Z]):\/(.*)$/);
  if (!match) {
    return normalized;
  }
  return `/mnt/${match[1].toLowerCase()}/${match[2]}`;
}
