#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'release-adoption-readiness-files',
    label: 'Release Adoption Readiness files exist',
    target: 'Runtime, CLI, Dashboard, tests and docs are present',
    files: [
      'src/runtime/agent/ReleaseAdoptionReadinessService.ts',
      'src/cli/ZavorthCliReleaseAdoptionReadinessRenderer.ts',
      'tests/runtime/agent/ReleaseAdoptionReadinessService.test.ts',
      'tests/runtime/agent/AgentRunServiceReleaseAdoptionReadiness.test.ts',
      'tests/cli/ZavorthCliReleaseAdoptionReadiness.test.ts',
      'tests/ai-gateway/dashboard/DashboardReleaseAdoptionReadiness.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'release-adoption-readiness-contract',
    label: 'Release Adoption Readiness contract exists',
    target: 'Service links release train, public adoption, support loop and feedback without deploy/canary/telemetry',
    files: ['src/runtime/agent/ReleaseAdoptionReadinessService.ts'],
    needles: [
      'RELEASE_ADOPTION_READINESS_CONTRACT_VERSION',
      '2026-05-04.release-readiness',
      'ReleaseTrainService',
      'PublicAdoptionReadinessService',
      'releaseAdoptionReadiness',
      'noDeployExecuted: true',
      'noTelemetryEnabled: true',
      'noImplicitCollection: true',
      'noCanaryStarted: true',
      'releaseRequiresRollbackPreview: true',
      'adoptionMetricsAggregatedOnly: true',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-publishes-release-adoption',
    label: 'Agent run publishes release adoption readiness',
    target: 'AgentRunService writes run.metadata.releaseAdoptionReadiness after integrationShowcasePartnerSurface and exports the contract',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServiceReleaseAdoptionReadiness.test.ts',
    ],
    needles: [
      'ReleaseAdoptionReadinessService',
      'releaseAdoptionReadiness',
      'applyReleaseAdoptionReadiness',
      'RELEASE_ADOPTION_READINESS_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-release-adoption',
    label: 'CLI exposes release adoption readiness',
    target: 'zavorth release-adoption-readiness renders release train, adoption score, support and policy in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliReleaseAdoptionReadinessRenderer.ts',
      'tests/cli/ZavorthCliReleaseAdoptionReadiness.test.ts',
    ],
    needles: [
      'release-adoption-readiness',
      'release-adoption',
      'adoption-readiness',
      'support-readiness',
      'Release & Adoption Readiness - Release Adoption Readiness',
      'resolveReleaseAdoptionReadinessCliText',
      'formatReleaseAdoptionReadinessSnapshot',
    ],
  }),
  ruleContainsAcross({
    id: 'dashboard-projects-release-adoption',
    label: 'Dashboard projects release adoption readiness',
    target: '/dashboard reads releaseAdoptionReadiness and renders release/adoption policy',
    files: [
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/contracts/dashboardDashboardContracts.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/contracts/index.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/adapters/dashboardDashboardAdapter.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/dashboardRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/components/DashboardControlShell.tsx',
      'tests/ai-gateway/dashboard/DashboardReleaseAdoptionReadiness.test.ts',
    ],
    needles: [
      'DashboardReleaseAdoptionReadinessSnapshot',
      'releaseAdoptionReadiness',
      'buildReleaseAdoptionReadiness',
      'mapReleaseAdoptionReadiness',
      'Release & Adoption Readiness',
      'policy.noCanaryStarted',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-release-adoption-gate',
    label: 'package exposes Release Adoption Readiness gate',
    target: 'local QA can run release-adoption-readiness:check and qa:release-adoption-readiness',
    files: ['package.json'],
    needles: [
      'release-adoption-readiness:check',
      'qa:release-adoption-readiness',
      'scripts/release-adoption-readiness-check.mjs',
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
  console.log('[release-adoption-readiness] checking Release Adoption Readiness');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[release-adoption-readiness] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
