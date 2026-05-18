#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const asJson = process.argv.includes('--json');
const requiredFiles = [
  'src/contracts/AcpLiveBridgeContract.ts',
  'src/services/AcpLiveBridgeService.ts',
  'scripts/acp-live-bridge.ts',
  'scripts/acp-live-bridge-check.mjs',
  'tests/services/AcpLiveBridgeService.test.ts',
  'package.json',
];

const rules = [
  fileRule(),
  packageRule(),
  runtimeRule(),
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
  console.log('[acp-live-bridge] checking');
  for (const rule of rules) {
    console.log(`[acp-live-bridge] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.label}: ${rule.observed}`);
    for (const detail of rule.details || []) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function fileRule() {
  const missing = requiredFiles.filter((file) => !fs.existsSync(file));
  return {
    id: 'acp-live-bridge-files',
    label: 'Files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? `${requiredFiles.length}/${requiredFiles.length} file(s)` : `${missing.length} missing`,
    details: missing,
  };
}

function packageRule() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredScripts = [
    'acp:live-bridge',
    'acp:live-bridge:json',
    'acp:live-bridge:check',
    'qa:acp-live-bridge',
  ];
  const missing = requiredScripts.filter((script) => !packageJson.scripts?.[script]);
  return {
    id: 'acp-live-bridge-package-scripts',
    label: 'Package scripts exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all scripts present' : `${missing.length} missing`,
    details: missing.map((script) => `missing ${script}`),
  };
}

function runtimeRule() {
  const result = spawnSync(process.execPath, [
    'node_modules/tsx/dist/cli.mjs',
    'scripts/acp-live-bridge.ts',
    '--json',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return {
      id: 'acp-live-bridge-runtime',
      label: 'Runtime receipt emits JSON',
      status: 'failed',
      observed: `exit ${result.status ?? 'unknown'}`,
      details: [result.stderr, result.stdout].filter(Boolean),
    };
  }
  try {
    const receipt = JSON.parse(result.stdout);
    const safe = receipt.policy?.ownerApprovalRequired === true
      && receipt.policy?.bypassPermissionsAllowed === false
      && receipt.bridge?.enabledByDefault === false
      && receipt.receipt?.liveExecutionPerformed === false;
    return {
      id: 'acp-live-bridge-runtime',
      label: 'Runtime receipt preserves governance',
      status: safe ? 'passed' : 'failed',
      observed: `status=${receipt.status}, liveReady=${receipt.summary?.liveReady}`,
      details: [
        `enabledByDefault=${receipt.bridge?.enabledByDefault}`,
        `liveExecutionPerformed=${receipt.receipt?.liveExecutionPerformed}`,
        `bypassPermissionsAllowed=${receipt.policy?.bypassPermissionsAllowed}`,
      ],
    };
  } catch (error) {
    return {
      id: 'acp-live-bridge-runtime',
      label: 'Runtime receipt emits JSON',
      status: 'failed',
      observed: 'invalid JSON',
      details: [error instanceof Error ? error.message : String(error)],
    };
  }
}
