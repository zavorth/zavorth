import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import type { ZavorthCliFlags, ZavorthCliRuntime, CliExecutionResult, CliWriter } from './ZavorthCliContract.js';
import { formatCliEventCard, formatCliSuccessEventCard } from './ZavorthCliEventCards.js';

type CompileCommandParams = {
  runtime: ZavorthCliRuntime;
  effectiveFlags: ZavorthCliFlags;
  commandName: string | null;
  args: string;
  writer: CliWriter;
};

/**
 * `zavorth compile` — Build a standalone binary of Zavorth.
 *
 * Subcommands:
 *   (default) — Run full compile pipeline
 *   --check   — Verify prerequisites only
 */
export async function handleZavorthCompileCommand(
  params: CompileCommandParams,
): Promise<CliExecutionResult | null> {
  const { commandName, args, writer } = params;

  if (commandName !== 'compile') {
    return null;
  }

  const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
  const isCheck = tokens.includes('--check');

  if (isCheck) {
    return compileCheck(writer);
  }

  return compileRun(writer);
}

async function compileCheck(writer: CliWriter): Promise<CliExecutionResult> {
  const checks = [
    checkNodeVersion(),
    checkBuildExists(),
    checkEsbuild(),
  ];

  const lines = [
    formatCliEventCard({ title: '🔧 Compile Prerequisites Check', tone: 'info' }),
    '',
  ];

  let allOk = true;
  for (const check of checks) {
    const icon = check.ok ? '✅' : '❌';
    lines.push(`  ${icon} ${check.label}`);
    lines.push(`     ${check.detail}`);
    lines.push('');
    if (!check.ok) allOk = false;
  }

  if (allOk) {
    lines.push(formatCliSuccessEventCard({ title: 'All prerequisites met. Ready to compile.' }));
  } else {
    lines.push(formatCliEventCard({ title: 'Some prerequisites are missing. See details above.', tone: 'warning' }));
  }

  writer.line(lines.join('\n'));
  return { ok: allOk, handled: true, output: lines, error: allOk ? null : 'Prerequisites not met.' };
}

async function compileRun(writer: CliWriter): Promise<CliExecutionResult> {
  const projectRoot = process.cwd();
  const scriptPath = path.join(projectRoot, 'scripts', 'zavorth-compile.mjs');

  if (!fs.existsSync(scriptPath)) {
    const msg = 'scripts/zavorth-compile.mjs not found.';
    writer.line(formatCliEventCard({ title: msg, tone: 'danger' }));
    return { ok: false, handled: true, output: [msg], error: msg };
  }

  writer.line(formatCliEventCard({ title: '🔨 Starting standalone compilation...', tone: 'info' }));
  writer.line(`   Platform: ${os.platform()}-${os.arch()}`);
  writer.line(`   Node: ${process.version}`);
  writer.line('');

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 300000, // 5 minutes
  });

  const output = String(result.stdout || '');
  const stderr = String(result.stderr || '');

  if (output) {
    writer.line(output);
  }

  if (result.status !== 0) {
    if (stderr) {
      writer.line(stderr);
    }
    const msg = 'Compilation failed. See output above.';
    writer.line(formatCliEventCard({ title: msg, tone: 'danger' }));
    return { ok: false, handled: true, output: [output, stderr], error: msg };
  }

  writer.line(formatCliSuccessEventCard({ title: 'Standalone binary compiled successfully.' }));
  return { ok: true, handled: true, output: [output], error: null };
}

function checkNodeVersion(): { ok: boolean; label: string; detail: string } {
  const major = parseInt(process.versions.node.split('.')[0], 10);
  return {
    ok: major >= 20,
    label: 'Node.js ≥ 20',
    detail: major >= 20
      ? `Found: ${process.version}`
      : `Found: ${process.version} — Node SEA requires Node 20+`,
  };
}

function checkBuildExists(): { ok: boolean; label: string; detail: string } {
  const cliPath = path.join(process.cwd(), 'dist', 'zavorth-cli.js');
  const exists = fs.existsSync(cliPath);
  return {
    ok: exists,
    label: 'Build output (dist/zavorth-cli.js)',
    detail: exists ? 'Found.'
      : 'Not found. Run `npm run build` first.',
  };
}

function checkEsbuild(): { ok: boolean; label: string; detail: string } {
  try {
    const result = spawnSync('npx', ['esbuild', '--version'], {
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true,
      stdio: 'pipe',
    });
    const version = String(result.stdout || '').trim();
    return {
      ok: result.status === 0 && !!version,
      label: 'esbuild bundler',
      detail: result.status === 0 ? `Found: ${version}` : 'Not found. Run `npm install`.',
    };
  } catch {
    return {
      ok: false,
      label: 'esbuild bundler',
      detail: 'Not found. Run `npm install`.',
    };
  }
}
