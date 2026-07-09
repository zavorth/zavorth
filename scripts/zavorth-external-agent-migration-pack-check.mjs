#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  runPreviewFixture(),
  runApplyRequiresApprovalFixture(),
  runApplyWritesDraftsFixture(),
  runSecretRedactionFixture(),
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
  console.log('[zavorth-external-agent-migration-pack] checking governed migration');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-external-agent-migration-pack] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 12)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthExternalAgentMigrationPackContract.ts',
    'src/services/ZavorthExternalAgentMigrationPackService.ts',
    'scripts/zavorth-external-agent-migration-pack.ts',
    'scripts/zavorth-external-agent-migration-pack-check.mjs',
    'tests/services/ZavorthExternalAgentMigrationPackService.test.ts',
    'tests/telegram/TelegramCommandRoutingService.test.ts',
    'package.json',
    'src/zavorth-cli.ts',
    'src/telegram/TelegramCommandRoutingService.ts',
    'src/telegram/controllers/TelegramOpsController.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'files-exist',
    label: 'Migration pack files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'contract, service, script, check, tests, package and CLI integration',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ZavorthExternalAgentMigrationPackContract.ts', [
      'zavorth-external-agent-migration-pack/1',
      'providerKeysBecomeSecretRefsOnly: true',
      'noExternalProcessStarted: true',
    ]],
    ['src/services/ZavorthExternalAgentMigrationPackService.ts', [
      'noDotEnvRead: true',
      'noSecretFileRead: true',
      'noRuntimeExecution: true',
      'noNetworkProbe: true',
      'importedSkillsDraftOnly: true',
      'registerCandidate',
    ]],
    ['scripts/zavorth-external-agent-migration-pack.ts', [
      '--register-as-arm',
      '--approval-id',
      '--consent',
    ]],
    ['src/zavorth-cli.ts', [
      'runExternalAgentMigrationPack',
      'agent import',
    ]],
    ['src/telegram/TelegramCommandRoutingService.ts', [
      'handleExternalAgentMigrationPack',
      '/agentimport',
      '/agentmigration',
    ]],
    ['src/telegram/controllers/TelegramOpsController.ts', [
      'ZavorthExternalAgentMigrationPackService',
      'handleExternalAgentMigrationPack',
      'parseExternalAgentMigrationTelegramArgs',
    ]],
    ['package.json', [
      'zavorth:external-agent-migration-pack',
      'zavorth:external-agent-migration-pack:check',
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
    label: 'Migration pack safety markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'consent-first, no secret read, approval-gated migration',
    details: missing,
  };
}

function runPreviewFixture() {
  const fixture = createFixture();
  const result = runCli(['--json', '--path', fixture, '--consent', '--preset', 'full', '--target-root', tempTarget()]);
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot?.surface === 'external-agent-migration-pack'
    && snapshot?.status === 'preview-ready'
    && snapshot?.policy?.noRuntimeExecution === true
    && snapshot?.policy?.noNetworkProbe === true
    && snapshot?.summary?.skills >= 1
    && snapshot?.summary?.memory >= 1;
  return {
    id: 'preview-fixture',
    label: 'Preview builds a migration plan without writes',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.summary.assetsPlanned} assets` : `exit ${result.status}`,
    target: 'preview-ready with skills and memory assets',
    details: ok ? [] : [result.stderr || result.stdout || 'no output'],
  };
}

function runApplyRequiresApprovalFixture() {
  const fixture = createFixture();
  const result = runCli(['--json', '--path', fixture, '--consent', '--apply', '--target-root', tempTarget()]);
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot?.status === 'approval-required'
    && snapshot?.summary?.assetsWritten === 0
    && snapshot?.receipt?.guarantees?.writesRequireApproval === true;
  return {
    id: 'approval-required',
    label: 'Apply is blocked without approval id',
    status: ok ? 'passed' : 'failed',
    observed: ok ? snapshot.status : `exit ${result.status}`,
    target: 'no writes without approval-id',
    details: ok ? [] : [result.stderr || result.stdout || 'no output'],
  };
}

function runApplyWritesDraftsFixture() {
  const fixture = createFixture();
  const target = tempTarget();
  const result = runCli(['--json', '--path', fixture, '--consent', '--apply', '--approval-id', 'appr-migration-test', '--preset', 'full', '--target-root', target]);
  const snapshot = parseJson(result.stdout);
  const affected = snapshot?.rollback?.affectedPaths || [];
  const ok = result.status === 0
    && ['migrated', 'partial'].includes(snapshot?.status)
    && snapshot?.summary?.assetsWritten > 0
    && affected.every((entry) => String(entry).startsWith(path.resolve(target)))
    && affected.some((entry) => fs.existsSync(entry));
  return {
    id: 'apply-writes-drafts',
    label: 'Approved apply writes only migration drafts',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.summary.assetsWritten} written` : `exit ${result.status}`,
    target: 'approved apply writes governed draft files under target root',
    details: ok ? [] : [result.stderr || result.stdout || 'no output'],
  };
}

function runSecretRedactionFixture() {
  const fixture = createFixture();
  fs.writeFileSync(path.join(fixture, '.env'), 'API_KEY=sk-should-not-be-read\n', 'utf8');
  fs.writeFileSync(path.join(fixture, 'provider-config.md'), 'API_KEY=sk-12345678901234567890\n', 'utf8');
  const result = runCli(['--json', '--path', fixture, '--consent', '--preset', 'full', '--target-root', tempTarget()]);
  const snapshot = parseJson(result.stdout);
  const serialized = JSON.stringify(snapshot || {});
  const ok = result.status === 0
    && snapshot?.summary?.skippedSecrets >= 1
    && !serialized.includes('sk-should-not-be-read')
    && !serialized.includes('sk-12345678901234567890')
    && snapshot?.policy?.noDotEnvRead === true;
  return {
    id: 'secret-redaction',
    label: 'Secret-like content is not serialized',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.summary.skippedSecrets} skipped secret refs` : `exit ${result.status}`,
    target: '.env skipped and secret-like provider values redacted',
    details: ok ? [] : [result.stderr || result.stdout || 'no output'],
  };
}

function createFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-migration-fixture-'));
  fs.mkdirSync(path.join(dir, 'skills', 'writer'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'memory'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'agent'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'fixture-agent', keywords: ['agent', 'acp'] }, null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'SOUL.md'), '# Persona\nHelpful local agent.\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'memory', 'MEMORY.md'), '# Memory\nUser prefers approvals.\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'skills', 'writer', 'SKILL.md'), '# Writer\nDraft documents.\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'agent', 'run_agent.py'), 'print("fixture")\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'telegram-settings.json'), '{"enabled":false}\n', 'utf8');
  return dir;
}

function tempTarget() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-migration-target-'));
}

function runCli(args) {
  return spawnSync(process.execPath, [tsxCli, 'scripts/zavorth-external-agent-migration-pack.ts', ...args], {
    cwd: root,
    encoding: 'utf8',
  });
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
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1) {
      return JSON.parse(text.substring(startIndex, endIndex + 1));
    }
    return JSON.parse(text);
  } catch {
    return null;
  }
}
