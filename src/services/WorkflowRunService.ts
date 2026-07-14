import type { ExecutionResult } from "../contracts/ExecutionContract.js";
import {
  buildExecutionLifecycleRecord,
  createExecutionCorrelation,
  type ZavorthExecutionCorrelation,
  type ZavorthExecutionLifecycleStatus,
  type ExecutionLifecycleRecord,
} from "../contracts/ExecutionLifecycleContract.js";
import { config } from "../config/index.js";

import { ArtifactPipelineService } from "../runtime/artifacts/ArtifactPipelineService.js";
import { WorkflowExternalizedStateService } from "./WorkflowExternalizedStateService.js";
import { WorkflowRunSupport } from "./workflow-run/WorkflowRunSupport.js";
import type {
  WorkflowKind,
  WorkflowRunActionableStageSnapshot,
  WorkflowRunCreateOptions,
  WorkflowRunOriginSnapshot,
  WorkflowRunResumeStageSnapshot,
  WorkflowRunServiceRuntime,
  WorkflowRunSnapshot,
  WorkflowRunTriggerSnapshot,
  WorkflowStageDecisionAction,
  WorkflowStageDefinition,
  WorkflowStageStatus,
  WorkflowWorkspaceContext,
} from "./workflow-run/WorkflowRunTypes.js";

export type {
  WorkflowKind,
  WorkflowRunActionableStageSnapshot,
  WorkflowRunCreateOptions,
  WorkflowRunOriginSnapshot,
  WorkflowRunResumeStageSnapshot,
  WorkflowRunServiceRuntime,
  WorkflowRunSnapshot,
  WorkflowRunStageSnapshot,
  WorkflowRunTriggerSnapshot,
  WorkflowStageDecisionAction,
  WorkflowStageDefinition,
  WorkflowStageExecutor,
  WorkflowStageStatus,
  WorkflowWorkspaceApprovalFrictionRecommendation,
  WorkflowWorkspaceContext,
  WorkflowWorkspaceExecutorRecommendation,
  WorkflowWorkspaceFrictionRecommendation,
  WorkflowWorkspaceStageExecutorRecommendation,
} from "./workflow-run/WorkflowRunTypes.js";

export class WorkflowRunService {
  private artifactPipeline = new ArtifactPipelineService();
  private readonly storageDir: string;
  private readonly persistEnabled: boolean;
  private readonly now: () => Date;
  private readonly inMemoryRuns = new Map<string, WorkflowRunSnapshot>();
  private readonly externalizedState: WorkflowExternalizedStateService;
  private readonly workflowRunSupport: WorkflowRunSupport;

  constructor(runtime: WorkflowRunServiceRuntime = {}) {
    this.storageDir = runtime.storageDir || config.workflowRunDir;
    this.persistEnabled =
      runtime.persist ?? !Boolean(process.env.JEST_WORKER_ID);
    this.now = runtime.now || (() => new Date());
    this.externalizedState = new WorkflowExternalizedStateService({
      storageDir: this.storageDir,
      now: this.now,
    });
    this.workflowRunSupport = new WorkflowRunSupport({
      artifactPipeline: this.artifactPipeline,
      storageDir: this.storageDir,
      persistEnabled: this.persistEnabled,
      now: this.now,
      inMemoryRuns: this.inMemoryRuns,
      externalizedState: this.externalizedState,
    });
  }

