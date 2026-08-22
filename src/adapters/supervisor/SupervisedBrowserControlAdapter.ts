import { AutomaticBrowserTool } from '../../mcp/tools/AutomaticBrowserTool.js';
import type {
  SystemOverlordAdapterResult,
  SystemOverlordRuntimeAdapter,
} from '../../contracts/SystemOverlordAdapterContract.js';
import type {
  SystemOverlordActionRequest,
  SystemOverlordCapabilityDecision,
} from '../../contracts/SystemOverlordContract.js';
import { readStructuredInput, stringField } from './SupervisedAdapterInput.js';
type BrowserToolLike = Pick<AutomaticBrowserTool, 'handleToolCall'>;

const BROWSER_ACTION_TO_TOOL: Record<string, string> = {
  navigate: 'browser_navigate',
  browser_navigate: 'browser_navigate',
  inspect: 'inspect_dom_element',
  inspect_dom_element: 'inspect_dom_element',
  evaluate_js: 'evaluate_js',
  evaluate: 'evaluate_js',
};

export class SupervisedBrowserControlAdapter implements SystemOverlordRuntimeAdapter {
  public readonly id = 'browser-control-supervised';
  public readonly label = 'Browser Control Supervision Adapter';
  private readonly tool: BrowserToolLike;

  constructor(options: { browserTool?: BrowserToolLike } = {}) {
    this.tool = options.browserTool || new AutomaticBrowserTool();
  }

  public canHandle(
    request: SystemOverlordActionRequest,
    decision: SystemOverlordCapabilityDecision,
  ): boolean {
    return request.capability === 'browser.control' && decision.runtimeTarget === 'browser';
  }

  public async execute(
    request: SystemOverlordActionRequest,
    decision: SystemOverlordCapabilityDecision,
  ): Promise<SystemOverlordAdapterResult> {
    const input = readStructuredInput(request.command, request.metadata || null);
    const action = stringField(input, 'action', 'browserAction');
    const toolName = BROWSER_ACTION_TO_TOOL[action] || '';
    if (!toolName) {
      return {
        ok: false,
        errorCode: 'browser_action_rejected',
        errorMessage: `Invalid or unsupervised browser action: "${action || 'n/a'}".`,
      };
    }

    if (toolName === 'browser_navigate') {
      const url = stringField(input, 'url', 'href');
      const validationError = this.validateUrl(url);
      if (validationError) {
        return {
          ok: false,
          errorCode: 'browser_url_rejected',
          errorMessage: validationError,
        };
      }
      return this.callTool(toolName, { url }, decision);
    }

    if (toolName === 'inspect_dom_element') {
      const selector = stringField(input, 'selector');
      if (!selector) {
        return {
          ok: false,
          errorCode: 'browser_selector_required',
          errorMessage: 'inspect_dom_element requires selector.',
        };
      }
      return this.callTool(toolName, { selector }, decision);
    }

    const script = stringField(input, 'script', 'js');
    if (!this.canEvaluateJs(request, script)) {
      return {
        ok: false,
        errorCode: 'browser_evaluate_js_blocked',
        errorMessage: 'evaluate_js requires owner profile, approved=true, and metadata.allowEvaluateJs=true.',
      };
    }
    return this.callTool(toolName, { script }, decision);
  }

  private async callTool(
    toolName: string,
    args: Record<string, unknown>,
    decision: SystemOverlordCapabilityDecision,
  ): Promise<SystemOverlordAdapterResult> {
    const response = await this.tool.handleToolCall(toolName, args);
    const text = (response.content || []).map((entry: Record<string, unknown>) => String(entry.text || '')).filter(Boolean).join('\n');
    const ok = response.isError !== true;

    return {
      ok,
      stdout: ok ? text : null,
      stderr: ok ? null : text,
      errorCode: ok ? null : 'browser_tool_failed',
      errorMessage: ok ? null : text,
      rollbackAvailable: false,
      metadata: {
        adapterId: this.id,
        toolName,
        args,
        runtimeTarget: decision.runtimeTarget,
      },
    };
  }

  private validateUrl(url: string): string | null {
    if (!url) {
      return 'browser_navigate requires url.';
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return 'browser_navigate accepts only http/https URLs.';
      }
      return null;
    } catch (error: unknown) {return `Invalid URL for browser_navigate: "${url}".`;
    }
  }

  private canEvaluateJs(request: SystemOverlordActionRequest, script: string): boolean {
    if (!script || script.length > 4000) {
      return false;
    }
    const profile = String(request.profile || '').trim().toLowerCase();
    const metadata = request.metadata || {};
    return profile === 'owner' && request.approved === true && metadata.allowEvaluateJs === true;
  }
}
