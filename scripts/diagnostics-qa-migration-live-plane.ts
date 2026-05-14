import os from 'node:os';
import path from 'node:path';
import type { DiagnosticsQaMigrationLiveEntry } from '../src/contracts/DiagnosticsQaMigrationLivePlaneContract.js';
import { DiagnosticsTraceService } from '../src/services/DiagnosticsTraceService.js';
import { DiagnosticsQaMigrationLivePlaneService } from '../src/services/DiagnosticsQaMigrationLivePlaneService.js';
import { MigrationImportService } from '../src/services/MigrationImportService.js';
import { QaSmokeMatrixService } from '../src/services/QaSmokeMatrixService.js';

type Profile = 'configured' | 'staging-live';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const target = readArg('--target');
const profile = (readArg('--profile') || 'configured') as Profile;
const confirmLiveIo = args.includes('--confirm-live-io');
const snapshot = new DiagnosticsQaMigrationLivePlaneService().buildSnapshot();
const selected = target
  ? snapshot.entries.filter((entry) => entry.targetId === target)
  : snapshot.entries;

if (selected.length === 0) {
  console.error(`[diagnostics-qa-migration-live-plane] unknown target: ${target}`);
  process.exit(1);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main(): Promise<void> {
  const liveReceiptByTarget = new Map<string, unknown>();
  if (profile === 'staging-live' && confirmLiveIo) {
    for (const entry of selected) {
      liveReceiptByTarget.set(entry.targetId, await runLiveSmoke(entry));
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    profile,
    liveIoPerformed: [...liveReceiptByTarget.values()].some(receiptHasLiveIo),
    confirmLiveIo,
    status: profile === 'staging-live' && !confirmLiveIo ? 'blocked-until-confirmed' : 'ready-for-operator',
    reason: profile === 'staging-live' && !confirmLiveIo
      ? 'staging-live diagnostics/QA/migration requires --confirm-live-io and explicit source paths for migration.'
      : 'Phase 10 exposes real diagnostics metrics, QA smoke matrix and migration import artifacts.',
    entries: selected.map((entry) => ({
      targetId: entry.targetId,
      status: entry.status,
      capabilities: entry.capabilities,
      adapterFamily: entry.adapterFamily,
      modes: entry.modes,
      doctorCommand: entry.doctorCommand,
      stagingLiveSmokeCommand: entry.stagingLiveSmokeCommand,
      requiredEnv: entry.configSchema.requiredEnv,
      optionalEnv: entry.configSchema.optionalEnv,
      gaps: entry.gaps,
      receipt: entry.receipt,
      liveReceipt: liveReceiptByTarget.get(entry.targetId) || null,
    })),
  };

  if (asJson) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`[diagnostics-qa-migration-live-plane] profile=${profile} liveIoPerformed=${output.liveIoPerformed}`);
    console.log(`[diagnostics-qa-migration-live-plane] ${output.status}: ${output.reason}`);
    for (const entry of output.entries) {
      console.log(`[diagnostics-qa-migration-live-plane] ${entry.targetId} ${entry.status} capabilities=${entry.capabilities.join(',')}`);
      console.log(`  doctor: ${entry.doctorCommand}`);
      console.log(`  staging: ${entry.stagingLiveSmokeCommand}`);
      console.log(`  required env: ${entry.requiredEnv.join(', ') || 'none'}`);
    }
  }
}

async function runLiveSmoke(entry: DiagnosticsQaMigrationLiveEntry): Promise<unknown> {
  const artifactDir = readArg('--artifact-dir') || readEnv('ZAVORTH_DIAGNOSTICS_QA_MIGRATION_ARTIFACT_DIR') || path.join(os.tmpdir(), 'zavorth-diagnostics-qa-migration-live-smoke');
  const workspaceRoot = readArg('--workspace-root') || process.cwd();
  if (entry.capabilities.includes('diagnostics.trace')) {
    const service = new DiagnosticsTraceService({ artifactDir });
    const result = await service.snapshotLive({
      scope: 'runtime',
      includeLogs: args.includes('--include-logs'),
      exportOtel: entry.targetId === 'diagnostics-otel',
      exportPrometheus: entry.targetId === 'diagnostics-prometheus',
    });
    return {
      targetId: entry.targetId,
      operation: 'diagnostics.trace',
      ok: result.ok,
      status: result.status,
      signals: result.signals.length,
      otelArtifact: result.otelArtifact,
      prometheusArtifact: result.prometheusArtifact,
      prometheusScrape: result.prometheusScrape,
      liveMetrics: result.liveMetrics,
      liveIoPerformed: true,
      secretValuesSerialized: false,
    };
  }
  if (entry.capabilities.includes('qa.scenario')) {
    const scope = qaScopeForTarget(entry.targetId);
    const result = new QaSmokeMatrixService().runSmoke({
      scope,
      target: readArg('--qa-target'),
    });
    return {
      targetId: entry.targetId,
      operation: 'qa.scenario',
      ...result,
      liveIoPerformed: false,
      secretValuesSerialized: false,
    };
  }
  const source = requireArg(entry.targetId, '--source');
  const service = new MigrationImportService({
    artifactDir,
    workspaceRoots: [workspaceRoot],
  });
  const result = await service.executeLive({
    source: {
      kind: readArg('--source-kind') === 'config-file'
        ? 'config-file'
        : readArg('--source-kind') === 'manifest'
          ? 'manifest'
          : 'directory',
      ref: source,
    },
    targetNamespace: readArg('--namespace') || (entry.targetId === 'migrate-claude' ? 'claude' : 'hermes'),
    dryRun: !args.includes('--apply'),
    confirmApply: args.includes('--confirm-apply'),
    outputDir: artifactDir,
    allowedRoots: [workspaceRoot, artifactDir],
  });
  return {
    targetId: entry.targetId,
    operation: 'migration.import',
    ok: result.ok,
    status: result.status,
    findings: result.findings,
    generatedManifestIds: result.generatedManifestIds,
    reportArtifactId: result.reportArtifactId,
    error: result.error,
    liveIoPerformed: true,
    secretValuesSerialized: false,
  };
}

function qaScopeForTarget(targetId: string) {
  if (targetId === 'qa-channel') return 'channel' as const;
  if (targetId === 'synthetic') return 'synthetic' as const;
  if (targetId === 'test-support') return 'test-support' as const;
  if (targetId === 'qa-lab') return 'provider' as const;
  return 'runtime' as const;
}

function readArg(name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) {
    return direct.slice(name.length + 1);
  }
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  return null;
}

function requireArg(targetId: string, name: string): string {
  const value = readArg(name);
  if (value) return value;
  throw new Error(`[diagnostics-qa-migration-live-plane] ${targetId} requires ${name} for staging-live smoke.`);
}

function readEnv(name: string): string | null {
  const value = String(process.env[name] || '').trim();
  return value || null;
}

function receiptHasLiveIo(receipt: unknown): boolean {
  return Boolean(
    receipt
    && typeof receipt === 'object'
    && (receipt as { liveIoPerformed?: unknown }).liveIoPerformed === true,
  );
}