  public createRun(
    workflow: WorkflowKind,
    objective: string,
    workspace: string,
    phases: WorkflowStageDefinition[],
    workspaceContext?: WorkflowWorkspaceContext | null,
    options: WorkflowRunCreateOptions = {},
  ): WorkflowRunSnapshot {
    const now = this.now().toISOString();
    const workflowRunId = this.buildRunId(workflow);

    const run: WorkflowRunSnapshot = {
      workflow_run_id: workflowRunId,
      workflow_name: workflow,
      objective,
      workspace,
      origin: this.normalizeOrigin(options.origin),
      trigger: this.normalizeTrigger(options.trigger),
      workspace_context: workspaceContext || null,
      created_at: now,
      updated_at: now,
      status: "running",
      operator_state: "active",
      operator_closed_at: null,
      operator_close_reason: null,
      operator_closed_by_surface: null,
      phases: phases.map((phase, index) => ({
        id: phase.id,
        label: phase.label,
        executor: phase.executor,
        role: phase.role,
        strategy_note: phase.strategy_note || null,
        index,
        status: "pending",
        task_id: null,
        attempt_count: 0,
        objective: null,
        handoff_summary: null,
        started_at: null,
        finished_at: null,
        result_summary: null,
        artifact_count: 0,
      })),
      resume_stage: null,
      actionable_stages: [],
      resume_prompt: null,
      artifacts: [],
      artifacts_manifest: this.artifactPipeline.buildManifest([], {
        traceId: workflowRunId,
        runId: workflowRunId,
        source: "workflow-run",
      }),
      execution_lifecycle: [],
      externalized_state: null,
    };

    this.syncRunDerivedState(run);
    this.appendLifecycle(
      run,
      this.buildWorkflowLifecycleRecord(run, {
        kind: "run",
        status: "planned",
        summary: `Workflow ${run.workflow_name} criado.`,
        at: now,
        metadata: {
          event: "run_created",
          workspace: run.workspace,
        },
      }),
    );
    this.persistRun(run, "run_created");
    return run;
  }

  public markStageStarted(
    run: WorkflowRunSnapshot,
    stageId: string,
    objective: string,
    handoffSummary: string | null,
    taskId?: string | null,
  ): void {
    const phase = run.phases.find((entry) => entry.id === stageId);
    if (!phase) {
      return;
    }

    const now = this.now().toISOString();
    phase.status = "running";
    phase.task_id = String(taskId || "").trim() || phase.task_id || null;
    phase.attempt_count = Math.max(0, Number(phase.attempt_count || 0)) + 1;
    phase.objective = objective;
    phase.handoff_summary = handoffSummary || null;
    phase.started_at = phase.started_at || now;
    phase.finished_at = null;
    phase.result_summary = null;
    run.updated_at = now;
    this.syncRunDerivedState(run);
    this.appendLifecycle(
      run,
      this.buildWorkflowLifecycleRecord(run, {
        kind: "execution",
        id: this.buildStageExecutionId(run, phase),
        status: "running",
        summary: `Etapa ${phase.label} iniciada.`,
        at: now,
        parentId: run.workflow_run_id,
        metadata: {
          event: "stage_started",
          stageId: phase.id,
          stageLabel: phase.label,
          executor: phase.executor,
          attemptCount: phase.attempt_count,
          taskId: phase.task_id,
          objective,
        },
      }),
    );
    this.persistRun(run, "stage_started");
  }

  public markStageCompleted(
    run: WorkflowRunSnapshot,
    stageId: string,
    result: ExecutionResult,
    summary: string,
  ): void {
    const phase = run.phases.find((entry) => entry.id === stageId);
    if (!phase) {
      return;
    }

    const now = this.now().toISOString();
    phase.status = "completed";
    phase.task_id =
      String(result.task_id || "").trim() || phase.task_id || null;
    phase.finished_at = now;
    phase.result_summary = summary;
    const normalizedArtifacts = this.artifactPipeline.normalizeArtifacts(
      Array.isArray(result.artifacts) ? result.artifacts : [],
      phase.executor,
    );
    phase.artifact_count = normalizedArtifacts.length;
    run.artifacts = this.artifactPipeline.normalizeArtifacts(
      [...run.artifacts, ...normalizedArtifacts],
      "workflow",
    );
    run.artifacts_manifest = this.artifactPipeline.buildManifest(
      run.artifacts,
      this.buildRunArtifactContext(run, phase.executor),
    );
    run.updated_at = now;
    this.syncRunDerivedState(run);
    this.appendLifecycle(run, [
      this.buildWorkflowLifecycleRecord(run, {
        kind: "execution",
        id: this.buildStageExecutionId(run, phase),
        status: "completed",
        summary: `Etapa ${phase.label} concluida.`,
        at: now,
        parentId: run.workflow_run_id,
        metadata: {
          event: "stage_completed",
          stageId: phase.id,
          stageLabel: phase.label,
          executor: phase.executor,
          attemptCount: phase.attempt_count,
          taskId: phase.task_id,
          artifactCount: normalizedArtifacts.length,
          executionId: String(result.execution_id || "").trim() || null,
        },
      }),
      this.buildWorkflowLifecycleRecord(run, {
        kind: "run",
        status: run.status === "completed" ? "completed" : "running",
        summary:
          run.status === "completed"
            ? `Workflow ${run.workflow_name} completed.`
            : `Workflow ${run.workflow_name} segue em execucao.`,
        at: now,
        metadata: {
          event: "stage_completed",
          stageId: phase.id,
          stageLabel: phase.label,
        },
      }),
    ]);
    this.persistRun(run, "stage_completed");
  }

