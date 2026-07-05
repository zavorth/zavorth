import { BaseTool } from './BaseTool.js';
import { execFile } from 'child_process';
import { config } from '../config/index.js';
import path from 'path';
import fs from 'fs';
import { decideSecurityPolicy, formatSecurityPolicyReceipt } from '../security/SecurityPolicyBroker.js';
import { logger } from '../logger.js';

type DesktopAutomationResult = {
  ok: boolean;
  action: string;
  windowTitle: string | null;
  pid: number | null;
  message: string | null;
  details: Record<string, unknown> | null;
};

const BLOCKED_WINDOW_TITLE_PATTERNS = [
  /\bexecutar\b/i,
  /\brun\b/i,
  /\bwindows\s+power\s*shell\b/i,
  /\bpowershell\b/i,
  /\bpwsh\b/i,
  /\bprompt\s+de\s+comando\b/i,
  /\bcommand\s+prompt\b/i,
  /\bcmd(?:\.exe)?\b/i,
  /\bwindows\s+terminal\b/i,
  /\bterminal\b/i,
  /\bconhost\b/i,
  /\bwsl\b/i,
  /\bbash\b/i,
];

const BLOCKED_PRESS_KEY_PATTERNS = [
  /\bwin(?:dows)?\s*\+\s*r\b/i,
  /\{(?:lwin|rwin|win|windows)\}/i,
  /#\s*r/i,
  /^\s*\^\s*\{?esc(?:ape)?\}?\s*$/i,
];

/**
 * Native Windows "Computer Use" desktop automation tool.
 *
 * Allows the LLM agent to control desktop applications through the
 * Windows UIAutomation API (System.Windows.Automation).
 *
 * Capabilities:
 *  - Focus windows by title or PID.
 *  - Click buttons, tabs, and elements by visible Accessibility Tree text.
 *  - Type text through clipboard injection.
 *  - Send keys/shortcuts such as Enter, Tab, Ctrl+S, and Alt+F4.
 *  - Capture screenshots of specific windows.
 *  - List visible window elements for recognition.
 *
 * Security:
 *  - Inherits RemoteShellTool permission semantics.
 *  - Does not install external dependencies; it uses PowerShell and native .NET.
 */
