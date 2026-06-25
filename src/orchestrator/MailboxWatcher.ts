import fs from 'fs';
import { logger } from '../logger.js';
import path from 'path';
import { logger } from '../logger.js';
import { TaskManager } from './TaskManager.js';
import { logger } from '../logger.js';
import { LogRepository } from '../storage/LogRepository.js';
import { logger } from '../logger.js';
import { ZavorthBridgeAdapter } from '../agents/ZavorthBridgeAdapter.js';
import { logger } from '../logger.js';
import { MailboxProtocol } from './MailboxProtocol.js';
import { logger } from '../logger.js';
import { BridgeProtocolAdapter } from './BridgeProtocolAdapter.js';
import { logger } from '../logger.js';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import { ExecutionGateway } from '../execution/ExecutionGateway.js';
import { logger } from '../logger.js';
import { LocalExecutor } from '../execution/LocalExecutor.js';
import { logger } from '../logger.js';
import { CodexExecutor } from '../execution/CodexExecutor.js';
import { logger } from '../logger.js';
import {
  EXTERNAL_EXECUTOR_ID,
  ExternalExecutor,
} from '../execution/ExternalExecutor.js';
import type { Plan, PlanStep } from '../contracts/PlanContract.js';
import { logger } from '../logger.js';
import type { ToolRuntimeService } from '../services/tools/ToolRuntimeService.js';
import { logger } from '../logger.js';

type BroadcastClient = {
  broadcast(message: string, roles?: string[]): Promise<void>;
};

type ToolRuntimeLike = Pick<ToolRuntimeService, 'executeTool'>;

type MailboxWatcherOptions = {
  inboxDir?: string;
  processedDir?: string;
  rejectedDir?: string;
  runtimeDir?: string;
  seenDir?: string;
  statusFilePath?: string;
  protocol?: MailboxProtocol;
  executionGateway?: Pick<ExecutionGateway, 'submit'>;
};

export class MailboxWatcher {
  private inboxDir: string;
  private processedDir: string;
  private rejectedDir: string;
  private runtimeDir: string;
  private seenDir: string;
  private statusFilePath: string;
  private processing = false;
  private taskManager: TaskManager;
  private logRepo: LogRepository;
  private broadcaster: BroadcastClient;
  private processedMessageIds: Set<string> = new Set();
  private processedMessageOrder: string[] = [];
  private toolRuntime?: ToolRuntimeLike;
  private protocol: MailboxProtocol;
  private bridgeAdapter: BridgeProtocolAdapter;
  private executionGateway: Pick<ExecutionGateway, 'submit'>;

  constructor(
    taskManager: TaskManager,
    logRepo: LogRepository,
    broadcaster: BroadcastClient,
    toolRuntime?: ToolRuntimeLike,
    options?: MailboxWatcherOptions,
  ) {
    this.taskManager = taskManager;
    this.logRepo = logRepo;
    this.broadcaster = broadcaster;
    this.toolRuntime = toolRuntime;
    this.protocol = options?.protocol || new MailboxProtocol();
    this.bridgeAdapter = new BridgeProtocolAdapter({ v1Protocol: this.protocol });
    this.inboxDir = options?.inboxDir || config.mailboxInboxDir;
    this.processedDir = options?.processedDir || config.mailboxProcessedDir;
    this.rejectedDir = options?.rejectedDir || config.mailboxRejectedDir;
    this.runtimeDir = options?.runtimeDir || config.mailboxRuntimeDir;
    this.seenDir = options?.seenDir || config.mailboxSeenDir;
    this.statusFilePath = options?.statusFilePath || config.mailboxStatusFile;
    this.executionGateway = options?.executionGateway || this.createExecutionGateway();
  }

  public async start() {
    for (const dir of [this.inboxDir, this.processedDir, this.rejectedDir, this.runtimeDir, this.seenDir]) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.logRepo.log('info', 'MailboxWatcher', 'Realizando escaneamento inicial do inbox da mailbox...');
    await this.processInbox().catch((error) => {
      this.logRepo.log('error', 'MailboxWatcher', `Erro no scan inicial: ${error.message}`);
    });

    fs.watch(this.inboxDir, async () => {
      if (!this.processing) {
        this.processing = true;
        try {
          await this.processInbox();
        } catch (error: any) {
          this.logRepo.log('error', 'MailboxWatcher', error.message);
        } finally {
          this.processing = false;
        }
      }
    });

    this.logRepo.log('info', 'MailboxWatcher', `Vigiando inbox da mailbox (FS Watch): ${this.inboxDir}`);
  }

