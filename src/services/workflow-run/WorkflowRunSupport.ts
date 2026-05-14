import fs from 'fs';
import path from 'path';
import { config } from '../../config/index.js';
import type { ArtifactPipelineService } from '../../runtime/artifacts/ArtifactPipelineService.js';
import {
  type ZavorthExecutionCorrelation,
  type ZavorthExecutionLifecycleStatus,
  type ExecutionLifecycleRecord,
} from '../../contracts/ExecutionLifecycleContract.js';
import { WorkflowExternalizedStateService } from '../WorkflowExternalizedStateService.js';
import type {
  WorkflowKind,
  WorkflowRunActionableStageSnapshot,
  WorkflowRunResumeStageSnapshot,
  WorkflowRunSnapshot,
  WorkflowRunStageSnapshot,
  WorkflowStageDecisionAction,
  WorkflowStageDefinition,
  WorkflowStageStatus,
  WorkflowWorkspaceContext,
} from '../WorkflowRunService.js';
import { SmartOutputService } from '../SmartOutputService.js';
import { WorkflowRunLifecycleSupport } from './WorkflowRunLifecycleSupport.js';
import { WorkflowRunStageStateSupport } from './WorkflowRunStageStateSupport.js';

type WorkflowRunSupportRuntime = {
  artifactPipeline: ArtifactPipelineService;
  storageDir: string;
  persistEnabled: boolean;
  now: () => Date;
  inMemoryRuns: Map<string, WorkflowRunSnapshot>;
  externalizedState: WorkflowExternalizedStateService;
  botApi?: any;
  logRepo?: { log: (...args: any[]) => void };
};

export class WorkflowRunSupport {
  constructor(private readonly runtime: WorkflowRunSupportRuntime) {}

  public buildRunId(workflow: WorkflowKind): string {
    return `wf-${workflow}-${this.runtime.now().getTime().toString(36)}`;
  }

  public normalizeRun(run: WorkflowRunSnapshot): WorkflowRunSnapshot {
    const normalized = {
      ...run,
      operator_state: run?.operator_state === 'closed' ? 'closed' : 'active',
      operator_closed_at: this.normalizeNullableString((run as any)?.operator_closed_at),
      operator_close_reason: this.normalizeNullableString((run as any)?.operator_close_reason),
      operator_closed_by_surface: this.normalizeNullableString((run as any)?.operator_closed_by_surface),
      stages: Array.isArray(run?.stages)
        ? run.stages.map((stage, index) => ({
            id: String(stage?.id || '').trim(),
            label: String(stage?.label || '').trim(),
            executor: String(stage?.executor || 'codex').trim() as WorkflowRunStageSnapshot['executor'],
            role: String(stage?.role || '').trim(),
            strategy_note: this.normalizeNullableString((stage as any)?.strategy_note),
            index: Number.isFinite(stage?.index) ? Number(stage.index) : index,
            status: String(stage?.status || 'pending').trim() as WorkflowStageStatus,
            task_id: this.normalizeNullableString(stage?.task_id),
            attempt_count: Math.max(0, Number(stage?.attempt_count || 0)),
            objective: this.normalizeNullableString(stage?.objective),
            handoff_summary: this.normalizeNullableString(stage?.handoff_summary),
            started_at: this.normalizeNullableString(stage?.started_at),
            finished_at: this.normalizeNullableString(stage?.finished_at),
            result_summary: this.normalizeNullableString(stage?.result_summary),
            artifact_count: Math.max(0, Number(stage?.artifact_count || 0)),
          }))
        : [],
      artifacts: Array.isArray(run?.artifacts) ? run.artifacts : [],
      origin: this.normalizeOrigin((run as any)?.origin),
      trigger: this.normalizeTrigger((run as any)?.trigger),
      artifacts_manifest: run?.artifacts_manifest || this.runtime.artifactPipeline.buildManifest([], {
        traceId: this.normalizeNullableString(run?.workflow_run_id) || 'workflow:unknown',
        runId: this.normalizeNullableString(run?.workflow_run_id) || 'workflow:unknown',
        source: 'workflow-run',
      }),
      execution_lifecycle: this.normalizeLifecycleRecords((run as any)?.execution_lifecycle),
      externalized_state: (run as any)?.externalized_state || null,
      resume_stage: null,
      actionable_stages: [],
      resume_prompt: null,
    } as WorkflowRunSnapshot;
    this.syncRunDerivedState(normalized);
    const describedState = this.runtime.externalizedState.describe(normalized.workflow_run_id);
    normalized.externalized_state = normalized.externalized_state
      ? {
          ...normalized.externalized_state,
          ...describedState,
        }
      : describedState;
    return normalized;
  }

