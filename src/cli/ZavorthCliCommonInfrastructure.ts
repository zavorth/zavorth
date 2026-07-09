import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { formatCliHelp } from './ZavorthCliSurfaceHelpers.js';
import { logger } from '../logger.js';export const entryDir = path.dirname(path.resolve(process.argv[1] || process.cwd()));
export const runningFromDist = path.basename(entryDir).toLowerCase() === 'dist';
export const projectRoot = runningFromDist ? path.resolve(entryDir, '..') : path.resolve(entryDir, '..');

export async function logCliError(message: string, title = 'Zavorth Error'): Promise<void> {
  const isTTY = process.stderr.isTTY && !process.argv.includes('--json');
  if (isTTY) {
    const { TerminalPanel } = await import('./presentation/TerminalPanel.js');
    TerminalPanel.error(message, title);
  } else {
    process.stderr.write(`${title}: ${message}\n`);
  }
}

export async function printCliPanel(title: string, lines: string[], type: 'default' | 'info' | 'success' | 'warning' | 'error' = 'default'): Promise<number> {
  const content = lines.join('\n');
  if (!process.argv.includes('--json')) {
    const { TerminalPanel } = await import('./presentation/TerminalPanel.js');
    process.stdout.write(`${TerminalPanel.render(content, {
      title,
      type,
      padding: 1,
      width: Math.max(58, Math.min(88, Number(process.stdout.columns || 90) - 4)),
    })}\n`);
  } else {
    process.stdout.write([title, '', content, ''].join('\n'));
  }
  return 0;
}

export function spawnInherited(command: string, commandArgs: string[], cwd: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd,
      stdio: 'inherit',
      windowsHide: false,
    });
    child.on('exit', (code) => resolve(code || 0));
    child.on('error', reject);
  });
}

export function resolveNpmCli(): string | null {
  const candidates = [
    path.resolve(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'nodejs', 'node_modules', 'npm', 'bin', 'npm-cli.js') : '',
    process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'nodejs', 'node_modules', 'npm', 'bin', 'npm-cli.js') : '',
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

export function npmInherited(commandArgs: string[], cwd: string): Promise<number> {
  const npmCli = resolveNpmCli();
  if (npmCli) {
    return spawnInherited(process.execPath, [npmCli, ...commandArgs], cwd);
  }
  return spawnInherited('npm', commandArgs, cwd);
}

export function readPackageVersion(): string {
  try {
    const parsed = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8')) as { version?: string };
    return String(parsed.version || 'local');
  } catch (error: unknown) {logger.warn('[Zavorth Cli Common Infrastructure] JSON parse failed', error); return 'local'; }
}

export function readNumberFlag(argv: string[], name: string): number | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  const raw = inline ? inline.slice(prefix.length) : null;
  if (raw === null) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function readStringFlag(argv: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : null;
}

export function readFlexibleStringFlag(argv: string[], name: string): string | null {
  const inline = readStringFlag(argv, name);
  if (inline !== null) {
    return inline;
  }
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : null;
}

export function readStringListFlag(argv: string[], name: string): string[] {
  const inlinePrefix = `--${name}=`;
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg.startsWith(inlinePrefix)) {
      values.push(arg.slice(inlinePrefix.length));
      continue;
    }
    if (arg === `--${name}` && argv[index + 1]) {
      values.push(argv[index + 1]);
      index += 1;
    }
  }
  return values
    .flatMap((value) => String(value || '').split(/[,\n;]/))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function readTaskPositional(argv: string[], index: number): string | null {
  const flagValueIndexes = new Set<number>();
  for (let cursor = 0; cursor < argv.length; cursor += 1) {
    const arg = argv[cursor] || '';
    if (arg.startsWith('--') && !arg.includes('=') && argv[cursor + 1] && !argv[cursor + 1].startsWith('--')) {
      flagValueIndexes.add(cursor + 1);
      cursor += 1;
    }
  }
  const values = argv.filter((arg, cursor) => !flagValueIndexes.has(cursor) && !arg.startsWith('--'));
  return values[index] || null;
}

export function readDurationMsFlag(argv: string[], name: string): number | null {
  const raw = readStringFlag(argv, name);
  if (!raw) {
    return null;
  }
  const match = raw.trim().match(/^(\d+)(ms|s|m|h)?$/i);
  if (!match) {
    return readNumberFlag(argv, name);
  }
  const value = Number(match[1]);
  const unit = String(match[2] || 'ms').toLowerCase();
  const factor = unit === 'h' ? 60 * 60 * 1000 : unit === 'm' ? 60 * 1000 : unit === 's' ? 1000 : 1;
  return Number.isFinite(value) ? value * factor : null;
}

export function printBuiltinHelp(target?: string | null): number {
  process.stdout.write(`${formatCliHelp(target)}\n`);
  return 0;
}

export function printGeneralHelp(): number {
  process.stdout.write(`${formatCliHelp()}\n`);
  return 0;
}

export const PUBLIC_COMMANDS = [
  'chat',
  'ask',
  'run',
  'doctor',
  'hatch',
  'home',
  'quickstart',
  'setup',
  'switch',
  'consistency',
  'diagnostics',
  'mock-gateway',
  'providers',
  'models',
  'memory',
  'mnemos',
  'swarm',
  'workflows',
  'effort',
  'sandbox',
  'satellite',
  'hud',
  'tui',
  'help',
  'onboard',
  'quickstart',
  'start',
  'native',
  'diff',
  'learn',
  'inspect',
  'constitution',
  'disk',
  'disk-gate',
  'branch',
  'commit',
  'pr',
  'review',
  'acp',
  'tasks',
  'curator',
  'todo',
  'later',
  'work',
  'done',
  'retry',
  'cancel',
  'diagnostics',
  'mock-gateway',
];

export function resolveCommandSuggestion(command: string): string[] | null {
  const normalized = String(command || '').trim().toLowerCase();
  if (normalized.length < 2 || normalized.includes(' ') || normalized.startsWith('-')) {
    return null;
  }
  if (PUBLIC_COMMANDS.includes(normalized)) {
    return null;
  }
  const prefixMatches = PUBLIC_COMMANDS
    .filter((item) => item.startsWith(normalized))
    .slice(0, 5);
  if (prefixMatches.length > 0) {
    return prefixMatches;
  }
  const nearMatches = PUBLIC_COMMANDS
    .map((item) => ({ item, distance: levenshtein(normalized, item) }))
    .filter((entry) => entry.distance <= 2)
    .sort((a, b) => a.distance - b.distance || a.item.localeCompare(b.item))
    .slice(0, 4)
    .map((entry) => entry.item);
  return nearMatches.length > 0 ? nearMatches : null;
}

export async function printCommandSuggestion(command: string, suggestions: string[]): Promise<number> {
  const lines = [
    `Unknown command: ${command}`,
    '',
    'Did you mean?',
    ...suggestions.map((item) => `  zavorth ${item}`),
    '',
    `To send "${command}" as a message, use:`,
    `  zavorth ask "${command}"`,
  ].join('\n');
  if (process.stdout.isTTY && !process.argv.includes('--json')) {
    const { TerminalPanel } = await import('./presentation/TerminalPanel.js');
    process.stdout.write(`${TerminalPanel.render(lines, {
      title: 'Command hint',
      type: 'warning',
      padding: 1,
      width: Math.max(56, Math.min(84, Number(process.stdout.columns || 86) - 4)),
    })}\n`);
  } else {
    process.stdout.write(`${lines}\n`);
  }
  return 1;
}

export function levenshtein(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = temp;
    }
  }
  return previous[b.length] ?? Math.max(a.length, b.length);
}

