#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'zavorth-qa-security-release-checkpoint-7-files',
    label: 'Surface controls files exist',
    target: 'contract, five family services, runner, command, SDK export and tests are present',
    files: [
      'src/contracts/ZavorthQaSecurityReleaseCertificationContract.ts',
      'src/services/ZavorthQaScenarioImporterService.ts',
      'src/services/ZavorthSecurityCertificationCheckService.ts',
      'src/services/ZavorthReleaseAcceptanceCheckService.ts',
      'src/services/ZavorthWorkflowSemanticCheckService.ts',
      'src/services/ZavorthPatchRiskLedgerService.ts',
      'src/services/ZavorthQaSecurityReleaseCertificationPackService.ts',
      'src/sdk/qa-security-release-certification-pack.ts',
      'scripts/zavorth-qa-security-release-certification-pack.ts',
      'tests/services/ZavorthQaSecurityReleaseCertificationPackService.test.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'zavorth-qa-security-release-contract',
    label: 'Contract captures Surface controls certification model',
    target: 'contract includes family ids, pass/warn/fail receipts, policies and ZavorthControl controls handoff',
    files: ['src/contracts/ZavorthQaSecurityReleaseCertificationContract.ts'],
    needles: [
      'ZAVORTH_QA_SECURITY_RELEASE_CERTIFICATION_CONTRACT_VERSION',
      'qa-scenarios',
      'security',
      'release-acceptance',
      'workflow-semantics',
      'patch-risk',
      'functional-parity',
      'ZavorthFunctionalParityCertificationRunnerSnapshot',
      'dependencyPatchesAcceptedSilently',
      'rawWorkflowYamlCopied',
      'ZavorthControl controls - Skill Ecosystem Pack',
    ],
  }),
  ruleContainsAcross({
    id: 'zavorth-qa-security-release-family-services',
    label: 'Family services are runnable and local-first',
    target: 'family services cover QA scenarios, security controls, release acceptance, workflow semantics and patch risk',
    files: [
      'src/services/ZavorthQaScenarioImporterService.ts',
      'src/services/ZavorthSecurityCertificationCheckService.ts',
      'src/services/ZavorthReleaseAcceptanceCheckService.ts',
      'src/services/ZavorthWorkflowSemanticCheckService.ts',
      'src/services/ZavorthPatchRiskLedgerService.ts',
      'src/services/ZavorthQaSecurityReleaseCertificationPackService.ts',
    ],
    needles: [
      'provider-runtime-activation:check',
      'privacy:scan',
      'release-certification-hardening:check',
      'rawWorkflowYamlCopied: false',
      'dependencyPatchAcceptedSilently: false',
      'owner-decision-required',
      'printableLines',
    ],
  }),
  ruleContainsAll({
    id: 'zavorth-qa-security-release-policy',
    label: 'Pack policy blocks silent risky behavior',
    target: 'runner emits local artifact-first policy and no live provider/channel execution',
    files: ['src/services/ZavorthQaSecurityReleaseCertificationPackService.ts'],
    needles: [
      'localChecksOnly',
      'noRawWorkflowYamlCopy',
      'dependencyPatchesNeedReceipt',
      'noLiveProviderCalls',
      'noLiveChannelSends',
      'artifactFirstReceipts',
      'ZavorthControl controls - Skill Ecosystem Pack',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-zavorth-qa-security-release-pack',
    label: 'package exposes Surface controls gates',
    target: 'operators can inspect, inspect JSON, run check and QA from package scripts',
    files: ['package.json'],
    needles: [
      './sdk/qa-security-release-certification-pack',
      'zavorth-qa-security-release-certification-pack',
      'zavorth-qa-security-release-certification-pack:json',
      'zavorth-qa-security-release-certification-pack:check',
      'qa:zavorth-qa-security-release-certification-pack',
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
  console.log('[zavorth-qa-security-release-certification-pack] checking Surface controls');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-qa-security-release-certification-pack] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
    'scripts/zavorth-qa-security-release-certification-pack.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });

  if (result.status !== 0) {
    return {
      id: 'zavorth-qa-security-release-runtime-receipt',
      label: 'Runtime Surface controls receipt passes',
      status: 'failed',
      observed: `exit ${result.status ?? 'unknown'}`,
      target: 'Surface controls command emits a passing QA/security/release snapshot',
      details: compactDetails(result.error instanceof Error ? result.error.message : '', result.stderr, result.stdout),
    };
  }

  try {
    const receipt = JSON.parse(result.stdout);
    const pass = receipt.status === 'passed'
      && receipt.summary?.families === 6
      && receipt.summary?.failFamilies === 0
      && receipt.summary?.dependencyPatchesAcceptedSilently === false
      && receipt.summary?.rawWorkflowYamlCopied === false
      && receipt.summary?.liveExternalIoPerformed === false;
    return {
      id: 'zavorth-qa-security-release-runtime-receipt',
      label: 'Runtime Surface controls receipt passes',
      status: pass ? 'passed' : 'failed',
      observed: `status=${receipt.status}, families=${receipt.summary?.families}, failFamilies=${receipt.summary?.failFamilies}`,
      target: 'Surface controls command emits a passing QA/security/release snapshot',
      details: [
        `scenariosImported=${receipt.summary?.scenariosImported}`,
        `securityChecks=${receipt.summary?.securityChecks}`,
        `releaseChecks=${receipt.summary?.releaseChecks}`,
        `workflowChecks=${receipt.summary?.workflowChecks}`,
        `patchRisksTracked=${receipt.summary?.patchRisksTracked}`,
        `rawWorkflowYamlCopied=${receipt.summary?.rawWorkflowYamlCopied}`,
        `dependencyPatchesAcceptedSilently=${receipt.summary?.dependencyPatchesAcceptedSilently}`,
        `next=${receipt.commands?.nextStage}`,
      ],
    };
  } catch (error) {
    return {
      id: 'zavorth-qa-security-release-runtime-receipt',
      label: 'Runtime Surface controls receipt passes',
      status: 'failed',
      observed: 'invalid JSON receipt',
      target: 'Surface controls command emits a passing QA/security/release snapshot',
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
    id: 'zavorth-qa-security-release-no-forbidden-source-name',
    label: 'No forbidden source branding outside reports',
    status: details.length > 0 ? 'failed' : 'passed',
    observed: details.length > 0 ? `${details.length} file(s) with forbidden source branding` : 'no forbidden source branding in code/scripts/tests/package',
    target: 'new Surface controls code and public surfaces use Zavorth-owned names only',
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
