import { assertPublicHttpTargetAllowed } from '../../../ai-gateway/lib/security/egressGuard.js';
import { safeFetch } from '../../../security/SafeFetchService.js';
import { wrapUntrustedContent } from '../../../security/UntrustedContent.js';
import { SearchQueryService } from '../../../services/SearchQueryService.js';
import { MinimalBrowserSidecarClient } from '../../../core/MinimalBrowserSidecarClient.js';
import type {
  ZavorthActionDefinition,
  ZavorthActionHandlerInput,
  ZavorthActionModule,
  ZavorthActionResult,
  ZavorthActionSchema,
} from '../ZavorthActionContracts.js';

const WEB_BROWSER_CAPABILITY_ID = 'web-browser';
const WEB_BROWSER_TEST_REFS = ['tests/runtime/actions/WebBrowserActions.test.ts'];
const WEB_BROWSER_SURFACES: ZavorthActionDefinition['surface'] = ['cli', 'dashboard', 'tui', 'api', 'channel', 'llm'];

const outputSchema: ZavorthActionSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    summary: { type: 'string' },
  },
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function result(input: {
  ok: boolean;
  actionId: string;
  operation: ZavorthActionResult['operation'];
  status: ZavorthActionResult['status'];
  summary: string;
  lines: string[];
  data?: Record<string, unknown>;
}): ZavorthActionResult {
  return input;
}

function block(input: ZavorthActionHandlerInput, summary: string, lines: string[], data?: Record<string, unknown>): ZavorthActionResult {
  return result({
    ok: false,
    actionId: input.actionId,
    operation: input.operation,
    status: 'blocked',
    summary,
    lines,
    data,
  });
}

function baseWebBrowserAction(input: Omit<ZavorthActionDefinition, 'capabilityId' | 'verificationStatus' | 'surface' | 'testRefs'>): ZavorthActionDefinition {
  return {
    ...input,
    capabilityId: WEB_BROWSER_CAPABILITY_ID,
    verificationStatus: 'verified',
    surface: WEB_BROWSER_SURFACES,
    testRefs: WEB_BROWSER_TEST_REFS,
  };
}

async function checkSidecarHealth(client: MinimalBrowserSidecarClient): Promise<boolean> {
  try {
    const res = await client.health();
    return res.ok === true;
  } catch {
    return false;
  }
}

async function webSearchHandler(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const query = normalizeText(input.args.query);
  if (!query) {
    return block(input, 'Missing query for web search.', ['Provide args.query.'], { required: ['query'] });
  }

  if (input.operation === 'action.status' || input.operation === 'action.preview') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: input.operation === 'action.preview' ? 'preview' : 'ok',
      summary: `Web search preview: "${query}"`,
      lines: [
        `Query: ${query}`,
        'Preview only. No live search was executed.'
      ],
      data: { preview: { query } }
    });
  }

  if (input.operation !== 'action.apply') {
    return block(input, `Unsupported operation for ${input.actionId}.`, [`Unsupported operation: ${input.operation}`]);
  }

  try {
    const service = new SearchQueryService();
    const mode = (input.args.mode as any) || 'deep';
    const limit = typeof input.args.limit === 'number' ? input.args.limit : 5;
    const evidenceDomain = (input.args.evidenceDomain as any) || 'auto';
    const extractPages = typeof input.args.extractPages === 'boolean' ? input.args.extractPages : undefined;

    const res = await service.search({
      query,
      mode,
      limit,
      evidenceDomain,
      extractPages,
    });

    if (!res.ok) {
      return result({
        ok: false,
        actionId: input.actionId,
        operation: input.operation,
        status: 'ok',
        summary: `Web search failed: ${res.error?.message || 'unknown error'}`,
        lines: [res.error?.message || 'Search execution failed.'],
        data: { error: res.error }
      });
    }

    const lines = res.items.map((item) => `- [${item.title}](${item.url})`);
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'applied',
      summary: `Found ${res.items.length} results for "${query}".`,
      lines: [
        `Query: ${query}`,
        `Mode: ${res.mode}`,
        `Quality Gate: ${res.qualityGate.status}`,
        ...lines
      ],
      data: {
        results: res.items.map(item => ({
          title: item.title,
          url: item.url,
          snippet: item.snippet || ''
        }))
      }
    });
  } catch (error) {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'ok',
      summary: 'Web search threw an error.',
      lines: [error instanceof Error ? error.message : String(error)],
    });
  }
}

