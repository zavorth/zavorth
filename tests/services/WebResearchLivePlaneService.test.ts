import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  BrowserCaptureWebExtractLiveAdapter,
  FirecrawlWebExtractLiveAdapter,
  ReadabilityWebExtractLiveAdapter,
  SearchProviderLiveAdapter,
} from '../../src/adapters/web/WebResearchLiveAdapters.js';
import { SearchQueryService } from '../../src/services/SearchQueryService.js';
import { WebExtractService } from '../../src/services/WebExtractService.js';
import { WebResearchLivePlaneService } from '../../src/services/WebResearchLivePlaneService.js';

const jsonResponse = (payload: Record<string, unknown>, init: { status?: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: init.status || 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });

const htmlResponse = (html: string) =>
  new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
    },
  });

describe('WebResearchLivePlaneService Dashboard controls', () => {
  let artifactDir: string;

  beforeEach(async () => {
    artifactDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-web-research-live-plane-'));
  });

  afterEach(async () => {
    await fs.promises.rm(artifactDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('closes Dashboard controls research, web extraction and browser gates without live IO', () => {
    const snapshot = new WebResearchLivePlaneService({
      now: () => new Date('2026-05-04T23:45:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.live-checkpoint-8');
    expect(snapshot.phase).toBe('Dashboard controls - Research, Web Extraction And Browser Live Plane');
    expect(snapshot.status).toBe('closed');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        targets: 7,
        searchProviderTargets: 4,
        webExtractTargets: 3,
        firecrawlTargets: 1,
        readabilityTargets: 1,
        browserCaptureTargets: 1,
        citationArtifactTargets: 4,
        extractionArtifactTargets: 3,
        crawlPolicyTargets: 7,
        robotsPolicyTargets: 7,
        stagingLiveSmokeCommands: 7,
        redactedReceipts: 7,
        blocked: 0,
        browserExtractionMarkedLiveByNoNetworkPlan: false,
        liveIoRequiredByStage8Check: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        noLiveIoDuringStage8Check: true,
        searchProviderChoiceRequired: true,
        citationArtifactsRequired: true,
        extractionArtifactsRequired: true,
        browserCaptureCannotBeNoNetworkPlan: true,
      }),
    );
  });

  it('gives every research target config, doctor, staging smoke and receipt', () => {
    const snapshot = new WebResearchLivePlaneService().buildSnapshot();
    expect(snapshot.entries.map((entry) => entry.targetId).sort()).toEqual([
      'brave',
      'browser',
      'exa',
      'firecrawl',
      'searxng',
      'tavily',
      'web-readability',
    ]);
    for (const entry of snapshot.entries) {
      expect(entry.doctorCommand).toContain('--profile configured');
      expect(entry.stagingLiveSmokeCommand).toContain('--confirm-live-io');
      expect(entry.gates.map((gate) => gate.kind)).toContain('crawl-limits');
      expect(entry.gates.map((gate) => gate.kind)).toContain('robots-policy');
      expect(entry.receipt).toEqual(
        expect.objectContaining({
          artifactFirst: true,
          liveIoPerformed: false,
          stagingLiveRequiresExplicitCommand: true,
          networkPolicyAttached: true,
          secretValuesSerialized: false,
        }),
      );
    }
    expect(snapshot.entries.find((entry) => entry.targetId === 'browser')?.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'truthful-browser-live',
          status: 'passed',
        }),
      ]),
    );
  });

  it('chooses among multiple configured search providers', async () => {
    const braveFetch = jest.fn(async () => jsonResponse({
      web: {
        results: [{
          title: 'Brave result',
          url: 'https://brave.example.test/result',
          description: 'Brave snippet',
        }],
      },
    })) as unknown as typeof fetch;
    const tavilyFetch = jest.fn(async () => jsonResponse({
      results: [{
        title: 'Tavily result',
        url: 'https://tavily.example.test/result',
        content: 'Tavily snippet',
      }],
    })) as unknown as typeof fetch;
    const service = new SearchQueryService({
      adapters: [
        new SearchProviderLiveAdapter({
          adapterId: 'brave',
          providerId: 'brave',
          searchUrl: 'https://brave.example.test/search',
          requestStyle: 'brave',
          apiKey: 'brave-secret',
          authHeaderName: 'X-Subscription-Token',
          authScheme: null,
        }, { fetchImpl: braveFetch }),
        new SearchProviderLiveAdapter({
          adapterId: 'tavily',
          providerId: 'tavily',
          searchUrl: 'https://tavily.example.test/search',
          requestStyle: 'tavily',
          apiKey: 'tavily-secret',
        }, { fetchImpl: tavilyFetch }),
      ],
    });

    const result = await service.search({
      query: 'phase 8 provider choice',
      mode: 'quick',
      extractPages: false,
      providerHints: {
        providerId: 'tavily',
      },
    });

    expect(result.ok).toBe(true);
    expect(braveFetch).not.toHaveBeenCalled();
    expect(tavilyFetch).toHaveBeenCalledTimes(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        title: 'Tavily result',
        providerEvidence: expect.objectContaining({
          providerId: 'tavily',
        }),
      }),
    );
  });

  it('stores readability extraction as a web artifact', async () => {
    const html = '<html><head><title>Dashboard controls Article</title></head><body><article><p>Hello Zavorth research.</p><a href="/next">next</a></article></body></html>';
    const adapter = new ReadabilityWebExtractLiveAdapter({
      adapterId: 'web-readability',
      providerId: 'web-readability',
    }, {
      fetchImpl: (async () => htmlResponse(html)) as typeof fetch,
    });
    const service = new WebExtractService({ adapters: [adapter], artifactDir });

    const result = await service.executeLive({
      mode: 'readability',
      target: 'https://example.test/article',
      adapterId: 'web-readability',
    });

    expect(result.ok).toBe(true);
    expect(result.artifact).toEqual(
      expect.objectContaining({
        contentType: 'application/json',
      }),
    );
    const stored = JSON.parse(await fs.promises.readFile(result.artifact!.storageRef, 'utf8'));
    expect(stored).toEqual(
      expect.objectContaining({
        title: 'Dashboard controls Article',
        text: expect.stringContaining('Hello Zavorth research.'),
        secretValuesSerialized: false,
      }),
    );
    expect(stored.links).toEqual(['https://example.test/next']);
  });

  it('stores Firecrawl crawl output as a web artifact', async () => {
    const adapter = new FirecrawlWebExtractLiveAdapter({
      adapterId: 'firecrawl',
      providerId: 'firecrawl',
      scrapeUrl: 'https://firecrawl.example.test/scrape',
      crawlUrl: 'https://firecrawl.example.test/crawl',
      apiKey: 'fire-secret',
    }, {
      fetchImpl: (async () => jsonResponse({
        data: {
          markdown: '# Crawled\nFirecrawl content',
          metadata: {
            title: 'Firecrawl Title',
          },
          links: ['https://example.test/a'],
        },
      })) as typeof fetch,
    });
    const service = new WebExtractService({ adapters: [adapter], artifactDir });

    const result = await service.executeLive({
      mode: 'crawl',
      target: 'https://example.test',
      adapterId: 'firecrawl',
      limits: {
        maxPages: 2,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.policyDecision).toEqual(
      expect.objectContaining({
        robotsPolicy: 'respect',
        maxPages: 2,
      }),
    );
    const stored = JSON.parse(await fs.promises.readFile(result.artifact!.storageRef, 'utf8'));
    expect(stored).toEqual(
      expect.objectContaining({
        title: 'Firecrawl Title',
        text: '# Crawled\nFirecrawl content',
      }),
    );
  });

  it('runs browser capture only through an explicit live adapter path', async () => {
    const adapter = new BrowserCaptureWebExtractLiveAdapter({
      adapterId: 'browser',
      providerId: 'browser',
    }, async (input) => ({
      title: 'Browser Captured',
      text: 'Browser visible text',
      html: '<html><head><title>Browser Captured</title></head><body>Browser visible text</body></html>',
      links: ['https://example.test/inside'],
      screenshot: Buffer.from('png-bytes'),
      contentType: 'text/html',
      providerEvidence: {
        providerId: 'browser',
        mode: input.mode,
        target: input.target,
        metadata: {
          browserCapture: true,
          secretValuesSerialized: false,
        },
      },
    }));
    const service = new WebExtractService({ adapters: [adapter], artifactDir });

    const blocked = await service.executeLive({
      mode: 'browser-capture',
      target: 'https://example.test/browser',
      adapterId: 'browser',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/browser-capture requires explicit browser launch approval/);

    const result = await service.executeLive({
      mode: 'browser-capture',
      target: 'https://example.test/browser',
      adapterId: 'browser',
      allowBrowserLaunch: true,
    });

    expect(result.ok).toBe(true);
    expect(result.artifact).toEqual(expect.objectContaining({ contentType: 'application/json' }));
    expect(result.screenshotArtifact).toEqual(expect.objectContaining({ contentType: 'image/png' }));
    expect(await fs.promises.readFile(result.screenshotArtifact!.storageRef, 'utf8')).toBe('png-bytes');
  });
});
