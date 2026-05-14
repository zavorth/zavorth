import { RuntimeIsolationGuardService } from '../../services/RuntimeIsolationGuardService.js';
import {
  RuntimeBrowserSidecarService,
  type RuntimeBrowserSidecarAction,
} from '../../services/RuntimeBrowserSidecarService.js';

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
  locator(selector: string): {
    count(): Promise<number>;
    first(): {
      evaluate<T>(fn: (element: Element) => T | Promise<T>): Promise<T>;
    };
  };
  evaluate<T>(fn: (args: Record<string, unknown>) => T | Promise<T>, args: Record<string, unknown>): Promise<T>;
  close?(): Promise<void>;
};

type PlaywrightContextLike = {
  newPage(): Promise<PlaywrightPageLike>;
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
        default:
          return this.errorResponse(`Tool ${name} not supported by AutomaticBrowserTool.`);
      }
    } catch (error) {
      return this.errorResponse(
        error instanceof Error ? error.message : String(error),
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
    } catch {
      // noop
    }

    try {
      await context?.close?.();
    } catch {
      // noop
    }

    try {
      await browser?.close?.();
    } catch {
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
          error: 'Modulo Playwright carregado, mas chromium.launch nao esta disponivel.',
          recommendations: [
            'Revise a versao provisionada de playwright-core/playwright.',
            'Garanta que a stack de browser expose chromium.launch antes de habilitar o MCP browser.',
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
            'A stack de browser esta pronta para o AutomaticBrowserTool.',
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
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
      } catch {
        // noop
      }
    }
  }

  private async handleNavigate(args: Record<string, unknown>): Promise<McpToolCallResponse> {
    const sidecar = await this.tryHandleBrowserSidecar('browser_navigate', args);
    if (sidecar) {
      return sidecar;
    }

    const url = this.normalizeUrl(args?.url);
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
      throw new Error('browser_search requer uma query nao vazia.');
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
      throw new Error('inspect_dom_element requer um seletor CSS valido.');
    }

    const page = this.getActivePage();
    const locator = page.locator(selector);
    const count = await locator.count();
    if (count === 0) {
      throw new Error(`Nenhum elemento encontrado para o seletor "${selector}".`);
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
      throw new Error('evaluate_js requer um script JavaScript nao vazio.');
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
        'evaluate_js nao aceita JavaScript arbitrario no browser local. Use uma receita read-only: document.title, location.href, document.body.innerText, document.body.textContent ou document.documentElement.outerHTML. Scripts arbitrarios exigem um browser sidecar isolado.',
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
      throw new Error('Browser sidecar remoto indisponivel.');
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
      throw new Error('Nenhuma pagina ativa no browser MCP. Use browser_navigate primeiro.');
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
        'AutomaticBrowserTool requer playwright-core com chromium.launch disponivel.',
      );
    }

    this.browser = await playwright.chromium.launch({
      headless: true,
      ...this.options.launchOptions,
    });
    this.context = await this.browser.newContext();
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
    } catch (coreError) {
      try {
        return {
          moduleName: 'playwright',
          playwright: require('playwright') as PlaywrightModuleLike,
        };
      } catch {
        const detail = coreError instanceof Error ? ` (${coreError.message})` : '';
        throw new Error(
          `AutomaticBrowserTool requer playwright-core ou playwright provisionado para navegacao real${detail}.`,
        );
      }
    }
  }

  private buildDoctorRecommendations(message: string): string[] {
    const normalized = String(message || '').toLowerCase();
    if (normalized.includes('playwright-core') || normalized.includes('cannot find module')) {
      return [
        'Providencie playwright-core ou playwright no host antes de habilitar a automacao de browser.',
        'Use o doctor para confirmar quando a dependencia opcional estiver instalada.',
      ];
    }
    if (normalized.includes('executable') || normalized.includes('browser') || normalized.includes('chromium')) {
      return [
        'A dependencia JavaScript existe, mas o binario do browser ainda nao esta pronto para launch.',
        'Provisionar o browser stack do Playwright no host deve resolver esse ponto.',
      ];
    }
    return [
      'Revise o erro retornado pelo doctor antes de expor o AutomaticBrowserTool em producao.',
    ];
  }

  private normalizeUrl(value: unknown): string {
    const url = String(value || '').trim();
    if (!url) {
      throw new Error('browser_navigate requer uma URL absoluta.');
    }

    try {
      const parsed = new URL(url);
      if (!parsed.protocol) {
        throw new Error('missing protocol');
      }
      return parsed.toString();
    } catch {
      throw new Error(`URL invalida para browser_navigate: "${url}".`);
    }
  }

  private buildSearchUrl(engine: string, query: string): string {
    const encoded = encodeURIComponent(query);
    switch (engine) {
      case 'google':
        return `https://www.google.com/search?q=${encoded}`;
      case 'youtube':
        return `https://www.youtube.com/results?search_query=${encoded}`;
      case 'github':
        return `https://github.com/search?q=${encoded}`;
      default:
        throw new Error(`browser_search nao suporta engine "${engine}".`);
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
