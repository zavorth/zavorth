#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'c8-native-hygiene-convergence-service',
    label: 'C8 native hygiene convergence service exists',
    target: 'AI Gateway convergence is evaluated through a Zavorth-native snapshot',
    files: [
      'src/services/AIGatewayNativeConvergenceService.ts',
      'tests/services/AIGatewayNativeConvergenceService.test.ts',
    ],
  }),
  ruleContainsAll({
    id: 'runtime-attaches-c8-snapshot',
    label: 'runtime attaches C8 snapshot',
    target: 'ZavorthGatewayRuntimeService exposes aiGatewayConvergence from real runtime inputs',
    files: ['src/services/ZavorthGatewayRuntimeService.ts'],
    needles: [
      'aiGatewayConvergence',
      'AIGatewayNativeConvergenceService',
      'agentGateway',
      'agentGatewayHandoff',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-gateway-real-snapshot-consumer',
    label: 'ZavorthControl consumes Agent Gateway snapshot',
    target: '/zavorthControl can render ZavorthAgentGatewaySnapshot instead of rebuilding a parallel runtime',
    files: [
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/adapters/zavorthAgentGatewayZavorthControlAdapter.ts',
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/projections/zavorthAgentGatewayRuntimeProjection.ts',
    ],
    needles: [
      'ZavorthAgentGatewaySnapshot',
      'runObservatory',
      'buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot',
    ],
  }),
  ruleContainsAcross({
    id: 'provider-plane-through-model-picker',
    label: 'provider plane is Model Picker backed',
    target: 'Gateway Control API keeps provider/model state behind ModelPickerContract',
    files: [
      'src/services/ZavorthGatewayRuntimeService.ts',
      'src/services/providers/catalog/ProviderMeshOnboardingProductService.ts',
    ],
    needles: [
      'ModelPickerContract',
      'ProviderControlPlaneService',
      'providerMeshOnboarding',
    ],
  }),
  ruleContainsAcross({
    id: 'budget-route-observability-correlation',
    label: 'budget, route and observability are correlated',
    target: 'agent runs carry budget/route correlation and ZavorthControl reads it',
    files: [
      'src/runtime/agent/AgentRunLlmRouteReceipt.ts',
      'src/zavorth-control/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterRunObservability.ts',
    ],
    needles: [
      'providerRouteBudgetCorrelation',
      'runBudget',
      'resolveCommandCenterProviderRouteBudgetCorrelation',
    ],
  }),
  ruleContainsAcross({
    id: 'proxy-sse-remain-adapters',
    label: 'proxy and SSE remain adapters',
    target: 'transport compatibility is exposed as descriptors, not a new runtime core',
    files: [
      'src/services/ZavorthGatewayRuntimeService.ts',
      'src/services/ZavorthGatewayAgentHandoffAdapterService.ts',
    ],
    needles: [
      'availableTransports',
      'proxy-transport-plane',
      'compatibilityBoundary',
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
  console.log('[zavorth-control-native-convergence] checking C8 convergence');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-control-native-convergence] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
