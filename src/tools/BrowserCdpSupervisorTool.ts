/**
 * BrowserCdpSupervisorTool — Tool wrapper for browser CDP control.
 *
 * Exposes BrowserCdpSupervisor functionality through the tool registry,
 * allowing the agent to control browsers via Chrome DevTools Protocol.
 *
 * Actions: connect, disconnect, navigate, evaluate, screenshot, getFrames, getConsoleLog
 */

import { BaseTool } from './BaseTool.js';
import { BrowserCdpSupervisor, type DialogPolicy } from '../tools/BrowserCdpSupervisor.js';

export class BrowserCdpSupervisorTool extends BaseTool {
  public readonly name = 'browser_cdp_control';
  public readonly description = 'Control browser via CDP WebSocket. Actions: connect, disconnect, navigate, evaluate, screenshot, frames, console, setDialogPolicy, respondDialog';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['connect', 'disconnect', 'navigate', 'evaluate', 'screenshot', 'frames', 'console', 'setDialogPolicy', 'respondDialog'],
        description: 'Action to perform.',
      },
      wsEndpoint: {
        type: 'string',
        description: 'WebSocket endpoint for browser connection (required for connect).',
      },
      url: {
        type: 'string',
        description: 'URL to navigate to (for navigate action).',
      },
      expression: {
        type: 'string',
        description: 'JavaScript expression to evaluate (for evaluate action).',
      },
      policy: {
        type: 'string',
        enum: ['must_respond', 'auto_dismiss', 'auto_accept'],
        description: 'Dialog handling policy (for setDialogPolicy action).',
      },
      accept: {
        type: 'boolean',
        description: 'Whether to accept the dialog (for respondDialog action).',
      },
      promptResponse: {
        type: 'string',
        description: 'Response for prompt dialogs (for respondDialog action).',
      },
      format: {
        type: 'string',
        enum: ['png', 'jpeg'],
        description: 'Screenshot format (default: png).',
      },
      limit: {
        type: 'number',
        description: 'Max entries for console log (default: 100).',
      },
    },
    required: ['action'],
  };

  private supervisor: BrowserCdpSupervisor | null = null;

  async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');

    switch (action) {
      case 'connect': {
        const wsEndpoint = String(args.wsEndpoint || '');
        if (!wsEndpoint) return 'Error: wsEndpoint is required for connect action.';

        this.supervisor = new BrowserCdpSupervisor({ browserWSEndpoint: wsEndpoint });
        await this.supervisor.connect();
        return 'Connected to browser.';
      }

      case 'disconnect': {
        if (!this.supervisor) return 'Error: No active connection.';
        await this.supervisor.disconnect();
        this.supervisor = null;
        return 'Disconnected from browser.';
      }

      case 'navigate': {
        if (!this.supervisor) return 'Error: No active connection. Connect first.';
        const url = String(args.url || '');
        if (!url) return 'Error: url is required for navigate action.';
        await this.supervisor.navigate(url);
        return `Navigated to ${url}`;
      }

      case 'evaluate': {
        if (!this.supervisor) return 'Error: No active connection. Connect first.';
        const expression = String(args.expression || '');
        if (!expression) return 'Error: expression is required for evaluate action.';
        const result = await this.supervisor.evaluate(expression);
        return `Result: ${JSON.stringify(result)}`;
      }

      case 'screenshot': {
        if (!this.supervisor) return 'Error: No active connection. Connect first.';
        const format = String(args.format || 'png') as 'png' | 'jpeg';
        const data = await this.supervisor.screenshot({ format });
        return `Screenshot captured (${data.length} base64 chars). Format: ${format}`;
      }

      case 'frames': {
        if (!this.supervisor) return 'Error: No active connection. Connect first.';
        const frames = this.supervisor.getFrames();
        if (frames.length === 0) return 'No frames tracked.';
        return frames.map((f) => `${f.id}: ${f.url}`).join('\n');
      }

      case 'console': {
        if (!this.supervisor) return 'Error: No active connection. Connect first.';
        const limit = Number(args.limit) || 100;
        const log = this.supervisor.getConsoleLog(limit);
        if (log.length === 0) return 'No console entries.';
        return log.map((e) => `[${e.type}] ${e.text}`).join('\n');
      }

      case 'setDialogPolicy': {
        if (!this.supervisor) return 'Error: No active connection. Connect first.';
        const policy = String(args.policy || 'auto_dismiss') as DialogPolicy;
        this.supervisor.setDialogPolicy(policy);
        return `Dialog policy set to: ${policy}`;
      }

      case 'respondDialog': {
        if (!this.supervisor) return 'Error: No active connection. Connect first.';
        const pending = this.supervisor.getPendingDialogs();
        if (pending.length === 0) return 'No pending dialogs.';
        const accept = args.accept !== false;
        const promptResponse = args.promptResponse ? String(args.promptResponse) : undefined;
        await this.supervisor.respondToDialog(pending[0], accept, promptResponse);
        this.supervisor.clearDialogQueue();
        return `Dialog responded: ${accept ? 'accepted' : 'dismissed'}`;
      }

      default:
        return `Unknown action: ${action}. Valid actions: connect, disconnect, navigate, evaluate, screenshot, frames, console, setDialogPolicy, respondDialog`;
    }
  }
}
