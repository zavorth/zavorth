import { ArtifactPipelineService } from '../runtime/artifacts/ArtifactPipelineService.js';
import type { PermissionRequest } from '../contracts/PermissionRequest.js';
import type { Task } from '../contracts/TaskContract.js';
import type { WebComposerMention } from '../contracts/WebComposer.js';
import { RecentTaskResolver } from './RecentTaskResolver.js';
import type { WebSessionSnapshot } from './WebRealtimeService.js';
import { logger } from '../logger.js';

type WebContext = Record<string, unknown>;



type PermissionControllerLike = {
  resolvePermissionReference(ref: string): Promise<PermissionRequest>;
  shortPermissionId(permission: PermissionRequest): string;
  handlePermissionCallback(ctx: WebContext, data: string): Promise<void>;
};

type WorkflowControllerLike = {
  handleWorkflow(ctx: WebContext, args: string): Promise<void>;
};

type TaskManagerLike = {
  getTask(taskId: string): Task | undefined;
};

type WebRealtimeLike = {
  captureBaseline(sessionId: string): Promise<void>;
  getResolvedSnapshot(sessionId: string): Promise<WebSessionSnapshot>;
  recordAssistantMessage(
    sessionId: string,
    content: string,
    taskId?: string | null,
    kind?: string | null,
    mentions?: WebComposerMention[],
  ): void;
};

export type ComposerActionResult = {
  handled: boolean;
  taskId: string | null;
  snapshot?: WebSessionSnapshot;
};

type ComposerActionServiceOptions = {
  permissionController: PermissionControllerLike;
  taskManager: TaskManagerLike;
  realtime: WebRealtimeLike;
  workflowController?: WorkflowControllerLike | null;
};

export class ComposerActionService {
  private readonly permissionController: PermissionControllerLike;
  private readonly taskManager: TaskManagerLike;
  private readonly realtime: WebRealtimeLike;
  private readonly workflowController: WorkflowControllerLike | null;
  private readonly artifactPipeline = new ArtifactPipelineService();

  constructor(options: ComposerActionServiceOptions) {
    this.permissionController = options.permissionController;
    this.taskManager = options.taskManager;
    this.realtime = options.realtime;
    this.workflowController = options.workflowController || null;
  }

  public async maybeHandle(input: {
    sessionId: string;
    mentions: WebComposerMention[];
    webContext: WebContext;
  }): Promise<ComposerActionResult> {
    const actionMentions = this.extractActionMentions(input.mentions);
    if (actionMentions.length !== 1) {
      return { handled: false, taskId: null };
    }

    const actionMention = actionMentions[0];
    const action = String(actionMention.payload?.action || '').trim();
    if (!action) {
      return { handled: false, taskId: null };
    }

    switch (action) {
      case 'approve_permission':
        return this.handleApprovePermission(input.sessionId, actionMention, input.webContext);
      case 'resume_task':
        return this.handleResumeTask(input.sessionId, actionMention);
      case 'resume_workflow':
        return this.handleResumeWorkflow(input.sessionId, actionMention, input.webContext);
      case 'restart_workflow_stage':
        return this.handleRestartWorkflowStage(input.sessionId, actionMention, input.webContext);
      case 'close_workflow':
        return this.handleCloseWorkflow(input.sessionId, actionMention, input.webContext);
      case 'describe_artifact':
        return this.handleDescribeArtifact(input.sessionId, actionMention);
      case 'describe_file':
        return this.handleDescribeFile(input.sessionId, actionMention);
      case 'redeliver_artifact':
        return this.handleRedeliverArtifact(input.sessionId, actionMention);
      default:
        return { handled: false, taskId: null };
    }
  }

  private extractActionMentions(mentions: WebComposerMention[]): WebComposerMention[] {
    return (Array.isArray(mentions) ? mentions : []).filter((mention) => {
      return mention?.type === 'action' && mention.payload && typeof mention.payload === 'object';
    });
  }

