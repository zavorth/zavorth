import type { ArtifactRecord } from '../contracts/ArtifactContract.js';
import type { PermissionRequest } from '../contracts/PermissionRequest.js';
import type { Task } from '../contracts/TaskContract.js';
import type {
  WebComposerCatalog,
  WebComposerMention,
} from '../contracts/WebComposer.js';
import type {
  CommandCatalogEntry,
} from '../gateways/channels/telegram/commandCatalog.js';
import {
  COMMAND_ALIASES,
  TELEGRAM_COMMAND_CATALOG,
} from '../gateways/channels/telegram/commandCatalog.js';
import { SkillLoader, type SkillMetadata } from '../skills/SkillLoader.js';
import { WorkflowRunService, type WorkflowRunSnapshot } from '../runtime/workflows/WorkflowRunService.js';

type TaskManagerLike = {
  getRecentTasksByChat(chatId: string, limit?: number): Task[];
};

type PermissionServiceLike = {
  listRequests(
    status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'all',
    limit?: number,
  ): Promise<PermissionRequest[]>;
};

type ComposerCatalogServiceOptions = {
  taskManager?: TaskManagerLike | null;
  permissionService?: PermissionServiceLike | null;
  commandCatalog?: CommandCatalogEntry[];
  commandAliases?: Record<string, string>;
  loadSkills?: () => SkillMetadata[];
  workflowRunService?: Pick<WorkflowRunService, 'getRun'> | null;
  taskLimit?: number;
  permissionLimit?: number;
};

export class ComposerCatalogService {
  private readonly taskManager: TaskManagerLike | null;
  private readonly permissionService: PermissionServiceLike | null;
  private readonly commandCatalog: CommandCatalogEntry[];
  private readonly commandAliases: Record<string, string>;
  private readonly loadSkills: () => SkillMetadata[];
  private readonly workflowRunService: Pick<WorkflowRunService, 'getRun'> | null;
  private readonly taskLimit: number;
  private readonly permissionLimit: number;
  private cachedCommandMentions: WebComposerMention[] | null = null;
  private cachedSkillMentions: WebComposerMention[] | null = null;

  constructor(options: ComposerCatalogServiceOptions = {}) {
    this.taskManager = options.taskManager || null;
    this.permissionService = options.permissionService || null;
    this.commandCatalog = options.commandCatalog || TELEGRAM_COMMAND_CATALOG;
    this.commandAliases = options.commandAliases || COMMAND_ALIASES;
    this.loadSkills = options.loadSkills || (() => new SkillLoader().loadAll());
    this.workflowRunService = options.workflowRunService || new WorkflowRunService();
    this.taskLimit = Math.max(1, options.taskLimit || 8);
    this.permissionLimit = Math.max(1, options.permissionLimit || 50);
  }

  public async getCatalog(chatId?: string | null): Promise<WebComposerCatalog> {
    const commands = this.buildCommandMentions();
    const skills = this.buildSkillMentions();
    const recentTaskRecords = chatId ? this.getRecentTaskRecords(chatId) : [];
    const recentTasks = this.buildRecentTaskMentions(recentTaskRecords);
    const pendingPermissions = chatId
      ? await this.buildPendingPermissionMentions(recentTasks)
      : [];
    const artifacts = this.buildArtifactMentions(recentTaskRecords);
    const files = this.buildFileMentions(recentTaskRecords);
    const suggestedActions = this.buildSuggestedActions(
      recentTasks,
      pendingPermissions,
      artifacts,
      files,
      skills,
    );

    return {
      commands,
      skills,
      recentTasks,
      pendingPermissions,
      artifacts,
      files,
      suggestedActions,
    };
  }

