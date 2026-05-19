#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  runCommand('/status', 'handled'),
  runCommand('/model gemini:gemini-2.5-pro', 'preview'),
  runCommand('/undo', 'approval-required'),
  runCommand('/skills security', null),
  runNoSecretOrExecutionFixture(),
];
const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: { rules: rules.length, passed: rules.length - failed.length, failed: failed.length },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-smart-commands] checking slash parity');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-smart-commands] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 12)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthSmartCommandSurfaceContract.ts',
    'src/services/ZavorthSmartCommandSurfaceService.ts',
    'scripts/zavorth-smart-commands.ts',
    'scripts/zavorth-smart-commands-check.mjs',
    'tests/services/ZavorthSmartCommandSurfaceService.test.ts',
    'package.json',
    'src/zavorth-cli.ts',
    'src/cli/ZavorthCliRegistry.ts',
    'src/services/SharedSurfaceCommandService.ts',
    'tests/domain/surface/SharedSurfaceCommandService.smart-commands.test.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'files-exist',
    label: 'Smart command files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'contract, service, script, check, tests, package and CLI integration',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ZavorthSmartCommandSurfaceContract.ts', [
      'zavorth-smart-command-surface/1',
      "'model'",
      "'personality'",
      'noFilesystemMutationWithoutApproval: true',
    ]],
    ['src/services/ZavorthSmartCommandSurfaceService.ts', [
      '/new',
      '/reset',
      '/model [provider:model]',
      '/personality [name]',
      '/retry',
      '/undo',
      '/compress',
      '/usage',
      '/insights [days]',
      '/skills [query]',
      '/stop',
      '/platforms',
      '/status',
      '/sethome <path>',
      'noExternalAgentInvocation: true',
    ]],
    ['src/cli/ZavorthCliRegistry.ts', [
      'ZavorthSmartCommandSurfaceService',
      'smartCommandSurface',
    ]],
    ['src/services/SharedSurfaceCommandService.ts', [
      'ZavorthSmartCommandSurfaceService',
      'smartCommandSurface',
      'extractSharedSurfaceInlineValue',
    ]],
    ['src/zavorth-cli.ts', [
      'runSmartCommands',
      'smart-command',
    ]],
    ['package.json', [
      'zavorth:smart-commands',
      'zavorth:smart-commands:check',
    ]],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    if (!text) {
      missing.push(`missing ${file}`);
      continue;
    }
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return {
    id: 'markers',
    label: 'Smart command markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'all command aliases and safety markers present',
    details: missing,
  };
}

function runCommand(command, expectedStatus) {
  const result = spawnSync(process.execPath, [tsxCli, 'scripts/zavorth-smart-commands.ts', '--json', command], {
    cwd: root,
    encoding: 'utf8',
  });
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot?.surface === 'smart-command-surface'
    && snapshot?.safety?.noShellExecution === true
    && snapshot?.safety?.noNetworkProbe === true
    && snapshot?.safety?.noExternalAgentInvocation === true
    && (!expectedStatus || snapshot.status === expectedStatus);
  return {
    id: `command-${command.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`,
    label: `Command ${command}`,
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.command.id}/${snapshot.status}` : `exit ${result.status}`,
    target: expectedStatus ? `status ${expectedStatus}` : 'handled by smart command surface',
    details: ok ? [] : [result.stderr || result.stdout || 'no output'],
  };
}

function runNoSecretOrExecutionFixture() {
  const result = spawnSync(process.execPath, [tsxCli, 'scripts/zavorth-smart-commands.ts', '--json', '/sethome C:/very/secret/path --apply'], {
    cwd: root,
    encoding: 'utf8',
  });
  const snapshot = parseJson(result.stdout);
  const serialized = JSON.stringify(snapshot || {});
  const ok = result.status === 0
    && snapshot?.status === 'approval-required'
    && snapshot?.action?.performed === false
    && !/sk-[A-Za-z0-9]/.test(serialized)
    && snapshot?.policy?.riskyCommandsRequireApproval === true;
  return {
    id: 'sethome-approval',
    label: 'State-changing command is approval gated',
    status: ok ? 'passed' : 'failed',
    observed: ok ? snapshot.status : `exit ${result.status}`,
    target: 'sethome/apply cannot mutate without approval',
    details: ok ? [] : [result.stderr || result.stdout || 'no output'],
  };
}

function read(file) {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8');
  } catch {
    return null;
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