  public buildRunArtifactContext(run: WorkflowRunSnapshot, source: string | null = 'workflow') {
    const correlation = this.buildRunCorrelation(run);
    return {
      traceId: correlation.traceId,
      runId: correlation.runId,
      sessionId: correlation.sessionId,
      taskId: run.origin.origin_task_id || run.workflow_run_id,
      surface: run.origin.source_surface || null,
      source: source || 'workflow',
    };
  }

  public getRun(workflowRunId: string): WorkflowRunSnapshot | null {
    const normalizedWorkflowRunId = String(workflowRunId || '').trim();
    if (this.runtime.persistEnabled) {
      const restored = this.runtime.externalizedState.readRun(normalizedWorkflowRunId);
      if (restored) {
        const normalized = this.normalizeRun(restored as WorkflowRunSnapshot);
        this.runtime.inMemoryRuns.set(normalized.workflow_run_id, this.cloneRun(normalized));
        return normalized;
      }
    }

    const memoryRun = this.runtime.inMemoryRuns.get(normalizedWorkflowRunId);
    if (!memoryRun) {
      return null;
    }

    return this.cloneRun(memoryRun);
  }

  public resolveBroadcastRecipients(roles: string[] = ['admin']): string[] {
    const requestedRoles = new Set(
      (roles || [])
        .map((role) => String(role || '').trim().toLowerCase())
        .filter(Boolean),
    );

    if (requestedRoles.size === 0) {
      return [...config.allowedUserIds];
    }

    return config.allowedUserIds.filter((userId) => {
      const assignedRoles = config.telegramUserRoles[userId] || ['admin'];
      return assignedRoles.some((role) => requestedRoles.has(String(role).toLowerCase()));
    });
  }

  public markStageInterrupted(
    run: WorkflowRunSnapshot,
    stageId: string,
    status: 'blocked' | 'failed' | 'approval_pending',
    summary: string,
  ): void {
    const stage = run.stages.find((entry) => entry.id === stageId);
    if (!stage) {
      return;
    }

    const now = this.runtime.now().toISOString();
    stage.status = status;
    stage.finished_at = now;
    stage.result_summary = summary;
    run.updated_at = now;
    this.syncRunDerivedState(run);
    this.appendLifecycle(run, [
      status === 'approval_pending'
        ? this.buildWorkflowLifecycleRecord(run, {
            kind: 'approval',
            id: this.buildStageApprovalId(run, stage),
            status: 'approval_required',
            summary: summary || `Etapa ${stage.label} aguardando aprovacao.`,
            at: now,
            parentId: run.workflow_run_id,
            approvalId: this.buildStageApprovalId(run, stage),
            metadata: {
              event: 'stage_interrupted',
              stageId: stage.id,
              stageLabel: stage.label,
              executor: stage.executor,
              taskId: stage.task_id,
              workflowStatus: run.status,
            },
          })
        : this.buildWorkflowLifecycleRecord(run, {
            kind: 'execution',
            id: this.buildStageExecutionId(run, stage),
            status: status === 'blocked' ? 'blocked' : 'failed',
            summary: summary || `Etapa ${stage.label} interrompida.`,
            at: now,
            parentId: run.workflow_run_id,
            metadata: {
              event: 'stage_interrupted',
              stageId: stage.id,
              stageLabel: stage.label,
              executor: stage.executor,
              taskId: stage.task_id,
              workflowStatus: run.status,
            },
          }),
      this.buildWorkflowLifecycleRecord(run, {
        kind: 'run',
        status: this.mapWorkflowStatusToLifecycle(run.status),
        summary: summary || `Workflow ${run.workflow_name} interrompido na etapa ${stage.label}.`,
        at: now,
        metadata: {
          event: 'stage_interrupted',
          stageId: stage.id,
          stageLabel: stage.label,
          workflowStatus: run.status,
        },
      }),
    ]);
    this.persistRun(run, 'stage_interrupted');
  }

