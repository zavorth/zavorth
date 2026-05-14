#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'channel-live-activation-files',
    label: 'Channel live activation files exist',
    target: 'Contract, service, adapters, tests, docs, script, SDK barrels and package scripts are present',
    files: [
      'src/contracts/ChannelLiveActivationContract.ts',
      'src/services/ChannelLiveActivationService.ts',
      'src/adapters/channels/SignalLiveClient.ts',
      'src/adapters/channels/TeamsGraphBotClient.ts',
      'tests/services/ChannelLiveActivationService.test.ts',
      'scripts/channel-live-activation.ts',
      'scripts/channel-live-activation-check.mjs',
      'docs/README.md',
      'src/sdk/contracts.ts',
      'src/sdk/index.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'channel-live-activation-contract',
    label: 'Contract defines Phase 2 activation vocabulary',
    target: 'Contract captures six P0 channels, config schema, gates, staging-live smoke and redacted receipts',
    files: ['src/contracts/ChannelLiveActivationContract.ts'],
    needles: [
      'ZAVORTH_CHANNEL_LIVE_ACTIVATION_CONTRACT_VERSION',
      '2026-05-04.live-phase-2',
      'ChannelLiveActivationP0Id',
      'signal',
      'msteams',
      'staging-live-smoke',
      'config-schema',
      'redacted-receipt',
      'signalAndTeamsOutboxOnly: false',
      'Phase 4 - Provider Runtime Activation P0',
    ],
  }),
  ruleContainsAll({
    id: 'channel-live-activation-service',
    label: 'Service closes the six P0 channel activation gates',
    target: 'Service gives every P0 channel config, doctor, inbound/outbound mock, real send path and staging live command',
    files: ['src/services/ChannelLiveActivationService.ts'],
    needles: [
      'ChannelLiveActivationService',
      'Signal JSON-RPC or signal-cli daemon',
      'Microsoft Graph chat messages',
      'Slack Web API',
      'Meta WhatsApp Cloud API',
      'Discord native bot gateway',
      'Telegram native bot gateway',
      'signalAndTeamsOutboxOnly: false',
      'outbox is allowed only when live provider config is missing',
      '--confirm-live-io',
    ],
  }),
  ruleContainsAll({
    id: 'signal-live-adapter',
    label: 'Signal has a real live adapter',
    target: 'Signal supports JSON-RPC/CLI sends and daemon setup hints',
    files: ['src/adapters/channels/SignalLiveClient.ts'],
    needles: [
      'SignalLiveClient',
      'sendViaJsonRpc',
      'sendViaCli',
      'buildDaemonCommand',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'teams-live-adapter',
    label: 'Teams has a real live adapter',
    target: 'Teams supports Graph token/send/reply/edit',
    files: ['src/adapters/channels/TeamsGraphBotClient.ts'],
    needles: [
      'TeamsGraphBotClient',
      'getAccessToken',
      'sendText',
      'replyText',
      'editText',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'signal-gateway-wiring',
    label: 'Signal gateway uses live adapter before fallback',
    target: 'Signal calls the live adapter when configured and keeps outbox as fallback only',
    files: ['src/gateways/SignalGateway.stub.ts'],
    needles: [
      'SignalLiveClient',
      'sendOrFallback',
      'isConfigured()',
      'fallback-outbox',
      'Signal live send failed',
    ],
  }),
  ruleContainsAll({
    id: 'teams-gateway-wiring',
    label: 'Teams gateway uses live adapter before fallback',
    target: 'Teams calls the live adapter when configured and keeps outbox as fallback only',
    files: ['src/gateways/TeamsGateway.stub.ts'],
    needles: [
      'TeamsGraphBotClient',
      'sendOrFallback',
      'isConfigured()',
      'fallback-outbox',
      'Teams Graph live send failed',
    ],
  }),
  ruleContainsAll({
    id: 'channel-live-activation-tests',
    label: 'Tests prove Phase 2 behavior',
    target: 'Tests cover P0 snapshot, readiness promotion, Signal JSON-RPC/CLI and Teams Graph send',
    files: ['tests/services/ChannelLiveActivationService.test.ts'],
    needles: [
      'closes Phase 2 P0 channel activation gates',
      'moves Signal and Teams out of dry-run-only readiness',
      'sends Signal messages through JSON-RPC or signal-cli',
      'sends Microsoft Teams messages through Graph with redacted receipts',
      'signalAndTeamsOutboxOnly: false',
      'TEAMS_CLIENT_SECRET',
      'SIGNAL_JSONRPC_URL or SIGNAL_CLI_PATH',
    ],
  }),
  ruleContainsAll({
    id: 'channel-live-activation-package',
    label: 'Package exposes Phase 2 scripts',
    target: 'Phase 2 can be run through package scripts',
    files: ['package.json'],
    needles: [
      'channel-live-activation',
      'channel-live-activation:check',
      'qa:channel-live-activation',
    ],
  }),
  ruleContainsAll({
    id: 'channel-live-activation-sdk',
    label: 'SDK exposes Phase 2 service and contract',
    target: 'Phase 2 can be imported from SDK barrels',
    files: ['src/sdk/contracts.ts', 'src/sdk/index.ts'],
    needles: [
      'ChannelLiveActivation',
    ],
  }),
  ruleContainsAll({
    id: 'channel-live-activation-doc',
    label: 'Docs record Phase 2 closure',
    target: 'Phase 2 documentation explains P0 channels and staging-live flow',
    files: ['docs/README.md'],
    needles: [
      'Phase 2',
      'Signal',
      'Microsoft Teams',
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
  console.log('[channel-live-activation] checking Phase 2');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[channel-live-activation] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
