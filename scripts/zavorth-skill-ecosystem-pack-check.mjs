#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'zavorth-skill-ecosystem-checkpoint-8-files',
    label: 'ZavorthControl controls files exist',
    target: 'contract, importer, permission profile, smoke runner, receipt emitter, pack service, command, SDK export and tests are present',
    files: [
      'src/contracts/ZavorthSkillEcosystemPackContract.ts',
      'src/services/ZavorthSkillEcosystemImporterService.ts',
      'src/services/ZavorthSkillPermissionProfileService.ts',
      'src/services/ZavorthSkillSmokeRunnerService.ts',
      'src/services/ZavorthSkillPackReceiptEmitterService.ts',
      'src/services/ZavorthSkillEcosystemPackService.ts',
      'src/sdk/skill-ecosystem-pack.ts',
      'scripts/zavorth-skill-ecosystem-pack.ts',
      'tests/services/ZavorthSkillEcosystemPackService.test.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'zavorth-skill-ecosystem-contract',
    label: 'Contract captures optional skill ecosystem model',
    target: 'contract includes manifests, permission profiles, SecretRef policy, smoke results and Certification matrix handoff',
    files: ['src/contracts/ZavorthSkillEcosystemPackContract.ts'],
    needles: [
      'ZAVORTH_SKILL_ECOSYSTEM_PACK_CONTRACT_VERSION',
      'ZavorthSkillManifest',
      'ZavorthSkillPermissionProfile',
      'ZavorthSkillSmokeRunnerSnapshot',
      'ZavorthSkillPackReceipt',
      'connector-live-secretref',
      'SecretRef',
      'inspectableBeforeEnablement',
      'Certification matrix - Full Functional Closure',
    ],
  }),
  ruleContainsAcross({
    id: 'zavorth-skill-ecosystem-family-services',
    label: 'Skill ecosystem services are policy-aware',
    target: 'services convert skills into optional manifests, gate permissions, run non-destructive smoke tests and emit receipts',
    files: [
      'src/services/ZavorthSkillEcosystemImporterService.ts',
      'src/services/ZavorthSkillPermissionProfileService.ts',
      'src/services/ZavorthSkillSmokeRunnerService.ts',
      'src/services/ZavorthSkillPackReceiptEmitterService.ts',
      'src/services/ZavorthSkillEcosystemPackService.ts',
    ],
    needles: [
      'connector-calendar-brief',
      'connector-email-draft',
      'connector-issue-triage',
      'owner approval required',
      'missing SecretRef',
      'nonDestructiveOnly',
      'optionalEcosystemCapacity',
      'mcpAcpBridgeOptional',
    ],
  }),
  ruleContainsAll({
    id: 'zavorth-skill-ecosystem-policy',
    label: 'Pack policy keeps skills optional',
    target: 'pack requires inspect-before-enable, non-destructive smoke, owner approval and SecretRef for live skills',
    files: ['src/services/ZavorthSkillEcosystemPackService.ts'],
    needles: [
      'optionalEcosystemCapacity',
      'inspectBeforeEnablement',
      'nonDestructiveSmokeOnly',
      'liveSkillsRequireOwnerApproval',
      'liveSkillsRequireSecretRef',
      'noCoreBloat',
      'Certification matrix - Full Functional Closure',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-zavorth-skill-ecosystem-pack',
    label: 'package exposes ZavorthControl controls gates',
    target: 'operators can inspect, inspect JSON, run check and QA from package scripts',
    files: ['package.json'],
    needles: [
      './sdk/skill-ecosystem-pack',
      'zavorth-skill-ecosystem-pack',
      'zavorth-skill-ecosystem-pack:json',
      'zavorth-skill-ecosystem-pack:check',
      'qa:zavorth-skill-ecosystem-pack',
    ],
  }),
  ruleContainsNoForbiddenNames(),
  runRuntimeRule(),
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
  console.log('[zavorth-skill-ecosystem-pack] checking ZavorthControl controls');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-skill-ecosystem-pack] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 12)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function runRuntimeRule() {
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-skill-ecosystem-pack.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });

  if (result.status !== 0) {
    return {
      id: 'zavorth-skill-ecosystem-runtime-receipt',
      label: 'Runtime ZavorthControl controls receipt passes',
      status: 'failed',
      observed: `exit ${result.status ?? 'unknown'}`,
      target: 'ZavorthControl controls command emits a passing skill ecosystem snapshot',
      details: compactDetails(result.error instanceof Error ? result.error.message : '', result.stderr, result.stdout),
    };
  }

  try {
    const receipt = JSON.parse(result.stdout);
    const pass = receipt.status === 'passed'
      && receipt.summary?.manifests >= 9
      && receipt.summary?.connectorConcepts >= 3
      && receipt.summary?.permissionProfiles >= 5
      && receipt.summary?.smokeTests >= receipt.summary?.manifests
      && receipt.summary?.enabledByDefault === false
      && receipt.summary?.liveSkillsRequireOwnerApproval === true
      && receipt.summary?.liveSkillsRequireSecretRef === true
      && receipt.summary?.nonDestructiveSmokeOnly === true
      && receipt.summary?.liveExternalIoPerformed === false
      && receipt.summary?.secretValuesSerialized === false;
    return {
      id: 'zavorth-skill-ecosystem-runtime-receipt',
      label: 'Runtime ZavorthControl controls receipt passes',
      status: pass ? 'passed' : 'failed',
      observed: `status=${receipt.status}, manifests=${receipt.summary?.manifests}, connectorConcepts=${receipt.summary?.connectorConcepts}`,
      target: 'ZavorthControl controls command emits a passing skill ecosystem snapshot',
      details: [
        `permissionProfiles=${receipt.summary?.permissionProfiles}`,
        `smokeTests=${receipt.summary?.smokeTests}`,
        `receipts=${receipt.summary?.receipts}`,
        `enabledByDefault=${receipt.summary?.enabledByDefault}`,
        `liveSkillsRequireOwnerApproval=${receipt.summary?.liveSkillsRequireOwnerApproval}`,
        `liveSkillsRequireSecretRef=${receipt.summary?.liveSkillsRequireSecretRef}`,
        `nonDestructiveSmokeOnly=${receipt.summary?.nonDestructiveSmokeOnly}`,
        `next=${receipt.commands?.nextStage}`,
      ],
    };
  } catch (error) {
    return {
      id: 'zavorth-skill-ecosystem-runtime-receipt',
      label: 'Runtime ZavorthControl controls receipt passes',
      status: 'failed',
      observed: 'invalid JSON receipt',
      target: 'ZavorthControl controls command emits a passing skill ecosystem snapshot',
      details: [error instanceof Error ? error.message : String(error), ...compactDetails(result.stderr, result.stdout)],
    };
  }
}

