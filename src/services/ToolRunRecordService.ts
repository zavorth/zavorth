import type { WorkflowRunSnapshot } from '../runtime/workflows/WorkflowRunService.js';

export type ToolRunDiffPatch = {
  path: string | null;
  diff: string;
  summary: string | null;
};

export type ToolRunRecord = {
  runId: string;
  taskId: string | null;
  workflowRunId: string | null;
  source: string;
  executor: string | null;
  toolName: string;
  kind: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  workspace: string | null;
  summary: string | null;
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  filesTouched: string[];
  artifacts: Array<Record<string, any>>;
  diff: {
    summary: string | null;
    patches: ToolRunDiffPatch[];
  };
  approval: {
    required: boolean;
    status: string | null;
    permissionId: string | null;
  };
};

type BuildToolRunsInput = {
  tasks: any[];
  workflowRuns: WorkflowRunSnapshot[];
};

export class ToolRunRecordService {
  public buildToolRuns(input: BuildToolRunsInput): ToolRunRecord[] {
    const records = new Map<string, ToolRunRecord>();
    const tasks = Array.isArray(input.tasks) ? input.tasks : [];
    const workflowRuns = Array.isArray(input.workflowRuns) ? input.workflowRuns : [];

    for (const task of tasks) {
      for (const record of this.buildTaskToolRuns(task)) {
        records.set(record.runId, record);
      }
    }

    for (const workflowRun of workflowRuns) {
      for (const record of this.buildWorkflowStageRuns(workflowRun)) {
        if (!records.has(record.runId)) {
          records.set(record.runId, record);
        }
      }
    }

    return Array.from(records.values())
      .sort((left, right) => this.getTimestamp(right.finishedAt || right.startedAt) - this.getTimestamp(left.finishedAt || left.startedAt))
      .slice(0, 50);
  }

  private buildTaskToolRuns(task: any): ToolRunRecord[] {
    const actions = Array.isArray(task?.actions_executed) && task.actions_executed.length > 0
      ? task.actions_executed
      : [this.buildSyntheticAction(task)];
    return actions.map((action: any, index: number) => this.serializeTaskAction(task, action, index));
  }

  private buildSyntheticAction(task: any): Record<string, any> {
    return {
      name: task?.executor_used || task?.command_type || 'task',
      kind: task?.command_type || 'task',
      status: task?.status || null,
      started_at: task?.created_at || null,
      finished_at: task?.updated_at || null,
      stdout_summary: task?.stdout_summary || null,
      stderr_summary: task?.stderr_summary || null,
      diff_summary: task?.diff_summary || null,
      summary: task?.result_summary || task?.error_summary || null,
    };
  }

  private serializeTaskAction(task: any, action: any, index: number): ToolRunRecord {
    const metadata = this.toRecord(task?.metadata);
    const actionRecord = this.toRecord(action);
    const taskId = String(task?.task_id || '').trim() || null;
    const workflowRunId = this.normalizeNullableString(
      actionRecord.workflow_run_id
      || metadata.workflow_run_id
      || metadata.workflowRunId,
    );
    const toolName = this.normalizeNullableString(
      actionRecord.toolName
      || actionRecord.tool_name
      || actionRecord.tool
      || actionRecord.name
      || actionRecord.command
      || task?.executor_used
      || task?.command_type,
    ) || 'task';
    const kind = this.normalizeNullableString(
      actionRecord.kind
      || actionRecord.type
      || task?.command_type
      || 'tool',
    ) || 'tool';
    const startedAt = this.normalizeNullableString(
      actionRecord.started_at
      || actionRecord.startedAt
      || task?.created_at,
    );
    const finishedAt = this.normalizeNullableString(
      actionRecord.finished_at
      || actionRecord.finishedAt
      || task?.updated_at,
    );
    const filesTouched = this.collectFilesTouched([task?.target_files, actionRecord.files, actionRecord.target_files, actionRecord.changed_files, metadata.files_touched, metadata.filesTouched]);
    const artifacts = this.normalizeArtifacts(task?.artifacts, {
      sourceTaskId: taskId,
      workflowRunId,
      toolRunId: this.buildTaskRunId(taskId, index, toolName),
    });

    return {
      runId: this.buildTaskRunId(taskId, index, toolName),
      taskId,
      workflowRunId,
      source: this.normalizeNullableString(task?.source) || 'task',
      executor: this.normalizeNullableString(task?.executor_used || actionRecord.executor),
      toolName,
      kind,
      status: this.normalizeStatus(actionRecord.status || task?.status),
      startedAt,
      finishedAt,
      durationMs: this.resolveDurationMs(actionRecord, startedAt, finishedAt),
      workspace: this.normalizeNullableString(task?.workspace || actionRecord.workspace),
      summary: this.summarizeText(actionRecord.summary || task?.result_summary || task?.error_summary, 800),
      stdout: this.summarizeText(actionRecord.stdout || actionRecord.stdout_summary || task?.stdout_summary, 1_500),
      stderr: this.summarizeText(actionRecord.stderr || actionRecord.stderr_summary || task?.stderr_summary, 1_500),
      exitCode: this.normalizeNumber(actionRecord.exitCode ?? actionRecord.exit_code),
      filesTouched,
      artifacts,
      diff: {
        summary: this.summarizeText(actionRecord.diff_summary || task?.diff_summary || metadata.diff_summary, 1_000),
        patches: this.collectPatches([actionRecord.patches, actionRecord.diff_patches, this.toRecord(actionRecord.diff).patches, metadata.patches, metadata.diff_patches]),
      },
      approval: {
        required: task?.requires_approval === true || actionRecord.requires_approval === true,
        status: this.normalizeNullableString(actionRecord.approval_status || task?.approval_status),
        permissionId: this.normalizeNullableString(actionRecord.permission_id || metadata.pendingPermissionId || metadata.permission_id),
      },
    };
  }

