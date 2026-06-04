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
  console.log('[zavorth-capability-absorption] checking Phase 1');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-capability-absorption] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 20)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthCapabilityAbsorptionContract.ts',
    'src/services/ZavorthCapabilityAbsorptionService.ts',
    'scripts/zavorth-capability-absorption.ts',
    'scripts/zavorth-capability-absorption-check.mjs',
    'tests/services/ZavorthCapabilityAbsorptionService.test.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule(
    'phase-1-files',
    'Capability absorption files exist',
    missing.length === 0,
    `${files.length - missing.length}/${files.length}`,
    'contract, service, script, check, tests and docs are present',
    missing,
  );
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthCapabilityAbsorptionContract.ts', [
      'native',
      'partial',
      'cataloged',
      'requires_credentials',
      'ZAVORTH_CAPABILITY_ABSORPTION_CONTRACT_VERSION',
    ]],
    ['src/services/ZavorthCapabilityAbsorptionService.ts', [
      'Zavorth-native long-tail channels',
      'Zavorth-native-style learning loop',
      'Zavorth-native advanced ZavorthControl',
      'Native browser automation',
      'Multi-backend execution',
      'catalog support is not live proof',
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
    'phase-1-markers',
    'Capability absorption markers are wired',
    missing.length === 0,
    missing.length === 0 ? 'all markers' : `${missing.length} missing`,
    'reference/Zavorth-native/Zavorth-native map, statuses and policy language exist',
    missing,
  );
}

function rulePackageScripts() {
  const pkg = JSON.parse(read('package.json') || '{}');
  const scripts = pkg.scripts || {};
  const required = [
    'zavorth:capability-absorption',
    'zavorth:capability-absorption:json',
    'zavorth:capability-absorption:check',
    'qa:zavorth-capability-absorption',
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

function ruleSnapshot() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-capability-absorption.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
    timeout: 45000,
  });
  if (result.status !== 0) {
    return rule('snapshot', 'Capability absorption snapshot runs', false, `exit=${result.status}`, 'status=attention or passed', [
      result.error?.message || result.stderr || result.stdout || 'no output',
    ]);
  }
  const data = parseJson(result.stdout);
  const statuses = new Set((data?.items || []).map((entry) => entry.status));
  const pass = data
    && data.contractVersion === '2026-05-24.phase-1-capability-absorption-map'
    && ['passed', 'attention'].includes(data.status)
    && data.summary?.total >= 16
    && data.summary?.native >= 2
    && data.summary?.partial >= 4
    && data.summary?.liveProofStillRequired >= 4
    && data.summary?.rawSecretsSerialized === false
    && data.summary?.externalIoPerformed === false
    && data.summary?.workspaceMutationPerformed === false
    && statuses.has('native')
    && statuses.has('partial')
    && (statuses.has('cataloged') || statuses.has('requires_credentials') || statuses.has('requires_app'));
  return rule(
    'snapshot',
    'Capability absorption snapshot runs',
    pass,
    data ? `status=${data.status}; items=${data.summary?.total}; native=${data.summary?.native}; partial=${data.summary?.partial}` : 'invalid json',
    'honest absorption map with native, partial and non-live statuses',
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
