import fs from 'fs';
import path from 'path';
import { config } from '../../config/index.js';
import type { PendingZavorthBridgeSession } from '../AgentBridgeManager.js';
import { asErrorLike } from '../../utils/errorLike.js';

interface BridgeTaskMetadata {
  pendingPermissionId?: string | null;
  pendingPermissionNotifiedAt?: string | null;
  pendingPermissionNotificationError?: string | null;
  zavorthBridgeTrackingFile?: string | null;
  zavorthBridgePreferredModel?: string | null;
  zavorthBridgeDeliveryState?: string | null;
  zavorthBridgeDeliveryError?: string | null;
  zavorthBridgeResponseCapturedAt?: string | null;
  zavorthBridgeResponseSource?: string | null;
  [key: string]: unknown;
}

interface BridgeTask {
  task_id: string;
  status: string;
  requires_approval?: boolean;
  approval_status?: string;
  error_summary?: string | null;
  metadata?: BridgeTaskMetadata;
  [key: string]: any;
}

interface BridgeArtifact {
  key: string;
  content: string;
  artifactType: string;
  brainDir: string;
  updatedAtMs: number;
}

interface LogEvent {
  timestampMs: number;
  timestampIso: string;
  line: string;
}

interface PermissionRequest {
  permission_id: string;
  executor: string;
  kind: string;
  task_id?: string | null;
  status: string;
  [key: string]: any;
}

interface PermissionService {
  listRequests?(status?: any, limit?: number): Promise<any>;
  getRequest(id: string): Promise<any>;
  rejectRequest(id: string, system: string, reason: string): Promise<any>;
}

interface TaskManager {
  getPendingTasks(): BridgeTask[];
  saveTask(task: BridgeTask): void;
  advanceState(task: BridgeTask, state: string): void;
}

interface BridgeManager {
  listPendingSessions(): Promise<PendingZavorthBridgeSession[]>;
  saveSession(session: PendingZavorthBridgeSession): Promise<void>;
}

interface LogRepo {
  log(level: string, source: string, message: string, data?: Record<string, unknown>): void;
}

interface UiCaptureService {
  captureLatestResponse(options: {
    taskId: string;
    processId: string;
    windowTitle: string;
    expectedModel?: string;
  }): Promise<{
    ok: boolean;
    responseText: string;
    hasPermissionPrompt: boolean;
    confidence: number;
  } | null>;
}

interface Broadcaster {
  broadcast(message: string): Promise<void>;
}

interface RealZavorthBridgeWatcherHost {
  deps: {
    permissionService?: PermissionService;
    taskManager?: TaskManager;
  };
  bridgeManager: BridgeManager;
  logRepo: LogRepo;
  broadcaster: Broadcaster;
  uiCaptureService: any;
  responseDir: string;
  logsDir: string;
  isZavorthBridgeTask(task: any): boolean;
  isSessionActive(session: PendingZavorthBridgeSession): boolean;
  isTrackingFileCompleted(filePath: string): boolean;
  clearPendingPermissionMetadata(task: BridgeTask): void;
  getTask(taskId: string): BridgeTask | null;
  isTaskTerminal(task: any): boolean;
  queueSessionDelivery(
    session: PendingZavorthBridgeSession,
    message: string,
    content: string,
    source: string,
  ): void;
  formatFinalResponseBroadcast(
    session: PendingZavorthBridgeSession,
    content: string,
    source: string,
  ): string;
  truncate(text: string, maxLength: number): string;
  processPendingDeliveries(): Promise<void>;
  collectArtifacts(): Promise<BridgeArtifact[]>;
  findBestArtifactForSession(
    session: PendingZavorthBridgeSession,
    artifacts: BridgeArtifact[],
  ): BridgeArtifact | null;
  formatArtifactCompletion(
    session: PendingZavorthBridgeSession,
    artifact: BridgeArtifact,
  ): string;
  humanizeArtifactType(type: string): string;
  notifyPermissionRequest: any;
  wasPermissionRecentlyNotified: any;
  tryQueuePromptContractDelivery: any;
  resolveScopedCompanionUiTarget: any;
  canCaptureScopedSessionUi: any;
  sanitizeVisibleResponse: any;
  isVisibleResponseCaptureReady: any;
  normalizeVisibleResponse: any;
  sendDeliveryToOriginChat: any;
  markTaskDelivered: any;
  collectRecentLogEvents: any;
  maybeHandlePermissionPrompt: any;
  isAutomationTriggerLogLine: any;
  tryAutomationRescue: any;
  tryQueueLocalDirectoryFallback: any;
  failStalledSession: any;
  resolveCompanionTargetInstanceId: any;
  getLiveCompanionStatus: any;
}