  private buildWorkflowStageRuns(workflowRun: WorkflowRunSnapshot): ToolRunRecord[] {
    const workflowRunId = String(workflowRun?.workflow_run_id || '').trim();
    if (!workflowRunId || !Array.isArray(workflowRun?.phases)) {
      return [];
    }

    return workflowRun.phases.map((phase: any) => {
      const runId = `workflow-${this.safeSegment(workflowRunId)}-${this.safeSegment(phase?.id || 'phase')}-${Number(phase?.attempt_count || 0)}`;
      const stageArtifacts = this.normalizeArtifacts(workflowRun.artifacts, {
        sourceTaskId: phase?.task_id || null,
        workflowRunId,
        toolRunId: runId,
      });
      return {
        runId,
        taskId: this.normalizeNullableString(phase?.task_id),
        workflowRunId,
        source: 'workflow',
        executor: this.normalizeNullableString(phase?.executor),
        toolName: this.normalizeNullableString(phase?.label || phase?.id) || 'workflow-phase',
        kind: 'workflow-phase',
        status: this.normalizeStatus(phase?.status),
        startedAt: this.normalizeNullableString(phase?.started_at),
        finishedAt: this.normalizeNullableString(phase?.finished_at),
        durationMs: this.resolveDurationMs({}, phase?.started_at, phase?.finished_at),
        workspace: this.normalizeNullableString(workflowRun.workspace),
        summary: this.summarizeText(phase?.result_summary || phase?.handoff_summary || workflowRun.objective, 800),
        stdout: null,
        stderr: null,
        exitCode: null,
        filesTouched: this.collectFilesTouched([stageArtifacts.map((artifact) => artifact.path)]),
        artifacts: stageArtifacts,
        diff: {
          summary: null,
          patches: [],
        },
        approval: {
          required: String(phase?.status || '').trim() === 'approval_pending',
          status: String(phase?.status || '').trim() === 'approval_pending' ? 'pending' : null,
          permissionId: null,
        },
      };
    });
  }

  private buildTaskRunId(taskId: string | null, index: number, toolName: string): string {
    return `task-${this.safeSegment(taskId || 'unknown')}-${String(index + 1).padStart(2, '0')}-${this.safeSegment(toolName)}`;
  }

  private normalizeArtifacts(
    artifacts: unknown,
    extra: {
      sourceTaskId: string | null;
      workflowRunId: string | null;
      toolRunId: string;
    },
  ): Array<Record<string, any>> {
    if (!Array.isArray(artifacts)) {
      return [];
    }
    return artifacts
      .filter((artifact) => artifact && typeof artifact === 'object')
      .map((artifact) => ({
        ...(artifact as Record<string, any>),
        sourceTaskId: extra.sourceTaskId,
        workflowRunId: extra.workflowRunId,
        toolRunId: extra.toolRunId,
      }));
  }

  private collectFilesTouched(values: unknown[]): string[] {
    const files = new Set<string>();
    for (const value of values) {
      if (!value) {
        continue;
      }
      const entries = Array.isArray(value) ? value : [value];
      for (const entry of entries) {
        const normalized = String(entry || '').trim();
        if (normalized) {
          files.add(normalized);
        }
      }
    }
    return Array.from(files).slice(0, 100);
  }

  private collectPatches(values: unknown[]): ToolRunDiffPatch[] {
    const patches: ToolRunDiffPatch[] = [];
    for (const value of values) {
      if (!value) {
        continue;
      }
      const entries = Array.isArray(value) ? value : [value];
      for (const entry of entries) {
        if (typeof entry === 'string') {
          const diff = this.summarizeText(entry, 6_000);
          if (diff) {
            patches.push({ path: null, diff, summary: null });
          }
          continue;
        }
        const record = this.toRecord(entry);
        const diff = this.summarizeText(record.diff || record.patch || record.content, 6_000);
        if (!diff) {
          continue;
        }
        patches.push({
          path: this.normalizeNullableString(record.path || record.file || record.filename),
          diff,
          summary: this.summarizeText(record.summary, 400),
        });
      }
    }
    return patches.slice(0, 20);
  }

  private resolveDurationMs(action: Record<string, any>, startedAt: string | null, finishedAt: string | null): number | null {
    const explicit = this.normalizeNumber(action.durationMs ?? action.duration_ms);
    if (explicit !== null) {
      return explicit;
    }
    const start = this.getTimestamp(startedAt);
    const end = this.getTimestamp(finishedAt);
    if (!start || !end || end < start) {
      return null;
    }
    return end - start;
  }

  private normalizeStatus(value: unknown): string {
    return String(value || '').trim() || 'unknown';
  }

  private normalizeNullableString(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }

  private normalizeNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private summarizeText(value: unknown, maxLength: number): string | null {
    const text = String(value || '').trim();
    if (!text) {
      return null;
    }
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, Math.max(0, maxLength - 16)).trimEnd()}\n...[truncated]`;
  }

  private toRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' ? value as Record<string, any> : {};
  }

  private getTimestamp(value: unknown): number {
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private safeSegment(value: unknown): string {
    return String(value || 'item')
      .trim()
      .replace(/[^a-z0-9._-]+/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      || 'item';
  }
}
