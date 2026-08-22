import {
  ZavorthBridgeControlResult,
  ZavorthBridgeControlService,
} from './ZavorthBridgeControlService.js';
import { ZavorthBridgeCompanionBridge } from '../agents/ZavorthBridgeCompanionBridge.js';
import { ZavorthBridgeWindowAutomator } from '../agents/ZavorthBridgeWindowAutomator.js';
import {
  ZavorthBridgePromptArtifactSupport,
  type ZavorthBridgeArtifact,
} from './zavorth-bridge-prompt/ZavorthBridgePromptArtifactSupport.js';
import { ZavorthBridgePromptSurfaceSupport } from './zavorth-bridge-prompt/ZavorthBridgePromptSurfaceSupport.js';
import { Task } from '../contracts/TaskContract.js';
import { LogRepository } from '../storage/LogRepository.js';
import { config } from '../config/index.js';
import {
  AgentBridgeManager,
  PendingZavorthBridgeSession,
} from '../orchestrator/AgentBridgeManager.js';


import {
  ZavorthBridgeUiCaptureService,
  ZavorthBridgeUiSnapshot,
} from './ZavorthBridgeUiCaptureService.js';

import {
  isZavorthBridgeUiResponseReadyForDelivery,
  isZavorthBridgeUiSurfaceReady,
} from './ZavorthBridgeUiResponseHeuristics.js';


export type ZavorthBridgePromptStartResult = {
  ok: boolean;
  taskId: string;
  step: string;
  verified: boolean;
  promptText: string | null;
  selectedModel: string | null;
  modelKey: string | null;
  trackingFile: string | null;
  responseFile: string | null;
  handoffFile: string | null;
  companionInstanceId: string | null;
  processId: number | null;
  windowTitle: string | null;
  message: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  logFile: string | null;
  diagnostics: Record<string, unknown> | null;
  remoteModeActive?: boolean | null;
  sessionAccessible?: boolean | null;
  desktopName?: string | null;
  sessionMessage?: string | null;
};