  public applyStageApprovalDecision(input: {
    workflowRunId: string;
    stageId?: string | null;
    taskId?: string | null;
    action: WorkflowStageDecisionAction;
    summary: string;
  }): WorkflowRunSnapshot | null {
    const workflowRunId = String(input.workflowRunId || '').trim();
    if (!workflowRunId) {
      return null;
    }

    const run = this.getRun(workflowRunId);
    if (!run) {
      return null;
    }

    const stage = this.resolveStageByDecisionReference(run, {
      stageId: input.stageId,
      taskId: input.taskId,
    });
    if (!stage) {
      return run;
    }

    const now = this.runtime.now().toISOString();
    if (input.action === 'approve') {
      stage.status = 'pending';
      stage.finished_at = null;
      stage.result_summary = String(input.summary || '').trim() || stage.result_summary || null;
    } else {
      stage.status = 'blocked';
      stage.finished_at = now;
      stage.result_summary = String(input.summary || '').trim() || stage.result_summary || null;
    }

    run.updated_at = now;
    this.syncRunDerivedState(run);
    this.appendLifecycle(run, [
      this.buildWorkflowLifecycleRecord(run, {
        kind: 'approval',
        id: this.buildStageApprovalId(run, stage),
        status: input.action === 'approve' ? 'approved' : 'blocked',
        summary: String(input.summary || '').trim() || `Aprovacao da etapa ${stage.label} registrada.`,
        at: now,
        parentId: run.workflow_run_id,
        approvalId: this.buildStageApprovalId(run, stage),
        metadata: {
          event: input.action === 'approve' ? 'stage_approved' : 'stage_rejected',
          stageId: stage.id,
          stageLabel: stage.label,
          taskId: stage.task_id,
          workflowStatus: run.status,
        },
      }),
      this.buildWorkflowLifecycleRecord(run, {
        kind: 'run',
        status: this.mapWorkflowStatusToLifecycle(run.status),
        summary: input.action === 'approve'
          ? `Workflow ${run.workflow_name} liberado para continuar.`
          : `Workflow ${run.workflow_name} bloqueado por rejeicao.`,
        at: now,
        metadata: {
          event: input.action === 'approve' ? 'stage_approved' : 'stage_rejected',
          stageId: stage.id,
          stageLabel: stage.label,
        },
      }),
    ]);
    this.persistRun(run, input.action === 'approve' ? 'stage_approved' : 'stage_rejected');
    return run;
  }

  public closeRun(input: {
    workflowRunId: string;
    reason?: string | null;
    surface?: string | null;
  }): WorkflowRunSnapshot | null {
    const workflowRunId = String(input.workflowRunId || '').trim();
    if (!workflowRunId) {
      return null;
    }

    const run = this.getRun(workflowRunId);
    if (!run) {
      return null;
    }

    if (!['blocked', 'failed'].includes(run.status)) {
      return run;
    }

    const now = this.runtime.now().toISOString();
    run.operator_state = 'closed';
    run.operator_closed_at = now;
    run.operator_close_reason = String(input.reason || '').trim() || 'workflow encerrado pelo operador';
    run.operator_closed_by_surface = String(input.surface || '').trim() || null;
    run.updated_at = now;
    this.syncRunDerivedState(run);
    this.appendLifecycle(run, this.buildWorkflowLifecycleRecord(run, {
      kind: 'run',
      status: this.mapWorkflowStatusToLifecycle(run.status),
      summary: run.operator_close_reason,
      at: now,
      metadata: {
        event: 'run_closed',
        surface: run.operator_closed_by_surface,
        operatorState: run.operator_state,
      },
    }));
    this.persistRun(run, 'run_closed');
    return run;
  }

