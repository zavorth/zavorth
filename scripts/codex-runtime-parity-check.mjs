#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'codex-runtime-parity-files',
    label: 'Codex runtime parity files exist',
    target: 'Contract, adapters, service, tests, docs and package scripts are present',
    files: [
      'src/contracts/CodexRuntimeContract.ts',
      'src/adapters/codex/CodexAppServerRpcAdapter.ts',
      'src/adapters/codex/CodexStdioTransportAdapter.ts',
      'src/adapters/codex/CodexWebSocketTransportAdapter.ts',
      'src/adapters/codex/CodexModelCatalogAdapter.ts',
      'src/services/CodexRuntimePlaneService.ts',
      'tests/services/CodexRuntimePlaneService.test.ts',
      'scripts/codex-runtime-parity-check.mjs',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'codex-runtime-contract',
    label: 'Contract defines Codex app-server runtime vocabulary',
    target: 'Contract covers transports, RPC, models, approvals, events, transcripts, trajectory, media, migration and receipts',
    files: ['src/contracts/CodexRuntimeContract.ts'],
    needles: [
      'ZAVORTH_CODEX_RUNTIME_CONTRACT_VERSION',
      'CodexRuntimeTransportKind',
      'stdio-app-server',
      'websocket-app-server',
      'CodexRuntimeRpcMethod',
      'thread/turn/start',
      'CodexRuntimeApprovalBridge',
      'CodexRuntimeEventProjection',
      'CodexRuntimeMediaUnderstandingJob',
      'CodexRuntimeMigrationPlan',
      'agent.runtime.receipt',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'codex-rpc-adapter',
    label: 'RPC adapter provides app-server method boundary',
    target: 'Adapter normalizes initialize, model/list, threads, turns, compact and stop without importing Source',
    files: ['src/adapters/codex/CodexAppServerRpcAdapter.ts'],
    needles: [
      'CodexAppServerRpcAdapter',
      'initialize',
      'model/list',
      'thread/list',
      'thread/resume',
      'thread/turn/start',
      'thread/compact/start',
      'thread/stop',
      'Codex app-server RPC requester is not configured',
    ],
  }),
  ruleContainsAll({
    id: 'codex-transports',
    label: 'Transport adapters prove stdio and websocket redacted plans',
    target: 'Stdio and websocket plans avoid live IO, avoid secret serialization and expose readiness',
    files: [
      'src/adapters/codex/CodexStdioTransportAdapter.ts',
      'src/adapters/codex/CodexWebSocketTransportAdapter.ts',
    ],
    needles: [
      'liveIoRequired: false',
      'processSpawnRequired: false',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'codex-websocket-redaction',
    label: 'Websocket transport redacts secret-bearing headers',
    target: 'Websocket plans redact authorization, token, cookie, key and secret headers',
    files: ['src/adapters/codex/CodexWebSocketTransportAdapter.ts'],
    needles: [
      '[redacted]',
      'authorization|token|cookie|key|secret',
    ],
  }),
  ruleContainsAll({
    id: 'codex-runtime-service',
    label: 'Runtime plane service closes Worker 2 feature coverage',
    target: 'Service covers 14 app-server parity features, no-live-IO policy and next worker handoff',
    files: ['src/services/CodexRuntimePlaneService.ts'],
    needles: [
      'CodexRuntimePlaneService',
      'app-server-rpc',
      'stdio-transport',
      'websocket-transport',
      'model-catalog',
      'approval-bridge',
      'dynamic-tools',
      'event-projection',
      'transcript-mirror',
      'trajectory-audit',
      'media-understanding',
      'migration-import',
      'computer-use-readiness',
      'Worker 3 - OpenShell Sandbox Plane parity',
    ],
  }),
  ruleContainsAll({
    id: 'codex-normalization-target',
    label: 'Capability normalization points codex at native runtime plane',
    target: 'codex remains 125/125 normalized and targets Codex runtime contract/service/adapters',
    files: ['src/services/CapabilityNormalizationService.ts'],
    needles: [
      'agent.runtime',
      'runtimeStatus: \'native-contract\'',
      'src/contracts/CodexRuntimeContract.ts',
      'src/services/CodexRuntimePlaneService.ts',
      'src/adapters/codex',
      'codex',
    ],
  }),
  ruleContainsAll({
    id: 'codex-runtime-tests',
    label: 'Tests prove Codex runtime parity behavior',
    target: 'Tests cover snapshot closure, normalization target, run plan, media/migration, mocked RPC and redacted transports',
    files: ['tests/services/CodexRuntimePlaneService.test.ts'],
    needles: [
      'closes Codex app-server runtime parity as Zavorth-native proof',
      'keeps codex normalized to a native runtime contract target',
      'builds run, dynamic tool, media and migration plans without live IO',
      'adapts mocked app-server RPC and model discovery without live app-server dependency',
      'keeps transport adapters redacted and no-live-IO',
      'features: 14',
      'nativeRuntimeProofs: 14',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-codex-runtime-gates',
    label: 'package exposes Codex runtime parity gates',
    target: 'local QA can run codex-runtime-parity check',
    files: ['package.json'],
    needles: [
      'codex-runtime-parity:check',
      'qa:codex-runtime-parity',
      'scripts/codex-runtime-parity-check.mjs',
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
  console.log('[codex-runtime-parity] checking Worker 2');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[codex-runtime-parity] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
