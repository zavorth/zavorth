// @ts-nocheck
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

    private findLatestZavorthBridgeLogFile(): Promise<string | null> {
    return this.callWorkflow('findLatestZavorthBridgeLogFile', []);
  }

    private parseLogEvent(line: string): ZavorthBridgeLogEvent | null {
    return this.callWorkflow('parseLogEvent', [line]);
  }

    private isInterestingLogLine(line: string): boolean {
    return this.callWorkflow('isInterestingLogLine', [line]);
  }

    private isAutomationTriggerLogLine(line: string): boolean {
    return this.callWorkflow('isAutomationTriggerLogLine', [line]);
  }

    private resolveArtifactContentPath(dirPath: string, baseName: string): Promise<string | null> {
    return this.callWorkflow('resolveArtifactContentPath', [dirPath, baseName]);
  }

  private findBestArtifactForSession(
    session: PendingZavorthBridgeSession,
    artifacts: ZavorthBridgeArtifact[],
  ): ZavorthBridgeArtifact | null {
    return this.callWorkflow('findBestArtifactForSession', [session, artifacts]);
  }

    private matchesSession(session: PendingZavorthBridgeSession, artifact: ZavorthBridgeArtifact): boolean {
    return this.callWorkflow('matchesSession', [session, artifact]);
  }

  private isSessionActive(session: PendingZavorthBridgeSession): boolean {
    return this.callWorkflow('isSessionActive', [session]);
  }

    private tryAutomationRescue(session: PendingZavorthBridgeSession, reason: 'stalled' | 'log_error'): Promise<void> {
    return this.callWorkflow('tryAutomationRescue', [session, reason]);
  }

    private getLiveCompanionStatus(targetInstanceId?: string): Promise<Record<string, any> | null> {
    return this.callWorkflow('getLiveCompanionStatus', [targetInstanceId]);
  }

    private resolveScopedCompanionUiTarget(session: PendingZavorthBridgeSession): Promise<ScopedCompanionUiTarget> {
    return this.callWorkflow('resolveScopedCompanionUiTarget', [session]);
  }

    private canCaptureScopedSessionUi(target: ScopedCompanionUiTarget): boolean {
    return this.callWorkflow('canCaptureScopedSessionUi', [target]);
  }

    private resolveCompanionTargetInstanceId(session: PendingZavorthBridgeSession): string | undefined {
    return this.callWorkflow('resolveCompanionTargetInstanceId', [session]);
  }

    private tryCompanionRecovery(
    session: PendingZavorthBridgeSession,
    target: ScopedCompanionUiTarget,
    liveStatus: Record<string, any> | null,
    errorReason: string,
  ): Promise<boolean> {
    return this.callWorkflow('tryCompanionRecovery', [session, target, liveStatus, errorReason]);
  }

    private buildCompanionRecoveryPrompt(
    session: PendingZavorthBridgeSession,
    target: ScopedCompanionUiTarget,
    liveStatus: Record<string, any> | null,
    errorReason: string,
  ): string {
    return this.callWorkflow('buildCompanionRecoveryPrompt', [session, target, liveStatus, errorReason]);
  }

  private getTask(taskId: string): Task | null {
    return this.callWorkflow('getTask', [taskId]);
  }

  private isTaskTerminal(task: Task | null | undefined): boolean {
    return this.callWorkflow('isTaskTerminal', [task || null]);
  }

    private markTaskDelivered(taskId: string, summary: string | null): Promise<void> {
    return this.callWorkflow('markTaskDelivered', [taskId, summary]);
  }

    private markTaskFailed(taskId: string, summary: string): Promise<void> {
    return this.callWorkflow('markTaskFailed', [taskId, summary]);
  }

    private resolvePendingPermissionForTerminalTask(task: Task, note: string): Promise<void> {
    return this.callWorkflow('resolvePendingPermissionForTerminalTask', [task, note]);
  }

    private queueSessionDelivery(
    session: PendingZavorthBridgeSession,
    deliverable: any,
    chatGatewayId: string | null,
  ): void {
    return this.callWorkflow('queueSessionDelivery', [session, deliverable, chatGatewayId]);
  }

    private failStalledSession(session: PendingZavorthBridgeSession, errorReason: string): Promise<void> {
    return this.callWorkflow('failStalledSession', [session, errorReason]);
  }

    private tryQueueLocalDirectoryFallback(session: PendingZavorthBridgeSession, workspace: string): Promise<boolean> {
    return this.callWorkflow('tryQueueLocalDirectoryFallback', [session, workspace]);
  }

    private describeStalledFailure(session: PendingZavorthBridgeSession, liveStatus: Record<string, any> | null): string {
    return this.callWorkflow('describeStalledFailure', [session, liveStatus]);
  }

    private hasCompanionHandoffMismatch(
    session: PendingZavorthBridgeSession,
    liveStatus: Record<string, any> | null,
  ): boolean {
    return this.callWorkflow('hasCompanionHandoffMismatch', [session, liveStatus]);
  }

    private normalizeComparisonValue(rawValue: string | null | undefined): string {
    return this.callWorkflow('normalizeComparisonValue', [rawValue]);
  }

    private isLocalDirectoryInspectionPrompt(prompt: string): boolean {
    return this.callWorkflow('isLocalDirectoryInspectionPrompt', [prompt]);
  }

    private resolveDirectoryListingTarget(prompt: string, workspace: string): string | null {
    return this.callWorkflow('resolveDirectoryListingTarget', [prompt, workspace]);
  }

    private extractDirectoryHints(prompt: string): string[] {
    return this.callWorkflow('extractDirectoryHints', [prompt]);
  }

    private resolveDirectoryHint(hint: string, workspacePath: string): string | null {
    return this.callWorkflow('resolveDirectoryHint', [hint, workspacePath]);
  }

    private listAncestorDirectories(startPath: string): string[] {
    return this.callWorkflow('listAncestorDirectories', [startPath]);
  }

    private normalizePathToken(value: string): string {
    return this.callWorkflow('normalizePathToken', [value]);
  }

    private pathTokensRoughlyMatch(left: string, right: string): boolean {
    return this.callWorkflow('pathTokensRoughlyMatch', [left, right]);
  }

    private isExistingDirectory(candidate: string): boolean {
    return this.callWorkflow('isExistingDirectory', [candidate]);
  }

    private safeReadDirectory(candidate: string): fs.Dirent[] {
    return this.callWorkflow('safeReadDirectory', [candidate]);
  }

    private normalizeVisibleResponse(value: string | null | undefined): string {
    return this.callWorkflow('normalizeVisibleResponse', [value]);
  }

    private sanitizeVisibleResponse(value: string | null | undefined, promptText: string | null | undefined): string {
    return this.callWorkflow('sanitizeVisibleResponse', [value, promptText]);
  }

    private isVisibleResponseCaptureReady(promptText: string, visibleResponse: string | null | undefined): boolean {
    return this.callWorkflow('isVisibleResponseCaptureReady', [promptText, visibleResponse]);
  }

    private tryQueuePromptContractDelivery(session: PendingZavorthBridgeSession): Promise<boolean> {
    return this.callWorkflow('tryQueuePromptContractDelivery', [session]);
  }

    private extractFileCreationPromptContract(
    promptText: string,
    visibleResponse: string | null | undefined,
  ): { filePath: string; fileContent: string } | null {
    return this.callWorkflow('extractFileCreationPromptContract', [promptText, visibleResponse]);
  }

    private normalizePromptContractFileContent(value: string | null | undefined): string {
    return this.callWorkflow('normalizePromptContractFileContent', [value]);
  }

    private clearPendingPermissionMetadata(task: Task): void {
    return this.callWorkflow('clearPendingPermissionMetadata', [task]);
  }

    private isTrackingFileCompleted(trackingFile: string): boolean {
    return this.callWorkflow('isTrackingFileCompleted', [trackingFile]);
  }

    private isZavorthBridgeTask(task: Task | null | undefined): boolean {
    return this.callWorkflow('isZavorthBridgeTask', [task]);
  }

    private wasPermissionRecentlyNotified(permissionId: string, minAgeMs: number): boolean {
    return this.callWorkflow('wasPermissionRecentlyNotified', [permissionId, minAgeMs]);
  }

    private maybeHandlePermissionPrompt(session: PendingZavorthBridgeSession, trackingFile: string): Promise<boolean> {
    return this.callWorkflow('maybeHandlePermissionPrompt', [session, trackingFile]);
  }

    private findZavorthBridgeAutoApprovalPolicy(permission: PermissionRequest): Promise<any> {
    return this.callWorkflow('findZavorthBridgeAutoApprovalPolicy', [permission]);
  }

    private resolveZavorthBridgeApprovalMode(permission: PermissionRequest): 'once' | 'conversation' {
    return this.callWorkflow('resolveZavorthBridgeApprovalMode', [permission]);
  }

    private buildZavorthBridgePermissionReason(snapshot: ZavorthBridgeUiSnapshot): string | null {
    return this.callWorkflow('buildZavorthBridgePermissionReason', [snapshot]);
  }

    private notifyPermissionRequest(permission: PermissionRequest, reason: string): Promise<void> {
    return this.callWorkflow('notifyPermissionRequest', [permission, reason]);
  }

    private isRecentTimestamp(value: string | null | undefined, maxAgeMs: number): boolean {
    return this.callWorkflow('isRecentTimestamp', [value, maxAgeMs]);
  }

    private formatFinalResponseBroadcast(session: PendingZavorthBridgeSession, finalResponseText: string): string {
    return this.callWorkflow('formatFinalResponseBroadcast', [session, finalResponseText]);
  }

    private formatArtifactCompletion(session: PendingZavorthBridgeSession, artifact: ZavorthBridgeArtifact): string {
    return this.callWorkflow('formatArtifactCompletion', [session, artifact]);
  }

    private humanizeArtifactType(artifactType: string): string {
    return this.callWorkflow('humanizeArtifactType', [artifactType]);
  }

    private truncate(content: string, maxLength: number): string {
    return this.callWorkflow('truncate', [content, maxLength]);
  }

    private formatTelegramFriendlyResponse(
    originalResponse: string,
    session: PendingZavorthBridgeSession,
    artifact?: ZavorthBridgeArtifact,
  ): string {
    return this.callWorkflow('formatTelegramFriendlyResponse', [originalResponse, session, artifact]);
  }

    private tryFormatStructuredInventory(originalResponse: string, session: PendingZavorthBridgeSession): string | null {
    return this.callWorkflow('tryFormatStructuredInventory', [originalResponse, session]);
  }

    private extractInventoryHeading(line: string): string | null {
    return this.callWorkflow('extractInventoryHeading', [line]);
  }

    private extractInventoryItem(line: string): string | null {
    return this.callWorkflow('extractInventoryItem', [line]);
  }

    private looksLikeInventoryItem(line: string): boolean {
    return this.callWorkflow('looksLikeInventoryItem', [line]);
  }

    private isDiscardableZavorthBridgeClosingLine(line: string): boolean {
    return this.callWorkflow('isDiscardableZavorthBridgeClosingLine', [line]);
  }

    private normalizeTelegramFriendlyText(value: string): string {
    return this.callWorkflow('normalizeTelegramFriendlyText', [value]);
  }

    private sendDeliveryToOriginChat(session: PendingZavorthBridgeSession, message: string): Promise<void> {
    return this.callWorkflow('sendDeliveryToOriginChat', [session, message]);
  }

    private sendToSession(session: PendingZavorthBridgeSession, message: string): Promise<void> {
    return this.callWorkflow('sendToSession', [session, message]);
  }
}
