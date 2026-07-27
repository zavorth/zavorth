import { RuntimeIsolationGuardService } from '../../services/RuntimeIsolationGuardService.js';
import {
  RuntimeBrowserSidecarService,
  type RuntimeBrowserSidecarAction,
} from '../../services/RuntimeBrowserSidecarService.js';
import { asErrorLike } from '../../utils/errorLike';
import { assertPublicHttpTargetAllowed } from '../../ai-gateway/lib/security/egressGuard.js';
import {
  extractToolSecurityApprovalEnvelope,
  verifyToolSecurityApprovalEnvelope,
} from '../../security/ToolApprovalEnvelope.js';

type McpToolContent = {
  type: 'text';
  text: string;
};

type McpToolCallResponse = {
  content: McpToolContent[];
  isError?: boolean;
};

type PlaywrightPageLike = {
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  title(): Promise<string>;
  url(): string;
  screenshot?(options?: Record<string, unknown>): Promise<Buffer | Uint8Array | string>;
  locator(selector: string): {
    count(): Promise<number>;
    first(): {
      evaluate<T>(fn: (element: Element, arg?: unknown) => T | Promise<T>, arg?: unknown): Promise<T>;
      click?(options?: Record<string, unknown>): Promise<void>;
      fill?(value: string, options?: Record<string, unknown>): Promise<void>;
      type?(value: string, options?: Record<string, unknown>): Promise<void>;
    };
  };
  evaluate<T>(fn: (args: Record<string, unknown>) => T | Promise<T>, args: Record<string, unknown>): Promise<T>;
  close?(): Promise<void>;
};

type PlaywrightContextLike = {
  newPage(): Promise<PlaywrightPageLike>;
  route?(
    pattern: string,
    handler: (route: {
      request(): { url(): string };
      continue(): Promise<void>;
      abort(errorCode?: string): Promise<void>;
    }) => Promise<void>,
  ): Promise<void>;
  close?(): Promise<void>;
};

type PlaywrightBrowserLike = {
  newContext(): Promise<PlaywrightContextLike>;
  close?(): Promise<void>;
};

type PlaywrightModuleLike = {
  chromium?: {
    launch(options?: Record<string, unknown>): Promise<PlaywrightBrowserLike>;
  };
};

type AutomaticBrowserToolOptions = {
  loadPlaywright?: () => Promise<PlaywrightModuleLike> | PlaywrightModuleLike;
  launchOptions?: Record<string, unknown>;
  isolationGuard?: RuntimeIsolationGuardService;
  browserSidecar?: Pick<RuntimeBrowserSidecarService, 'execute' | 'isConfigured'> | null;
  validateNavigationUrl?: (url: string) => Promise<URL>;
};

export type AutomaticBrowserDoctorReport = {
  checkedAt: string;
  ok: boolean;
  moduleName: string | null;
  moduleAvailable: boolean;
  launchable: boolean;
  error: string | null;
  recommendations: string[];
};

type LoadedPlaywrightModule = {
  moduleName: string;
  playwright: PlaywrightModuleLike;
};

export class AutomaticBrowserTool {
  private browser: PlaywrightBrowserLike | null = null;
  private context: PlaywrightContextLike | null = null;
  private page: PlaywrightPageLike | null = null;
  private readonly isolationGuard: RuntimeIsolationGuardService;
  private readonly browserSidecar: Pick<RuntimeBrowserSidecarService, 'execute' | 'isConfigured'> | null;

  constructor(private readonly options: AutomaticBrowserToolOptions = {}) {
    this.isolationGuard = options.isolationGuard || new RuntimeIsolationGuardService();
    this.browserSidecar = options.browserSidecar === null
      ? null
      : options.browserSidecar || new RuntimeBrowserSidecarService();
  }

