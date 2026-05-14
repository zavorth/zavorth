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
  runSidecarAdapterFixture(),
  runSidecarAdapterLiveReadOnlyFixture(),
  runSidecarAdapterBlockedFixture(),
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
  console.log('[zavorth-external-sidecar-adapter] checking Phase 3');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-external-sidecar-adapter] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 16)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthExternalSidecarAdapterContract.ts',
    'src/services/ZavorthExternalSidecarAdapterService.ts',
    'scripts/zavorth-external-sidecar-adapter.ts',
    'scripts/zavorth-external-sidecar-adapter-check.mjs',
    'tests/services/ZavorthExternalSidecarAdapterService.test.ts',
    'docs/README.md',
    'docs/README.md',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'phase-3-files',
    label: 'Phase 3 sidecar adapter files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'contract, service, CLI, check, tests, docs and package scripts are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthExternalSidecarAdapterContract.ts', [
      'ZAVORTH_EXTERNAL_SIDECAR_ADAPTER_CONTRACT_VERSION',
      'zavorth-external-sidecar-adapter/3',
      'ZavorthAgentGateway',
      'ReplyPipeline',
      'dryRunOnly',
      'noSidecarStarted',
    ]],
    ['src/services/ZavorthExternalSidecarAdapterService.ts', [
      'buildReadOnlyProbe',
      'normalizeInboundEvent',
      'evaluateOutboundDryRun',
      'buildCommandCenterProjection',
      'risky-outbound-blocks-without-approval',
    ]],
    ['docs/README.md', [
      'phase-3-sidecar-adapter-ready',
      '291 Phase 4 - Capability Providers',
      'Zavorth External Sidecar Adapter',
    ]],
    ['docs/README.md', [
      'phase-3-sidecar-adapter-complete',
      'Zavorth External Sidecar Adapter',
      'read-only',
      'dry-run',
      '291 Phase 4 - Capability Providers',
    ]],
    ['package.json', [
      'zavorth:external-sidecar-adapter',
      'zavorth:external-sidecar-adapter:check',
    ]],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    if (text === null) {
      missing.push(`missing ${file}`);
      continue;
    }
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return {
    id: 'phase-3-markers',
    label: 'Phase 3 sidecar adapter markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'adapter contract, gateway routing, dry-run outbound policy, docs and scripts markers are present',
    details: missing,
  };
}

function runSidecarAdapterFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-external-sidecar-adapter.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return {
      id: 'phase-3-sidecar-adapter-fixture',
      label: 'Sidecar adapter fixture passes',
      status: 'failed',
      observed: `exit ${result.status}`,
      target: 'default sidecar adapter snapshot is sidecar-adapter-ready',
      details: [result.error?.message || result.stderr || result.stdout || 'no output'],
    };
  }
  const snapshot = parseJson(result.stdout);
  const ok = snapshot
    && snapshot.status === 'sidecar-adapter-ready'
    && snapshot.contractVersion === 'zavorth-external-sidecar-adapter/3'
    && snapshot.summary?.sourceChannelsListed > 0
    && snapshot.summary?.sourceSkillsListed > 0
    && snapshot.summary?.sourceToolsListed > 0
    && snapshot.summary?.sourceSessionsListed > 0
    && snapshot.summary?.workerHealthRecordsListed > 0
    && snapshot.summary?.inboundEventsRoutedToGateway === 1
    && snapshot.summary?.outboundDryRunsEvaluated === 2
    && snapshot.summary?.riskyOutboundActionsBlocked === 1
    && snapshot.safety?.sidecarsStarted === false
    && snapshot.safety?.outboundIoPerformed === false;
  return {
    id: 'phase-3-sidecar-adapter-fixture',
    label: 'Sidecar adapter fixture passes',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, ${snapshot.summary.sourceChannelsListed} channel(s), ${snapshot.summary.outboundDryRunsEvaluated} dry-run(s)` : 'invalid sidecar adapter snapshot',
    target: 'default sidecar adapter snapshot is ready with read-only probe and dry-run gates',
    details: ok ? [] : [result.stdout],
  };
}

function runSidecarAdapterLiveReadOnlyFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-external-sidecar-adapter.ts',
    '--json',
    '--probe-mode',
    'live-readonly',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot
    && snapshot.status === 'sidecar-adapter-ready'
    && snapshot.readOnlyProbe?.mode === 'live-readonly'
    && snapshot.readOnlyProbe?.safety?.noSourceRuntimeCodeExecuted === true
    && snapshot.readOnlyProbe?.safety?.noOutboundIo === true;
  return {
    id: 'phase-3-live-readonly-fixture',
    label: 'Live-readonly probe mode stays non-executing',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.readOnlyProbe.mode}, sourceCodeExecuted=${snapshot.readOnlyProbe.safety.noSourceRuntimeCodeExecuted}` : `exit ${result.status}`,
    target: 'live-readonly mode remains read-only and does not start a sidecar',
    details: ok ? [] : [result.error?.message || result.stderr || result.stdout || 'no output'],
  };
}

function runSidecarAdapterBlockedFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-external-sidecar-adapter.ts',
    '--json',
    '--native-engine-status',
    'blocked',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot
    && snapshot.status === 'blocked'
    && snapshot.previousNativeEngineStatus === 'blocked';
  return {
    id: 'phase-3-blocked-fixture',
    label: 'Sidecar adapter blocks without Phase 2 readiness',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, nativeEngine=${snapshot.previousNativeEngineStatus}` : `exit ${result.status}`,
    target: 'Phase 3 cannot advance while Phase 2 native engine is blocked',
    details: ok ? [] : [result.error?.message || result.stderr || result.stdout || 'no output'],
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
    return null;
  }
}