  private async processInbox() {
    while (true) {
      const pendingFiles = await this.listPendingMessageFiles();
      if (pendingFiles.length === 0) {
        return;
      }

      for (const messagePath of pendingFiles) {
        await this.processMessageFile(messagePath);
      }
    }
  }

  private async processMessageFile(messagePath: string): Promise<void> {
    const content = await fs.promises.readFile(messagePath, 'utf8');

    // Usa o adapter universal V2 que aceita tanto V1 (.msg) quanto V2 (.json)
    const parsed = this.bridgeAdapter.parseUniversal(content);
    if (!parsed.accepted) {
      this.logRepo.log('warn', 'MailboxWatcher', parsed.reason);
      await this.moveMessageFile(messagePath, this.rejectedDir, 'rejected');
      await this.writeMailboxStatus('REJECTED', parsed.reason);
      return;
    }

    const envelope = parsed.envelope;
    const originalVersion = parsed.originalVersion;
    if (this.hasProcessedMessageId(envelope.messageId)) {
      const replayReason = `Mensagem rejeitada: replay detectado para ${envelope.messageId}.`;
      this.logRepo.log('warn', 'MailboxWatcher', replayReason);
      await this.moveMessageFile(messagePath, this.rejectedDir, 'rejected');
      await this.writeMailboxStatus('REJECTED', replayReason);
      return;
    }
    this.rememberProcessedMessageId(envelope.messageId);

    await this.moveMessageFile(messagePath, this.processedDir, 'processed');
    await this.writeMailboxStatus('CONSUMED', `message_id=${envelope.messageId}`);

    this.logRepo.log('info', 'MailboxWatcher', `[${originalVersion}] Iniciando plano autonomo para: ${envelope.payload.prompt}`);
    await this.broadcaster.broadcast(
      `Motor autonomo acordou.\nEstou lendo o inbox da mailbox...\nComando capturado: ${envelope.payload.prompt}`,
    );

    const task = this.taskManager.createPendingTask(
      'SYSTEM',
      'SYSTEM',
      envelope.payload.prompt,
      envelope.payload.prompt,
      '/auto_bridge',
    );
    task.source = 'system';
    task.workspace = envelope.payload.workspace === 'AUTO' ? null : envelope.payload.workspace;
    task.metadata = {
      ...(task.metadata || {}),
      mailbox_message_id: envelope.messageId,
      mailbox_protocol:
        originalVersion === 'V1'
          ? String((envelope.metadata as Record<string, unknown> | undefined)?.originalProtocol || 'ZAVORTH_MAILBOX_V1')
          : envelope.protocol,
      mailbox_original_version: originalVersion,
      mailbox_agent: envelope.agent,
      mailbox_correlation_id: envelope.correlationId,
    };

    const planner = new ZavorthBridgeAdapter(this.logRepo);

    try {
      this.taskManager.advanceState(task, 'parsed');
      this.taskManager.advanceState(task, 'planned');

      const plan = await planner.generatePlan(task);
      const gatewayPlan = this.normalizeShellPlanForGateway(task, plan);
      task.actions_planned = plan.steps;
      task.risk_level = plan.risk_level;
      task.executor_used = plan.executor_recommendation;
      task.metadata = {
        ...(task.metadata || {}),
        gateway_plan: gatewayPlan,
      };
      this.taskManager.saveTask(task);

      await this.broadcaster.broadcast(
        `Plano gerado (Risco ${plan.risk_level}).\nObjetivo: ${plan.objective}\nExecutor sugerido: ${plan.executor_recommendation}`,
      );

      if (plan.risk_level >= 2) {
        this.taskManager.advanceState(task, 'waiting_approval');
        task.requires_approval = true;
        this.taskManager.saveTask(task);
        await this.broadcaster.broadcast(
          `Acao sensivel bloqueada no motor autonomo.\n\nO plano gerado envolve manipulacao consideravel de sistema (Risco ${plan.risk_level}).\nPara prosseguir, aprove manualmente digitando:\n/approve ${task.task_id}`,
        );
        return;
      }

      const toolSteps = plan.steps.filter((step) => step.type === 'tool');

      for (const toolStep of toolSteps) {
        if (toolStep.tool && this.toolRuntime) {
          const result = await this.toolRuntime.executeTool(
            toolStep.tool,
            this.enrichToolArgsWithTrace(toolStep.args || {}, task),
          );
          await this.broadcaster.broadcast(`Resultado da tool [${toolStep.tool}]:\n${result}`);
        }
      }

      if (gatewayPlan.steps.length > 0) {
        await this.executePlanThroughGateway(task, gatewayPlan, plan.executor_recommendation || 'local_executor');
        await this.writeBridgeResponse(envelope, task, 'COMPLETED');
        return;
      }

      this.taskManager.advanceState(task, 'completed');
      this.taskManager.saveTask(task);
      await this.writeBridgeResponse(envelope, task, 'COMPLETED');
      await this.broadcaster.broadcast(
        toolSteps.length > 0
          ? 'Tarefa de consulta finalizada.'
          : 'Plano analisado e marcado como concluido (nenhuma instrucao executavel identificada).',
      );
    } catch (error: any) {
      logger.error('[MailboxWatcher] Falha critica:', error.message);
      task.error_summary = error.message;
      this.taskManager.advanceState(task, 'failed');
      this.taskManager.saveTask(task);
      await this.writeBridgeResponse(envelope, task, 'FAILED');
      await this.broadcaster.broadcast(`Falha no motor autonomo:\n${error.message}`);
    }
  }

