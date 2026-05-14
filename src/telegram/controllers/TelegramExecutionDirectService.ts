import { config } from '../../config/index.js';
import { ExecutionRequest } from '../../contracts/ExecutionContract.js';
import { Task } from '../../contracts/TaskContract.js';
import { ZavorthBridgeCliAdapter } from '../../agents/ZavorthBridgeCliAdapter.js';
import { CodexCliAdapter } from '../../agents/CodexCliAdapter.js';
import { LocalExecutor } from '../../execution/LocalExecutor.js';
import { ExternalExecutor } from '../../execution/ExternalExecutor.js';
import { AuditLogger } from '../../monitoring/AuditLogger.js';
import {
  EXTERNAL_EXECUTOR_ID,
  EXTERNAL_EXECUTOR_LABEL,
  getExternalExecutorTimeoutSeconds,
} from '../ExternalExecutorIdentity.js';

type StoreExecutionResultFn = (task: Task, result: any) => void;
type FormatExecutionOutputFn = (label: string, workspace: string, result: any) => string;
type ModeManagerLike = {
  getMode(): string;
  isSufficientFor(capability: string): boolean;
};
type PolicyEngineLike = {
  isCommandBlocked(command: string): boolean;
};

export type TelegramExecutionDirectServiceDeps = {
  auditLogger: AuditLogger;
  storeExecutionResult: StoreExecutionResultFn;
  formatExecutionOutput: FormatExecutionOutputFn;
};

export class TelegramExecutionDirectService {
  constructor(private readonly deps: TelegramExecutionDirectServiceDeps) {}

  public async executeZavorthBridge(task: Task, payload: string): Promise<{ output: string; success: boolean }> {
    const adapter = new ZavorthBridgeCliAdapter();
    const result = await adapter.executePrompt(task, payload, task.workspace);
    return {
      output: [
        'ZavorthBridge real acionado.',
        `Modo: ${result.metadata?.delivery_mode === 'companion-reuse' ? 'sessao ativa reaproveitada' : 'app aberto por CLI'}`,
        `Workspace: ${task.workspace}`,
        `Modelo preferido: ${result.metadata?.preferred_model || 'nao definido'}`,
        `Handoff: ${result.metadata.handoff_file}`,
        `Rastreio: ${result.metadata.tracking_file}`,
        `O Zavorth vai acompanhar os artefatos reais do ZavorthBridge e usar ${result.metadata.response_file} apenas como fallback.`,
      ].join('\n'),
      success: result.success,
    };
  }

  public async executeCodexDirect(
    task: Task,
    payload: string,
    modeManager: ModeManagerLike,
  ): Promise<{ output: string; success: boolean }> {
    if (!modeManager.isSufficientFor('exec')) {
      return {
        output: `Modo operacional insuficiente para executar Codex.\nModo atual: ${modeManager.getMode()}\nMinimo necessario: BUILD\n\nUse /mode BUILD para habilitar.`,
        success: false,
      };
    }

    const adapter = new CodexCliAdapter();
    const result = await adapter.executePrompt(task, payload, task.workspace);
    return {
      output: this.deps.formatExecutionOutput('Codex CLI', task.workspace || config.defaultWorkspace, result),
      success: result.success,
    };
  }

  public async executeExternalExecutorDirect(
    task: Task,
    payload: string,
    isDryRun: boolean,
    modeManager: ModeManagerLike,
  ): Promise<{ output: string; success: boolean }> {
    if (!modeManager.isSufficientFor('exec')) {
      return {
        output: `Modo operacional insuficiente para executar ${EXTERNAL_EXECUTOR_LABEL}.\nModo atual: ${modeManager.getMode()}\nMinimo necessario: BUILD\n\nUse /mode BUILD para habilitar.`,
        success: false,
      };
    }

    const executor = new ExternalExecutor();
    const available = await executor.isAvailable();
    if (!available) {
      return {
        output: `${EXTERNAL_EXECUTOR_LABEL} indisponivel neste host.\nVerifique o WSL, o PATH do executor externo e as variaveis de runtime antes de tentar novamente.`,
        success: false,
      };
    }

    const workspace = task.workspace || config.defaultWorkspace;
    const request: ExecutionRequest = {
      execution_id: `${task.task_id}-external`,
      task_id: task.task_id,
      executor: EXTERNAL_EXECUTOR_ID,
      workspace,
      objective: payload || task.normalized_message || 'Executar tarefa delegada pelo Zavorth.',
      instructions: payload ? [payload] : [],
      allowed_paths: [workspace],
      blocked_paths: [],
      allowed_commands: [],
      blocked_commands: [],
      timeout_seconds: getExternalExecutorTimeoutSeconds(),
      dry_run: isDryRun,
      requires_backup: false,
      metadata: {
        task_command_type: task.command_type,
      },
    };

    const result = await executor.execute(request);
    task.executor_used = EXTERNAL_EXECUTOR_ID;
    return {
      output: this.deps.formatExecutionOutput(EXTERNAL_EXECUTOR_LABEL, workspace, result),
      success: result.success,
    };
  }

  public async executeLocalShell(
    task: Task,
    command: string,
    workspace: string,
    isDryRun: boolean,
    modeManager: ModeManagerLike,
    policyEngine: PolicyEngineLike,
  ): Promise<{ output: string; success: boolean }> {
    if (!isDryRun && !modeManager.isSufficientFor('exec')) {
      return {
        output: `Modo operacional insuficiente para executar comandos shell.\nModo atual: ${modeManager.getMode()}\nMinimo necessario: BUILD\n\nUse /mode BUILD para habilitar.`,
        success: false,
      };
    }

    if (!isDryRun && policyEngine.isCommandBlocked(command)) {
      this.deps.auditLogger.logSecurityBlock(task.task_id, `Comando bloqueado pela politica: ${command}`).catch(() => {});
      return {
        output: `Comando bloqueado pela politica de seguranca.\nComando: ${command}\n\nEsse comando esta na lista de bloqueios do security-policy.json.`,
        success: false,
      };
    }

    const localExecutor = new LocalExecutor();
    const result = await localExecutor.executeDirect(task, [command], workspace, isDryRun);

    if (isDryRun) {
      return {
        output: `Simulacao concluida.\nWorkspace: ${workspace}\nComando: ${command}`,
        success: true,
      };
    }

    this.deps.storeExecutionResult(task, result);
    return {
      output: this.deps.formatExecutionOutput('Shell local', workspace, result),
      success: result.success,
    };
  }
}
