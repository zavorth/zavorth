#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'canary-monitoring-rollback-gate-files',
    label: 'Canary Monitoring Rollback Gate phase files exist',
    target: 'Contract, service, tests, runner, docs and package scripts are present',
    files: [
      'src/contracts/CanaryMonitoringRollbackGateContract.ts',
      'src/services/CanaryMonitoringRollbackGateService.ts',
      'tests/services/CanaryMonitoringRollbackGateService.test.ts',
      'scripts/canary-monitoring-rollback-gate.ts',
      'scripts/canary-monitoring-rollback-gate-check.mjs',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'canary-monitoring-rollback-gate-contract',
    label: 'Contract defines monitoring and rollback vocabulary',
    target: 'Contract includes monitoring controls, rollback controls, gates, receipts, commands and no-live-traffic policy',
    files: ['src/contracts/CanaryMonitoringRollbackGateContract.ts'],
    needles: [
      'ZAVORTH_CANARY_MONITORING_ROLLBACK_GATE_CONTRACT_VERSION',
      'CanaryMonitoringRollbackControl',
      'CanaryMonitoringRollbackGateSnapshot',
      'monitoring-gate-ready',
      'abortThresholdsRequired: true',
      'rollbackGateRequiredBeforePromotion: true',
      'noLiveTrafficByDefault: true',
      'manualPromotionRequired: true',
      'noRemoteMutationByDefault: true',
      'secretsSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'canary-monitoring-rollback-gate-service',
    label: 'Service builds monitoring and rollback gate from launch rehearsal',
    target: 'Service consumes Preview engine1, prepares monitoring/rollback controls, and keeps launch/publish/promotion locked',
    files: ['src/services/CanaryMonitoringRollbackGateService.ts'],
    needles: [
      'CanaryMonitoringRollbackGateService',
      'CanaryLaunchRehearsalService',
      'launch-rehearsal-input',
      'observation-window-monitor',
      'telemetry-dashboard-monitor',
      'error-rate-threshold-monitor',
      'rollback-trigger-control',
      'rollback-command-rehearsal',
      'kill-switch-control',
      'remote-mutation-lock',
      'Canary promotion decision ledger',
    ],
  }),
  ruleContainsAll({
    id: 'canary-monitoring-rollback-gate-runner',
    label: 'Runner exposes text, JSON and require-gate-ready modes',
    target: 'Operator can render monitoring rollback evidence and fail when monitoringRollbackGateReady is false',
    files: ['scripts/canary-monitoring-rollback-gate.ts'],
    needles: [
      'CanaryMonitoringRollbackGateService',
      '--json',
      '--require-gate-ready',
      'formatGateText',
      'snapshot.summary.monitoringRollbackGateReady',
    ],
  }),
  ruleContainsAll({
    id: 'canary-monitoring-rollback-gate-tests',
    label: 'Tests prove canary monitoring rollback gate',
    target: 'Tests cover RC identity, monitoring state, control counts, no-live-traffic policy, commands and formatted output',
    files: ['tests/services/CanaryMonitoringRollbackGateService.test.ts'],
    needles: [
      'builds a monitoring and rollback gate from the canary launch rehearsal',
      'controls: 17',
      'monitoringReadyControls: 6',
      'rollbackReadyControls: 4',
      'operatorReadyControls: 2',
      'lockedControls: 3',
      'monitoringRollbackGateReady: true',
      'keeps monitoring gate dry-run only and promotion held',
      'formats canary monitoring rollback gate text',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-canary-monitoring-rollback-gate-gates',
    label: 'package exposes canary monitoring rollback gates',
    target: 'local QA can run gate, JSON, static check and require-gate-ready modes',
    files: ['package.json'],
    needles: [
      'canary-monitoring-rollback-gate',
      'canary-monitoring-rollback-gate:json',
      'canary-monitoring-rollback-gate:check',
      'qa:canary-monitoring-rollback-gate',
      'scripts/canary-monitoring-rollback-gate.ts',
      'scripts/canary-monitoring-rollback-gate-check.mjs',
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
  console.log('[canary-monitoring-rollback-gate] checking Preview engine2');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[canary-monitoring-rollback-gate] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
