#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'provider-mesh-canonical-stack',
    label: 'canonical Provider Mesh stack exists',
    target: 'contracts, registry, catalog, route resolution, picker, selection, compatibility and onboarding services exist',
    files: [
      'src/contracts/ModelPickerContract.ts',
      'src/services/providers/catalog/ProviderCatalogContracts.ts',
      'src/services/providers/catalog/ProviderCatalogCompat.ts',
      'src/services/providers/catalog/ProviderIntegrationRegistry.ts',
      'src/services/providers/catalog/ProviderIntegrationManifest.ts',
      'src/services/providers/catalog/ModelCatalogAggregationService.ts',
      'src/services/providers/catalog/AccessRouteResolutionService.ts',
      'src/services/providers/catalog/ModelPickerService.ts',
      'src/services/providers/catalog/ModelSelectionService.ts',
      'src/services/providers/catalog/ProviderCompatibilityClassifier.ts',
      'src/services/providers/catalog/CustomCompatibleProviderOnboardingService.ts',
      'src/services/providers/catalog/ProviderMeshOnboardingProductService.ts',
    ],
  }),
  ruleContainsAll({
    id: 'catalog-api-facades',
    label: 'catalog APIs use aggregation service',
    target: 'api/models/catalog and api/v1/models/catalog delegate to ModelCatalogAggregationService',
    files: [
      'src/zavorth-control/app/api/models/catalog/route.ts',
      'src/zavorth-control/app/api/v1/models/catalog.ts',
    ],
    needles: ['ModelCatalogAggregationService'],
  }),
  ruleContainsAll({
    id: 'provider-model-discovery-facade',
    label: 'provider model listing uses discovery adapters',
    target: 'provider model listing delegates compatible discovery to adapters',
    files: [
      'src/zavorth-control/app/api/providers/[id]/models/providerModelsFetchers.ts',
    ],
    needles: [
      'OpenAiCompatibleModelDiscoveryAdapter',
      'AnthropicCompatibleModelDiscoveryAdapter',
    ],
  }),
  ruleContainsAll({
    id: 'onboarding-model-picker-consumer',
    label: 'onboarding consumes model picker',
    target: 'onboarding reads /api/onboarding/model-picker',
    files: [
      'src/zavorth-control/app/(zavorthControl)/control/onboarding/page.tsx',
    ],
    needles: ['/api/onboarding/model-picker'],
  }),
  ruleContainsAll({
    id: 'provider-mesh-product-onboarding',
    label: 'onboarding exposes Provider Mesh product snapshot',
    target: 'model picker API returns the C7 capability-first providerMeshOnboarding snapshot',
    files: [
      'src/zavorth-control/app/api/onboarding/model-picker/route.ts',
    ],
    needles: [
      'ProviderMeshOnboardingProductService',
      'providerMeshOnboarding',
      'requestedCapability',
    ],
  }),
  ruleContainsAll({
    id: 'providers-page-model-picker-consumer',
    label: 'providers page consumes model picker',
    target: 'providers page reads advanced picker and passes pickerRoute to cards',
    files: [
      'src/zavorth-control/app/(zavorthControl)/control/providers/page.tsx',
    ],
    needles: [
      '/api/onboarding/model-picker?includeAdvanced=true',
      'pickerRoute=',
      'ProvidersModelPickerSummary',
    ],
  }),
  ruleContainsAll({
    id: 'control-model-picker-consumer',
    label: '/zavorthControl consumes model picker snapshot',
    target: 'Gateway Console renders snapshot.modelPicker without rebuilding selection rules',
    files: [
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlGatewayConsole.tsx',
    ],
    needles: [
      'snapshot?.modelPicker',
      'modelPickerSelected',
      'modelPickerRoutes',
    ],
  }),
  ruleContainsAll({
    id: 'cli-model-picker-consumer',
    label: 'CLI consumes model picker service',
    target: 'CLI builds UniversalAgentModelProfile from ModelPickerService',
    files: [
      'src/cli/ZavorthCliModelPickerHelpers.ts',
    ],
    needles: [
      'ModelPickerService',
      'UniversalAgentModelProfile',
      'buildCliModelPickerContract',
      'resolveCliUniversalModelProfile',
    ],
  }),
  ruleContainsAll({
    id: 'control-plane-selection-resolution',
    label: 'control plane resolves selected profiles',
    target: 'ProviderControlPlaneService resolves SelectedModelProfile through ModelSelectionService',
    files: [
      'src/services/ProviderControlPlaneService.ts',
    ],
    needles: [
      'SelectedModelProfile',
      'resolveSelectedModelProfile',
      'ModelSelectionService',
    ],
  }),
  ruleContainsAll({
    id: 'strategy-selection-consumer',
    label: 'strategy consumes selected profiles',
    target: 'ProviderStrategyService keeps family, route, provider and fallback profiles in the decision',
    files: [
      'src/services/ProviderStrategyService.ts',
    ],
    needles: [
      'SelectedModelProfile',
      'selectedModelProfile',
      'fallbackProfiles',
      'familyId',
      'routeId',
    ],
  }),
  ruleContainsAll({
    id: 'runtime-selection-bridge',
    label: 'runtime factory resolves selected routes',
    target: 'ProviderFactory resolves SelectedModelProfile through compatibility classification',
    files: [
      'src/providers/ProviderFactory.ts',
    ],
    needles: [
      'SelectedModelProfile',
      'ProviderCompatibilityClassifier',
      'resolveRuntimeTarget',
      'custom-openai-compatible',
      'fallback Gemini legado',
    ],
  }),
  ruleFilesExist({
    id: 'provider-mesh-convergence-tests',
    label: 'provider mesh convergence tests exist',
    target: 'catalog, picker, selection and runtime bridge tests are present',
    files: [
      'tests/services/providers/catalog/ProviderIntegrationRegistry.test.ts',
      'tests/services/providers/catalog/ModelCatalogAggregationService.test.ts',
      'tests/services/providers/catalog/AccessRouteResolutionService.test.ts',
      'tests/services/providers/catalog/ModelPickerService.test.ts',
      'tests/services/providers/catalog/ModelSelectionService.test.ts',
      'tests/services/providers/catalog/ProviderCompatibilityClassifier.test.ts',
      'tests/services/providers/catalog/CustomCompatibleProviderOnboardingService.test.ts',
      'tests/services/providers/catalog/ProviderMeshOnboardingProductService.test.ts',
      'tests/providers/ProviderFactoryModelSelectionBridge.test.ts',
      'tests/zavorth-control/OnboardingModelPickerSurface.test.ts',
      'tests/zavorth-control/ProvidersPageModelPickerSurface.test.ts',
      'tests/cli/ZavorthCliModelPickerHelpers.test.ts',
    ],
  }),
];

