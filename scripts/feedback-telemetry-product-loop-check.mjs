#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'feedback-product-loop-files',
    label: 'Feedback Telemetry files exist',
    target: 'Runtime, CLI, ZavorthControl, tests and docs are present',
    files: [
      'src/runtime/agent/FeedbackTelemetryProductLoopService.ts',
      'src/cli/ZavorthCliFeedbackTelemetryProductLoopRenderer.ts',
      'tests/runtime/agent/FeedbackTelemetryProductLoopService.test.ts',
      'tests/runtime/agent/AgentRunServiceFeedbackTelemetryProductLoop.test.ts',
      'tests/cli/ZavorthCliFeedbackTelemetryProductLoop.test.ts',
      'tests/ai-gateway/zavorthControl/ZavorthControlFeedbackTelemetryProductLoop.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'feedback-product-loop-contract',
    label: 'Feedback Telemetry Product Loop contract exists',
    target: 'FeedbackTelemetryProductLoopService links public sync and feedback telemetry with opt-in-only policy',
    files: ['src/runtime/agent/FeedbackTelemetryProductLoopService.ts'],
    needles: [
      'FEEDBACK_TELEMETRY_PRODUCT_LOOP_CONTRACT_VERSION',
      '2026-05-04.feedback-telemetry',
      'PublicSiteDocsDemoSyncService',
      'FeedbackTelemetryContractService',
      'feedbackTelemetryProductLoop',
      'noTelemetryEnabled: true',
      'noFeedbackSent: true',
      'noExternalNetworkCall: true',
      'noRawPayloadSerialized: true',
      'noConsentAssumed: true',
      'revokeDeleteAvailable: true',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-publishes-feedback-product-loop',
    label: 'Agent run publishes feedback product loop',
    target: 'AgentRunService writes run.metadata.feedbackTelemetryProductLoop after public sync and exports the contract',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServiceFeedbackTelemetryProductLoop.test.ts',
    ],
    needles: [
      'FeedbackTelemetryProductLoopService',
      'feedbackTelemetryProductLoop',
      'applyFeedbackTelemetryProductLoop',
      'FEEDBACK_TELEMETRY_PRODUCT_LOOP_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-feedback-product-loop',
    label: 'CLI exposes feedback product loop',
    target: 'zavorth feedback-product-loop renders opt-in, redaction preview, revoke/delete and local ledger',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliFeedbackTelemetryProductLoopRenderer.ts',
      'tests/cli/ZavorthCliFeedbackTelemetryProductLoop.test.ts',
    ],
    needles: [
      'feedback-product-loop',
      'feedback-runtime',
      'telemetry-opt-in',
      'product-loop',
      'Feedback / Telemetry Opt-In / Product Loop - Feedback Telemetry',
      'resolveFeedbackTelemetryProductLoopCliText',
      'formatFeedbackTelemetryProductLoopSnapshot',
    ],
  }),
  ruleContainsAcross({
    id: 'zavorthControl-projects-feedback-product-loop',
    label: 'ZavorthControl projects feedback product loop',
    target: '/zavorthControl reads feedbackTelemetryProductLoop and renders opt-in policy',
    files: [
      'src/ai-gateway/app/(zavorthControl)/control/zavorth-control/contracts/zavorthControlZavorthControlContracts.ts',
      'src/ai-gateway/app/(zavorthControl)/control/zavorth-control/adapters/zavorthControlZavorthControlAdapter.ts',
      'src/ai-gateway/app/(zavorthControl)/control/zavorth-control/projections/zavorthControlRuntimeProjection.ts',
      'src/ai-gateway/app/(zavorthControl)/control/zavorth-control/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlControlShell.tsx',
      'tests/ai-gateway/zavorthControl/ZavorthControlFeedbackTelemetryProductLoop.test.ts',
    ],
    needles: [
      'ZavorthControlFeedbackTelemetryProductLoopSnapshot',
      'feedbackTelemetryProductLoop',
      'buildFeedbackTelemetryProductLoop',
      'mapFeedbackTelemetryProductLoop',
      'Feedback / Telemetry Opt-In',
      'policy.noTelemetryEnabled',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-feedback-product-loop-gate',
    label: 'package exposes Feedback Telemetry gate',
    target: 'local QA can run feedback-product-loop:check and qa:feedback-product-loop',
    files: ['package.json'],
    needles: [
      'feedback-product-loop:check',
      'qa:feedback-product-loop',
      'scripts/feedback-telemetry-product-loop-check.mjs',
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
  console.log('[feedback-product-loop] checking Feedback Telemetry');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[feedback-product-loop] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