export class RealZavorthBridgeWatcherTickHandlers {
  constructor(private readonly host: RealZavorthBridgeWatcherHost) {}

  public async reconcileZavorthBridgePermissionState(): Promise<void> {
    if (!this.host.deps.permissionService || !this.host.deps.taskManager) {
      return;
    }

    const sessions = await this.host.bridgeManager.listPendingSessions() as PendingZavorthBridgeSession[];
    const sessionByTaskId = new Map(sessions.map((session: PendingZavorthBridgeSession) => [session.taskId, session]));
    const pendingPermissions =
      typeof this.host.deps.permissionService?.listRequests === 'function'
        ? await this.host.deps.permissionService.listRequests('pending', 200).catch(() => [] as PermissionRequest[])
        : [];
    const tasks = this.host.deps.taskManager
      .getPendingTasks()
      .filter((task) => this.host.isZavorthBridgeTask(task) && task.status === 'waiting_approval');

    for (const task of tasks) {
      const permissionId = String(task.metadata?.pendingPermissionId || '').trim();
      if (!permissionId) {
        continue;
      }

      const session = sessionByTaskId.get(task.task_id) || null;
      const permission = await this.host.deps.permissionService.getRequest(permissionId).catch(() => undefined);

      if (!permission || permission.status !== 'pending') {
        this.host.clearPendingPermissionMetadata(task);
        this.host.deps.taskManager.saveTask(task);
        continue;
      }

      const sessionIsInactive =
        !session ||
        !this.host.isSessionActive(session) ||
        Boolean(session.completedAt) ||
        this.host.isTrackingFileCompleted(String(task.metadata?.zavorthBridgeTrackingFile || '').trim());

      if (!sessionIsInactive) {
        continue;
      }

      await this.host.deps.permissionService.rejectRequest(
        permission.permission_id,
        'system',
        'Pedido de permissao do ZavorthBridge invalidado porque a sessao original ja terminou.',
      );

      this.host.clearPendingPermissionMetadata(task);
      task.requires_approval = false;
      task.approval_status = 'not_required';
      task.error_summary =
        task.error_summary || 'Pedido de permissao do ZavorthBridge expirou depois que a sessao real terminou.';
      this.host.deps.taskManager.advanceState(task, 'failed');

      this.host.logRepo.log(
        'info',
        'RealZavorthBridgeWatcher',
        'Pending ZavorthBridge permission was discarded because its tracked session is no longer active.',
        {
          taskId: task.task_id,
          permissionId: permission.permission_id,
        },
      );
    }

    for (const permission of pendingPermissions) {
      if (permission.executor !== 'zavorthBridge' || permission.kind !== 'ui_permission') {
        continue;
      }

      const task = permission.task_id ? this.host.getTask(permission.task_id) : null;
      const session = permission.task_id ? sessionByTaskId.get(permission.task_id) || null : null;
      const taskPointsToPermission =
        Boolean(task) && String(task?.metadata?.pendingPermissionId || '').trim() === permission.permission_id;
      const sessionStillActive =
        Boolean(session) &&
        this.host.isSessionActive(session as PendingZavorthBridgeSession) &&
        !session?.completedAt &&
        !this.host.isTrackingFileCompleted(String(task?.metadata?.zavorthBridgeTrackingFile || '').trim());

      if (task && task.status === 'waiting_approval' && taskPointsToPermission && sessionStillActive) {
        continue;
      }

      await this.host.deps.permissionService.rejectRequest(
        permission.permission_id,
        'system',
        'Pedido de permissao do ZavorthBridge expirou porque a task original nao esta mais aguardando aprovacao ativa.',
      );

      if (task && taskPointsToPermission) {
        this.host.clearPendingPermissionMetadata(task);
        if (task.status === 'waiting_approval') {
          task.requires_approval = false;
          task.approval_status = 'not_required';
          task.error_summary =
            task.error_summary || 'Pedido de permissao do ZavorthBridge expirou porque a task original perdeu o contexto.';
          this.host.deps.taskManager.advanceState(task, 'failed');
        } else {
          this.host.deps.taskManager.saveTask(task);
        }
      }
    }
  }