export class DesktopAutomationTool extends BaseTool {
  public readonly name = 'desktop_automation';
  public readonly description =
    'Controls Windows desktop applications through the native UI Automation API. ' +
    'Can focus windows, click buttons/tabs by text, type text, send keyboard shortcuts, ' +
    'capture window screenshots, and list visible elements. Use "list-elements" first to discover ' +
    'available button names before clicking. Use "screenshot" to visually verify state.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['focus-window', 'click-element', 'type-text', 'press-key', 'screenshot', 'list-elements'],
        description:
          'Action to execute. ' +
          '"focus-window": brings the window forward. ' +
          '"click-element": clicks an element by visible text (requires targetText). ' +
          '"type-text": pastes text into the active window (requires payload). ' +
          '"press-key": sends a key/shortcut (requires payload in SendKeys format, for example "{ENTER}", "^s", "%{F4}"). ' +
          '"screenshot": captures a window screenshot. ' +
          '"list-elements": lists up to 60 visible window elements to discover button names.',
      },
      windowTitle: {
        type: 'string',
        description:
          'Title, or part of the title, of the target window. Examples: "Calculator", "Spotify", "Chrome", "Notepad".',
      },
      targetText: {
        type: 'string',
        description:
          'Visible text of the element to click for action "click-element". ' +
          'Examples: "8", "Equals", "File", "New Tab". Use "list-elements" to discover names.',
      },
      payload: {
        type: 'string',
        description:
          'For "type-text": text to paste. For "press-key": key in SendKeys format ' +
          '(examples: "{ENTER}", "{TAB}", "^s" for Ctrl+S, "%{F4}" for Alt+F4, "^c" for Ctrl+C).',
      },
      processId: {
        type: 'number',
        description: 'Target process PID. Optional alternative to windowTitle.',
      },
    },
    required: ['action'],
    anyOf: [
      { required: ['windowTitle'] },
      { required: ['processId'] },
    ],
  };

  private readonly scriptPath: string;

  constructor() {
    super();
    this.scriptPath = path.resolve(config.projectRoot, 'scripts', 'desktop-automation.ps1');
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '').trim();
    const windowTitle = String(args.windowTitle || '').trim();
    const targetText = String(args.targetText || '').trim();
    const payload = String(args.payload || '').trim();
    const processId = Number(args.processId) || 0;

    if (!action) {
      return 'Error: the "action" parameter is required.';
    }

    if (!windowTitle && !processId) {
      return 'Error: provide "windowTitle" or "processId" to identify the target window.';
    }

    const safetyError = this.validateUiSafety(action, windowTitle, payload);
    if (safetyError) {
      return `Error: ${safetyError}`;
    }

    if (!fs.existsSync(this.scriptPath)) {
      return `Error: automation script not found at "${this.scriptPath}".`;
    }

    let outputPath = '';
    if (action === 'screenshot') {
      const captureDir = path.resolve(config.projectRoot, 'data', 'desktop-captures');
      fs.mkdirSync(captureDir, { recursive: true });
      outputPath = path.join(captureDir, `capture-${Date.now()}.png`);
    }

    try {
      const result = await this.runScript(action, windowTitle, targetText, payload, processId, outputPath);

      if (!result.ok) {
        return `Automation error: ${result.message || 'Unknown failure.'}`;
      }

      let response = result.message || 'Action executed successfully.';

      if (action === 'screenshot' && result.details) {
        const details = result.details as { screenshotPath?: string; width?: number; height?: number };
        response += `\nScreenshot: ${details.screenshotPath} (${details.width}x${details.height}px)`;
      }

      if (action === 'list-elements' && result.details) {
        const details = result.details as { elementCount?: number; elements?: Array<{ name: string; type: string }> };
        if (details.elements && details.elements.length > 0) {
          const elementList = details.elements
            .map((el) => `  - "${el.name}" (${el.type})`)
            .join('\n');
          response += `\nFound elements:\n${elementList}`;
        }
      }

      if (action === 'click-element' && result.details) {
        const details = result.details as { elementName?: string; controlType?: string };
        response += `\nElement: "${details.elementName}" (${details.controlType})`;
      }

      return response;
    } catch (error) {
    logger.warn('[Desktop Automation] string operation failed', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error while running desktop automation: ${errorMessage}`;
  }
  }

  private runScript(
    action: string,
    windowTitle: string,
    targetText: string,
    payload: string,
    processId: number,
    outputPath: string,
  ): Promise<DesktopAutomationResult> {
    return new Promise((resolve, reject) => {
      const powershellPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
      const args: string[] = [
        '-ExecutionPolicy', 'Bypass',
        '-File', this.scriptPath,
        '-Action', action,
      ];

      if (windowTitle) {
        args.push('-WindowTitle', windowTitle);
      }

      if (processId > 0) {
        args.push('-ProcessId', String(processId));
      }

      if (targetText) {
        args.push('-TargetText', targetText);
      }

      if (payload) {
        args.push('-Payload', payload);
      }

      if (outputPath) {
        args.push('-OutputPath', outputPath);
      }

      execFile(
        powershellPath,
        args,
        {
          windowsHide: true,
          maxBuffer: 1024 * 1024 * 2,
          timeout: 30000,
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr?.trim() || error.message));
            return;
          }

          try {
            const parsed = JSON.parse(stdout.trim()) as DesktopAutomationResult;
            resolve(parsed);
          } catch (parseError: unknown) {
            const msg = parseError instanceof Error ? parseError.message : String(parseError);
            reject(new Error(`Failed to parse script response: ${msg}`));
          }
        },
      );
    });
  }

  private validateUiSafety(action: string, windowTitle: string, payload: string): string | null {
    if (windowTitle && BLOCKED_WINDOW_TITLE_PATTERNS.some((pattern) => pattern.test(windowTitle))) {
      const decision = decideSecurityPolicy({
        surface: 'desktop-automation',
        operation: action,
        target: windowTitle,
        blocked: true,
        risk: 'forbidden',
        rule: 'DESKTOP_SENSITIVE_WINDOW_BLOCKED',
        reasons: [`Sensitive window or console cannot be targeted ("${windowTitle}").`],
      });
      return `Desktop automation blocked: sensitive window or console cannot be targeted ("${windowTitle}"). ${formatSecurityPolicyReceipt(decision.receipt)}`;
    }

    if (action === 'press-key' && payload && BLOCKED_PRESS_KEY_PATTERNS.some((pattern) => pattern.test(payload))) {
      const decision = decideSecurityPolicy({
        surface: 'desktop-automation',
        operation: action,
        target: payload,
        blocked: true,
        risk: 'forbidden',
        rule: 'DESKTOP_SHELL_LAUNCHER_SHORTCUT_BLOCKED',
        reasons: ['Launcher/shell shortcut is not allowed.'],
      });
      return `Desktop automation blocked: launcher/shell shortcut is not allowed. ${formatSecurityPolicyReceipt(decision.receipt)}`;
    }

    decideSecurityPolicy({
      surface: 'desktop-automation',
      operation: action,
      target: windowTitle || payload || 'active-window',
      rule: 'DESKTOP_UI_ACTION_ALLOWED',
      reasons: ['The desktop automation action passed the central UI safety filter.'],
    });

    return null;
  }
}
