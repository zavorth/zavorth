#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'satellite-app-consistency-files',
    label: 'Satellite/App consistency gate files exist',
    target: 'Contract, service, tests, docs and package scripts are present',
    files: [
      'src/contracts/SatelliteAppConsistencyContract.ts',
      'src/services/SatelliteAppConsistencyService.ts',
      'src/satellite/satellite.js',
      'src/satellite/sw.js',
      'tests/services/SatelliteAppConsistencyService.test.ts',
      'docs/README.md',
      'docs/README.md',
      '.gitignore',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'satellite-app-consistency-contract',
    label: 'Contract defines Satellite/App consistency vocabulary',
    target: 'Contract includes surfaces, statuses, primitives, dry simulations, Plugin OS manifests and no live secret serialization',
    files: ['src/contracts/SatelliteAppConsistencyContract.ts'],
    needles: [
      'ZAVORTH_SATELLITE_APP_CONSISTENCY_CONTRACT_VERSION',
      'SatelliteAppConsistencySurface',
      'SatelliteAppConsistencyStatus',
      'SatelliteAppCapabilityPrimitive',
      'camera.capture',
      'location.read',
      'notifications.send',
      'biometric.approve',
      'haptic.vibrate',
      'offline.queue',
      'liveDeviceRequired: false',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'satellite-app-consistency-service',
    label: 'Service maps Satellite/App surfaces into governed dry-run entries',
    target: 'Service inspects PWA/device capability markers, exposes smoke gates, and emits a generated Plugin OS module',
    files: ['src/services/SatelliteAppConsistencyService.ts'],
    needles: [
      'buildEntryForSurface',
      'new WebSocket',
      'getUserMedia',
      'navigator.geolocation',
      'Notification',
      'credentials.get',
      'navigator.vibrate',
      'offlineQueue',
      'native-wrapper',
      'PWA-first is signed',
      'zavorth.device.satellite',
      'Plugin OS',
    ],
  }),
  ruleContainsAll({
    id: 'satellite-app-client-runtime',
    label: 'Satellite PWA executes browser/device capabilities',
    target: 'PWA client includes governed local handlers for device APIs, offline queue, and Node Mesh assignments',
    files: ['src/satellite/satellite.js'],
    needles: [
      'executeLocalCapability',
      'listLocalCapabilities',
      'captureCamera',
      'navigator.mediaDevices',
      'getUserMedia',
      'readLocation',
      'navigator.geolocation',
      'getCurrentPosition',
      'sendNotification',
      'Notification.requestPermission',
      'approveWithBiometrics',
      'navigator.credentials',
      'PublicKeyCredential',
      'vibrateDevice',
      'navigator.vibrate',
      'offlineQueue',
      'navigator.onLine',
      'handleNodeAssignments',
      'renderActionCard',
      'handleAction',
      'action.request',
      'approval.request',
      'action-card',
      'capability.result',
    ],
  }),
  ruleContainsAll({
    id: 'satellite-interactive-action-cards',
    label: 'Satellite renders interactive action cards',
    target: 'PWA client renders contextual approval cards and sends capability.result decisions',
    files: ['src/satellite/satellite.js'],
    needles: [
      'renderActionCard',
      'handleAction',
      'actionCards',
      'actionId',
      'decision',
      'capability.result',
      'action.request',
      'approval.request',
      'action-card',
    ],
  }),
  ruleContainsAll({
    id: 'satellite-interactive-action-card-styles',
    label: 'Satellite action cards expose visual states',
    target: 'PWA stylesheet includes pending, approved, rejected and failed card states',
    files: ['src/satellite/satellite.css'],
    needles: [
      '.action-card.pending',
      '.action-card.approved',
      '.action-card.rejected',
      '.action-card.failed',
    ],
  }),
  ruleContainsAll({
    id: 'satellite-app-consistency-tests',
    label: 'Tests prove Satellite/App consistency behavior',
    target: 'Tests cover current PWA evidence, explicit browser API gaps, complete browser templates, and Plugin OS manifest compatibility',
    files: ['tests/services/SatelliteAppConsistencyService.test.ts'],
    needles: [
      'current PWA without live devices',
      'browser API gaps visible',
      'complete browser capability template',
      'Satellite Plugin OS manifest',
      'required: false',
      'buildEntryForSurface',
      'getUserMedia',
      'navigator.geolocation',
      'navigator.vibrate',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-satellite-app-consistency-gate',
    label: 'package exposes Satellite/App consistency gate',
    target: 'local QA can run satellite-app-consistency:check and qa:satellite-app-consistency',
    files: ['package.json'],
    needles: [
      'satellite-app-consistency:check',
      'qa:satellite-app-consistency',
      'scripts/satellite-app-consistency-check.mjs',
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
  console.log('[satellite-app-consistency] checking Runtime gateway');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[satellite-app-consistency] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
