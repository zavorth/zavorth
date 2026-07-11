#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'public-launch-smoke-evidence-ledger-files',
    label: 'Public Launch Smoke Evidence Ledger gate files exist',
    target: 'Contract, service, tests, runner, docs and package scripts are present',
    files: [
      'src/contracts/PublicLaunchSmokeEvidenceLedgerContract.ts',
      'src/services/PublicLaunchSmokeEvidenceLedgerService.ts',
      'tests/services/PublicLaunchSmokeEvidenceLedgerService.test.ts',
      'scripts/public-launch-smoke-evidence-ledger.ts',
      'scripts/public-launch-smoke-evidence-ledger-check.mjs',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'public-launch-smoke-evidence-ledger-contract',
    label: 'Contract defines public launch smoke evidence vocabulary',
    target: 'Contract includes dry proofs, opt-in live smokes, receipts, gates, commands and no-live-by-default policy',
    files: ['src/contracts/PublicLaunchSmokeEvidenceLedgerContract.ts'],
    needles: [
      'ZAVORTH_PUBLIC_LAUNCH_SMOKE_EVIDENCE_LEDGER_CONTRACT_VERSION',
      'PublicLaunchSmokeEvidenceEntry',
      'PublicLaunchSmokeEvidenceLedgerSnapshot',
      'dry-proof',
      'opt-in-live',
      'public-launch-certification',
      'provider-live-opt-in',
      'noExternalCallsByDefault: true',
      'liveSmokesAreOptIn: true',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'public-launch-smoke-evidence-ledger-service',
    label: 'Service builds smoke ledger from hardened release certification',
    target: 'Service consumes release hardening, requires dry proofs, keeps live smokes opt-in and emits receipts',
    files: ['src/services/PublicLaunchSmokeEvidenceLedgerService.ts'],
    needles: [
      'PublicLaunchSmokeEvidenceLedgerService',
      'ReleaseCertificationProfileHardeningService',
      'requiredDrySmokes',
      'optInLiveSmokes',
      'publicLaunchReady',
      'public-launch-certification',
      'provider-live-opt-in',
      'no-live-io-by-default',
      'Release candidate package freeze',
    ],
  }),
  ruleContainsAll({
    id: 'public-launch-smoke-evidence-ledger-runner',
    label: 'Runner exposes text, JSON and require-ready modes',
    target: 'Operator can render the ledger and fail when publicLaunchReady is false',
    files: ['scripts/public-launch-smoke-evidence-ledger.ts'],
    needles: [
      'PublicLaunchSmokeEvidenceLedgerService',
      '--json',
      '--require-ready',
      'formatLedgerText',
      'snapshot.summary.publicLaunchReady',
    ],
  }),
  ruleContainsAll({
    id: 'public-launch-smoke-evidence-ledger-tests',
    label: 'Tests prove public launch smoke evidence ledger',
    target: 'Tests cover dry smokes, opt-in live smokes, receipts, policy, commands and formatted output',
    files: ['tests/services/PublicLaunchSmokeEvidenceLedgerService.test.ts'],
    needles: [
      'builds a public launch-ready smoke evidence ledger',
      'requiredDrySmokes: 10',
      'requiredDryPassed: 10',
      'optInLiveSmokes: 4',
      'receipts: 14',
      'publicLaunchReady: true',
      'keeps live smokes opt-in',
      'formats public launch smoke evidence text',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-public-launch-smoke-evidence-ledger-gates',
    label: 'package exposes public launch smoke ledger gates',
    target: 'local QA can run smoke ledger, JSON, static check and require-ready modes',
    files: ['package.json'],
    needles: [
      'public-launch-smoke-ledger',
      'public-launch-smoke-ledger:json',
      'public-launch-smoke-ledger:check',
      'qa:public-launch-smoke-ledger',
      'scripts/public-launch-smoke-evidence-ledger.ts',
      'scripts/public-launch-smoke-evidence-ledger-check.mjs',
    ],
  }),
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
  console.log('[public-launch-smoke-evidence-ledger] checking Intent model5');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[public-launch-smoke-evidence-ledger] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 8)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function ruleFilesExist(input) {
  const missing = input.files.filter((file) => !exists(file));
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: `${input.files.length - missing.length}/${input.files.length} file(s) present`,
    target: input.target,
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsAll(input) {
  const missing = [];
  for (const file of input.files) {
    const contents = read(file);
    if (contents === null) {
      missing.push(`missing ${file}`);
      continue;
    }
    for (const needle of input.needles) {
      if (!contents.includes(needle)) {
        missing.push(`${file}: missing ${needle}`);
      }
    }
  }
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: missing.length > 0 ? `${missing.length} missing marker(s)` : 'all markers present',
    target: input.target,
    details: missing,
  };
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    return null;
  }
  return fs.readFileSync(absolute, 'utf8');
}
