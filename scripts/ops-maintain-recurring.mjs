#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const runtimeDir = path.join(projectRoot, 'data', 'runtime');
const reportPath = path.join(runtimeDir, 'maintenance-recurring-last.json');
const nodeMeshSmokeReportPath = path.join(runtimeDir, 'node-mesh-smoke-last.json');
const nodeMeshSmokeMaxAgeMs = Number.parseInt(process.env.ZAVORTH_NODE_MESH_SMOKE_MAX_AGE_MS || '43200000', 10);
const dryRun = new Set(process.argv.slice(2)).has('--dry-run');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

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

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  if (result.status !== 0) {
    if (capture && output) {
      process.stdout.write(`${output}\n`);
    }
    if (result.error) {
      throw result.error;
    }
    throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}`);
  }

  return output;
}

async function main() {
  fs.mkdirSync(runtimeDir, { recursive: true });
  const shouldAuditNodeMesh = shouldRunNodeMeshSmoke(nodeMeshSmokeReportPath, nodeMeshSmokeMaxAgeMs);

  const report = {
    startedAt: new Date().toISOString(),
    dryRun,
    profile: 'light-recurring',
    nodeMeshSmokeScheduled: shouldAuditNodeMesh,
    steps: [],
  };

  const plan = [
    ['security:audit', ['run', 'security:audit']],
    ['essential:backup', ['run', 'essential:backup']],
    ['essential:trim', ['run', 'essential:trim']],
    ['ops:repo:retention', ['run', 'ops:repo:retention', '--', '--apply']],
    ['vendor:status', ['run', 'vendor:status']],
    ['sidecars:status', ['run', 'sidecars:status']],
  ];

  if (shouldAuditNodeMesh) {
    plan.push(['test:nodes:smoke', ['run', 'test:nodes:smoke']]);
  } else {
    report.steps.push({
      step: 'test:nodes:smoke',
      startedAt: report.startedAt,
      finishedAt: report.startedAt,
      status: 'skipped',
      reason: 'Recent Node Mesh smoke report is still valid.',
    });
  }

  console.log('===========================================');
  console.log('  Zavorth Recurring Maintenance');
  console.log('===========================================');
  console.log(dryRun ? 'Mode: dry-run' : 'Mode: apply lightweight profile');
  console.log('');

  for (const [label, args] of plan) {
    const startedAt = new Date().toISOString();
    if (dryRun) {
      console.log(`[scheduled] ${label}: ${npmCommand} ${args.join(' ')}`);
      report.steps.push({
        step: label,
        startedAt,
        finishedAt: startedAt,
        status: 'planned',
      });
      continue;
    }

    console.log(`[scheduled] executando ${label}`);
    const output = execute(npmCommand, args, projectRoot, true);
    report.steps.push({
      step: label,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: 'completed',
      outputPreview: output.split(/\r...\n/).slice(-8),
    });
  }

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('');
  console.log(`Report: ${reportPath}`);
}

await main();

function shouldRunNodeMeshSmoke(reportFile, maxAgeMs) {
  try {
    if (!fs.existsSync(reportFile)) {
      return true;
    }

    const parsed = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    const status = String(parsed?.status || '').trim().toLowerCase();
    if (status !== 'passed') {
      return true;
    }

    const referenceTime = Date.parse(String(parsed?.finishedAt || parsed?.startedAt || ''));
    if (!Number.isFinite(referenceTime)) {
      return true;
    }

    return (Date.now() - referenceTime) > maxAgeMs;
  } catch {
    return true;
  }
}
