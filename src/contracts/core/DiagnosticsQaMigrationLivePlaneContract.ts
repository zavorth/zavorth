import type { LiveReadinessStatus } from './LiveReadinessContract.js';

export const ZAVORTH_DIAGNOSTICS_QA_MIGRATION_LIVE_PLANE_CONTRACT_VERSION = '2026-05-05.live-checkpoint-10' as const;

export type DiagnosticsQaMigrationLiveTargetId =
  | 'diagnostics-otel'
  | 'diagnostics-prometheus'
  | 'qa-channel'
  | 'qa-lab'
  | 'qa-matrix'
  | 'synthetic'
  | 'test-support'
  | 'migrate-claude'
  | 'migrate-generic-agent';

export type DiagnosticsQaMigrationLiveCapability =
  | 'diagnostics.trace'
  | 'qa.scenario'
  | 'migration.import';

export type DiagnosticsQaMigrationLiveMode =
  | 'otel-export'
  | 'prometheus-scrape'
  | 'health-metrics'
  | 'channel-smoke'
  | 'provider-smoke'
  | 'runtime-smoke'
  | 'synthetic-smoke'
  | 'test-fixture'
  | 'inventory-read'
  | 'dry-run-diff'
  | 'operator-apply';

export type DiagnosticsQaMigrationLiveStatus =
  | 'diagnostics-live'
  | 'qa-matrix-live'
  | 'migration-import-live'
  | 'blocked';

export type DiagnosticsQaMigrationLiveAdapterFamily =
  | 'otel-json-export'
  | 'prometheus-text-scrape'
  | 'qa-smoke-matrix'
  | 'migration-manifest-importer';

export type DiagnosticsQaMigrationLiveGateKind =
  | 'otel-export'
  | 'prometheus-scrape'
  | 'health-metrics'
  | 'qa-channel-matrix'
  | 'qa-provider-matrix'
  | 'qa-runtime-matrix'
  | 'synthetic-smoke'
  | 'test-support-fixture'
  | 'migration-inventory-read'
  | 'migration-dry-run-diff'
  | 'migration-operator-apply'
  | 'artifact-receipt'
  | 'configured-doctor'
  | 'mock-smoke'
  | 'staging-live-smoke'
  | 'redacted-receipt';

export type DiagnosticsQaMigrationLiveGateStatus =
  | 'passed'
  | 'partial'
  | 'missing'
  | 'blocked';

export type DiagnosticsQaMigrationLiveConfigSchema = {
  requiredEnv: string[];
  optionalEnv: string[];
  secretEnv: string[];
  artifactEnv: string[];
  secretValuesSerialized: false;
};

export type DiagnosticsQaMigrationLiveGate = {
  kind: DiagnosticsQaMigrationLiveGateKind;
  status: DiagnosticsQaMigrationLiveGateStatus;
  evidence: string;
  command: string | null;
};

export type DiagnosticsQaMigrationLiveReceipt = {
  id: string;
  targetId: DiagnosticsQaMigrationLiveTargetId;
  status: DiagnosticsQaMigrationLiveStatus;
  readinessStatus: Extract<LiveReadinessStatus, 'partial-live' | 'configured-only' | 'blocked'>;
  capabilities: DiagnosticsQaMigrationLiveCapability[];
  adapterFamily: DiagnosticsQaMigrationLiveAdapterFamily;
  modes: DiagnosticsQaMigrationLiveMode[];
  liveIoPerformed: false;
  stagingLiveRequiresExplicitCommand: true;
  artifactFirst: true;
  operatorApplyRequiresConfirmation: true;
  secretValuesSerialized: false;
};

export type DiagnosticsQaMigrationLiveEntry = {
  targetId: DiagnosticsQaMigrationLiveTargetId;
  status: DiagnosticsQaMigrationLiveStatus;
  readinessStatus: Extract<LiveReadinessStatus, 'partial-live' | 'configured-only' | 'blocked'>;
  capabilities: DiagnosticsQaMigrationLiveCapability[];
  adapterFamily: DiagnosticsQaMigrationLiveAdapterFamily;
  modes: DiagnosticsQaMigrationLiveMode[];
  adapterTarget: string;
  serviceTargets: string[];
  configSchema: DiagnosticsQaMigrationLiveConfigSchema;
  gates: DiagnosticsQaMigrationLiveGate[];
  gaps: string[];
  doctorCommand: string;
  stagingLiveSmokeCommand: string;
  receipt: DiagnosticsQaMigrationLiveReceipt;
};

export type DiagnosticsQaMigrationLivePlaneSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_DIAGNOSTICS_QA_MIGRATION_LIVE_PLANE_CONTRACT_VERSION;
  gate: 'diagnostics-qa-migration-live-plane';
  status: 'closed' | 'attention' | 'blocked';
  summary: {
    targets: 9;
    diagnosticsTargets: number;
    qaTargets: number;
    migrationTargets: number;
    otelExportTargets: number;
    prometheusScrapeTargets: number;
    realHealthMetricTargets: number;
    qaMatrixTargets: number;
    migrationInventoryTargets: number;
    migrationDryRunDiffTargets: number;
    operatorApplyTargets: number;
    stagingLiveSmokeCommands: number;
    redactedReceipts: number;
    blocked: number;
    diagnosticsMarkedLiveBySyntheticSnapshot: false;
    migrationMarkedLiveByPlanOnly: false;
    liveIoRequiredByLiveCandidateCheck: false;
    secretValuesSerialized: false;
  };
  entries: DiagnosticsQaMigrationLiveEntry[];
  receipts: DiagnosticsQaMigrationLiveReceipt[];
  policy: {
    noLiveIoDuringLiveCandidateCheck: true;
    otelExportArtifactRequired: true;
    prometheusScrapeProofRequired: true;
    realHealthMetricsRequired: true;
    qaMatrixRequired: true;
    migrationInventoryReadRequired: true;
    migrationDryRunDiffRequired: true;
    migrationApplyRequiresOperatorConfirmation: true;
    stagingLiveRequiresExplicitOperatorCommand: true;
    noSecretsSerialized: true;
  };
  commands: {
    check: 'npm run diagnostics-qa-migration-live-plane:check --silent';
    doctor: 'npm run diagnostics-qa-migration-live-plane -- --profile configured';
    stagingLiveSmoke: 'npm run diagnostics-qa-migration-live-plane -- --profile staging-live --target <target> --confirm-live-io';
    focusedTests: string[];
    typecheck: 'npm run runtime:check --silent';
    nextStage: 'Intent model1 - Satellite And Device Live Plane';
  };
};