  private async handleApprovePermission(
    sessionId: string,
    actionMention: WebComposerMention,
    webContext: WebContext,
  ): Promise<ComposerActionResult> {
    const permissionId = String(actionMention.payload?.permissionId || '').trim();
    const scope = this.normalizeScope(actionMention.payload?.scope);

    if (!permissionId) {
      return this.finishWithError(
        sessionId,
        'Nao consegui identificar qual permissao voce queria aprovar.',
        null,
        actionMention,
      );
    }

    try {
      const permission = await this.permissionController.resolvePermissionReference(permissionId);
      await this.permissionController.handlePermissionCallback(
        webContext,
        `perm:approve:${this.permissionController.shortPermissionId(permission)}:${scope}`,
      );

      await this.realtime.captureBaseline(sessionId);
      return {
        handled: true,
        taskId: permission.task_id || null,
        snapshot: await this.realtime.getResolvedSnapshot(sessionId),
      };
    } catch (error) {
    logger.warn('[Composer Action] path resolution failed', error);
    return this.finishWithError(
        sessionId,
        error instanceof Error ? error.message : 'Falha ao aprovar a permissao selecionada.',
        null,
        actionMention,
      );
  }
  }

  private async handleResumeTask(
    sessionId: string,
    actionMention: WebComposerMention,
  ): Promise<ComposerActionResult> {
    const taskId = String(actionMention.payload?.taskId || '').trim();
    if (!taskId) {
      return this.finishWithError(
        sessionId,
        'Nao consegui identificar qual tarefa voce queria retomar.',
        null,
        actionMention,
      );
    }

    const task = this.taskManager.getTask(taskId);
    if (!task) {
      return this.finishWithError(
        sessionId,
        'Nao encontrei a tarefa selecionada para retomar nesta sessao.',
        taskId,
        actionMention,
      );
    }

    this.realtime.recordAssistantMessage(
      sessionId,
      RecentTaskResolver.formatTaskStatus(task),
      task.task_id,
      'task-status',
      [actionMention],
    );
    await this.realtime.captureBaseline(sessionId);

    return {
      handled: true,
      taskId: task.task_id,
      snapshot: await this.realtime.getResolvedSnapshot(sessionId),
    };
  }

  private async handleResumeWorkflow(
    sessionId: string,
    actionMention: WebComposerMention,
    webContext: WebContext,
  ): Promise<ComposerActionResult> {
    const workflowRunId = String(actionMention.payload?.workflowRunId || actionMention.payload?.runId || '').trim();
    const resumeStageId = String(actionMention.payload?.resumeStageId || '').trim();
    if (!workflowRunId) {
      return this.finishWithError(
        sessionId,
        'Nao consegui identificar qual workflow voce queria retomar.',
        String(actionMention.payload?.taskId || '').trim() || null,
        actionMention,
      );
    }

    if (!this.workflowController) {
      return this.finishWithError(
        sessionId,
        'A retomada de workflow ainda nao esta disponivel nesta superficie.',
        String(actionMention.payload?.taskId || '').trim() || null,
        actionMention,
      );
    }

    try {
      const resumeArgs = ['resume', workflowRunId, resumeStageId].filter(Boolean).join(' ');
      await this.workflowController.handleWorkflow(webContext, resumeArgs);
      await this.realtime.captureBaseline(sessionId);
      return {
        handled: true,
        taskId: String(actionMention.payload?.taskId || '').trim() || null,
        snapshot: await this.realtime.getResolvedSnapshot(sessionId),
      };
    } catch (error) {
    logger.warn('[Composer Action] load operation failed', error);
    return this.finishWithError(
        sessionId,
        error instanceof Error ? error.message : 'Falha ao retomar o workflow selecionado.',
        String(actionMention.payload?.taskId || '').trim() || null,
        actionMention,
      );
  }
  }

