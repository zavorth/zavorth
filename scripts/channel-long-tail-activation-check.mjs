#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'channel-long-tail-files',
    label: 'Channel long-tail activation files exist',
    target: 'Contract, service, family adapters, tests, docs, script, SDK barrels and package scripts are present',
    files: [
      'src/contracts/ChannelLongTailActivationContract.ts',
      'src/services/ChannelLongTailActivationService.ts',
      'src/adapters/channels/ChannelLongTailLiveClients.ts',
      'tests/services/ChannelLongTailActivationService.test.ts',
      'scripts/channel-long-tail-activation.ts',
      'scripts/channel-long-tail-activation-check.mjs',
      'docs/README.md',
      'src/sdk/contracts.ts',
      'src/sdk/index.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'channel-long-tail-contract',
    label: 'Contract defines Approval gate long-tail vocabulary',
    target: 'Contract captures native long-tail channels, adapter families, gates, receipts and no-template closure',
    files: ['src/contracts/ChannelLongTailActivationContract.ts'],
    needles: [
      'ZAVORTH_CHANNEL_LONG_TAIL_ACTIVATION_CONTRACT_VERSION',
      '2026-05-04.live-checkpoint-3',
      'ChannelLongTailActivationId',
      'bluebubbles',
      'clickclack',
      'feishu',
      'imessage',
      'templateOnlyRemaining: false',
      'plannedRemaining: false',
    ],
  }),
  ruleContainsAll({
    id: 'channel-long-tail-family-adapters',
    label: 'Family adapters implement real live send paths',
    target: 'Webhook, bot HTTP, relay/local bridge and Apple bridge families can perform controlled live sends',
    files: ['src/adapters/channels/ChannelLongTailLiveClients.ts'],
    needles: [
      'WebhookChannelLiveClient',
      'BotHttpChannelLiveClient',
      'LocalBridgeChannelLiveClient',
      'relay-http',
      'local-bridge',
      'apple-bridge',
      'sendText',
      'execFile',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'channel-long-tail-service',
    label: 'Service closes all long-tail channel activation gates',
    target: 'Service maps all long-tail channels into family adapters with config schema, doctor and staging smoke commands',
    files: ['src/services/ChannelLongTailActivationService.ts'],
    needles: [
      'ChannelLongTailActivationService',
      'LONG_TAIL_CHANNELS',
      'ClickClack Bot API',
      'Feishu incoming webhook',
      'Google Chat incoming webhook',
      'Matrix homeserver client API',
      'BlueBubbles server bridge',
      'macOS Node Mesh iMessage bridge',
      'templateOnlyRemaining: false',
      'plannedRemaining: false',
      '--confirm-live-io',
      'runConfiguredDoctor',
      'runStagingLiveSmoke',
      'missingRequiredEnv',
    ],
  }),
  ruleContainsAll({
    id: 'channel-long-tail-cli',
    label: 'CLI runs doctors and gated staging-live smokes',
    target: 'Script uses Approval gate service methods instead of only printing activation metadata',
    files: ['scripts/channel-long-tail-activation.ts'],
    needles: [
      'runConfiguredDoctor',
      'runStagingLiveSmoke',
      'liveIoPerformed',
      'blocked',
      '--confirm-live-io',
    ],
  }),
  ruleContainsAll({
    id: 'live-readiness-channel-promotion-service',
    label: 'Live readiness service promotes long-tail channels',
    target: 'The readiness kernel lists long-tail channels in partial-live classification',
    files: ['src/services/LiveReadinessService.ts'],
    needles: [
      'bluebubbles',
      'clickclack',
      'feishu',
      'googlechat',
      'imessage',
      'matrix',
      'CHANNEL_PARTIAL_LIVE',
    ],
  }),
  ruleContainsAll({
    id: 'live-readiness-channel-promotion-tests',
    label: 'Live readiness tests prove long-tail promotion',
    target: 'Tests assert long-tail channels are partial-live, not template-only or planned',
    files: ['tests/services/LiveReadinessService.test.ts'],
    needles: [
      "entries.get('feishu')?.status).toBe('partial-live')",
      "entries.get('bluebubbles')?.status).toBe('partial-live')",
    ],
  }),
  ruleContainsAll({
    id: 'channel-long-tail-tests',
    label: 'Tests prove Approval gate behavior',
    target: 'Tests cover snapshot, readiness promotion and all adapter families',
    files: ['tests/services/ChannelLongTailActivationService.test.ts'],
    needles: [
      'closes Approval gate long-tail activation gates',
      'moves long-tail channels out of template-only and planned readiness',
      'sends through webhook and bot HTTP family adapters',
      'sends through relay/local bridge and Apple bridge adapters',
      'runs configured doctors and blocks staging-live when config is missing',
      'runs staging-live smoke through the selected long-tail family adapter',
      'runs staging-live smoke through local bridge scripts with allowlisted recipients',
      'templateOnlyRemaining: false',
      'plannedRemaining: false',
    ],
  }),
  ruleContainsAll({
    id: 'channel-long-tail-package',
    label: 'Package exposes Approval gate scripts',
    target: 'Approval gate can be run through package scripts',
    files: ['package.json'],
    needles: [
      'channel-long-tail-activation',
      'channel-long-tail-activation:check',
      'qa:channel-long-tail-activation',
    ],
  }),
  ruleContainsAll({
    id: 'channel-long-tail-sdk',
    label: 'SDK exposes Approval gate contract and service',
    target: 'Approval gate can be imported from SDK barrels',
    files: ['src/sdk/contracts.ts', 'src/sdk/index.ts'],
    needles: [
      'ChannelLongTailActivation',
    ],
  }),
  ruleContainsAll({
    id: 'channel-long-tail-doc',
    label: 'Docs record Approval gate closure',
    target: 'Approval gate documentation explains Long Tail and staging-live flow',
    files: ['docs/README.md'],
    needles: [
      'Approval gate',
      'Long Tail',
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
  console.log('[channel-long-tail-activation] checking Approval gate');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[channel-long-tail-activation] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
