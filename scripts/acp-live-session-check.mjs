#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const asJson = process.argv.includes('--json');
const requiredFiles = [
  'src/contracts/AcpLiveBridgeContract.ts',
  'src/services/AcpLiveSessionService.ts',
  'scripts/acp-live-session.ts',
  'scripts/acp-live-session-check.mjs',
  'tests/services/AcpLiveSessionService.test.ts',
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
  console.log('[acp-live-session] checking');
  for (const rule of rules) {
    console.log(`[acp-live-session] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.label}: ${rule.observed}`);
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
    id: 'acp-live-session-files',
    label: 'Files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? `${requiredFiles.length}/${requiredFiles.length} file(s)` : `${missing.length} missing`,
    details: missing,
  };
}

function packageRule() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredScripts = [
    'acp:live-session',
    'acp:live-session:json',
    'acp:live-session:check',
    'qa:acp-live-session',
  ];
  const missing = requiredScripts.filter((script) => !packageJson.scripts?.[script]);
  return {
    id: 'acp-live-session-package-scripts',
    label: 'Package scripts exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all scripts present' : `${missing.length} missing`,
    details: missing.map((script) => `missing ${script}`),
  };
}

function runtimeRule() {
  const result = spawnSync(process.execPath, [
    'node_modules/tsx/dist/cli.mjs',
    'scripts/acp-live-session.ts',
    '--json',
    '--prompt',
    'ping',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return {
      id: 'acp-live-session-runtime',
      label: 'Runtime receipt emits JSON',
      status: 'failed',
      observed: `exit ${result.status ?? 'unknown'}`,
      details: [result.stderr, result.stdout].filter(Boolean),
    };
  }
  try {
    const receipt = JSON.parse(result.stdout);
    const safe = receipt.surface === 'acp-live-session'
      && receipt.session?.transport === 'local-jsonrpc'
      && receipt.session?.liveToolExecutionPerformed === false
      && receipt.governance?.rawSecretsSerialized === false
      && receipt.toolDecisions?.some((decision) => decision.decision === 'approval_required');
    return {
      id: 'acp-live-session-runtime',
      label: 'Runtime session preserves governance',
      status: safe ? 'passed' : 'failed',
      observed: `status=${receipt.status}, events=${receipt.output?.eventCount}`,
      details: [
        `transport=${receipt.session?.transport}`,
        `liveToolExecutionPerformed=${receipt.session?.liveToolExecutionPerformed}`,
        `toolDecisions=${receipt.toolDecisions?.length || 0}`,
      ],
    };
  } catch (error) {
    return {
      id: 'acp-live-session-runtime',
      label: 'Runtime receipt emits JSON',
      status: 'failed',
      observed: 'invalid JSON',
      details: [error instanceof Error ? error.message : String(error)],
    };
  }
}