export type ZavorthBridgePromptCompletionResult = {
  ok: boolean;
  taskId: string;
  step: string;
  verified: boolean;
  partial: boolean;
  source:
    | 'response-file'
    | 'response-file-processed'
    | 'artifact-walkthrough'
    | 'artifact-partial'
    | 'ui-capture'
    | 'ui-capture-partial'
    | 'timeout'
    | 'error';
  selectedModel: string | null;
  text: string | null;
  trackingFile: string | null;
  responseFile: string | null;
  handoffFile: string | null;
  artifactType: string | null;
  artifactPath: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export class ZavorthBridgePromptService {
  private controlService: ZavorthBridgeControlService;
  private bridge: ZavorthBridgeCompanionBridge;
  private bridgeManager: AgentBridgeManager;
  private uiCaptureService: ZavorthBridgeUiCaptureService;
  private automator: ZavorthBridgeWindowAutomator;
  private artifactSupport: ZavorthBridgePromptArtifactSupport;
  private surfaceSupport: ZavorthBridgePromptSurfaceSupport;

  constructor(private logRepo: LogRepository) {
    this.controlService = new ZavorthBridgeControlService();
    this.bridge = new ZavorthBridgeCompanionBridge();
    this.bridgeManager = new AgentBridgeManager();
    this.uiCaptureService = new ZavorthBridgeUiCaptureService();
    this.automator = new ZavorthBridgeWindowAutomator();
    this.artifactSupport = new ZavorthBridgePromptArtifactSupport(this);
    this.surfaceSupport = new ZavorthBridgePromptSurfaceSupport(this);
  }

  public async start(
    task: Task,
    modelInput: string,
    prompt: string,
    workspace?: string,
  ): Promise<ZavorthBridgePromptStartResult> {
    const bridgeSyncStartedAt = Date.now();
    const normalizedPrompt = String(prompt || '').trim();
    if (!normalizedPrompt) {
      return {
        ok: false,
        taskId: task.task_id,
        step: 'validation',
        verified: false,
        promptText: normalizedPrompt,
        selectedModel: null,
        modelKey: null,
        trackingFile: null,
        responseFile: null,
        handoffFile: null,
        companionInstanceId: null,
        processId: null,
        windowTitle: null,
        message: 'The prompt was not sent because the text is empty.',
        errorCode: 'prompt_required',
        errorMessage: 'Prompt vazio.',
        logFile: null,
        diagnostics: null,
        remoteModeActive: null,
        sessionAccessible: null,
        desktopName: null,
        sessionMessage: null,
      };
    }

    const modelResult = await this.controlService.setModel(modelInput);
    if (!modelResult.ok || !modelResult.verified || !modelResult.selectedModel) {
      return this.mapControlFailure(task, modelResult);
    }

    if (!(await this.bridge.isOnline())) {
      return {
        ok: false,
        taskId: task.task_id,
        step: 'bridge',
        verified: false,
        promptText: normalizedPrompt,
        selectedModel: modelResult.selectedModel,
        modelKey: modelResult.modelKey,
        trackingFile: null,
        responseFile: null,
        handoffFile: null,
        companionInstanceId: null,
        processId: modelResult.processId,
        windowTitle: modelResult.windowTitle,
        message: 'The model was changed, but the internal ZavorthBridge bridge is not online.',
        errorCode: 'bridge_offline',
        errorMessage: 'ZavorthBridge companion bridge offline.',
        logFile: modelResult.logFile,
        diagnostics: this.asDiagnostics(modelResult.diagnostics),
      };
    }

    if (!(await this.bridge.supports('canSendAgentPrompt'))) {
      return {
        ok: false,
        taskId: task.task_id,
        step: 'bridge',
        verified: false,
        promptText: normalizedPrompt,
        selectedModel: modelResult.selectedModel,
        modelKey: modelResult.modelKey,
        trackingFile: null,
        responseFile: null,
        handoffFile: null,
        companionInstanceId: null,
        processId: modelResult.processId,
        windowTitle: modelResult.windowTitle,
        message: 'The model was changed, but this ZavorthBridge instance does not expose prompt sending through the internal bridge.',
        errorCode: 'bridge_prompt_not_supported',
        errorMessage: 'Bridge without canSendAgentPrompt.',
        logFile: modelResult.logFile,
        diagnostics: this.asDiagnostics(modelResult.diagnostics),
      };
    }

    const promptPreflight = await this.controlService.ensurePromptInteractionReady(modelResult.processId);
    if (!promptPreflight.ok) {
      return {
        ok: false,
        taskId: task.task_id,
        step: 'session_preflight',
        verified: false,
        promptText: normalizedPrompt,
        selectedModel: modelResult.selectedModel,
        modelKey: modelResult.modelKey,
        trackingFile: null,
        responseFile: null,
        handoffFile: null,
        companionInstanceId: null,
        processId: promptPreflight.processId,
        windowTitle: promptPreflight.windowTitle,
        message: promptPreflight.message || 'The model was changed, but the ZavorthBridge session/window was not ready for sending.',
        errorCode: promptPreflight.errorCode || 'session_preflight_failed',
        errorMessage: promptPreflight.errorMessage || 'Failed to prepare the Windows session for ZavorthBridge.',
        logFile: modelResult.logFile,
        diagnostics: {
          ...(this.asDiagnostics(modelResult.diagnostics) || {}),
          ...(promptPreflight.diagnostics || {}),
        },
        remoteModeActive: promptPreflight.remoteModeActive,
        sessionAccessible: promptPreflight.sessionAccessible,
        desktopName: promptPreflight.desktopName,
        sessionMessage: promptPreflight.sessionMessage,
      };
    }

    const workspacePath = workspace || task.workspace || config.defaultWorkspace;
    const handoff = await this.bridgeManager.createZavorthBridgeHandoff(task, normalizedPrompt, workspacePath);
    const bridgeStatus = await this.waitForFreshBridgeStatus(bridgeSyncStartedAt, 15000);
    const targetInstanceId = bridgeStatus?.instanceId || undefined;
    const activeProcessId = promptPreflight.processId || modelResult.processId || null;
    const activeWindowTitle = promptPreflight.windowTitle || modelResult.windowTitle || config.zavorthBridgeWindowTitle;

    const readySurface = await this.ensureConversationSurfaceVisible({
      taskId: task.task_id,
      targetInstanceId,
      processId: activeProcessId,
      expectedModel: modelResult.selectedModel,
      phase: 'send',
    });
    if (!readySurface.ready) {
      return {
        ok: false,
        taskId: task.task_id,
        step: 'surface_not_ready',
        verified: false,
        promptText: normalizedPrompt,
        selectedModel: modelResult.selectedModel,
        modelKey: modelResult.modelKey,
        trackingFile: null,
        responseFile: null,
        handoffFile: null,
        companionInstanceId: targetInstanceId || null,
        processId: activeProcessId,
        windowTitle: activeWindowTitle,
        message: 'The model was changed, but Zavorth could not lock the visible ZavorthBridge conversation before sending.',
        errorCode: 'prompt_surface_not_ready',
        errorMessage: readySurface.message || 'ZavorthBridge prompt surface not ready.',
        logFile: modelResult.logFile,
        diagnostics: {
          ...(this.asDiagnostics(modelResult.diagnostics) || {}),
          ...(promptPreflight.diagnostics || {}),
          surfaceProbe: readySurface.diagnostics || null,
        },
        remoteModeActive: promptPreflight.remoteModeActive,
        sessionAccessible: promptPreflight.sessionAccessible,
        desktopName: promptPreflight.desktopName,
        sessionMessage: promptPreflight.sessionMessage,
      };
    }

    const promptEnvelope = this.buildPromptEnvelope(
      task,
      modelResult.selectedModel,
      normalizedPrompt,
      workspacePath,
    );

    try {
      await this.automator.pasteAndSubmit(promptEnvelope, 400, activeProcessId || 0);
    } catch (error: unknown) {await this.ensureConversationSurfaceVisible({
        taskId: task.task_id,
        targetInstanceId,
        processId: activeProcessId,
        expectedModel: modelResult.selectedModel,
        phase: 'send',
      });
      await this.automator.pasteAndSubmit(promptEnvelope, 500, activeProcessId || 0);
    }

    const session = await this.readSession(handoff.trackingFile);
    if (session) {
      session.companionInstanceId = targetInstanceId || null;
      session.sessionKind = 'prompt-panel';
      session.automationEnabled = false;
      await this.bridgeManager.saveSession(session);
    }

    return {
      ok: true,
      taskId: task.task_id,
      step: 'prompt_sent',
      verified: true,
      promptText: normalizedPrompt,
      selectedModel: modelResult.selectedModel,
      modelKey: modelResult.modelKey,
      trackingFile: handoff.trackingFile,
      responseFile: handoff.responseFile,
      handoffFile: handoff.handoffFile,
      companionInstanceId: targetInstanceId || null,
      processId: activeProcessId,
      windowTitle: activeWindowTitle,
      message: 'Prompt sent to the real ZavorthBridge panel.',
      errorCode: null,
      errorMessage: null,
      logFile: modelResult.logFile,
      diagnostics: {
        ...(this.asDiagnostics(modelResult.diagnostics) || {}),
        ...(promptPreflight.diagnostics || {}),
        surfaceProbe: readySurface.diagnostics || null,
      },
      remoteModeActive: promptPreflight.remoteModeActive,
      sessionAccessible: promptPreflight.sessionAccessible,
      desktopName: promptPreflight.desktopName,
      sessionMessage: promptPreflight.sessionMessage,
    };
  }

  public async waitForCompletion(
    start: ZavorthBridgePromptStartResult,
    timeoutMs = config.zavorthBridgePromptTimeoutSeconds * 1000,
  ): Promise<ZavorthBridgePromptCompletionResult> {
    if (!start.ok || !start.trackingFile || !start.responseFile || !start.handoffFile) {
      return {
        ok: false,
        taskId: start.taskId,
        step: 'invalid_start_state',
        verified: false,
        partial: false,
        source: 'error',
        selectedModel: start.selectedModel,
        text: null,
        trackingFile: start.trackingFile,
        responseFile: start.responseFile,
        handoffFile: start.handoffFile,
        artifactType: null,
        artifactPath: null,
        errorCode: start.errorCode || 'invalid_start_state',
        errorMessage: start.errorMessage || 'Initial state invalid while waiting for ZavorthBridge response.',
      };
    }

    const startedAt = Date.now();
    let bestArtifact: ZavorthBridgeArtifact | null = null;
    let bestUiSnapshot: ZavorthBridgeUiSnapshot | null = null;
    let lastStableUiKey = '';
    let stableReadyPolls = 0;
    let lastUiCaptureAt = 0;

    while (Date.now() - startedAt < timeoutMs) {
      const responseFileResult = await this.tryReadResponseFile(start.responseFile);
      if (responseFileResult) {
        const session = await this.readSession(start.trackingFile);
        if (session) {
          await this.markSessionCompleted(session, responseFileResult.processedPath || responseFileResult.path, null);
        }

        return {
          ok: true,
          taskId: start.taskId,
          step: 'completed',
          verified: true,
          partial: false,
          source: responseFileResult.processedPath ? 'response-file-processed' : 'response-file',
          selectedModel: start.selectedModel,
          text: responseFileResult.content,
          trackingFile: start.trackingFile,
          responseFile: start.responseFile,
          handoffFile: start.handoffFile,
          artifactType: null,
          artifactPath: responseFileResult.processedPath || responseFileResult.path,
          errorCode: null,
          errorMessage: null,
        };
      }

      const session = await this.readSession(start.trackingFile);
      if (session) {
        const relevantArtifacts = await this.findRelevantArtifacts(session);
        if (relevantArtifacts.length > 0) {
          const candidate = relevantArtifacts[0];
          if (!bestArtifact || candidate.updatedAtMs >= bestArtifact.updatedAtMs) {
            bestArtifact = candidate;
          }

          if (candidate.artifactType === 'ARTIFACT_TYPE_WALKTHROUGH') {
            await this.markSessionCompleted(session, null, candidate);
            return {
              ok: true,
              taskId: start.taskId,
              step: 'completed',
              verified: true,
              partial: false,
              source: 'artifact-walkthrough',
              selectedModel: start.selectedModel,
              text: candidate.content,
              trackingFile: start.trackingFile,
              responseFile: start.responseFile,
              handoffFile: start.handoffFile,
              artifactType: candidate.artifactType,
              artifactPath: candidate.contentPath,
              errorCode: null,
              errorMessage: null,
            };
          }
        }
      }

      const shouldCaptureUi = (Date.now() - lastUiCaptureAt) >= 12000;
      if (shouldCaptureUi) {
        await this.ensureConversationSurfaceVisible({
          taskId: start.taskId,
          targetInstanceId: start.companionInstanceId || undefined,
          processId: start.processId,
          expectedModel: start.selectedModel,
          phase: 'capture',
        }).catch(() => undefined);
      }

      const uiSnapshot = shouldCaptureUi ? await this.tryCaptureUiState(start) : null;
      if (uiSnapshot?.ok) {
        lastUiCaptureAt = Date.now();
        if (uiSnapshot.hasPermissionPrompt) {
          return {
            ok: false,
            taskId: start.taskId,
            step: 'permission_prompt',
            verified: false,
            partial: false,
            source: 'error',
            selectedModel: start.selectedModel,
            text: null,
            trackingFile: start.trackingFile,
            responseFile: start.responseFile,
            handoffFile: start.handoffFile,
            artifactType: 'UI_CAPTURE',
            artifactPath: uiSnapshot.screenshotPath,
            errorCode: 'permission_prompt_visible',
            errorMessage: 'ZavorthBridge showed a permission request in the UI and Zavorth could not continue by itself.',
          };
        }

        const sanitizedUiResponse = this.sanitizeCapturedResponse(uiSnapshot.responseText, start.promptText);
        const normalizedSnapshot = {
          ...uiSnapshot,
          responseText: sanitizedUiResponse,
        };

        if (
          normalizedSnapshot.responseText &&
          isZavorthBridgeUiSurfaceReady(normalizedSnapshot) &&
          isZavorthBridgeUiResponseReadyForDelivery(normalizedSnapshot, normalizedSnapshot.responseText)
        ) {
          bestUiSnapshot = normalizedSnapshot;
        }

        const uiKey = this.normalizeVisibleResponse(normalizedSnapshot.responseText);
        if (isZavorthBridgeUiResponseReadyForDelivery(normalizedSnapshot, normalizedSnapshot.responseText) && uiKey) {
          if (uiKey === lastStableUiKey) {
            stableReadyPolls += 1;
          } else {
            lastStableUiKey = uiKey;
            stableReadyPolls = 1;
          }

          const goodSingleShot =
            stableReadyPolls >= 1 &&
            normalizedSnapshot.confidence >= 0.8 &&
            normalizedSnapshot.responseText.length >= 2;

          if (stableReadyPolls >= 2 || goodSingleShot) {
            const session = await this.readSession(start.trackingFile);
            if (session) {
              await this.markSessionCompleted(session, normalizedSnapshot.screenshotPath, null);
            }

            return {
              ok: true,
              taskId: start.taskId,
              step: 'completed',
              verified: true,
              partial: false,
              source: 'ui-capture',
              selectedModel: start.selectedModel,
              text: normalizedSnapshot.responseText,
              trackingFile: start.trackingFile,
              responseFile: start.responseFile,
              handoffFile: start.handoffFile,
              artifactType: 'UI_CAPTURE',
              artifactPath: normalizedSnapshot.screenshotPath,
              errorCode: null,
              errorMessage: null,
            };
          }
        } else {
          lastStableUiKey = '';
          stableReadyPolls = 0;
        }
      } else if (shouldCaptureUi) {
        lastUiCaptureAt = Date.now();
      }

      await this.delay(2500);
    }

    if (bestUiSnapshot?.responseText) {
      return {
        ok: true,
        taskId: start.taskId,
        step: 'timeout_partial',
        verified: false,
        partial: true,
        source: 'ui-capture-partial',
        selectedModel: start.selectedModel,
        text: bestUiSnapshot.responseText,
        trackingFile: start.trackingFile,
        responseFile: start.responseFile,
        handoffFile: start.handoffFile,
        artifactType: 'UI_CAPTURE',
        artifactPath: bestUiSnapshot.screenshotPath,
        errorCode: null,
        errorMessage: null,
      };
    }

    if (bestArtifact) {
      return {
        ok: true,
        taskId: start.taskId,
        step: 'timeout_partial',
        verified: false,
        partial: true,
        source: 'artifact-partial',
        selectedModel: start.selectedModel,
        text: bestArtifact.content,
        trackingFile: start.trackingFile,
        responseFile: start.responseFile,
        handoffFile: start.handoffFile,
        artifactType: bestArtifact.artifactType,
        artifactPath: bestArtifact.contentPath,
        errorCode: null,
        errorMessage: null,
      };
    }

    return {
      ok: false,
      taskId: start.taskId,
      step: 'timeout',
      verified: false,
      partial: false,
      source: 'timeout',
      selectedModel: start.selectedModel,
      text: null,
      trackingFile: start.trackingFile,
      responseFile: start.responseFile,
      handoffFile: start.handoffFile,
      artifactType: null,
      artifactPath: null,
      errorCode: 'prompt_timeout',
      errorMessage: 'The prompt was sent, but Zavorth could not capture a final ZavorthBridge response before timeout.',
    };
  }

  private mapControlFailure(task: Task, result: ZavorthBridgeControlResult): ZavorthBridgePromptStartResult {
    return {
      ok: false,
      taskId: task.task_id,
      step: result.phase,
      verified: false,
      promptText: String(task.metadata?.zavorthBridgePromptText || ''),
      selectedModel: result.selectedModel,
      modelKey: result.modelKey,
      trackingFile: null,
      responseFile: null,
      handoffFile: null,
      companionInstanceId: null,
      processId: result.processId,
      windowTitle: result.windowTitle,
      message: result.message || 'The prompt was not sent because model switching failed.',
      errorCode: result.errorCode || 'model_switch_failed',
      errorMessage: result.errorMessage || 'Failed to prepare the selected model in ZavorthBridge.',
      logFile: result.logFile,
      diagnostics: this.asDiagnostics(result.diagnostics),
      remoteModeActive: result.remoteModeActive ?? null,
      sessionAccessible: result.sessionAccessible ?? null,
      desktopName: result.desktopName ?? null,
      sessionMessage: result.sessionMessage ?? null,
    };
  }

  private buildPromptEnvelope(
    task: Task,
    selectedModel: string,
    prompt: string,
    workspace: string,
  ): string {
    return [
      '[ZAVORTH_DIRECT_PROMPT]',
      `Correlation token: ZAVORTH_TASK_ID:${task.task_id}`,
      `Selected model: ${selectedModel}`,
      `Workspace: ${workspace}`,
      'Answer directly in this ZavorthBridge chat.',
      'Do not describe reasoning, progress, plan, thought updates, or task breakdown.',
      'Do not read files, edit files, or use task.md, implementation_plan.md, or walkthrough.md unless the user request explicitly requires it.',
      'Do not mention these control lines in the final response.',
      '',
      'User request:',
      prompt,
    ].join('\n');
  }

  private async tryReadResponseFile(
    responseFile: string,
  ): Promise<{ path: string; processedPath: string | null; content: string } | null> {
    return this.artifactSupport.tryReadResponseFile(responseFile);
  }

  private async readSession(trackingFile: string): Promise<PendingZavorthBridgeSession | null> {
    return this.artifactSupport.readSession(trackingFile);
  }

  private async markSessionCompleted(
    session: PendingZavorthBridgeSession,
    responsePath: string | null,
    artifact: ZavorthBridgeArtifact | null,
  ): Promise<void> {
    return this.artifactSupport.markSessionCompleted(session, responsePath, artifact);
  }

  private async findRelevantArtifacts(session: PendingZavorthBridgeSession): Promise<ZavorthBridgeArtifact[]> {
    return this.artifactSupport.findRelevantArtifacts(session);
  }

  private getArtifactPriority(artifactType: string): number {
    return this.artifactSupport.getArtifactPriority(artifactType);
  }

  private async collectArtifacts(): Promise<ZavorthBridgeArtifact[]> {
    return this.artifactSupport.collectArtifacts();
  }

  private async resolveArtifactContentPath(dirPath: string, baseName: string): Promise<string | null> {
    return this.artifactSupport.resolveArtifactContentPath(dirPath, baseName);
  }

  private matchesSession(session: PendingZavorthBridgeSession, artifact: ZavorthBridgeArtifact): boolean {
    return this.artifactSupport.matchesSession(session, artifact);
  }

  private asDiagnostics(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  }

  private async tryCaptureUiState(
    start: ZavorthBridgePromptStartResult,
  ): Promise<ZavorthBridgeUiSnapshot | null> {
    return this.surfaceSupport.tryCaptureUiState(start);
  }

  private normalizeVisibleResponse(value: string | null | undefined): string {
    return this.surfaceSupport.normalizeVisibleResponse(value);
  }

  private sanitizeCapturedResponse(value: string | null | undefined, promptText: string | null | undefined): string {
    return this.surfaceSupport.sanitizeCapturedResponse(value, promptText);
  }

  private async waitForFreshBridgeStatus(
    notBeforeMs: number,
    timeoutMs: number,
  ): Promise<Awaited<ReturnType<ZavorthBridgeCompanionBridge['readStatus']>>> {
    return this.surfaceSupport.waitForFreshBridgeStatus(notBeforeMs, timeoutMs);
  }

  private async ensureConversationSurfaceVisible(options: {
    taskId?: string;
    targetInstanceId?: string;
    processId?: number | null;
    expectedModel?: string | null;
    phase: 'send' | 'capture';
  }): Promise<{
    ready: boolean;
    message: string | null;
    diagnostics: Record<string, unknown> | null;
  }> {
    return this.surfaceSupport.ensureConversationSurfaceVisible(options);
  }

  private async probeConversationSurface(
    processId?: number,
    expectedModel?: string | null,
  ): Promise<{
    ready: boolean;
    message: string | null;
    diagnostics: Record<string, unknown> | null;
  }> {
    return this.surfaceSupport.probeConversationSurface(processId, expectedModel);
  }

  private async recoverConversationSurface(
    processId?: number,
    expectedModel?: string | null,
  ): Promise<{
    ready: boolean;
    message: string | null;
    diagnostics: Record<string, unknown> | null;
  }> {
    return this.surfaceSupport.recoverConversationSurface(processId, expectedModel);
  }

  private delay(ms: number): Promise<void> {
    return this.surfaceSupport.delay(ms);
  }
}
