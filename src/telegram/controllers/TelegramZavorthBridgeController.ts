import { Context, InlineKeyboard } from 'grammy';
import { TaskManager } from '../../orchestrator/TaskManager.js';
import { Task } from '../../contracts/TaskContract.js';
import { PermissionRequest } from '../../contracts/PermissionRequest.js';
import { ZavorthBridgeControlAction, ZavorthBridgeControlService } from '../../services/ZavorthBridgeControlService.js';
import {
  ZavorthBridgePromptCompletionResult,
  ZavorthBridgePromptService,
  type ZavorthBridgePromptStartResult,
} from '../../services/ZavorthBridgePromptService.js';
import { ZavorthBridgePreferenceStore } from '../../agents/ZavorthBridgePreferenceStore.js';
import { PermissionService } from '../../services/PermissionService.js';
import { CapabilityLifecycleService } from '../../services/CapabilityLifecycleService.js';
import {
  AgentBridgeManagerLike,
  ZavorthBridgeCompanionBridgeLike,
  ZavorthBridgeWindowAutomatorLike,
  TelegramZavorthBridgeService,
} from './TelegramZavorthBridgeService.js';
import { TelegramZavorthBridgeControlService } from './TelegramZavorthBridgeControlService.js';
import { TelegramZavorthBridgePromptWorkflowService } from './TelegramZavorthBridgePromptWorkflowService.js';
import { TelegramZavorthBridgeResearchService } from './TelegramZavorthBridgeResearchService.js';
import { TelegramZavorthBridgeTaskExecutionService } from './TelegramZavorthBridgeTaskExecutionService.js';

type BotApiLike = {
  sendMessage(chatId: any, text: string, other?: any): Promise<any>;
};

type ZavorthBridgePermissionFactory = (
  task: Task,
  startResult: ZavorthBridgePromptStartResult,
  completion: ZavorthBridgePromptCompletionResult,
) => Promise<PermissionRequest>;

type TelegramZavorthBridgeControllerDeps = {
  taskManager: TaskManager;
  zavorthBridgeControlService: ZavorthBridgeControlService;
  zavorthBridgePromptService: ZavorthBridgePromptService;
  zavorthBridgePreferenceStore: ZavorthBridgePreferenceStore;
  permissionService: PermissionService;
  botApi: BotApiLike;
  persistTask: (task: Task) => void;
  truncateForTelegram: (content: string, maxLength: number) => string;
  createPermissionRequest: ZavorthBridgePermissionFactory;
  formatPermissionCreatedMessage: (permission: PermissionRequest) => string;
  buildPermissionKeyboard: (permission: PermissionRequest) => InlineKeyboard;
  shortPermissionId: (permission: PermissionRequest) => string;
  runResearchFallback?: (query: string) => Promise<string>;
  createWindowAutomator?: () => ZavorthBridgeWindowAutomatorLike;
  createCompanionBridge?: () => ZavorthBridgeCompanionBridgeLike;
  createBridgeManager?: () => AgentBridgeManagerLike;
  capabilityLifecycleService?: CapabilityLifecycleService;
};

export class TelegramZavorthBridgeController {
  private readonly bridgeService: TelegramZavorthBridgeService;
  private readonly controlService: TelegramZavorthBridgeControlService;
  private readonly promptWorkflowService: TelegramZavorthBridgePromptWorkflowService;
  private readonly researchService: TelegramZavorthBridgeResearchService;
  private readonly taskExecutionService: TelegramZavorthBridgeTaskExecutionService;

  constructor(private deps: TelegramZavorthBridgeControllerDeps) {
    this.controlService = new TelegramZavorthBridgeControlService({
      zavorthBridgeControlService: this.deps.zavorthBridgeControlService,
      zavorthBridgePreferenceStore: this.deps.zavorthBridgePreferenceStore,
      capabilityLifecycleService: this.deps.capabilityLifecycleService,
    });
    this.bridgeService = new TelegramZavorthBridgeService({
      taskManager: this.deps.taskManager,
      zavorthBridgeControlService: this.deps.zavorthBridgeControlService,
      zavorthBridgePreferenceStore: this.deps.zavorthBridgePreferenceStore,
      permissionService: this.deps.permissionService,
      persistTask: this.deps.persistTask,
      createWindowAutomator: this.deps.createWindowAutomator,
      createCompanionBridge: this.deps.createCompanionBridge,
      createBridgeManager: this.deps.createBridgeManager,
    });
    this.promptWorkflowService = new TelegramZavorthBridgePromptWorkflowService({
      taskManager: this.deps.taskManager,
      zavorthBridgePromptService: this.deps.zavorthBridgePromptService,
      permissionService: this.deps.permissionService,
      botApi: this.deps.botApi,
      persistTask: this.deps.persistTask,
      truncateForTelegram: this.deps.truncateForTelegram,
      createPermissionRequest: this.deps.createPermissionRequest,
      formatPermissionCreatedMessage: this.deps.formatPermissionCreatedMessage,
      buildPermissionKeyboard: this.deps.buildPermissionKeyboard,
      shortPermissionId: this.deps.shortPermissionId,
      createWindowAutomator: this.deps.createWindowAutomator,
    });
    this.researchService = new TelegramZavorthBridgeResearchService({
      taskManager: this.deps.taskManager,
      botApi: this.deps.botApi,
      persistTask: this.deps.persistTask,
      truncateForTelegram: this.deps.truncateForTelegram,
      runResearchFallback: this.deps.runResearchFallback,
    });
    this.taskExecutionService = new TelegramZavorthBridgeTaskExecutionService({
      taskManager: this.deps.taskManager,
      persistTask: this.deps.persistTask,
      createCompanionBridge: this.deps.createCompanionBridge,
      tryDirectResearchRoute: (ctx, task, prompt) => this.researchService.tryDirectResearchRoute(ctx, task, prompt),
      tryResearchFallback: (ctx, task, prompt, error) => this.researchService.tryResearchFallback(ctx, task, prompt, error),
    });
  }

  public parseControlCommand(rawText: string): { action: ZavorthBridgeControlAction; model?: string } | null {
    return this.controlService.parseControlCommand(rawText);
  }

  public parsePromptCommand(rawText: string): { model: string; prompt: string } | null {
    return this.controlService.parsePromptCommand(rawText);
  }

  public async handleControl(
    ctx: Context,
    action: ZavorthBridgeControlAction,
    model?: string,
  ): Promise<void> {
    return this.controlService.handleControl(ctx, action, model);
  }

  public async handlePrompt(ctx: Context, model: string, prompt: string): Promise<void> {
    return this.promptWorkflowService.handlePrompt(ctx, model, prompt);
  }

  public async finishPrompt(task: Task, startResult: ZavorthBridgePromptStartResult): Promise<void> {
    return this.promptWorkflowService.finishPrompt(task, startResult);
  }

  public async handleTaskExecution(ctx: Context, task: Task, prompt: string): Promise<void> {
    return this.taskExecutionService.handleTaskExecution(ctx, task, prompt);
  }

  public async handleWindowAction(
    ctx: Context,
    action: string,
    text?: string,
  ): Promise<void> {
    return this.bridgeService.handleWindowAction(ctx, action, text);
  }

  public async handleBridgeStatus(ctx: Context): Promise<void> {
    return this.bridgeService.handleBridgeStatus(ctx);
  }

  public async handleSessionAction(ctx: Context, action: string): Promise<void> {
    return this.bridgeService.handleSessionAction(ctx, action);
  }

  public async handleModelCommand(ctx: Context, args: string): Promise<void> {
    return this.controlService.handleModelCommand(ctx, args);
  }
}