function ruleContainsNoForbiddenNames() {
  const forbiddenWord = String.fromCharCode(111, 112, 101, 110, 99, 108, 97, 119);
  const searchRoots = ['src', 'scripts', 'tests', 'package.json'];
  const details = [];
  for (const relative of searchRoots) {
    const absolute = path.join(root, relative);
    for (const file of listFiles(absolute)) {
      const text = fs.readFileSync(file, 'utf8');
      if (containsForbiddenBranding(path.basename(file), forbiddenWord) || containsForbiddenBranding(text, forbiddenWord)) {
        details.push(path.relative(root, file).replace(/\\/g, '/'));
      }
    }
  }
  return {
    id: 'zavorth-skill-ecosystem-no-forbidden-source-name',
    label: 'No forbidden source branding outside reports',
    status: details.length > 0 ? 'failed' : 'passed',
    observed: details.length > 0 ? `${details.length} file(s) with forbidden source branding` : 'no forbidden source branding in code/scripts/tests/package',
    target: 'new ZavorthControl controls code and public surfaces use Zavorth-owned names only',
    details,
  };
}

function containsForbiddenBranding(value, forbiddenWord) {
  return String(value || '').toLowerCase().includes(forbiddenWord);
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

function listFiles(absolute) {
  if (!fs.existsSync(absolute)) return [];
  if (fs.statSync(absolute).isFile()) return [absolute];
  const files = [];
  const stack = [absolute];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'docs') continue;
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(child);
      } else if (/\.(ts|tsx|js|jsx|mjs|cjs|json)$/.test(entry.name) || entry.name === 'package.json') {
        files.push(child);
      }
    }
  }
  return files;
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

function compactDetails(...values) {
  return values
    .flatMap((value) => String(value || '').split(/\r?\n/g))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
}