  public seedStageCompleted(
    run: WorkflowRunSnapshot,
    stageId: string,
    input: {
      summary: string;
      objective?: string | null;
      handoffSummary?: string | null;
      taskId?: string | null;
    },
  ): void {
    const phase = run.phases.find((entry) => entry.id === stageId);
    if (!phase) {
      return;
    }

    const now = this.now().toISOString();
    phase.status = "completed";
    phase.task_id = String(input.taskId || "").trim() || phase.task_id || null;
    phase.attempt_count = Math.max(1, Number(phase.attempt_count || 0) || 0);
    phase.objective =
      String(input.objective || "").trim() || phase.objective || null;
    phase.handoff_summary =
      String(input.handoffSummary || "").trim() ||
      phase.handoff_summary ||
      null;
    phase.started_at = phase.started_at || now;
    phase.finished_at = now;
    phase.result_summary =
      String(input.summary || "").trim() || phase.result_summary || null;
    phase.artifact_count = phase.artifact_count || 0;
    run.updated_at = now;
    this.syncRunDerivedState(run);
    this.appendLifecycle(run, [
      this.buildWorkflowLifecycleRecord(run, {
        kind: "execution",
        id: this.buildStageExecutionId(run, phase),
        status: "completed",
        summary: `Etapa ${phase.label} seeded como concluida.`,
        at: now,
        parentId: run.workflow_run_id,
        metadata: {
          event: "stage_seeded_completed",
          stageId: phase.id,
          stageLabel: phase.label,
          executor: phase.executor,
          attemptCount: phase.attempt_count,
          taskId: phase.task_id,
        },
      }),
      this.buildWorkflowLifecycleRecord(run, {
        kind: "run",
        status: run.status === "completed" ? "completed" : "running",
        summary:
          run.status === "completed"
            ? `Workflow ${run.workflow_name} completed por seed de etapa.`
            : `Workflow ${run.workflow_name} segue em execucao.`,
        at: now,
        metadata: {
          event: "stage_seeded_completed",
          stageId: phase.id,
        },
      }),
    ]);
    this.persistRun(run, "stage_seeded_completed");
  }

  public markStageInterrupted(
    run: WorkflowRunSnapshot,
    stageId: string,
    status: "blocked" | "failed" | "approval_pending",
    summary: string,
  ): void {
    this.workflowRunSupport.markStageInterrupted(run, stageId, status, summary);
  }

  public applyStageApprovalDecision(input: {
    workflowRunId: string;
    stageId?: string | null;
    taskId?: string | null;
    action: WorkflowStageDecisionAction;
    summary: string;
  }): WorkflowRunSnapshot | null {
    return this.workflowRunSupport.applyStageApprovalDecision(input);
  }

  public closeRun(input: {
    workflowRunId: string;
    reason?: string | null;
    surface?: string | null;
  }): WorkflowRunSnapshot | null {
    return this.workflowRunSupport.closeRun(input);
  }

  public getRun(workflowRunId: string): WorkflowRunSnapshot | null {
    return this.workflowRunSupport.getRun(workflowRunId);
  }

