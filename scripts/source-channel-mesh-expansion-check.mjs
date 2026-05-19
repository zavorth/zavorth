#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'source-channel-mesh-checkpoint-4-files',
    label: 'Connector registry files exist',
    target: 'contract, simulator, secret policy, Slack/WhatsApp packs, expansion service, command, tests and package scripts are present',
    files: [
      'src/contracts/SourceChannelMeshExpansionContract.ts',
      'src/services/SourceChannelSecretPolicyService.ts',
      'src/services/SourceChannelSimulatorService.ts',
      'src/services/SourceChannelMeshExpansionService.ts',
      'src/adapters/channels/SlackChannelPack.ts',
      'src/adapters/channels/WhatsAppChannelPack.ts',
      'scripts/source-channel-mesh-expansion.ts',
      'tests/services/SourceChannelMeshExpansionService.test.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'source-channel-mesh-contract',
    label: 'Contract captures Channel Mesh runtime vocabulary',
    target: 'contract includes send/receive/thread/edit/delete/reaction/attachment semantics, packages, patch risk and Connector registry snapshot',
    files: ['src/contracts/SourceChannelMeshExpansionContract.ts'],
    needles: [
      'ZAVORTH_SOURCE_CHANNEL_MESH_EXPANSION_CONTRACT_VERSION',
      'ChannelRuntimeContract',
      'send',
      'receive',
      'thread',
      'edit',
      'delete',
      'reaction',
      'attachment',
      '@whiskeysockets/baileys',
      'ChannelPatchRiskReceipt',
      'SourceChannelMeshExpansionSnapshot',
    ],
  }),
  ruleContainsAll({
    id: 'source-channel-simulator',
    label: 'Offline simulator covers channel actions',
    target: 'simulator emits receipts for send, receive, thread, edit, delete, reaction and attachment without live IO',
    files: ['src/services/SourceChannelSimulatorService.ts'],
    needles: [
      'runScenario',
      'send(',
      'receive(',
      'thread(',
      'edit(',
      'delete(',
      'react(',
      'attach(',
      'liveIoPerformed: false',
    ],
  }),
  ruleContainsAcross({
    id: 'source-channel-packs',
    label: 'Slack and WhatsApp packs are governed',
    target: 'Slack has an opt-in live smoke and WhatsApp Baileys requires patch-risk owner decision',
    files: [
      'src/adapters/channels/SlackChannelPack.ts',
      'src/adapters/channels/WhatsAppChannelPack.ts',
    ],
    needles: [
      'SlackChannelPack',
      'runLiveSmoke',
      'SLACK_ALLOWED_CHANNEL_IDS',
      'WhatsAppChannelPack',
      'owner_decision_required',
      '@whiskeysockets/baileys',
    ],
  }),
  ruleContainsAll({
    id: 'source-channel-expansion-service',
    label: 'Expansion service certifies optional channel packs',
    target: 'service scans package evidence, builds packs, runs simulator and emits next-phase handoff',
    files: ['src/services/SourceChannelMeshExpansionService.ts'],
    needles: [
      'buildSnapshot',
      'buildPack',
      'buildPackageEvidence',
      'whatsapp-baileys',
      'Credential vault - Memory, Document, Search And Terminal Pack',
      'noSourceSourceCopy',
      'whatsappBaileysRequiresPatchRiskOwnerDecision',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-source-channel-mesh-gate',
    label: 'package exposes Connector registry gates and dependencies',
    target: 'operators can inspect, inspect JSON, run check/QA and safe channel dependencies are direct',
    files: ['package.json'],
    needles: [
      'source-channel-mesh-expansion',
      'source-channel-mesh-expansion:json',
      'source-channel-mesh-expansion:check',
      'qa:source-channel-mesh-expansion',
      '@slack/web-api',
      'qrcode',
    ],
  }),
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
  console.log('[source-channel-mesh-expansion] checking Connector registry');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[source-channel-mesh-expansion] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
    'scripts/source-channel-mesh-expansion.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });

  if (result.status !== 0) {
    return {
      id: 'source-channel-mesh-runtime-receipt',
      label: 'Runtime Channel Mesh receipt passes',
      status: 'failed',
      observed: `exit ${result.status ?? 'unknown'}`,
      target: 'Connector registry command emits a passing channel mesh snapshot against the current Source checkout',
      details: compactDetails(result.error instanceof Error ? result.error.message : '', result.stderr, result.stdout),
    };
  }

  try {
    const receipt = JSON.parse(result.stdout);
    return {
      id: 'source-channel-mesh-runtime-receipt',
      label: 'Runtime Channel Mesh receipt passes',
      status: receipt.status === 'passed' ? 'passed' : 'failed',
      observed: `status=${receipt.status}, packs=${receipt.summary?.packs}, simulatorReceipts=${receipt.summary?.simulatorReceipts}`,
      target: 'Connector registry command emits a passing channel mesh snapshot against the current Source checkout',
      details: [
        `packagesPresentInSource=${receipt.summary?.packagesPresentInSource}`,
        `packagesImplementedInZavorth=${receipt.summary?.packagesImplementedInZavorth}`,
        `ownerGatedPacks=${receipt.summary?.ownerGatedPacks}`,
        `liveIoPerformed=${receipt.summary?.liveIoPerformed}`,
        `next=${receipt.commands?.nextStage}`,
      ],
    };
  } catch (error) {
    return {
      id: 'source-channel-mesh-runtime-receipt',
      label: 'Runtime Channel Mesh receipt passes',
      status: 'failed',
      observed: 'invalid JSON receipt',
      target: 'Connector registry command emits a passing channel mesh snapshot against the current Source checkout',
      details: [error instanceof Error ? error.message : String(error), ...compactDetails(result.stderr, result.stdout)],
    };
  }
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