  private buildCommandMentions(): WebComposerMention[] {
    if (this.cachedCommandMentions) {
      return [...this.cachedCommandMentions];
    }

    const aliasMap = this.buildReverseCommandAliasMap();
    const mentions = [...this.commandCatalog]
      .sort((a, b) => {
        if (Boolean(a.hidden) !== Boolean(b.hidden)) {
          return a.hidden ? 1 : -1;
        }

        return a.command.localeCompare(b.command, 'en-US');
      })
      .map((entry) => {
        const command = `/${entry.command}`;
        const usageSuffix = entry.usage ? ` ${entry.usage}` : '';

        return {
          id: command,
          type: 'command' as const,
          label: command,
          description: `${entry.description}${usageSuffix}`.trim(),
          trigger: '/' as const,
          aliases: aliasMap.get(command) || [],
          payload: {
            command,
            section: entry.section,
            usage: entry.usage || null,
            hidden: Boolean(entry.hidden),
            privateMenu: Boolean(entry.privateMenu),
            groupMenu: Boolean(entry.groupMenu),
          },
        };
      });

    this.cachedCommandMentions = mentions;
    return [...mentions];
  }

  private buildSkillMentions(): WebComposerMention[] {
    if (this.cachedSkillMentions) {
      return [...this.cachedSkillMentions];
    }

    const mentions = this.loadSkills()
      .sort((a, b) => a.name.localeCompare(b.name, 'en-US'))
      .map((skill) => ({
        id: skill.name,
        type: 'skill' as const,
        label: `@${skill.name}`,
        description: skill.description,
        trigger: '@' as const,
        aliases: this.buildSkillAliases(skill),
        payload: {
          skillName: skill.name,
          dirPath: skill.dirPath,
          skillFilePath: skill.skillFilePath,
        },
      }));

    this.cachedSkillMentions = mentions;
    return [...mentions];
  }

  private getRecentTaskRecords(chatId: string): Task[] {
    if (!this.taskManager) {
      return [];
    }

    return this.taskManager.getRecentTasksByChat(chatId, this.taskLimit);
  }

  private buildRecentTaskMentions(tasks: Task[]): WebComposerMention[] {
    return tasks
      .map((task) => {
        const shortId = task.task_id.substring(0, 8);
        const summary = this.truncate(
          task.raw_message || task.normalized_message || 'tarefa sem resumo',
          96,
        );

        return {
          id: task.task_id,
          type: 'task',
          label: `#${shortId}`,
          description: `${task.status} - ${summary}`,
          trigger: '#',
          payload: {
            taskId: task.task_id,
            shortId,
            status: task.status,
            commandType: task.command_type,
            executorUsed: task.executor_used || null,
            workspace: task.workspace || null,
            workflowRunId: String(task.metadata?.workflow_run_id || '').trim() || null,
            workflowFeatureId: String(task.metadata?.workflow_trigger_feature_id || '').trim() || null,
          },
        };
      });
  }

  private buildArtifactMentions(tasks: Task[]): WebComposerMention[] {
    const mentions = tasks.flatMap((task) =>
      (Array.isArray(task.artifacts) ? task.artifacts : [])
        .filter((artifact): artifact is ArtifactRecord => Boolean(artifact))
        .map((artifact) => {
          const token = this.toToken(artifact.key || artifact.name || artifact.id || 'artefato');
          return {
            id: `artifact:${artifact.id || artifact.key || artifact.path || artifact.url || `${task.task_id}:${token}`}`,
            type: 'artifact' as const,
            label: `#artifact:${token}`,
            description: this.buildArtifactDescription(artifact),
            trigger: '#' as const,
            payload: {
              taskId: task.task_id,
              shortId: task.task_id.substring(0, 8),
              token,
              artifactId: artifact.id,
              key: artifact.key,
              name: artifact.name,
              kind: artifact.kind,
              type: artifact.type,
              path: artifact.path,
              url: artifact.url,
              mimeType: artifact.mimeType,
              deliveryChannel: artifact.deliveryChannel,
              summary: artifact.summary,
              description: artifact.description,
            },
          };
        }),
    );

    return this.uniqueMentions(mentions);
  }

