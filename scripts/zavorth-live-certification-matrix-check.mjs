#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const rules = [
  ruleFilesExist(),
  ruleContainsMarkers(),
  rulePackageScripts(),
  ruleWorkspaceCheck(),
  ruleSnapshot(),
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
  console.log('[zavorth-live-certification-matrix] checking Phase 13');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-live-certification-matrix] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 20)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthLiveCertificationMatrixContract.ts',
    'src/services/ZavorthLiveCertificationMatrixService.ts',
    'scripts/zavorth-live-certification-matrix.ts',
    'scripts/zavorth-live-certification-matrix-check.mjs',
    'tests/services/ZavorthLiveCertificationMatrixService.test.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule(
    'phase-13-files',
    'Phase 13 files exist',
    missing.length === 0,
    `${files.length - missing.length}/${files.length}`,
    'contract, service, CLI, check and tests are present',
    missing,
  );
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthLiveCertificationMatrixContract.ts', [
      'live_passed',
      'dry_run_passed',
      'needs_setup',
      'unsupported',
      'ZAVORTH_LIVE_CERTIFICATION_MATRIX_CONTRACT_VERSION',
    ]],
    ['src/services/ZavorthLiveCertificationMatrixService.ts', [
      'Dashboard gateway',
      'CLI daily-use surface',
      'Provider P0 matrix',
      'Telegram channel',
      'Subagents live parity',
      'Skills and learning loop',
      'Scheduler daily autonomy',
      'Perception and device control',
      'Prompt injection in web/skill content',
      'Scheduled task privilege escalation',
      'Subagent infinite spawn',
      'Mutation without sandbox',
    ]],
  ];
  const missing = [];
  for (const [file, markers] of checks) {
    const text = read(file);
    if (text === null) {
      missing.push(`missing ${file}`);
      continue;
    }
    for (const marker of markers) {
      if (!text.includes(marker)) missing.push(`${file}: missing ${marker}`);
    }
  }
  return rule(
    'phase-13-markers',
    'Live matrix markers are wired',
    missing.length === 0,
    missing.length === 0 ? 'all markers' : `${missing.length} missing`,
    'matrix statuses, daily surfaces and abuse cases are represented',
    missing,
  );
}

function rulePackageScripts() {
  const pkg = JSON.parse(read('package.json') || '{}');
  const scripts = pkg.scripts || {};
  const required = [
    'zavorth:live-certification-matrix',
    'zavorth:live-certification-matrix:json',
    'zavorth:live-certification-matrix:check',
    'daily:certify',
  ];
  const missing = required.filter((script) => !scripts[script]);
  return rule(
    'package-scripts',
    'Package scripts are wired',
    missing.length === 0,
    missing.length === 0 ? 'all scripts' : `${missing.length} missing`,
    required.join(', '),
    missing,
  );
}

function ruleWorkspaceCheck() {
  const text = read('package.json') || '';
  const marker = 'zavorth:live-certification-matrix:check';
  return rule(
    'workspace-check',
    'workspace:check includes Phase 13 gate',
    text.includes(marker),
    text.includes(marker) ? 'wired' : 'missing',
    marker,
    [],
  );
}

function ruleSnapshot() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-live-certification-matrix.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
    timeout: 90000,
  });
  if (result.status !== 0) {
    return rule('snapshot', 'Live certification matrix runs', false, `exit=${result.status}`, 'status=passed', [
      result.error?.message || result.stderr || result.stdout || 'no output',
    ]);
  }
  const data = parseJson(result.stdout);
  const statuses = new Set((data?.matrix || []).map((entry) => entry.status));
  const pass = data
    && data.contractVersion === '2026-05-14.phase-13-live-certification-matrix'
    && data.status === 'passed'
    && data.summary?.dashboardCertified === true
    && data.summary?.cliCertified === true
    && data.summary?.providerP0Certified === true
    && data.summary?.channelMeshCertified === true
    && data.summary?.sandboxCertified === true
    && data.summary?.approvalsCertified === true
    && data.summary?.receiptsCertified === true
    && data.summary?.subagentsCertified === true
    && data.summary?.skillsCertified === true
    && data.summary?.schedulerCertified === true
    && data.summary?.perceptionDeviceCertified === true
    && data.summary?.abuseCases >= 8
    && data.summary?.abuseCasesControlled === data.summary?.abuseCases
    && data.summary?.rawSecretsSerialized === false
    && data.summary?.workspaceMutationPerformed === false
    && data.summary?.externalIoPerformed === false
    && statuses.has('dry_run_passed')
    && statuses.has('needs_setup');
  return rule(
    'snapshot',
    'Live certification matrix runs',
    pass,
    data ? `status=${data.status}; items=${data.summary?.items}; abuse=${data.summary?.abuseCasesControlled}/${data.summary?.abuseCases}` : 'invalid json',
    'daily runtime matrix is honest, safe and complete',
    pass ? [] : [result.stdout],
  );
}

function rule(id, label, passed, observed, target, details = []) {
  return {
    id,
    label,
    status: passed ? 'passed' : 'failed',
    observed,
    target,
    details,
  };
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
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
