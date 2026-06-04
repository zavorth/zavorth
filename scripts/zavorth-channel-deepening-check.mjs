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
  rulePackageScripts(),
  ruleSnapshot(),
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
  console.log('[zavorth-channel-deepening] checking channel live readiness');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-channel-deepening] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 24)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthChannelDeepeningContract.ts',
    'src/services/ZavorthChannelDeepeningService.ts',
    'scripts/zavorth-channel-deepening.ts',
    'scripts/zavorth-channel-deepening-check.mjs',
    'tests/services/ZavorthChannelDeepeningService.test.ts',
    'docs/channel-mesh.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule(
    'channel-readiness-files',
    'Channel deepening files exist',
    missing.length === 0,
    `${files.length - missing.length}/${files.length}`,
    'contract, service, script, check, tests and docs are present',
    missing,
  );
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthChannelDeepeningContract.ts', [
      'live_ready',
      'outbox_ready',
      'requires_bridge',
      'ZAVORTH_CHANNEL_DEEPENING_CONTRACT_VERSION',
      'nonLiveOutboundUsesSafeOutbox',
    ]],
    ['src/services/ZavorthChannelDeepeningService.ts', [
      'telegram',
      'discord',
      'slack',
      'whatsapp',
      'matrix',
      'mattermost',
      'nextcloud-talk',
      'feishu',
      'lark',
      'googlechat',
      'irc',
      'line',
      'zalo',
      'wecom',
      'weixin',
      'qqbot',
      'twitch',
      'nostr',
      'synology-chat',
      'tlon',
      'clickclack',
      'webhooks',
      'catalog support is not live proof',
    ]],
    ['docs/channel-mesh.md', [
      'Channel Mesh',
      'setup',
      'doctor',
      'pairing',
      'live readiness',
      'safe outbox',
      'Catalog support is not live readiness',
    ]],
  ];
  const missing = [];
  for (const [file, markers] of checks) {
    const text = read(file);
    if (text === null) {
      missing.push(`missing ${file}`);
      continue;
    }
    for (const marker of markers) {
      if (!text.includes(marker)) missing.push(`${file}: missing ${marker}`);
    }
  }
  return rule(
    'channel-readiness-markers',
    'Channel deepening markers are wired',
    missing.length === 0,
    missing.length === 0 ? 'all markers' : `${missing.length} missing`,
    'all-channel setup, doctor, pairing, proof and outbox language exists',
    missing,
  );
}

function rulePackageScripts() {
  const pkg = JSON.parse(read('package.json') || '{}');
  const scripts = pkg.scripts || {};
  const required = [
    'zavorth:channel-deepening',
    'zavorth:channel-deepening:json',
    'zavorth:channel-deepening:check',
    'qa:zavorth-channel-deepening',
  ];
  const missing = required.filter((script) => !scripts[script]);
  return rule(
    'package-scripts',
    'Package scripts are wired',
    missing.length === 0,
    missing.length === 0 ? 'all scripts' : `${missing.length} missing`,
    required.join(', '),
    missing,
  );
}

function ruleSnapshot() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-channel-deepening.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
    timeout: 45000,
  });
  if (result.status !== 0) {
    return rule('snapshot', 'Channel deepening snapshot runs', false, `exit=${result.status}`, 'status=attention or passed', [
      result.error?.message || result.stderr || result.stdout || 'no output',
    ]);
  }
  const data = parseJson(result.stdout);
  const ids = new Set((data?.items || []).map((entry) => entry.id));
  const requiredIds = [
    'telegram',
    'discord',
    'slack',
    'whatsapp',
    'whatsapp-cloud',
    'whatsapp-baileys',
    'signal',
    'imessage',
    'bluebubbles',
    'email',
    'msteams',
    'matrix',
    'mattermost',
    'nextcloud-talk',
    'feishu',
    'lark',
    'googlechat',
    'irc',
    'line',
    'zalo',
    'zalouser',
    'wecom',
    'weixin',
    'qqbot',
    'twitch',
    'nostr',
    'synology-chat',
    'tlon',
    'clickclack',
    'webhooks',
    'yuanbao',
  ];
  const missingIds = requiredIds.filter((id) => !ids.has(id));
  const pass = data
    && data.contractVersion === '2026-05-24.channel-live-readiness'
    && ['passed', 'attention'].includes(data.status)
    && data.summary?.total >= 34
    && data.summary?.liveProofCommands === data.summary?.total
    && data.summary?.pairingCapable >= 28
    && data.summary?.outboxCapable >= 28
    && data.summary?.allChannelsHaveSetupDoctorPairingProof === true
    && data.summary?.allExternalChannelsHavePolicyAndReceipts === true
    && data.summary?.nonLiveSendersUseOutboxOrBlock === true
    && data.summary?.rawSecretsSerialized === false
    && data.summary?.externalIoPerformed === false
    && data.summary?.workspaceMutationPerformed === false
    && missingIds.length === 0;
  return rule(
    'snapshot',
    'Channel deepening snapshot runs',
    pass,
    data ? `status=${data.status}; channels=${data.summary?.total}; outbox=${data.summary?.outboxCapable}; pairing=${data.summary?.pairingCapable}` : 'invalid json',
    'honest all-channel map with setup, doctor, pairing, proof and outbox coverage',
    pass ? [] : missingIds.concat(result.stdout),
  );
}

function rule(id, label, passed, observed, target, details = []) {
  return {
    id,
    label,
    status: passed ? 'passed' : 'failed',
    observed,
    target,
    details,
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
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