  public getToolDefinitions() {
    return [
      {
        name: 'browser_navigate',
        description: 'Navigates an embedded MCP headless browser to a specific URL.',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The absolute URL to navigate to.' },
          },
          required: ['url'],
        },
      },
      {
        name: 'browser_search',
        description: 'Navigates directly to a search results page on Google, YouTube or GitHub.',
        inputSchema: {
          type: 'object',
          properties: {
            engine: { type: 'string', description: 'Search engine: google, youtube or github.' },
            query: { type: 'string', description: 'Search query.' },
          },
          required: ['engine', 'query'],
        },
      },
      {
        name: 'inspect_dom_element',
        description: 'Inspects a DOM element using a CSS selector.',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS Selector to extract outerHTML.' },
          },
          required: ['selector'],
        },
      },
      {
        name: 'evaluate_js',
        description: 'Evaluates javascript code on the current active page.',
        inputSchema: {
          type: 'object',
          properties: {
            script: { type: 'string', description: 'JavaScript content to evaluate.' },
          },
          required: ['script'],
        },
      },
      {
        name: 'browser_screenshot',
        description: 'Captures a screenshot from the current browser page after policy allows visual evidence.',
        inputSchema: {
          type: 'object',
          properties: {
            fullPage: { type: 'boolean', description: 'Whether to capture the full page.' },
          },
          required: [],
        },
      },
      {
        name: 'browser_click',
        description: 'Clicks a CSS selector in the isolated browser after approval policy allows mutation.',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector to click.' },
          },
          required: ['selector'],
        },
      },
      {
        name: 'browser_type',
        description: 'Types text into a CSS selector in the isolated browser after approval policy allows mutation.',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector to type into.' },
            text: { type: 'string', description: 'Text to type.' },
          },
          required: ['selector', 'text'],
        },
      },
      {
        name: 'browser_extract',
        description: 'Extracts visible page text, title and URL from the current browser page.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ];
  }

  public async handleToolCall(name: string, args: Record<string, unknown>): Promise<McpToolCallResponse> {
    try {
      switch (name) {
        case 'browser_navigate':
          return await this.handleNavigate(args);
        case 'browser_search':
          return await this.handleBrowserSearch(args);
        case 'inspect_dom_element':
          return await this.handleInspectDom(args);
        case 'evaluate_js':
          return await this.handleEvaluateJs(args);
        case 'browser_screenshot':
          return await this.handleScreenshot(args);
        case 'browser_click':
          return await this.handleClick(args);
        case 'browser_type':
          return await this.handleType(args);
        case 'browser_extract':
          return await this.handleExtract(args);
        default:
          return this.errorResponse(`Tool ${name} not supported by AutomaticBrowserTool.`);
      }
    } catch (error: unknown) { const err = asErrorLike(error); const e = err;
      return this.errorResponse(
        error instanceof Error ? err.message : String(error),
      );
    }
  }

  public async shutdown(): Promise<void> {
    const page = this.page;
    const context = this.context;
    const browser = this.browser;

    this.page = null;
    this.context = null;
    this.browser = null;

    try {
      await page?.close?.();
    } catch (error: unknown) { const err = asErrorLike(error); const e = err;
      // noop
    }

    try {
      await context?.close?.();
    } catch (error: unknown) { const err = asErrorLike(error); const e = err;
      // noop
    }

    try {
      await browser?.close?.();
    } catch (error: unknown) { const err = asErrorLike(error); const e = err;
      // noop
    }
  }

  public async diagnose(): Promise<AutomaticBrowserDoctorReport> {
    const checkedAt = new Date().toISOString();
    let browser: PlaywrightBrowserLike | null = null;

    try {
      const { moduleName, playwright } = await this.loadPlaywrightModule();
      if (!playwright?.chromium?.launch) {
        return {
          checkedAt,
          ok: false,
          moduleName,
          moduleAvailable: true,
          launchable: false,
          error: 'Playwright module loaded, but chromium.launch is not available.',
          recommendations: [
            'Revise a version provisionada de playwright-core/playwright.',
            'Garanta que a stack de browser expose chromium.launch before habilitar o MCP browser.',
          ],
        };
      }

      try {
        browser = await playwright.chromium.launch({
          headless: true,
          ...this.options.launchOptions,
        });
        return {
          checkedAt,
          ok: true,
          moduleName,
          moduleAvailable: true,
          launchable: true,
          error: null,
          recommendations: [
            'The browser stack is ready for AutomaticBrowserTool.',
          ],
        };
      } catch (error: unknown) { const err = asErrorLike(error); const e = err;
        const message = error instanceof Error ? err.message : String(error);
        return {
          checkedAt,
          ok: false,
          moduleName,
          moduleAvailable: true,
          launchable: false,
          error: message,
          recommendations: this.buildDoctorRecommendations(message),
        };
      }
    } catch (error: unknown) { const err = asErrorLike(error); const e = err;
      const message = error instanceof Error ? err.message : String(error);
      return {
        checkedAt,
        ok: false,
        moduleName: null,
        moduleAvailable: false,
        launchable: false,
        error: message,
        recommendations: this.buildDoctorRecommendations(message),
      };
    } finally {
      try {
        await browser?.close?.();
      } catch (error: unknown) { const err = asErrorLike(error); const e = err;
        // noop
      }
    }
  }

  private async handleNavigate(args: Record<string, unknown>): Promise<McpToolCallResponse> {
    const url = await this.normalizeUrl(args?.url);
    const validatedArgs = { ...args, url };
    const sidecar = await this.tryHandleBrowserSidecar('browser_navigate', validatedArgs);
    if (sidecar) {
      return sidecar;
    }

    const page = await this.ensurePage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const payload = {
      ok: true,
      action: 'navigate',
      url: page.url(),
      title: await page.title(),
    };
    return this.jsonResponse(payload);
  }

  private async handleBrowserSearch(args: Record<string, unknown>): Promise<McpToolCallResponse> {
    const sidecar = await this.tryHandleBrowserSidecar('browser_search', args);
    if (sidecar) {
      return sidecar;
    }

    const engine = String(args?.engine || 'google').trim().toLowerCase();
    const query = String(args?.query || '').trim();
    if (!query) {
      throw new Error('browser_search requires a non-empty query.');
    }

    const url = this.buildSearchUrl(engine, query);
    const result = await this.handleNavigate({ url });
    const payload = JSON.parse(result.content[0]?.text || '{}') as Record<string, unknown>;
    return this.jsonResponse({
      ...payload,
      action: 'browser_search',
      engine,
      query,
    });
  }

  private async handleInspectDom(args: Record<string, unknown>): Promise<McpToolCallResponse> {
    const sidecar = await this.tryHandleBrowserSidecar('inspect_dom_element', args);
    if (sidecar) {
      return sidecar;
    }

    const selector = String(args?.selector || '').trim();
    if (!selector) {
      throw new Error('inspect_dom_element requires a valid CSS selector.');
    }

    const page = this.getActivePage();
    const locator = page.locator(selector);
    const count = await locator.count();
    if (count === 0) {
      throw new Error(`No element found for selector "${selector}".`);
    }

    const details = await locator.first().evaluate((element) => ({
      tagName: element.tagName.toLowerCase(),
      textContent: (element.textContent || '').trim(),
      outerHTML: element.outerHTML,
    }));

    return this.jsonResponse({
      ok: true,
      action: 'inspect_dom_element',
      selector,
      count,
      url: page.url(),
      ...details,
    });
  }

  private async handleEvaluateJs(args: Record<string, unknown>): Promise<McpToolCallResponse> {
    const script = String(args?.script || '').trim();
    if (!script) {
      throw new Error('evaluate_js requires a non-empty JavaScript script.');
    }
    const isolationDecision = this.isolationGuard.guard({
      surface: 'browser',
      action: 'evaluate_js',
      argv: [script],
      requestedMode: args.isolationMode,
      ephemeralAdapterAvailable: false,
      sidecarAvailable: Boolean(this.browserSidecar?.isConfigured()),
    });
    if (!isolationDecision.ok) {
      throw new Error(isolationDecision.reason);
    }
    const recipe = this.resolveSafeEvaluationRecipe(script);
    if (!recipe) {
      if (isolationDecision.mode === 'sidecar') {
        return this.handleBrowserSidecar('evaluate_js', args);
      }
      throw new Error(
        'evaluate_js does not accept arbitrary JavaScript in the local browser. Use a read-only recipe: document.title, location.href, document.body.innerText, document.body.textContent, or document.documentElement.outerHTML. Arbitrary scripts require an isolated browser sidecar.',
      );
    }

    if (isolationDecision.mode === 'sidecar') {
      return this.handleBrowserSidecar('evaluate_js', args);
    }

    const page = this.getActivePage();
    const evaluated = await page.evaluate(({ recipeName }) => {
      const recipes: Record<string, () => unknown> = {
        title: () => document.title,
        href: () => location.href,
        bodyText: () => document.body?.innerText || '',
        bodyTextContent: () => document.body?.textContent || '',
        outerHtml: () => document.documentElement?.outerHTML || '',
      };
      const key = String(recipeName || '');
      const value = recipes[key]?.();
      return {
        kind: Array.isArray(value) ? 'array' : typeof value,
        value,
      };
    }, { recipeName: recipe });

    return this.jsonResponse({
      ok: true,
      action: 'evaluate_js',
      script: recipe,
      url: page.url(),
      result: evaluated,
    });
  }

  private async handleScreenshot(args: Record<string, unknown>): Promise<McpToolCallResponse> {
    const sidecar = await this.tryHandleBrowserSidecar('browser_screenshot', args);
    if (sidecar) {
      return sidecar;
    }

    const page = this.getActivePage();
    if (typeof page.screenshot !== 'function') {
      throw new Error('browser_screenshot requires a Playwright page with screenshot support.');
    }
    const bytes = await page.screenshot({
      fullPage: args.fullPage === true,
      type: 'png',
    });
    const buffer = typeof bytes === 'string' ? Buffer.from(bytes) : Buffer.from(bytes);
    return this.jsonResponse({
      ok: true,
      action: 'browser_screenshot',
      url: page.url(),
      title: await page.title(),
      mimeType: 'image/png',
      bytes: buffer.byteLength,
      imageBase64: buffer.toString('base64'),
      visualReceipt: {
        kind: 'screenshot',
        rawSecretSerialized: false,
        screenshotCaptured: true,
      },
    });
  }

  private async handleClick(args: Record<string, unknown>): Promise<McpToolCallResponse> {
    this.requireMutationApproval(args, 'browser_click');
    const sidecar = await this.tryHandleBrowserSidecar('browser_click', args);
    if (sidecar) {
      return sidecar;
    }

    const selector = this.normalizeSelector(args.selector, 'browser_click');
    const page = this.getActivePage();
    const locator = page.locator(selector);
    const count = await locator.count();
    if (count === 0) {
      throw new Error(`No element found to click for selector "${selector}".`);
    }
    const target = locator.first();
    if (typeof target.click === 'function') {
      await target.click();
    } else {
      await target.evaluate((element) => {
        (element as HTMLElement).click();
      });
    }
    return this.jsonResponse({
      ok: true,
      action: 'browser_click',
      selector,
      count,
      url: page.url(),
      visualReceipt: {
        kind: 'click',
        approvalId: String(args.approvalId || ''),
        rawSecretSerialized: false,
      },
    });
  }

  private async handleType(args: Record<string, unknown>): Promise<McpToolCallResponse> {
    this.requireMutationApproval(args, 'browser_type');
    const sidecar = await this.tryHandleBrowserSidecar('browser_type', args);
    if (sidecar) {
      return sidecar;
    }

    const selector = this.normalizeSelector(args.selector, 'browser_type');
    const text = String(args.text || '').slice(0, 10_000);
    const page = this.getActivePage();
    const locator = page.locator(selector);
    const count = await locator.count();
    if (count === 0) {
      throw new Error(`No element found to type into for selector "${selector}".`);
    }
    const target = locator.first();
    if (typeof target.fill === 'function') {
      await target.fill(text);
    } else if (typeof target.type === 'function') {
      await target.type(text);
    } else {
      await target.evaluate((element, value) => {
        const next = String(value || '');
        if ('value' in element) {
          (element as HTMLInputElement | HTMLTextAreaElement).value = next;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          element.textContent = next;
        }
      }, text);
    }
    return this.jsonResponse({
      ok: true,
      action: 'browser_type',
      selector,
      count,
      url: page.url(),
      textPreview: text.length > 80 ? `${text.slice(0, 80)}...` : text,
      visualReceipt: {
        kind: 'type',
        approvalId: String(args.approvalId || ''),
        rawSecretSerialized: false,
      },
    });
  }

  private async handleExtract(args: Record<string, unknown>): Promise<McpToolCallResponse> {
    const sidecar = await this.tryHandleBrowserSidecar('browser_extract', args);
    if (sidecar) {
      return sidecar;
    }

    const page = this.getActivePage();
    const extracted = await page.evaluate(() => ({
      title: document.title,
      url: location.href,
      text: (document.body?.innerText || document.body?.textContent || '').slice(0, 20_000),
      links: Array.from(document.querySelectorAll('a[href]')).slice(0, 40).map((link) => ({
        text: (link.textContent || '').trim().slice(0, 120),
        href: (link as HTMLAnchorElement).href,
      })),
    }), {});
    return this.jsonResponse({
      ok: true,
      action: 'browser_extract',
      ...extracted,
      visualReceipt: {
        kind: 'extract',
        rawSecretSerialized: false,
      },
    });
  }

  private resolveSafeEvaluationRecipe(script: string): 'title' | 'href' | 'bodyText' | 'bodyTextContent' | 'outerHtml' | null {
    const normalized = script.trim().replace(/;$/u, '');
    if (normalized === 'document.title') return 'title';
    if (normalized === 'location.href' || normalized === 'window.location.href') return 'href';
    if (normalized === 'document.body.innerText') return 'bodyText';
    if (normalized === 'document.body.textContent') return 'bodyTextContent';
    if (normalized === 'document.documentElement.outerHTML') return 'outerHtml';
    return null;
  }

  private async tryHandleBrowserSidecar(
    action: RuntimeBrowserSidecarAction,
    args: Record<string, unknown>,
  ): Promise<McpToolCallResponse | null> {
    const requested = String(args.isolationMode || process.env.ZAVORTH_BROWSER_ISOLATION || '')
      .trim()
      .toLowerCase();
    if (requested !== 'sidecar') {
      return null;
    }

    const decision = this.isolationGuard.guard({
      surface: 'browser',
      action,
      argv: [JSON.stringify(args)],
      requestedMode: 'sidecar',
      sidecarAvailable: Boolean(this.browserSidecar?.isConfigured()),
    });
    if (!decision.ok) {
      throw new Error(decision.reason);
    }

    return this.handleBrowserSidecar(action, args);
  }

  private async handleBrowserSidecar(
    action: RuntimeBrowserSidecarAction,
    args: Record<string, unknown>,
  ): Promise<McpToolCallResponse> {
    if (!this.browserSidecar) {
      throw new Error('Remote browser sidecar unavailable.');
    }

    const response = await this.browserSidecar.execute({
      action,
      args,
      timeoutMs: Number(args.timeout_ms || args.timeoutMs || 30_000),
    });

    return this.jsonResponse({
      ok: response.ok,
      action,
      isolated: true,
      runtime: response.runtime,
      payload: response.payload,
      error: response.error || null,
    });
  }

  private getActivePage(): PlaywrightPageLike {
    if (!this.page) {
      throw new Error('No active page in the MCP browser. Use browser_navigate first.');
    }
    return this.page;
  }

  private async ensurePage(): Promise<PlaywrightPageLike> {
    if (this.page) {
      return this.page;
    }

    const playwright = await this.loadPlaywright();
    if (!playwright?.chromium?.launch) {
      throw new Error(
        'AutomaticBrowserTool requires playwright-core with chromium.launch available.',
      );
    }

    this.browser = await playwright.chromium.launch({
      headless: true,
      ...this.options.launchOptions,
    });
    this.context = await this.browser.newContext();
    if (typeof this.context.route === 'function') {
      await this.context.route('**/*', async (route) => {
        try {
          await this.validateNavigationUrl(route.request().url());
          await route.continue();
        } catch {
          await route.abort('blockedbyclient');
        }
      });
    }
    this.page = await this.context.newPage();
    return this.page;
  }

  private async loadPlaywright(): Promise<PlaywrightModuleLike> {
    return (await this.loadPlaywrightModule()).playwright;
  }

  private async loadPlaywrightModule(): Promise<LoadedPlaywrightModule> {
    if (this.options.loadPlaywright) {
      return {
        moduleName: 'custom',
        playwright: await this.options.loadPlaywright(),
      };
    }

    try {
      return {
        moduleName: 'playwright-core',
        playwright: require('playwright-core') as PlaywrightModuleLike,
      };
    } catch (coreError: unknown) {try {
        return {
          moduleName: 'playwright',
          playwright: require('playwright') as PlaywrightModuleLike,
        };
      } catch (error: unknown) { const err = asErrorLike(error); const e = err;
        const detail = coreError instanceof Error ? ` (${coreError.message})` : '';
        throw new Error(
          `AutomaticBrowserTool requires playwright-core or provisioned playwright for real navigation${detail}.`,
        );
      }
    }
  }

  private buildDoctorRecommendations(message: string): string[] {
    const normalized = String(message || '').toLowerCase();
    if (normalized.includes('playwright-core') || normalized.includes('cannot find module')) {
      return [
        'Provide playwright-core or playwright on the host before enabling browser automation.',
        'Use doctor to confirm when the optional dependency is installed.',
      ];
    }
    if (normalized.includes('executable') || normalized.includes('browser') || normalized.includes('chromium')) {
      return [
        'The JavaScript dependency exists, but the browser binary is not ready for launch yet.',
              'Provisioning the Playwright browser stack on the host should resolve this issue.',
      ];
    }
    return [
      'Review the error returned by doctor before exposing AutomaticBrowserTool in production.',
    ];
  }

  private async normalizeUrl(value: unknown): Promise<string> {
    const url = String(value || '').trim();
    if (!url) {
      throw new Error('browser_navigate requires an absolute URL.');
    }

    try {
      const parsed = await this.validateNavigationUrl(url);
      return parsed.toString();
    } catch (error: unknown) { const err = asErrorLike(error); const e = err;
      throw new Error(`Invalid URL for browser_navigate: "${url}".`);
    }
  }

  private validateNavigationUrl(url: string): Promise<URL> {
    if (this.options.validateNavigationUrl) {
      return this.options.validateNavigationUrl(url);
    }
    return assertPublicHttpTargetAllowed(url, {
      serviceName: 'MCP browser navigation',
    });
  }

  private normalizeSelector(value: unknown, action: string): string {
    const selector = String(value || '').trim();
    if (!selector) {
      throw new Error(`${action} requires a valid CSS selector.`);
    }
    return selector;
  }

  private requireMutationApproval(args: Record<string, unknown>, action: string): void {
    const verification = verifyToolSecurityApprovalEnvelope({
      toolName: action,
      args,
      envelope: extractToolSecurityApprovalEnvelope(args, {}),
    });
    if (verification.ok) {
      return;
    }
    throw new Error(`${action} requires a signed and valid approval envelope (${verification.reason}).`);
  }

  private buildSearchUrl(engine: string, query: string): string {
    const encoded = encodeURIComponent(query);
    switch (engine) {
      case 'google':
        return `https://www.google.com/search...q=${encoded}`;
      case 'youtube':
        return `https://www.youtube.com/results...search_query=${encoded}`;
      case 'github':
        return `https://github.com/search...q=${encoded}`;
      default:
        throw new Error(`browser_search does not support engine "${engine}".`);
    }
  }

  private jsonResponse(payload: Record<string, unknown>): McpToolCallResponse {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(payload, null, 2),
        },
      ],
      isError: false,
    };
  }

  private errorResponse(message: string): McpToolCallResponse {
    return {
      content: [
        {
          type: 'text',
          text: message,
        },
      ],
      isError: true,
    };
  }
}
