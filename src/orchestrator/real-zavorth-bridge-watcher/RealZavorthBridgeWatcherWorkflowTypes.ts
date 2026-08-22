import type { Task } from '../../contracts/TaskContract.js';
import type { PermissionRequest } from '../../contracts/PermissionRequest.js';
import type { AgentBridgeManager } from '../AgentBridgeManager.js';
import type { ZavorthBridgeWindowAutomator } from '../../agents/ZavorthBridgeWindowAutomator.js';
import type { ZavorthBridgeCompanionBridge } from '../../agents/ZavorthBridgeCompanionBridge.js';
import type { PermissionService } from '../../services/PermissionService.js';
import type {
  ZavorthBridgeUiCaptureService,
} from '../../services/ZavorthBridgeUiCaptureService.js';
import type { FinalResponseFormattingService } from '../../services/FinalResponseFormattingService.js';

export type BroadcastClient = {
  broadcast(message: string): Promise<void>;
  sendToChat?(chatId: string, message: string): Promise<void>;
};

export type BotApiLike = {
  sendMessage(chatId: string | number, text: string, other?: Record<string, unknown>): Promise<unknown>;
};

export type RealZavorthBridgeWatcherDeps = {
  taskManager?: {
    getTask(taskId: string): Task | undefined;
    getPendingTasks(): Task[];
    saveTask(task: Task): void;
    advanceState(task: Task, state: string): void;
  };
  permissionService?: PermissionService;
  botApi?: BotApiLike;
  formatPermissionCreatedMessage?: (permission: PermissionRequest) => string;
  buildPermissionKeyboard?: (permission: PermissionRequest) => unknown;
};

export type ScopedCompanionUiTarget = {
  targetInstanceId?: string;
  liveStatus: Record<string, unknown> | null;
  targetProcessId?: number;
  exactInstanceMatch: boolean;
};

export type RealZavorthBridgeWatcherWorkflowContext = {
  logRepo: { log(level: string, source: string, message: string, meta?: Record<string, unknown>): void };
  broadcaster: BroadcastClient;
  deps: RealZavorthBridgeWatcherDeps;
  bridgeManager: AgentBridgeManager;
  windowAutomator: ZavorthBridgeWindowAutomator;
  companionBridge: ZavorthBridgeCompanionBridge;
  uiCaptureService: ZavorthBridgeUiCaptureService;
  formatter: FinalResponseFormattingService;
  responseDir: string;
  brainDir: string;
  logsDir: string;
  getTask(taskId: string): Task | null;
  isTaskTerminal(task: Task | null): boolean;
  processPendingDeliveries(): Promise<void>;
};
