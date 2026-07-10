#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const jestBin = path.join(projectRoot, 'node_modules', 'jest', 'bin', 'jest.js');

const ARCHIVE_GROUPS = [];

const GROUPS = [
  {
    id: 'security',
    label: 'Security, privacy and policy contracts',
    paths: ['tests/security', 'tests/cognitive-firewall', 'tests/privacy'],
  },
  {
    id: 'api',
    label: 'Public API and gateway contracts',
    paths: ['tests/api', 'tests/gateway'],
  },
  {
    id: 'zavorth-control',
    label: 'AI gateway and zavorthControl app contracts',
    paths: ['tests/zavorth-control', 'tests/apps'],
  },
  {
    id: 'domain-zavorthControl',
    label: 'Domain zavorthControl surface',
    paths: ['tests/domain/surface/presentation/zavorthControl'],
  },
  {
    id: 'domain-web',
    label: 'Domain web app surface',
    paths: ['tests/domain/surface/presentation/web-app'],
  },
  {
    id: 'domain-shared',
    label: 'Shared surface commands and domain services',
    paths: ['tests/domain/surface/application', 'tests/domain/surface/SharedSurfaceCommandService.tasks.test.ts', 'tests/domain/surface/SharedSurfaceCallbackCommandPolicy.test.ts'],
  },
  {
    id: 'telegram',
    label: 'Telegram channel runtime',
    paths: ['tests/telegram'],
  },
  {
    id: 'channels',
    label: 'Channel adapters and mesh',
    paths: ['tests/channels'],
  },
  {
    id: 'services',
    label: 'Service layer',
    paths: ['tests/services'],
  },
  {
    id: 'runtime-agent',
    label: 'Agent runtime contracts',
    paths: ['tests/runtime/agent'],
  },
  {
    id: 'runtime-sessions',
    label: 'Runtime sessions and swarm contracts',
    paths: ['tests/runtime/sessions'],
  },
  {
    id: 'runtime-other',
    label: 'Remaining runtime contracts',
    paths: ['tests/runtime'],
    exclude: ['tests/runtime/agent', 'tests/runtime/sessions'],
  },
  {
    id: 'integration',
    label: 'Integration and end-to-end contracts',
    paths: ['tests/integration', 'tests/e2e', 'tests/qa'],
  },
  {
    id: 'platform',
    label: 'Platform, adapters, CLI, SDK, tools and unit tests',
    paths: [
      'tests/adapters',
      'tests/agents',
      'tests/bootstrap',
      'tests/capabilities',
      'tests/cli',
      'tests/config',
      'tests/contracts',
      'tests/core',
      'tests/context-engine',
      'tests/echo',
      'tests/execution',
      'tests/helpers',
      'tests/lib',
      'tests/mcp',
      'tests/monitoring',
      'tests/nodes',
      'tests/ops',
      'tests/orchestrator',
      'tests/platform',
      'tests/project-workspace',
      'tests/providers',
      'tests/scripts',
      'tests/sdk',
      'tests/skills',
      'tests/storage',
      'tests/tools',
      'tests/unit',
      'tests/voice',
    ],
  },
];

const ALL_GROUPS = [...GROUPS, ...ARCHIVE_GROUPS];