  private async handleRestartWorkflowStage(
    sessionId: string,
    actionMention: WebComposerMention,
    webContext: WebContext,
  ): Promise<ComposerActionResult> {
    const workflowRunId = String(actionMention.payload?.workflowRunId || actionMention.payload?.runId || '').trim();
    const resumeStageId = String(actionMention.payload?.resumeStageId || '').trim();
    if (!workflowRunId || !resumeStageId) {
      return this.finishWithError(
        sessionId,
        'Nao consegui identificar qual etapa do workflow voce queria reiniciar.',
        String(actionMention.payload?.taskId || '').trim() || null,
        actionMention,
      );
    }

    if (!this.workflowController) {
      return this.finishWithError(
        sessionId,
        'O reinicio de etapa ainda nao esta disponivel nesta superficie.',
        String(actionMention.payload?.taskId || '').trim() || null,
        actionMention,
      );
    }

    try {
      await this.workflowController.handleWorkflow(webContext, `restart-stage ${workflowRunId} ${resumeStageId}`);
      await this.realtime.captureBaseline(sessionId);
      return {
        handled: true,
        taskId: String(actionMention.payload?.taskId || '').trim() || null,
        snapshot: await this.realtime.getResolvedSnapshot(sessionId),
      };
    } catch (error) {
    logger.warn('[Composer Action] lifecycle operation failed', error);
    return this.finishWithError(
        sessionId,
        error instanceof Error ? error.message : 'Falha ao reiniciar a etapa do workflow selecionado.',
        String(actionMention.payload?.taskId || '').trim() || null,
        actionMention,
      );
  }
  }

  private async handleCloseWorkflow(
    sessionId: string,
    actionMention: WebComposerMention,
    webContext: WebContext,
  ): Promise<ComposerActionResult> {
    const workflowRunId = String(actionMention.payload?.workflowRunId || actionMention.payload?.runId || '').trim();
    if (!workflowRunId) {
      return this.finishWithError(
        sessionId,
        'Nao consegui identificar qual workflow voce queria encerrar.',
        String(actionMention.payload?.taskId || '').trim() || null,
        actionMention,
      );
    }

    if (!this.workflowController) {
      return this.finishWithError(
        sessionId,
        'O encerramento de workflow ainda nao esta disponivel nesta superficie.',
        String(actionMention.payload?.taskId || '').trim() || null,
        actionMention,
      );
    }

    try {
      await this.workflowController.handleWorkflow(webContext, `close ${workflowRunId}`);
      await this.realtime.captureBaseline(sessionId);
      return {
        handled: true,
        taskId: String(actionMention.payload?.taskId || '').trim() || null,
        snapshot: await this.realtime.getResolvedSnapshot(sessionId),
      };
    } catch (error) {
    logger.warn('[Composer Action] resource cleanup failed', error);
    return this.finishWithError(
        sessionId,
        error instanceof Error ? error.message : 'Falha ao encerrar o workflow selecionado.',
        String(actionMention.payload?.taskId || '').trim() || null,
        actionMention,
      );
  }
  }

  private async handleDescribeArtifact(
    sessionId: string,
    actionMention: WebComposerMention,
  ): Promise<ComposerActionResult> {
    const taskId = String(actionMention.payload?.taskId || '').trim() || null;
    const lines = [
      'Artefato referenciado nesta sessao.',
      this.buildLabeledLine('Nome', actionMention.payload?.name || actionMention.payload?.key),
      this.buildLabeledLine(
        'Tipo',
        [actionMention.payload?.kind, actionMention.payload?.type].filter(Boolean).join(' / '),
      ),
      this.buildLabeledLine('Resumo', actionMention.payload?.summary || actionMention.payload?.description),
      this.buildLabeledLine('Caminho', actionMention.payload?.path),
      this.buildLabeledLine('URL', actionMention.payload?.url),
      this.buildLabeledLine('Entrega', actionMention.payload?.deliveryChannel),
      taskId ? `Tarefa: ${taskId.substring(0, 8)}` : null,
    ].filter(Boolean);

    this.realtime.recordAssistantMessage(
      sessionId,
      lines.join('\n'),
      taskId,
      'artifact-info',
      [actionMention],
    );
    await this.realtime.captureBaseline(sessionId);

    return {
      handled: true,
      taskId,
      snapshot: await this.realtime.getResolvedSnapshot(sessionId),
    };
  }

