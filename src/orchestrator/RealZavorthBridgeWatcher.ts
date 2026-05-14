import fs from 'fs';
import { Task } from '../contracts/TaskContract.js';
import { LogRepository } from '../storage/LogRepository.js';
import { config } from '../config/index.js';
import { AgentBridgeManager, PendingZavorthBridgeSession } from './AgentBridgeManager.js';
import { ZavorthBridgeWindowAutomator } from '../agents/ZavorthBridgeWindowAutomator.js';
import { ZavorthBridgeCompanionBridge } from '../agents/ZavorthBridgeCompanionBridge.js';
import { ZavorthBridgeUiCaptureService } from '../services/ZavorthBridgeUiCaptureService.js';
import { FinalResponseFormattingService } from '../services/FinalResponseFormattingService.js';
import { RealZavorthBridgeWatcherTickHandlers } from './real-zavorth-bridge-watcher/RealZavorthBridgeWatcherTickHandlers.js';
import { RealZavorthBridgeWatcherWorkflow } from './real-zavorth-bridge-watcher/RealZavorthBridgeWatcherWorkflow.js';
import type {
  BroadcastClient,
  RealZavorthBridgeWatcherDeps,
  ScopedCompanionUiTarget,
} from './real-zavorth-bridge-watcher/RealZavorthBridgeWatcherWorkflowTypes.js';
import type {
  ZavorthBridgeArtifact,
  ZavorthBridgeLogEvent,
} from './real-zavorth-bridge-watcher/RealZavorthBridgeWatcherArtifactLogHelpers.js';

export class RealZavorthBridgeWatcher {
  private responseDir = config.zavorthBridgeResponseDir;
  private brainDir = config.zavorthBridgeBrainDir;
  private logsDir = config.zavorthBridgeLogsDir;
  private bridgeManager = new AgentBridgeManager();
  private windowAutomator = new ZavorthBridgeWindowAutomator();
  private companionBridge = new ZavorthBridgeCompanionBridge();
  private uiCaptureService = new ZavorthBridgeUiCaptureService();
  private formatter = new FinalResponseFormattingService();
  private processing = false;
  private pollHandle: NodeJS.Timeout | null = null;
  private workflow: RealZavorthBridgeWatcherWorkflow;
  private tickHandlers: RealZavorthBridgeWatcherTickHandlers;

  constructor(
    private logRepo: LogRepository,
    private broadcaster: BroadcastClient,
    private deps: RealZavorthBridgeWatcherDeps = {},
  ) {
    this.workflow = new RealZavorthBridgeWatcherWorkflow({
      logRepo: this.logRepo,
      broadcaster: this.broadcaster,
      deps: this.deps,
      bridgeManager: this.bridgeManager,
      windowAutomator: this.windowAutomator,
      companionBridge: this.companionBridge,
      uiCaptureService: this.uiCaptureService,
      formatter: this.formatter,
      responseDir: this.responseDir,
      brainDir: this.brainDir,
      logsDir: this.logsDir,
      getTask: (taskId) => this.getTask(taskId),
      isTaskTerminal: (task) => this.isTaskTerminal(task),
      processPendingDeliveries: () => this.processPendingDeliveries(),
    });
    this.tickHandlers = new RealZavorthBridgeWatcherTickHandlers(this);
  }

  public start(): void {
    if (this.pollHandle) {
      this.logRepo.log(
        'warn',
        'RealZavorthBridgeWatcher',
        'Watcher ja estava ativo; ignorando start duplicado.',
      );
      return;
    }

    fs.mkdirSync(this.responseDir, { recursive: true });
    fs.mkdirSync(this.brainDir, { recursive: true });

    this.processTick().catch((error) => {
      this.logRepo.log('error', 'RealZavorthBridgeWatcher', error.message);
    });

    this.pollHandle = setInterval(() => {
      this.processTick().catch((error) => {
        this.logRepo.log('error', 'RealZavorthBridgeWatcher', error.message);
      });
    }, 3000);
    this.pollHandle.unref?.();

    this.logRepo.log(
      'info',
      'RealZavorthBridgeWatcher',
      `Watching ZavorthBridge brain at ${this.brainDir}, logs at ${this.logsDir}, and fallback responses at ${this.responseDir}`,
    );
  }

  public stop(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    this.processing = false;
  }