function argValue(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

function hasArg(name) {
  return process.argv.includes(`--${name}`);
}

function existingPaths(paths) {
  return paths.filter((entry) => fs.existsSync(path.join(projectRoot, entry)));
}

function listGroups() {
  for (const group of GROUPS) {
    const paths = existingPaths(group.paths);
    console.log(`${group.id.padEnd(16, ' ')} ${group.label}`);
    console.log(`  ${paths.join(' ') || '(sem paths existentes)'}`);
  }
  if (ARCHIVE_GROUPS.length === 0) {
    return;
  }
  console.log('\nArquivados fora do CI padrao:');
  for (const group of ARCHIVE_GROUPS) {
    const paths = existingPaths(group.paths);
    console.log(`${group.id.padEnd(16, ' ')} ${group.label}`);
    console.log(`  ${paths.join(' ') || '(sem paths existentes)'}`);
  }
}

function parseTimeoutMs() {
  const raw = argValue('timeout-ms') || process.env.ZAVORTH_JEST_GROUP_TIMEOUT_MS || '480000';
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 480000;
}

function selectedGroups() {
  const groupArg = argValue('group');
  if (!groupArg || groupArg === 'all') {
    return GROUPS;
  }
  const requested = new Set(groupArg.split(',').map((entry) => entry.trim()).filter(Boolean));
  const groups = ALL_GROUPS.filter((group) => requested.has(group.id));
  const missing = [...requested].filter((id) => !ALL_GROUPS.some((group) => group.id === id));
  if (missing.length > 0) {
    throw new Error(`Grupo(s) desconhecido(s): ${missing.join(', ')}`);
  }
  return groups;
}

function collectPassThroughArgs() {
  const blockedPrefixes = ['--group', '--timeout-ms'];
  return process.argv.slice(2).filter((arg) => {
    if (arg === '--list' || arg === '--ci') {
      return false;
    }
    return !blockedPrefixes.some((prefix) => arg === prefix || arg.startsWith(`${prefix}=`));
  });
}

function runGroup(group, timeoutMs, passThroughArgs) {
  const paths = existingPaths(group.paths);
  if (paths.length === 0) {
    console.log(`\n[test:ci:${group.id}] PULADO - nenhum path de teste existe.`);
    return Promise.resolve({ id: group.id, status: 'skipped', code: 0, durationMs: 0 });
  }

  console.log(`\n[test:ci:${group.id}] ${group.label}`);
  console.log(`[test:ci:${group.id}] paths: ${paths.join(' ')}`);
  console.log(`[test:ci:${group.id}] timeout: ${timeoutMs}ms`);

  const startedAt = Date.now();
  const ignorePatterns = (group.exclude || [])
    .filter((entry) => fs.existsSync(path.join(projectRoot, entry)))
    .flatMap((entry) => ['--testPathIgnorePatterns', entry.replace(/\\/g, '/')]);
  const args = [
    jestBin,
    ...paths,
    ...ignorePatterns,
    ...(group.jestArgs || []),
    '--runInBand',
    '--bail=1',
    '--forceExit',
    ...passThroughArgs,
  ];
  // Services suite is large; default GitHub runners OOM under the default ~2GB heap.
  // Keep any existing NODE_OPTIONS and only add a higher heap floor when missing.
  const existingNodeOptions = String(process.env.NODE_OPTIONS || '').trim();
  const heapFloor = '--max-old-space-size=8192';
  const nodeOptions = existingNodeOptions.includes('max-old-space-size')
    ? existingNodeOptions
    : [existingNodeOptions, heapFloor].filter(Boolean).join(' ');

  const child = spawn(process.execPath, ['--experimental-vm-modules', ...args], {
    cwd: projectRoot,
    env: {
      ...process.env,
      ZAVORTH_JEST_CI_GROUP: group.id,
      NODE_OPTIONS: nodeOptions,
    },
    stdio: 'inherit',
    windowsHide: true,
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
  }, timeoutMs);

  return new Promise((resolve) => {
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        id: group.id,
        status: 'failed',
        code: 1,
        durationMs: Date.now() - startedAt,
        error: error.message,
      });
    });
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt;
      if (timedOut) {
        console.error(`[test:ci:${group.id}] TIMEOUT depois de ${durationMs}ms.`);
        resolve({ id: group.id, status: 'timeout', code: 124, durationMs, signal });
        return;
      }
      const status = code === 0 ? 'passed' : 'failed';
      console.log(`[test:ci:${group.id}] ${status.toUpperCase()} em ${durationMs}ms.`);
      resolve({ id: group.id, status, code: code ?? 1, durationMs, signal });
    });
  });
}

async function main() {
  if (hasArg('list')) {
    listGroups();
    return;
  }

  if (!fs.existsSync(jestBin)) {
    throw new Error('Jest local nao encontrado. Rode npm install antes dos testes.');
  }

  const groups = selectedGroups();
  const timeoutMs = parseTimeoutMs();
  const passThroughArgs = collectPassThroughArgs();
  const results = [];

  for (const group of groups) {
    results.push(await runGroup(group, timeoutMs, passThroughArgs));
  }

  const failed = results.filter((result) => !['passed', 'skipped'].includes(result.status));
  console.log('\n[test:ci] resumo');
  for (const result of results) {
    console.log(`- ${result.id}: ${result.status} (${result.durationMs}ms)`);
  }

  if (failed.length > 0) {
    console.error(`[test:ci] falhou em: ${failed.map((result) => result.id).join(', ')}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`[test:ci] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
