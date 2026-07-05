import fs from 'fs';
import { Task } from '../../contracts/TaskContract.js';
import { PermissionRequest } from '../../contracts/PermissionRequest.js';
import { config } from '../../config/index.js';
import type {
  ZavorthBridgeUiCaptureService,
  ZavorthBridgeUiSnapshot,
} from '../../services/ZavorthBridgeUiCaptureService.js';
import type { PendingZavorthBridgeSession } from '../AgentBridgeManager.js';
import type { AgentBridgeManager } from '../AgentBridgeManager.js';
import type { ZavorthBridgeWindowAutomator } from '../../agents/ZavorthBridgeWindowAutomator.js';
import { logger } from '../../logger.js';
import type {
RealZavorthBridgeWatcherDeps,
  ScopedCompanionUiTarget,
} from './RealZavorthBridgeWatcherWorkflowTypes.js';

const PERMISSION_NOTIFICATION_COOLDOWN_MS = 60_000;

type RealZavorthBridgeWatcherPermissionSupportOptions = {
  getLogRepo: () => {
    log(level: string, source: string, message: string, meta?: Record<string, any>): void;
  };
  getDeps: () => RealZavorthBridgeWatcherDeps;
  getBridgeManager: () => AgentBridgeManager;
  getWindowAutomator: () => ZavorthBridgeWindowAutomator;
  getUiCaptureService: () => ZavorthBridgeUiCaptureService;
  resolveScopedCompanionUiTarget: (
    session: PendingZavorthBridgeSession,
  ) => Promise<ScopedCompanionUiTarget>;
  canCaptureScopedSessionUi: (target: ScopedCompanionUiTarget) => boolean;
  queueSessionDelivery: (
    session: PendingZavorthBridgeSession,
    message: string,
    summary: string | null,
    source: string,
  ) => void;
  formatFinalResponseBroadcast: (
    session: PendingZavorthBridgeSession,
    content: string,
    source: string,
  ) => string;
  sendToSession: (session: PendingZavorthBridgeSession, message: string) => Promise<void>;
};

export class RealZavorthBridgeWatcherPermissionSupport {
  private readonly getLogRepo: RealZavorthBridgeWatcherPermissionSupportOptions['getLogRepo'];
  private readonly getDeps: RealZavorthBridgeWatcherPermissionSupportOptions['getDeps'];
  private readonly getBridgeManager: RealZavorthBridgeWatcherPermissionSupportOptions['getBridgeManager'];
  private readonly getWindowAutomator: RealZavorthBridgeWatcherPermissionSupportOptions['getWindowAutomator'];
  private readonly getUiCaptureService: RealZavorthBridgeWatcherPermissionSupportOptions['getUiCaptureService'];
  private readonly resolveScopedCompanionUiTarget: RealZavorthBridgeWatcherPermissionSupportOptions['resolveScopedCompanionUiTarget'];
  private readonly canCaptureScopedSessionUi: RealZavorthBridgeWatcherPermissionSupportOptions['canCaptureScopedSessionUi'];
  private readonly queueSessionDelivery: RealZavorthBridgeWatcherPermissionSupportOptions['queueSessionDelivery'];
  private readonly formatFinalResponseBroadcast: RealZavorthBridgeWatcherPermissionSupportOptions['formatFinalResponseBroadcast'];
  private readonly sendToSession: RealZavorthBridgeWatcherPermissionSupportOptions['sendToSession'];

  constructor(options: RealZavorthBridgeWatcherPermissionSupportOptions) {
    this.getLogRepo = options.getLogRepo;
    this.getDeps = options.getDeps;
    this.getBridgeManager = options.getBridgeManager;
    this.getWindowAutomator = options.getWindowAutomator;
    this.getUiCaptureService = options.getUiCaptureService;
    this.resolveScopedCompanionUiTarget = options.resolveScopedCompanionUiTarget;
    this.canCaptureScopedSessionUi = options.canCaptureScopedSessionUi;
    this.queueSessionDelivery = options.queueSessionDelivery;
    this.formatFinalResponseBroadcast = options.formatFinalResponseBroadcast;
    this.sendToSession = options.sendToSession;
  }

  private get logRepo() {
    return this.getLogRepo();
  }

  private get deps() {
    return this.getDeps();
  }

  private get bridgeManager() {
    return this.getBridgeManager();
  }

  private get windowAutomator() {
    return this.getWindowAutomator();
  }

  private get uiCaptureService() {
    return this.getUiCaptureService();
  }

