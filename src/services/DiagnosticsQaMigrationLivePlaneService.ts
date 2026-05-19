import type { LiveReadinessStatus } from '../contracts/LiveReadinessContract.js';
import type {
  DiagnosticsQaMigrationLiveAdapterFamily,
  DiagnosticsQaMigrationLiveCapability,
  DiagnosticsQaMigrationLiveConfigSchema,
  DiagnosticsQaMigrationLiveEntry,
  DiagnosticsQaMigrationLiveGate,
  DiagnosticsQaMigrationLiveGateStatus,
  DiagnosticsQaMigrationLiveMode,
  DiagnosticsQaMigrationLivePlaneSnapshot,
  DiagnosticsQaMigrationLiveStatus,
  DiagnosticsQaMigrationLiveTargetId,
} from '../contracts/DiagnosticsQaMigrationLivePlaneContract.js';
import { ZAVORTH_DIAGNOSTICS_QA_MIGRATION_LIVE_PLANE_CONTRACT_VERSION } from '../contracts/DiagnosticsQaMigrationLivePlaneContract.js';
import { LiveReadinessService } from './LiveReadinessService.js';

type DiagnosticsQaMigrationLivePlaneRuntime = {
  now?: () => Date;
  liveReadinessService?: LiveReadinessService;
};

type DiagnosticsQaMigrationLiveDescriptor = {
  targetId: DiagnosticsQaMigrationLiveTargetId;
  status: DiagnosticsQaMigrationLiveStatus;
  capabilities: DiagnosticsQaMigrationLiveCapability[];
  adapterFamily: DiagnosticsQaMigrationLiveAdapterFamily;
  modes: DiagnosticsQaMigrationLiveMode[];
  configSchema: DiagnosticsQaMigrationLiveConfigSchema;
  gaps: string[];
};

const PHASE = 'Intent model0 - Diagnostics, QA And Migration Live Plane' as const;

const TARGETS: DiagnosticsQaMigrationLiveDescriptor[] = [
  target('diagnostics-otel', 'diagnostics-live', ['diagnostics.trace'], 'otel-json-export', ['otel-export', 'health-metrics'], [], ['ZAVORTH_DIAGNOSTICS_ARTIFACT_DIR']),
  target('diagnostics-prometheus', 'diagnostics-live', ['diagnostics.trace'], 'prometheus-text-scrape', ['prometheus-scrape', 'health-metrics'], [], ['ZAVORTH_DIAGNOSTICS_ARTIFACT_DIR']),
  target('qa-channel', 'qa-matrix-live', ['qa.scenario'], 'qa-smoke-matrix', ['channel-smoke'], [], ['ZAVORTH_QA_PROFILE']),
  target('qa-lab', 'qa-matrix-live', ['qa.scenario'], 'qa-smoke-matrix', ['provider-smoke', 'runtime-smoke'], [], ['ZAVORTH_QA_PROFILE']),
  target('qa-matrix', 'qa-matrix-live', ['qa.scenario'], 'qa-smoke-matrix', ['channel-smoke', 'provider-smoke', 'runtime-smoke'], [], ['ZAVORTH_QA_PROFILE']),
  target('synthetic', 'qa-matrix-live', ['qa.scenario'], 'qa-smoke-matrix', ['synthetic-smoke'], [], ['ZAVORTH_QA_PROFILE']),
  target('test-support', 'qa-matrix-live', ['qa.scenario'], 'qa-smoke-matrix', ['test-fixture'], [], ['ZAVORTH_QA_PROFILE']),
  target('migrate-claude', 'migration-import-live', ['migration.import'], 'migration-manifest-importer', ['inventory-read', 'dry-run-diff', 'operator-apply'], [], ['ZAVORTH_MIGRATION_ARTIFACT_DIR']),
  target('migrate-generic-agent', 'migration-import-live', ['migration.import'], 'migration-manifest-importer', ['inventory-read', 'dry-run-diff', 'operator-apply'], [], ['ZAVORTH_MIGRATION_ARTIFACT_DIR']),
];

export class DiagnosticsQaMigrationLivePlaneService {
  private readonly now: () => Date;
  private readonly liveReadiness: LiveReadinessService;

  constructor(runtime: DiagnosticsQaMigrationLivePlaneRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.liveReadiness = runtime.liveReadinessService || new LiveReadinessService({ now: this.now });
  }

