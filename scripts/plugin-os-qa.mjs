#!/usr/bin/env node
/**
 * Focused Plugin OS QA pack — not the entire monorepo suite.
 * Runs the Plugin OS / marketplace / SDK tests that cover phases P4–P7.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tests = [
  'tests/services/PluginOsBootstrapCatalogService.test.ts',
  'tests/services/PluginOsMcpRuntimeAccess.test.ts',
  'tests/services/PluginOsObservabilityService.test.ts',
  'tests/services/PluginOsAgentSurfaceService.test.ts',
  'tests/services/PluginOsTelemetryService.test.ts',
  'tests/services/PluginOsOnboardingService.test.ts',
  'tests/services/PluginOsOnboardingWizardService.test.ts',
  'tests/services/PluginOsPromptInjectionService.test.ts',
  'tests/services/PluginOsHttpApiService.test.ts',
  'tests/services/PluginCuratedMarketplaceService.remote.test.ts',
  'tests/services/PluginForgeService.receipts.test.ts',
  'tests/services/PluginMcpBridgeService.test.ts',
  'tests/services/PluginRouterService.test.ts',
  'tests/tools/PluginRecommendTool.test.ts',
  'tests/tools/PluginSuggestTool.test.ts',
  'tests/services/PluginOsSuggestService.test.ts',
  'tests/services/PluginOsReceiptTimelineService.test.ts',
  'tests/services/PluginOsPermissionPreviewService.test.ts',
  'tests/cli/plugins/ZavorthCliPluginsNamespace.os.test.ts',
  'tests/plugins/first-party.validation.test.ts',
  'tests/plugins/daily-ops.behavior.test.ts',
  'tests/plugins/provider-pack.behavior.test.ts',
  'tests/plugins/platform-pack.behavior.test.ts',
  'tests/plugins/memory-pack.behavior.test.ts',
  'tests/plugins/media-pack.behavior.test.ts',
  'tests/plugins/browser-search-pack.behavior.test.ts',
  'tests/plugins/trust-fabric-pack.behavior.test.ts',
  'tests/plugins/lifestyle-pack.behavior.test.ts',
  'tests/plugins/ecosystem-wave8.behavior.test.ts',
  'tests/services/PluginOsMarketplaceService.test.ts',
  'tests/services/PluginOsAgentReadiness.test.ts',
  'tests/runtime/agent/ToolExposureProfile.test.ts',
  'tests/services/SkillToolRegistryBridge.test.ts',
  'tests/services/PluginSpecializedRegistrars.test.ts',
];

function run(cmd, args, cwd = root) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    windowsHide: true,
    env: process.env,
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('Plugin OS QA pack');
console.log(`root: ${root}`);
console.log(`tests: ${tests.length}`);

run(process.execPath, [path.join(root, 'node_modules', 'jest', 'bin', 'jest.js'), ...tests, '--runInBand']);

// SDK harness
run(process.execPath, [path.join(root, 'packages', 'plugin-sdk', 'scripts', 'harness-check.mjs')]);

console.log('\nPlugin OS QA pack: OK');
