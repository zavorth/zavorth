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
  runWhatsappFixture(),
  runSignalFixture(),
  rulePublicDocsHonestReadiness(),
  ruleFeatureDocsProofGated(),
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
  console.log('[zavorth-channel-connection-playbook] checking channel connection playbooks');
  printRules(rules, '[zavorth-channel-connection-playbook]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ChannelConnectionPlaybookContract.ts',
    'src/services/ChannelConnectionPlaybookService.ts',
    'scripts/zavorth-channel-connection-playbook.ts',
    'scripts/zavorth-channel-connection-playbook-check.mjs',
    'tests/services/ChannelConnectionPlaybookService.test.ts',
    'docs/channel-mesh.md',
    'docs/product/channels/index.md',
    'docs/product/concepts/features.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('channel-connection-playbook-files', 'Playbook files exist', missing.length === 0, `${missing.length}/${files.length}`, 'contract, service, CLI, check, tests and docs are present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ChannelConnectionPlaybookContract.ts', ['CHANNEL_CONNECTION_PLAYBOOK_VERSION', 'rawSecretsSerialized', 'defaultRouteRequiresLiveProof']],
    ['src/services/ChannelConnectionPlaybookService.ts', ['ChannelConnectionPlaybookService', 'Catalog, scaffold, pending QR, or outbox do not count as live', 'PLATFORM_KEYS']],
    ['scripts/zavorth-channel-connection-playbook.ts', ['--channel', 'ChannelConnectionPlaybookService']],
    ['docs/channel-mesh.md', ['Channel Connection Playbook', 'Cataloged or scaffolded does not mean connected live']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('channel-connection-playbook-markers', 'Playbook markers are wired', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'contract, service, CLI and docs markers exist', missing);
}

function runAllFixture() {
  const result = runTs(['--json']);
  return jsonRule('channel-connection-playbook-all', 'All first-class channels have playbooks', result, (snapshot) =>
    snapshot.version === 'channel-connection-playbook/v1'
    && snapshot.playbooks?.length >= 9
    && snapshot.playbooks.every((entry) => entry.safety?.rawSecretsSerialized === false)
    && snapshot.playbooks.every((entry) => entry.safety?.catalogSupportIsNotLiveProof === true)
    && snapshot.playbooks.every((entry) => Array.isArray(entry.requiredInputKeys)));
}

function runWhatsappFixture() {
  const result = runTs(['--json', '--channel=whatsapp', '--mode=cloud-api']);
  return jsonRule('channel-connection-playbook-whatsapp', 'WhatsApp Cloud API exposes webhook and env-key path', result, (snapshot) =>
    snapshot.selected?.channelId === 'whatsapp'
    && snapshot.selected?.mode === 'cloud-api'
    && snapshot.selected?.requiredInputKeys?.includes('WHATSAPP_ACCESS_TOKEN')
    && snapshot.selected?.steps?.some((step) => step.id === 'configure-webhook')
    && snapshot.selected?.readiness?.defaultRouteAllowed !== true);
}

function runSignalFixture() {
  const result = runTs(['--json', '--channel=signal']);
  return jsonRule('channel-connection-playbook-signal', 'Signal remains bridge-aware and conservative', result, (snapshot) =>
    snapshot.selected?.channelId === 'signal'
    && snapshot.selected?.steps?.some((step) => step.details.join(' ').includes('signal-cli'))
    && snapshot.selected?.safety?.outboxOnlyIsNotLive === true
    && snapshot.selected?.readiness?.defaultRouteAllowed !== true);
}

function ruleWorkspaceCheck() {
  const text = read('package.json');
  const scriptMarker = '"zavorth:channel-connection-playbook:check"';
  const workspaceMarker = 'npm run zavorth:channel-connection-playbook:check --silent';
  const missing = [];
  if (!text.includes(scriptMarker)) missing.push(scriptMarker);
  if (!text.includes(workspaceMarker)) missing.push(workspaceMarker);
  return rule('workspace-check-wire', 'workspace:check includes channel connection playbook gate', missing.length === 0, missing.length === 0 ? 'wired' : `${missing.length} missing`, 'script and workspace gate are present', missing);
}

function rulePublicDocsHonestReadiness() {
  const file = 'docs/product/channels/index.md';
  const text = read(file);
  const liveClaimChannels = [
    'Discord',
    'WhatsApp',
    'Slack',
    'Signal',
    'iMessage',
    'Microsoft Teams',
    'Email',
  ];
  const rows = text.split(/\r...\n/);
  const badClaims = liveClaimChannels.filter((label) => {
    const row = rows.find((line) => line.trim().startsWith(`| **${label}** |`));
    if (!row) return false;
    const statusCell = row.split('|').map((cell) => cell.trim())[2] || '';
    return /^live$/i.test(statusCell) || /^live\b/i.test(statusCell);
  });
  const hasHonestyMarker = text.includes('Live-ready means this local installation has passed its own doctor/live proof');
  return rule(
    'public-channel-docs-honest-readiness',
    'Public channel docs do not claim optional channels are live without local proof',
    badClaims.length === 0 && hasHonestyMarker,
    badClaims.length === 0 ? 'no false live claims' : `false live claims: ${badClaims.join(', ')}`,
    'optional channels are described as setup/proof gated and docs define live-ready',
    badClaims.map((label) => `${file}: ${label} must not be listed as Live by default`),
  );
}

function ruleFeatureDocsProofGated() {
  const file = 'docs/product/concepts/features.md';
  const text = read(file);
  const missing = [];
  for (const marker of [
    'Guided first-class setup',
    'Doctor/live proof gates external channels before they can become default routes',
    'Every connected channel uses the same runtime',
  ]) {
    if (!text.includes(marker)) missing.push(`${file}: missing ${marker}`);
  }
  for (const stale of ['20+ more', 'Every channel uses the same runtime']) {
    if (text.includes(stale)) missing.push(`${file}: stale overclaim ${stale}`);
  }
  return rule(
    'feature-docs-proof-gated',
    'Feature docs describe channel breadth as proof-gated',
    missing.length === 0,
    missing.length === 0 ? 'proof-gated language' : `${missing.length} issues`,
    'features page uses guided/proof-gated channel wording',
    missing,
  );
}

function runTs(args) {
  return spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-channel-connection-playbook.ts',
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
    return rule(id, label, passed, `status=${snapshot.status}; selected=${snapshot.selected?.channelId || 'none'}`, 'expected channel connection playbook snapshot', passed ? [] : [JSON.stringify(snapshot, null, 2), ...compact(result.stderr)]);
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
  return parts.join('\n').split(/\r...\n/).map((line) => line.trim()).filter(Boolean).slice(0, 12);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+...^${}()|[\]\\]/g, '\\$&');
}
