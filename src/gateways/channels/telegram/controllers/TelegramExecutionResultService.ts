import { Task } from '../../../../contracts/TaskContract.js';
import { ArtifactRecord } from '../../../../contracts/ArtifactContract.js';
import { LogRepository } from '../../../../storage/LogRepository.js';
import { ArtifactPipelineService } from '../../../../runtime/artifacts/ArtifactPipelineService.js';
import { PresentationModeService } from '../../../../services/PresentationModeService.js';
import { TaskResponseEnvelopeService } from '../../../../services/TaskResponseEnvelopeService.js';
import { UserFacingResponseService } from '../../../../services/UserFacingResponseService.js';

type PersistTaskFn = (task: Task) => void;

export type TelegramExecutionResultServiceDeps = {
  logRepo: LogRepository;
  persistTask: PersistTaskFn;
  presentationModeService: PresentationModeService;
};

export class TelegramExecutionResultService {
  private readonly artifactPipeline = new ArtifactPipelineService();

  constructor(private readonly deps: TelegramExecutionResultServiceDeps) {}

  public formatExecutionOutput(label: string, workspace: string, result: unknown): string {
    return UserFacingResponseService.formatExecutionOutput(label, result, {
      presentationMode: this.deps.presentationModeService.isEnabled(),
    });
  }

  public captureExecutionEnvelope(task: Task, userFacingText: string, success: boolean): void {
    const existingKind = String(task.metadata?.last_user_facing_response?.kind || '').trim();
    if (
      task.executor_used === 'web_research' &&
      (existingKind === 'research_success' || existingKind === 'research_failure')
    ) {
      return;
    }

    const operationalText = TaskResponseEnvelopeService.buildExecutionTranscript(task, userFacingText, success);
    TaskResponseEnvelopeService.capture(task, 'execution_result', userFacingText, operationalText);
    this.deps.persistTask(task);
    this.deps.logRepo.log(success ? 'info' : 'warn', 'ResponseEnvelope', operationalText, {
      taskId: task.task_id,
      kind: 'execution_result',
    });
  }

  public storeExecutionResult(task: Task, result: unknown): void {
    const r = result as Record<string, unknown>;
    const normalizedArtifacts = this.artifactPipeline.normalizeArtifacts(
      Array.isArray(r?.artifacts) ? (r.artifacts as ArtifactRecord[]) : [],
      task.executor_used || task.command_type.replace(/^\//, '') || 'executor',
    );
    const artifactPaths = this.artifactPipeline.extractLocalPaths(normalizedArtifacts);
    task.stdout_summary = this.truncateSummary(r?.stdout);
    task.stderr_summary = this.truncateSummary(r?.stderr);
    task.diff_summary = this.truncateSummary(r?.diff_summary);
    task.result_summary = r?.success
      ? this.truncateSummary((r?.stdout || r?.diff_summary || 'Execucao concluida com sucesso.') as string)
      : null;
    task.error_summary = r?.success
      ? null
      : this.truncateSummary((r?.error_message || r?.stderr || 'Execucao failed.') as string);
    task.rollback_available = Boolean(r?.rollback_available);
    task.target_files = Array.from(new Set([...(task.target_files || []), ...artifactPaths]));
    task.artifacts = normalizedArtifacts.length > 0 ? normalizedArtifacts : task.artifacts;
    task.metadata = {
      ...(task.metadata || {}),
      artifact_manifest: this.artifactPipeline.buildManifest(task.artifacts as ArtifactRecord[], {
        traceId: task.metadata?.traceId || task.metadata?.trace_id || null,
        runId: task.metadata?.runId || task.metadata?.run_id || task.task_id,
        sessionId: task.metadata?.sessionId || task.metadata?.session_id || task.chat_id || null,
        taskId: task.task_id,
        surface: task.source,
        source: task.executor_used || 'telegram-result',
      }),
    };
    this.deps.persistTask(task);
  }

  private truncateSummary(value: unknown, maxLength = 1000): string | null {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) {
      return null;
    }

    return text.length <= maxLength ? text : `${text.slice(0, maxLength)}\n[...]`;
  }
}
