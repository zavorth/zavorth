#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [];
const requiredFiles = [
  'src/contracts/ZavorthProviderModelCatalogContract.ts',
  'src/services/ZavorthProviderModelCatalogService.ts',
  'scripts/zavorth-provider-model-catalog.ts',
  'tests/services/ZavorthProviderModelCatalogService.test.ts',
  'tests/ai-gateway/zavorthControl/ZavorthControlProviderModelCatalogImplementation.test.ts',
];

for (const file of requiredFiles) {
  rules.push({
    id: `file:${file}`,
    status: fs.existsSync(path.join(root, file)) ? 'passed' : 'failed',
    summary: `${file} exists`,
  });
}

const snapshot = runCatalog(['--json']);

if (snapshot) {
  assertRule('contract:version', snapshot.contractVersion === '2026-05-17.provider-model-catalog.v1', 'Provider model catalog contract is current');
  assertRule('surface:catalog', snapshot.surface === 'provider-model-catalog', 'Provider model catalog surface is exposed');
  assertRule('summary:routes', Number(snapshot.summary?.providerRoutes || 0) >= 10, 'Catalog exposes multiple provider routes');
  assertRule('summary:models', Number(snapshot.summary?.effectiveModelSurface || 0) >= Number(snapshot.summary?.staticCatalogModels || 0), 'Effective model surface includes static and live-discovered counts');
  assertRule('sections:aggregators', Array.isArray(snapshot.sections?.aggregators) && snapshot.sections.aggregators.includes('openrouter'), 'Aggregator section includes OpenRouter');
  assertRule('sections:media', Array.isArray(snapshot.sections?.mediaCapable) && snapshot.sections.mediaCapable.length > 0, 'Media-capable providers are visible');
  assertRule('safety:no-execution', snapshot.zavorthControlProjection?.executionAuthority === false, 'ZavorthControl projection cannot execute provider calls');
  assertRule('safety:no-hidden-live', snapshot.zavorthControlProjection?.normalRenderMakesNoNetworkCalls === true && snapshot.safety?.liveProbeRequiresExplicitOperatorAction === true, 'Normal catalog rendering makes no hidden live network calls');
  assertRule('safety:no-secrets', !JSON.stringify(snapshot).match(/sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}/), 'Provider model catalog does not serialize raw provider secrets');
  assertRule('commands:live-proof', snapshot.commands?.some((entry) => entry.id === 'provider-live-proof' && entry.liveNetworkUsedByDefault === true), 'Explicit live proof command is projected');
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
  console.log('[provider-model-catalog] certification');
  for (const rule of rules) {
    console.log(`[provider-model-catalog] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.summary}`);
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
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