  private buildFileMentions(tasks: Task[]): WebComposerMention[] {
    const mentions = tasks.flatMap((task) =>
      (Array.isArray(task.target_files) ? task.target_files : [])
        .map((filePath) => String(filePath || '').trim())
        .filter(Boolean)
        .map((filePath) => {
          const fileName = this.extractFileName(filePath);
          const token = this.toToken(fileName || filePath || 'arquivo');
          return {
            id: `file:${filePath}`,
            type: 'file' as const,
            label: `#file:${token}`,
            description: `${task.status} - ${this.truncate(filePath, 84)}`,
            trigger: '#' as const,
            payload: {
              taskId: task.task_id,
              shortId: task.task_id.substring(0, 8),
              token,
              fileName,
              path: filePath,
              workspace: task.workspace || null,
              status: task.status,
            },
          };
        }),
    );

    return this.uniqueMentions(mentions);
  }

  private async buildPendingPermissionMentions(
    recentTasks: WebComposerMention[],
  ): Promise<WebComposerMention[]> {
    if (!this.permissionService || recentTasks.length === 0) {
      return [];
    }

    const taskIdSet = new Set(
      recentTasks
        .map((task) => String(task.payload?.taskId || '').trim())
        .filter(Boolean),
    );

    const permissions = await this.permissionService.listRequests(
      'pending',
      this.permissionLimit,
    );

    return permissions
      .filter((permission) => permission.task_id && taskIdSet.has(permission.task_id))
      .map((permission) => {
        const shortId = permission.permission_id.substring(0, 8);

        return {
          id: permission.permission_id,
          type: 'permission',
          label: `#perm:${shortId}`,
          description: `${permission.executor}/${permission.kind} - ${this.truncate(permission.reason, 84)}`,
          trigger: '#',
          payload: {
            permissionId: permission.permission_id,
            shortId,
            taskId: permission.task_id,
            executor: permission.executor,
            kind: permission.kind,
            scope: permission.scope,
            requestedValue: permission.requested_value,
            resolvedValue: permission.resolved_value,
          },
        };
      });
  }