  public async broadcast(message: string, roles: string[] = ['admin']): Promise<void> {
    const recipients = this.resolveBroadcastRecipients(roles);

    for (const userId of recipients) {
      try {
        await SmartOutputService.send(this.runtime.botApi as any, userId, message);
      } catch (error: any) {
        this.runtime.logRepo?.log?.('error', 'BotGateway', `Erro ao enviar broadcast: ${error.message}`);
      }
    }
  }

  public async sendToChat(chatId: string, message: string): Promise<void> {
    try {
      await SmartOutputService.send(this.runtime.botApi as any, chatId, message);
    } catch (error: any) {
      this.runtime.logRepo?.log?.('error', 'BotGateway', `Erro ao enviar mensagem direta para ${chatId}: ${error.message}`);
      throw error;
    }
  }

  public buildTaskMetadata(
    run: WorkflowRunSnapshot,
    stage: WorkflowStageDefinition,
    stageIndex: number,
    handoffSummary: string | null,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): Record<string, any> {
    const correlation = this.buildRunCorrelation(run);
    return {
      workflow_run_id: run.workflow_run_id,
      workflow_name: run.workflow_name,
      workflow_run_state_file: this.getRunStateFilePath(run.workflow_run_id),
      workflow_run_compatibility_file: this.getRunFilePath(run.workflow_run_id),
      workflow_run_state_dir: this.getRunStateDirectory(run.workflow_run_id),
      workflow_run_checkpoints_file: this.getRunCheckpointsFilePath(run.workflow_run_id),
      workflow_run_ledger_file: this.getRunLedgerFilePath(run.workflow_run_id),
      workflow_run_checkpoint_count: Number(run.externalized_state?.checkpoint_count || 0),
      workflow_run_latest_chain_hash: run.externalized_state?.latest_chain_hash || null,
      workflow_origin: run.origin,
      workflow_origin_task_id: run.origin.origin_task_id,
      workflow_origin_user_id: run.origin.origin_user_id,
      workflow_runtime_user_id: run.origin.runtime_user_id,
      workflow_tenant_id: run.origin.tenant_id,
      workflow_source_surface: run.origin.source_surface,
      workflow_route_strategy: run.origin.route_strategy,
      workflow_route_source: run.origin.route_source,
      workflow_parent_chat_id: run.origin.parent_chat_id,
      workflow_trigger_task_kind: run.trigger.task_kind,
      workflow_trigger_task_subtype: run.trigger.task_subtype,
      workflow_trigger_feature_id: run.trigger.feature_id,
      workflow_stage_id: stage.id,
      workflow_stage_label: stage.label,
      workflow_stage_executor: stage.executor,
      workflow_stage_role: stage.role,
      workflow_stage_index: stageIndex + 1,
      workflow_stage_total: run.stages.length,
      workflow_handoff_summary: handoffSummary || null,
      workflow_status: run.status,
      traceId: correlation.traceId,
      runId: correlation.runId,
      sessionId: correlation.sessionId,
      workflow_resume_stage_id: run.resume_stage?.id || null,
      workflow_resume_stage_label: run.resume_stage?.label || null,
      workflow_resume_stage_status: run.resume_stage?.status || null,
      workflow_resume_stage_index: Number.isFinite(run.resume_stage?.index) ? Number(run.resume_stage?.index) + 1 : null,
      workflow_resume_stage_summary: run.resume_stage?.result_summary || run.resume_stage?.handoff_summary || null,
      workflow_resume_prompt: run.resume_prompt,
      workflow_stage_strategy_note: stage.strategy_note || null,
      workflow_artifacts_manifest: run.artifacts_manifest,
      workflow_execution_lifecycle: Array.isArray(run.execution_lifecycle)
        ? run.execution_lifecycle.slice(-25)
        : [],
      workflow_workspace_context: workspaceContext || null,
      workflow_workspace_context_summary: this.buildWorkspaceContextSummary(workspaceContext),
    };
  }

