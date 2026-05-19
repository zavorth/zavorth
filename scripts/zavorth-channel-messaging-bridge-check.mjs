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
  runChannelMessagingFixture(),
  runChannelMessagingBlockedFixture(),
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
  console.log('[zavorth-channel-messaging-bridge] checking Credential vault');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-channel-messaging-bridge] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 16)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthChannelMessagingBridgeContract.ts',
    'src/services/ZavorthChannelMessagingBridgeService.ts',
    'scripts/zavorth-channel-messaging-bridge.ts',
    'scripts/zavorth-channel-messaging-bridge-check.mjs',
    'tests/services/ZavorthChannelMessagingBridgeService.test.ts',
    'docs/README.md',
    'docs/README.md',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'checkpoint-5-files',
    label: 'Credential vault channel messaging files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'contract, service, CLI, check, tests, docs and package scripts are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthChannelMessagingBridgeContract.ts', [
      'ZAVORTH_CHANNEL_MESSAGING_BRIDGE_CONTRACT_VERSION',
      'zavorth-channel-messaging-bridge/5',
      'NormalizedInboundMessage',
      'ReplyPipeline',
      'ZavorthTrustPlane',
      'credentialsBehindPorts',
    ]],
    ['src/services/ZavorthChannelMessagingBridgeService.ts', [
      'normalizeChannelDescriptor',
      'normalizeInboundMessage',
      'mapMessageToSessionEvent',
      'buildOutboundReplyPacket',
      'isolateCredential',
      'mapPairingTrust',
      'outbound-reply-exits-through-reply-pipeline',
    ]],
    ['docs/README.md', [
      'checkpoint-5-channels-and-messaging-ready',
      '291 Runtime gateway - Sessions, Memory, And Continuation',
      'Zavorth Channel Messaging Bridge',
    ]],
    ['docs/README.md', [
      'checkpoint-5-channels-and-messaging-complete',
      'Zavorth Channel Messaging Bridge',
      'NormalizedInboundMessage',
      'ReplyPipeline',
      'ZavorthTrustPlane',
      '291 Runtime gateway - Sessions, Memory, And Continuation',
    ]],
    ['package.json', [
      'zavorth:channel-messaging-bridge',
      'zavorth:channel-messaging-bridge:check',
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
    id: 'checkpoint-5-markers',
    label: 'Credential vault channel messaging markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'channel descriptor, inbound normalization, reply pipeline, trust and credential markers are present',
    details: missing,
  };
}

function runChannelMessagingFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-channel-messaging-bridge.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return {
      id: 'checkpoint-5-channel-messaging-fixture',
      label: 'Channel messaging bridge fixture passes',
      status: 'failed',
      observed: `exit ${result.status}`,
      target: 'default channel messaging snapshot is channel-messaging-bridge-ready',
      details: [result.error?.message || result.stderr || result.stdout || 'no output'],
    };
  }
  const snapshot = parseJson(result.stdout);
  const ok = snapshot
    && snapshot.status === 'channel-messaging-bridge-ready'
    && snapshot.contractVersion === 'zavorth-channel-messaging-bridge/5'
    && snapshot.summary?.normalizedChannels >= 2
    && snapshot.summary?.inboundMessagesNormalized === 1
    && snapshot.summary?.sessionsMapped === 1
    && snapshot.summary?.eventsMapped === 1
    && snapshot.summary?.replyPacketsBuilt === 1
    && snapshot.summary?.blockedRiskyReplyPackets === 1
    && snapshot.summary?.credentialsBehindPorts >= 2
    && snapshot.summary?.rawCredentialsStored === 0
    && snapshot.summary?.trustMappings >= 2
    && snapshot.summary?.directChannelSends === 0
    && snapshot.safety?.noLiveOutboundSend === true
    && snapshot.safety?.noRawCredentialStorage === true;
  return {
    id: 'checkpoint-5-channel-messaging-fixture',
    label: 'Channel messaging bridge fixture passes',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, ${snapshot.summary.normalizedChannels} channel(s), ${snapshot.summary.replyPacketsBuilt} reply packet(s)` : 'invalid channel messaging snapshot',
    target: 'default bridge snapshot is ready with normalized inbound, ReplyPipeline outbound, isolated credentials and trust mapping',
    details: ok ? [] : [result.stdout],
  };
}

function runChannelMessagingBlockedFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-channel-messaging-bridge.ts',
    '--json',
    '--capability-provider-status',
    'blocked',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot
    && snapshot.status === 'blocked'
    && snapshot.previousCapabilityProviderStatus === 'blocked';
  return {
    id: 'checkpoint-5-blocked-fixture',
    label: 'Channel messaging bridge blocks without Connector registry readiness',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, capabilityProvider=${snapshot.previousCapabilityProviderStatus}` : `exit ${result.status}`,
    target: 'Credential vault cannot advance while Connector registry capability providers are blocked',
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
