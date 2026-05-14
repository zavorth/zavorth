#!/usr/bin/env node

import { TaskManager } from '../src/orchestrator/TaskManager.js';
import { LogRepository } from '../src/storage/LogRepository.js';
import { PermissionRepository } from '../src/storage/PermissionRepository.js';
import { TaskRepository } from '../src/storage/TaskRepository.js';
import { PermissionService } from '../src/services/PermissionService.js';
import { ProductObservabilityService } from '../src/services/ProductObservabilityService.js';
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

function buildSnapshotSummary(snapshot: Awaited<ReturnType<ProductObservabilityService['buildSnapshot']>>): string {
  if (snapshot.insights.length > 0) {
    return snapshot.insights[0];
  }

  if (snapshot.totals.tasks === 0 && snapshot.totals.workflowRuns === 0) {
    return 'Nenhum evento recente encontrado para o recorte atual.';
  }

  if (snapshot.totals.workflowRuns > 0) {
    return `Foram observados ${snapshot.totals.workflowRuns} workflow(s) e ${snapshot.totals.tasks} task(s) na janela atual.`;
  }

  return `Foram observadas ${snapshot.totals.tasks} task(s) e ${snapshot.totals.artifacts} entrega(s) na janela atual.`;
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const scope = buildScope(argv);

  const taskRepo = new TaskRepository();
  const logRepo = new LogRepository();
  await taskRepo.init();
  await logRepo.init();

  const taskManager = new TaskManager(taskRepo, logRepo);
  const permissionService = new PermissionService(new PermissionRepository());
  const workflowRunService = new WorkflowRunService();
  const service = new ProductObservabilityService(taskManager, permissionService, {
    workflowRunService,
  });

  const snapshot = await service.buildSnapshot(scope);

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }

  const topExecutor = snapshot.executors.top[0] || null;
  const topWorkflow = snapshot.workflows.recent[0] || null;
  const topRoute = snapshot.learning.routes.topSuccessful[0] || null;
  const topFriction = snapshot.learning.routes.highestFriction[0] || null;
  const recentArtifact = snapshot.artifacts.recent[0] || null;
  const summary = buildSnapshotSummary(snapshot);

  console.log('[zavorth-observability] leitura de produto');
  console.log(`[zavorth-observability] escopo: ${formatScope(scope)}`);
  console.log(`[zavorth-observability] resumo: ${summary}`);
  console.log(
    `[zavorth-observability] janela: ${snapshot.windowHours}h | tasks=${snapshot.totals.tasks} | workflows=${snapshot.totals.workflowRuns} | artefatos=${snapshot.totals.artifacts}`,
  );
  console.log(
    `[zavorth-observability] approvals: pendentes=${snapshot.approvals.pending} | aprovadas=${snapshot.approvals.approved} | rejeitadas=${snapshot.approvals.rejected}`,
  );

  if (topExecutor) {
    console.log(
      `[zavorth-observability] executor lider: ${topExecutor.executor} | ${topExecutor.completed}/${topExecutor.total} concluida(s)`,
    );
  }

  if (topRoute) {
    console.log(
      `[zavorth-observability] melhor rota: ${topRoute.executor} em ${topRoute.kind}/${topRoute.subtype} | ${topRoute.completed}/${topRoute.total} concluida(s)`,
    );
  }

  if (topFriction) {
    console.log(
      `[zavorth-observability] maior friccao: ${topFriction.executor} em ${topFriction.kind}/${topFriction.subtype} | falhas=${topFriction.failed} | aguardando aprovacao=${topFriction.waitingApproval}`,
    );
  }

  if (topWorkflow) {
    console.log(
      `[zavorth-observability] workflow em foco: ${topWorkflow.workflow} | status=${topWorkflow.status}${topWorkflow.resume_stage_label ? ` | retomar em ${topWorkflow.resume_stage_label}` : ''}`,
    );
  }

  if (recentArtifact) {
    console.log(
      `[zavorth-observability] entrega recente: ${recentArtifact.name} | ${recentArtifact.kind}${recentArtifact.type ? ` | ${recentArtifact.type}` : ''}`,
    );
  }

  if (snapshot.insights.length > 0) {
    console.log('[zavorth-observability] insights:');
    for (const line of snapshot.insights.slice(0, 8)) {
      console.log(`- ${line}`);
    }
  }
}

main().catch((error) => {
  console.error('[zavorth-observability] falha ao montar a leitura de produto.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
