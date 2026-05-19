#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'satellite-device-live-plane-files',
    label: 'Satellite/device live plane files exist',
    target: 'Contract, services, host capability execution, tests, docs, scripts, SDK barrels and package scripts are present',
    files: [
      'src/contracts/SatelliteDeviceLivePlaneContract.ts',
      'src/contracts/NodeMeshContract.ts',
      'src/services/SatelliteDeviceLivePlaneService.ts',
      'src/services/SatelliteDeviceLiveService.ts',
      'src/services/NodePairingService.ts',
      'src/services/NodeHeartbeatService.ts',
      'src/services/NodeInvokeService.ts',
      'src/services/NodeHostCapabilityService.ts',
      'src/domain/nodes/infrastructure/node-host-capability/NodeHostCapabilityHostSurfaceService.ts',
      'tests/services/SatelliteDeviceLivePlaneService.test.ts',
      'scripts/satellite-device-live-plane.ts',
      'scripts/satellite-device-live-plane-check.mjs',
      'docs/README.md',
      'src/sdk/contracts.ts',
      'src/sdk/index.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'satellite-device-live-contract',
    label: 'Contract defines Intent model1 vocabulary',
    target: 'Contract captures targets, device capabilities, gates, receipts and Intent model2 handoff',
    files: ['src/contracts/SatelliteDeviceLivePlaneContract.ts'],
    needles: [
      'ZAVORTH_SATELLITE_DEVICE_LIVE_PLANE_CONTRACT_VERSION',
      '2026-05-05.live-checkpoint-11',
      'device-pair',
      'phone-control',
      'bonjour',
      'satellite-pwa',
      'satellite-backend',
      'camera-capture',
      'geolocation',
      'webauthn-confirmation',
      'offline-queue',
      'unsupportedNativeApisHidden: false',
      'Intent model2 - Memory, Artifacts And Runtime Executor Live Closure',
    ],
  }),
  ruleContainsAll({
    id: 'satellite-device-live-service',
    label: 'Service proves paired-device behavior',
    target: 'Live service can pair, heartbeat, invoke, execute camera/location/confirmation, prove allowlist and offline queue',
    files: ['src/services/SatelliteDeviceLiveService.ts'],
    needles: [
      'runBrowserPhoneProof',
      'runSensitiveApprovalProbe',
      'runOfflineQueueProof',
      'runDeviceDoctorProof',
      'buildNativeSupportDecision',
      'camera.capture',
      'location.read',
      'device.confirm',
      'haptics.vibrate',
      'sharedSecretSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'satellite-device-host-capabilities',
    label: 'Node host executes confirmation and haptics',
    target: 'Node host routes device.confirm and haptics.vibrate into the host surface',
    files: ['src/services/NodeHostCapabilityService.ts'],
    needles: [
      'device.confirm',
      'haptics.vibrate',
      'confirmDeviceAction',
      'vibrateHaptic',
    ],
  }),
  ruleContainsAll({
    id: 'satellite-device-host-surface',
    label: 'Host surface executes confirmation and haptics explicitly',
    target: 'Host surface supports user-present confirmation and explicit unsupported haptic receipts',
    files: ['src/domain/nodes/infrastructure/node-host-capability/NodeHostCapabilityHostSurfaceService.ts'],
    needles: [
      'confirmDeviceAction',
      'vibrateHaptic',
      'user presence missing',
      'unsupportedNativeApiExplicit',
    ],
  }),
  ruleContainsAll({
    id: 'satellite-device-host-catalog',
    label: 'Host capability catalog advertises new device controls',
    target: 'Catalog exposes device.confirm and haptics.vibrate',
    files: ['src/domain/nodes/infrastructure/node-host-capability/NodeHostCapabilityCatalog.ts'],
    needles: [
      'device.confirm',
      'haptics.vibrate',
    ],
  }),
  ruleContainsAll({
    id: 'satellite-device-profiles',
    label: 'Mobile profile advertises Satellite capabilities',
    target: 'Mobile companion can declare camera, location, notifications, confirmation and haptics',
    files: ['src/services/NodeDeviceProfileService.ts'],
    needles: [
      'mobile-companion',
      'device.confirm',
      'haptics.vibrate',
      'camera.capture',
      'location.read',
    ],
  }),
  ruleContainsAll({
    id: 'satellite-device-capability-catalog',
    label: 'Capability catalog names Satellite controls',
    target: 'Capability catalog exposes readable labels for camera, location, confirmation and haptics',
    files: ['src/services/NodeCapabilityService.ts'],
    needles: [
      'Camera Capture',
      'Location Read',
      'Device Confirm',
      'Haptics Vibrate',
    ],
  }),
  ruleContainsAll({
    id: 'satellite-device-readiness',
    label: 'Live readiness promotes device.invoke',
    target: 'device.invoke is partial-live with Intent model1 gates',
    files: ['src/services/LiveReadinessService.ts'],
    needles: [
      'device.invoke',
      'Intent model1 - Satellite and Device Live Activation',
      'src/services/SatelliteDeviceLiveService.ts',
    ],
  }),
  ruleContainsAll({
    id: 'satellite-device-normalization',
    label: 'Capability normalization points at Satellite service',
    target: 'device.invoke maps to Satellite live contracts and receipts',
    files: ['src/services/CapabilityNormalizationService.ts'],
    needles: [
      'device.invoke',
      'src/services/SatelliteDeviceLiveService.ts',
      'satellite.device.live.receipt',
    ],
  }),
  ruleContainsAll({
    id: 'satellite-device-tests',
    label: 'Tests prove Intent model1 behavior',
    target: 'Tests cover snapshot, live paired phone proof, sensitive approval, offline queue and explicit native decisions',
    files: ['tests/services/SatelliteDeviceLivePlaneService.test.ts'],
    needles: [
      'closes Intent model1 Satellite and device gates',
      'pairs a browser phone and invokes camera, location and confirmation',
      'blocks sensitive device invokes unless the allowlist approves them',
      'delivers offline queue work on the next heartbeat',
      'keeps Bonjour and native-only APIs explicit',
    ],
  }),
  ruleContainsAll({
    id: 'satellite-device-package',
    label: 'Package exposes Intent model1 scripts',
    target: 'Intent model1 can be run through package scripts',
    files: ['package.json'],
    needles: [
      'satellite-device-live-plane',
      'satellite-device-live-plane:check',
      'qa:satellite-device-live-plane',
    ],
  }),
  ruleContainsAll({
    id: 'satellite-device-sdk',
    label: 'SDK exposes Intent model1 contracts and services',
    target: 'Intent model1 contracts can be imported from SDK contract barrel',
    files: ['src/sdk/contracts.ts'],
    needles: [
      'SatelliteDeviceLivePlane',
    ],
  }),
  ruleContainsAll({
    id: 'satellite-device-sdk-services',
    label: 'SDK exposes Intent model1 services',
    target: 'Intent model1 services can be imported from SDK index',
    files: ['src/sdk/index.ts'],
    needles: [
      'SatelliteDeviceLivePlaneService',
      'SatelliteDeviceLiveService',
    ],
  }),
  ruleContainsAll({
    id: 'satellite-device-doc',
    label: 'Docs record Intent model1 closure',
    target: 'Intent model1 documentation explains pairing, heartbeat, phone controls, approvals, offline queue and native decisions',
    files: ['docs/README.md'],
    needles: [
      'Intent model1',
      'Satellite And Device Live Plane',
      'pairing',
      'heartbeat',
      'camera.capture',
      'location.read',
      'device.confirm',
      'offline queue',
      'Bonjour',
      'staging-live',
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
  console.log('[satellite-device-live-plane] checking Intent model1');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[satellite-device-live-plane] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
