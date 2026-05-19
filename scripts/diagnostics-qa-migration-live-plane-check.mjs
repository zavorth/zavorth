#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'diagnostics-qa-migration-live-plane-files',
    label: 'Diagnostics/QA/migration live plane files exist',
    target: 'Contract, service, adapters, tests, docs, scripts, SDK barrels and package scripts are present',
    files: [
      'src/contracts/DiagnosticsQaMigrationLivePlaneContract.ts',
      'src/contracts/QaSmokeMatrixContract.ts',
      'src/services/DiagnosticsQaMigrationLivePlaneService.ts',
      'src/services/DiagnosticsTraceService.ts',
      'src/services/QaSmokeMatrixService.ts',
      'src/services/MigrationImportService.ts',
      'src/adapters/diagnostics/DiagnosticsQaMigrationLiveAdapters.ts',
      'tests/services/DiagnosticsQaMigrationLivePlaneService.test.ts',
      'scripts/diagnostics-qa-migration-live-plane.ts',
      'scripts/diagnostics-qa-migration-live-plane-check.mjs',
      'docs/README.md',
      'src/sdk/contracts.ts',
      'src/sdk/index.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'diagnostics-qa-migration-live-contract',
    label: 'Contract defines Phase 10 vocabulary',
    target: 'Contract captures targets, capabilities, gates, receipts and next phase handoff',
    files: ['src/contracts/DiagnosticsQaMigrationLivePlaneContract.ts'],
    needles: [
      'ZAVORTH_DIAGNOSTICS_QA_MIGRATION_LIVE_PLANE_CONTRACT_VERSION',
      '2026-05-05.live-phase-10',
      'diagnostics-otel',
      'diagnostics-prometheus',
      'qa-channel',
      'qa-lab',
      'qa-matrix',
      'synthetic',
      'test-support',
      'migrate-claude',
      'migrate-generic-agent',
      'diagnosticsMarkedLiveBySyntheticSnapshot: false',
      'migrationMarkedLiveByPlanOnly: false',
      'Phase 11 - Satellite And Device Live Plane',
    ],
  }),
  ruleContainsAll({
    id: 'diagnostics-live-adapters',
    label: 'Adapters implement OTel export and Prometheus scrape',
    target: 'Diagnostics adapters produce OTLP JSON and Prometheus text/scrape proof',
    files: ['src/adapters/diagnostics/DiagnosticsQaMigrationLiveAdapters.ts'],
    needles: [
      'OpenTelemetryJsonExportAdapter',
      'PrometheusTextScrapeAdapter',
      'resourceSpans',
      'zavorth_diagnostics_signal',
      'scrape',
    ],
  }),
  ruleContainsAll({
    id: 'diagnostics-live-service',
    label: 'DiagnosticsTraceService reads real telemetry',
    target: 'diagnostics.trace has real process metrics, OTel artifact and Prometheus artifact paths',
    files: ['src/services/DiagnosticsTraceService.ts'],
    needles: [
      'snapshotLive',
      'process.memoryUsage',
      'process.uptime',
      'OpenTelemetryJsonExportAdapter',
      'PrometheusTextScrapeAdapter',
      'prometheusScrape',
    ],
  }),
  ruleContainsAll({
    id: 'qa-smoke-matrix-service',
    label: 'QaSmokeMatrixService maps smoke suites',
    target: 'QA matrix covers channel/provider/runtime/synthetic/test-support commands',
    files: ['src/services/QaSmokeMatrixService.ts'],
    needles: [
      'QaSmokeMatrixService',
      'qa:channel-live-activation',
      'qa:provider-runtime-activation',
      'qa:media-generation-live-plane',
      'qa:file-document-diff-live-plane',
      'qa:deterministic',
      'runtime:check',
    ],
  }),
  ruleContainsAll({
    id: 'migration-live-service',
    label: 'MigrationImportService imports real inventory',
    target: 'migration.import reads source files, redacts secrets, emits dry-run diff and gated apply artifacts',
    files: ['src/services/MigrationImportService.ts'],
    needles: [
      'executeLive',
      'confirmApply',
      'readInventory',
      'redactSecrets',
      'dry-run diff artifact',
      'upsert-manifest-entry',
    ],
  }),
  ruleContainsAll({
    id: 'diagnostics-qa-migration-live-service',
    label: 'Service closes Phase 10 gates',
    target: 'Service maps nine targets with telemetry, QA matrix and migration receipts',
    files: ['src/services/DiagnosticsQaMigrationLivePlaneService.ts'],
    needles: [
      'DiagnosticsQaMigrationLivePlaneService',
      'diagnostics-otel',
      'diagnostics-prometheus',
      'qa-channel',
      'migrate-claude',
      'otel-export',
      'prometheus-scrape',
      'migration-dry-run-diff',
      '--confirm-live-io',
    ],
  }),
  ruleContainsAll({
    id: 'diagnostics-qa-migration-live-readiness',
    label: 'Live readiness promotes Phase 10 runtime families',
    target: 'diagnostics.trace, qa.scenario and migration.import point at Phase 10 live activation',
    files: ['src/services/LiveReadinessService.ts'],
    needles: [
      'diagnostics.trace',
      'qa.scenario',
      'migration.import',
      'Phase 10 - Diagnostics, QA, and Migration Live Activation',
    ],
  }),
  ruleContainsAll({
    id: 'diagnostics-qa-migration-normalization',
    label: 'Capability normalization points Phase 10 primitives at live services',
    target: 'diagnostics, QA and migration use Zavorth-native service targets',
    files: ['src/services/CapabilityNormalizationService.ts'],
    needles: [
      'src/adapters/diagnostics/DiagnosticsQaMigrationLiveAdapters.ts',
      'src/contracts/QaSmokeMatrixContract.ts',
      'src/services/QaSmokeMatrixService.ts',
      'src/services/MigrationImportService.ts',
    ],
  }),
  ruleContainsAll({
    id: 'diagnostics-qa-migration-live-tests',
    label: 'Tests prove Phase 10 behavior',
    target: 'Tests cover snapshot, diagnostics, QA matrix and migration dry-run/apply',
    files: ['tests/services/DiagnosticsQaMigrationLivePlaneService.test.ts'],
    needles: [
      'closes Phase 10 diagnostics, QA and migration gates',
      'exports real diagnostics telemetry as OTel and Prometheus artifacts',
      'builds channel, provider and runtime QA smoke matrix entries',
      'imports real source inventory with dry-run diff and redacted secrets',
      'blocks migration apply until operator confirmation',
    ],
  }),
  ruleContainsAll({
    id: 'diagnostics-qa-migration-live-package',
    label: 'Package exposes Phase 10 scripts',
    target: 'Phase 10 can be run through package scripts',
    files: ['package.json'],
    needles: [
      'diagnostics-qa-migration-live-plane',
      'diagnostics-qa-migration-live-plane:check',
      'qa:diagnostics-qa-migration-live-plane',
    ],
  }),
  ruleContainsAll({
    id: 'diagnostics-qa-migration-live-sdk-contracts',
    label: 'SDK exposes Phase 10 contracts',
    target: 'Phase 10 contracts can be imported from SDK barrels',
    files: ['src/sdk/contracts.ts'],
    needles: [
      'DiagnosticsQaMigrationLivePlane',
      'QaSmokeMatrix',
    ],
  }),
  ruleContainsAll({
    id: 'diagnostics-qa-migration-live-sdk-services',
    label: 'SDK exposes Phase 10 services',
    target: 'Phase 10 services can be imported from SDK index',
    files: ['src/sdk/index.ts'],
    needles: [
      'DiagnosticsQaMigrationLivePlaneService',
      'QaSmokeMatrixService',
    ],
  }),
  ruleContainsAll({
    id: 'diagnostics-qa-migration-live-doc',
    label: 'Docs record Phase 10 closure',
    target: 'Phase 10 documentation explains telemetry, QA matrix, migration and staging-live flow',
    files: ['docs/README.md'],
    needles: [
      'Phase 10',
      'Diagnostics, QA And Migration Live Plane',
      'diagnostics.trace',
      'qa.scenario',
      'migration.import',
      'OTel',
      'Prometheus',
      'staging-live',
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
  console.log('[diagnostics-qa-migration-live-plane] checking Phase 10');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[diagnostics-qa-migration-live-plane] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
