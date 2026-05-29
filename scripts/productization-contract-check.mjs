#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'c9-productization-contract-service',
    label: 'C9 productization contract service exists',
    target: 'Productization is represented by one reusable ZavorthProductizationContractSnapshot',
    files: [
      'src/services/ZavorthProductizationContractService.ts',
      'tests/services/ZavorthProductizationContractService.test.ts',
    ],
  }),
  ruleContainsAll({
    id: 'control-contract-items',
    label: '/zavorthControl required C9 items are modeled',
    target: '/zavorthControl can show mode, trust, permissions, approvals, receipts, sandbox, provider route and capabilities',
    files: ['src/services/ZavorthProductizationContractService.ts'],
    needles: [
      'experience-mode',
      'trust-posture',
      'active-permissions',
      'pending-approvals',
      'run-receipts',
      'sandbox-posture',
      'provider-route',
      'capabilities',
    ],
  }),
  ruleContainsAcross({
    id: 'runtime-attaches-c9-snapshot',
    label: 'runtime attaches C9 snapshot',
    target: 'ZavorthGatewayRuntimeService exposes productization from real runtime inputs',
    files: ['src/services/ZavorthGatewayRuntimeService.ts'],
    needles: [
      'productization',
      'ZavorthProductizationContractService',
      'firstRunOnboardingContract',
      'websitePublicContract',
      'sandboxControlPlane',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-renders-same-contract',
    label: 'CLI renders the same contract',
    target: 'zavorth productization renders ZavorthProductizationContractSnapshot in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliProductizationRenderer.ts',
      'src/cli/ZavorthCliCommandHelpers.ts',
    ],
    needles: [
      'productization',
      'formatZavorthProductizationContractSnapshot',
      'zavorth productization --json',
      'ZavorthProductizationContractService',
    ],
  }),
  ruleContainsAll({
    id: 'control-renders-c9-contract',
    label: '/zavorthControl renders C9 contract',
    target: 'ZavorthControl shows the productization snapshot instead of hiding C9 in runtime JSON',
    files: ['src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/components/ZavorthControlGatewayConsole.tsx'],
    needles: [
      'Productization C9',
      'model.runtime?.productization',
      'productizationItems',
      'productizationAreas',
    ],
  }),
  ruleContainsAcross({
    id: 'onboarding-docs-website-covered',
    label: 'onboarding, docs and website are covered',
    target: 'C9 checks first-run onboarding, docs paths and website promise policy',
    files: [
      'src/services/ZavorthProductizationContractService.ts',
      'docs/README.md',
    ],
    needles: [
      'FirstRunOnboardingContractSnapshot',
      'WebsitePublicContractSnapshot',
      'stable-or-preview-only',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-productization-gate',
    label: 'package exposes C9 gate',
    target: 'local QA can run productization:check and qa:productization',
    files: ['package.json'],
    needles: [
      'productization:check',
      'qa:productization',
      'scripts/productization-contract-check.mjs',
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
  console.log('[productization-contract] checking C9 productization');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[productization-contract] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