  private async handleDescribeFile(
    sessionId: string,
    actionMention: WebComposerMention,
  ): Promise<ComposerActionResult> {
    const taskId = String(actionMention.payload?.taskId || '').trim() || null;
    const lines = [
      'Arquivo referenciado nesta sessao.',
      this.buildLabeledLine('Nome', actionMention.payload?.fileName),
      this.buildLabeledLine('Caminho', actionMention.payload?.path),
      this.buildLabeledLine('Workspace', actionMention.payload?.workspace),
      this.buildLabeledLine('Status da tarefa', actionMention.payload?.status),
      taskId ? `Tarefa: ${taskId.substring(0, 8)}` : null,
    ].filter(Boolean);

    this.realtime.recordAssistantMessage(
      sessionId,
      lines.join('\n'),
      taskId,
      'file-info',
      [actionMention],
    );
    await this.realtime.captureBaseline(sessionId);

    return {
      handled: true,
      taskId,
      snapshot: await this.realtime.getResolvedSnapshot(sessionId),
    };
  }

  private async handleRedeliverArtifact(
    sessionId: string,
    actionMention: WebComposerMention,
  ): Promise<ComposerActionResult> {
    const taskId = String(actionMention.payload?.taskId || '').trim() || null;
    const caption = this.artifactPipeline.buildCaption(
      taskId || 'composer',
      {
        key: String(actionMention.payload?.key || '').trim() || undefined,
        name: String(actionMention.payload?.name || '').trim() || undefined,
        path: String(actionMention.payload?.path || '').trim() || undefined,
        url: String(actionMention.payload?.url || '').trim() || undefined,
        summary: String(actionMention.payload?.summary || '').trim() || undefined,
        description: String(actionMention.payload?.description || '').trim() || undefined,
        source: String(actionMention.payload?.source || '').trim() || undefined,
        kind: String(actionMention.payload?.kind || '').trim() || undefined,
        type: String(actionMention.payload?.type || '').trim() || undefined,
      },
    );
    const referenceLine = this.resolveArtifactReferenceLine(actionMention);
    const lines = [
      'Reentrega pronta para este artefato.',
      caption,
      referenceLine,
      this.buildLabeledLine('Canal original', actionMention.payload?.deliveryChannel),
    ].filter(Boolean);

    this.realtime.recordAssistantMessage(
      sessionId,
      lines.join('\n\n'),
      taskId,
      'artifact-redelivery',
      [actionMention],
    );
    await this.realtime.captureBaseline(sessionId);

    return {
      handled: true,
      taskId,
      snapshot: await this.realtime.getResolvedSnapshot(sessionId),
    };
  }

  private async finishWithError(
    sessionId: string,
    message: string,
    taskId: string | null,
    actionMention: WebComposerMention,
  ): Promise<ComposerActionResult> {
    this.realtime.recordAssistantMessage(
      sessionId,
      String(message || 'Falha ao executar a acao selecionada.'),
      taskId,
      'composer-action-error',
      [actionMention],
    );
    await this.realtime.captureBaseline(sessionId);

    return {
      handled: true,
      taskId,
      snapshot: await this.realtime.getResolvedSnapshot(sessionId),
    };
  }

  private normalizeScope(value: unknown): string {
    const normalized = String(value || '').trim().toLowerCase();
    if (['workspace', 'session', 'persistent', 'once'].includes(normalized)) {
      return normalized;
    }

    return 'once';
  }

  private buildLabeledLine(label: string, value: unknown): string | null {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return null;
    }

    return `${label}: ${normalized}`;
  }

  private resolveArtifactReferenceLine(actionMention: WebComposerMention): string | null {
    const path = String(actionMention.payload?.path || '').trim();
    if (path) {
      return `Caminho local: ${path}`;
    }

    const url = String(actionMention.payload?.url || '').trim();
    if (url) {
      return `URL: ${url}`;
    }

    const key = String(actionMention.payload?.key || actionMention.payload?.artifactId || '').trim();
    if (key) {
      return `Referencia: ${key}`;
    }

    return null;
  }
}