  public async processPendingResponses(): Promise<void> {
    const files = await fs.promises.readdir(this.host.responseDir);
    const pendingFiles = files.filter((file) => file.endsWith('.md') && !file.endsWith('.processed.md'));
    if (pendingFiles.length === 0) {
      return;
    }

    const sessions = await this.host.bridgeManager.listPendingSessions();
    let queuedDelivery = false;

    for (const file of pendingFiles) {
      const fullPath = path.join(this.host.responseDir, file);
      const content = (await fs.promises.readFile(fullPath, 'utf8')).trim();
      if (!content) {
        continue;
      }

      const processedPath = fullPath.replace(/\.md$/i, '.processed.md');
      const taskId = path.basename(file).split('_')[0] || null;
      if (taskId) {
        const session = sessions.find((candidate: PendingZavorthBridgeSession) => candidate.taskId === taskId);
        if (session) {
          await fs.promises.rename(fullPath, processedPath);
          if (session.completedAt || session.deliveredResponse) {
            continue;
          }

          this.host.queueSessionDelivery(
            session,
            this.host.formatFinalResponseBroadcast(session, content, 'fallback de arquivo'),
            content,
            'fallback de arquivo',
          );
          queuedDelivery = true;
          await this.host.bridgeManager.saveSession(session);
          continue;
        }
      }

      await this.host.broadcaster.broadcast(
        [
          'ZavorthBridge respondeu via fallback de arquivo.',
          `Arquivo: ${path.basename(processedPath)}`,
          '',
          this.host.truncate(content, 2800),
        ].join('\n'),
      );
      await fs.promises.rename(fullPath, processedPath);
    }

    if (queuedDelivery) {
      await this.host.processPendingDeliveries();
    }
  }

  public async processPendingArtifacts(): Promise<void> {
    const sessions = (await this.host.bridgeManager.listPendingSessions()).filter((session: PendingZavorthBridgeSession) =>
      this.host.isSessionActive(session),
    );
    if (sessions.length === 0) {
      return;
    }

    const artifacts = await this.host.collectArtifacts();
    if (artifacts.length === 0) {
      return;
    }

    let queuedDelivery = false;
    for (const session of sessions) {
      const launchedAtMs = new Date(session.launchedAt).getTime();
      let relevant = artifacts.filter((artifact) => artifact.updatedAtMs >= launchedAtMs - 2000);
      if (relevant.length === 0) {
        continue;
      }

      let sessionChanged = false;
      if (session.brainDir) {
        relevant = relevant.filter((artifact) => artifact.brainDir === session.brainDir);
      } else {
        const chosenArtifact = this.host.findBestArtifactForSession(session, relevant);
        if (!chosenArtifact) {
          continue;
        }

        session.brainDir = chosenArtifact.brainDir;
        relevant = relevant.filter((artifact) => artifact.brainDir === chosenArtifact.brainDir);
        sessionChanged = true;
      }

      const newArtifacts = relevant
        .filter((artifact) => !session.deliveredArtifactKeys.includes(artifact.key))
        .sort((left, right) => left.updatedAtMs - right.updatedAtMs);

      if (newArtifacts.length === 0) {
        if (sessionChanged) {
          await this.host.bridgeManager.saveSession(session);
        }
        continue;
      }

      for (const artifact of newArtifacts) {
        session.deliveredArtifactKeys.push(artifact.key);
      }

      const walkthrough = newArtifacts.find((artifact) => artifact.artifactType === 'ARTIFACT_TYPE_WALKTHROUGH');
      if (walkthrough && !session.deliveredResponse) {
        this.host.queueSessionDelivery(
          session,
          this.host.formatArtifactCompletion(session, walkthrough),
          walkthrough.content,
          this.host.humanizeArtifactType(walkthrough.artifactType),
        );
        queuedDelivery = true;
      }

      await this.host.bridgeManager.saveSession(session);
    }

    if (queuedDelivery) {
      await this.host.processPendingDeliveries();
    }
  }