  private async processTick(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;
    try {
      await this.reconcileZavorthBridgePermissionState();
      await this.processPendingResponses();
      await this.processPendingLogs();
      await this.processPendingArtifacts();
      await this.processPendingPermissionNotifications();
      await this.processVisibleResponses();
      await this.processPendingDeliveries();
      await this.processStalledSessions();
    } finally {
      this.processing = false;
    }
  }

  private async reconcileZavorthBridgePermissionState(): Promise<void> {
    return this.tickHandlers.reconcileZavorthBridgePermissionState();
  }

  private async processPendingResponses(): Promise<void> {
    return this.tickHandlers.processPendingResponses();
  }

  private async processPendingArtifacts(): Promise<void> {
    return this.tickHandlers.processPendingArtifacts();
  }

  private async processPendingPermissionNotifications(): Promise<void> {
    return this.tickHandlers.processPendingPermissionNotifications();
  }

  private async processVisibleResponses(): Promise<void> {
    return this.tickHandlers.processVisibleResponses();
  }

  private async processPendingDeliveries(): Promise<void> {
    return this.tickHandlers.processPendingDeliveries();
  }

  private async processPendingLogs(): Promise<void> {
    return this.tickHandlers.processPendingLogs();
  }

  private async processStalledSessions(): Promise<void> {
    return this.tickHandlers.processStalledSessions();
  }

  private syncWorkflowContext(): void {
    Object.assign((this.workflow as any).ctx, {
      logRepo: this.logRepo,
      broadcaster: this.broadcaster,
      deps: this.deps,
      bridgeManager: this.bridgeManager,
      windowAutomator: this.windowAutomator,
      companionBridge: this.companionBridge,
      uiCaptureService: this.uiCaptureService,
      formatter: this.formatter,
      responseDir: this.responseDir,
      brainDir: this.brainDir,
      logsDir: this.logsDir,
      processPendingDeliveries: () => this.processPendingDeliveries(),
    });

    Object.assign((this.workflow as any).taskSupport.host, {
      logRepo: this.logRepo,
      deps: this.deps,
      bridgeManager: this.bridgeManager,
      formatter: this.formatter,
    });

    Object.assign((this.workflow as any).companionSupport.host, {
      logRepo: this.logRepo,
      bridgeManager: this.bridgeManager,
      windowAutomator: this.windowAutomator,
      companionBridge: this.companionBridge,
    });

    const overriddenMethodNames = [
      'collectArtifacts',
      'getLiveCompanionStatus',
      'resolveCompanionTargetInstanceId',
      'resolveScopedCompanionUiTarget',
      'canCaptureScopedSessionUi',
      'tryCompanionRecovery',
      'buildCompanionRecoveryPrompt',
      'tryAutomationRescue',
    ] as const;

    for (const methodName of overriddenMethodNames) {
      if (Object.prototype.hasOwnProperty.call(this, methodName)) {
        const maybeOverride = (this as any)[methodName];
        if (typeof maybeOverride === 'function') {
          (this.workflow as any)[methodName] = maybeOverride.bind(this);
        }
      }
    }

    const companionSupportOverrideNames = [
      'getLiveCompanionStatus',
      'resolveCompanionTargetInstanceId',
      'tryCompanionRecovery',
      'buildCompanionRecoveryPrompt',
    ] as const;

    for (const methodName of companionSupportOverrideNames) {
      if (Object.prototype.hasOwnProperty.call(this, methodName)) {
        const maybeOverride = (this as any)[methodName];
        if (typeof maybeOverride === 'function') {
          (this.workflow as any).companionSupport[methodName] = maybeOverride.bind(this);
        }
      }
    }
  }

  private callWorkflow(methodName: string, args: any[]): any {
    this.syncWorkflowContext();
    const method = (this.workflow as any)[methodName];
    return method.apply(this.workflow, args);
  }

  private collectArtifacts(): Promise<ZavorthBridgeArtifact[]> {
    return this.callWorkflow('collectArtifacts', []);
  }

  private collectRecentLogEvents(): Promise<ZavorthBridgeLogEvent[]> {
    return this.callWorkflow('collectRecentLogEvents', []);
  }

  private findLatestZavorthBridgeLogFile(...args: any[]): any {
    return this.callWorkflow('findLatestZavorthBridgeLogFile', args);
  }

