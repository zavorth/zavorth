import fs from 'fs';
import path from 'path';
import { Task } from '../../contracts/TaskContract.js';
import { PermissionRequest } from '../../contracts/PermissionRequest.js';
import { asErrorLike, errorMessage } from '../../utils/errorLike.js';
export type {
  BotApiLike,
  BroadcastClient,
  RealZavorthBridgeWatcherDeps,
  RealZavorthBridgeWatcherWorkflowContext,
} from './RealZavorthBridgeWatcherWorkflowTypes.js';
export class RealZavorthBridgeWatcherWorkflow {
  private static readonly PERMISSION_NOTIFICATION_COOLDOWN_MS = 60_000;
  private readonly permissionSupport: RealZavorthBridgeWatcherPermissionSupport;
  private readonly taskSupport: RealZavorthBridgeWatcherTaskSupport;
  private readonly companionSupport: RealZavorthBridgeWatcherCompanionSupport;

  constructor(private ctx: RealZavorthBridgeWatcherWorkflowContext) {
    this.permissionSupport = new RealZavorthBridgeWatcherPermissionSupport({
      getLogRepo: () => this.logRepo,
      getDeps: () => this.deps,
      getBridgeManager: () => this.bridgeManager,
      getWindowAutomator: () => this.windowAutomator,
      getUiCaptureService: () => this.uiCaptureService,
      resolveScopedCompanionUiTarget: (session) => this.resolveScopedCompanionUiTarget(session),
      canCaptureScopedSessionUi: (target) => this.canCaptureScopedSessionUi(target),
      queueSessionDelivery: (session, message, summary, source) =>
        this.queueSessionDelivery(session, message, summary, source),
      formatFinalResponseBroadcast: (session, content, source) =>
        this.formatFinalResponseBroadcast(session, content, source),
      sendToSession: (session, message) => this.sendToSession(session, message),
    });
    this.taskSupport = new RealZavorthBridgeWatcherTaskSupport({
      logRepo: this.logRepo,
      deps: this.deps,
      bridgeManager: this.bridgeManager,
      formatter: this.formatter,
      getTask: (taskId) => this.deps.taskManager?.getTask(taskId) || null,
      isTaskTerminal: (task) => (!task ? false : ['completed', 'failed', 'rejected', 'cancelled'].includes(task.status)),
      resolvePendingPermissionForTerminalTask: (task, note) =>
        this.resolvePendingPermissionForTerminalTask(task, note),
      truncate: (content, maxLength) => this.truncate(content, maxLength),
      processPendingDeliveries: () => this.ctx.processPendingDeliveries(),
      sendToSession: (session, message) => this.sendToSession(session, message),
    });
    this.companionSupport = new RealZavorthBridgeWatcherCompanionSupport({
      logRepo: this.logRepo,
      bridgeManager: this.bridgeManager,
      windowAutomator: this.windowAutomator,
      companionBridge: this.companionBridge,
      getTask: (taskId) => this.deps.taskManager?.getTask(taskId) || null,
    });
  }

  private get logRepo() { return this.ctx.logRepo; }
  private get broadcaster() { return this.ctx.broadcaster; }
  private get deps() { return this.ctx.deps; }
  private get bridgeManager() { return this.ctx.bridgeManager; }
  private get windowAutomator() { return this.ctx.windowAutomator; }
  private get companionBridge() { return this.ctx.companionBridge; }
  private get uiCaptureService() { return this.ctx.uiCaptureService; }
  private get formatter() { return this.ctx.formatter; }
  private get responseDir() { return this.ctx.responseDir; }
  private get brainDir() { return this.ctx.brainDir; }
  private get logsDir() { return this.ctx.logsDir; }

  public async collectArtifacts(): Promise<ZavorthBridgeArtifact[]> {
    return collectZavorthBridgeArtifacts(this.brainDir);
  }

  public async collectRecentLogEvents(): Promise<ZavorthBridgeLogEvent[]> {
    return collectZavorthBridgeRecentLogEvents(this.logsDir);
  }

  public async findLatestZavorthBridgeLogFile(): Promise<string | null> {
    return findLatestZavorthBridgeLogFileImpl(this.logsDir);
  }

  public parseLogEvent(line: string): ZavorthBridgeLogEvent | null {
    return parseZavorthBridgeLogEventImpl(line);
  }

