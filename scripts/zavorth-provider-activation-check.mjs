#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [];
const requiredFiles = [
  'src/services/ZavorthProviderActivationService.ts',
  'scripts/zavorth-provider-activation.ts',
  'tests/services/ZavorthProviderActivationService.test.ts',
  'assets/dashboard/scripts/pages.js',
  'assets/dashboard/scripts/runtime-bridge.js',
];

for (const file of requiredFiles) {
  rules.push({
    id: `file:${file}`,
    status: fs.existsSync(path.join(root, file)) ? 'passed' : 'failed',
    summary: `${file} exists`,
  });
}

const snapshot = runActivation(['--json']);
if (snapshot) {
  assertRule('contract:version', snapshot.contractVersion === '2026-05-17.provider-activation.v1', 'Provider activation contract is current');
  assertRule('surface:activation', snapshot.surface === 'provider-activation', 'Provider activation surface is exposed');
  assertRule('summary:routes', Number(snapshot.summary?.routes || 0) >= 70, 'Provider activation sees the expanded provider catalog');
  assertRule('summary:adapters', Number(snapshot.summary?.nativeAdapters || 0) > 0 && Number(snapshot.summary?.openAiCompatibleAdapters || 0) > 0, 'Provider activation classifies native and compatible adapters');
  assertRule('summary:media-connectors', Number(snapshot.summary?.mediaSpecificAdapters || 0) > 0, 'Provider activation tracks media-specific connector work');
  assertRule('live-plan:commands', Array.isArray(snapshot.liveProofPlan) && snapshot.liveProofPlan.some((entry) => String(entry.command || '').includes('zavorth providers live --provider')), 'Provider activation exposes explicit live-proof commands');
  assertRule('safety:no-hidden-live', snapshot.safety?.noHiddenLiveNetworkCalls === true && snapshot.dashboardProjection?.normalRenderMakesNoNetworkCalls === true, 'Provider activation dashboard render makes no hidden live calls');
  assertRule('safety:no-secrets', !JSON.stringify(snapshot).match(/sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}/), 'Provider activation does not serialize raw provider secrets');
}

const pageSource = read('assets/dashboard/scripts/pages.js');
const runtimeSource = read('assets/dashboard/scripts/runtime-bridge.js');
assertRule('dashboard:markup', pageSource.includes('data-provider-activation-summary') && pageSource.includes('data-provider-activation-list'), 'Dashboard includes provider activation markup');
assertRule('dashboard:runtime', runtimeSource.includes('/api/providers/activation') && runtimeSource.includes('updateProviderActivation'), 'Dashboard runtime fetches and renders provider activation');

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
  console.log('[provider-activation] certification');
  for (const rule of rules) {
    console.log(`[provider-activation] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.summary}`);
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function runActivation(args) {
  try {
    const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
    const fullArgs = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npx', 'tsx', 'scripts/zavorth-provider-activation.ts', ...args]
      : ['tsx', 'scripts/zavorth-provider-activation.ts', ...args];
    return JSON.parse(execFileSync(command, fullArgs, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }));
  } catch (error) {
    rules.push({
      id: 'script:provider-activation',
      status: 'failed',
      summary: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function assertRule(id, condition, summary) {
  rules.push({ id, status: condition ? 'passed' : 'failed', summary });
}

function read(file) {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8');
  } catch {
    return '';
  }
}