  public buildPlanNotes(
    run: WorkflowRunSnapshot,
    stage: WorkflowStageDefinition,
    handoffSummary: string | null,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): string[] {
    return [
      `workflow_run_id=${run.workflow_run_id}`,
      `workflow=${run.workflow_name}`,
      `stage=${stage.id}`,
      run.trigger.feature_id ? `feature=${run.trigger.feature_id}` : null,
      handoffSummary ? `handoff=${handoffSummary}` : null,
      stage.strategy_note ? `workflow_stage_strategy=${stage.strategy_note}` : null,
      ...this.buildWorkspaceContextNotes(workspaceContext),
    ].filter((value): value is string => Boolean(value));
  }

  public buildCompletionSummary(run: WorkflowRunSnapshot): { lead: string; details: string[] } {
    const lead =
      run.status === 'completed'
        ? 'Workflow concluido com todas as etapas finalizadas.'
        : run.status === 'approval_pending'
        ? 'Workflow pausado aguardando aprovacao.'
        : 'Workflow interrompido antes do fechamento completo.';

    const details = [
      `Run: ${run.workflow_run_id}`,
      `Etapas concluidas: ${run.stages.filter((stage) => stage.status === 'completed').length}/${run.stages.length}`,
      run.resume_stage ? `Retomada sugerida: ${run.resume_stage.label}` : null,
      run.resume_stage?.reason ? `Motivo: ${run.resume_stage.reason}` : null,
      run.artifacts.length > 0 ? `Entregas agregadas: ${run.artifacts.length}` : null,
      run.artifacts_manifest?.primary_artifact_name
        ? `Entrega principal: ${String(run.artifacts_manifest.primary_artifact_name)}`
        : null,
    ].filter((value): value is string => Boolean(value));

    return { lead, details };
  }

  public normalizeOrigin(value: Partial<WorkflowRunSnapshot['origin']> | null | undefined): WorkflowRunSnapshot['origin'] {
    return {
      origin_task_id: this.normalizeNullableString(value?.origin_task_id),
      origin_user_id: this.normalizeNullableString(value?.origin_user_id),
      runtime_user_id: this.normalizeNullableString(value?.runtime_user_id),
      tenant_id: this.normalizeNullableString(value?.tenant_id),
      source_surface: this.normalizeNullableString(value?.source_surface),
      route_strategy: this.normalizeNullableString(value?.route_strategy),
      route_source: this.normalizeNullableString(value?.route_source),
      parent_chat_id: this.normalizeNullableString(value?.parent_chat_id),
    };
  }

  public normalizeTrigger(value: Partial<WorkflowRunSnapshot['trigger']> | null | undefined): WorkflowRunSnapshot['trigger'] {
    return {
      task_kind: this.normalizeNullableString(value?.task_kind),
      task_subtype: this.normalizeNullableString(value?.task_subtype),
      feature_id: this.normalizeNullableString(value?.feature_id),
    };
  }

  public normalizeNullableString(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }

  public syncRunDerivedState(run: WorkflowRunSnapshot): void {
    WorkflowRunStageStateSupport.syncRunDerivedState(run);
  }

  public resolveResumeStage(run: WorkflowRunSnapshot): WorkflowRunResumeStageSnapshot | null {
    return WorkflowRunStageStateSupport.resolveResumeStage(run);
  }

