#!/usr/bin/env node

import { TaskManager } from '../src/orchestrator/TaskManager.js';
import { LogRepository } from '../src/storage/LogRepository.js';
import { PermissionRepository } from '../src/storage/PermissionRepository.js';
import { TaskRepository } from '../src/storage/TaskRepository.js';
import { PermissionService } from '../src/services/PermissionService.js';
import { ProductObservabilityService } from '../src/services/ProductObservabilityService.js';
import { ZavorthEvalControlPlaneService } from '../src/services/ZavorthEvalControlPlaneService.js';
import { ZavorthEvalHistoryFileService } from '../src/services/ZavorthEvalHistoryFileService.js';
import { ZavorthTelemetryLedgerService } from '../src/services/ZavorthTelemetryLedgerService.js';
import { WorkflowRunService } from '../src/services/WorkflowRunService.js';

type CliScope = {
  workspace: string | null;
  sourceSurface: string | null;
  executor: string | null;
  workflow: string | null;
};

function readFlag(argv: string[], names: string[]): string | null {
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '').trim();
    for (const name of names) {
      if (token === name) {
        return String(argv[index + 1] || '').trim() || null;
      }
      if (token.startsWith(`${name}=`)) {
        return String(token.slice(name.length + 1) || '').trim() || null;
      }
    }
  }
  return null;
}

function buildScope(argv: string[]): CliScope {
  return {
    workspace: readFlag(argv, ['--workspace']),
    sourceSurface: readFlag(argv, ['--surface', '--source-surface']),
    executor: readFlag(argv, ['--executor']),
    workflow: readFlag(argv, ['--workflow']),
  };
}

function formatScope(scope: CliScope): string {
  const parts = [
    scope.workspace ? `workspace=${scope.workspace}` : null,
    scope.sourceSurface ? `surface=${scope.sourceSurface}` : null,
    scope.executor ? `executor=${scope.executor}` : null,
    scope.workflow ? `workflow=${scope.workflow}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' | ') : 'global';
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
  const scope = buildScope(argv);
  const originalConsole = {
    log: console.log,
    info: console.info,
  };
  if (asJson) {
    console.log = () => undefined;
    console.info = () => undefined;
  }

  const taskRepo = new TaskRepository();
  const logRepo = new LogRepository();
  await taskRepo.init();
  await logRepo.init();

  const taskManager = new TaskManager(taskRepo, logRepo);
  const permissionService = new PermissionService(new PermissionRepository());
  const workflowRunService = new WorkflowRunService();
  const productObservabilityService = new ProductObservabilityService(taskManager, permissionService, {
    workflowRunService,
  });
  const evalControlPlane = new ZavorthEvalControlPlaneService({
    productObservabilityService,
    telemetryLedgerService: new ZavorthTelemetryLedgerService(),
    evalHistoryService: new ZavorthEvalHistoryFileService(),
  });

  const snapshot = await evalControlPlane.buildSnapshot(scope);
  if (requirePass && snapshot.regressionGate.status === 'failed') {
    process.exitCode = 1;
  }
  if (asJson) {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }

  const topRegression = snapshot.regressions[0] || null;
  const topHealthy = snapshot.scorecards.find((entry) => entry.status === 'healthy') || null;

  console.log('[zavorth-evals] read operational de evals');
  console.log(`[zavorth-evals] escopo: ${formatScope(scope)}`);
  console.log(`[zavorth-evals] postura: ${snapshot.summary.posture}`);
  console.log(`[zavorth-evals] summary: ${snapshot.narrative.operatorSummary}`);
  console.log(
    `[zavorth-evals] scorecards=${snapshot.summary.scorecards} | datasets=${snapshot.summary.datasets} | regressions=${snapshot.summary.regressions}`,
  );
  console.log(
    `[zavorth-evals] gate=${snapshot.regressionGate.status} | production=${snapshot.regressionGate.rolloutScopes.production ? 'allowed' : 'blocked'} | critical=${snapshot.regressionGate.criticalRegressions}`,
  );
  console.log(
    `[zavorth-evals] sinais: ${snapshot.coverage.taskSignal} | ${snapshot.coverage.workflowSignal} | ${snapshot.coverage.approvalSignal}`,
  );
  console.log(
    `[zavorth-evals] telemetry: status=${snapshot.telemetry.status} | events=${snapshot.telemetry.totalEvents} | traces=${snapshot.telemetry.traceCount} | failures=${snapshot.telemetry.failureEvents}`,
  );
  console.log(
    `[zavorth-evals] retention: events=${snapshot.telemetry.retention.retainedEvents}/${snapshot.telemetry.retention.scannedEvents} | truncated=${snapshot.telemetry.retention.truncated ? 'yes' : 'no'} | external-required=${snapshot.telemetry.sinks.externalRequired ? 'yes' : 'no'}`,
  );
  console.log(
    `[zavorth-evals] history: entries=${snapshot.history.entries} | postura=${snapshot.history.latestPosture} | delta-regressions=${snapshot.history.delta.regressions}`,
  );
  console.log(
    `[zavorth-evals] selfmod: ${snapshot.selfmod.status} | related-datasets=${snapshot.selfmod.relatedDatasets.length} | missing-evidence=${snapshot.selfmod.missingEvalEvidence}`,
  );

  if (topRegression) {
    console.log(
      `[zavorth-evals] largest regression: ${topRegression.label} | severidade=${topRegression.severity}`,
    );
  }

  if (topHealthy) {
    console.log(
      `[zavorth-evals] baseline sugerido: ${topHealthy.label} | success=${Math.round(topHealthy.successRate * 100)}%`,
    );
  }

  if (snapshot.datasets.length > 0) {
    console.log('[zavorth-evals] datasets:');
    for (const entry of snapshot.datasets.slice(0, 5)) {
      console.log(`- ${entry.label}: ${entry.sampleCount} item(s) | ${entry.manifest.baselineRef}`);
    }
  }

  if (snapshot.telemetry.traces.length > 0) {
    console.log('[zavorth-evals] traces:');
    for (const trace of snapshot.telemetry.traces.slice(0, 4)) {
      console.log(
        `- ${trace.source} | ${trace.status} | ${trace.eventCount} evento(s) | ${trace.lastEventType}`,
      );
    }
  }
}

main().catch((error) => {
  console.error('[zavorth-evals] failure ao montar a read operational.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
