#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'release-candidate-pre-canary-files',
    label: 'Pre-Canary Gate files exist',
    target: 'Runtime, CLI, ZavorthControl, tests and docs are present',
    files: [
      'src/runtime/agent/ReleaseCandidatePreCanaryGateService.ts',
      'src/cli/ZavorthCliReleaseCandidatePreCanaryGateRenderer.ts',
      'tests/runtime/agent/ReleaseCandidatePreCanaryGateService.test.ts',
      'tests/runtime/agent/AgentRunServiceReleaseCandidatePreCanaryGate.test.ts',
      'tests/cli/ZavorthCliReleaseCandidatePreCanaryGate.test.ts',
      'tests/ai-gateway/zavorthControl/ZavorthControlReleaseCandidatePreCanaryGate.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'release-candidate-pre-canary-contract',
    label: 'Release Candidate Pre-Canary contract exists',
    target: 'Service gates evidence pack, ecosystem publishing, Autopilot RC and explicit go/no-go without canary/rollout/deploy',
    files: ['src/runtime/agent/ReleaseCandidatePreCanaryGateService.ts'],
    needles: [
      'RELEASE_CANDIDATE_PRE_CANARY_GATE_CONTRACT_VERSION',
      '2026-05-04.pre-canary',
      'ReleaseAdoptionReadinessService',
      'ReleaseCandidateEvidencePack',
      'IntegrationShowcasePartnerSurfaceService',
      'CapabilityAutopilotReleaseCandidateGateService',
      'releaseCandidatePreCanaryGate',
      'noCanaryStarted: true',
      'noRolloutStarted: true',
      'noDeployExecuted: true',
      'noGlobalRolloutEnabled: true',
      'noAutoPromoteEnabled: true',
      'goNoGoRequiresExplicitApproval: true',
      'rollbackPreviewRequired: true',
      'ecosystemClaimsRequireEvidence: true',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-publishes-pre-canary',
    label: 'Agent run publishes pre-canary gate',
    target: 'AgentRunService writes run.metadata.releaseCandidatePreCanaryGate after releaseAdoptionReadiness and exports the contract',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServiceReleaseCandidatePreCanaryGate.test.ts',
    ],
    needles: [
      'ReleaseCandidatePreCanaryGateService',
      'releaseCandidatePreCanaryGate',
      'applyReleaseCandidatePreCanaryGate',
      'RELEASE_CANDIDATE_PRE_CANARY_GATE_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-pre-canary',
    label: 'CLI exposes release candidate pre-canary gate',
    target: 'zavorth release-candidate-pre-canary renders evidence, ecosystem, Autopilot and policy in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliReleaseCandidatePreCanaryGateRenderer.ts',
      'tests/cli/ZavorthCliReleaseCandidatePreCanaryGate.test.ts',
    ],
    needles: [
      'release-candidate-pre-canary',
      'pre-canary-gate',
      'rc-pre-canary',
      'go-no-go',
      'Release Candidate / Pre-Canary Gate - Pre-Canary Gate',
      'resolveReleaseCandidatePreCanaryGateCliText',
      'formatReleaseCandidatePreCanaryGateSnapshot',
    ],
  }),
  ruleContainsAcross({
    id: 'zavorthControl-projects-pre-canary',
    label: 'ZavorthControl projects pre-canary gate',
    target: '/zavorthControl reads releaseCandidatePreCanaryGate and renders evidence, Autopilot and no-canary policy',
    files: [
      'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/contracts/zavorthControlZavorthControlContracts.ts',
      'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/contracts/index.ts',
      'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/adapters/zavorthControlZavorthControlAdapter.ts',
      'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/projections/zavorthControlRuntimeProjection.ts',
      'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/components/ZavorthControlControlShell.tsx',
      'tests/ai-gateway/zavorthControl/ZavorthControlReleaseCandidatePreCanaryGate.test.ts',
    ],
    needles: [
      'ZavorthControlReleaseCandidatePreCanaryGateSnapshot',
      'releaseCandidatePreCanaryGate',
      'buildReleaseCandidatePreCanaryGate',
      'mapReleaseCandidatePreCanaryGate',
      'Release Candidate / Pre-Canary',
      'policy.noCanaryStarted',
      'policy.noRolloutStarted',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-pre-canary-gate',
    label: 'package exposes Pre-Canary Gate gate',
    target: 'local QA can run release-candidate-pre-canary:check and qa:release-candidate-pre-canary',
    files: ['package.json'],
    needles: [
      'release-candidate-pre-canary:check',
      'qa:release-candidate-pre-canary',
      'scripts/release-candidate-pre-canary-check.mjs',
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
  console.log('[release-candidate-pre-canary] checking Pre-Canary Gate');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[release-candidate-pre-canary] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
