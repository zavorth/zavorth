#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-native-evolution-runtime-mcp-'));

try {
  fs.writeFileSync(
    path.join(fixtureRoot, 'plugin.json'),
    JSON.stringify({
      name: 'Calendar MCP Pack',
      description: 'Read calendar information through an MCP connector.',
      tools: ['calendar.read', 'calendar.search'],
    }),
    'utf8',
  );

  const rules = [
    filesExist(),
    markersPresent(),
    promptFixture(),
    runtimeFixture(),
    mcpFixture(fixtureRoot),
    workspaceWire(),
  ];
  const failed = rules.filter((rule) => rule.status === 'failed');
  const snapshot = {
    generatedAt: new Date().toISOString(),
    status: failed.length > 0 ? 'failed' : 'passed',
    rules,
  };

  if (asJson) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    for (const rule of rules) {
      console.log(`[zavorth-native-evolution-runtime-mcp] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.summary}`);
    }
  }
  if (failed.length > 0) process.exitCode = 1;
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

function filesExist() {
  const files = [
    'src/contracts/PromptEvolutionLabContract.ts',
    'src/contracts/RuntimeProfilePlaybookContract.ts',
    'src/contracts/McpEcosystemIntakeContract.ts',
    'src/services/PromptEvolutionLabService.ts',
    'src/services/RuntimeProfilePlaybookService.ts',
    'src/services/McpEcosystemIntakeService.ts',
    'scripts/zavorth-prompt-evolution-lab.ts',
    'scripts/zavorth-runtime-profile-playbook.ts',
    'scripts/zavorth-mcp-ecosystem-intake.ts',
    'tests/services/ZavorthNativeEvolutionRuntimeMcpService.test.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('files', missing.length === 0, `${files.length - missing.length}/${files.length} files`, missing);
}

function markersPresent() {
  const checks = [
    ['src/services/PromptEvolutionLabService.ts', [
      'promptChangesNeverAutoApply',
      'regressionGateRequired',
      'sandboxSmokeRequired',
      'redactPrompt',
    ]],
    ['src/services/RuntimeProfilePlaybookService.ts', [
      'vps-24-7',
      'safe-8gb-desktop',
      'heavySidecarsLazyByDefault',
      'liveMutationUnaffectedByProfile',
    ]],
    ['src/services/McpEcosystemIntakeService.ts', [
      'externalMcpNeverTrustedAutomatically',
      'quarantineBeforeToolExposure',
      'executableToolsExposed: 0',
    ]],
    ['package.json', [
      'zavorth:prompt-evolution-lab:check',
      'zavorth:runtime-profile-playbook:check',
      'zavorth:mcp-ecosystem-intake:check',
      'zavorth:native-evolution-runtime-mcp:check',
    ]],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) if (!text.includes(needle)) missing.push(`${file}: ${needle}`);
  }
  return rule('markers', missing.length === 0, missing.length ? `${missing.length} missing` : 'all markers', missing);
}

function promptFixture() {
  const result = runTs('scripts/zavorth-prompt-evolution-lab.ts', [
    '--json',
    '--base-prompt=Use evidence and approvals. api_key=sk-1234567890abcdef raw secret must stay hidden.',
  ]);
  return jsonRule('prompt-fixture', result, (snapshot) =>
    snapshot.version === 'prompt-evolution-lab/v1'
    && snapshot.promotion?.requiresApproval === true
    && snapshot.promotion?.noAutoApply === true
    && snapshot.safety?.rawSystemPromptSerialized === false
    && JSON.stringify(snapshot).includes('[REDACTED')
    && !JSON.stringify(snapshot).includes('sk-1234567890abcdef'));
}

function runtimeFixture() {
  const result = runTs('scripts/zavorth-runtime-profile-playbook.ts', ['--json', '--target=vps-24-7']);
  return jsonRule('runtime-fixture', result, (snapshot) =>
    snapshot.version === 'runtime-profile-playbook/v1'
    && snapshot.selected?.recommendedProfile === 'chat'
    && snapshot.selected?.fallbackProfile === 'minimal'
    && snapshot.safety?.heavySidecarsLazyByDefault === true
    && snapshot.safety?.liveMutationUnaffectedByProfile === true);
}

function mcpFixture(sourcePath) {
  const result = runTs('scripts/zavorth-mcp-ecosystem-intake.ts', ['--json', '--source', sourcePath]);
  return jsonRule('mcp-fixture', result, (snapshot) =>
    snapshot.version === 'mcp-ecosystem-intake/v1'
    && snapshot.summary?.mcpCandidates === 1
    && snapshot.summary?.executableToolsExposed === 0
    && snapshot.policy?.noInstallPerformed === true
    && snapshot.policy?.noExecutionPerformed === true
    && snapshot.policy?.quarantineBeforeToolExposure === true
    && snapshot.items?.[0]?.status === 'quarantined');
}

function workspaceWire() {
  const text = read('package.json');
  const marker = 'npm run zavorth:native-evolution-runtime-mcp:check --silent';
  return rule('workspace-wire', text.includes(marker), text.includes(marker) ? 'wired' : 'missing workspace gate', []);
}

function runTs(script, args) {
  return spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    script,
    ...args,
  ], { cwd: root, encoding: 'utf8', env: process.env });
}

function jsonRule(id, result, predicate) {
  if (!result.stdout.trim()) return rule(id, false, `empty output: ${result.stderr}`, []);
  try {
    const parsed = JSON.parse(result.stdout);
    return rule(id, Boolean(predicate(parsed)), `status=${parsed.status}; selected=${parsed.selected?.id || parsed.selected?.recommendedProfile || 'n/a'}`, []);
  } catch (error) {
    return rule(id, false, String(error), [result.stdout, result.stderr]);
  }
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function rule(id, passed, summary, details) {
  return { id, status: passed ? 'passed' : 'failed', summary, details };
}