async function webFetchUrlHandler(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const url = normalizeText(input.args.url);
  if (!url) {
    return block(input, 'Missing URL to fetch.', ['Provide args.url.'], { required: ['url'] });
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return block(input, 'Invalid scheme. Only http and https URLs are allowed.', [`Scheme: ${parsed.protocol}`], { url });
    }
  } catch (err) {
    return block(input, 'Invalid URL format.', [err instanceof Error ? err.message : String(err)], { url });
  }

  if (input.operation === 'action.status' || input.operation === 'action.preview') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: input.operation === 'action.preview' ? 'preview' : 'ok',
      summary: `Fetch URL preview: ${url}`,
      lines: [
        `Target URL: ${url}`,
        'Preview only. No HTTP request was sent.'
      ],
      data: { preview: { url } }
    });
  }

  if (input.operation !== 'action.apply') {
    return block(input, `Unsupported operation for ${input.actionId}.`, [`Unsupported operation: ${input.operation}`]);
  }

  try {
    await assertPublicHttpTargetAllowed(url);

    const response = await safeFetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 ZavorthActionHarness/1.1'
      }
    });

    if (!response.ok) {
      return result({
        ok: false,
        actionId: input.actionId,
        operation: input.operation,
        status: 'ok',
        summary: `Fetch URL returned status code ${response.status}.`,
        lines: [`HTTP error: ${response.status} ${response.statusText}`],
        data: { status: response.status }
      });
    }

    const text = await response.text();
    const wrapped = wrapUntrustedContent('untrusted_web_evidence', text, { url });

    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'applied',
      summary: `Successfully fetched ${url}.`,
      lines: [
        `URL: ${url}`,
        `Bytes: ${Buffer.byteLength(text, 'utf8')}`,
        'Output wrapped as untrusted evidence.'
      ],
      data: { content: wrapped, raw: text, url }
    });
  } catch (error) {
    return block(input, 'Failed to fetch URL or target blocked by network policy.', [
      error instanceof Error ? error.message : String(error)
    ], { url });
  }
}

async function browserOpenHandler(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const url = normalizeText(input.args.url);
  if (!url) {
    return block(input, 'Missing URL to open in browser.', ['Provide args.url.'], { required: ['url'] });
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return block(input, 'Invalid scheme. Only http and https URLs are allowed in browser.', [`Scheme: ${parsed.protocol}`], { url });
    }
  } catch (err) {
    return block(input, 'Invalid URL format.', [err instanceof Error ? err.message : String(err)], { url });
  }

  if (input.operation === 'action.status' || input.operation === 'action.preview') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: input.operation === 'action.preview' ? 'preview' : 'ok',
      summary: `Open browser preview: ${url}`,
      lines: [
        `Target URL: ${url}`,
        'Preview only. Browser will navigate when apply is run after approval.'
      ],
      data: { preview: { url } }
    });
  }

  if (input.operation !== 'action.apply') {
    return block(input, `Unsupported operation for ${input.actionId}.`, [`Unsupported operation: ${input.operation}`]);
  }

  try {
    await assertPublicHttpTargetAllowed(url);

    const client = new MinimalBrowserSidecarClient({
      baseUrl: normalizeText(input.args.baseUrl) || undefined,
      timeoutMs: typeof input.args.timeoutMs === 'number' ? input.args.timeoutMs : undefined,
    });

    const healthy = await checkSidecarHealth(client);
    if (!healthy) {
      return block(input, 'Browser sidecar is offline or unreachable on port 20187.', [
        'Make sure the browser sidecar is running locally.'
      ], { url });
    }

    const response = await client.navigate(url, {
      waitUntil: normalizeText(input.args.waitUntil) || undefined,
    });

    if (!response.ok) {
      return block(input, 'Browser navigation failed.', [
        String(response.error || 'Unknown navigation error')
      ], { response });
    }

    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'applied',
      summary: `Browser navigated to ${response.url || url}.`,
      lines: [
        `URL: ${response.url || url}`,
        `Title: ${response.title || 'No title'}`,
        'Browser session is open.'
      ],
      data: { opened: response }
    });
  } catch (error) {
    return block(input, 'Browser open action failed.', [
      error instanceof Error ? error.message : String(error)
    ], { url });
  }
}

