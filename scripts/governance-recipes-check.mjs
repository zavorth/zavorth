#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'governance-recipes-files',
    label: 'Governance Recipes Intent model files exist',
    target: 'contract, service, API facade, CLI, tests and docs are present',
    files: [
      'src/contracts/GovernanceRecipeContract.ts',
      'src/services/ZavorthGovernanceRecipeService.ts',
      'src/services/ZavorthGovernanceRecipeApiService.ts',
      'scripts/governance-recipes.ts',
      'tests/services/ZavorthGovernanceRecipeService.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'governance-recipe-contract-markers',
    label: 'Governance Recipe contract is complete',
    target: 'recipes include permissions, budget, sandbox, receipts and rollback',
    files: ['src/contracts/GovernanceRecipeContract.ts'],
    needles: [
      'GOVERNANCE_RECIPE_CONTRACT_VERSION',
      'GovernanceRecipePermissionDecision',
      'GovernanceRecipeBudgetDecision',
      'GovernanceRecipeRollbackPlan',
      'GovernanceRecipeExecutionReceipt',
      'dry_run_completed',
      'waiting_approval',
    ],
  }),
  ruleContainsAll({
    id: 'governance-recipe-service-composes-hub',
    label: 'Governance Recipe service composes Capability Hub',
    target: 'recipes plan against Capability Hub targets instead of duplicating catalogs',
    files: ['src/services/ZavorthGovernanceRecipeService.ts'],
    needles: [
      'ZavorthCapabilityHubApiService',
      'safe-channel-activation',
      'governed-skill-run',
      'provider-mcp-readiness',
      'buildPermissionDecision',
      'buildBudgetDecision',
      'buildRollbackPlan',
      'executeDryRun',
    ],
  }),
  ruleContainsAll({
    id: 'governance-recipe-package-scripts',
    label: 'Governance Recipes package scripts exist',
    target: 'npm scripts expose list and gate',
    files: ['package.json'],
    needles: [
      'governance-recipes',
      'governance-recipes:check',
      'qa:governance-recipes',
    ],
  }),
  ruleContainsAll({
    id: 'governance-recipe-cli-flags',
    label: 'Governance Recipes CLI flags exist',
    target: 'CLI exposes plan, dry-run, approval and JSON surfaces',
    files: ['scripts/governance-recipes.ts'],
    needles: [
      '--plan',
      '--dry-run',
      '--approval-id',
      '--json',
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
  console.log('[governance-recipes] checking Intent model');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[governance-recipes] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
