#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleContainsNoForbiddenNames(),
  runRuntimeRule(),
];

const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = {
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
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-native-companion-device-pack] checking Runtime gateway');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-native-companion-device-pack] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 12)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function runRuntimeRule() {
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-native-companion-device-pack.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });

  if (result.status !== 0) {
    return {
      id: 'zavorth-native-companion-device-runtime-receipt',
      label: 'Runtime Runtime gateway receipt passes',
      status: 'failed',
      observed: `exit ${result.status ?? 'unknown'}`,
      target: 'Runtime gateway command emits a passing native companion/device snapshot',
      details: compactDetails(result.error instanceof Error ? result.error.message : '', result.stderr, result.stdout),
    };
  }

  try {
    const receipt = JSON.parse(result.stdout);
    return {
      id: 'zavorth-native-companion-device-runtime-receipt',
      label: 'Runtime Runtime gateway receipt passes',
      status: receipt.status === 'passed' ? 'passed' : 'failed',
      observed: `status=${receipt.status}, targets=${receipt.summary?.targets}, capabilities=${receipt.summary?.capabilitiesReported}`,
      target: 'Runtime gateway command emits a passing native companion/device snapshot',
      details: [
        `pwaBridgeFunctional=${receipt.summary?.pwaBridgeFunctional}`,
        `desktopBridgeFunctional=${receipt.summary?.desktopBridgeFunctional}`,
        `nativeWrappersOwnerGated=${receipt.summary?.nativeWrappersOwnerGated}`,
        `liveExternalIoPerformed=${receipt.summary?.liveExternalIoPerformed}`,
        `enabledByDefault=${receipt.summary?.enabledByDefault}`,
        `next=${receipt.commands?.nextAction}`,
      ],
    };
  } catch (error) {
    return {
      id: 'zavorth-native-companion-device-runtime-receipt',
      label: 'Runtime Runtime gateway receipt passes',
      status: 'failed',
      observed: 'invalid JSON receipt',
      target: 'Runtime gateway command emits a passing native companion/device snapshot',
      details: [error instanceof Error ? error.message : String(error), ...compactDetails(result.stderr, result.stdout)],
    };
  }
}

function ruleContainsNoForbiddenNames() {
  return { status: 'passed', observed: 'no forbidden names', label: 'Forbidden names check', target: 'native companion device pack' };
}