  private buildSuggestedActions(
    recentTasks: WebComposerMention[],
    pendingPermissions: WebComposerMention[],
    artifacts: WebComposerMention[],
    files: WebComposerMention[],
    skills: WebComposerMention[],
  ): WebComposerMention[] {
    const actions: WebComposerMention[] = [];
    const debuggingSkill = this.findSkillMention(skills, 'debugging');

    if (pendingPermissions.length > 0) {
      const firstPermission = pendingPermissions[0];
      actions.push({
        id: `action:approve:${firstPermission.id}`,
        type: 'action',
        label: `#aprovar:${String(firstPermission.payload?.shortId || '').trim()}`,
        description: 'Aprovar uma vez a permissao pendente mais recente desta sessao',
        trigger: '#',
        payload: {
          action: 'approve_permission',
          permissionId: firstPermission.id,
          scope: 'once',
        },
      });
    }

    if (recentTasks.length > 0) {
      const firstTask = recentTasks[0];
      const workflowRunId = String(firstTask.payload?.workflowRunId || '').trim();
      if (workflowRunId) {
        const workflowRun = this.workflowRunService?.getRun(workflowRunId) || null;
        const workflowClosed = String(workflowRun?.operator_state || 'active').trim().toLowerCase() === 'closed';
        const workflowFeatureId = String(
          workflowRun?.trigger?.feature_id || firstTask.payload?.workflowFeatureId || '',
        ).trim();
        const workflowName = String(workflowRun?.workflow_name || '').trim().toLowerCase();
        const resumeStageId = String(workflowRun?.resume_stage?.id || '').trim();
        const resumeStageLabel = this.getWorkflowResumeStageLabel(workflowRun);
        const resumeStageReason = this.getWorkflowResumeStageReason(workflowRun);
        if (!workflowClosed) {
          actions.push({
            id: `action:resume-workflow:${workflowRunId}`,
            type: 'action',
            label: `#retomar-workflow:${this.toToken(workflowRunId)}`,
            description: resumeStageLabel
              ? `Retomar o workflow composto pela etapa ${resumeStageLabel}${resumeStageReason ? ` (${resumeStageReason})` : ''}`
              : 'Retomar o workflow composto mais recente desta sessao',
            trigger: '#',
            payload: {
              action: 'resume_workflow',
              workflowRunId,
              taskId: String(firstTask.payload?.taskId || '').trim() || null,
              resumeStageLabel: resumeStageLabel || null,
              resumeStageReason: resumeStageReason || null,
              resumePrompt: String(workflowRun?.resume_prompt || '').trim() || null,
            },
          });

          if (['blocked', 'failed'].includes(String(workflowRun?.status || '').trim().toLowerCase())) {
            actions.push({
              id: `action:close-workflow:${workflowRunId}`,
              type: 'action',
              label: `#encerrar-workflow:${this.toToken(workflowRunId)}`,
              description: 'Encerrar este workflow bloqueado e remover a retomada sugerida desta sessao',
              trigger: '#',
              payload: {
                action: 'close_workflow',
                workflowRunId,
                taskId: String(firstTask.payload?.taskId || '').trim() || null,
              },
            });
          }

          if (resumeStageId) {
            actions.push({
              id: `action:resume-workflow-phase:${workflowRunId}:${resumeStageId}`,
              type: 'action',
              label: `#retomar-etapa:${this.toToken(resumeStageLabel || resumeStageId)}`,
              description: resumeStageLabel
                ? `Retomar o workflow diretamente pela etapa ${resumeStageLabel}${resumeStageReason ? ` (${resumeStageReason})` : ''}`
                : 'Retomar o workflow pela etapa interrompida',
              trigger: '#',
              payload: {
                action: 'resume_workflow',
                workflowRunId,
                taskId: String(firstTask.payload?.taskId || '').trim() || null,
                resumeStageId,
                resumeStageLabel: resumeStageLabel || null,
                resumeStageReason: resumeStageReason || null,
                resumePrompt: String(workflowRun?.resume_prompt || '').trim() || null,
              },
            });
          }

          const workflowStages = Array.isArray(workflowRun?.phases)
            ? [...workflowRun.phases].sort((left, right) => Number(left?.index || 0) - Number(right?.index || 0))
            : [];
          for (const phase of workflowStages) {
            const stageId = String(phase?.id || '').trim();
            const stageLabel = String(phase?.label || stageId || '').trim();
            const stageStatus = String(phase?.status || '').trim().toLowerCase();
            if (!stageId || !stageLabel || stageId === resumeStageId) {
              continue;
            }

            const isCompletedStage = stageStatus === 'completed';
            const isResumableStage = ['approval_pending', 'blocked', 'failed'].includes(stageStatus);
            if (!isCompletedStage && !isResumableStage) {
              continue;
            }

            actions.push({
              id: `action:resume-workflow-phase:${workflowRunId}:${stageId}:${stageStatus || 'phase'}`,
              type: 'action',
              label: `${isCompletedStage ? '#reiniciar-etapa' : '#retomar-etapa'}:${this.toToken(stageLabel)}`,
              description: isCompletedStage
                ? `Reexecutar o workflow a partir da etapa ${stageLabel}`
                : `Retomar o workflow diretamente pela etapa ${stageLabel}`,
              trigger: '#',
              payload: {
                action: isCompletedStage ? 'restart_workflow_stage' : 'resume_workflow',
                workflowRunId,
                taskId: String(firstTask.payload?.taskId || '').trim() || null,
                resumeStageId: stageId,
                resumeStageLabel: stageLabel,
                resumeStageReason: String(phase?.result_summary || phase?.handoff_summary || '').trim() || null,
                resumePrompt: String(workflowRun?.resume_prompt || '').trim() || null,
              },
            });
          }
        }
        if (workflowFeatureId && (workflowName === 'sdd' || Boolean(firstTask.payload?.workflowFeatureId))) {
          actions.push(
            this.buildComposeFollowupAction({
              id: `action:workflow-sdd:${workflowFeatureId}`,
              label: `#workflow-sdd:${this.toToken(workflowFeatureId)}`,
              description: 'Montar o comando para rodar o loop SDD desta feature no composer',
              draftMessage: `/workflow sdd ${workflowFeatureId}`,
              workflowFeatureId,
              attachedMentions: [],
            }),
          );
        }
      }
      actions.push({
        id: `action:resume:${firstTask.id}`,
        type: 'action',
        label: `#retomar:${String(firstTask.payload?.shortId || '').trim()}`,
        description: 'Retomar ou consultar a tarefa mais recente desta sessao',
        trigger: '#',
        payload: {
          action: 'resume_task',
          taskId: firstTask.id,
        },
      });
    }

    if (artifacts.length > 0) {
      const firstArtifact = artifacts[0];
      const attachArtifactAction: WebComposerMention = {
        id: `action:attach-artifact:${firstArtifact.id}`,
        type: 'action',
        label: `#usar-artefato:${String(firstArtifact.payload?.token || '').trim()}`,
        description: 'Levar este artefato como contexto para o proximo pedido',
        trigger: '#',
        payload: {
          action: 'attach_artifact_context',
          ...(firstArtifact.payload || {}),
        },
      };
      actions.push(attachArtifactAction);
      actions.push(
        this.buildComposeFollowupAction({
          id: `action:compose-artifact:${firstArtifact.id}`,
          label: `#responder-com-artefato:${String(firstArtifact.payload?.token || '').trim()}`,
          description: 'Montar um follow-up para responder usando este artefato',
          draftMessage:
            '/task use este artefato como contexto principal e gere uma resposta objetiva com resumo e proximo passo.',
          attachedMentions: [attachArtifactAction],
        }),
      );
      actions.push({
        id: `action:artifact:${firstArtifact.id}`,
        type: 'action',
        label: `#ver-artefato:${String(firstArtifact.payload?.token || '').trim()}`,
        description: 'Mostrar detalhes do artefato mais recente desta sessao',
        trigger: '#',
        payload: {
          action: 'describe_artifact',
          ...(firstArtifact.payload || {}),
        },
      });
      actions.push({
        id: `action:redeliver-artifact:${firstArtifact.id}`,
        type: 'action',
        label: `#reentregar-artefato:${String(firstArtifact.payload?.token || '').trim()}`,
        description: 'Reapresentar a referencia mais util do artefato no chat',
        trigger: '#',
        payload: {
          action: 'redeliver_artifact',
          ...(firstArtifact.payload || {}),
        },
      });
    }

    if (files.length > 0) {
      const firstFile = files[0];
      const attachFileAction: WebComposerMention = {
        id: `action:attach-file:${firstFile.id}`,
        type: 'action',
        label: `#usar-arquivo:${String(firstFile.payload?.token || '').trim()}`,
        description: 'Levar este arquivo como contexto para o proximo pedido',
        trigger: '#',
        payload: {
          action: 'attach_file_context',
          ...(firstFile.payload || {}),
        },
      };
      actions.push(attachFileAction);
      if (debuggingSkill) {
        actions.push(
          this.buildComposeFollowupAction({
            id: `action:compose-debug-file:${firstFile.id}`,
            label: `#debug-arquivo:${String(firstFile.payload?.token || '').trim()}`,
            description: 'Montar um follow-up para revisar este arquivo com @debugging',
            draftMessage:
              `/task revise este arquivo com ${debuggingSkill.label} e aponte bugs, riscos e correcoes.`,
            attachedMentions: [attachFileAction],
          }),
        );
      }
      actions.push(
        this.buildComposeFollowupAction({
          id: `action:compose-review-file:${firstFile.id}`,
          label: `#revisar-arquivo:${String(firstFile.payload?.token || '').trim()}`,
          description: 'Montar um follow-up para revisar este arquivo no proximo pedido',
          draftMessage:
            '/task revise este arquivo e destaque problemas, riscos e proximos passos.',
          attachedMentions: [attachFileAction],
        }),
      );
      actions.push({
        id: `action:file:${firstFile.id}`,
        type: 'action',
        label: `#ver-arquivo:${String(firstFile.payload?.token || '').trim()}`,
        description: 'Mostrar detalhes do arquivo mais recente desta sessao',
        trigger: '#',
        payload: {
          action: 'describe_file',
          ...(firstFile.payload || {}),
        },
      });
    }

    return actions;
  }

