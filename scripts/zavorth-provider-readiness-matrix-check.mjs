#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [];
const requiredFiles = [
  'src/contracts/ZavorthProviderReadinessMatrixContract.ts',
  'src/services/ZavorthProviderReadinessMatrixService.ts',
  'scripts/zavorth-provider-readiness-matrix.ts',
  'tests/services/ZavorthProviderReadinessMatrixService.test.ts',
];

for (const file of requiredFiles) {
  rules.push({
    id: `file:${file}`,
    status: fs.existsSync(path.join(root, file)) ? 'passed' : 'failed',
    summary: `${file} exists`,
  });
}

const matrix = runProviderMatrix([]);
const testPacket = runProviderMatrix(['test', 'openai']);

if (matrix) {
  assertRule('contract:version', matrix.contractVersion === '2026-05-14.checkpoint-3-live-completion', 'Provider readiness contract version is current');
  assertRule('surface:matrix', matrix.surface === 'provider-readiness-matrix', 'Provider readiness matrix surface is exposed');
  assertRule('statuses:normalized', hasAnyStatus(matrix, ['ready', 'missing_auth', 'missing_base_url', 'needs_probe', 'degraded', 'unsupported', 'blocked']), 'Provider statuses are normalized');
  assertRule('commands:test', matrix.commands?.some((entry) => entry.id === 'providers-test'), 'Provider test command is exposed');
  assertRule('commands:live', matrix.commands?.some((entry) => entry.id === 'providers-test-live'), 'Explicit live provider probe command is exposed');
  assertRule('catalog:simple', Array.isArray(matrix.simpleCatalog?.openAiCompatible), 'Simple model catalog is exposed');
  assertRule('summary:live', Number.isInteger(matrix.summary?.liveNotRun) && Number.isInteger(matrix.summary?.livePassed), 'Live matrix counters are exposed');
  assertRule('summary:live-ready', Number.isInteger(matrix.summary?.liveReady) && Number.isInteger(matrix.summary?.catalogReadyButNotLive) && Number.isInteger(matrix.summary?.defaultRouteAllowed), 'Live-ready and default-routing counters are exposed');
  assertRule('live-completion:policy', matrix.liveCompletion?.providerSelectionRequiresLiveProof === true && matrix.liveCompletion?.catalogSupportIsNotLiveProof === true, 'Live completion policy separates catalog support from live proof');
  assertRule('entries:default-gate', matrix.entries?.every((entry) => typeof entry.liveReady === 'boolean' && typeof entry.defaultRouteAllowed === 'boolean' && typeof entry.readinessProof === 'string'), 'Provider entries expose live-ready/default route gate fields');
  assertRule('projection:no-authority', matrix.zavorthControlProjection?.executionAuthority === false, 'ZavorthControl has no provider execution authority');
  assertRule('secrets:none', !JSON.stringify(matrix).match(/sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}/), 'Matrix does not serialize raw provider secrets');
}

if (testPacket) {
  assertRule('probe:explicit', testPacket.entries?.every((entry) => entry.probe?.liveNetworkUsed === false), 'Provider test packet does not perform hidden live network calls');
  assertRule('probe:shape', testPacket.entries?.every((entry) => entry.probe?.mode && Object.prototype.hasOwnProperty.call(entry.probe, 'evidenceHash')), 'Provider probe evidence shape is stable');
}

const failed = rules.filter((rule) => rule.status === 'failed');
const result = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: {
    rules: rules.length,
    passed: rules.length - failed.length,
    failed: failed.length,
  },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('[provider-readiness-matrix] certification');
  for (const rule of rules) {
    console.log(`[provider-readiness-matrix] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.summary}`);
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function runProviderMatrix(args) {
  try {
    const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
    const fullArgs = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npx', 'tsx', 'scripts/zavorth-provider-readiness-matrix.ts', '--json', ...args]
      : ['tsx', 'scripts/zavorth-provider-readiness-matrix.ts', '--json', ...args];
    const output = execFileSync(command, fullArgs, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(output);
  } catch (error) {
    rules.push({
      id: `script:${args.join('-') || 'matrix'}`,
      status: 'failed',
      summary: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function hasAnyStatus(snapshot, statuses) {
  const values = new Set((snapshot.entries || []).map((entry) => entry.status));
  return statuses.some((status) => values.has(status));
}

function assertRule(id, condition, summary) {
  rules.push({
    id,
    status: condition ? 'passed' : 'failed',
    summary,
  });
}