  public resolveStageByDecisionReference(
    run: WorkflowRunSnapshot,
    input: {
      stageId?: string | null;
      taskId?: string | null;
    },
  ): WorkflowRunSnapshot['stages'][number] | null {
    return WorkflowRunStageStateSupport.resolveStageByDecisionReference(run, input);
  }

  public describeResumeStageReason(status: WorkflowRunResumeStageSnapshot['status']): string {
    return WorkflowRunStageStateSupport.describeResumeStageReason(status);
  }

  public resolveActionableStages(run: WorkflowRunSnapshot): WorkflowRunActionableStageSnapshot[] {
    return WorkflowRunStageStateSupport.resolveActionableStages(run);
  }

  public describeActionableStageReason(
    stage: WorkflowRunSnapshot['stages'][number],
  ): string {
    return WorkflowRunStageStateSupport.describeActionableStageReason(stage);
  }

  public describeActionableStageAction(
    status: WorkflowRunActionableStageSnapshot['status'],
  ): WorkflowRunActionableStageSnapshot['action'] {
    return WorkflowRunStageStateSupport.describeActionableStageAction(status);
  }

  public buildResumePrompt(
    run: WorkflowRunSnapshot,
    stage: WorkflowRunResumeStageSnapshot,
  ): string {
    return WorkflowRunStageStateSupport.buildResumePrompt(run, stage);
  }

  public buildRunCorrelation(
    run: WorkflowRunSnapshot,
    input: { approvalId?: string | null; artifactId?: string | null } = {},
  ): ZavorthExecutionCorrelation {
    return WorkflowRunLifecycleSupport.buildRunCorrelation(run, input);
  }