  public isInterestingLogLine(line: string): boolean {
    return isInterestingZavorthBridgeLogLineImpl(line);
  }

  public isAutomationTriggerLogLine(line: string): boolean {
    return isAutomationTriggerZavorthBridgeLogLineImpl(line);
  }

  public async resolveArtifactContentPath(dirPath: string, baseName: string): Promise<string | null> {
    return resolveArtifactContentPathImpl(dirPath, baseName);
  }

  public findBestArtifactForSession(
    session: PendingZavorthBridgeSession,
    artifacts: ZavorthBridgeArtifact[],
  ): ZavorthBridgeArtifact | null {
    const correlated = artifacts.find((artifact) => this.matchesSession(session, artifact));
    if (correlated) {
      return correlated;
    }

    return artifacts[0] || null;
  }

  public matchesSession(session: PendingZavorthBridgeSession, artifact: ZavorthBridgeArtifact): boolean {
    const correlationNeedles = [
      session.taskId,
      `ZAVORTH_TASK_ID:${session.taskId}`,
      path.basename(session.handoffFile),
      path.basename(session.responseFile),
    ];

    return correlationNeedles.some((needle) => artifact.content.includes(needle) || artifact.summary.includes(needle));
  }

  public isSessionActive(session: PendingZavorthBridgeSession): boolean {
    if (session.completedAt) {
      return false;
    }

    const maxAgeMs = 1000 * 60 * 60 * 24;
    return Date.now() - new Date(session.launchedAt).getTime() <= maxAgeMs;
  }

  public async tryAutomationRescue(session: PendingZavorthBridgeSession, reason: 'stalled' | 'log_error'): Promise<void> {
    return this.companionSupport.tryAutomationRescue(session, reason);
  }

  public async getLiveCompanionStatus(targetInstanceId?: string): Promise<Record<string, any> | null> {
    return this.companionSupport.getLiveCompanionStatus(targetInstanceId);
  }

  public async resolveScopedCompanionUiTarget(session: PendingZavorthBridgeSession): Promise<ScopedCompanionUiTarget> {
    return this.companionSupport.resolveScopedCompanionUiTarget(session);
  }

  public canCaptureScopedSessionUi(target: ScopedCompanionUiTarget): boolean {
    return this.companionSupport.canCaptureScopedSessionUi(target);
  }

  public resolveCompanionTargetInstanceId(session: PendingZavorthBridgeSession): string | undefined {
    return this.companionSupport.resolveCompanionTargetInstanceId(session);
  }

  public async tryCompanionRecovery(
    session: PendingZavorthBridgeSession,
    reason: 'stalled' | 'log_error',
    attempts: number,
    status: Record<string, any> | null,
  ): Promise<string[]> {
    return this.companionSupport.tryCompanionRecovery(session, reason, attempts, status);
  }

  public buildCompanionRecoveryPrompt(
    session: PendingZavorthBridgeSession,
    reason: 'stalled' | 'log_error',
  ): string {
    return this.companionSupport.buildCompanionRecoveryPrompt(session, reason);
  }

  public getTask(taskId: string): Task | null {
    return this.taskSupport.getTask(taskId);
  }

  public isTaskTerminal(task: Task | null): boolean {
    return this.taskSupport.isTaskTerminal(task);
  }

  public async markTaskDelivered(taskId: string, summary: string | null): Promise<void> {
    return this.taskSupport.markTaskDelivered(taskId, summary);
  }

  public async markTaskFailed(taskId: string, summary: string): Promise<void> {
    return this.taskSupport.markTaskFailed(taskId, summary);
  }

  public async resolvePendingPermissionForTerminalTask(task: Task, note: string): Promise<void> {
    await this.permissionSupport.resolvePendingPermissionForTerminalTask(task, note);
  }

  public queueSessionDelivery(
    session: PendingZavorthBridgeSession,
    message: string,
    summary: string | null,
    source: string,
  ): void {
    this.taskSupport.queueSessionDelivery(session, message, summary, source);
  }

  public async failStalledSession(
    session: PendingZavorthBridgeSession,
    liveStatus: Record<string, any> | null,
  ): Promise<void> {
    return this.taskSupport.failStalledSession(session, liveStatus);
  }

