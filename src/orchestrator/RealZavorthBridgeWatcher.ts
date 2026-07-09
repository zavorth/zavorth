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
  RealZavorthBridgeWatcherWorkflowContext,
} from './real-zavorth-bridge-watcher/RealZavorthBridgeWatcherWorkflowTypes.js';
import type {
  ZavorthBridgeArtifact,
  ZavorthBridgeLogEvent,
} from './real-zavorth-bridge-watcher/RealZavorthBridgeWatcherArtifactLogHelpers.js';
import type { PermissionRequest } from '../contracts/core/PermissionRequest.js';
import type { ZavorthBridgeUiSnapshot } from '../services/ZavorthBridgeUiCaptureService.js';

type CompanionStatus = {
  ok?: boolean;
  extension?: string;
  version?: string;
  updatedAt?: string;
  windowFocused?: boolean;
  activeEditor?: string | null;
  workspaceFolders?: string[];
  hostname?: string;
  instanceId?: string;
  processId?: number;
  bridgeCommands?: string[];
  availableCommands?: string[];
  capabilities?: Record<string, boolean>;
  pendingHandoffs?: number;
  latestPendingHandoff?: string | null;
  lastOpenedHandoff?: string | null;
  lastSyncedHandoff?: string | null;
  lastRequest?: {
    command?: string;
    taskId?: string | null;
    createdAt?: string;
  } | null;
};

type RealZavorthBridgeWatcherWorkflowInternal = {
  ctx: RealZavorthBridgeWatcherWorkflowContext;
  taskSupport: {
    host: {
      logRepo: LogRepository;
      deps: RealZavorthBridgeWatcherDeps;
      bridgeManager: AgentBridgeManager;
      formatter: FinalResponseFormattingService;
    };
  };
  companionSupport: {
    host: {
      logRepo: LogRepository;
      bridgeManager: AgentBridgeManager;
      windowAutomator: ZavorthBridgeWindowAutomator;
      companionBridge: ZavorthBridgeCompanionBridge;
    };
    [methodName: string]: unknown;
  };
  [methodName: string]: unknown;
};

export class RealZavorthBridgeWatcher {
  public responseDir = config.zavorthBridgeResponseDir;
  private brainDir = config.zavorthBridgeBrainDir;
  public logsDir = config.zavorthBridgeLogsDir;
  public bridgeManager = new AgentBridgeManager();
  private windowAutomator = new ZavorthBridgeWindowAutomator();
  private companionBridge = new ZavorthBridgeCompanionBridge();
  public uiCaptureService = new ZavorthBridgeUiCaptureService();
  private formatter = new FinalResponseFormattingService();
  private processing = false;
  private pollHandle: NodeJS.Timeout | null = null;
  private workflow: RealZavorthBridgeWatcherWorkflow;
  private tickHandlers: RealZavorthBridgeWatcherTickHandlers;