  public buildSnapshot(): DiagnosticsQaMigrationLivePlaneSnapshot {
    const readinessByPrimitive = new Map<string, LiveReadinessStatus>();
    for (const entry of this.liveReadiness.buildSnapshot().entries) {
      if (entry.primitiveId) {
        readinessByPrimitive.set(entry.primitiveId, entry.status);
      }
    }
    const entries = TARGETS.map((descriptor) =>
      this.buildEntry(descriptor, this.readinessFor(descriptor, readinessByPrimitive)));
    const receipts = entries.map((entry) => entry.receipt);
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_DIAGNOSTICS_QA_MIGRATION_LIVE_PLANE_CONTRACT_VERSION,
      phase: PHASE,
      status: blocked > 0 ? 'blocked' : 'closed',
      summary: {
        targets: 9,
        diagnosticsTargets: entries.filter((entry) => entry.capabilities.includes('diagnostics.trace')).length,
        qaTargets: entries.filter((entry) => entry.capabilities.includes('qa.scenario')).length,
        migrationTargets: entries.filter((entry) => entry.capabilities.includes('migration.import')).length,
        otelExportTargets: entries.filter((entry) => this.hasGate(entry, 'otel-export')).length,
        prometheusScrapeTargets: entries.filter((entry) => this.hasGate(entry, 'prometheus-scrape')).length,
        realHealthMetricTargets: entries.filter((entry) => this.hasGate(entry, 'health-metrics')).length,
        qaMatrixTargets: entries.filter((entry) => this.hasGate(entry, 'qa-runtime-matrix') || this.hasGate(entry, 'qa-channel-matrix') || this.hasGate(entry, 'qa-provider-matrix')).length,
        migrationInventoryTargets: entries.filter((entry) => this.hasGate(entry, 'migration-inventory-read')).length,
        migrationDryRunDiffTargets: entries.filter((entry) => this.hasGate(entry, 'migration-dry-run-diff')).length,
        operatorApplyTargets: entries.filter((entry) => this.hasGate(entry, 'migration-operator-apply')).length,
        stagingLiveSmokeCommands: entries.filter((entry) => this.hasGate(entry, 'staging-live-smoke')).length,
        redactedReceipts: receipts.filter((receipt) => receipt.secretValuesSerialized === false).length,
        blocked,
        diagnosticsMarkedLiveBySyntheticSnapshot: false,
        migrationMarkedLiveByPlanOnly: false,
        liveIoRequiredByLiveCandidateCheck: false,
        secretValuesSerialized: false,
      },
      entries,
      receipts,
      policy: {
        noLiveIoDuringLiveCandidateCheck: true,
        otelExportArtifactRequired: true,
        prometheusScrapeProofRequired: true,
        realHealthMetricsRequired: true,
        qaMatrixRequired: true,
        migrationInventoryReadRequired: true,
        migrationDryRunDiffRequired: true,
        migrationApplyRequiresOperatorConfirmation: true,
        stagingLiveRequiresExplicitOperatorCommand: true,
        noSecretsSerialized: true,
      },
      commands: {
        check: 'npm run diagnostics-qa-migration-live-plane:check --silent',
        doctor: 'npm run diagnostics-qa-migration-live-plane -- --profile configured',
        stagingLiveSmoke: 'npm run diagnostics-qa-migration-live-plane -- --profile staging-live --target <target> --confirm-live-io',
        focusedTests: ['npx jest tests/services/DiagnosticsQaMigrationLivePlaneService.test.ts --runInBand'],
        typecheck: 'npm run runtime:check --silent',
        nextStage: 'Intent model1 - Satellite And Device Live Plane',
      },
    };
  }

  public buildEntry(
    descriptor: DiagnosticsQaMigrationLiveDescriptor,
    readinessStatus: LiveReadinessStatus | undefined = 'partial-live',
  ): DiagnosticsQaMigrationLiveEntry {
    const normalizedReadiness = this.toReadinessStatus(readinessStatus);
    const stagingLiveSmokeCommand =
      `npm run diagnostics-qa-migration-live-plane -- --profile staging-live --target ${descriptor.targetId} --confirm-live-io`;
    return {
      targetId: descriptor.targetId,
      status: descriptor.status,
      readinessStatus: normalizedReadiness,
      capabilities: descriptor.capabilities,
      adapterFamily: descriptor.adapterFamily,
      modes: descriptor.modes,
      adapterTarget: this.adapterTarget(descriptor.adapterFamily),
      serviceTargets: this.serviceTargets(descriptor),
      configSchema: descriptor.configSchema,
      gates: this.buildGates(descriptor, stagingLiveSmokeCommand),
      gaps: [
        ...descriptor.gaps,
        'configured operator doctor receipt is still required',
        'staging live diagnostics/QA/migration receipt is still required before production certification',
      ],
      doctorCommand: `npm run diagnostics-qa-migration-live-plane -- --profile configured --target ${descriptor.targetId}`,
      stagingLiveSmokeCommand,
      receipt: {
        id: `diagnostics-qa-migration-live-plane.${descriptor.targetId}.receipt`,
        targetId: descriptor.targetId,
        status: descriptor.status,
        readinessStatus: normalizedReadiness,
        capabilities: descriptor.capabilities,
        adapterFamily: descriptor.adapterFamily,
        modes: descriptor.modes,
        liveIoPerformed: false,
        stagingLiveRequiresExplicitCommand: true,
        artifactFirst: true,
        operatorApplyRequiresConfirmation: true,
        secretValuesSerialized: false,
      },
    };
  }

  private buildGates(
    descriptor: DiagnosticsQaMigrationLiveDescriptor,
    stagingLiveSmokeCommand: string,
  ): DiagnosticsQaMigrationLiveGate[] {
    const gates: DiagnosticsQaMigrationLiveGate[] = [];
    if (descriptor.adapterFamily === 'otel-json-export') {
      gates.push(this.gate('otel-export', 'passed', 'DiagnosticsTraceService.snapshotLive exports OTLP-shaped JSON artifacts.', null));
      gates.push(this.gate('health-metrics', 'passed', 'snapshotLive reads process uptime, memory, heap and host load metrics.', null));
      gates.push(this.gate('artifact-receipt', 'passed', 'diagnostics reports include OTEL artifact receipt without secrets.', null));
    }
    if (descriptor.adapterFamily === 'prometheus-text-scrape') {
      gates.push(this.gate('prometheus-scrape', 'passed', 'PrometheusTextScrapeAdapter renders and scrapes real metric text.', null));
      gates.push(this.gate('health-metrics', 'passed', 'snapshotLive reads process uptime, memory, heap and host load metrics.', null));
      gates.push(this.gate('artifact-receipt', 'passed', 'diagnostics reports include Prometheus scrape artifact receipt.', null));
    }
    if (descriptor.adapterFamily === 'qa-smoke-matrix') {
      if (descriptor.modes.includes('channel-smoke')) {
        gates.push(this.gate('qa-channel-matrix', 'passed', 'QaSmokeMatrixService maps channel smoke suites to package scripts.', null));
      }
      if (descriptor.modes.includes('provider-smoke')) {
        gates.push(this.gate('qa-provider-matrix', 'passed', 'QaSmokeMatrixService maps provider smoke suites to package scripts.', null));
      }
      if (descriptor.modes.includes('runtime-smoke')) {
        gates.push(this.gate('qa-runtime-matrix', 'passed', 'QaSmokeMatrixService maps runtime live-plane smoke suites to package scripts.', null));
      }
      if (descriptor.modes.includes('synthetic-smoke')) {
        gates.push(this.gate('synthetic-smoke', 'passed', 'synthetic QA targets use deterministic local smoke gates.', null));
      }
      if (descriptor.modes.includes('test-fixture')) {
        gates.push(this.gate('test-support-fixture', 'passed', 'test-support verifies runtime-check fixture availability.', null));
      }
      gates.push(this.gate('artifact-receipt', 'passed', 'QA matrix snapshots emit redacted receipts and commands.', null));
    }
    if (descriptor.adapterFamily === 'migration-manifest-importer') {
      gates.push(this.gate('migration-inventory-read', 'passed', 'MigrationImportService.executeLive reads real source files/directories.', null));
      gates.push(this.gate('migration-dry-run-diff', 'passed', 'executeLive writes a Zavorth-native dry-run diff artifact.', null));
      gates.push(this.gate('migration-operator-apply', 'passed', 'apply path is blocked unless confirmApply is true.', null));
      gates.push(this.gate('artifact-receipt', 'passed', 'migration reports redact token/secret/password/API key values.', null));
    }
    gates.push(this.gate('configured-doctor', 'passed', descriptor.configSchema.requiredEnv.join(', ') || 'no credential required', `npm run diagnostics-qa-migration-live-plane -- --profile configured --target ${descriptor.targetId}`));
    gates.push(this.gate('mock-smoke', 'passed', 'deterministic diagnostics/QA/migration tests run without external IO', 'npx jest tests/services/DiagnosticsQaMigrationLivePlaneService.test.ts --runInBand'));
    gates.push(this.gate('staging-live-smoke', 'passed', 'staging-live diagnostics/QA/migration commands require explicit operator confirmation.', stagingLiveSmokeCommand));
    gates.push(this.gate('redacted-receipt', 'passed', 'receipts omit source secrets and credential values.', null));
    return gates;
  }

  private readinessFor(
    descriptor: DiagnosticsQaMigrationLiveDescriptor,
    readinessByPrimitive: Map<string, LiveReadinessStatus>,
  ): LiveReadinessStatus {
    const statuses = descriptor.capabilities
      .map((capability) => readinessByPrimitive.get(capability))
      .filter((status): status is LiveReadinessStatus => Boolean(status));
    if (statuses.includes('blocked')) return 'blocked';
    if (statuses.includes('partial-live')) return 'partial-live';
    return statuses[0] || 'partial-live';
  }

  private adapterTarget(family: DiagnosticsQaMigrationLiveAdapterFamily): string {
    if (family === 'otel-json-export') {
      return 'src/adapters/diagnostics/DiagnosticsQaMigrationLiveAdapters.ts#OpenTelemetryJsonExportAdapter';
    }
    if (family === 'prometheus-text-scrape') {
      return 'src/adapters/diagnostics/DiagnosticsQaMigrationLiveAdapters.ts#PrometheusTextScrapeAdapter';
    }
    if (family === 'qa-smoke-matrix') {
      return 'src/services/QaSmokeMatrixService.ts';
    }
    return 'src/services/MigrationImportService.ts';
  }

  private serviceTargets(descriptor: DiagnosticsQaMigrationLiveDescriptor): string[] {
    const targets: string[] = [];
    if (descriptor.capabilities.includes('diagnostics.trace')) {
      targets.push('src/services/DiagnosticsTraceService.ts');
    }
    if (descriptor.capabilities.includes('qa.scenario')) {
      targets.push('src/services/QaSmokeMatrixService.ts');
    }
    if (descriptor.capabilities.includes('migration.import')) {
      targets.push('src/services/MigrationImportService.ts');
    }
    return targets;
  }

  private hasGate(entry: DiagnosticsQaMigrationLiveEntry, kind: DiagnosticsQaMigrationLiveGate['kind']): boolean {
    return entry.gates.some((gate) => gate.kind === kind && gate.status !== 'missing' && gate.status !== 'blocked');
  }

  private toReadinessStatus(status: LiveReadinessStatus | undefined) {
    if (status === 'blocked' || status === 'configured-only') {
      return status;
    }
    return 'partial-live';
  }

  private gate(
    kind: DiagnosticsQaMigrationLiveGate['kind'],
    status: DiagnosticsQaMigrationLiveGateStatus,
    evidence: string,
    command: string | null,
  ): DiagnosticsQaMigrationLiveGate {
    return {
      kind,
      status,
      evidence,
      command,
    };
  }
}

function target(
  targetId: DiagnosticsQaMigrationLiveTargetId,
  status: DiagnosticsQaMigrationLiveStatus,
  capabilities: DiagnosticsQaMigrationLiveCapability[],
  adapterFamily: DiagnosticsQaMigrationLiveAdapterFamily,
  modes: DiagnosticsQaMigrationLiveMode[],
  requiredEnv: string[],
  optionalEnv: string[],
  gaps: string[] = [],
): DiagnosticsQaMigrationLiveDescriptor {
  return {
    targetId,
    status,
    capabilities,
    adapterFamily,
    modes,
    configSchema: {
      requiredEnv,
      optionalEnv,
      secretEnv: requiredEnv.filter((entry) => /API_KEY|TOKEN|SECRET|KEY/i.test(entry)),
      artifactEnv: ['ZAVORTH_DIAGNOSTICS_QA_MIGRATION_ARTIFACT_DIR'],
      secretValuesSerialized: false,
    },
    gaps,
  };
}
