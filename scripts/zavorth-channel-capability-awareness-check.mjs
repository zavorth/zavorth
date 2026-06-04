#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  runAllFixture(),
  runTelegramFixture(),
  runDiscordFixture(),
  runFallbackFixture(),
  ruleWorkspaceCheck(),
];
const failed = rules.filter((item) => item.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-channel-capability-awareness] checking Surface controls');
  printRules(rules, '[zavorth-channel-capability-awareness]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ChannelCapabilityContract.ts',
    'src/services/ZavorthChannelCapabilityAwarenessService.ts',
    'scripts/zavorth-channel-capability-awareness.ts',
    'scripts/zavorth-channel-capability-awareness-check.mjs',
    'tests/domain/surface/ChannelCapabilityAwarenessService.test.ts',
    'docs/README.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('channel-capability-files', 'Surface controls files exist', missing.length === 0, `${files.length - missing.length}/${files.length}`, 'contract, service, CLI, check, tests and docs are present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ChannelCapabilityContract.ts', ['CHANNEL_CAPABILITY_CONTRACT_VERSION', 'telegram_inline_keyboard', 'discord_components', 'structured_text_fallback']],
    ['src/services/ZavorthChannelCapabilityAwarenessService.ts', ['checkpoint-7-channel-capability-awareness', 'renderSurfaceResponseForTarget', 'noTelegramPrivileging']],
    ['scripts/zavorth-channel-capability-awareness.ts', ['--channel=', 'ZavorthChannelCapabilityAwarenessService']],
    ['src/sdk/contracts.ts', ['ChannelCapabilityContract']],
    ['src/sdk/index.ts', ['ZavorthChannelCapabilityAwarenessService']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('channel-capability-markers', 'Surface controls markers are wired', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'contract, service, CLI and SDK markers exist', missing);
}

function runAllFixture() {
  const result = runTs(['--json', '--now=2026-05-12T10:00:00.000Z']);
  return jsonRule('channel-capability-all', 'All required channels are capability-aware', result, (snapshot) =>
    snapshot.status === 'ready'
    && snapshot.summary.allRequiredChannelsCovered === true
    && snapshot.summary.telegramPrivileged === false
    && snapshot.summary.requiredProfiles === 7
    && snapshot.summary.failedChecks === 0);
}

function runTelegramFixture() {
  const result = runTs(['--json', '--channel=telegram', '--now=2026-05-12T10:00:00.000Z']);
  return jsonRule('channel-capability-telegram', 'Telegram uses inline keyboard through shared response', result, (snapshot) =>
    snapshot.status === 'ready'
    && snapshot.profiles[0]?.channel === 'telegram'
    && snapshot.adaptedExamples.some((entry) => entry.capabilityUsed.nativeButtons === true && entry.rendered.native?.replyMarkup));
}

function runDiscordFixture() {
  const result = runTs(['--json', '--channel=discord', '--now=2026-05-12T10:00:00.000Z']);
  return jsonRule('channel-capability-discord', 'Discord uses components with safe mentions', result, (snapshot) =>
    snapshot.status === 'ready'
    && snapshot.profiles[0]?.channel === 'discord'
    && snapshot.adaptedExamples.some((entry) => entry.capabilityUsed.nativeButtons === true && entry.rendered.native?.components)
    && snapshot.adaptedExamples.every((entry) => entry.rendered.native?.allowedMentions?.parse?.length === 0));
}

function runFallbackFixture() {
  const result = runTs(['--json', '--channel=signal', '--now=2026-05-12T10:00:00.000Z']);
  return jsonRule('channel-capability-fallback', 'Signal uses structured textual fallback', result, (snapshot) =>
    snapshot.status === 'ready'
    && snapshot.profiles[0]?.channel === 'signal'
    && snapshot.adaptedExamples.every((entry) => entry.status === 'fallback' && entry.rendered.native === null));
}

function ruleWorkspaceCheck() {
  const text = read('package.json');
  const marker = 'node scripts/zavorth-channel-capability-awareness-check.mjs';
  return rule('workspace-check-wire', 'workspace:check includes Channel Capability Surface controls gate', text.includes(marker), text.includes(marker) ? 'wired' : 'missing', marker, []);
}

function runTs(args) {
  return spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-channel-capability-awareness.ts',
    ...args,
  ], { cwd: root, encoding: 'utf8', env: process.env });
}

function jsonRule(id, label, result, expect) {
  if (!result.stdout.trim()) {
    return rule(id, label, false, `exit ${result.status ?? 'unknown'}`, 'valid JSON fixture', compact(result.stderr, result.stdout));
  }
  try {
    const snapshot = JSON.parse(result.stdout);
    const passed = expect(snapshot);
    return rule(id, label, passed, `status=${snapshot.status}; failed=${snapshot.summary?.failedChecks}`, 'expected channel capability snapshot', passed ? [] : [JSON.stringify(snapshot, null, 2), ...compact(result.stderr)]);
  } catch (error) {
    return rule(id, label, false, 'invalid JSON', 'valid JSON fixture', [String(error), ...compact(result.stderr, result.stdout)]);
  }
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function rule(id, label, passed, observed, target, details = []) {
  return { id, label, status: passed ? 'passed' : 'failed', observed, target, details };
}

function printRules(items, prefix) {
  for (const item of items) {
    console.log(`${prefix} ${item.status === 'passed' ? 'ok' : 'fail'} ${item.label}: ${item.observed} | ${item.target}`);
    for (const detail of item.details.slice(0, 12)) console.log(`  - ${detail}`);
  }
}

function compact(...parts) {
  return parts.join('\n').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 12);
}
