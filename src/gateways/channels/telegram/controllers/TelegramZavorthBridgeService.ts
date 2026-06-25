import { Context } from 'grammy';
import { Task } from '../../../../contracts/TaskContract.js';
import { ZavorthBridgeControlService } from '../../../../services/ZavorthBridgeControlService.js';
import { ZavorthBridgePreferenceStore } from '../../../../agents/ZavorthBridgePreferenceStore.js';
import { PermissionService } from '../../../../services/PermissionService.js';
import { TaskManager } from '../../../../orchestrator/TaskManager.js';
import { TelegramZavorthBridgeSessionBridgeService } from '../../../../gateways/channels/telegram/controllers/TelegramZavorthBridgeSessionBridgeService.js';
import {
  TelegramZavorthBridgeWindowBridgeService,
} from '../../../../gateways/channels/telegram/controllers/TelegramZavorthBridgeWindowBridgeService.js';
import type {
  AgentBridgeManagerLike,
  ZavorthBridgeCompanionBridgeLike,
  ZavorthBridgeWindowAutomatorLike,
} from '../../../../gateways/channels/telegram/controllers/TelegramZavorthBridgeTypes.js';

export type {
  AgentBridgeManagerLike,
  ZavorthBridgeCompanionBridgeLike,
  ZavorthBridgeWindowAutomatorLike,
} from '../../../../gateways/channels/telegram/controllers/TelegramZavorthBridgeTypes.js';

type TelegramZavorthBridgeServiceDeps = {
  taskManager: Pick<TaskManager, 'advanceState' | 'getTask'>;
  zavorthBridgeControlService: Pick<ZavorthBridgeControlService, 'restart'>;
  zavorthBridgePreferenceStore: Pick<ZavorthBridgePreferenceStore, 'getPreferredModel'>;
  permissionService: Pick<PermissionService, 'listRequests' | 'rejectRequest'>;
  persistTask: (task: Task) => void;
  createWindowAutomator?: () => ZavorthBridgeWindowAutomatorLike;
  createCompanionBridge?: () => ZavorthBridgeCompanionBridgeLike;
  createBridgeManager?: () => AgentBridgeManagerLike;
};

export class TelegramZavorthBridgeService {
  private readonly sessionBridgeService: TelegramZavorthBridgeSessionBridgeService;
  private readonly windowBridgeService: TelegramZavorthBridgeWindowBridgeService;

  constructor(private readonly deps: TelegramZavorthBridgeServiceDeps) {
    this.windowBridgeService = new TelegramZavorthBridgeWindowBridgeService({
      zavorthBridgePreferenceStore: this.deps.zavorthBridgePreferenceStore,
      createWindowAutomator: this.deps.createWindowAutomator,
      createCompanionBridge: this.deps.createCompanionBridge,
    });
    this.sessionBridgeService = new TelegramZavorthBridgeSessionBridgeService({
      taskManager: this.deps.taskManager,
      zavorthBridgeControlService: this.deps.zavorthBridgeControlService,
      permissionService: this.deps.permissionService,
      persistTask: this.deps.persistTask,
      createWindowAutomator: this.deps.createWindowAutomator,
      createCompanionBridge: this.deps.createCompanionBridge,
      createBridgeManager: this.deps.createBridgeManager,
    });
  }

  public async handleWindowAction(
    ctx: Context,
    action: string,
    text?: string,
  ): Promise<void> {
    await this.windowBridgeService.handleWindowAction(ctx, action, text);
  }

  public async handleBridgeStatus(ctx: Context): Promise<void> {
    await this.windowBridgeService.handleBridgeStatus(ctx);
  }

  public async handleSessionAction(ctx: Context, action: string): Promise<void> {
    await this.sessionBridgeService.handleSessionAction(ctx, action);
  }
}
