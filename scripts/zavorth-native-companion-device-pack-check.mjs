#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'zavorth-native-companion-device-checkpoint-6-files',
    label: 'Runtime gateway files exist',
    target: 'contract, Satellite bridge, desktop bridge, MLX TTS adapter, pack service, command, tests and package scripts are present',
    files: [
      'src/contracts/ZavorthNativeCompanionDeviceContract.ts',
      'src/services/ZavorthSatelliteCapabilityBridgeService.ts',
      'src/services/ZavorthDesktopCompanionBridgeService.ts',
      'src/services/ZavorthMlxTtsRuntimeAdapter.ts',
      'src/services/ZavorthNativeCompanionDevicePackService.ts',
      'scripts/zavorth-native-companion-device-pack.ts',
      'tests/services/ZavorthNativeCompanionDevicePackService.test.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'zavorth-native-companion-device-contract',
    label: 'Contract captures native companion capability model',
    target: 'contract includes camera, GPS, notifications, device confirmation, share sheet, offline queue, desktop and MLX TTS receipts',
    files: ['src/contracts/ZavorthNativeCompanionDeviceContract.ts'],
    needles: [
      'ZAVORTH_NATIVE_COMPANION_DEVICE_CONTRACT_VERSION',
      'camera.capture',
      'location.read',
      'notifications.send',
      'device.confirm',
      'share.invoke',
      'offline.queue',
      'desktop.clipboard',
      'local.tts.mlx',
      'ZavorthNativeCapabilityReceipt',
      'ZavorthNativeCompanionDeviceSnapshot',
    ],
  }),
  ruleContainsAcross({
    id: 'zavorth-native-companion-bridges',
    label: 'PWA, desktop and MLX bridges are governed',
    target: 'bridges prove browser/PWA device flow, desktop capability reporting and owner-gated MLX TTS without default process execution',
    files: [
      'src/services/ZavorthSatelliteCapabilityBridgeService.ts',
      'src/services/ZavorthDesktopCompanionBridgeService.ts',
      'src/services/ZavorthMlxTtsRuntimeAdapter.ts',
      'src/services/ZavorthNativeCompanionDevicePackService.ts',
    ],
    needles: [
      'runBrowserPhoneProof',
      'runSensitiveApprovalProbe',
      'runOfflineQueueProof',
      'desktop-companion',
      'ZAVORTH_MLX_TTS_COMMAND',
      'processSpawned: false',
      'android-wrapper',
      'ios-wrapper',
      'macos-wrapper',
      'owner-gated',
    ],
  }),
  ruleContainsAll({
    id: 'zavorth-native-companion-policy',
    label: 'Pack policy keeps native wrappers optional',
    target: 'service emits browser-first receipts, owner-gated native wrappers and Surface controls handoff',
    files: ['src/services/ZavorthNativeCompanionDevicePackService.ts'],
    needles: [
      'browserPwaFirst',
      'androidIosMacosWrappersOwnerGated',
      'mlxTtsNeverEnabledByDefault',
      'cameraLocationRequirePermission',
      'biometricOrDeviceConfirmRequiresTrust',
      'unsupportedNativeApisExplicit',
      'Surface controls - QA, Security And Release Certification Pack',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-zavorth-native-companion-device-pack',
    label: 'package exposes Runtime gateway gates',
    target: 'operators can inspect, inspect JSON, run check and QA without legacy marker wording',
    files: ['package.json'],
    needles: [
      'zavorth-native-companion-device-pack',
      'zavorth-native-companion-device-pack:json',
      'zavorth-native-companion-device-pack:check',
      'qa:zavorth-native-companion-device-pack',
    ],
  }),
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
        `next=${receipt.commands?.nextStage}`,
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