async function browserScreenshotHandler(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const viewportOnly = input.args.viewportOnly === true;

  if (input.operation === 'action.status' || input.operation === 'action.preview') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: input.operation === 'action.preview' ? 'preview' : 'ok',
      summary: 'Capture browser screenshot preview.',
      lines: [
        `Viewport only: ${viewportOnly}`,
        'Preview only. Screenshot will be captured on apply.'
      ],
      data: { preview: { viewportOnly } }
    });
  }

  if (input.operation !== 'action.apply') {
    return block(input, `Unsupported operation for ${input.actionId}.`, [`Unsupported operation: ${input.operation}`]);
  }

  try {
    const client = new MinimalBrowserSidecarClient({
      baseUrl: normalizeText(input.args.baseUrl) || undefined,
      timeoutMs: typeof input.args.timeoutMs === 'number' ? input.args.timeoutMs : undefined,
    });

    const healthy = await checkSidecarHealth(client);
    if (!healthy) {
      return block(input, 'Browser sidecar is offline or unreachable on port 20187.', [
        'Make sure the browser sidecar is running locally.'
      ]);
    }

    const response = await client.screenshot({
      fullPage: !viewportOnly,
      base64: true,
    });

    if (!response.ok) {
      return block(input, 'Browser screenshot capture failed.', [
        String(response.error || 'Unknown screenshot error')
      ], { response });
    }

    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'applied',
      summary: 'Browser screenshot captured successfully.',
      lines: [
        `File: ${response.file || 'temporary buffer'}`,
        `Bytes: ${response.bytes || 0}`
      ],
      data: {
        screenshot: {
          file: response.file,
          bytes: response.bytes,
          base64: response.base64,
        }
      }
    });
  } catch (error) {
    return block(input, 'Browser screenshot action failed.', [
      error instanceof Error ? error.message : String(error)
    ]);
  }
}

async function browserExtractHandler(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const maxChars = typeof input.args.maxChars === 'number' ? input.args.maxChars : 20000;

  if (input.operation === 'action.status' || input.operation === 'action.preview') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: input.operation === 'action.preview' ? 'preview' : 'ok',
      summary: 'Extract browser DOM/text content preview.',
      lines: [
        `Max characters: ${maxChars}`,
        'Preview only. Extraction will be performed on apply.'
      ],
      data: { preview: { maxChars } }
    });
  }

  if (input.operation !== 'action.apply') {
    return block(input, `Unsupported operation for ${input.actionId}.`, [`Unsupported operation: ${input.operation}`]);
  }

  try {
    const client = new MinimalBrowserSidecarClient({
      baseUrl: normalizeText(input.args.baseUrl) || undefined,
      timeoutMs: typeof input.args.timeoutMs === 'number' ? input.args.timeoutMs : undefined,
    });

    const healthy = await checkSidecarHealth(client);
    if (!healthy) {
      return block(input, 'Browser sidecar is offline or unreachable on port 20187.', [
        'Make sure the browser sidecar is running locally.'
      ]);
    }

    const response = await client.extractText({
      maxChars,
    });

    if (!response.ok) {
      return block(input, 'Browser text extraction failed.', [
        String(response.error || 'Unknown extraction error')
      ], { response });
    }

    const text = String(response.text || '');
    const wrapped = wrapUntrustedContent('untrusted_browser_content', text);

    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'applied',
      summary: 'Successfully extracted browser text.',
      lines: [
        `Characters extracted: ${text.length}`,
        `Truncated: ${response.truncated === true}`,
        'Output wrapped as untrusted browser content.'
      ],
      data: { content: wrapped, raw: text, truncated: response.truncated }
    });
  } catch (error) {
    return block(input, 'Browser extract action failed.', [
      error instanceof Error ? error.message : String(error)
    ]);
  }
}

