import { config } from '../../config/index.js';
import type { ZavorthBridgeCompanionBridge } from '../../agents/ZavorthBridgeCompanionBridge.js';
import type { ZavorthBridgeUiSnapshot } from '../ZavorthBridgeUiCaptureService.js';
import {
  normalizeZavorthBridgeUiText,
  sanitizeZavorthBridgeUiResponse,
} from '../ZavorthBridgeUiResponseHeuristics.js';
import type { ZavorthBridgePromptStartResult } from '../ZavorthBridgePromptService.js';
import { logger } from '../../logger.js';

export class ZavorthBridgePromptSurfaceSupport {
  constructor(private readonly host: any) {}

  public async tryCaptureUiState(
    start: ZavorthBridgePromptStartResult,
  ): Promise<ZavorthBridgeUiSnapshot | null> {
    try {
      return await this.host.uiCaptureService.captureLatestResponse({
        taskId: start.taskId,
        processId: start.processId || undefined,
        windowTitle: start.windowTitle || config.zavorthBridgeWindowTitle,
        expectedModel: start.selectedModel,
      });
    } catch (error: unknown) {
      this.host.logRepo.log(
        'warn',
        'ZavorthBridgePromptService',
        `Falha ao capturar a UI do ZavorthBridge para ${start.taskId}: ${error.message}`,
      );
      return null;
    }
  }

  public normalizeVisibleResponse(value: string | null | undefined): string {
    return normalizeZavorthBridgeUiText(value);
  }

  public sanitizeCapturedResponse(value: string | null | undefined, promptText: string | null | undefined): string {
    return sanitizeZavorthBridgeUiResponse(value, promptText);
  }

  public async waitForFreshBridgeStatus(
    notBeforeMs: number,
    timeoutMs: number,
  ): Promise<Awaited<ReturnType<ZavorthBridgeCompanionBridge['readStatus']>>> {
    const startedAt = Date.now();
    let lastStatus = await this.host.bridge.readStatus().catch(() => null);

    while (Date.now() - startedAt < timeoutMs) {
      const status = await this.host.bridge.readStatus().catch(() => null);
      if (status?.updatedAt) {
        const updatedAtMs = Date.parse(String(status.updatedAt));
        if (Number.isFinite(updatedAtMs) && updatedAtMs >= notBeforeMs) {
          return status;
        }
      }

      if (status) {
        lastStatus = status;
      }

      await this.host.delay(750);
    }

    return lastStatus;
  }

  public async ensureConversationSurfaceVisible(options: {
    taskId?: string;
    targetInstanceId?: string;
    processId?: number | null;
    expectedModel?: string | null;
    phase: 'send' | 'capture';
  }): Promise<{
    ready: boolean;
    message: string | null;
    diagnostics: Record<string, any> | null;
  }> {
    const initialProbe = await this.host.probeConversationSurface(options.processId || undefined, options.expectedModel);
    if (initialProbe.ready) {
      return initialProbe;
    }

    const initialRecovery = await this.host.recoverConversationSurface(options.processId || undefined, options.expectedModel);
    if (initialRecovery.ready) {
      return initialRecovery;
    }

    if (!(await this.host.bridge.isOnline())) {
      return initialRecovery;
    }

    const sequences: string[][] = [];
    if (
      options.phase === 'send' &&
      config.zavorthBridgeStartNewConversationPerTask &&
      (await this.host.bridge.supports('canStartNewConversation'))
    ) {
      sequences.push(['zavorthBridge.startNewConversation']);
    } else {
      sequences.push(['zavorthBridge.openAgent']);
    }

    sequences.push([
      'zavorthBridge.agentSidePanel.open',
      'zavorthBridge.agentSidePanel.focus',
      'zavorthBridge.agentSidePanel.expandView',
    ]);
    sequences.push(['zavorthBridge.switchBetweenWorkspaceAndAgent']);
    sequences.push(['zavorthBridge.toggleChatFocus']);
    sequences.push([
      'zavorthBridge.openAgent',
      'zavorthBridge.agentSidePanel.open',
      'zavorthBridge.agentSidePanel.focus',
      'zavorthBridge.agentSidePanel.expandView',
      'zavorthBridge.switchBetweenWorkspaceAndAgent',
      'zavorthBridge.toggleChatFocus',
    ]);

    let lastProbe = initialRecovery;
    for (const commands of sequences) {
      for (const command of commands) {
        await this.host.bridge.executeCommand(command, [], options.taskId, 5000, options.targetInstanceId).catch(() => undefined);
      }

      await this.host.delay(500);
      lastProbe = await this.host.recoverConversationSurface(options.processId || undefined, options.expectedModel);
      if (lastProbe.ready) {
        return lastProbe;
      }
    }

    return lastProbe;
  }

  public async probeConversationSurface(
    processId?: number,
    expectedModel?: string | null,
  ): Promise<{
    ready: boolean;
    message: string | null;
    diagnostics: Record<string, any> | null;
  }> {
    try {
      const probeResult = await this.host.automator.probeSurface(0, processId || 0);
      const diagnostics = this.host.asDiagnostics(probeResult.diagnostics) || {};
      const visibleModel = String(diagnostics.matchedText || diagnostics.activeModelButton || '').trim() || null;
      const homeScreen = diagnostics.homeScreenBefore === true || diagnostics.homeScreenAfter === true;
      const modelMatches = !expectedModel || visibleModel === expectedModel;
      const ready = Boolean(probeResult.verified) && !homeScreen && modelMatches;

      return {
        ready,
        message: probeResult.message || null,
        diagnostics: {
          ...diagnostics,
          visibleModel,
          modelMatches,
          homeScreen,
          promptSurfaceReady: ready,
        },
      };
    } catch (error: unknown) {
      logger.warn('[Zavorth Bridge Prompt Surface] operation failed', error);
    return {
        ready: false,
        message: error.message,
        diagnostics: {
          probeError: error.message,
        },
      };
  }
  }

  public async recoverConversationSurface(
    processId?: number,
    expectedModel?: string | null,
  ): Promise<{
    ready: boolean;
    message: string | null;
    diagnostics: Record<string, any> | null;
  }> {
    try {
      const recoveryResult = await this.host.automator.ensureConversationSurface(0, processId || 0);
      const diagnostics = this.host.asDiagnostics(recoveryResult.diagnostics) || {};
      const visibleModel = String(diagnostics.matchedText || diagnostics.activeModelButton || '').trim() || null;
      const homeScreen = diagnostics.homeScreenAfter === true || diagnostics.homeScreenBefore === true;
      const modelMatches = !expectedModel || visibleModel === expectedModel;
      const ready = Boolean(recoveryResult.verified) && !homeScreen && modelMatches;

      return {
        ready,
        message: recoveryResult.message || null,
        diagnostics: {
          ...diagnostics,
          visibleModel,
          modelMatches,
          homeScreen,
          promptSurfaceReady: ready,
          recoveryAttempted: true,
        },
      };
    } catch (error: unknown) {
      logger.warn('[Zavorth Bridge Prompt Surface] operation failed', error);
    return {
        ready: false,
        message: error.message,
        diagnostics: {
          recoveryError: error.message,
        },
      };
  }
  }

  public delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