  public buildWorkflowLifecycleRecord(
    run: WorkflowRunSnapshot,
    input: {
      kind: 'run' | 'execution' | 'approval';
      status: ZavorthExecutionLifecycleStatus;
      summary: string;
      id?: string | null;
      at?: string | null;
      parentId?: string | null;
      source?: string | null;
      approvalId?: string | null;
      artifactId?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): ExecutionLifecycleRecord {
    return WorkflowRunLifecycleSupport.buildWorkflowLifecycleRecord(run, input);
  }

  public appendLifecycle(
    run: WorkflowRunSnapshot,
    records: ExecutionLifecycleRecord | ExecutionLifecycleRecord[] | null,
  ): void {
    WorkflowRunLifecycleSupport.appendLifecycle(run, records);
  }

  public normalizeLifecycleRecords(value: unknown): ExecutionLifecycleRecord[] {
    return WorkflowRunLifecycleSupport.normalizeLifecycleRecords(value);
  }

  public normalizeLifecycleKind(value: unknown): 'run' | 'execution' | 'approval' {
    return WorkflowRunLifecycleSupport.normalizeLifecycleKind(value);
  }

  public normalizeLifecycleStatus(value: unknown): ZavorthExecutionLifecycleStatus {
    return WorkflowRunLifecycleSupport.normalizeLifecycleStatus(value);
  }

  public mapWorkflowStatusToLifecycle(
    status: WorkflowRunSnapshot['status'],
  ): ZavorthExecutionLifecycleStatus {
    return WorkflowRunLifecycleSupport.mapWorkflowStatusToLifecycle(status);
  }

  public buildStageExecutionId(
    run: WorkflowRunSnapshot,
    stage: WorkflowRunStageSnapshot,
  ): string {
    return WorkflowRunLifecycleSupport.buildStageExecutionId(run, stage);
  }

  public buildStageApprovalId(
    run: WorkflowRunSnapshot,
    stage: WorkflowRunStageSnapshot,
  ): string {
    return WorkflowRunLifecycleSupport.buildStageApprovalId(run, stage);
  }

  public persistRun(run: WorkflowRunSnapshot, event: string = 'state_updated'): void {
    if (this.runtime.persistEnabled) {
      try {
        run.externalized_state = this.runtime.externalizedState.persist(run, event);
      } catch {
        run.externalized_state = run.externalized_state || this.runtime.externalizedState.describe(run.workflow_run_id);
      }
    } else {
      run.externalized_state = run.externalized_state || this.runtime.externalizedState.describe(run.workflow_run_id);
    }

    this.runtime.inMemoryRuns.set(run.workflow_run_id, this.cloneRun(run));
  }

  public readAllRuns(): WorkflowRunSnapshot[] {
    const inMemoryRuns = Array.from(this.runtime.inMemoryRuns.values()).map((run) => this.cloneRun(run));
    if (!fs.existsSync(this.runtime.storageDir)) {
      return inMemoryRuns;
    }

    const diskRuns = this.runtime.externalizedState.readAllRuns()
      .map((run) => {
        try {
          return this.normalizeRun(run as WorkflowRunSnapshot);
        } catch {
          return null;
        }
      })
      .filter((run): run is WorkflowRunSnapshot => Boolean(run));

    const merged = new Map<string, WorkflowRunSnapshot>();
    for (const run of inMemoryRuns) {
      merged.set(run.workflow_run_id, run);
    }
    for (const run of diskRuns) {
      merged.set(run.workflow_run_id, run);
    }

    return Array.from(merged.values());
  }

  public cloneRun(run: WorkflowRunSnapshot): WorkflowRunSnapshot {
    return this.normalizeRun(JSON.parse(JSON.stringify(run)) as WorkflowRunSnapshot);
  }

  public getRunFilePath(workflowRunId: string): string {
    const safeId = String(workflowRunId || '').trim().replace(/[^a-z0-9._-]+/gi, '-');
    return path.join(this.runtime.storageDir, `${safeId}.json`);
  }

  public getRunStateDirectory(workflowRunId: string): string {
    return path.join(this.runtime.storageDir, String(workflowRunId || '').trim().replace(/[^a-z0-9._-]+/gi, '-'));
  }

  public getRunStateFilePath(workflowRunId: string): string {
    return path.join(this.getRunStateDirectory(workflowRunId), 'state.json');
  }

  public getRunCheckpointsFilePath(workflowRunId: string): string {
    return path.join(this.getRunStateDirectory(workflowRunId), 'checkpoints.ndjson');
  }

  public getRunLedgerFilePath(workflowRunId: string): string {
    return path.join(this.getRunStateDirectory(workflowRunId), 'ledger.json');
  }

  public buildWorkspaceContextSummary(workspaceContext?: WorkflowWorkspaceContext | null): string | null {
    if (!workspaceContext) {
      return null;
    }

    const parts = [
      workspaceContext.profile_summary ? `perfil ${workspaceContext.profile_summary}` : null,
      workspaceContext.operational_summary ? `memoria ${workspaceContext.operational_summary}` : null,
      workspaceContext.active_focus ? `foco ${workspaceContext.active_focus.summary}` : null,
      workspaceContext.recent_artifact ? `entrega ${workspaceContext.recent_artifact.name}` : null,
      workspaceContext.continuity_recommendation ? `continuidade ${workspaceContext.continuity_recommendation.label}` : null,
    ].filter((value): value is string => Boolean(value));

    return parts.length > 0 ? parts.join(' | ') : null;
  }

  public buildWorkspaceContextNotes(workspaceContext?: WorkflowWorkspaceContext | null): string[] {
    if (!workspaceContext) {
      return [];
    }

    return [
      workspaceContext.profile_summary ? `workspace_profile=${workspaceContext.profile_summary}` : null,
      workspaceContext.operational_summary ? `workspace_memory=${workspaceContext.operational_summary}` : null,
      workspaceContext.active_focus
        ? `workspace_focus=${workspaceContext.active_focus.summary}`
        : null,
      workspaceContext.recent_artifact
        ? `workspace_recent_artifact=${workspaceContext.recent_artifact.name}`
        : null,
      workspaceContext.continuity_recommendation
        ? `workspace_continuity=${workspaceContext.continuity_recommendation.label}`
        : null,
    ].filter((value): value is string => Boolean(value));
  }
}
