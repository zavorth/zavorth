import fs from 'fs';
import os from 'os';
import path from 'path';

import { DiagnosticsQaMigrationLivePlaneService } from '../../src/services/DiagnosticsQaMigrationLivePlaneService.js';
import { DiagnosticsTraceService } from '../../src/services/DiagnosticsTraceService.js';
import { MigrationImportService } from '../../src/services/MigrationImportService.js';
import { QaSmokeMatrixService } from '../../src/services/QaSmokeMatrixService.js';

describe('DiagnosticsQaMigrationLivePlaneService Intent model0', () => {
  let workspaceRoot: string;
  let artifactDir: string;

  beforeEach(async () => {
    workspaceRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-intent-model0-workspace-'));
    artifactDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-intent-model0-artifacts-'));
  });

  afterEach(async () => {
    await fs.promises.rm(workspaceRoot, { recursive: true, force: true });
    await fs.promises.rm(artifactDir, { recursive: true, force: true });
  });

  it('closes Intent model0 diagnostics, QA and migration gates without live IO', () => {
    const snapshot = new DiagnosticsQaMigrationLivePlaneService({
      now: () => new Date('2026-05-05T00:10:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-05.live-checkpoint-10');
    expect(snapshot.phase).toBe('Intent model0 - Diagnostics, QA And Migration Live Plane');
    expect(snapshot.status).toBe('closed');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        targets: 9,
        diagnosticsTargets: 2,
        qaTargets: 5,
        migrationTargets: 2,
        otelExportTargets: 1,
        prometheusScrapeTargets: 1,
        realHealthMetricTargets: 2,
        qaMatrixTargets: 3,
        migrationInventoryTargets: 2,
        migrationDryRunDiffTargets: 2,
        operatorApplyTargets: 2,
        stagingLiveSmokeCommands: 9,
        redactedReceipts: 9,
        blocked: 0,
        diagnosticsMarkedLiveBySyntheticSnapshot: false,
        migrationMarkedLiveByPlanOnly: false,
        liveIoRequiredByLiveCandidateCheck: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        noLiveIoDuringLiveCandidateCheck: true,
        otelExportArtifactRequired: true,
        prometheusScrapeProofRequired: true,
        realHealthMetricsRequired: true,
        qaMatrixRequired: true,
        migrationInventoryReadRequired: true,
        migrationDryRunDiffRequired: true,
        migrationApplyRequiresOperatorConfirmation: true,
      }),
    );
  });

  it('exports real diagnostics telemetry as OTel and Prometheus artifacts', async () => {
    const service = new DiagnosticsTraceService({
      artifactDir,
      now: () => new Date('2026-05-05T00:10:00.000Z'),
    });

    const result = await service.snapshotLive({
      scope: 'runtime',
      includeLogs: true,
      exportOtel: true,
      exportPrometheus: true,
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('healthy');
    expect(result.liveMetrics.memoryRssBytes).toBeGreaterThan(0);
    expect(result.signals.map((signal) => signal.name)).toEqual(
      expect.arrayContaining([
        'runtime.process.uptime',
        'runtime.memory.rss',
        'runtime.heap.used',
      ]),
    );
    expect(result.otelArtifact).toEqual(expect.objectContaining({ contentType: 'application/json' }));
    expect(result.prometheusArtifact).toEqual(expect.objectContaining({ contentType: 'text/plain; version=0.0.4' }));
    expect(result.prometheusScrape).toEqual(
      expect.objectContaining({
        ok: true,
        series: expect.any(Number),
      }),
    );
    const otel = JSON.parse(await fs.promises.readFile(result.otelArtifact!.storageRef, 'utf8'));
    expect(otel.resourceSpans[0].scopeSpans[0].spans.length).toBeGreaterThan(0);
    const prometheus = await fs.promises.readFile(result.prometheusArtifact!.storageRef, 'utf8');
    expect(prometheus).toContain('zavorth_runtime_memory_rss');
  });

  it('builds channel, provider and runtime QA smoke matrix entries', () => {
    const service = new QaSmokeMatrixService({
      packageJson: {
        scripts: {
          'qa:channel-live-activation': 'ok',
          'qa:channel-long-tail-activation': 'ok',
          'qa:provider-runtime-activation': 'ok',
          'qa:provider-long-tail-activation': 'ok',
          'qa:media-generation-live-plane': 'ok',
          'qa:speech-voice-live-plane': 'ok',
          'qa:web-research-live-plane': 'ok',
          'qa:file-document-diff-live-plane': 'ok',
          'qa:deterministic': 'ok',
          'runtime:check': 'ok',
        },
      },
      now: () => new Date('2026-05-05T00:10:00.000Z'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.status).toBe('ready');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        entries: 10,
        channel: 2,
        provider: 2,
        runtime: 4,
        synthetic: 1,
        testSupport: 1,
        blocked: 0,
        externalIoRequired: false,
        secretValuesSerialized: false,
      }),
    );
    expect(service.runSmoke({ scope: 'runtime', target: 'file-document-diff-live-plane' })).toEqual(
      expect.objectContaining({
        ok: true,
        command: 'npm run qa:file-document-diff-live-plane --silent',
        liveIoPerformed: false,
      }),
    );
  });

  it('imports real source inventory with dry-run diff and redacted secrets', async () => {
    const sourceDir = path.join(workspaceRoot, 'claude');
    await fs.promises.mkdir(sourceDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(sourceDir, 'settings.json'),
      JSON.stringify({
        provider: 'anthropic',
        apiKey: 'sk-real-secret',
        nested: {
          token: 'xoxb-real-secret',
        },
      }, null, 2),
      'utf8',
    );
    const service = new MigrationImportService({
      artifactDir,
      workspaceRoots: [workspaceRoot],
      now: () => new Date('2026-05-05T00:10:00.000Z'),
    });

    const result = await service.executeLive({
      source: {
        kind: 'directory',
        ref: sourceDir,
      },
      targetNamespace: 'claude',
      dryRun: true,
      outputDir: artifactDir,
      allowedRoots: [workspaceRoot, artifactDir],
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('dry_run');
    expect(result.generatedManifestIds.length).toBe(2);
    expect(result.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('inventory'),
        expect.stringContaining('dry-run-diff'),
      ]),
    );
    const artifacts = await fs.promises.readdir(artifactDir);
    const combined = (await Promise.all(artifacts.map((file) => fs.promises.readFile(path.join(artifactDir, file), 'utf8')))).join('\n');
    expect(combined).toContain('<redacted>');
    expect(combined).not.toContain('sk-real-secret');
    expect(combined).not.toContain('xoxb-real-secret');
  });

  it('blocks migration apply until operator confirmation', async () => {
    const sourceFile = path.join(workspaceRoot, 'external-agent.json');
    await fs.promises.writeFile(sourceFile, JSON.stringify({ channel: 'signal' }), 'utf8');
    const service = new MigrationImportService({
      artifactDir,
      workspaceRoots: [workspaceRoot],
      now: () => new Date('2026-05-05T00:10:00.000Z'),
    });

    const blocked = await service.executeLive({
      source: {
        kind: 'config-file',
        ref: sourceFile,
      },
      targetNamespace: 'external-agent',
      dryRun: false,
      outputDir: artifactDir,
      allowedRoots: [workspaceRoot, artifactDir],
    });
    expect(blocked).toEqual(
      expect.objectContaining({
        ok: false,
        status: 'blocked',
        error: 'migration.import apply requires confirmApply.',
      }),
    );

    const applied = await service.executeLive({
      source: {
        kind: 'config-file',
        ref: sourceFile,
      },
      targetNamespace: 'external-agent',
      dryRun: false,
      confirmApply: true,
      outputDir: artifactDir,
      allowedRoots: [workspaceRoot, artifactDir],
    });

    expect(applied.ok).toBe(true);
    expect(applied.status).toBe('applied');
    const manifest = (await fs.promises.readdir(artifactDir)).find((file) => file.startsWith('zavorth.migration.external-agent'));
    expect(manifest).toBeTruthy();
  });
});