  private parseLogEvent(...args: any[]): any {
    return this.callWorkflow('parseLogEvent', args);
  }

  private isInterestingLogLine(...args: any[]): any {
    return this.callWorkflow('isInterestingLogLine', args);
  }

  private isAutomationTriggerLogLine(...args: any[]): any {
    return this.callWorkflow('isAutomationTriggerLogLine', args);
  }

  private resolveArtifactContentPath(...args: any[]): any {
    return this.callWorkflow('resolveArtifactContentPath', args);
  }

  private findBestArtifactForSession(
    session: PendingZavorthBridgeSession,
    artifacts: ZavorthBridgeArtifact[],
  ): ZavorthBridgeArtifact | null {
    return this.callWorkflow('findBestArtifactForSession', [session, artifacts]);
  }

  private matchesSession(...args: any[]): any {
    return this.callWorkflow('matchesSession', args);
  }

  private isSessionActive(session: PendingZavorthBridgeSession): boolean {
    return this.callWorkflow('isSessionActive', [session]);
  }

  private tryAutomationRescue(...args: any[]): any {
    return this.callWorkflow('tryAutomationRescue', args);
  }

  private getLiveCompanionStatus(...args: any[]): any {
    return this.callWorkflow('getLiveCompanionStatus', args);
  }

  private resolveScopedCompanionUiTarget(...args: any[]): any {
    return this.callWorkflow('resolveScopedCompanionUiTarget', args);
  }

  private canCaptureScopedSessionUi(...args: any[]): any {
    return this.callWorkflow('canCaptureScopedSessionUi', args);
  }

  private resolveCompanionTargetInstanceId(...args: any[]): any {
    return this.callWorkflow('resolveCompanionTargetInstanceId', args);
  }

  private tryCompanionRecovery(...args: any[]): any {
    return this.callWorkflow('tryCompanionRecovery', args);
  }

  private buildCompanionRecoveryPrompt(...args: any[]): any {
    return this.callWorkflow('buildCompanionRecoveryPrompt', args);
  }

  private getTask(taskId: string): Task | null {
    return this.callWorkflow('getTask', [taskId]);
  }

  private isTaskTerminal(task: Task | null | undefined): boolean {
    return this.callWorkflow('isTaskTerminal', [task || null]);
  }

  private markTaskDelivered(...args: any[]): any {
    return this.callWorkflow('markTaskDelivered', args);
  }

  private markTaskFailed(...args: any[]): any {
    return this.callWorkflow('markTaskFailed', args);
  }

  private resolvePendingPermissionForTerminalTask(...args: any[]): any {
    return this.callWorkflow('resolvePendingPermissionForTerminalTask', args);
  }

  private queueSessionDelivery(...args: any[]): any {
    return this.callWorkflow('queueSessionDelivery', args);
  }

  private failStalledSession(...args: any[]): any {
    return this.callWorkflow('failStalledSession', args);
  }

  private tryQueueLocalDirectoryFallback(...args: any[]): any {
    return this.callWorkflow('tryQueueLocalDirectoryFallback', args);
  }

  private describeStalledFailure(...args: any[]): any {
    return this.callWorkflow('describeStalledFailure', args);
  }

  private hasCompanionHandoffMismatch(...args: any[]): any {
    return this.callWorkflow('hasCompanionHandoffMismatch', args);
  }

  private normalizeComparisonValue(...args: any[]): any {
    return this.callWorkflow('normalizeComparisonValue', args);
  }

  private isLocalDirectoryInspectionPrompt(...args: any[]): any {
    return this.callWorkflow('isLocalDirectoryInspectionPrompt', args);
  }

  private resolveDirectoryListingTarget(...args: any[]): any {
    return this.callWorkflow('resolveDirectoryListingTarget', args);
  }

  private extractDirectoryHints(...args: any[]): any {
    return this.callWorkflow('extractDirectoryHints', args);
  }

  private resolveDirectoryHint(...args: any[]): any {
    return this.callWorkflow('resolveDirectoryHint', args);
  }

  private listAncestorDirectories(...args: any[]): any {
    return this.callWorkflow('listAncestorDirectories', args);
  }

  private normalizePathToken(...args: any[]): any {
    return this.callWorkflow('normalizePathToken', args);
  }

  private pathTokensRoughlyMatch(...args: any[]): any {
    return this.callWorkflow('pathTokensRoughlyMatch', args);
  }

