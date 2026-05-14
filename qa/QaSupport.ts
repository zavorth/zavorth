import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { config } from '../src/config/index.js';

export type CommandProbeResult = {
  command: string;
  args: string[];
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  ok: boolean;
};

export function extractJsonPayloadFromText(output: string): unknown {
  const normalized = String(output || '').trim();
  if (!normalized) {
    throw new Error('stdout vazio; nenhum payload JSON encontrado.');
  }

  try {
    return JSON.parse(normalized);
  } catch {
    // Fall through to mixed-output recovery.
  }

  const candidateIndexes = Array.from(normalized.matchAll(/^[\[{]/gm))
    .map((match) => match.index)
    .filter((value): value is number => typeof value === 'number');

  if (!candidateIndexes.includes(0)) {
    candidateIndexes.unshift(0);
  }

  for (let index = candidateIndexes.length - 1; index >= 0; index -= 1) {
    const start = candidateIndexes[index];
    const candidate = normalized.slice(start).trim();
    if (!candidate || (candidate[0] !== '{' && candidate[0] !== '[')) {
      continue;
    }
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next earlier candidate.
    }
  }

  throw new Error(`saida nao contem JSON valido. Primeiro trecho: ${normalized.slice(0, 120)}`);
}

export function getQaReportDirectory(): string {
  return path.resolve(config.projectRoot, 'data', 'runtime', 'qa');
}

export function ensureQaReportDirectory(): string {
  const reportDir = getQaReportDirectory();
  fs.mkdirSync(reportDir, { recursive: true });
  return reportDir;
}

export function writeQaJsonReport(fileName: string, payload: unknown): string {
  const reportDir = ensureQaReportDirectory();
  const filePath = path.join(reportDir, fileName);
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
}

function resolveProbeCommand(command: string, args: string[]): { command: string; args: string[] } {
  const normalizedCommand = String(command || '').trim().toLowerCase();
  const nodeRunner = process.env.npm_node_execpath || process.execPath;
  const npmCliPath = process.env.npm_execpath || null;
  if (process.platform === 'win32' && npmCliPath) {
    if (normalizedCommand === 'npm' || normalizedCommand === 'npm.cmd') {
      return {
        command: nodeRunner,
        args: [npmCliPath, ...args],
      };
    }
    if (normalizedCommand === 'npx' || normalizedCommand === 'npx.cmd') {
      return {
        command: nodeRunner,
        args: [npmCliPath, 'exec', '--', ...args],
      };
    }
  }
  return { command, args };
}

export async function runCommandProbe(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
  } = {},
): Promise<CommandProbeResult> {
  const cwd = options.cwd || config.projectRoot;
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Number(options.timeoutMs) : 120_000;
  const startedAt = performance.now();
  const resolvedCommand = resolveProbeCommand(command, args);

  return await new Promise<CommandProbeResult>((resolve, reject) => {
    const child = spawn(resolvedCommand.command, resolvedCommand.args, {
      cwd,
      env: {
        ...process.env,
        ...(options.env || {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill();
      reject(new Error(`Command probe timed out after ${timeoutMs}ms: ${command} ${args.join(' ')}`));
    }, timeoutMs);

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk || '');
    });

    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk || '');
    });

    child.once('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.once('close', (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      const durationMs = performance.now() - startedAt;
      resolve({
        command,
        args,
        cwd,
        exitCode: typeof code === 'number' ? code : null,
        stdout,
        stderr,
        durationMs,
        ok: code === 0,
      });
    });
  });
}

export async function runCliProbe(args: string[]): Promise<CommandProbeResult> {
  const target = resolveNodeCommandTarget();
  return await runCommandProbe(target.command, [...target.args, ...args]);
}

export async function fetchJsonWithTimeout<T>(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<{ status: number; payload: T }> {
  const controller = new AbortController();
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Number(options.timeoutMs) : 10_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const payload = await response.json() as T;
    return {
      status: response.status,
      payload,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function resolveNodeCommandTarget(): { command: string; args: string[] } {
  return {
    command: process.execPath,
    args: [path.resolve(config.projectRoot, 'dist', 'zavorth-cli.js')],
  };
}
