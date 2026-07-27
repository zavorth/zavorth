#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const requiredFiles = [
  'src/contracts/GatewaySpineContract.ts',
  'src/services/GatewaySpineService.ts',
  'scripts/gateway-spine.ts',
  'tests/services/GatewaySpineService.test.ts',
];

const rules = [];

for (const file of requiredFiles) {
  rules.push({
    id: `file:${file}`,
    status: fs.existsSync(path.join(root, file)) ? 'passed' : 'failed',
    summary: `${file} exists`,
  });
}

let snapshot = null;
try {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx', 'tsx', 'scripts/gateway-spine.ts', '--json']
    : ['tsx', 'scripts/gateway-spine.ts', '--json'];
  const output = execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  snapshot = JSON.parse(output);
} catch (error) {
  rules.push({
    id: 'script:json',
    status: 'failed',
    summary: `gateway spine script did not return valid JSON: ${error instanceof Error ? error.message : String(error)}`,
  });
}

if (snapshot) {
  assertRule('contract:version', snapshot.contractVersion === '2026-05-13.gate-1', 'Gateway Spine contract version is current');
  assertRule('spine:single-source', snapshot.spine?.singleSourceOfTruth === true, 'Gateway Spine owns the canonical truth');
  assertRule('channels:registry', snapshot.channels?.summary?.total > 0, 'Channel registry is attached to the spine');
  assertRule('commands:status', hasCommand(snapshot, 'gateway.status'), 'Gateway status command is exposed');
  assertRule('commands:sessions', hasCommand(snapshot, 'gateway.sessions'), 'Gateway sessions command is exposed');
  assertRule('commands:channels', hasCommand(snapshot, 'gateway.channels'), 'Gateway channels command is exposed');
  assertRule('commands:approvals', hasCommand(snapshot, 'gateway.approvals'), 'Gateway approvals command is exposed');
  assertRule('commands:receipts', hasCommand(snapshot, 'gateway.receipts'), 'Gateway receipts command is exposed');
  assertRule('commands:artifacts', hasCommand(snapshot, 'gateway.artifacts'), 'Gateway artifacts command is exposed');
  assertRule('surfaces:web', hasSurface(snapshot, 'web'), 'Web consumes GatewaySpineSnapshot');
  assertRule('surfaces:cli', hasSurface(snapshot, 'cli'), 'CLI consumes GatewaySpineSnapshot');
  assertRule('surfaces:telegram', hasSurface(snapshot, 'telegram'), 'Telegram consumes GatewaySpineSnapshot without being privileged');
  assertRule(
    'invariant:surface-consistency',
    snapshot.invariants?.some((entry) => entry.id === 'surface-state-consistency' && entry.status === 'passed'),
    'Surface state consistency invariant passes',
  );
}

const failed = rules.filter((rule) => rule.status === 'failed');
const result = {
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
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('[gateway-spine] certification');
  for (const rule of rules) {
    console.log(`[gateway-spine] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.summary}`);
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function assertRule(id, condition, summary) {
  rules.push({
    id,
    status: condition ? 'passed' : 'failed',
    summary,
  });
}

function hasCommand(snapshot, id) {
  return Array.isArray(snapshot.commands) && snapshot.commands.some((command) => command.id === id);
}

function hasSurface(snapshot, surface) {
  return Array.isArray(snapshot.surfaces)
    && snapshot.surfaces.some((entry) => entry.surface === surface && entry.stateSource === 'GatewaySpineSnapshot');
}
