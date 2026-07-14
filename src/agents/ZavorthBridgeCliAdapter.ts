import { v4 as uuidv4 } from 'uuid';
import { ExecutionResult } from '../contracts/ExecutionContract.js';
import { Task } from '../contracts/TaskContract.js';
import { config } from '../config/index.js';
import { AgentBridgeManager } from '../orchestrator/AgentBridgeManager.js';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import { ZavorthBridgeWindowAutomator } from './ZavorthBridgeWindowAutomator.js';
import { ZavorthBridgeCompanionBridge } from './ZavorthBridgeCompanionBridge.js';
import { ZavorthBridgePreferenceStore } from './ZavorthBridgePreferenceStore.js';
import {
  buildDirectChatUnavailableError,
  clearBlockingArtifactEditor as clearBlockingArtifactEditorSupport,
  clearBlockingPermissionPrompt as clearBlockingPermissionPromptSupport,
  deliverPromptToLiveSession as deliverPromptToLiveSessionSupport,
  isArtifactEditorBlockingDirectChat as isArtifactEditorBlockingDirectChatSupport,
  isAutomationSurfaceReady as isAutomationSurfaceReadySupport,
  normalizeUiProbeStatus as normalizeUiProbeStatusSupport,
  normalizeUiProbeText as normalizeUiProbeTextSupport,
  prepareDirectChatSurface as prepareDirectChatSurfaceSupport,
  tryDeliverPromptViaCompanionBridge as tryDeliverPromptViaCompanionBridgeSupport,
  tryPrepareAutomationSurface as tryPrepareAutomationSurfaceSupport,
  waitForPromptSubmissionEffect as waitForPromptSubmissionEffectSupport,
  type CompanionBridge,
  type WindowAutomator,
  type UiStateSnapshot,
} from './zavorth-bridge-cli/ZavorthBridgeCliDirectChatSupport.js';
import {
  buildWorkspaceBootstrapArgs as buildWorkspaceBootstrapArgsSupport,
  describeWorkspaceBootstrapFailure as describeWorkspaceBootstrapFailureSupport,
  ensureReusableWorkspaceSession as ensureReusableWorkspaceSessionSupport,
  getWorkspaceWindowLabel as getWorkspaceWindowLabelSupport,
  isBridgeSessionReusable as isBridgeSessionReusableSupport,
  isWindowSurfaceCompatible as isWindowSurfaceCompatibleSupport,
  isWorkspaceCompatible as isWorkspaceCompatibleSupport,
  readLiveBridgeStatus as readLiveBridgeStatusSupport,
  resolveWindowStrategyFlag as resolveWindowStrategyFlagSupport,
  waitForCompatibleBridgeStatus as waitForCompatibleBridgeStatusSupport,
} from './zavorth-bridge-cli/ZavorthBridgeCliWorkspaceSupport.js';
import { spawnCommand } from '../core/CommandSpawn.js';


export class ZavorthBridgeCliAdapter {
  private bridgeManager: AgentBridgeManager;
  private windowAutomator: ZavorthBridgeWindowAutomator;
  private companionBridge: ZavorthBridgeCompanionBridge;
  private preferenceStore: ZavorthBridgePreferenceStore;

  constructor() {
    this.bridgeManager = new AgentBridgeManager();
    this.windowAutomator = new ZavorthBridgeWindowAutomator();
    this.companionBridge = new ZavorthBridgeCompanionBridge();
    this.preferenceStore = new ZavorthBridgePreferenceStore();
  }

  public async executePrompt(
    task: Task,
    prompt: string,
    workspaceHint: string | null | undefined,
  ): Promise<ExecutionResult> {
    const workspace = WorkspaceResolver.validate(workspaceHint);
    await this.ensureNoConflictingSession(task.task_id);
    await this.ensureReusableWorkspaceSession(workspace);

    const handoff = await this.bridgeManager.createZavorthBridgeHandoff(task, prompt, workspace);
    await this.configureLivePromptSession(task.task_id);
    const preferredModel = await this.preferenceStore.getPreferredModel();
    const launchPrompt = this.buildLaunchPrompt(task, prompt, preferredModel);
    const reusedSession = await this.tryReuseLiveSession(task, handoff, workspace, launchPrompt);

    if (reusedSession) {
      return reusedSession;
    }

    const lastStatus = await this.companionBridge.readStatus().catch(() => null);
    throw new Error(this.describeWorkspaceBootstrapFailure(workspace, lastStatus));
  }

