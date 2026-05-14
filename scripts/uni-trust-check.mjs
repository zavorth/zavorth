#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'uni-trust-files',
    label: 'Wave 44 files exist',
    target: 'Runtime, CLI, Command Center, tests and docs are present',
    files: [
      'src/runtime/agent/UniversalIntentTrustEnforcementService.ts',
      'src/cli/ZavorthCliUniversalIntentTrustRenderer.ts',
      'tests/runtime/agent/UniversalIntentTrustEnforcementService.test.ts',
      'tests/runtime/agent/AgentRunServiceUniversalIntentTrust.test.ts',
      'tests/cli/ZavorthCliUniversalIntentTrust.test.ts',
      'tests/ai-gateway/control/CommandCenterUniversalIntentTrust.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'uni-trust-contract',
    label: 'UNI and Trust Slider share one enforcement snapshot',
    target: 'UniversalIntentTrustEnforcementSnapshot links UniversalIntentService, permission narrative and TrustSliderPolicyService',
    files: ['src/runtime/agent/UniversalIntentTrustEnforcementService.ts'],
    needles: [
      'UNIVERSAL_INTENT_TRUST_ENFORCEMENT_CONTRACT_VERSION',
      '2026-05-04.wave-44',
      'UniversalIntentService',
      'TrustSliderPolicyDecision',
      'ConversationalPermissionService',
      'NaturalClarificationPolicyService',
      'trustSliderEnforcedBeforeExecutor',
      'hostScopeRequiresOverlord',
      'secretsSerialized: false',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-uses-uni-trust',
    label: 'Agent run publishes UNI / Trust enforcement',
    target: 'AgentRunService writes universalIntentTrustEnforcement before executor and exports the contract',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServiceUniversalIntentTrust.test.ts',
    ],
    needles: [
      'UniversalIntentTrustEnforcementService',
      'universalIntentTrustEnforcement',
      'applyUniversalIntentTrustEnforcement',
      'UNIVERSAL_INTENT_TRUST_ENFORCEMENT_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-uni-trust',
    label: 'CLI exposes UNI / Trust Slider enforcement',
    target: 'zavorth uni and trust-slider render intent, permission and trust gates',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliUniversalIntentTrustRenderer.ts',
      'tests/cli/ZavorthCliUniversalIntentTrust.test.ts',
    ],
    needles: [
      'uni',
      'trust-slider',
      'UNI / Trust Slider Enforcement - Wave 44',
      'resolveUniversalIntentTrustCliText',
      'formatUniversalIntentTrustSnapshot',
      'zavorth uni',
    ],
  }),
  ruleContainsAcross({
    id: 'command-center-projects-uni-trust',
    label: 'Command Center projects UNI / Trust enforcement',
    target: '/control reads universalIntentTrustEnforcement and renders overview/config surfaces',
    files: [
      'src/ai-gateway/app/(dashboard)/control/command-center/contracts/dashboardCommandCenterContracts.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterControlShell.tsx',
      'tests/ai-gateway/control/CommandCenterUniversalIntentTrust.test.ts',
    ],
    needles: [
      'DashboardUniversalIntentTrustEnforcementSnapshot',
      'universalIntentTrustEnforcement',
      'buildUniversalIntentTrustEnforcement',
      'mapUniversalIntentTrustEnforcement',
      'UNI / Trust',
      'summary.trustLevel',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-uni-trust-gate',
    label: 'package exposes Wave 44 gate',
    target: 'local QA can run uni-trust:check and qa:uni-trust',
    files: ['package.json'],
    needles: [
      'uni-trust:check',
      'qa:uni-trust',
      'scripts/uni-trust-check.mjs',
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
  console.log('[uni-trust] checking Wave 44');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[uni-trust] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
