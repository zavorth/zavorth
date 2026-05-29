#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'integration-showcase-partner-surface-files',
    label: 'Integration Showcase files exist',
    target: 'Runtime, CLI, ZavorthControl, tests and docs are present',
    files: [
      'src/runtime/agent/IntegrationShowcasePartnerSurfaceService.ts',
      'src/cli/ZavorthCliIntegrationShowcasePartnerSurfaceRenderer.ts',
      'tests/runtime/agent/IntegrationShowcasePartnerSurfaceService.test.ts',
      'tests/runtime/agent/AgentRunServiceIntegrationShowcasePartnerSurface.test.ts',
      'tests/cli/ZavorthCliIntegrationShowcasePartnerSurface.test.ts',
      'tests/ai-gateway/zavorthControl/ZavorthControlIntegrationShowcasePartnerSurface.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'integration-showcase-partner-surface-contract',
    label: 'Integration Showcase Partner Surface contract exists',
    target: 'Service links public adoption pilot loop and IntegrationShowcaseService without network, secrets or partner claims',
    files: ['src/runtime/agent/IntegrationShowcasePartnerSurfaceService.ts'],
    needles: [
      'INTEGRATION_SHOWCASE_PARTNER_SURFACE_CONTRACT_VERSION',
      '2026-05-04.integration-showcase',
      'PublicAdoptionPilotLoopService',
      'IntegrationShowcaseService',
      'integrationShowcasePartnerSurface',
      'noFormalPartnerClaimWithoutRegistry: true',
      'noCredentialRequiredForFixture: true',
      'noNetworkRequiredForFixture: true',
      'noExternalMutation: true',
      'partnerSurfaceAuditable: true',
      'naturalLanguageDoesNotBypassPolicy: true',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-publishes-integration-showcase',
    label: 'Agent run publishes integration showcase partner surface',
    target: 'AgentRunService writes run.metadata.integrationShowcasePartnerSurface after publicAdoptionPilotLoop and exports the contract',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServiceIntegrationShowcasePartnerSurface.test.ts',
    ],
    needles: [
      'IntegrationShowcasePartnerSurfaceService',
      'integrationShowcasePartnerSurface',
      'applyIntegrationShowcasePartnerSurface',
      'INTEGRATION_SHOWCASE_PARTNER_SURFACE_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-integration-showcase',
    label: 'CLI exposes integration showcase partner surface',
    target: 'zavorth integration-showcase-partner-surface renders vendors, fixtures and partner policy in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliIntegrationShowcasePartnerSurfaceRenderer.ts',
      'tests/cli/ZavorthCliIntegrationShowcasePartnerSurface.test.ts',
    ],
    needles: [
      'integration-showcase-partner-surface',
      'integration-showcase-runtime',
      'partner-surface',
      'showcase-partners',
      'Integration Showcase / Partner Surface - Integration Showcase',
      'resolveIntegrationShowcasePartnerSurfaceCliText',
      'formatIntegrationShowcasePartnerSurfaceSnapshot',
    ],
  }),
  ruleContainsAcross({
    id: 'zavorthControl-projects-integration-showcase',
    label: 'ZavorthControl projects integration showcase',
    target: '/zavorthControl reads integrationShowcasePartnerSurface and renders fixture-first partner policy',
    files: [
      'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/contracts/zavorthControlZavorthControlContracts.ts',
      'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/contracts/index.ts',
      'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/adapters/zavorthControlZavorthControlAdapter.ts',
      'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/projections/zavorthControlRuntimeProjection.ts',
      'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/components/ZavorthControlControlShell.tsx',
      'tests/ai-gateway/zavorthControl/ZavorthControlIntegrationShowcasePartnerSurface.test.ts',
    ],
    needles: [
      'ZavorthControlIntegrationShowcasePartnerSurfaceSnapshot',
      'integrationShowcasePartnerSurface',
      'buildIntegrationShowcasePartnerSurface',
      'mapIntegrationShowcasePartnerSurface',
      'Integration Showcase / Partner Surface',
      'policy.noCredentialRequiredForFixture',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-integration-showcase-gate',
    label: 'package exposes Integration Showcase gate',
    target: 'local QA can run integration-showcase-partner-surface:check and qa:integration-showcase-partner-surface',
    files: ['package.json'],
    needles: [
      'integration-showcase-partner-surface:check',
      'qa:integration-showcase-partner-surface',
      'scripts/integration-showcase-partner-surface-check.mjs',
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
  console.log('[integration-showcase-partner-surface] checking Integration Showcase');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[integration-showcase-partner-surface] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
