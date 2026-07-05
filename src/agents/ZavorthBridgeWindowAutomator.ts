import { execFile } from 'child_process';
import { config } from '../config/index.js';
import { PendingZavorthBridgeSession } from '../orchestrator/AgentBridgeManager.js';

type AutomationMode =
  | 'focus'
  | 'approve-visible-step'
  | 'approve-visible-step-once'
  | 'approve-visible-step-conversation'
  | 'reject-visible-step'
  | 'read-latest-response'
  | 'paste-and-submit'
  | 'switch-model'
  | 'verify-model'
  | 'probe-surface'
  | 'ensure-conversation-surface'
  | 'reset-visible-conversation';

export type ZavorthBridgeApprovalMode = 'once' | 'conversation';

export type AutomationDiagnostics = {
  foundModelButton?: boolean;
  sentCtrlE?: boolean;
  clickedElementName?: string | null;
  clickedTargetElementName?: string | null;
  homeScreenBefore?: boolean | null;
  homeScreenAfter?: boolean | null;
  hasInputBar?: boolean;
  promptSurfaceReady?: boolean;
  activeModelButton?: string | null;
  verified?: boolean;
  verifyMethod?: string | null;
  matchedText?: string | null;
};

type AutomationResult = {
  ok: boolean;
  mode: AutomationMode;
  windowTitle: string;
  pid?: number;
  textLength: number;
  message?: string;
  verified?: boolean;
  diagnostics?: AutomationDiagnostics;
};

export type ZavorthBridgeUiReadState = {
  ok: boolean;
  status?: string;
  hasPermissionPrompt?: boolean;
  hasInputBar?: boolean;
  visibleModel?: string | null;
  responseText?: string | null;
  confidence?: number;
  notes?: string | null;
};

export type ZavorthBridgeAutomationResult = AutomationResult;

export class ZavorthBridgeWindowAutomator {
  public async focusWindow(initialDelayMs = 0, processId = 0): Promise<AutomationResult> {
    return this.run('focus', '', initialDelayMs, processId);
  }

  public async approveVisibleStep(
    initialDelayMs = 0,
    approvalMode: ZavorthBridgeApprovalMode = 'once',
    processId = 0,
  ): Promise<AutomationResult> {
    const mode: AutomationMode =
      approvalMode === 'conversation'
        ? 'approve-visible-step-conversation'
        : 'approve-visible-step-once';

    return this.run(mode, '', initialDelayMs, processId);
  }

  public async rejectVisibleStep(initialDelayMs = 0, processId = 0): Promise<AutomationResult> {
    return this.run('reject-visible-step', '', initialDelayMs, processId);
  }

  public async readLatestResponse(initialDelayMs = 0, processId = 0): Promise<ZavorthBridgeUiReadState> {
    const result = await this.run('read-latest-response', '', initialDelayMs, processId);
    try {
      return JSON.parse(String(result.message || '').trim()) as ZavorthBridgeUiReadState;
    } catch (error: any) {
      throw new Error(`Failed to parse ZavorthBridge UI state: ${error.message}`);
    }
  }

  public async waitForPermissionPromptToClear(
    processId = 0,
    attempts = 4,
    delayMs = 350,
  ): Promise<boolean> {
    let sawSuccessfulProbe = false;

    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const snapshot = await this.readLatestResponse(0, processId).catch(() => null);
      if (!snapshot?.ok) {
        continue;
      }

      sawSuccessfulProbe = true;
      if (!snapshot.hasPermissionPrompt) {
        return true;
      }
    }

    if (!sawSuccessfulProbe) {
      throw new Error('Could not verify that ZavorthBridge actually accepted the permission.');
    }

    return false;
  }

  public async pasteAndSubmit(text: string, initialDelayMs = 0, processId = 0): Promise<AutomationResult> {
    return this.run('paste-and-submit', text, initialDelayMs, processId);
  }

  public async verifyModel(expectedModel: string, initialDelayMs = 0, processId = 0): Promise<AutomationResult> {
    return this.run('verify-model', expectedModel, initialDelayMs, processId);
  }

  public async switchModel(modelName: string, initialDelayMs = 0, processId = 0): Promise<AutomationResult> {
    return this.run('switch-model', modelName, initialDelayMs, processId);
  }

  public async probeSurface(initialDelayMs = 0, processId = 0): Promise<AutomationResult> {
    return this.run('probe-surface', '', initialDelayMs, processId);
  }

  public async ensureConversationSurface(initialDelayMs = 0, processId = 0): Promise<AutomationResult> {
    return this.run('ensure-conversation-surface', '', initialDelayMs, processId);
  }

  public async resetVisibleConversation(initialDelayMs = 0, processId = 0): Promise<AutomationResult> {
    return this.run('reset-visible-conversation', '', initialDelayMs, processId);
  }

  public async sendRecoveryPrompt(
    session: PendingZavorthBridgeSession,
    reason: 'stalled' | 'log_error',
    initialDelayMs = 0,
  ): Promise<AutomationResult> {
    const recoveryPrompt = this.buildRecoveryPrompt(session, reason);
    return this.run('paste-and-submit', recoveryPrompt, initialDelayMs);
  }

  private buildRecoveryPrompt(session: PendingZavorthBridgeSession, reason: 'stalled' | 'log_error'): string {
    const header =
      reason === 'log_error'
        ? 'Recover from the last ZavorthBridge internal error and continue the current Zavorth task.'
        : 'Continue the current Zavorth task and avoid waiting for additional user input.';

    return [
      `[ZAVORTH_AUTOMATION for ${session.taskId}]`,
      header,
      `Correlation token: ZAVORTH_TASK_ID:${session.taskId}`,
      `Workspace: ${session.workspace}`,
      'Keep updating your native task, implementation plan, and walkthrough artifacts.',
      'If a final answer is ready, summarize it concisely and finish the task.',
    ].join('\n');
  }

  private run(mode: AutomationMode, text: string, initialDelayMs: number, processId = 0): Promise<AutomationResult> {
    return new Promise((resolve, reject) => {
      const powershellPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
      const args = [
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        config.zavorthBridgeUiScriptPath,
        '-Mode',
        mode,
        '-WindowTitle',
        config.zavorthBridgeWindowTitle,
        '-InitialDelayMs',
        String(initialDelayMs),
      ];

      if (processId > 0) {
        args.push('-ProcessId', String(processId));
      }

      if (text) {
        args.push('-Text', text);
      }

      execFile(
        powershellPath,
        args,
        {
          windowsHide: true,
          maxBuffer: 1024 * 1024,
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr?.trim() || error.message));
            return;
          }

          try {
            const parsed = JSON.parse(stdout.trim()) as AutomationResult;
            resolve(parsed);
          } catch (parseError: any) {
            reject(new Error(`Failed to parse ZavorthBridge automation result: ${parseError.message}`));
          }
        },
      );
    });
  }

  public captureWindow(outputPath: string, processId = 0): Promise<boolean> {
    return new Promise((resolve) => {
      const powershellPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
      const scriptPath = require('path').join(process.cwd(), 'scripts', 'zavorth-bridge-window-capture.ps1');
      const args = [
        '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath,
        '-OutputPath', outputPath,
        '-WindowTitle', config.zavorthBridgeWindowTitle,
      ];
      
      if (processId > 0) {
        args.push('-ProcessId', String(processId));
      }

      execFile(powershellPath, args, { windowsHide: true }, (error, stdout) => {
        if (error) {
          return resolve(false);
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          resolve(parsed.ok === true);
        } catch(e) {
          resolve(false);
        }
      });
    });
  }
}