  public async resolvePendingPermissionForTerminalTask(task: Task, note: string): Promise<void> {
    const permissionId = String(task.metadata?.pendingPermissionId || '').trim();
    if (!permissionId || !this.deps.permissionService) {
      return;
    }

    const permission = await this.deps.permissionService.getRequest(permissionId).catch(() => undefined);
    if (!permission || permission.status !== 'pending') {
      return;
    }

    await this.deps.permissionService.rejectRequest(permissionId, 'system', note).catch(() => undefined);
  }

  public async tryQueuePromptContractDelivery(
    session: PendingZavorthBridgeSession,
  ): Promise<boolean> {
    const contract = this.extractFileCreationPromptContract(session.prompt);
    if (!contract) {
      return false;
    }

    if (!fs.existsSync(contract.filePath)) {
      return false;
    }

    const actualContent = this.normalizePromptContractFileContent(
      await fs.promises.readFile(contract.filePath, 'utf8').catch(() => ''),
    );
    if (!actualContent || actualContent !== this.normalizePromptContractFileContent(contract.expectedContent)) {
      return false;
    }

    this.queueSessionDelivery(
      session,
      this.formatFinalResponseBroadcast(session, contract.finalReply, 'verificacao do artefato'),
      contract.finalReply,
      'verificacao do artefato',
    );
    return true;
  }