  private async executePlanThroughGateway(task: any, plan: Plan, executorLabel: string): Promise<void> {
    this.taskManager.advanceState(task, 'running');
    const executionDecision = await this.executionGateway.submit(task, plan, false);

    if (executionDecision.requires_confirmation) {
      this.taskManager.advanceState(task, 'waiting_approval');
      task.requires_approval = true;
      task.error_summary = executionDecision.reason;
      this.taskManager.saveTask(task);
      await this.broadcaster.broadcast(
        `O plano autonomo precisa de aprovacao antes de executar.\nMotivo: ${executionDecision.reason}\n\nUse /approve ${task.task_id}`,
      );
      return;
    }

    if (!executionDecision.allowed || !executionDecision.execution_result) {
      this.taskManager.advanceState(task, 'failed');
      task.error_summary = executionDecision.reason;
      this.taskManager.saveTask(task);
      await this.broadcaster.broadcast(
        `O motor autonomo nao conseguiu executar pelo executor ${executorLabel}.\nMotivo: ${executionDecision.reason}`,
      );
      return;
    }

    const result = executionDecision.execution_result;
    this.taskManager.advanceState(task, result.success ? 'completed' : 'failed');
    task.result_summary = result.success ? (result.stdout || result.stderr || 'Execucao concluida.') : null;
    task.error_summary = result.success ? null : (result.error_message || result.stderr || 'Execucao falhou.');
    this.taskManager.saveTask(task);

    await this.broadcaster.broadcast(
      result.success
        ? `Execucao autonoma concluida via ${executorLabel}.\n${result.stdout || result.stderr || 'Nenhum output visual'}`
        : `Execucao autonoma falhou via ${executorLabel}.\n${result.error_message || result.stderr || 'Falha sem detalhes.'}`,
    );
  }

  private normalizeShellPlanForGateway(task: any, plan: Plan): Plan {
    const shellSteps = plan.steps
      .filter((step) => step.type === 'shell' && step.command)
      .map((step, index) => this.toGatewayExecStep(step, index));
    const workspace = task.workspace || plan.workspace_recommendation || config.defaultWorkspace;

    return {
      ...plan,
      workspace_recommendation: workspace,
      executor_recommendation: plan.executor_recommendation || 'local_executor',
      steps: shellSteps,
    };
  }

  private toGatewayExecStep(step: PlanStep, index: number): PlanStep {
    return {
      ...step,
      step_id: step.step_id || `mailbox-step-${index + 1}`,
      type: 'exec',
      tool: null,
      args: null,
    };
  }

  private createExecutionGateway(): ExecutionGateway {
    const gateway = new ExecutionGateway(this.logRepo);
    gateway.registerExecutor('local', new LocalExecutor());
    gateway.registerExecutor('codex', new CodexExecutor());
    const externalExecutor = new ExternalExecutor();
    gateway.registerExecutor(EXTERNAL_EXECUTOR_ID, externalExecutor);
    gateway.registerExecutor('gemini_cli', new (require('../execution/GeminiCliExecutor.js').GeminiCliExecutor)());
    gateway.registerExecutor('gemini_managed_agent', new (require('../execution/GeminiManagedAgentExecutor.js').GeminiManagedAgentExecutor)());
    gateway.registerExecutor('jules', new (require('../execution/JulesExecutor.js').JulesExecutor)());
    gateway.registerExecutor('swarm', new (require('../execution/SwarmExecutor.js').SwarmExecutor)(new (require('../services/llm/LlmRuntimeService.js').LlmRuntimeService)()));
    return gateway;
  }