  constructor(
    public logRepo: LogRepository,
    public broadcaster: BroadcastClient,
    public deps: RealZavorthBridgeWatcherDeps = {},
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

    this.processTick().catch((error: unknown) => {
      this.logRepo.log('error', 'RealZavorthBridgeWatcher', error instanceof Error ? error.message : String(error));
    });

    this.pollHandle = setInterval(() => {
      this.processTick().catch((error: unknown) => {
        this.logRepo.log('error', 'RealZavorthBridgeWatcher', error instanceof Error ? error.message : String(error));
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

  public async processPendingDeliveries(): Promise<void> {
    return this.tickHandlers.processPendingDeliveries();
  }

  private async processPendingLogs(): Promise<void> {
    return this.tickHandlers.processPendingLogs();
  }

  private async processStalledSessions(): Promise<void> {
    return this.tickHandlers.processStalledSessions();
  }

  private syncWorkflowContext(): void {
    const workflow = this.workflow as unknown as RealZavorthBridgeWatcherWorkflowInternal;

    Object.assign(workflow.ctx, {
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

    Object.assign(workflow.taskSupport.host, {
      logRepo: this.logRepo,
      deps: this.deps,
      bridgeManager: this.bridgeManager,
      formatter: this.formatter,
    });

    Object.assign(workflow.companionSupport.host, {
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
        const maybeOverride = (this as Record<string, unknown>)[methodName];
        if (typeof maybeOverride === 'function') {
          (workflow as Record<string, unknown>)[methodName] = maybeOverride.bind(this);
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
        const maybeOverride = (this as Record<string, unknown>)[methodName];
        if (typeof maybeOverride === 'function') {
          (workflow.companionSupport as Record<string, unknown>)[methodName] = maybeOverride.bind(this);
        }
      }
    }
  }

  private callWorkflow<T>(methodName: string, args: unknown[]): T {
    this.syncWorkflowContext();
    const method = (this.workflow as unknown as Record<string, (...methodArgs: unknown[]) => T>)[methodName];
    return method.apply(this.workflow, args);
  }

  public collectArtifacts(): Promise<ZavorthBridgeArtifact[]> {
    return this.callWorkflow('collectArtifacts', []);
  }

  public collectRecentLogEvents(): Promise<ZavorthBridgeLogEvent[]> {
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

    public isAutomationTriggerLogLine(line: string): boolean {
    return this.callWorkflow('isAutomationTriggerLogLine', [line]);
  }

    private resolveArtifactContentPath(dirPath: string, baseName: string): Promise<string | null> {
    return this.callWorkflow('resolveArtifactContentPath', [dirPath, baseName]);
  }

  public findBestArtifactForSession(
    session: PendingZavorthBridgeSession,
    artifacts: ZavorthBridgeArtifact[],
  ): ZavorthBridgeArtifact | null {
    return this.callWorkflow('findBestArtifactForSession', [session, artifacts]);
  }

    private matchesSession(session: PendingZavorthBridgeSession, artifact: ZavorthBridgeArtifact): boolean {
    return this.callWorkflow('matchesSession', [session, artifact]);
  }

  public isSessionActive(session: PendingZavorthBridgeSession): boolean {
    return this.callWorkflow('isSessionActive', [session]);
  }

    public tryAutomationRescue(session: PendingZavorthBridgeSession, reason: 'stalled' | 'log_error'): Promise<void> {
    return this.callWorkflow('tryAutomationRescue', [session, reason]);
  }

    public getLiveCompanionStatus(targetInstanceId?: string): Promise<CompanionStatus | null> {
    return this.callWorkflow('getLiveCompanionStatus', [targetInstanceId]);
  }

    public resolveScopedCompanionUiTarget(session: PendingZavorthBridgeSession): Promise<ScopedCompanionUiTarget> {
    return this.callWorkflow('resolveScopedCompanionUiTarget', [session]);
  }

    public canCaptureScopedSessionUi(target: ScopedCompanionUiTarget): boolean {
    return this.callWorkflow('canCaptureScopedSessionUi', [target]);
  }

    public resolveCompanionTargetInstanceId(session: PendingZavorthBridgeSession): string | undefined {
    return this.callWorkflow('resolveCompanionTargetInstanceId', [session]);
  }

    private tryCompanionRecovery(
    session: PendingZavorthBridgeSession,
    target: ScopedCompanionUiTarget,
    liveStatus: CompanionStatus | null,
    errorReason: string,
  ): Promise<boolean> {
    return this.callWorkflow('tryCompanionRecovery', [session, target, liveStatus, errorReason]);
  }

    private buildCompanionRecoveryPrompt(
    session: PendingZavorthBridgeSession,
    target: ScopedCompanionUiTarget,
    liveStatus: CompanionStatus | null,
    errorReason: string,
  ): string {
    return this.callWorkflow('buildCompanionRecoveryPrompt', [session, target, liveStatus, errorReason]);
  }

  public getTask(taskId: string): Task | null {
    return this.callWorkflow('getTask', [taskId]);
  }

  public isTaskTerminal(task: Task | null | undefined): boolean {
    return this.callWorkflow('isTaskTerminal', [task || null]);
  }

    public markTaskDelivered(taskId: string, summary: string | null): Promise<void> {
    return this.callWorkflow('markTaskDelivered', [taskId, summary]);
  }

    private markTaskFailed(taskId: string, summary: string): Promise<void> {
    return this.callWorkflow('markTaskFailed', [taskId, summary]);
  }

    private resolvePendingPermissionForTerminalTask(task: Task, note: string): Promise<void> {
    return this.callWorkflow('resolvePendingPermissionForTerminalTask', [task, note]);
  }

  public queueSessionDelivery(
    session: PendingZavorthBridgeSession,
    message: string,
    summary: string | null,
    source: string,
  ): void {
    return this.callWorkflow('queueSessionDelivery', [session, message, summary, source]);
  }

    public failStalledSession(session: PendingZavorthBridgeSession, errorReason: string): Promise<void> {
    return this.callWorkflow('failStalledSession', [session, errorReason]);
  }

    public tryQueueLocalDirectoryFallback(session: PendingZavorthBridgeSession, workspace: string): Promise<boolean> {
    return this.callWorkflow('tryQueueLocalDirectoryFallback', [session, workspace]);
  }

    private describeStalledFailure(session: PendingZavorthBridgeSession, liveStatus: CompanionStatus | null): string {
    return this.callWorkflow('describeStalledFailure', [session, liveStatus]);
  }

    private hasCompanionHandoffMismatch(
    session: PendingZavorthBridgeSession,
    liveStatus: CompanionStatus | null,
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

    public normalizeVisibleResponse(value: string | null | undefined): string {
    return this.callWorkflow('normalizeVisibleResponse', [value]);
  }

    public sanitizeVisibleResponse(value: string | null | undefined, promptText: string | null | undefined): string {
    return this.callWorkflow('sanitizeVisibleResponse', [value, promptText]);
  }

    public isVisibleResponseCaptureReady(promptText: string, visibleResponse: string | null | undefined): boolean {
    return this.callWorkflow('isVisibleResponseCaptureReady', [promptText, visibleResponse]);
  }

    public tryQueuePromptContractDelivery(session: PendingZavorthBridgeSession): Promise<boolean> {
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

  public clearPendingPermissionMetadata(task: Task): void {
    return this.callWorkflow('clearPendingPermissionMetadata', [task]);
  }

  public isTrackingFileCompleted(trackingFile: string): boolean {
    return this.callWorkflow('isTrackingFileCompleted', [trackingFile]);
  }

  public isZavorthBridgeTask(task: Task | null | undefined): boolean {
    return this.callWorkflow('isZavorthBridgeTask', [task]);
  }

    public wasPermissionRecentlyNotified(permissionId: string, minAgeMs: number): boolean {
    return this.callWorkflow('wasPermissionRecentlyNotified', [permissionId, minAgeMs]);
  }

    public maybeHandlePermissionPrompt(session: PendingZavorthBridgeSession, trackingFile: string): Promise<boolean> {
    return this.callWorkflow('maybeHandlePermissionPrompt', [session, trackingFile]);
  }

    private findZavorthBridgeAutoApprovalPolicy(permission: PermissionRequest): Promise<PermissionRequest | undefined> {
    return this.callWorkflow('findZavorthBridgeAutoApprovalPolicy', [permission]);
  }

    private resolveZavorthBridgeApprovalMode(permission: PermissionRequest): 'once' | 'conversation' {
    return this.callWorkflow('resolveZavorthBridgeApprovalMode', [permission]);
  }

    private buildZavorthBridgePermissionReason(snapshot: ZavorthBridgeUiSnapshot): string | null {
    return this.callWorkflow('buildZavorthBridgePermissionReason', [snapshot]);
  }

    public notifyPermissionRequest(permission: PermissionRequest, reason: string): Promise<void> {
    return this.callWorkflow('notifyPermissionRequest', [permission, reason]);
  }

    private isRecentTimestamp(value: string | null | undefined, maxAgeMs: number): boolean {
    return this.callWorkflow('isRecentTimestamp', [value, maxAgeMs]);
  }

  public formatFinalResponseBroadcast(
    session: PendingZavorthBridgeSession,
    finalResponseText: string,
    source: string,
  ): string {
    return this.callWorkflow('formatFinalResponseBroadcast', [session, finalResponseText, source]);
  }

    public formatArtifactCompletion(session: PendingZavorthBridgeSession, artifact: ZavorthBridgeArtifact): string {
    return this.callWorkflow('formatArtifactCompletion', [session, artifact]);
  }

    public humanizeArtifactType(artifactType: string): string {
    return this.callWorkflow('humanizeArtifactType', [artifactType]);
  }

    public truncate(content: string, maxLength: number): string {
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

    public sendDeliveryToOriginChat(session: PendingZavorthBridgeSession, message: string): Promise<void> {
    return this.callWorkflow('sendDeliveryToOriginChat', [session, message]);
  }

    private sendToSession(session: PendingZavorthBridgeSession, message: string): Promise<void> {
    return this.callWorkflow('sendToSession', [session, message]);
  }
}
