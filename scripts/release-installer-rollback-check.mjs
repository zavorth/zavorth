#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'release-path-files',
    label: 'Channel mesh8 files exist',
    target: 'Runtime, CLI, ZavorthControl, tests and docs are present',
    files: [
      'src/runtime/agent/ReleaseInstallerRollbackPathService.ts',
      'src/cli/ZavorthCliReleaseInstallerRollbackRenderer.ts',
      'tests/runtime/agent/ReleaseInstallerRollbackPathService.test.ts',
      'tests/runtime/agent/AgentRunServiceReleaseInstallerRollbackPath.test.ts',
      'tests/cli/ZavorthCliReleaseInstallerRollback.test.ts',
      'tests/ai-gateway/zavorthControl/ZavorthControlReleaseInstallerRollbackPath.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'release-path-contract',
    label: 'Release Installer Rollback contract exists',
    target: 'ReleaseInstallerRollbackPathService links Product Entry, Productization Evidence, Public Release Bundle, installer preview and rollback preview',
    files: ['src/runtime/agent/ReleaseInstallerRollbackPathService.ts'],
    needles: [
      'RELEASE_INSTALLER_ROLLBACK_PATH_CONTRACT_VERSION',
      '2026-05-04.release-rollback',
      'ProductEntryRuntimeService',
      'ProductizationEvidenceService',
      'PublicReleaseBundleContractService',
      'releaseInstallerRollbackPath',
      'noReleasePublished: true',
      'noInstallerExecuted: true',
      'noCanaryStarted: true',
      'noStableTagMoved: true',
      'rollbackRequiresExplicitCommand: true',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-publishes-release-path',
    label: 'Agent run publishes release path',
    target: 'AgentRunService writes run.metadata.releaseInstallerRollbackPath after Product Entry Runtime and exports the contract',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServiceReleaseInstallerRollbackPath.test.ts',
    ],
    needles: [
      'ReleaseInstallerRollbackPathService',
      'releaseInstallerRollbackPath',
      'applyReleaseInstallerRollbackPath',
      'RELEASE_INSTALLER_ROLLBACK_PATH_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-release-path',
    label: 'CLI exposes release path',
    target: 'zavorth release-path renders release, installer and rollback readiness in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliReleaseInstallerRollbackRenderer.ts',
      'tests/cli/ZavorthCliReleaseInstallerRollback.test.ts',
    ],
    needles: [
      'release-path',
      'release-installer',
      'installer-rollback',
      'Release / Installer / Rollback Path - Channel mesh8',
      'resolveReleaseInstallerRollbackCliText',
      'formatReleaseInstallerRollbackSnapshot',
    ],
  }),
  ruleContainsAcross({
    id: 'zavorthControl-projects-release-path',
    label: 'ZavorthControl projects release path',
    target: '/zavorthControl reads releaseInstallerRollbackPath and renders release/installer/rollback policy',
    files: [
      'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/contracts/zavorthControlZavorthControlContracts.ts',
      'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/adapters/zavorthControlZavorthControlAdapter.ts',
      'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/projections/zavorthControlRuntimeProjection.ts',
      'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/components/ZavorthControlControlShell.tsx',
      'tests/ai-gateway/zavorthControl/ZavorthControlReleaseInstallerRollbackPath.test.ts',
    ],
    needles: [
      'ZavorthControlReleaseInstallerRollbackPathSnapshot',
      'releaseInstallerRollbackPath',
      'buildReleaseInstallerRollbackPath',
      'mapReleaseInstallerRollbackPath',
      'Release / Installer / Rollback',
      'policy.noReleasePublished',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-release-path-gate',
    label: 'package exposes Channel mesh8 gate',
    target: 'local QA can run release-path:check and qa:release-path',
    files: ['package.json'],
    needles: [
      'release-path:check',
      'qa:release-path',
      'scripts/release-installer-rollback-check.mjs',
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
  console.log('[release-path] checking Channel mesh8');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[release-path] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