  public async tryQueueLocalDirectoryFallback(
    session: PendingZavorthBridgeSession,
    task: Task | null,
  ): Promise<boolean> {
    return this.taskSupport.tryQueueLocalDirectoryFallback(session, task);
  }

  public describeStalledFailure(session: PendingZavorthBridgeSession, liveStatus: Record<string, any> | null): string {
    return this.taskSupport.describeStalledFailure(session, liveStatus);
  }

  public hasCompanionHandoffMismatch(
    session: PendingZavorthBridgeSession,
    liveStatus: Record<string, any> | null,
  ): boolean {
    return this.taskSupport.hasCompanionHandoffMismatch(session, liveStatus);
  }
  public normalizeComparisonValue(rawValue: string | null | undefined): string {
    return normalizeComparisonValueImpl(rawValue);
  }

  public isLocalDirectoryInspectionPrompt(prompt: string): boolean {
    return isLocalDirectoryInspectionPromptImpl(prompt);
  }

  public resolveDirectoryListingTarget(prompt: string, workspace: string): string | null {
    return resolveDirectoryListingTargetImpl(prompt, workspace);
  }

  public extractDirectoryHints(prompt: string): string[] {
    return extractDirectoryHintsImpl(prompt);
  }

  public resolveDirectoryHint(hint: string, workspacePath: string): string | null {
    return resolveDirectoryHintImpl(hint, workspacePath);
  }

  public listAncestorDirectories(startPath: string): string[] {
    return listAncestorDirectoriesImpl(startPath);
  }

  public normalizePathToken(value: string): string {
    return normalizePathTokenImpl(value);
  }

  public pathTokensRoughlyMatch(left: string, right: string): boolean {
    return pathTokensRoughlyMatchImpl(left, right);
  }

  public isExistingDirectory(candidate: string): boolean {
    return isExistingDirectoryImpl(candidate);
  }

  public safeReadDirectory(candidate: string): fs.Dirent[] {
    return safeReadDirectoryImpl(candidate);
  }

  public normalizeVisibleResponse(value: string | null | undefined): string {
    return normalizeVisibleResponseImpl(value);
  }

  public sanitizeVisibleResponse(value: string | null | undefined, promptText: string | null | undefined): string {
    return sanitizeVisibleResponseImpl(value, promptText);
  }

  public isVisibleResponseCaptureReady(
    snapshot: ZavorthBridgeUiSnapshot,
    visibleResponse: string,
    promptText: string | null | undefined,
  ): boolean {
    return isVisibleResponseCaptureReadyImpl(snapshot, visibleResponse, promptText);
  }

  public async tryQueuePromptContractDelivery(session: PendingZavorthBridgeSession): Promise<boolean> {
    return this.permissionSupport.tryQueuePromptContractDelivery(session);
  }

  public extractFileCreationPromptContract(
    promptText: string | null | undefined,
  ): { filePath: string; expectedContent: string; finalReply: string } | null {
    return this.permissionSupport.extractFileCreationPromptContract(promptText);
  }

  public normalizePromptContractFileContent(value: string | null | undefined): string {
    return this.permissionSupport.normalizePromptContractFileContent(value);
  }

  public clearPendingPermissionMetadata(task: Task): void {
    this.permissionSupport.clearPendingPermissionMetadata(task);
  }

  public isTrackingFileCompleted(trackingFile: string): boolean {
    return this.permissionSupport.isTrackingFileCompleted(trackingFile);
  }

  public isZavorthBridgeTask(task: Task | null | undefined): boolean {
    return this.permissionSupport.isZavorthBridgeTask(task);
  }

  public wasPermissionRecentlyNotified(
    session: PendingZavorthBridgeSession,
    permissionId: string,
    fallbackTimestamp?: string | null,
  ): boolean {
    return this.permissionSupport.wasPermissionRecentlyNotified(
      session,
      permissionId,
      fallbackTimestamp,
    );
  }

  public async maybeHandlePermissionPrompt(
    session: PendingZavorthBridgeSession,
    task: Task | null,
    trigger: 'log' | 'stalled' | 'visible',
    snapshotOverride?: ZavorthBridgeUiSnapshot | null,
  ): Promise<boolean> {
    return this.permissionSupport.maybeHandlePermissionPrompt(
      session,
      task,
      trigger,
      snapshotOverride,
    );
  }