  public async processPendingPermissionNotifications(): Promise<void> {
    if (!this.host.deps.permissionService) {
      return;
    }

    const sessions = (await this.host.bridgeManager.listPendingSessions()).filter((session: PendingZavorthBridgeSession) =>
      this.host.isSessionActive(session),
    );
    if (sessions.length === 0) {
      return;
    }

    for (const session of sessions) {
      const task = this.host.getTask(session.taskId);
      if (!task || task.status !== 'waiting_approval') {
        continue;
      }

      const permissionId = String(task.metadata?.pendingPermissionId || '').trim();
      const notifiedAt = String(task.metadata?.pendingPermissionNotifiedAt || '').trim();
      if (permissionId && session.lastNotifiedPermissionId === permissionId) {
        if (!notifiedAt) {
          task.metadata = {
            ...(task.metadata || {}),
            pendingPermissionNotifiedAt: session.lastPermissionNotificationAt || new Date().toISOString(),
            pendingPermissionNotificationError: null,
          };
          this.host.deps.taskManager?.saveTask(task);
        }
        continue;
      }

      if (!permissionId || notifiedAt) {
        continue;
      }

      const permission = await this.host.deps.permissionService.getRequest(permissionId).catch(() => undefined);
      if (!permission || permission.status !== 'pending') {
        this.host.clearPendingPermissionMetadata(task);
        this.host.deps.taskManager?.saveTask(task);
        continue;
      }

      if (this.host.wasPermissionRecentlyNotified(session, permission.permission_id, notifiedAt || null)) {
        task.metadata = {
          ...(task.metadata || {}),
          pendingPermissionNotifiedAt:
            notifiedAt || session.lastPermissionNotificationAt || new Date().toISOString(),
          pendingPermissionNotificationError: null,
        };
        this.host.deps.taskManager?.saveTask(task);
        continue;
      }

      try {
        await this.host.notifyPermissionRequest(session, permission);
        task.metadata = {
          ...(task.metadata || {}),
          pendingPermissionNotifiedAt: new Date().toISOString(),
          pendingPermissionNotificationError: null,
        };
        this.host.deps.taskManager?.saveTask(task);
      } catch (error: unknown) {
        const err = asErrorLike(error);
        const errorMessage = error instanceof Error ? err.message : String(error);
        task.metadata = {
          ...(task.metadata || {}),
          pendingPermissionNotificationError: errorMessage,
        };
        this.host.deps.taskManager?.saveTask(task);
        this.host.logRepo.log(
          'warn',
          'RealZavorthBridgeWatcher',
          `Falha ao reenviar pedido de permissao do ZavorthBridge: ${errorMessage}`,
          {
            taskId: session.taskId,
            permissionId,
          },
        );
      }
    }
  }

