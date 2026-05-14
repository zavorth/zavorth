#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'public-sync-files',
    label: 'Wave 49 files exist',
    target: 'Runtime, CLI, Command Center, tests and docs are present',
    files: [
      'src/runtime/agent/PublicSiteDocsDemoSyncService.ts',
      'src/cli/ZavorthCliPublicSiteDocsDemoSyncRenderer.ts',
      'tests/runtime/agent/PublicSiteDocsDemoSyncService.test.ts',
      'tests/runtime/agent/AgentRunServicePublicSiteDocsDemoSync.test.ts',
      'tests/cli/ZavorthCliPublicSiteDocsDemoSync.test.ts',
      'tests/ai-gateway/control/CommandCenterPublicSiteDocsDemoSync.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'public-sync-contract',
    label: 'Public Site Docs Demo Sync contract exists',
    target: 'PublicSiteDocsDemoSyncService links release path, website, docs, demo and release bundle without public side effects',
    files: ['src/runtime/agent/PublicSiteDocsDemoSyncService.ts'],
    needles: [
      'PUBLIC_SITE_DOCS_DEMO_SYNC_CONTRACT_VERSION',
      '2026-05-04.wave-49',
      'ReleaseInstallerRollbackPathService',
      'WebsitePublicContractService',
      'PublicDemoContractService',
      'PublicDocsRecipesService',
      'PublicReleaseBundleContractService',
      'publicSiteDocsDemoSync',
      'noWebsiteBuildExecuted: true',
      'noPublicDeployExecuted: true',
      'noDemoLiveExecution: true',
      'noStableClaimPublished: true',
      'canAnnounceStable: false',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-publishes-public-sync',
    label: 'Agent run publishes public sync',
    target: 'AgentRunService writes run.metadata.publicSiteDocsDemoSync after Release Installer Rollback Path and exports the contract',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServicePublicSiteDocsDemoSync.test.ts',
    ],
    needles: [
      'PublicSiteDocsDemoSyncService',
      'publicSiteDocsDemoSync',
      'applyPublicSiteDocsDemoSync',
      'PUBLIC_SITE_DOCS_DEMO_SYNC_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-public-sync',
    label: 'CLI exposes public sync',
    target: 'zavorth public-sync renders website, docs, demo and release sync in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliPublicSiteDocsDemoSyncRenderer.ts',
      'tests/cli/ZavorthCliPublicSiteDocsDemoSync.test.ts',
    ],
    needles: [
      'public-sync',
      'site-docs-demo',
      'public-site-sync',
      'docs-demo-sync',
      'Public Site / Docs / Demo Sync - Wave 49',
      'resolvePublicSiteDocsDemoSyncCliText',
      'formatPublicSiteDocsDemoSyncSnapshot',
    ],
  }),
  ruleContainsAcross({
    id: 'command-center-projects-public-sync',
    label: 'Command Center projects public sync',
    target: '/control reads publicSiteDocsDemoSync and renders public preview policy',
    files: [
      'src/ai-gateway/app/(dashboard)/control/command-center/contracts/dashboardCommandCenterContracts.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterControlShell.tsx',
      'tests/ai-gateway/control/CommandCenterPublicSiteDocsDemoSync.test.ts',
    ],
    needles: [
      'DashboardPublicSiteDocsDemoSyncSnapshot',
      'publicSiteDocsDemoSync',
      'buildPublicSiteDocsDemoSync',
      'mapPublicSiteDocsDemoSync',
      'Public Site / Docs / Demo Sync',
      'policy.noStableClaimPublished',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-public-sync-gate',
    label: 'package exposes Wave 49 gate',
    target: 'local QA can run public-sync:check and qa:public-sync',
    files: ['package.json'],
    needles: [
      'public-sync:check',
      'qa:public-sync',
      'scripts/public-site-docs-demo-sync-check.mjs',
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
  console.log('[public-sync] checking Wave 49');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[public-sync] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