  private enrichToolArgsWithTrace(args: any, task: any): any {
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      return args;
    }

    return {
      ...args,
      taskId: task?.task_id || args.taskId || args.task_id,
      metadata: {
        ...(args.metadata || {}),
        traceId:
          args.metadata?.traceId ||
          args.metadata?.trace_id ||
          task?.metadata?.traceId ||
          task?.metadata?.trace_id ||
          `task:${task?.task_id || 'unknown'}`,
      },
    };
  }

  private async writeMailboxStatus(status: 'CONSUMED' | 'REJECTED', detail: string): Promise<void> {
    const safeDetail = String(detail || '').replace(/\r?\n/g, ' ').trim();
    await fs.promises.mkdir(path.dirname(this.statusFilePath), { recursive: true });
    await fs.promises.writeFile(this.statusFilePath, `[STATUS: ${status}]\n[DETAIL: ${safeDetail || 'none'}]`, 'utf8');
  }

  private async listPendingMessageFiles(): Promise<string[]> {
    const entries = await fs.promises.readdir(this.inboxDir, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && (entry.name.endsWith('.msg') || entry.name.endsWith('.json')))
        .map(async (entry) => {
          const fullPath = path.join(this.inboxDir, entry.name);
          const stats = await fs.promises.stat(fullPath);
          return { fullPath, mtimeMs: stats.mtimeMs, name: entry.name };
        }),
    );

    return files
      .sort((left, right) => left.mtimeMs - right.mtimeMs || left.name.localeCompare(right.name))
      .map((entry) => entry.fullPath);
  }

  private async writeBridgeResponse(requestEnvelope: any, task: any, status: 'COMPLETED' | 'FAILED'): Promise<void> {
    try {
      const response = this.bridgeAdapter.buildResponse({
        correlationId: requestEnvelope.correlationId,
        inReplyTo: requestEnvelope.messageId,
        status,
        payload: {
          summary: status === 'COMPLETED'
            ? (task.result_summary || 'Tarefa concluida.')
            : (task.error_summary || 'Tarefa falhou.'),
          taskId: task.task_id,
          executorUsed: task.executor_used || undefined,
          riskLevel: task.risk_level ?? undefined,
          stdout: task.result_summary || undefined,
          stderr: task.error_summary || undefined,
          errorMessage: status === 'FAILED' ? (task.error_summary || undefined) : undefined,
        },
      });
      await this.bridgeAdapter.writeResponse(response);
      this.logRepo.log('info', 'MailboxWatcher', `[V2] Response escrita para correlationId=${requestEnvelope.correlationId}`);
    } catch (e: any) {
      this.logRepo.log('warn', 'MailboxWatcher', `Falha ao escrever BridgeResponse V2: ${e.message}`);
    }
  }

  private async moveMessageFile(sourcePath: string, targetDir: string, suffix: 'processed' | 'rejected'): Promise<string> {
    await fs.promises.mkdir(targetDir, { recursive: true });
    const parsed = path.parse(sourcePath);
    const targetPath = path.join(targetDir, `${parsed.name}.${suffix}${parsed.ext || '.msg'}`);
    await fs.promises.rename(sourcePath, targetPath);
    return targetPath;
  }

  private rememberProcessedMessageId(messageId: string): void {
    if (this.processedMessageIds.has(messageId)) {
      return;
    }

    this.processedMessageIds.add(messageId);
    this.processedMessageOrder.push(messageId);

    const maxTrackedIds = 200;
    while (this.processedMessageOrder.length > maxTrackedIds) {
      const oldest = this.processedMessageOrder.shift();
      if (oldest) {
        this.processedMessageIds.delete(oldest);
      }
    }

    const markerPath = path.join(this.seenDir, `${messageId}.seen`);
    fs.mkdirSync(this.seenDir, { recursive: true });
    if (!fs.existsSync(markerPath)) {
      fs.writeFileSync(markerPath, new Date().toISOString(), 'utf8');
    }
  }

  private hasProcessedMessageId(messageId: string): boolean {
    if (this.processedMessageIds.has(messageId)) {
      return true;
    }

    return fs.existsSync(path.join(this.seenDir, `${messageId}.seen`));
  }
}
