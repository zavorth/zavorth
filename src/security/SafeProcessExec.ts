/**
 * S3 — command-injection resistant process helpers.
 *
 * Rules:
 * - Prefer execFile/spawn with argv arrays (never shell string interpolation).
 * - Reject shell metacharacters in command lines and args.
 * - Optional binary allowlists for marketplace/install paths.
 */

import { execFileSync, spawn, spawnSync, type SpawnOptions, type SpawnSyncOptions } from 'node:child_process';
import path from 'node:path';

/** Characters that enable shell injection when shell:true is used. */
export const SHELL_METACHAR_RE = /[\n\r;&|`$<>]/;

export function containsShellMetacharacters(value: string): boolean {
  const text = String(value ?? '');
  return SHELL_METACHAR_RE.test(text) || text.includes('$(') || text.includes('${');
}

export function assertNoShellMetacharacters(value: string, label = 'value'): void {
  if (containsShellMetacharacters(value)) {
    throw new Error(`${label} contains shell metacharacters`);
  }
}

/**
 * Split a simple command line into argv without invoking a shell.
 * Supports single/double quotes; rejects metacharacters and unclosed quotes.
 */
export function splitCommandLine(command: string): { file: string; args: string[] } {
  const trimmed = String(command || '').trim();
  if (!trimmed) {
    throw new Error('Empty command');
  }
  assertNoShellMetacharacters(trimmed, 'command');

  const parts: string[] = [];
  let cur = '';
  let inQuote: '"' | "'" | null = null;

  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur) {
        parts.push(cur);
        cur = '';
      }
      continue;
    }
    cur += ch;
  }

  if (inQuote) {
    throw new Error('Unclosed quote in command');
  }
  if (cur) parts.push(cur);
  if (parts.length === 0) {
    throw new Error('Empty command');
  }

  return { file: parts[0], args: parts.slice(1) };
}

export type SafeExecFileOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdio?: 'pipe' | 'ignore' | 'inherit' | readonly ('pipe' | 'ignore' | 'inherit')[];
  timeout?: number;
  maxBuffer?: number;
  encoding?: BufferEncoding;
  /** When set, only these basenames are allowed (e.g. git, tar, npm). */
  allowedBinaries?: readonly string[];
};

function assertAllowedBinary(cmd: string, allowed?: readonly string[]): void {
  if (!allowed || allowed.length === 0) return;
  const base = path.basename(cmd).toLowerCase();
  const ok = allowed.some((entry) => {
    const e = entry.toLowerCase();
    return e === base || e === cmd.toLowerCase();
  });
  if (!ok) {
    throw new Error(`Binary not allowlisted for safe exec: ${cmd}`);
  }
}

function assertSafeArgs(args: readonly string[]): void {
  for (const arg of args) {
    assertNoShellMetacharacters(String(arg), 'arg');
  }
}

/**
 * execFileSync with optional binary allowlist and metacharacter rejection on args.
 */
export function safeExecFile(cmd: string, args: readonly string[], options: SafeExecFileOptions = {}): string | Buffer {
  assertNoShellMetacharacters(cmd, 'cmd');
  assertAllowedBinary(cmd, options.allowedBinaries);
  assertSafeArgs(args);

  return execFileSync(cmd, [...args], {
    cwd: options.cwd,
    env: options.env,
    stdio: (options.stdio as any) || 'pipe',
    timeout: options.timeout ?? 30_000,
    maxBuffer: options.maxBuffer,
    encoding: options.encoding,
    windowsHide: true,
  });
}

/**
 * Spawn a full command line without shell:true (S3).
 * Windows `.cmd`/`.bat` are launched via `cmd.exe /d /s /c` with argv only.
 */
export function spawnCommandLine(
  command: string,
  options: SpawnOptions = {},
): ReturnType<typeof spawn> {
  const { file, args } = splitCommandLine(command);
  return spawnResolved(file, args, options);
}

export function spawnSyncCommandLine(
  command: string,
  options: SpawnSyncOptions = {},
): ReturnType<typeof spawnSync> {
  const { file, args } = splitCommandLine(command);
  return spawnSyncResolved(file, args, options);
}

function spawnResolved(file: string, args: string[], options: SpawnOptions) {
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(file)) {
    return spawn('cmd.exe', ['/d', '/s', '/c', file, ...args], {
      ...options,
      shell: false,
      windowsHide: options.windowsHide !== false,
    });
  }
  return spawn(file, args, {
    ...options,
    shell: false,
    windowsHide: options.windowsHide !== false,
  });
}

function spawnSyncResolved(file: string, args: string[], options: SpawnSyncOptions) {
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(file)) {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', file, ...args], {
      ...options,
      shell: false,
      windowsHide: options.windowsHide !== false,
    });
  }
  return spawnSync(file, args, {
    ...options,
    shell: false,
    windowsHide: options.windowsHide !== false,
  });
}

/** Marketplace / skill install allowlist. */
export const MARKETPLACE_ALLOWED_BINARIES = ['git', 'tar', 'npm', 'npm.cmd'] as const;
