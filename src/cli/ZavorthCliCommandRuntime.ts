#!/usr/bin/env node
import { formatZavorthCertificationHelp, formatZavorthConsistencyPreparedNotice, isZavorthConsistencyStubCommand } from './ZavorthCliCertificationCommands.js';
import { isZavorthLiveNamespaceCommand, runZavorthLiveNamespaceCommand } from './ZavorthCliLiveNamespaces.js';
import { asErrorLike } from '../utils/errorLike';
import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { formatCliHelp, resolveCliHelpTopic } from './ZavorthCliSurfaceHelpers.js';
import { getCommandAliases } from './locales/localeManager.js';
import { resolveZavorthSimpleCommand, type ZavorthSimpleCommandPlan } from './SimpleCommandRouter.js';

import type { DiskMutationGateRequestedOperation } from '../contracts/DiskMutationGateContract.js';
import { runDiskMutationGateCommand } from './disk/ZavorthCliDiskMutationNamespace.js';
import { runProjectConstitutionCommand } from './constitution/ZavorthCliConstitutionNamespace.js';
import { runMigrationUX } from './MigrationCli.js';
import { runCapabilitySubsystemCli } from './CapabilitySubsystemCli.js';
import { runReachSubsystemCli } from './ReachSubsystemCli.js';
import { runPowerSubsystemCli } from './PowerSubsystemCli.js';
import { runProductSubsystemCli } from './ProductSubsystemCli.js';
import { runProofLedgerCli } from './ProofLedgerCli.js';
import { runApprovalPresentationCli, shouldRunApprovalPresentationCli, normalizeApprovalPresentationArgs } from './ApprovalPresentationCli.js';
import { runRiskBudgetCli } from './RiskBudgetCli.js';
import { runChangePreviewCli } from './ChangePreviewCli.js';
import { runMemoryPrivacyCli } from './MemoryPrivacyCli.js';
import { runZavorthMinimalRuntimeNamespace } from './ZavorthCliMinimalRuntimeNamespace.js';

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
    process.stdout.write(
      `${TerminalPanel.render(content, {
        title,
        type,
        padding: 1,
        width: Math.max(58, Math.min(88, Number(process.stdout.columns || 90) - 4)),
      })}\n`,
    );
  } else {
    process.stdout.write([title, '', content, ''].join('\n'));
  }
  return 0;
}

export const entryDir = path.dirname(path.resolve(process.argv[1] || process.cwd()));
export const runningFromDist = path.basename(entryDir).toLowerCase() === 'dist';
export const projectRoot = runningFromDist ? path.resolve(entryDir, '..') : path.resolve(entryDir, '..');

export const PUBLIC_COMMANDS = [
  'chat',
  'actions',
  'channels',
  'setup',
  'home',
  'ask',
  'approve',
  'doctor',
  'status',
  'open',
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
  'instance',
  'todo',
  'later',
  'work',
  'done',
  'retry',
  'cancel',
  'diagnostics',
  'offline-gateway',
];

export function normalizePublicCommandAliases(rawArgs: string[]): string[] {
  const first = String(rawArgs[0] || '')
    .trim()
    .toLowerCase();
  const alias = getCommandAliases()[first];
  if (!alias) {
    return rawArgs;
  }
  return [alias, ...rawArgs.slice(1)];
}

export const simpleCommandPlan = resolveZavorthSimpleCommand(normalizePublicCommandAliases(process.argv.slice(2)));
export const args = simpleCommandPlan.kind === 'passthrough' ? simpleCommandPlan.args : process.argv.slice(2);

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

export function npmInherited(commandArgs: string[], cwd: string): Promise<number> {
  const npmCli = resolveNpmCli();
  if (npmCli) {
    return spawnInherited(process.execPath, [npmCli, ...commandArgs], cwd);
  }
  return spawnInherited('npm', commandArgs, cwd);
}

export async function runSimpleCommandPlan(plan: ZavorthSimpleCommandPlan): Promise<number | null> {
  if (plan.kind === 'passthrough') {
    return null;
  }
  process.stdout.write(`${plan.label}\n`);
  for (const script of plan.scripts) {
    process.stdout.write(`\n> zavorth test: ${script}\n`);
    const exitCode = await npmInherited(['run', script, '--silent'], projectRoot);
    if (exitCode !== 0) {
      await logCliError(`Zavorth test stopped at ${script}.`, 'Test Failed');
      return exitCode;
    }
  }
  process.stdout.write('\nZavorth tests passed.\n');
  return 0;
}

export function resolveNpmCli(): string | null {
  const candidates = [
    path.resolve(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'nodejs', 'node_modules', 'npm', 'bin', 'npm-cli.js') : '',
    process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'nodejs', 'node_modules', 'npm', 'bin', 'npm-cli.js') : '',
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

export function printBuiltinHelp(target?: string | null): number {
  process.stdout.write(`${formatCliHelp(target)}\n`);
  return 0;
}

export function printGeneralHelp(): number {
  process.stdout.write(`${formatCliHelp()}\n`);
  return 0;
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