export function createWebBrowserActionModule(): ZavorthActionModule {
  return {
    id: 'web-browser',
    manifestId: 'config/capability-manifests/web-browser.json',
    actions: [
      baseWebBrowserAction({
        id: 'web.search',
        title: 'Web search',
        description: 'Governed web search leveraging SearchQueryService.',
        aliases: ['web_search', 'pesquisa web', 'buscar na web', 'search web', 'web search'],
        domains: ['web', 'search', 'query', 'network'],
        risk: 'safe',
        effects: ['read'],
        scope: 'web',
        receiptPolicy: 'none',
        requiresPreview: false,
        requiresApproval: false,
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            mode: { type: 'string', enum: ['quick', 'deep', 'grounded'] },
            limit: { type: 'number' },
            evidenceDomain: { type: 'string' },
            extractPages: { type: 'boolean' },
          },
          required: ['query'],
        },
        outputSchema,
        handler: webSearchHandler,
      }),
      baseWebBrowserAction({
        id: 'web.fetch_url',
        title: 'Web fetch URL',
        description: 'Governed safe network fetch (HTML retrieval) with output sanitization.',
        aliases: ['web_fetch_url', 'fetch_url', 'baixar url', 'obter pagina', 'web fetch url', 'fetch url'],
        domains: ['web', 'fetch', 'network', 'url'],
        risk: 'safe',
        effects: ['read'],
        scope: 'web',
        receiptPolicy: 'none',
        requiresPreview: false,
        requiresApproval: false,
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string' },
          },
          required: ['url'],
        },
        outputSchema,
        handler: webFetchUrlHandler,
      }),
      baseWebBrowserAction({
        id: 'browser.open',
        title: 'Browser navigate',
        description: 'Open a governed browser session and navigate to a URL.',
        aliases: ['browser_open', 'open_browser', 'abrir navegador', 'abrir browser', 'browser open', 'open browser'],
        domains: ['browser', 'navigation', 'network'],
        risk: 'attention',
        effects: ['network'],
        scope: 'browser',
        receiptPolicy: 'required',
        requiresPreview: true,
        requiresApproval: true,
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            waitUntil: { type: 'string' },
            baseUrl: { type: 'string' },
            timeoutMs: { type: 'number' },
          },
          required: ['url'],
        },
        outputSchema,
        handler: browserOpenHandler,
      }),
      baseWebBrowserAction({
        id: 'browser.screenshot',
        title: 'Browser screenshot',
        description: 'Capture screenshot of the active browser session.',
        aliases: ['browser_screenshot', 'take_screenshot', 'screenshot browser', 'browser screenshot', 'screenshot'],
        domains: ['browser', 'screenshot', 'visual'],
        risk: 'attention',
        effects: ['network'],
        scope: 'browser',
        receiptPolicy: 'required',
        requiresPreview: true,
        requiresApproval: true,
        inputSchema: {
          type: 'object',
          properties: {
            viewportOnly: { type: 'boolean' },
            baseUrl: { type: 'string' },
            timeoutMs: { type: 'number' },
          },
        },
        outputSchema,
        handler: browserScreenshotHandler,
      }),
      baseWebBrowserAction({
        id: 'browser.extract',
        title: 'Browser extract text',
        description: 'Extract page innerText from the active browser session.',
        aliases: ['browser_extract', 'extract_text', 'extrair texto browser', 'browser extract', 'extract'],
        domains: ['browser', 'extract', 'content'],
        risk: 'attention',
        effects: ['network'],
        scope: 'browser',
        receiptPolicy: 'required',
        requiresPreview: true,
        requiresApproval: true,
        inputSchema: {
          type: 'object',
          properties: {
            maxChars: { type: 'number' },
            baseUrl: { type: 'string' },
            timeoutMs: { type: 'number' },
          },
        },
        outputSchema,
        handler: browserExtractHandler,
      }),
    ],
  };
}