  private buildLaunchPrompt(task: Task, prompt: string, preferredModel: string | null): string {
    const modelInstruction = preferredModel
      ? `Keep the session on model ${preferredModel} if the current workspace already supports it.`
      : 'Keep the current ZavorthBridge model unless the workspace already defines another explicit preference.';

    return [
      `[ZAVORTH_TASK_ID:${task.task_id}]`,
      'Answer the user directly in this chat.',
      modelInstruction,
      'Respond in English unless the user explicitly asked for another language.',
      'Structure the answer cleanly with short paragraphs or flat bullets when that helps readability.',
      'Match the technical depth to the request. Keep simple requests simple.',
      'Return only the final answer the user should receive.',
      'Do not quote or restate these control instructions.',
      'Do not describe your plan, thought process, progress updates, or internal steps unless the user explicitly asked for them.',
      'Do not read Zavorth handoff files or write Zavorth response files unless the user explicitly asked for file-based output.',
      'Avoid asking for file access just to continue. Use the open workspace only when the request truly needs it.',
      `User request: ${prompt}`,
    ].join(' ');
  }

  private launch(args: string[], workspace: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawnCommand(config.zavorthBridgeCliPath, args, {
        cwd: workspace,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });

      child.once('error', reject);
      child.once('spawn', () => {
        child.unref();
        resolve();
      });
    });
  }

  private async tryReuseLiveSession(
    task: Task,
    handoff: Awaited<ReturnType<AgentBridgeManager['createZavorthBridgeHandoff']>>,
    workspace: string,
    launchPrompt: string,
  ): Promise<ExecutionResult | null> {
    if (!(await this.companionBridge.isOnline())) {
      return null;
    }

    const status = await this.companionBridge.readStatus();
    const workspaceReady =
      this.isBridgeSessionReusable(status, workspace) ||
      (await this.isWindowSurfaceCompatible(status, workspace));

    if (!workspaceReady) {
      return null;
    }
    if (!status) {
      return null;
    }

    let targetInstanceId = String(status.instanceId);
    let targetPid = status.processId || 0;
    const preflightActions: string[] = [];

    if (config.zavorthBridgeStartNewConversationPerTask && (await this.companionBridge.supports('canStartNewConversation'))) {
      await this.companionBridge.startNewConversation(task.task_id, 8000, targetInstanceId).catch(() => undefined);
    }

    if (config.zavorthBridgeAutoCleanBeforeTask) {
      if (await this.companionBridge.supports('canResetSession')) {
        await this.companionBridge.resetSession(task.task_id, 12000, targetInstanceId);
      } else if (await this.companionBridge.supports('canCloseAllEditors')) {
        await this.companionBridge.closeAllEditors(task.task_id, 8000, targetInstanceId);
      }
    }

    if (!status.activeEditor && (await this.companionBridge.supports('canStartNewConversation'))) {
      await this.companionBridge.startNewConversation(task.task_id, 8000, targetInstanceId).catch(() => undefined);
    }

    const artifactEditorAction = await this.clearBlockingArtifactEditor(task.task_id, targetInstanceId, status.activeEditor);
    if (artifactEditorAction) {
      preflightActions.push(artifactEditorAction);
    }

    const refreshedStatus = await this.waitForCompatibleBridgeStatus(workspace, 4000);
    if (!refreshedStatus) {
      const lastStatus = await this.companionBridge.readStatus().catch(() => status);
      throw new Error(this.describeWorkspaceBootstrapFailure(workspace, lastStatus));
    }

    targetInstanceId = String(refreshedStatus.instanceId);
    targetPid = refreshedStatus.processId || targetPid;
    await this.configureLivePromptSession(task.task_id, targetInstanceId);

    const preferredModel = await this.preferenceStore.getPreferredModel();
    if (preferredModel && config.zavorthBridgeAutomationEnabled) {
      await this.companionBridge.executeCommand('workbench.view.extension.agentSidePanel', [], undefined, 5000, targetInstanceId).catch(() => undefined);

      try {
        await this.windowAutomator.switchModel(preferredModel, 1500, targetPid);
        await this.windowAutomator.verifyModel(preferredModel, 500, targetPid);
      } catch (error: unknown) {// Fallback once if model switch failed
        await this.companionBridge.executeCommand('workbench.action.closeAllEditors', [], undefined, 5000, targetInstanceId).catch(() => undefined);
        await this.companionBridge.executeCommand('zavorthBridge.openAgent', [], undefined, 5000, targetInstanceId).catch(() => undefined);
        await this.windowAutomator.switchModel(preferredModel, 1500, targetPid).catch(() => undefined);
      }
    }

    await this.companionBridge.executeCommand('zavorthBridge.openAgent', [], undefined, 5000, targetInstanceId).catch(() => undefined);
    const blockingPromptAction = await this.clearBlockingPermissionPrompt(task.task_id, targetInstanceId, targetPid);
    if (blockingPromptAction) {
      preflightActions.push(blockingPromptAction);
    }
    const promptDelivery = await this.deliverPromptToLiveSession(launchPrompt, task.task_id, targetInstanceId, targetPid);

    if (config.zavorthBridgeAutomationEnabled) {
      void this.windowAutomator.focusWindow(400).catch(() => undefined);
    }

    const actionsExecuted = ['Reused live ZavorthBridge session via companion bridge', 'Delivered direct chat prompt'];
    const commandsExecuted = [promptDelivery];
    for (const preflightAction of preflightActions.slice().reverse()) {
      actionsExecuted.splice(1, 0, 'Prepared live ZavorthBridge session for direct chat');
      commandsExecuted.unshift(preflightAction);
    }

    return {
      execution_id: uuidv4(),
      task_id: task.task_id,
      executor: 'zavorthBridge_companion',
      success: true,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      actions_executed: actionsExecuted,
      files_read: [],
      files_written: [],
      files_deleted: [],
      commands_executed: commandsExecuted,
      stdout: `ZavorthBridge live session reused. Prompt delivered via ${promptDelivery}. Zavorth will capture the final answer from the live chat UI.`,
      stderr: null,
      diff_summary: null,
      artifacts: [
        { type: 'handoff', path: handoff.handoffFile },
        { type: 'response', path: handoff.responseFile },
      ],
      rollback_available: false,
      error_code: null,
      error_message: null,
      metadata: {
        workspace,
        delivery_mode: 'companion-reuse',
        interaction_mode: 'direct-chat',
        preferred_model: await this.preferenceStore.getPreferredModel(),
        handoff_file: handoff.handoffFile,
        tracking_file: handoff.trackingFile,
        response_file: handoff.responseFile,
        launched_at: handoff.launchedAt,
        companion_instance_id: targetInstanceId,
        prompt_delivery: promptDelivery,
        preflight_action: preflightActions.length > 0 ? preflightActions.join(' + ') : null,
        conversation_mode: config.zavorthBridgeStartNewConversationPerTask ? 'new-per-task' : 'reuse-current',
      },
    };
  }

  private async deliverPromptToLiveSession(
    prompt: string,
    taskId: string,
    targetInstanceId: string,
    targetPid: number,
  ): Promise<string> {
    return deliverPromptToLiveSessionSupport({
      prompt,
      taskId,
      targetInstanceId,
      targetPid,
      readUiStateSnapshot: this.readUiStateSnapshot.bind(this),
      tryDeliverPromptViaCompanionBridge: this.tryDeliverPromptViaCompanionBridge.bind(this),
      waitForPromptSubmissionEffect: this.waitForPromptSubmissionEffect.bind(this),
      prepareDirectChatSurface: this.prepareDirectChatSurface.bind(this),
      windowAutomator: this.windowAutomator,
    });
  }

  private async tryDeliverPromptViaCompanionBridge(
    prompt: string,
    taskId: string,
    targetInstanceId: string,
  ): Promise<string | null> {
    return tryDeliverPromptViaCompanionBridgeSupport({
      prompt,
      taskId,
      targetInstanceId,
      companionBridge: this.companionBridge,
    });
  }

  private async readUiStateSnapshot(targetPid: number): Promise<UiStateSnapshot> {
    if (typeof (this.windowAutomator as unknown as WindowAutomator).readLatestResponse !== 'function') {
      return { ok: false, status: 'unavailable' };
    }

    return this.windowAutomator.readLatestResponse(0, targetPid)
      .then((snapshot): UiStateSnapshot => {
        if (!snapshot) {
          return { ok: false, status: 'empty' };
        }
        return {
          ok: snapshot.ok,
          status: snapshot.status,
          responseText: snapshot.responseText ?? undefined,
          hasPermissionPrompt: snapshot.hasPermissionPrompt,
        };
      })
      .catch((): UiStateSnapshot => ({ ok: false, status: 'error' }));
  }

  private async waitForPromptSubmissionEffect(
    targetPid: number,
    baselineUiState: UiStateSnapshot,
  ): Promise<boolean> {
    if (!config.zavorthBridgeAutomationEnabled || targetPid <= 0) {
      return true;
    }

    if (typeof (this.windowAutomator as unknown as WindowAutomator).readLatestResponse !== 'function') {
      return true;
    }

    const baselineStatus = this.normalizeUiProbeStatus(baselineUiState?.status);
    const baselineResponse = this.normalizeUiProbeText(baselineUiState?.responseText);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const snapshot = await this.readUiStateSnapshot(targetPid);
      if (!snapshot?.ok) {
        continue;
      }

      if (snapshot.hasPermissionPrompt) {
        return true;
      }

      const currentStatus = this.normalizeUiProbeStatus(snapshot.status);
      if (currentStatus === 'generating') {
        return true;
      }

      const currentResponse = this.normalizeUiProbeText(snapshot.responseText);
      if (currentResponse && currentResponse !== baselineResponse) {
        return true;
      }

      if (baselineStatus !== currentStatus && currentStatus === 'ready' && currentResponse) {
        return true;
      }
    }

    return false;
  }

  private normalizeUiProbeText(value: string | null | undefined): string {
    return normalizeUiProbeTextSupport(value);
  }

  private normalizeUiProbeStatus(value: string | null | undefined): string {
    return normalizeUiProbeStatusSupport(value);
  }

  private isWorkspaceCompatible(workspaceFolders: string[], workspace: string): boolean {
    return isWorkspaceCompatibleSupport(workspaceFolders, workspace);
  }

  private isBridgeSessionReusable(status: Awaited<ReturnType<ZavorthBridgeCompanionBridge['readStatus']>> | null, workspace: string): boolean {
    return isBridgeSessionReusableSupport(status, workspace);
  }

  private async ensureReusableWorkspaceSession(workspace: string): Promise<void> {
    return ensureReusableWorkspaceSessionSupport({
      workspace,
      launch: this.launch.bind(this),
      buildWorkspaceBootstrapArgs: this.buildWorkspaceBootstrapArgs.bind(this),
      waitForCompatibleBridgeStatus: this.waitForCompatibleBridgeStatus.bind(this),
      companionBridge: this.companionBridge,
      describeWorkspaceBootstrapFailure: this.describeWorkspaceBootstrapFailure.bind(this),
    });
  }

  private buildWorkspaceBootstrapArgs(workspace: string): string[][] {
    return buildWorkspaceBootstrapArgsSupport(workspace);
  }

  private resolveWindowStrategyFlag(): '--reuse-window' | '--new-window' {
    return resolveWindowStrategyFlagSupport();
  }

  private async waitForCompatibleBridgeStatus(
    workspace: string,
    timeoutMs: number,
  ): Promise<Awaited<ReturnType<ZavorthBridgeCompanionBridge['readStatus']>> | null> {
    return waitForCompatibleBridgeStatusSupport({
      workspace,
      timeoutMs,
      readLiveBridgeStatus: this.readLiveBridgeStatus.bind(this),
      isBridgeSessionReusable: this.isBridgeSessionReusable.bind(this),
      isWindowSurfaceCompatible: this.isWindowSurfaceCompatible.bind(this),
    });
  }

  private async readLiveBridgeStatus(): Promise<Awaited<ReturnType<ZavorthBridgeCompanionBridge['readStatus']>> | null> {
    return readLiveBridgeStatusSupport(this.companionBridge);
  }

  private describeWorkspaceBootstrapFailure(
    workspace: string,
    status: Awaited<ReturnType<ZavorthBridgeCompanionBridge['readStatus']>> | null,
  ): string {
    return describeWorkspaceBootstrapFailureSupport(workspace, status);
  }

  private async isWindowSurfaceCompatible(
    status: Awaited<ReturnType<ZavorthBridgeCompanionBridge['readStatus']>> | null,
    workspace: string,
  ): Promise<boolean> {
    return isWindowSurfaceCompatibleSupport({
      status,
      workspace,
      windowAutomator: this.windowAutomator,
    });
  }

  private getWorkspaceWindowLabel(workspace: string): string {
    return getWorkspaceWindowLabelSupport(workspace);
  }

  private async ensureNoConflictingSession(taskId: string): Promise<void> {
    const maxActiveAgeMs = Math.max(config.zavorthBridgePromptTimeoutSeconds * 1000, 10 * 60 * 1000);
    const sessions = await this.bridgeManager.listPendingSessions();
    const conflictingSession = sessions.find((session) => {
      if (session.taskId === taskId || session.completedAt) {
        return false;
      }

      const launchedAtMs = Date.parse(session.launchedAt);
      if (!Number.isFinite(launchedAtMs)) {
        return true;
      }

      return (Date.now() - launchedAtMs) <= maxActiveAgeMs;
    });

    if (!conflictingSession) {
      return;
    }

    throw new Error(
      `O ZavorthBridge ainda esta ocupado com a tarefa ${conflictingSession.taskId.substring(0, 8)}. Aguarde a conclusao atual ou use /agreset antes de iniciar outra.`,
    );
  }

  private async clearBlockingPermissionPrompt(
    taskId: string,
    targetInstanceId: string,
    targetPid: number,
  ): Promise<string | null> {
    return clearBlockingPermissionPromptSupport({
      taskId,
      targetInstanceId,
      targetPid,
      windowAutomator: this.windowAutomator as unknown as WindowAutomator,
      companionBridge: this.companionBridge as unknown as CompanionBridge,
    });
  }

  private async clearBlockingArtifactEditor(
    taskId: string,
    targetInstanceId: string,
    activeEditor: string | null | undefined,
  ): Promise<string | null> {
    return clearBlockingArtifactEditorSupport({
      taskId,
      targetInstanceId,
      activeEditor,
      companionBridge: this.companionBridge as unknown as CompanionBridge,
    });
  }

  private async prepareDirectChatSurface(
    taskId: string,
    targetInstanceId: string,
    targetPid: number,
  ): Promise<{ deliveryLabel: string; initialDelayMs: number }> {
    return prepareDirectChatSurfaceSupport({
      taskId,
      targetInstanceId,
      targetPid,
      companionBridge: this.companionBridge as unknown as CompanionBridge,
      tryPrepareAutomationSurface: this.tryPrepareAutomationSurface.bind(this),
    });
  }

  private async tryPrepareAutomationSurface(
    processId: number,
    focusDelayMs: number,
    surfaceDelayMs: number,
  ): Promise<{ ready: boolean; failureMessage: string | null }> {
    return tryPrepareAutomationSurfaceSupport({
      processId,
      focusDelayMs,
      surfaceDelayMs,
      windowAutomator: this.windowAutomator as unknown as WindowAutomator,
    });
  }

  private isAutomationSurfaceReady(surface: any): boolean {
    return isAutomationSurfaceReadySupport(surface);
  }

  private buildDirectChatUnavailableError(message: string): Error {
    return buildDirectChatUnavailableError(message);
  }

  private isArtifactEditorBlockingDirectChat(activeEditor: string | null | undefined): boolean {
    return isArtifactEditorBlockingDirectChatSupport(activeEditor);
  }

  private async configureLivePromptSession(taskId: string, companionInstanceId?: string | null): Promise<void> {
    const sessions = await this.bridgeManager.listPendingSessions();
    const session = sessions.find((candidate) => candidate.taskId === taskId);
    if (!session) {
      return;
    }

    session.automationEnabled = false;
    session.companionInstanceId = companionInstanceId || session.companionInstanceId || null;
    await this.bridgeManager.saveSession(session);
  }
}
