#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  filesExist(),
  markersPresent(),
  providerFixture(),
  backendFixture(),
  checklistFixture(),
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
    console.log(`[zavorth-setup-playbooks] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.summary}`);
  }
}
if (failed.length > 0) process.exitCode = 1;

function filesExist() {
  const files = [
    'src/contracts/ProviderConnectionPlaybookContract.ts',
    'src/contracts/ExecutionBackendPlaybookContract.ts',
    'src/contracts/DashboardSetupChecklistContract.ts',
    'src/services/ProviderConnectionPlaybookService.ts',
    'src/services/ExecutionBackendPlaybookService.ts',
    'src/services/DashboardSetupChecklistService.ts',
    'scripts/zavorth-provider-connection-playbook.ts',
    'scripts/zavorth-execution-backend-playbook.ts',
    'scripts/zavorth-dashboard-setup-checklist.ts',
    'tests/services/ZavorthSetupPlaybooksService.test.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('files', missing.length === 0, `${files.length - missing.length}/${files.length} files`, missing);
}

function markersPresent() {
  const checks = [
    ['src/services/ProviderConnectionPlaybookService.ts', ['catalogSupportIsNotLiveProof', 'liveProbeRequiresExplicitAction']],
    ['src/services/ExecutionBackendPlaybookService.ts', ['dryRunWhenStrongSandboxMissing', 'mutationRequiresApproval']],
    ['src/services/DashboardSetupChecklistService.ts', [
      'Conectar Telegram',
      'Configurar executor seguro',
      'Revisar memoria aprendida',
      'Instalar skills e MCP com preview',
      'Agendar rotina com preview',
      'Rodar missao por perfil',
      'Rodar avaliacoes continuas',
    ]],
    ['package.json', ['zavorth:provider-connection-playbook:check', 'zavorth:execution-backend-playbook:check', 'zavorth:dashboard-setup-checklist:check']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) if (!text.includes(needle)) missing.push(`${file}: ${needle}`);
  }
  return rule('markers', missing.length === 0, missing.length ? `${missing.length} missing` : 'all markers', missing);
}

function providerFixture() {
  const result = runTs('scripts/zavorth-provider-connection-playbook.ts', ['--json', '--provider=openai']);
  return jsonRule('provider-fixture', result, (snapshot) =>
    snapshot.version === 'provider-connection-playbook/v1'
    && snapshot.selected
    && snapshot.selected.safety.rawSecretsSerialized === false
    && snapshot.selected.safety.liveProbeRequiresExplicitAction === true
    && Array.isArray(snapshot.selected.requiredInputKeys));
}

function backendFixture() {
  const result = runTs('scripts/zavorth-execution-backend-playbook.ts', ['--json', '--backend=docker']);
  return jsonRule('backend-fixture', result, (snapshot) =>
    snapshot.version === 'execution-backend-playbook/v1'
    && snapshot.selected?.backendId === 'docker'
    && snapshot.selected?.liveMutationAllowedByDefault === false
    && snapshot.selected?.safety?.dryRunWhenStrongSandboxMissing === true);
}

function checklistFixture() {
  const result = runTs('scripts/zavorth-dashboard-setup-checklist.ts', ['--json']);
  return jsonRule('checklist-fixture', result, (snapshot) =>
    snapshot.version === 'dashboard-setup-checklist/v1'
    && snapshot.items?.length === 8
    && snapshot.safety?.projectionOnly === true
    && snapshot.items.some((item) => item.id === 'connect-provider')
    && snapshot.items.some((item) => item.id === 'configure-executor')
    && snapshot.items.some((item) => item.id === 'review-memory')
    && snapshot.items.some((item) => item.id === 'install-skills-governed')
    && snapshot.items.some((item) => item.id === 'schedule-with-preview')
    && snapshot.items.some((item) => item.id === 'run-profile-mission')
    && snapshot.items.some((item) => item.id === 'run-quality-evals'));
}

function workspaceWire() {
  const text = read('package.json');
  const marker = 'npm run zavorth:setup-playbooks:check --silent';
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
    return rule(id, Boolean(predicate(parsed)), `status=${parsed.status}; selected=${parsed.selected?.providerId || parsed.selected?.backendId || 'none'}`, []);
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
