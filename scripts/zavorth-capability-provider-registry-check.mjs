#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const rules = [
  ruleFilesExist(),
  ruleContainsMarkers(),
  runCapabilityProviderFixture(),
  runCapabilityProviderBlockedFixture(),
];

const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: { rules: rules.length, passed: rules.length - failed.length, failed: failed.length },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-capability-provider-registry] checking Connector registry');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-capability-provider-registry] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 16)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthCapabilityProviderRegistryContract.ts',
    'src/services/ZavorthCapabilityProviderRegistryService.ts',
    'scripts/zavorth-capability-provider-registry.ts',
    'scripts/zavorth-capability-provider-registry-check.mjs',
    'tests/services/ZavorthCapabilityProviderRegistryService.test.ts',
    'docs/README.md',
    'docs/README.md',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'checkpoint-4-files',
    label: 'Connector registry capability provider files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'contract, service, CLI, check, tests, docs and package scripts are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthCapabilityProviderRegistryContract.ts', [
      'ZAVORTH_CAPABILITY_PROVIDER_REGISTRY_CONTRACT_VERSION',
      'zavorth-capability-provider-registry/4',
      'approval-required',
      'honest-unavailable',
      'directExposureAllowed: false',
    ]],
    ['src/services/ZavorthCapabilityProviderRegistryService.ts', [
      'normalizeCapability',
      'importSkillManifest',
      'classifyToolRisk',
      'buildZavorthControlProjection',
      'dangerous-capabilities-require-approval',
      'quarantined-capabilities-cannot-expose-tools',
      'unavailable-capabilities-fail-honestly',
    ]],
    ['docs/README.md', [
      'capability-providers-ready',
      '291 Credential vault - Channels And Messaging',
      'Zavorth Capability Provider Registry',
    ]],
    ['docs/README.md', [
      'capability-providers-complete',
      'Zavorth Capability Provider Registry',
      'honest-unavailable',
      'no direct tool exposure',
      '291 Credential vault - Channels And Messaging',
    ]],
    ['package.json', [
      'zavorth:capability-provider-registry',
      'zavorth:capability-provider-registry:check',
    ]],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    if (text === null) {
      missing.push(`missing ${file}`);
      continue;
    }
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return {
    id: 'checkpoint-4-markers',
    label: 'Connector registry capability provider markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'provider registry, policy, unavailable semantics, docs and scripts markers are present',
    details: missing,
  };
}

function runCapabilityProviderFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-capability-provider-registry.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return {
      id: 'checkpoint-4-capability-provider-fixture',
      label: 'Capability provider registry fixture passes',
      status: 'failed',
      observed: `exit ${result.status}`,
      target: 'default capability provider snapshot is capability-provider-registry-ready',
      details: [result.error?.message || result.stderr || result.stdout || 'no output'],
    };
  }
  const snapshot = parseJson(result.stdout);
  const ok = snapshot
    && snapshot.status === 'capability-provider-registry-ready'
    && snapshot.contractVersion === 'zavorth-capability-provider-registry/4'
    && snapshot.summary?.normalizedCapabilities >= 5
    && snapshot.summary?.importedSkillManifests >= 1
    && snapshot.summary?.classifiedTools >= 3
    && snapshot.summary?.approvalRequiredCapabilities >= 3
    && snapshot.summary?.quarantinedCapabilities >= 1
    && snapshot.summary?.unavailableCapabilities >= 1
    && snapshot.summary?.directToolExposureAllowed === 0
    && snapshot.summary?.dangerousCapabilitiesApprovalGated >= 2
    && snapshot.summary?.unavailableCapabilitiesFailHonestly >= 1
    && snapshot.safety?.noToolExposurePerformed === true
    && snapshot.safety?.noSkillMutationPerformed === true;
  return {
    id: 'checkpoint-4-capability-provider-fixture',
    label: 'Capability provider registry fixture passes',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, ${snapshot.summary.normalizedCapabilities} capability(ies), ${snapshot.summary.classifiedTools} tool(s)` : 'invalid capability provider snapshot',
    target: 'default registry snapshot is ready with policy gates and honest unavailable semantics',
    details: ok ? [] : [result.stdout],
  };
}

function runCapabilityProviderBlockedFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-capability-provider-registry.ts',
    '--json',
    '--sidecar-adapter-status',
    'blocked',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot
    && snapshot.status === 'blocked'
    && snapshot.previousSidecarAdapterStatus === 'blocked';
  return {
    id: 'checkpoint-4-blocked-fixture',
    label: 'Capability provider registry blocks without Approval gate readiness',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, sidecarAdapter=${snapshot.previousSidecarAdapterStatus}` : `exit ${result.status}`,
    target: 'Connector registry cannot advance while Approval gate sidecar adapter is blocked',
    details: ok ? [] : [result.error?.message || result.stderr || result.stdout || 'no output'],
  };
}

function read(file) {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8');
  } catch {
    return null;
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
