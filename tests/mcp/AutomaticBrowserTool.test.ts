import { AutomaticBrowserTool } from '../../src/mcp/tools/AutomaticBrowserTool';
import { createToolSecurityApprovalEnvelope } from '../../src/security/ToolApprovalEnvelope';
import { resetApprovalSigningKeyCacheForTests } from '../../src/security/ApprovalSigningKeyService';

describe('AutomaticBrowserTool', () => {
  const originalSigningKey = process.env.ZAVORTH_TOOL_APPROVAL_SIGNING_KEY;

  beforeEach(() => {
    process.env.ZAVORTH_TOOL_APPROVAL_SIGNING_KEY = 'b'.repeat(64);
    resetApprovalSigningKeyCacheForTests();
  });

  afterEach(() => {
    if (originalSigningKey === undefined) {
      delete process.env.ZAVORTH_TOOL_APPROVAL_SIGNING_KEY;
    } else {
      process.env.ZAVORTH_TOOL_APPROVAL_SIGNING_KEY = originalSigningKey;
    }
    resetApprovalSigningKeyCacheForTests();
  });

  it.each([
    'http://127.0.0.1:3000/admin',
    'http://169.254.169.254/latest/meta-data/',
    'file:///etc/passwd',
  ])('blocks unsafe navigation before Playwright or a sidecar receives %s', async (url) => {
    const loadPlaywright = jest.fn();
    const sidecar = { isConfigured: jest.fn(() => true), execute: jest.fn() };
    const tool = new AutomaticBrowserTool({ loadPlaywright, browserSidecar: sidecar });

    const result = await tool.handleToolCall('browser_navigate', {
      url,
      isolationMode: 'sidecar',
    });

    expect(result.isError).toBe(true);
    expect(loadPlaywright).not.toHaveBeenCalled();
    expect(sidecar.execute).not.toHaveBeenCalled();
  });

  it('rejects forged mutation flags and accepts only a signed envelope for exact arguments', async () => {
    let currentUrl = 'about:blank';
    const click = jest.fn(async () => undefined);
    const tool = new AutomaticBrowserTool({
      validateNavigationUrl: async (url) => new URL(url),
      loadPlaywright: async () => ({
        chromium: {
          launch: async () => ({
            newContext: async () => ({
              newPage: async () => ({
                goto: async (url: string) => { currentUrl = url; },
                title: async () => 'Safe page',
                url: () => currentUrl,
                locator: () => ({
                  count: async () => 1,
                  first: () => ({ evaluate: async () => null, click }),
                }),
                evaluate: async () => null,
              }),
            }),
          }),
        },
      }),
    });
    await tool.handleToolCall('browser_navigate', { url: 'https://example.com' });

    for (const forged of [{ selector: '#submit', approved: true }, { selector: '#submit', approvalId: 'forged' }]) {
      const result = await tool.handleToolCall('browser_click', forged);
      expect(result.isError).toBe(true);
    }
    expect(click).not.toHaveBeenCalled();

    const args = { selector: '#submit' };
    const securityApproval = createToolSecurityApprovalEnvelope({
      toolName: 'browser_click',
      args,
      approvalId: 'approval-browser-click',
      approvedBy: 'operator',
    });
    const approved = await tool.handleToolCall('browser_click', { ...args, securityApproval });

    expect(approved.isError).toBe(false);
    expect(click).toHaveBeenCalledTimes(1);
  });
  it('returns a clear error when inspect is requested before navigation', async () => {
    const tool = new AutomaticBrowserTool();

    const result = await tool.handleToolCall('inspect_dom_element', {
      selector: '#main',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text || '').toContain('Use browser_navigate first');
  });

  it('returns a clear provisioning error when Playwright is unavailable', async () => {
    const tool = new AutomaticBrowserTool({
      loadPlaywright: () => {
        throw new Error("Cannot find module 'playwright-core'");
      },
    });

    const result = await tool.handleToolCall('browser_navigate', {
      url: 'https://example.com',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text || '').toContain('playwright-core');
  });

  it('diagnoses missing Playwright stack honestly', async () => {
    const tool = new AutomaticBrowserTool({
      loadPlaywright: () => {
        throw new Error("Cannot find module 'playwright-core'");
      },
    });

    const report = await tool.diagnose();

    expect(report.ok).toBe(false);
    expect(report.moduleAvailable).toBe(false);
    expect(report.launchable).toBe(false);
    expect(report.error || '').toContain('playwright-core');
  });

  it('diagnoses a launchable browser stack', async () => {
    const close = jest.fn(async () => undefined);
    const tool = new AutomaticBrowserTool({
      loadPlaywright: async () => ({
        chromium: {
          launch: async () => ({
            newContext: async () => ({
              newPage: async () => ({
                goto: async () => undefined,
                title: async () => 'ok',
                url: () => 'about:blank',
                locator: () => ({
                  count: async () => 0,
                  first: () => ({
                    evaluate: async () => null,
                  }),
                }),
                evaluate: async () => null,
              }),
            }),
            close,
          }),
        },
      }),
    });

    const report = await tool.diagnose();

    expect(report.ok).toBe(true);
    expect(report.moduleAvailable).toBe(true);
    expect(report.launchable).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('navigates, inspects DOM and evaluates JS through the browser adapter contract', async () => {
    let currentUrl = 'about:blank';
    let currentTitle = '';
    let currentHtml = '';

    const tool = new AutomaticBrowserTool({
      loadPlaywright: async () => ({
        chromium: {
          launch: async () => ({
            newContext: async () => ({
              newPage: async () => ({
                goto: async (url: string) => {
                  currentUrl = url;
                  currentTitle = 'Zavorth Browser';
                  currentHtml = '<main id="card" data-role="main"><span class="value">42</span></main>';
                },
                title: async () => currentTitle,
                url: () => currentUrl,
                locator: (selector: string) => ({
                  count: async () => (selector === '#card' ? 1 : 0),
                  first: () => ({
                    evaluate: async () => ({
                      tagName: 'main',
                      textContent: '42',
                      outerHTML: currentHtml,
                    }),
                  }),
                }),
                evaluate: async (_fn: unknown, args: Record<string, unknown>) => ({
                  kind: 'string',
                  value:
                    String(args.recipeName || '') === 'bodyText'
                      ? '42'
                      : 'unknown',
                }),
              }),
            }),
          }),
        },
      }),
    });

    const navigateResult = await tool.handleToolCall('browser_navigate', {
      url: 'https://example.com/app',
    });
    const inspectResult = await tool.handleToolCall('inspect_dom_element', {
      selector: '#card',
    });
    const evaluateResult = await tool.handleToolCall('evaluate_js', {
      script: 'document.body.innerText',
    });
    const navigatePayload = JSON.parse(navigateResult.content[0]?.text || '{}');
    const inspectPayload = JSON.parse(inspectResult.content[0]?.text || '{}');
    const evaluatePayload = JSON.parse(evaluateResult.content[0]?.text || '{}');

    expect(navigateResult.isError).toBe(false);
    expect(navigatePayload.title).toBe('Zavorth Browser');

    expect(inspectResult.isError).toBe(false);
    expect(inspectPayload.tagName).toBe('main');
    expect(String(inspectPayload.outerHTML || '')).toContain('data-role="main"');

    expect(evaluateResult.isError).toBe(false);
    expect(evaluatePayload.result?.kind).toBe('string');
    expect(evaluatePayload.result?.value).toBe('42');

    const rejectedEval = await tool.handleToolCall('evaluate_js', {
      script: "document.querySelector('#card')?.getAttribute('data-role')",
    });
    expect(rejectedEval.isError).toBe(true);

    await tool.shutdown();
  });

  it('delegates arbitrary browser JavaScript to the isolated sidecar when requested', async () => {
    const sidecar = {
      isConfigured: jest.fn(() => true),
      execute: jest.fn().mockResolvedValue({
        ok: true,
        action: 'evaluate_js',
        payload: {
          ok: true,
          result: {
            kind: 'string',
            value: 'sidecar-value',
          },
        },
        runtime: 'browser-sidecar',
        isolated: true,
      }),
    };
    const tool = new AutomaticBrowserTool({
      browserSidecar: sidecar,
      loadPlaywright: () => {
        throw new Error('local browser should not be used');
      },
    });

    const result = await tool.handleToolCall('evaluate_js', {
      script: "document.querySelector('#card')?.getAttribute('data-role')",
      isolationMode: 'sidecar',
    });
    const payload = JSON.parse(result.content[0]?.text || '{}');

    expect(result.isError).toBe(false);
    expect(payload.isolated).toBe(true);
    expect(payload.runtime).toBe('browser-sidecar');
    expect(payload.payload.result.value).toBe('sidecar-value');
    expect(sidecar.execute).toHaveBeenCalledWith(expect.objectContaining({
      action: 'evaluate_js',
      args: expect.objectContaining({
        isolationMode: 'sidecar',
      }),
    }));
  });

  it('fails closed when browser sidecar mode is required but unavailable', async () => {
    const tool = new AutomaticBrowserTool({
      browserSidecar: {
        isConfigured: () => false,
        execute: jest.fn(),
      },
    });

    const result = await tool.handleToolCall('browser_navigate', {
      url: 'https://example.com',
      isolationMode: 'sidecar',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text || '').toContain('Isolated sidecar unavailable');
  });

  it('navigates directly to YouTube search results with browser_search', async () => {
    let currentUrl = 'about:blank';
    const tool = new AutomaticBrowserTool({
      loadPlaywright: async () => ({
        chromium: {
          launch: async () => ({
            newContext: async () => ({
              newPage: async () => ({
                goto: async (url: string) => {
                  currentUrl = url;
                },
                title: async () => 'YouTube Search',
                url: () => currentUrl,
                locator: () => ({
                  count: async () => 0,
                  first: () => ({
                    evaluate: async () => null,
                  }),
                }),
                evaluate: async () => null,
              }),
            }),
          }),
        },
      }),
    });

    const result = await tool.handleToolCall('browser_search', {
      engine: 'youtube',
      query: 'inteligência artificial',
    });
    const payload = JSON.parse(result.content[0]?.text || '{}');

    expect(result.isError).toBe(false);
    expect(payload.action).toBe('browser_search');
    expect(payload.url).toContain('youtube.com/results');
    expect(payload.url).toContain('search_query=intelig%C3%AAncia%20artificial');
  });
});