  public async findZavorthBridgeAutoApprovalPolicy(
    workspace: string,
    companionInstanceId?: string,
  ): Promise<PermissionRequest | undefined> {
    return this.permissionSupport.findZavorthBridgeAutoApprovalPolicy(workspace, companionInstanceId);
  }

  public resolveZavorthBridgeApprovalMode(permission: PermissionRequest): 'once' | 'conversation' {
    return this.permissionSupport.resolveZavorthBridgeApprovalMode(permission);
  }

  public buildZavorthBridgePermissionReason(snapshot: ZavorthBridgeUiSnapshot): string | null {
    return this.permissionSupport.buildZavorthBridgePermissionReason(snapshot);
  }

  public async notifyPermissionRequest(
    session: PendingZavorthBridgeSession,
    permission: PermissionRequest,
  ): Promise<void> {
    await this.permissionSupport.notifyPermissionRequest(session, permission);
  }

  public isRecentTimestamp(value: string | null | undefined, maxAgeMs: number): boolean {
    return this.permissionSupport.isRecentTimestamp(value, maxAgeMs);
  }

  public formatFinalResponseBroadcast(
    session: PendingZavorthBridgeSession,
    content: string,
    source: string,
  ): string {
    return formatFinalResponseBroadcastImpl(this.formatter, session, content, source);
  }

  public formatArtifactCompletion(session: PendingZavorthBridgeSession, artifact: ZavorthBridgeArtifact): string {
    return formatArtifactCompletionImpl(this.formatter, session, artifact);
  }

  public humanizeArtifactType(artifactType: string): string {
    return humanizeArtifactTypeImpl(artifactType);
  }

  public truncate(content: string, maxLength: number): string {
    return truncateImpl(content, maxLength);
  }

  public formatTelegramFriendlyResponse(
    session: PendingZavorthBridgeSession,
    content: string,
  ): string {
    return formatTelegramFriendlyResponseImpl(session, content);
  }

  public tryFormatStructuredInventory(
    session: PendingZavorthBridgeSession,
    lines: string[],
  ): string | null {
    return tryFormatStructuredInventoryImpl(session, lines);
  }

  public extractInventoryHeading(line: string): string | null {
    return extractInventoryHeadingImpl(line);
  }

  public extractInventoryItem(line: string): string | null {
    return extractInventoryItemImpl(line);
  }

  public looksLikeInventoryItem(line: string): boolean {
    return looksLikeInventoryItemImpl(line);
  }

  public isDiscardableZavorthBridgeClosingLine(line: string): boolean {
    return isDiscardableZavorthBridgeClosingLineImpl(line);
  }

  public normalizeTelegramFriendlyText(value: string): string {
    return normalizeTelegramFriendlyTextImpl(value);
  }

  public async sendDeliveryToOriginChat(session: PendingZavorthBridgeSession, message: string): Promise<void> {
    if (session.chatId && this.broadcaster.sendToChat) {
      await this.broadcaster.sendToChat(session.chatId, message);
      return;
    }

    if (session.chatId) {
      throw new Error('Direct Telegram channel is unavailable for final delivery.');
    }

    await this.broadcaster.broadcast(message);
  }

  public async sendToSession(session: PendingZavorthBridgeSession, message: string): Promise<void> {
    let directError: Error | null = null;
    if (session.chatId && this.broadcaster.sendToChat) {
      try {
        await this.broadcaster.sendToChat(session.chatId, message);
        return;
      } catch (error: unknown) {
        const err = asErrorLike(error);
        directError = error instanceof Error ? error : new Error(String(errorMessage(error)));
        this.logRepo.log(
          'warn',
          'RealZavorthBridgeWatcher',
          `Failed to send direct message to ${session.chatId}: ${err.message}`,
          { taskId: session.taskId },
        );
      }
    }

    try {
      await this.broadcaster.broadcast(message);
    } catch (error: unknown) {
      const broadcastError = error instanceof Error ? error : new Error(String(errorMessage(error)));
      throw new Error(
        directError ? `Direct delivery failed (${directError.message}) and broadcast also failed (${broadcastError.message}).`
          : `Failed to deliver response by broadcast: ${broadcastError.message}`,
      );
    }
  }

}

