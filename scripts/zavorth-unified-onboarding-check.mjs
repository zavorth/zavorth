#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const requiredFiles = [
  'src/contracts/ZavorthUnifiedOnboardingContract.ts',
  'src/services/ZavorthUnifiedOnboardingService.ts',
  'scripts/zavorth-unified-onboarding.ts',
  'tests/services/ZavorthUnifiedOnboardingService.test.ts',
];

const rules = [];

for (const file of requiredFiles) {
  rules.push({
    id: `file:${file}`,
    status: fs.existsSync(path.join(root, file)) ? 'passed' : 'failed',
    summary: `${file} exists`,
  });
}

let snapshot = null;
try {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx', 'tsx', 'scripts/zavorth-unified-onboarding.ts', '--json']
    : ['tsx', 'scripts/zavorth-unified-onboarding.ts', '--json'];
  const output = execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  snapshot = JSON.parse(output);
} catch (error) {
  rules.push({
    id: 'script:json',
    status: 'failed',
    summary: `unified onboarding script did not return valid JSON: ${error instanceof Error ? error.message : String(error)}`,
  });
}

if (snapshot) {
  assertRule('contract:version', snapshot.contractVersion === '2026-05-13.checkpoint-2', 'Unified onboarding contract version is current');
  assertRule('surface:unified', snapshot.surface === 'unified-onboarding', 'Unified onboarding surface is exposed');
  assertRule('commands:onboard', hasCommand(snapshot, 'onboard'), 'zavorth onboard is the canonical entry');
  assertRule('commands:doctor-simple', hasCommand(snapshot, 'doctor-simple'), 'simple doctor is part of the same journey');
  assertRule('commands:go', hasCommand(snapshot, 'go'), 'zavorth go is part of the same journey');
  assertRule('commands:gateway', hasCommand(snapshot, 'gateway-status'), 'Gateway status is part of the same journey');
  assertRule('steps:provider', hasStep(snapshot, 'provider'), 'Provider readiness is a first-run step');
  assertRule('steps:sandbox', hasStep(snapshot, 'sandbox'), 'Sandbox readiness is a first-run step');
  assertRule('steps:first-mission', hasStep(snapshot, 'first-mission'), 'First mission is a guided onboarding step');
  assertRule('safe-demo:readonly', snapshot.safeDemo?.readOnly === true, 'Safe demo is read-only');
  assertRule('zavorthControl:no-authority', snapshot.zavorthControlProjection?.executionAuthority === false, 'ZavorthControl projection has no execution authority');
  assertRule(
    'invariant:one-journey',
    snapshot.invariants?.some((entry) => entry.id === 'setup-go-doctor-one-journey' && entry.status === 'passed'),
    'setup/go/doctor are represented as one journey',
  );
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
  console.log('[unified-onboarding] certification');
  for (const rule of rules) {
    console.log(`[unified-onboarding] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.summary}`);
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function assertRule(id, condition, summary) {
  rules.push({
    id,
    status: condition ? 'passed' : 'failed',
    summary,
  });
}

function hasCommand(snapshot, id) {
  return Array.isArray(snapshot.commands) && snapshot.commands.some((entry) => entry.id === id);
}

function hasStep(snapshot, id) {
  return Array.isArray(snapshot.steps) && snapshot.steps.some((entry) => entry.id === id);
}