  public listRuns(
    input: {
      workspace?: string | null;
      limit?: number;
      statuses?: WorkflowRunSnapshot["status"][];
    } = {},
  ): WorkflowRunSnapshot[] {
    const workspace = String(input.workspace || "").trim();
    const limit = Math.max(
      1,
      Math.min(Number.isFinite(input.limit) ? Number(input.limit) : 20, 100),
    );
    const allowedStatuses = Array.isArray(input.statuses)
      ? new Set(
          input.statuses
            .map((value) => String(value || "").trim())
            .filter(Boolean),
        )
      : null;
    const runs = this.readAllRuns()
      .filter((run) => {
        if (workspace && run.workspace !== workspace) {
          return false;
        }
        if (
          allowedStatuses &&
          !allowedStatuses.has(String(run.status || "").trim())
        ) {
          return false;
        }
        return true;
      })
      .sort((left, right) =>
        String(right.updated_at || "").localeCompare(
          String(left.updated_at || ""),
        ),
      );

    return runs.slice(0, limit);
  }

  public buildTaskMetadata(
    run: WorkflowRunSnapshot,
    phase: WorkflowStageDefinition,
    stageIndex: number,
    handoffSummary: string | null,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): Record<string, any> {
    return this.workflowRunSupport.buildTaskMetadata(
      run,
      phase,
      stageIndex,
      handoffSummary,
      workspaceContext,
    );
  }

  public buildPlanNotes(
    run: WorkflowRunSnapshot,
    phase: WorkflowStageDefinition,
    handoffSummary: string | null,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): string[] {
    return this.workflowRunSupport.buildPlanNotes(
      run,
      phase,
      handoffSummary,
      workspaceContext,
    );
  }

  public buildCompletionSummary(run: WorkflowRunSnapshot): {
    lead: string;
    details: string[];
  } {
    return this.workflowRunSupport.buildCompletionSummary(run);
  }

  private buildRunId(workflow: WorkflowKind): string {
    return this.workflowRunSupport.buildRunId(workflow);
  }

  private normalizeRun(run: WorkflowRunSnapshot): WorkflowRunSnapshot {
    return this.workflowRunSupport.normalizeRun(run);
  }

  private buildRunArtifactContext(
    run: WorkflowRunSnapshot,
    source: string | null = "workflow",
  ) {
    return this.workflowRunSupport.buildRunArtifactContext(run, source);
  }

  private normalizeOrigin(
    value: Partial<WorkflowRunOriginSnapshot> | null | undefined,
  ): WorkflowRunOriginSnapshot {
    return this.workflowRunSupport.normalizeOrigin(value);
  }

  private normalizeTrigger(
    value: Partial<WorkflowRunTriggerSnapshot> | null | undefined,
  ): WorkflowRunTriggerSnapshot {
    return this.workflowRunSupport.normalizeTrigger(value);
  }

  private normalizeNullableString(value: unknown): string | null {
    return this.workflowRunSupport.normalizeNullableString(value);
  }

  private syncRunDerivedState(run: WorkflowRunSnapshot): void {
    this.workflowRunSupport.syncRunDerivedState(run);
  }

  private resolveResumeStage(
    run: WorkflowRunSnapshot,
  ): WorkflowRunResumeStageSnapshot | null {
    return this.workflowRunSupport.resolveResumeStage(run);
  }

  private resolveStageByDecisionReference(
    run: WorkflowRunSnapshot,
    input: {
      stageId?: string | null;
      taskId?: string | null;
    },
  ): WorkflowRunSnapshot["phases"][number] | null {
    return this.workflowRunSupport.resolveStageByDecisionReference(run, input);
  }

  private describeResumeStageReason(
    status: WorkflowRunResumeStageSnapshot["status"],
  ): string {
    return this.workflowRunSupport.describeResumeStageReason(status);
  }

  private resolveActionableStages(
    run: WorkflowRunSnapshot,
  ): WorkflowRunActionableStageSnapshot[] {
    return this.workflowRunSupport.resolveActionableStages(run);
  }

  private describeActionableStageReason(
    phase: WorkflowRunSnapshot["phases"][number],
  ): string {
    return this.workflowRunSupport.describeActionableStageReason(phase);
  }