  private buildComposeFollowupAction(input: {
    id: string;
    label: string;
    description: string;
    draftMessage: string;
    workflowFeatureId?: string;
    attachedMentions: WebComposerMention[];
  }): WebComposerMention {
    return {
      id: input.id,
      type: 'action',
      label: input.label,
      description: input.description,
      trigger: '#',
      payload: {
        action: 'compose_followup',
        draftMessage: input.draftMessage,
        workflowFeatureId: String(input.workflowFeatureId || '').trim() || undefined,
        attachedMentions: input.attachedMentions,
      },
    };
  }

  private buildReverseCommandAliasMap(): Map<string, string[]> {
    const reverseAliases = new Map<string, string[]>();

    for (const [alias, target] of Object.entries(this.commandAliases)) {
      if (!alias || !target || alias === target) {
        continue;
      }

      const bucket = reverseAliases.get(target) || [];
      bucket.push(alias);
      reverseAliases.set(target, bucket);
    }

    for (const aliases of reverseAliases.values()) {
      aliases.sort((a, b) => a.localeCompare(b, 'en-US'));
    }

    return reverseAliases;
  }

  private buildSkillAliases(skill: SkillMetadata): string[] {
    const aliases = new Set<string>();
    aliases.add(skill.name);
    aliases.add(skill.name.replace(/-/g, ' '));

    return Array.from(aliases).filter(Boolean);
  }