const warnings = [
  providerDetailWarning(),
  workspaceHardeningWarning(),
].filter(Boolean);

const failed = rules.filter((entry) => entry.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: {
    rules: rules.length,
    passed: rules.length - failed.length,
    failed: failed.length,
    warnings: warnings.length,
  },
  rules,
  warnings,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[provider-mesh-convergence] checking canonical Provider Mesh convergence');
  for (const entry of rules) {
    const marker = entry.status === 'passed' ? 'ok' : 'fail';
    console.log(`[provider-mesh-convergence] ${marker} ${entry.label}: ${entry.observed} | ${entry.target}`);
    for (const detail of entry.details.slice(0, 8)) {
      console.log(`  - ${detail}`);
    }
  }
  for (const warning of warnings) {
    console.log(`[provider-mesh-convergence] warn ${warning.label}: ${warning.observed} | ${warning.target}`);
    for (const detail of warning.details.slice(0, 8)) {
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

function providerDetailWarning() {
  const files = [
    'src/zavorth-control/app/(dashboard)/dashboard/providers/[id]/provider-detail-models-panel.tsx',
    'src/zavorth-control/app/(dashboard)/dashboard/providers/[id]/provider-detail-page.model-actions.ts',
    'src/zavorth-control/app/(dashboard)/dashboard/providers/[id]/provider-detail-model-sections-compatible.tsx',
    'src/zavorth-control/app/(dashboard)/dashboard/providers/[id]/useProviderDetailPageModel.ts',
  ];
  const missingMarkers = files
    .filter((file) => exists(file))
    .filter((file) => !/modelPicker|pickerRoute|ModelPicker/u.test(read(file) || ''))
    .map((file) => `${file}: provider detail still appears connection/local-catalog driven`);
  if (missingMarkers.length === 0) {
    return null;
  }
  return {
    id: 'provider-detail-model-picker-followup',
    label: 'provider detail model panels are follow-up convergence work',
    status: 'warning',
    observed: `${missingMarkers.length} provider detail file(s) without direct picker marker`,
    target: 'provider detail can be migrated after the canonical API/CLI/zavorthControl/runtime path stays green',
    details: missingMarkers,
  };
}

function workspaceHardeningWarning() {
  const packageJson = JSON.parse(read('package.json') || '{"scripts":{}}');
  const scriptCount = Object.keys(packageJson.scripts || {}).length;
  const counts = {
    packageScripts: scriptCount,
    telegramAny: countAnyInTree('src/telegram', (file) => true),
    surfaceAny: countAnyInTree('src/domain/surface', (file) => true),
    servicesRootAny: countAnyInTree('src/services', (file) => {
      const relative = toPosix(path.relative(path.join(root, 'src/services'), file));
      return relative.split('/').length === 1 && /\.tsx?$/u.test(relative);
    }),
  };
  const details = [];
  if (counts.packageScripts > 100) {
    details.push(`package.json scripts: ${counts.packageScripts}/100`);
  }
  if (counts.telegramAny > 303) {
    details.push(`src/telegram any: ${counts.telegramAny}/303`);
  }
  if (counts.surfaceAny > 494) {
    details.push(`src/domain/surface any: ${counts.surfaceAny}/494`);
  }
  if (counts.servicesRootAny > 768) {
    details.push(`src/services/*.ts any: ${counts.servicesRootAny}/768`);
  }
  if (details.length === 0) {
    return null;
  }
  return {
    id: 'workspace-hardening-known-blocker',
    label: 'workspace:check remains blocked by global hardening thresholds',
    status: 'warning',
    observed: `${details.length} architecture hardening threshold(s) above budget`,
    target: 'full workspace gate should be green before productization/stable claims',
    details,
  };
}

function countAnyInTree(relativeDir, includeFile) {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) {
    return 0;
  }
  return listFiles(absoluteDir)
    .filter((file) => /\.(ts|tsx)$/u.test(file))
    .filter(includeFile)
    .reduce((sum, file) => {
      const contents = fs.readFileSync(file, 'utf8');
      return sum + (contents.match(/\bany\b/g) || []).length;
    }, 0);
}

function listFiles(absoluteDir) {
  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolute = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      return listFiles(absolute);
    }
    return [absolute];
  });
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

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/');
}