  private describeActionableStageAction(
    status: WorkflowRunActionableStageSnapshot["status"],
  ): WorkflowRunActionableStageSnapshot["action"] {
    return this.workflowRunSupport.describeActionableStageAction(status);
  }

  private buildResumePrompt(
    run: WorkflowRunSnapshot,
    phase: WorkflowRunResumeStageSnapshot,
  ): string {
    return this.workflowRunSupport.buildResumePrompt(run, phase);
  }

  private persistRun(
    run: WorkflowRunSnapshot,
    event: string = "state_updated",
  ): void {
    this.workflowRunSupport.persistRun(run, event);
  }

  private readAllRuns(): WorkflowRunSnapshot[] {
    return this.workflowRunSupport.readAllRuns();
  }

  private getRunFilePath(workflowRunId: string): string {
    return this.workflowRunSupport.getRunFilePath(workflowRunId);
  }

  private getRunStateDirectory(workflowRunId: string): string {
    return this.workflowRunSupport.getRunStateDirectory(workflowRunId);
  }

  private getRunStateFilePath(workflowRunId: string): string {
    return this.workflowRunSupport.getRunStateFilePath(workflowRunId);
  }

  private getRunCheckpointsFilePath(workflowRunId: string): string {
    return this.workflowRunSupport.getRunCheckpointsFilePath(workflowRunId);
  }

  private getRunLedgerFilePath(workflowRunId: string): string {
    return this.workflowRunSupport.getRunLedgerFilePath(workflowRunId);
  }

  private cloneRun(run: WorkflowRunSnapshot): WorkflowRunSnapshot {
    return this.workflowRunSupport.cloneRun(run);
  }

  private buildRunCorrelation(
    run: WorkflowRunSnapshot,
    input: { approvalId?: string | null; artifactId?: string | null } = {},
  ): ZavorthExecutionCorrelation {
    return this.workflowRunSupport.buildRunCorrelation(run, input);
  }

  private buildWorkflowLifecycleRecord(
    run: WorkflowRunSnapshot,
    input: {
      kind: "run" | "execution" | "approval";
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
    return this.workflowRunSupport.buildWorkflowLifecycleRecord(run, input);
  }

  private appendLifecycle(
    run: WorkflowRunSnapshot,
    records: ExecutionLifecycleRecord | ExecutionLifecycleRecord[] | null,
  ): void {
    this.workflowRunSupport.appendLifecycle(run, records);
  }

  private normalizeLifecycleRecords(
    value: unknown,
  ): ExecutionLifecycleRecord[] {
    return this.workflowRunSupport.normalizeLifecycleRecords(value);
  }

  private normalizeLifecycleKind(
    value: unknown,
  ): "run" | "execution" | "approval" {
    return this.workflowRunSupport.normalizeLifecycleKind(value);
  }

  private normalizeLifecycleStatus(
    value: unknown,
  ): ZavorthExecutionLifecycleStatus {
    return this.workflowRunSupport.normalizeLifecycleStatus(value);
  }

  private mapWorkflowStatusToLifecycle(
    status: WorkflowRunSnapshot["status"],
  ): ZavorthExecutionLifecycleStatus {
    return this.workflowRunSupport.mapWorkflowStatusToLifecycle(status);
  }

  private buildStageExecutionId(
    run: WorkflowRunSnapshot,
    phase: WorkflowRunSnapshot["phases"][number],
  ): string {
    return this.workflowRunSupport.buildStageExecutionId(run, phase);
  }

  private buildStageApprovalId(
    run: WorkflowRunSnapshot,
    phase: WorkflowRunSnapshot["phases"][number],
  ): string {
    return this.workflowRunSupport.buildStageApprovalId(run, phase);
  }

  private buildWorkspaceContextSummary(
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): string | null {
    return this.workflowRunSupport.buildWorkspaceContextSummary(
      workspaceContext,
    );
  }

  private buildWorkspaceContextNotes(
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): string[] {
    return this.workflowRunSupport.buildWorkspaceContextNotes(workspaceContext);
  }
}
