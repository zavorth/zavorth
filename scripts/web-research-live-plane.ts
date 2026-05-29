import os from 'node:os';
import path from 'node:path';
import {
  BrowserCaptureWebExtractLiveAdapter,
  FirecrawlWebExtractLiveAdapter,
  ReadabilityWebExtractLiveAdapter,
  SearchProviderLiveAdapter,
} from '../src/adapters/web/WebResearchLiveAdapters.js';
import type { SearchProviderRequestStyle } from '../src/adapters/web/WebResearchLiveAdapters.js';
import type { WebResearchLiveEntry } from '../src/contracts/WebResearchLivePlaneContract.js';
import { SearchQueryService } from '../src/services/SearchQueryService.js';
import { WebExtractService } from '../src/services/WebExtractService.js';
import { WebResearchLivePlaneService } from '../src/services/WebResearchLivePlaneService.js';

type Profile = 'configured' | 'staging-live';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const target = readArg('--target');
const profile = (readArg('--profile') || 'configured') as Profile;
const confirmLiveIo = args.includes('--confirm-live-io');
const query = readArg('--query') || 'Zavorth live search smoke';
const url = readArg('--url') || readEnv('WEB_EXTRACT_SMOKE_URL') || 'https://example.com/';
const snapshot = new WebResearchLivePlaneService().buildSnapshot();
const selected = target
  ? snapshot.entries.filter((entry) => entry.targetId === target)
  : snapshot.entries;

if (selected.length === 0) {
  console.error(`[web-research-live-plane] unknown target: ${target}`);
  process.exit(1);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main(): Promise<void> {
  const liveReceiptByTarget = new Map<string, unknown>();
  if (profile === 'staging-live' && confirmLiveIo) {
    for (const entry of selected) {
      liveReceiptByTarget.set(entry.targetId, await runLiveSmoke(entry));
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    profile,
    liveIoPerformed: [...liveReceiptByTarget.values()].some(receiptHasLiveIo),
    confirmLiveIo,
    status: profile === 'staging-live' && !confirmLiveIo ? 'blocked-until-confirmed' : 'ready-for-operator',
    reason: profile === 'staging-live' && !confirmLiveIo
      ? 'staging-live web/search requires --confirm-live-io and real operator credentials/targets.'
      : 'ZavorthControl controls exposes configured search providers, web extraction adapters, crawl policy and redacted receipts.',
    entries: selected.map((entry) => ({
      targetId: entry.targetId,
      status: entry.status,
      capabilities: entry.capabilities,
      adapterFamily: entry.adapterFamily,
      modes: entry.modes,
      doctorCommand: entry.doctorCommand,
      stagingLiveSmokeCommand: entry.stagingLiveSmokeCommand,
      requiredEnv: entry.configSchema.requiredEnv,
      optionalEnv: entry.configSchema.optionalEnv,
      gaps: entry.gaps,
      receipt: entry.receipt,
      liveReceipt: liveReceiptByTarget.get(entry.targetId) || null,
    })),
  };

  if (asJson) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`[web-research-live-plane] profile=${profile} liveIoPerformed=${output.liveIoPerformed}`);
    console.log(`[web-research-live-plane] ${output.status}: ${output.reason}`);
    for (const entry of output.entries) {
      console.log(`[web-research-live-plane] ${entry.targetId} ${entry.status} capabilities=${entry.capabilities.join(',')}`);
      console.log(`  doctor: ${entry.doctorCommand}`);
      console.log(`  staging: ${entry.stagingLiveSmokeCommand}`);
      console.log(`  required env: ${entry.requiredEnv.join(', ') || 'none'}`);
    }
  }
}

async function runLiveSmoke(entry: WebResearchLiveEntry): Promise<unknown> {
  if (entry.capabilities.includes('search.query')) {
    const adapter = buildSearchAdapter(entry);
    const service = new SearchQueryService({ adapters: [adapter] });
    const result = await service.search({
      query,
      mode: 'quick',
      limit: 3,
      extractPages: false,
      providerHints: {
        providerId: entry.targetId,
      },
    });
    return {
      targetId: entry.targetId,
      operation: 'search.query',
      ok: result.ok,
      items: result.items.map((item) => ({
        title: item.title,
        url: item.url,
        host: item.host,
        providerId: item.providerEvidence.providerId,
      })),
      qualityGate: result.qualityGate.status,
      error: result.error || null,
      liveIoPerformed: true,
      secretValuesSerialized: false,
    };
  }

  const mode = entry.modes.includes('browser-capture')
    ? 'browser-capture'
    : entry.modes.includes('crawl') && readArg('--mode') === 'crawl'
      ? 'crawl'
      : entry.modes.includes('readability')
        ? 'readability'
        : 'fetch';
  const adapter = buildExtractAdapter(entry);
  const service = new WebExtractService({
    adapters: [adapter],
    artifactDir: readEnv('WEB_RESEARCH_ARTIFACT_DIR') || path.join(os.tmpdir(), 'zavorth-web-research-live-smoke'),
  });
  const result = await service.executeLive({
    mode,
    target: url,
    adapterId: adapter.adapterId,
    allowBrowserLaunch: entry.targetId === 'browser',
  });
  return {
    targetId: entry.targetId,
    operation: 'web.extract',
    ok: result.ok,
    mode: result.mode,
    artifact: result.artifact,
    screenshotArtifact: result.screenshotArtifact,
    title: result.title,
    textLength: result.textLength,
    links: result.links.length,
    providerId: result.providerEvidence?.providerId || null,
    error: result.error || null,
    liveIoPerformed: true,
    secretValuesSerialized: false,
  };
}

