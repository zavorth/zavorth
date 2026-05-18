#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [];
const requiredFiles = [
  'src/services/providers/catalog/zavorthProviderCapabilityInventory.ts',
  'src/services/providers/catalog/manifests/zavorthProviderCapabilityProviders.ts',
  'src/services/ZavorthProviderCapabilityCatalogService.ts',
  'scripts/zavorth-provider-capability-catalog.ts',
  'tests/services/ZavorthProviderCapabilityCatalogService.test.ts',
];

for (const file of requiredFiles) {
  rules.push({
    id: `file:${file}`,
    status: fs.existsSync(path.join(root, file)) ? 'passed' : 'failed',
    summary: `${file} exists`,
  });
}

const snapshot = runScript(['--json']);
if (snapshot) {
  assertRule('contract:version', snapshot.contractVersion === '2026-05-17.provider-capability-catalog.v1', 'Provider capability catalog contract is current');
  assertRule('surface:catalog', snapshot.surface === 'provider-capability-catalog', 'Provider capability catalog surface is exposed');
  assertRule('inventory:extensions', Number(snapshot.summary?.extensionPackageJsonCount || 0) >= 122, 'Extension package inventory count is preserved');
  assertRule('inventory:provider-like', Number(snapshot.summary?.providerLikeExtensionCount || 0) >= 65, 'Provider-like extension count is preserved');
  assertRule('inventory:provider-docs', Number(snapshot.summary?.providerDirectoryEntries || 0) >= 52, 'Provider directory inventory count is preserved');
  assertRule('inventory:static-models', Number(snapshot.summary?.staticCatalogModelCount || 0) >= 260, 'Static model inventory count is preserved');
  assertRule('inventory:catalog-models', Number(snapshot.summary?.catalogModelEntries || 0) >= 300, 'Provider capability catalog includes static and media models');
  assertRule('routes:capability', Number(snapshot.summary?.registeredCapabilityRoutes || 0) === Number(snapshot.summary?.capabilityManifests || -1), 'Capability manifests are registered in provider registry');
  assertRule('modality:image', Number(snapshot.modalities?.image?.providerCount || 0) >= 10, 'Image provider capability is present');
  assertRule('modality:video', Number(snapshot.modalities?.video?.providerCount || 0) >= 16, 'Video provider capability is present');
  assertRule('modality:music', Number(snapshot.modalities?.music?.providerCount || 0) >= 3, 'Music provider capability is present');
  assertRule('modality:tts', Number(snapshot.modalities?.tts?.providerCount || 0) >= 15, 'TTS provider capability is present');
  assertRule('modality:transcription', Number(snapshot.modalities?.transcription?.providerCount || 0) >= 6, 'Transcription provider capability is present');
  assertRule('safety:no-hidden-live', snapshot.safety?.noLiveNetworkCalls === true && snapshot.safety?.noHiddenAgentProcessLaunch === true, 'Provider capability catalog does not run hidden network or agent processes');
  assertRule('safety:no-secrets', !JSON.stringify(snapshot).match(/sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}/), 'Provider capability catalog does not serialize raw provider secrets');
}

const catalog = runCatalog(['--json']);
if (catalog) {
  assertRule('catalog:expanded-routes', Number(catalog.summary?.providerRoutes || 0) >= 70, 'Unified provider model catalog includes capability routes');
  assertRule('catalog:expanded-models', Number(catalog.summary?.staticCatalogModels || 0) >= 300, 'Unified provider model catalog includes capability models');
  assertRule('catalog:media-video', Number(catalog.summary?.modalityCounts?.video || 0) > 0, 'Unified catalog exposes video-capable routes');
  assertRule('catalog:media-audio', Number(catalog.summary?.modalityCounts?.audio || 0) > 0, 'Unified catalog exposes audio-capable routes');
  assertRule('catalog:safety', catalog.safety?.liveProbeRequiresExplicitOperatorAction === true, 'Unified catalog keeps live proof explicit');
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
  console.log('[provider-capability-catalog] certification');
  for (const rule of rules) {
    console.log(`[provider-capability-catalog] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.summary}`);
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function runScript(args) {
  try {
    const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
    const fullArgs = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npx', 'tsx', 'scripts/zavorth-provider-capability-catalog.ts', ...args]
      : ['tsx', 'scripts/zavorth-provider-capability-catalog.ts', ...args];
    const output = execFileSync(command, fullArgs, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(output);
  } catch (error) {
    rules.push({
      id: 'script:provider-capability-catalog',
      status: 'failed',
      summary: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function runCatalog(args) {
  try {
    const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
    const fullArgs = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npx', 'tsx', 'scripts/zavorth-provider-model-catalog.ts', ...args]
      : ['tsx', 'scripts/zavorth-provider-model-catalog.ts', ...args];
    const output = execFileSync(command, fullArgs, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(output);
  } catch (error) {
    rules.push({
      id: 'script:provider-model-catalog',
      status: 'failed',
      summary: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function assertRule(id, condition, summary) {
  rules.push({
    id,
    status: condition ? 'passed' : 'failed',
    summary,
  });
}