  public async processVisibleResponses(): Promise<void> {
    const sessions = (await this.host.bridgeManager.listPendingSessions()).filter(
      (session: PendingZavorthBridgeSession) =>
        this.host.isSessionActive(session) &&
        !session.deliveredResponse &&
        !session.pendingDeliveryMessage &&
        session.sessionKind !== 'prompt-panel',
    );
    if (sessions.length === 0) {
      return;
    }

    let queuedDelivery = false;
    for (const session of sessions) {
      const task = this.host.getTask(session.taskId);
      if (this.host.isTaskTerminal(task) || task?.status === 'waiting_approval' || task?.status === 'delivery_pending') {
        continue;
      }

      if (await this.host.tryQueuePromptContractDelivery(session)) {
        queuedDelivery = true;
        await this.host.bridgeManager.saveSession(session);
        continue;
      }

      const lastCaptureAtMs = session.lastVisibleResponseAt ? Date.parse(session.lastVisibleResponseAt) : Number.NaN;
      if (Number.isFinite(lastCaptureAtMs) && Date.now() - lastCaptureAtMs < 8000) {
        continue;
      }

      const scopedTarget = await this.host.resolveScopedCompanionUiTarget(session);
      if (!this.host.canCaptureScopedSessionUi(scopedTarget)) {
        continue;
      }

      const snapshot = await this.host.uiCaptureService.captureLatestResponse({
        taskId: session.taskId,
        processId: scopedTarget.targetProcessId,
        windowTitle: config.zavorthBridgeWindowTitle,
        expectedModel: String(task?.metadata?.zavorthBridgePreferredModel || '').trim() || undefined,
      }).catch(() => null);

      session.lastUiProbeAt = new Date().toISOString();
      session.lastVisibleResponseAt = new Date().toISOString();

      if (!snapshot?.ok) {
        await this.host.bridgeManager.saveSession(session);
        continue;
      }

      if (snapshot.hasPermissionPrompt) {
        await this.host.maybeHandlePermissionPrompt(session, task, 'visible', snapshot);
        await this.host.bridgeManager.saveSession(session);
        continue;
      }

      const visibleResponse = this.host.sanitizeVisibleResponse(snapshot.responseText, session.prompt);
      if (!this.host.isVisibleResponseCaptureReady(snapshot, visibleResponse, session.prompt)) {
        session.lastVisibleResponseKey = null;
        session.stableVisibleResponseCount = 0;
        await this.host.bridgeManager.saveSession(session);
        continue;
      }

      const responseKey = this.host.normalizeVisibleResponse(visibleResponse);
      if (!responseKey) {
        session.lastVisibleResponseKey = null;
        session.stableVisibleResponseCount = 0;
        await this.host.bridgeManager.saveSession(session);
        continue;
      }

      if (session.lastVisibleResponseKey === responseKey) {
        session.stableVisibleResponseCount = (session.stableVisibleResponseCount || 0) + 1;
      } else {
        session.lastVisibleResponseKey = responseKey;
        session.stableVisibleResponseCount = 1;
      }

      const readyEnough =
        (session.stableVisibleResponseCount || 0) >= 2 ||
        (snapshot.confidence >= 0.8 && visibleResponse.length >= 2);

      if (!readyEnough) {
        await this.host.bridgeManager.saveSession(session);
        continue;
      }

      this.host.queueSessionDelivery(
        session,
        this.host.formatFinalResponseBroadcast(session, visibleResponse, 'captura da UI'),
        visibleResponse,
        'captura da UI',
      );
      queuedDelivery = true;
      await this.host.bridgeManager.saveSession(session);
    }

    if (queuedDelivery) {
      await this.host.processPendingDeliveries();
    }
  }

  public async processPendingDeliveries(): Promise<void> {
    const sessions = (await this.host.bridgeManager.listPendingSessions()).filter(
      (session: PendingZavorthBridgeSession) => !session.deliveredResponse && Boolean(session.pendingDeliveryMessage),
    );

    for (const session of sessions) {
      session.deliveryState = 'delivering';
      session.deliveryAttempts = (session.deliveryAttempts || 0) + 1;
      session.lastDeliveryAttemptAt = new Date().toISOString();
      await this.host.bridgeManager.saveSession(session);

      try {
        await this.host.sendDeliveryToOriginChat(session, session.pendingDeliveryMessage || '');
        await this.host.markTaskDelivered(session.taskId, session.pendingDeliverySummary || null);
        session.deliveredResponse = true;
        session.completedAt = new Date().toISOString();
        session.deliveryState = 'delivered';
        session.lastDeliveryAt = new Date().toISOString();
        session.lastDeliveryError = null;
        session.pendingDeliveryMessage = null;
        session.pendingDeliverySummary = null;
        await this.host.bridgeManager.saveSession(session);
      } catch (error: unknown) {
        const err = asErrorLike(error);
        session.deliveryState = 'failed';
        session.lastDeliveryError = error instanceof Error ? err.message : 'Falha desconhecida ao entregar resposta ao Telegram.';
        const task = this.host.getTask(session.taskId);
        if (task && !this.host.isTaskTerminal(task)) {
          task.metadata = {
            ...(task.metadata || {}),
            zavorthBridgeDeliveryState: 'failed',
            zavorthBridgeDeliveryError: session.lastDeliveryError,
            zavorthBridgeResponseCapturedAt: session.responseCapturedAt || null,
            zavorthBridgeResponseSource: session.pendingDeliverySource || null,
          };
          this.host.deps.taskManager?.saveTask(task);
        }
        await this.host.bridgeManager.saveSession(session);
        this.host.logRepo.log(
          'warn',
          'RealZavorthBridgeWatcher',
          `Falha ao entregar resposta final do ZavorthBridge no chat de origem: ${session.lastDeliveryError}`,
          { taskId: session.taskId, chatId: session.chatId },
        );
      }
    }
  }