  private isExistingDirectory(...args: any[]): any {
    return this.callWorkflow('isExistingDirectory', args);
  }

  private safeReadDirectory(...args: any[]): any {
    return this.callWorkflow('safeReadDirectory', args);
  }

  private normalizeVisibleResponse(...args: any[]): any {
    return this.callWorkflow('normalizeVisibleResponse', args);
  }

  private sanitizeVisibleResponse(...args: any[]): any {
    return this.callWorkflow('sanitizeVisibleResponse', args);
  }

  private isVisibleResponseCaptureReady(...args: any[]): any {
    return this.callWorkflow('isVisibleResponseCaptureReady', args);
  }

  private tryQueuePromptContractDelivery(...args: any[]): any {
    return this.callWorkflow('tryQueuePromptContractDelivery', args);
  }

  private extractFileCreationPromptContract(...args: any[]): any {
    return this.callWorkflow('extractFileCreationPromptContract', args);
  }

  private normalizePromptContractFileContent(...args: any[]): any {
    return this.callWorkflow('normalizePromptContractFileContent', args);
  }

  private clearPendingPermissionMetadata(...args: any[]): any {
    return this.callWorkflow('clearPendingPermissionMetadata', args);
  }

  private isTrackingFileCompleted(...args: any[]): any {
    return this.callWorkflow('isTrackingFileCompleted', args);
  }

  private isZavorthBridgeTask(...args: any[]): any {
    return this.callWorkflow('isZavorthBridgeTask', args);
  }

  private wasPermissionRecentlyNotified(...args: any[]): any {
    return this.callWorkflow('wasPermissionRecentlyNotified', args);
  }

  private maybeHandlePermissionPrompt(...args: any[]): any {
    return this.callWorkflow('maybeHandlePermissionPrompt', args);
  }

  private findZavorthBridgeAutoApprovalPolicy(...args: any[]): any {
    return this.callWorkflow('findZavorthBridgeAutoApprovalPolicy', args);
  }

  private resolveZavorthBridgeApprovalMode(...args: any[]): any {
    return this.callWorkflow('resolveZavorthBridgeApprovalMode', args);
  }

  private buildZavorthBridgePermissionReason(...args: any[]): any {
    return this.callWorkflow('buildZavorthBridgePermissionReason', args);
  }

  private notifyPermissionRequest(...args: any[]): any {
    return this.callWorkflow('notifyPermissionRequest', args);
  }

  private isRecentTimestamp(...args: any[]): any {
    return this.callWorkflow('isRecentTimestamp', args);
  }

  private formatFinalResponseBroadcast(...args: any[]): any {
    return this.callWorkflow('formatFinalResponseBroadcast', args);
  }

  private formatArtifactCompletion(...args: any[]): any {
    return this.callWorkflow('formatArtifactCompletion', args);
  }

  private humanizeArtifactType(...args: any[]): any {
    return this.callWorkflow('humanizeArtifactType', args);
  }

  private truncate(...args: any[]): any {
    return this.callWorkflow('truncate', args);
  }

  private formatTelegramFriendlyResponse(...args: any[]): any {
    return this.callWorkflow('formatTelegramFriendlyResponse', args);
  }

  private tryFormatStructuredInventory(...args: any[]): any {
    return this.callWorkflow('tryFormatStructuredInventory', args);
  }

  private extractInventoryHeading(...args: any[]): any {
    return this.callWorkflow('extractInventoryHeading', args);
  }

  private extractInventoryItem(...args: any[]): any {
    return this.callWorkflow('extractInventoryItem', args);
  }

  private looksLikeInventoryItem(...args: any[]): any {
    return this.callWorkflow('looksLikeInventoryItem', args);
  }

  private isDiscardableZavorthBridgeClosingLine(...args: any[]): any {
    return this.callWorkflow('isDiscardableZavorthBridgeClosingLine', args);
  }

  private normalizeTelegramFriendlyText(...args: any[]): any {
    return this.callWorkflow('normalizeTelegramFriendlyText', args);
  }

  private sendDeliveryToOriginChat(...args: any[]): any {
    return this.callWorkflow('sendDeliveryToOriginChat', args);
  }

  private sendToSession(...args: any[]): any {
    return this.callWorkflow('sendToSession', args);
  }
}
