import { createHash } from 'crypto';
import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TerminalPanel } from './presentation/TerminalPanel.js';
import { logger } from '../logger.js';
export type JsonObject = Record<string, unknown>;

export function firstArg(args: string[], fallback: string): string {
  return String(args.find((arg) => !arg.startsWith('--')) || fallback).trim().toLowerCase();
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function quoteEnv(value: string): string {
  return /^[A-Za-z0-9_.:/\\-]+$/u.test(value)
    ? value
    : JSON.stringify(value);
}

export function mergeSingleEnvValue(current: string, key: string, value: string): string {
  const lines = current.split(/\r?\n/u);
  let replaced = false;
  const next = lines.map((line) => {
    if (new RegExp(`^${escapeRegex(key)}\\s*=`, 'u').test(line)) {
      replaced = true;
      return `${key}=${quoteEnv(value)}`;
    }
    return line;
  });
  if (!replaced) {
    next.push(`${key}=${quoteEnv(value)}`);
  }
  while (next.length > 0 && next[next.length - 1] === '') {
    next.pop();
  }
  return `${next.join('\n')}\n`;
}

export function readFlag(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

export function readFlags(args: string[], name: string): string[] {
  const values: string[] = [];
  const prefix = `--${name}=`;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith(prefix)) values.push(arg.slice(prefix.length));
    else if (arg === `--${name}` && args[index + 1]) values.push(args[index + 1]);
  }
  return values.flatMap(splitList);
}

export function readNumberFlag(args: string[], name: string): number | null {
  const raw = readFlag(args, name);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function stateDir(root: string): string {
  return path.join(root, '.zavorth');
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function readJson(file: string, fallback: unknown): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error: unknown) {
    if (isFileNotFoundError(error)) {
      return fallback;
    }
    logger.warn('[Zavorth Cli Shared Helpers] JSON read failed', error);
    return fallback;
  }
}

function isFileNotFoundError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === 'ENOENT',
  );
}

export async function readArray(file: string): Promise<unknown[]> {
  const value = await readJson(file, []);
  return Array.isArray(value) ? value : [];
}

export async function writeJson(file: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function appendJsonArray(file: string, value: unknown): Promise<void> {
  const items = await readArray(file);
  items.push(value);
  await writeJson(file, items);
}

export async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    return (await fs.readdir(dir)).filter((file) => file.endsWith('.json')).sort();
  } catch (error: unknown) {logger.warn('[Zavorth Cli Shared Helpers] filesystem operation failed', error); return []; }
}

export async function listAnyFiles(dir: string): Promise<string[]> {
  try {
    return (await fs.readdir(dir)).map((file) => path.join(dir, file));
  } catch (error: unknown) {logger.warn('[Zavorth Cli Shared Helpers] filesystem operation failed', error); return []; }
}

export async function walkFiles(dir: string, limit: number): Promise<string[]> {
  const out: string[] = [];
  async function walk(current: string): Promise<void> {
    if (out.length >= limit) return;
    let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
    try {
      entries = await fs.readdir(current, { withFileTypes: true }) as unknown as Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
    } catch (error: unknown) {logger.warn('[Zavorth Cli Shared Helpers] filesystem operation failed', error);
      return;
    }
    for (const entry of entries) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(next);
      else if (entry.isFile()) out.push(next);
      if (out.length >= limit) return;
    }
  }
  await walk(dir);
  return out;
}

export function idWithTime(prefix: string): string {
  return `${prefix}-${new Date().toISOString().replace(/[-:.TZ]/gu, '').slice(0, 14)}`;
}

export function redact(value: string): string {
  return value.length <= 8 ? '***' : `${value.slice(0, 4)}...${value.slice(-2)}`;
}

export function safeString(value: unknown): string {
  if (typeof value === 'string') return value.match(/token|key|secret/iu) ? redact(value) : value;
  return JSON.stringify(value);
}

export function isInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function runProcess(command: string, args: string[], cwd: string, timeoutMs: number): Promise<{ exitCode: number; output: string; durationMs: number; timedOut: boolean }> {
  const { exec, execFile } = require('child_process');
  return new Promise((resolve) => {
    const start = Date.now();
    const finish = (error: any, stdout: string, stderr: string) => {
      const durationMs = Date.now() - start;
      const timedOut = error && error.killed && error.signal === 'SIGTERM';
      const output = `${stdout || ''}${stderr || ''}`;
      resolve({
        exitCode: error ? (error.code || 1) : 0,
        output,
        durationMs,
        timedOut: !!timedOut,
      });
    };

    // Full shell command strings (e.g. `node -e "..."`) must use exec; execFile treats the
    // entire string as an executable path and fails with ENOENT on Windows.
    const needsShell = !Array.isArray(args) || args.length === 0;
    if (needsShell) {
      exec(String(command || ''), { cwd, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, windowsHide: true }, finish);
      return;
    }

    execFile(command, args, { cwd, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, windowsHide: true }, finish);
  });
}

export function text(output: string): { exitCode: number; output: string } {
  return { exitCode: 0, output };
}

export function normalizeRenderLines(lines: string[]): string[] {
  return (lines || [])
    .map((line) => String(line || '').trimEnd())
    .filter((line, index, list) => line.trim() || (index > 0 && index < list.length - 1));
}

export function resolvePanelType(payload: unknown, _lines: string[]): 'info' | 'success' | 'warning' | 'error' | 'default' {
  const record = payload && typeof payload === 'object' ? payload as JsonObject : {};
  if (record.ok === false) {
    return 'error';
  }
  if (record.dryRun === true) {
    return 'warning';
  }
  if (record.ok === true) {
    return 'success';
  }
  return 'default';
}

export function terminalPanelWidth(): number {
  const columns = Number(process.stdout?.columns || 0);
  if (!Number.isFinite(columns) || columns <= 0) return 86;
  return Math.max(56, Math.min(92, columns - 4));
}

export function render(args: string[], title: string, lines: string[], payload: unknown) {
  if (args.includes('--json')) return text(`${JSON.stringify(payload, null, 2)}\n`);
  const body = normalizeRenderLines(lines).join('\n');
  return text(`${TerminalPanel.render(body || 'No details available.', {
    title,
    type: resolvePanelType(payload, lines),
    padding: 1,
    width: terminalPanelWidth(),
  })}\n`);
}

export function splitList(value: string): string[] {
  if (!value) return [];
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

export function getEnv(name: string): string | undefined {
  return process.env[name];
}
