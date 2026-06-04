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
      'functional-consistency',
      'ZavorthFunctionalReleaseCertificationRunnerSnapshot',
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
