#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'zavorth-native-companion-device-phase-6-files',
    label: 'Phase 6 files exist',
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
    target: 'service emits browser-first receipts, owner-gated native wrappers and Phase 7 handoff',
    files: ['src/services/ZavorthNativeCompanionDevicePackService.ts'],
    needles: [
      'browserPwaFirst',
      'androidIosMacosWrappersOwnerGated',
      'mlxTtsNeverEnabledByDefault',
      'cameraLocationRequirePermission',
      'biometricOrDeviceConfirmRequiresTrust',
      'unsupportedNativeApisExplicit',
      'Phase 7 - QA, Security And Release Certification Pack',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-zavorth-native-companion-device-pack',
    label: 'package exposes Phase 6 gates',
    target: 'operators can inspect, inspect JSON, run check and QA without source branding',
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
  console.log('[zavorth-native-companion-device-pack] checking Phase 6');
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
      label: 'Runtime Phase 6 receipt passes',
      status: 'failed',
      observed: `exit ${result.status ?? 'unknown'}`,
      target: 'Phase 6 command emits a passing native companion/device snapshot',
      details: compactDetails(result.error instanceof Error ? result.error.message : '', result.stderr, result.stdout),
    };
  }

  try {
    const receipt = JSON.parse(result.stdout);
    return {
      id: 'zavorth-native-companion-device-runtime-receipt',
      label: 'Runtime Phase 6 receipt passes',
      status: receipt.status === 'passed' ? 'passed' : 'failed',
      observed: `status=${receipt.status}, targets=${receipt.summary?.targets}, capabilities=${receipt.summary?.capabilitiesReported}`,
      target: 'Phase 6 command emits a passing native companion/device snapshot',
      details: [
        `pwaBridgeFunctional=${receipt.summary?.pwaBridgeFunctional}`,
        `desktopBridgeFunctional=${receipt.summary?.desktopBridgeFunctional}`,
        `nativeWrappersOwnerGated=${receipt.summary?.nativeWrappersOwnerGated}`,
        `liveExternalIoPerformed=${receipt.summary?.liveExternalIoPerformed}`,
        `enabledByDefault=${receipt.summary?.enabledByDefault}`,
        `next=${receipt.commands?.nextPhase}`,
      ],
    };
  } catch (error) {
    return {
      id: 'zavorth-native-companion-device-runtime-receipt',
      label: 'Runtime Phase 6 receipt passes',
      status: 'failed',
      observed: 'invalid JSON receipt',
      target: 'Phase 6 command emits a passing native companion/device snapshot',
      details: [error instanceof Error ? error.message : String(error), ...compactDetails(result.stderr, result.stdout)],
    };
  }
}

function ruleContainsNoForbiddenNames() {
  const forbiddenWord = String.fromCharCode(111, 112, 101, 110, 99, 108, 97, 119);
  const searchRoots = [
    'src/contracts/ZavorthNativeCompanionDeviceContract.ts',
    'src/services/ZavorthSatelliteCapabilityBridgeService.ts',
    'src/services/ZavorthDesktopCompanionBridgeService.ts',
    'src/services/ZavorthMlxTtsRuntimeAdapter.ts',
    'src/services/ZavorthNativeCompanionDevicePackService.ts',
    'scripts/zavorth-native-companion-device-pack.ts',
    'scripts/zavorth-native-companion-device-pack-check.mjs',
    'tests/services/ZavorthNativeCompanionDevicePackService.test.ts',
    'package.json',
  ];
  const details = [];
  for (const relative of searchRoots) {
    const absolute = path.join(root, relative);
    for (const file of listFiles(absolute)) {
      const text = fs.readFileSync(file, 'utf8');
      if (containsForbiddenBranding(path.basename(file), forbiddenWord) || containsForbiddenBranding(text, forbiddenWord)) {
        details.push(path.relative(root, file).replace(/\\/g, '/'));
      }
    }
  }
  return {
    id: 'zavorth-native-companion-no-forbidden-source-name',
    label: 'No forbidden source branding outside reports',
    status: details.length > 0 ? 'failed' : 'passed',
    observed: details.length > 0 ? `${details.length} file(s) with forbidden source branding` : 'no forbidden source branding in code/scripts/tests/package',
    target: 'new Phase 6 code and public surfaces use Zavorth-owned names only',
    details,
  };
}

function containsForbiddenBranding(value, forbiddenWord) {
  return String(value || '').toLowerCase().includes(forbiddenWord);
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

function ruleContainsAcross(input) {
  const contentsByFile = input.files.map((file) => ({
    file,
    contents: read(file),
  }));
  const missingFiles = contentsByFile
    .filter((entry) => entry.contents === null)
    .map((entry) => `missing ${entry.file}`);
  const missingNeedles = input.needles
    .filter((needle) => !contentsByFile.some((entry) => entry.contents?.includes(needle)))
    .map((needle) => `missing ${needle}`);
  const missing = [...missingFiles, ...missingNeedles];
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: missing.length > 0 ? `${missing.length} missing marker(s)` : 'all markers present across files',
    target: input.target,
    details: missing,
  };
}

function listFiles(absolute) {
  if (!fs.existsSync(absolute)) return [];
  if (fs.statSync(absolute).isFile()) return [absolute];
  const files = [];
  const stack = [absolute];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'docs') continue;
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(child);
      } else if (/\.(ts|tsx|js|jsx|mjs|cjs|json)$/.test(entry.name) || entry.name === 'package.json') {
        files.push(child);
      }
    }
  }
  return files;
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

function compactDetails(...values) {
  return values
    .flatMap((value) => String(value || '').split(/\r?\n/g))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
}
