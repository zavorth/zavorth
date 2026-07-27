#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  runFixture(),
  ruleAbuseCoverage(),
  ruleWorkspaceCheck(),
  ruleBridgeAndGovernanceMarkers(),
];
const failed = rules.filter((item) => item.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-temporal-autonomy-daily-use-certification] checking ZavorthControl controls');
  printRules(rules, '[zavorth-temporal-autonomy-daily-use-certification]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthTemporalAutonomyDailyUseCertificationContract.ts',
    'src/services/ZavorthTemporalAutonomyDailyUseCertificationService.ts',
    'scripts/zavorth-temporal-autonomy-daily-use-certification.ts',
    'scripts/zavorth-temporal-autonomy-daily-use-certification-check.mjs',
    'tests/domain/agent/TemporalAutonomyDailyUseCertificationService.test.ts',
    'docs/README.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('gate-8-files', 'ZavorthControl controls files exist', missing.length === 0, `${files.length ? missing.length}/${files.length}`, 'contract, service, CLI, check, tests and docs are present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ZavorthTemporalAutonomyDailyUseCertificationContract.ts', ['temporal-autonomy-daily-use-certification-gate-8', 'scheduled_tasks', 'acp_bridge', 'channel_without_button_fallback']],
    ['src/services/ZavorthTemporalAutonomyDailyUseCertificationService.ts', ['ZavorthScheduledTaskDailyOpsReadinessService', 'ZavorthChannelCapabilityAwarenessService', 'ZavorthContextRecoveryAssimilationService', 'cron_permission_escalation']],
    ['scripts/zavorth-temporal-autonomy-daily-use-certification.ts', ['--task=', 'ZavorthTemporalAutonomyDailyUseCertificationService']],
    ['src/sdk/contracts.ts', ['ZavorthTemporalAutonomyDailyUseCertificationContract']],
    ['src/sdk/index.ts', ['ZavorthTemporalAutonomyDailyUseCertificationService']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('gate-8-markers', 'ZavorthControl controls markers are wired', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'contract, service, CLI and SDK markers exist', missing);
}

function runFixture() {
  const result = runTs(['--json', '--now=2026-05-12T10:00:00.000Z']);
  return jsonRule('gate-8-fixture', 'Daily-use certification passes all matrix and abuse gates', result, (snapshot) =>
    snapshot.status === 'certified'
    && snapshot.summary.dailyUseCertified === true
    && snapshot.summary.matrixAreas === 7
    && snapshot.summary.passedMatrixAreas === 7
    && snapshot.summary.failedMatrixAreas === 0
    && snapshot.summary.abuseScenarios === 5
    && snapshot.summary.failedAbuseScenarios === 0
    && snapshot.safety.noCronPrivilegeEscalation === true
    && snapshot.safety.expiredApprovalBlocksBeforeGateway === true
    && snapshot.safety.channelFallbackWithoutButtons === true);
}

function ruleAbuseCoverage() {
  const result = runTs(['--json', '--now=2026-05-12T10:00:00.000Z']);
  if (!result.stdout.trim()) return rule('gate-8-abuse-coverage', 'Abuse scenarios are represented', false, `exit ${result.status ?? 'unknown'}`, 'valid JSON fixture', compact(result.stderr));
  try {
    const snapshot = JSON.parse(result.stdout);
    const expected = [
      'cron_permission_escalation',
      'cron_creates_cron',
      'expired_approval',
      'acp_bypass',
      'channel_without_button_fallback',
    ];
    const ids = snapshot.abuseScenarios.map((entry) => entry.id);
    const missing = expected.filter((id) => !ids.includes(id));
    const unsafe = snapshot.abuseScenarios.filter((entry) => entry.status === 'failed' || entry.executionPerformed === true);
    return rule('gate-8-abuse-coverage', 'Abuse scenarios are represented', missing.length === 0 && unsafe.length === 0, `${ids.length}/${expected.length}; unsafe=${unsafe.length}`, 'all ZavorthControl controls abuse scenarios present and safe', [...missing, ...unsafe.map((entry) => JSON.stringify(entry))]);
  } catch (error) {
    return rule('gate-8-abuse-coverage', 'Abuse scenarios are represented', false, 'invalid JSON', 'valid JSON fixture', [String(error), ...compact(result.stderr, result.stdout)]);
  }
}

function ruleWorkspaceCheck() {
  const text = read('package.json');
  const marker = 'node scripts/zavorth-temporal-autonomy-daily-use-certification-check.mjs';
  return rule('workspace-check-wire', 'workspace:check includes ZavorthControl controls daily-use gate', text.includes(marker), text.includes(marker) ? 'wired' : 'missing', marker, []);
}

function ruleBridgeAndGovernanceMarkers() {
  const checks = [
    ['src/adapters/claude/AcpxBridgeRuntimeAdapter.ts', ['requiresOwnerApproval: true', 'bypassPermissionsAllowed: false', 'zavorthPolicyRequired: true']],
    ['src/security/SecurityPolicyBroker.ts', ["| 'mcp'", "SecurityPolicyBrokerSurface", 'require_admin_policy']],
    ['src/runtime/agent/AgentRunService.ts', ['failureResultBuilder', 'providerMeshConsolidation', 'appendRuntimeEventReceipt']],
    ['src/services/AgentOsRollbackManagerService.ts', ['rawSecretsSerialized: false', 'WorkspaceResolver.ensurePathInsideWorkspace']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('bridge-governance-markers', 'ACP/MCP, AgentRun and rollback governance markers exist', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'bridge, broker, AgentRun and rollback markers remain present', missing);
}

function runTs(args) {
  return spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-temporal-autonomy-daily-use-certification.ts',
    ...args,
  ], { cwd: root, encoding: 'utf8', env: process.env });
}

function jsonRule(id, label, result, expect) {
  if (!result.stdout.trim()) {
    return rule(id, label, false, `exit ${result.status ?? 'unknown'}`, 'valid JSON fixture', compact(result.stderr, result.stdout));
  }
  try {
    const snapshot = JSON.parse(result.stdout);
    const passed = expect(snapshot);
    return rule(id, label, passed, `status=${snapshot.status}; matrix=${snapshot.summary?.passedMatrixAreas}/${snapshot.summary?.matrixAreas}; abuseFailed=${snapshot.summary?.failedAbuseScenarios}`, 'expected ZavorthControl controls certification snapshot', passed ? [] : [JSON.stringify(snapshot, null, 2), ...compact(result.stderr)]);
  } catch (error) {
    return rule(id, label, false, 'invalid JSON', 'valid JSON fixture', [String(error), ...compact(result.stderr, result.stdout)]);
  }
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function rule(id, label, passed, observed, target, details = []) {
  return { id, label, status: passed ? 'passed' : 'failed', observed, target, details };
}

function printRules(items, prefix) {
  for (const item of items) {
    console.log(`${prefix} ${item.status === 'passed' ? 'ok' : 'fail'} ${item.label}: ${item.observed} | ${item.target}`);
    for (const detail of item.details.slice(0, 12)) console.log(`  - ${detail}`);
  }
}

function compact(...parts) {
  return parts.join('\n').split(/\r...\n/).map((line) => line.trim()).filter(Boolean).slice(0, 12);
}