  public extractFileCreationPromptContract(
    promptText: string | null | undefined,
  ): { filePath: string; expectedContent: string; finalReply: string } | null {
    const prompt = String(promptText || '').trim();
    if (!prompt) {
      return null;
    }

    let createMatch = prompt.match(
      /crie o arquivo\s+["'`\u201C\u201D\u2018\u2019]([^"'`\u201C\u201D\u2018\u2019]+)["'`\u201C\u201D\u2018\u2019]\s+com o conteudo exato\s+["'`\u201C\u201D\u2018\u2019]([^"'`\u201C\u201D\u2018\u2019]+)["'`\u201C\u201D\u2018\u2019]/i,
    );
    if (!createMatch) {
      createMatch = prompt.match(
        /crie o arquivo\s+(?:["'`\u201C\u201D\u2018\u2019])?([^"'`\u201C\u201D\u2018\u2019\r\n]+?)(?:["'`\u201C\u201D\u2018\u2019])?\s+(?:com o conteudo exato|contendo exatamente|contendo o conteudo exato)\s+(?:["'`\u201C\u201D\u2018\u2019])?([^"'`\u201C\u201D\u2018\u2019\r\n]+?)(?:["'`\u201C\u201D\u2018\u2019])?(?=(?:\s+(?:e\s+depois|depois|then)\b)|[\r\n]|$)/i,
      );
    }
    if (!createMatch) {
      return null;
    }

    let replyMatch = prompt.match(
      /(?:depois|then)[^"'`\u201C\u201D\u2018\u2019]{0,80}(?:responda|answer|reply)\s+(?:apenas|somente|only)\s+(?:com|with)\s+["'`\u201C\u201D\u2018\u2019]([^"'`\u201C\u201D\u2018\u2019]+)["'`\u201C\u201D\u2018\u2019]/i,
    );
    if (!replyMatch) {
      replyMatch = prompt.match(
        /(?:depois|then)[^"'`\u201C\u201D\u2018\u2019]{0,80}(?:responda|answer|reply)\s+(?:apenas|somente|only)\s+(?:com|with)\s+(?:["'`\u201C\u201D\u2018\u2019])?([^"'`\u201C\u201D\u2018\u2019\r\n]+?)(?:["'`\u201C\u201D\u2018\u2019])?(?=[\r\n]|$)/i,
      );
    }
    if (!replyMatch) {
      return null;
    }

    return {
      filePath: String(createMatch[1] || '').trim(),
      expectedContent: String(createMatch[2] || '').trim(),
      finalReply: String(replyMatch[1] || '').trim(),
    };
  }

  public normalizePromptContractFileContent(value: string | null | undefined): string {
    return String(value || '').replace(/\r\n/g, '\n').trimEnd();
  }

  public clearPendingPermissionMetadata(task: Task): void {
    task.metadata = {
      ...(task.metadata || {}),
      pendingPermissionId: null,
      pendingPermissionNotifiedAt: null,
      pendingPermissionNotificationError: null,
    };
  }

  public isTrackingFileCompleted(trackingFile: string): boolean {
    if (!trackingFile || !fs.existsSync(trackingFile)) {
      return false;
    }

    try {
      const tracking = JSON.parse(fs.readFileSync(trackingFile, 'utf8')) as {
        completedAt?: string | null;
      };
      return Boolean(tracking.completedAt);
    } catch (error) { logger.warn('[Real Zavorth Bridge Watcher Permission] JSON parse failed', error); return false; }
  }

  public isZavorthBridgeTask(task: Task | null | undefined): boolean {
    if (!task) {
      return false;
    }

    const commandType = String(task.command_type || '').trim().toLowerCase();
    const executor = String(task.executor_used || '').trim().toLowerCase();
    return commandType.startsWith('/ag') || executor.startsWith('zavorthBridge');
  }

  public wasPermissionRecentlyNotified(
    session: PendingZavorthBridgeSession,
    permissionId: string,
    fallbackTimestamp?: string | null,
  ): boolean {
    if (!permissionId || session.lastNotifiedPermissionId !== permissionId) {
      return false;
    }

    const baseTimestamp = String(session.lastPermissionNotificationAt || fallbackTimestamp || '').trim();
    if (!baseTimestamp) {
      return true;
    }

    const notifiedAtMs = Date.parse(baseTimestamp);
    if (!Number.isFinite(notifiedAtMs)) {
      return true;
    }

    return Date.now() - notifiedAtMs < PERMISSION_NOTIFICATION_COOLDOWN_MS;
  }

  public async maybeHandlePermissionPrompt(
    session: PendingZavorthBridgeSession,
    task: Task | null,
    trigger: 'log' | 'stalled' | 'visible',
    snapshotOverride?: ZavorthBridgeUiSnapshot | null,
  ): Promise<boolean> {
    if (!task || session.sessionKind === 'prompt-panel' || !this.deps.permissionService) {
      return false;
    }

    const existingPendingId = String(task.metadata?.pendingPermissionId || '').trim();
    const pendingPermissionNotifiedAt = String(task.metadata?.pendingPermissionNotifiedAt || '').trim();

    const lastProbeAtMs = session.lastUiProbeAt ? Date.parse(session.lastUiProbeAt) : NaN;
    const minIntervalMs = trigger === 'stalled' ? 4000 : trigger === 'visible' ? 0 : 8000;
    if (!snapshotOverride && Number.isFinite(lastProbeAtMs) && Date.now() - lastProbeAtMs < minIntervalMs) {
      return false;
    }

    const scopedTarget = await this.resolveScopedCompanionUiTarget(session);
    if (!snapshotOverride && !this.canCaptureScopedSessionUi(scopedTarget)) {
      return false;
    }

    const snapshot =
      snapshotOverride ||
      (await this.uiCaptureService
        .captureLatestResponse({
          taskId: session.taskId,
          processId: scopedTarget.targetProcessId,
          windowTitle: config.zavorthBridgeWindowTitle,
          expectedModel: String(task.metadata?.zavorthBridgePreferredModel || '').trim() || undefined,
        })
        .catch(() => null));

    session.lastUiProbeAt = new Date().toISOString();
    await this.bridgeManager.saveSession(session);

    if (!snapshot?.ok || !snapshot.hasPermissionPrompt) {
      return false;
    }

    if (existingPendingId) {
      const existingPermission = await this.deps.permissionService.getRequest(existingPendingId).catch(() => undefined);
      if (existingPermission?.status === 'pending') {
        task.requires_approval = true;
        task.approval_status = 'pending';
        if (task.status !== 'waiting_approval') {
          this.deps.taskManager?.advanceState(task, 'waiting_approval');
        } else {
          this.deps.taskManager?.saveTask(task);
        }

        if (
          pendingPermissionNotifiedAt ||
          this.wasPermissionRecentlyNotified(
            session,
            existingPermission.permission_id,
            pendingPermissionNotifiedAt || null,
          )
        ) {
          const effectiveNotifiedAt =
            pendingPermissionNotifiedAt ||
            session.lastPermissionNotificationAt ||
            new Date().toISOString();
          session.lastNotifiedPermissionId =
            session.lastNotifiedPermissionId || existingPermission.permission_id;
          session.lastPermissionNotificationAt =
            session.lastPermissionNotificationAt || effectiveNotifiedAt;
          await this.bridgeManager.saveSession(session);
          task.metadata = {
            ...(task.metadata || {}),
            pendingPermissionId: existingPermission.permission_id,
            pendingPermissionNotifiedAt: effectiveNotifiedAt,
            pendingPermissionNotificationError: null,
          };
          this.deps.taskManager?.saveTask(task);
          return true;
        }

        try {
          await this.notifyPermissionRequest(session, existingPermission);
          task.metadata = {
            ...(task.metadata || {}),
            pendingPermissionId: existingPermission.permission_id,
            pendingPermissionNotifiedAt: new Date().toISOString(),
            pendingPermissionNotificationError: null,
          };
          this.deps.taskManager?.saveTask(task);
        } catch (error: any) {
          task.metadata = {
            ...(task.metadata || {}),
            pendingPermissionNotificationError: error.message,
          };
          this.deps.taskManager?.saveTask(task);
        }

        return true;
      }

      if (
        existingPermission?.status === 'approved' &&
        this.isRecentTimestamp(
          task.metadata?.zavorthBridgePermissionApprovedAt || existingPermission.updated_at,
          15_000,
        )
      ) {
        return true;
      }

      this.clearPendingPermissionMetadata(task);
      this.deps.taskManager?.saveTask(task);
    }

    const workspace = task.workspace || session.workspace || config.defaultWorkspace;
    const targetInstanceId = scopedTarget.targetInstanceId;
    const targetProcessId = scopedTarget.targetProcessId;
    const autoApprovalPolicy = await this.findZavorthBridgeAutoApprovalPolicy(workspace, targetInstanceId);
    const alreadyAutoApproved = Boolean(task.metadata?.zavorthBridgeAutoPermissionApplied);

    if (autoApprovalPolicy && !alreadyAutoApproved) {
      const approvalMode = this.resolveZavorthBridgeApprovalMode(autoApprovalPolicy);
      await this.windowAutomator.approveVisibleStep(0, approvalMode, targetProcessId || 0);
      const cleared = await this.windowAutomator.waitForPermissionPromptToClear(targetProcessId || 0);
      if (!cleared) {
        this.logRepo.log(
          'warn',
          'RealZavorthBridgeWatcher',
          'ZavorthBridge auto-approval policy did not dismiss the visible permission prompt.',
          {
            taskId: task.task_id,
            permissionId: autoApprovalPolicy.permission_id,
            approvalMode,
            processId: targetProcessId || 0,
          },
        );
      } else {
        task.metadata = {
          ...(task.metadata || {}),
          zavorthBridgeAutoPermissionApplied: autoApprovalPolicy.permission_id,
          zavorthBridgeAutoPermissionMode: approvalMode,
        };
        this.deps.taskManager?.saveTask(task);
        return true;
      }
    }

    const permission = await this.deps.permissionService.createRequest({
      task_id: task.task_id,
      executor: 'zavorthBridge',
      kind: 'ui_permission',
      scope: 'once',
      workspace,
      requested_value: 'approve-visible-step-once',
      resolved_value: 'approve-visible-step-once',
      reason:
        this.buildZavorthBridgePermissionReason(snapshot) ||
        snapshot.errorMessage ||
        'ZavorthBridge displayed a permission request in the UI and Zavorth needs your confirmation.',
      requested_by: task.user_id,
      metadata: {
        artifact_path: snapshot.screenshotPath,
        tracking_file: session.trackingFile,
        response_file: session.responseFile,
        handoff_file: session.handoffFile,
        session_kind: session.sessionKind || 'handoff',
        companion_instance_id: targetInstanceId || null,
        companion_process_id: targetProcessId || null,
        permission_prompt_summary: snapshot.permissionPromptSummary || null,
        permission_prompt_notes: snapshot.notes || null,
      },
    });

    task.requires_approval = true;
    task.approval_status = 'pending';
    task.metadata = {
      ...(task.metadata || {}),
      pendingPermissionId: permission.permission_id,
      pendingPermissionNotifiedAt: null,
      pendingPermissionNotificationError: null,
      zavorthBridgeCompanionInstanceId:
        task.metadata?.zavorthBridgeCompanionInstanceId ||
        targetInstanceId ||
        session.companionInstanceId ||
        null,
      zavorthBridgeCompanionProcessId:
        task.metadata?.zavorthBridgeCompanionProcessId || targetProcessId || null,
      zavorthBridgeTrackingFile: task.metadata?.zavorthBridgeTrackingFile || session.trackingFile,
      zavorthBridgeResponseFile: task.metadata?.zavorthBridgeResponseFile || session.responseFile,
      zavorthBridgeHandoffFile: task.metadata?.zavorthBridgeHandoffFile || session.handoffFile,
      zavorthBridgePermissionArtifactPath: snapshot.screenshotPath || null,
    };

    if (task.status !== 'waiting_approval') {
      this.deps.taskManager?.advanceState(task, 'waiting_approval');
    } else {
      this.deps.taskManager?.saveTask(task);
    }

    const shouldNotify =
      !existingPendingId ||
      existingPendingId !== permission.permission_id ||
      !pendingPermissionNotifiedAt;

    if (
      shouldNotify &&
      !this.wasPermissionRecentlyNotified(
        session,
        permission.permission_id,
        pendingPermissionNotifiedAt || null,
      )
    ) {
      try {
        await this.notifyPermissionRequest(session, permission);
        task.metadata = {
          ...(task.metadata || {}),
          pendingPermissionId: permission.permission_id,
          pendingPermissionNotifiedAt: new Date().toISOString(),
          pendingPermissionNotificationError: null,
        };
        this.deps.taskManager?.saveTask(task);
      } catch (error: any) {
        task.metadata = {
          ...(task.metadata || {}),
          pendingPermissionId: permission.permission_id,
          pendingPermissionNotifiedAt: null,
          pendingPermissionNotificationError: error.message,
        };
        this.deps.taskManager?.saveTask(task);
        this.logRepo.log(
          'warn',
          'RealZavorthBridgeWatcher',
          `Failed to notify ZavorthBridge permission request: ${error.message}`,
          {
            taskId: session.taskId,
            permissionId: permission.permission_id,
            trigger,
          },
        );
      }
    }

    return true;
  }

  public async findZavorthBridgeAutoApprovalPolicy(
    workspace: string,
    companionInstanceId?: string,
  ): Promise<PermissionRequest | undefined> {
    if (!this.deps.permissionService) {
      return undefined;
    }

    const approved = await this.deps.permissionService.listApprovedRequests(
      'zavorthBridge',
      'ui_permission',
      workspace,
    );
    const normalizedInstanceId = String(companionInstanceId || '').trim();

    if (normalizedInstanceId) {
      const exactSessionMatch = approved.find((permission) => {
        if (permission.scope !== 'session') {
          return false;
        }

        return String(permission.metadata?.companion_instance_id || '').trim() === normalizedInstanceId;
      });
      if (exactSessionMatch) {
        return exactSessionMatch;
      }
    }

    return approved.find((permission) => permission.scope !== 'session');
  }

  public resolveZavorthBridgeApprovalMode(permission: PermissionRequest): 'once' | 'conversation' {
    const value = String(permission.resolved_value || permission.requested_value || '')
      .trim()
      .toLowerCase();
    if (
      value.includes('conversation') ||
      permission.scope === 'session' ||
      permission.scope === 'workspace' ||
      permission.scope === 'persistent'
    ) {
      return 'conversation';
    }
    return 'once';
  }

  public buildZavorthBridgePermissionReason(snapshot: ZavorthBridgeUiSnapshot): string | null {
    const summary = String(snapshot.permissionPromptSummary || '').trim();
    if (!summary) {
      return null;
    }

    return `ZavorthBridge requested permission in the UI: ${summary}`;
  }

  public async notifyPermissionRequest(
    session: PendingZavorthBridgeSession,
    permission: PermissionRequest,
  ): Promise<void> {
    const text = this.deps.formatPermissionCreatedMessage
      ? this.deps.formatPermissionCreatedMessage(permission)
      : [
          'ZavorthBridge opened a permission request and is waiting for your confirmation.',
          `ID: ${permission.permission_id}`,
          `To approve: /perm approve ${permission.permission_id.substring(0, 8)}`,
          `To reject: /perm reject ${permission.permission_id.substring(0, 8)}`,
        ].join('\n');

    session.lastPermissionNotificationAttemptAt = new Date().toISOString();
    await this.bridgeManager.saveSession(session);

    if (this.deps.botApi?.sendMessage) {
      try {
        await this.deps.botApi.sendMessage(
          session.chatId as any,
          text,
          this.deps.buildPermissionKeyboard
            ? { reply_markup: this.deps.buildPermissionKeyboard(permission) }
            : undefined,
        );
        session.lastPermissionNotificationAt = new Date().toISOString();
        session.lastNotifiedPermissionId = permission.permission_id;
        await this.bridgeManager.saveSession(session);
        return;
      } catch (error: any) {
        this.logRepo.log(
          'warn',
          'RealZavorthBridgeWatcher',
          `Failed to send inline permission request to ${session.chatId}: ${error.message}`,
          {
            taskId: session.taskId,
            permissionId: permission.permission_id,
          },
        );
      }
    }

    await this.sendToSession(session, text);
    session.lastPermissionNotificationAt = new Date().toISOString();
    session.lastNotifiedPermissionId = permission.permission_id;
    await this.bridgeManager.saveSession(session);
  }

  public isRecentTimestamp(value: string | null | undefined, maxAgeMs: number): boolean {
    const timestampMs = Date.parse(String(value || '').trim());
    if (!Number.isFinite(timestampMs)) {
      return false;
    }

    return Date.now() - timestampMs <= Math.max(0, maxAgeMs);
  }
}
