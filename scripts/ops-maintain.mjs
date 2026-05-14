#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const runtimeDir = path.join(projectRoot, 'data', 'runtime');
const reportPath = path.join(runtimeDir, 'maintenance-last.json');

function quoteWindowsArg(value) {
  const normalized = String(value ?? '');
  if (!normalized) {
    return '""';
  }

  if (!/[\s"&()<>^|%!]/.test(normalized)) {
    return normalized;
  }

  const escaped = normalized.replace(/(["^&|<>()%!])/g, '^$1');
  return `"${escaped}"`;
}

function execute(command, args, cwd = projectRoot, capture = false) {
  const result =
    process.platform === 'win32'
      ? spawnSync(
          process.env.ComSpec || 'cmd.exe',
          ['/d', '/s', '/c', [command, ...args].map(quoteWindowsArg).join(' ')],
          {
            cwd,
            stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
            shell: false,
            encoding: capture ? 'utf8' : undefined,
          },
        )
      : spawnSync(command, args, {
          cwd,
          stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
          shell: false,
          encoding: capture ? 'utf8' : undefined,
        });

  if (result.status !== 0) {
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    if (capture && combined) {
      process.stdout.write(`${combined}\n`);
    }
    if (result.error) {
      throw result.error;
    }
    throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}`);
  }

  return capture ? `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() : '';
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const withSoak = args.has('--with-soak');
  const withPublish = args.has('--with-publish');
  const leaveCold = args.has('--leave-cold');
  const fast = args.has('--fast');
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  fs.mkdirSync(runtimeDir, { recursive: true });

  const plan = [
    ['security:audit', ['run', 'security:audit']],
    [
      'essential:maintain',
      ['run', 'essential:maintain', ...(leaveCold ? ['--', '--leave-cold'] : []), ...(fast ? ['--', '--skip-smoke'] : [])],
    ],
    ['ops:repo:retention', ['run', 'ops:repo:retention', '--', '--apply']],
    ['vendor:status', ['run', 'vendor:status']],
    ['sidecars:status', ['run', 'sidecars:status']],
  ];

  if (withSoak) {
    plan.push(['essential:soak', ['run', 'essential:soak']]);
  }

  if (withPublish) {
    plan.push(['remote:publish:fast', ['run', 'remote:publish:fast']]);
  }

  const report = {
    startedAt: new Date().toISOString(),
    dryRun,
    withSoak,
    withPublish,
    leaveCold,
    fast,
    steps: [],
  };

  console.log('===========================================');
  console.log('  Zavorth Ops Maintain');
  console.log('===========================================');
  console.log(dryRun ? 'Modo: simulacao' : 'Modo: aplicar');
  console.log('');

  if (dryRun) {
    for (const [label, commandArgs] of plan) {
      console.log(`[ops] ${label}: ${npmCommand} ${commandArgs.join(' ')}`);
      report.steps.push({
        step: label,
        command: `${npmCommand} ${commandArgs.join(' ')}`,
        status: 'planned',
      });
    }
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log('');
    console.log(`Relatorio: ${reportPath}`);
    return;
  }

  for (const [label, commandArgs] of plan) {
    const startedAt = new Date().toISOString();
    console.log(`[ops] executando ${label}`);
    const output = execute(npmCommand, commandArgs, projectRoot, true);
    report.steps.push({
      step: label,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: 'completed',
      outputPreview: output.split(/\r?\n/).slice(-8),
    });
  }

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('');
  console.log(`Relatorio: ${reportPath}`);
}

await main();
