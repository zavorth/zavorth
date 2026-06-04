import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { Task } from '../../contracts/TaskContract.js';
import { Plan } from '../../contracts/PlanContract.js';
import { WorkspaceProfileService } from '../../services/WorkspaceProfileService.js';
import { WorkspaceOperationalMemoryService } from '../../runtime/context/WorkspaceOperationalMemoryService.js';
import {
  EXTERNAL_EXECUTOR_ID,
  EXTERNAL_EXECUTOR_LABEL,
  getRuntimeAdapterRoleFromMetadata,
  isExternalCommand,
  isExternalExecutor,
} from '../ExternalExecutorIdentity.js';

export class TelegramExecutionGatewayPlanService {
  private readonly workspaceProfileService = new WorkspaceProfileService();
  private readonly workspaceOperationalMemoryService = new WorkspaceOperationalMemoryService();

  public buildExplicitExecutionPlan(task: Task, isDryRun: boolean, payload: string): Plan {
    const workspace = task.workspace || this.getDefaultWorkspace(task.command_type);
    const workspaceProfile = task.metadata?.workspace_profile || null;
    const workspaceOperationalMemory = task.metadata?.workspace_operational_memory || null;
    const objective =
      payload || task.raw_message || task.normalized_message || 'Executar tarefa explicitamente solicitada.';
    const resolvedExecutor = this.resolveGatewayExecutorName(
      String(task.executor_used || task.metadata?.auto_route_executor || task.metadata?.route_executor_preference || '').trim(),
    );
    let executor = 'local';

    if (task.command_type === '/run' || task.command_type === '/dryrun') {
      executor = 'local';
    } else if (resolvedExecutor !== 'local') {
      executor = resolvedExecutor;
    } else if (task.command_type === '/codex') {
      executor = 'codex';
    } else if (isExternalCommand(task.command_type)) {
      executor = EXTERNAL_EXECUTOR_ID;
    } else if (task.command_type === '/gemini') {
      executor = 'gemini_cli';
    } else if (task.command_type === '/aistudio') {
      executor = 'aistudio';
    } else if (task.command_type === '/stitch') {
      executor = 'stitch';
    } else if (task.command_type === '/jules') {
      executor = 'jules';
    }

    return {
      plan_id: uuidv4(),
      task_id: task.task_id,
      objective,
      context: task.metadata?.auto_route_executor
        ? `Fluxo auto-roteado do Telegram (${task.command_type})`
        : `Fluxo explicito do Telegram (${task.command_type})`,
      assumptions: [
        'O usuario pediu execucao explicita por comando.',
        `O workspace aprovado para esta execucao e ${workspace}.`,
        workspaceProfile?.summary ? `Resumo do workspace: ${workspaceProfile.summary}` : null,
        workspaceOperationalMemory?.summary ? `Memoria operacional recente: ${workspaceOperationalMemory.summary}` : null,
      ].filter(Boolean) as string[],
      executor_recommendation: executor,
      workspace_recommendation: workspace,
      risk_level: task.risk_level,
      requires_approval: isDryRun ? false : task.requires_approval,
      steps: [
        {
          step_id: `${task.task_id}-step-1`,
          type: 'exec',
          description: objective,
          tool: null,
          args: null,
          command: objective,
          file_targets: [workspace],
          expected_output: 'Resumo da execucao e artefatos gerados.',
          sensitive: task.risk_level >= 2,
        },
      ],
      validation_steps: [],
      success_condition: 'Executor conclui a tarefa sem violar a politica.',
      rollback_condition: null,
      notes: [
        `Origem: ${task.command_type}`,
        ...this.workspaceProfileService.buildPlanNotes(workspaceProfile),
        ...this.workspaceOperationalMemoryService.buildPlanNotes(workspaceOperationalMemory),
      ],
    };
  }

  public getExecutionLabel(executor: string): string {
    switch (executor) {
      case 'web_research':
        return 'Pesquisa web';
      case 'codex':
        return 'Codex CLI';
      case EXTERNAL_EXECUTOR_ID:
        return EXTERNAL_EXECUTOR_LABEL;
      case 'gemini_cli':
        return 'Gemini CLI';
      case 'aistudio':
        return 'Google AI Studio';
      case 'stitch':
        return 'Google Stitch';
      case 'jules':
        return 'Jules';
      default:
        return 'Shell local';
    }
  }

  public resolveGatewayExecutorName(executor: string): string {
    switch (executor) {
      case 'web_research':
      case 'research':
      case 'deep_research':
        return 'web_research';
      case 'local_executor':
      case 'local':
        return 'local';
      case 'codex':
        return 'codex';
      case 'gemini':
      case 'gemini_cli':
      case 'gemini-cli':
        return 'gemini_cli';
      case 'aistudio':
      case 'ai_studio':
      case 'google_ai_studio':
      case 'google-ai-studio':
        return 'aistudio';
      case 'jules':
      case 'jules_api':
      case 'jules-api':
        return 'jules';
      case 'stitch':
      case 'stitch_sdk':
      case 'stitch-sdk':
        return 'stitch';
      default:
        if (isExternalExecutor(executor)) {
          return EXTERNAL_EXECUTOR_ID;
        }
        return 'local';
    }
  }

  public resolveRuntimeAdapterRole(task: Task): string {
    return getRuntimeAdapterRoleFromMetadata(task.metadata);
  }

  private getDefaultWorkspace(commandType: string): string {
    switch (commandType) {
      case '/codex':
      case '/gemini':
      case '/stitch':
      case '/jules':
      case '/ag':
      case '/bridge':
        return config.defaultWorkspace;
      default:
        return isExternalCommand(commandType) ? config.defaultWorkspace : 'core';
    }
  }
}