function buildSearchAdapter(entry: WebResearchLiveEntry): SearchProviderLiveAdapter {
  const prefix = envPrefix(entry.targetId);
  if (entry.targetId === 'brave') {
    return new SearchProviderLiveAdapter({
      adapterId: 'brave',
      providerId: 'brave',
      searchUrl: readEnv('BRAVE_SEARCH_URL') || 'https://api.search.brave.com/res/v1/web/search',
      apiKey: requireEnv(entry.targetId, 'BRAVE_SEARCH_API_KEY'),
      requestStyle: 'brave',
      authHeaderName: 'X-Subscription-Token',
      authScheme: null,
    });
  }
  if (entry.targetId === 'searxng') {
    const base = requireEnv(entry.targetId, 'SEARXNG_BASE_URL').replace(/\/+$/, '');
    return new SearchProviderLiveAdapter({
      adapterId: 'searxng',
      providerId: 'searxng',
      searchUrl: `${base}/search`,
      apiKey: readEnv('SEARXNG_API_KEY'),
      requestStyle: 'searxng',
      authScheme: null,
    });
  }
  return new SearchProviderLiveAdapter({
    adapterId: entry.targetId,
    providerId: entry.targetId,
    searchUrl: readEnv(`${prefix}_SEARCH_URL`) || defaultSearchUrl(entry.targetId),
    apiKey: requireEnv(entry.targetId, `${prefix}_API_KEY`),
    requestStyle: entry.targetId as SearchProviderRequestStyle,
  });
}

function buildExtractAdapter(entry: WebResearchLiveEntry) {
  if (entry.targetId === 'firecrawl') {
    return new FirecrawlWebExtractLiveAdapter({
      adapterId: 'firecrawl',
      providerId: 'firecrawl',
      scrapeUrl: readEnv('FIRECRAWL_SCRAPE_URL') || 'https://api.firecrawl.dev/v1/scrape',
      crawlUrl: readEnv('FIRECRAWL_CRAWL_URL') || 'https://api.firecrawl.dev/v1/crawl',
      apiKey: requireEnv(entry.targetId, 'FIRECRAWL_API_KEY'),
    });
  }
  if (entry.targetId === 'browser') {
    return new BrowserCaptureWebExtractLiveAdapter({
      adapterId: 'browser',
      providerId: 'browser',
      headless: readEnv('BROWSER_CAPTURE_HEADLESS') !== 'false',
      timeoutMs: Number(readEnv('BROWSER_CAPTURE_TIMEOUT_MS') || 30_000),
    });
  }
  return new ReadabilityWebExtractLiveAdapter({
    adapterId: 'web-readability',
    providerId: 'web-readability',
    userAgent: readEnv('WEB_EXTRACT_USER_AGENT') || undefined,
    maxBytes: Number(readEnv('WEB_EXTRACT_MAX_BYTES') || 1_500_000),
  });
}

function defaultSearchUrl(targetId: string): string {
  if (targetId === 'exa') return 'https://api.exa.ai/search';
  if (targetId === 'tavily') return 'https://api.tavily.com/search';
  return 'https://api.example.invalid/search';
}

function readArg(name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) {
    return direct.slice(name.length + 1);
  }
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  return null;
}

function requireEnv(targetId: string, ...names: string[]): string {
  const value = readEnv(...names);
  if (value) return value;
  throw new Error(`[web-research-live-plane] ${targetId} requires one of: ${names.join(', ')}`);
}

function readEnv(...names: Array<string | null | undefined>): string | null {
  for (const name of names) {
    const normalized = String(name || '').trim();
    if (!normalized) continue;
    const value = String(process.env[normalized] || '').trim();
    if (value) return value;
  }
  return null;
}

function envPrefix(targetId: string): string {
  return targetId.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function receiptHasLiveIo(receipt: unknown): boolean {
  return Boolean(
    receipt
    && typeof receipt === 'object'
    && (receipt as { liveIoPerformed?: unknown }).liveIoPerformed === true,
  );
}