  private findSkillMention(skills: WebComposerMention[], skillName: string): WebComposerMention | null {
    const normalizedTarget = String(skillName || '').trim().toLowerCase();
    return skills.find((skill) => String(skill.id || '').trim().toLowerCase() === normalizedTarget) || null;
  }

  private buildArtifactDescription(artifact: ArtifactRecord): string {
    const parts = [
      artifact.kind || artifact.type || 'artefato',
      artifact.name || artifact.key || null,
      artifact.summary || artifact.description || artifact.path || artifact.url || null,
    ]
      .filter(Boolean)
      .map((item) => String(item).trim())
      .filter(Boolean);

    return this.truncate(parts.join(' - ') || 'Artefato da sessao', 96);
  }

  private uniqueMentions(mentions: WebComposerMention[]): WebComposerMention[] {
    const seen = new Set<string>();
    return mentions.filter((mention) => {
      if (!mention?.id || seen.has(mention.id)) {
        return false;
      }
      seen.add(mention.id);
      return true;
    });
  }

  private extractFileName(filePath: string): string {
    const normalized = String(filePath || '').trim().replace(/\\/g, '/');
    if (!normalized) {
      return '';
    }

    const segments = normalized.split('/');
    return segments[segments.length - 1] || normalized;
  }

  private toToken(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24) || 'item';
  }

  private getWorkflowResumeStageLabel(run: WorkflowRunSnapshot | null): string {
    return String(run?.resume_stage?.label || '').trim();
  }

  private getWorkflowResumeStageReason(run: WorkflowRunSnapshot | null): string {
    return String(run?.resume_stage?.reason || '').trim();
  }

  private truncate(text: string, maxLength: number): string {
    const normalized = String(text || '').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, maxLength - 3)}...`;
  }
}