  public async processPendingLogs(): Promise<void> {
    if (!fs.existsSync(this.host.logsDir)) {
      return;
    }

    const sessions = (await this.host.bridgeManager.listPendingSessions()).filter((session: PendingZavorthBridgeSession) =>
      this.host.isSessionActive(session),
    );
    if (sessions.length === 0) {
      return;
    }

    const events = await this.host.collectRecentLogEvents();
    if (events.length === 0) {
      return;
    }

    for (const session of sessions) {
      const task = this.host.getTask(session.taskId);
      const launchedAtMs = new Date(session.launchedAt).getTime();
      const lastDeliveredMs = session.lastDeliveredLogAt ? Date.parse(session.lastDeliveredLogAt) : launchedAtMs - 1;
      const relevantEvents = events.filter((event: any) => event.timestampMs > lastDeliveredMs && event.timestampMs >= launchedAtMs);
      if (relevantEvents.length === 0) {
        continue;
      }

      if (this.host.isTaskTerminal(task)) {
        session.completedAt = session.completedAt || new Date().toISOString();
        session.lastDeliveredLogAt = relevantEvents[relevantEvents.length - 1].timestampIso;
        await this.host.bridgeManager.saveSession(session);
        continue;
      }

      if (task?.status !== 'waiting_approval') {
        const permissionPromptVisible = await this.host.maybeHandlePermissionPrompt(session, task, 'log');
        if (permissionPromptVisible) {
          session.lastDeliveredLogAt = relevantEvents[relevantEvents.length - 1].timestampIso;
          await this.host.bridgeManager.saveSession(session);
          continue;
        }
      }

      if (
        task?.status !== 'waiting_approval' &&
        session.automationEnabled !== false &&
        session.sessionKind !== 'prompt-panel' &&
        relevantEvents.some((event: any) => this.host.isAutomationTriggerLogLine(event.line))
      ) {
        await this.host.tryAutomationRescue(session, 'log_error');
      }

      session.lastDeliveredLogAt = relevantEvents[relevantEvents.length - 1].timestampIso;
      await this.host.bridgeManager.saveSession(session);
    }
  }

  public async processStalledSessions(): Promise<void> {
    const sessions = (await this.host.bridgeManager.listPendingSessions()).filter((session: PendingZavorthBridgeSession) =>
      this.host.isSessionActive(session),
    );
    const stallThresholdMs = config.zavorthBridgeAutomationDelaySeconds * 1000;
    const maxAttempts = Math.max(0, config.zavorthBridgeAutomationMaxAttempts);
    const terminalFailureDelayMs = Math.max(
      config.zavorthBridgePromptTimeoutSeconds * 1000,
      stallThresholdMs * (maxAttempts + 1),
    );

    for (const session of sessions) {
      const task = this.host.getTask(session.taskId);
      if (this.host.isTaskTerminal(task)) {
        session.completedAt = session.completedAt || new Date().toISOString();
        await this.host.bridgeManager.saveSession(session);
        continue;
      }

      const attempts = session.automationAttempts || 0;
      const hasObservedProgress =
        session.deliveredArtifactKeys.length > 0 ||
        session.deliveredResponse ||
        Boolean(session.pendingDeliveryMessage);
      const ageMs = Date.now() - new Date(session.launchedAt).getTime();
      const automationDisabled = session.automationEnabled === false || session.sessionKind === 'prompt-panel';

      if (task?.status === 'waiting_approval' || task?.status === 'delivery_pending') {
        continue;
      }

      const permissionPromptVisible = await this.host.maybeHandlePermissionPrompt(session, task, 'stalled');
      if (permissionPromptVisible) {
        continue;
      }

      if (
        !hasObservedProgress &&
        ageMs >= terminalFailureDelayMs &&
        (attempts >= maxAttempts || automationDisabled)
      ) {
        if (await this.host.tryQueueLocalDirectoryFallback(session, task)) {
          continue;
        }
        const liveStatus = await this.host.getLiveCompanionStatus(this.host.resolveCompanionTargetInstanceId(session)).catch(() => null);
        await this.host.failStalledSession(session, liveStatus);
        continue;
      }

      if (!config.zavorthBridgeAutomationEnabled) {
        continue;
      }

      if (automationDisabled) {
        continue;
      }

      if (attempts >= maxAttempts) {
        continue;
      }

      if (hasObservedProgress) {
        continue;
      }

      if (ageMs < stallThresholdMs) {
        continue;
      }

      await this.host.tryAutomationRescue(session, 'stalled');
      await this.host.bridgeManager.saveSession(session);
    }
  }
}
