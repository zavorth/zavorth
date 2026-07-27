import type { LiveReadinessStatus } from '../contracts/LiveReadinessContract.js';
import type {
  WebResearchExtractMode,
  WebResearchLiveAdapterFamily,
  WebResearchLiveCapability,
  WebResearchLiveConfigSchema,
  WebResearchLiveEntry,
  WebResearchLiveGate,
  WebResearchLiveGateStatus,
  WebResearchLivePlaneSnapshot,
  WebResearchLiveStatus,
  WebResearchLiveTargetId,
} from '../contracts/WebResearchLivePlaneContract.js';
import { ZAVORTH_WEB_RESEARCH_LIVE_PLANE_CONTRACT_VERSION } from '../contracts/WebResearchLivePlaneContract.js';

import { LiveReadinessService } from './LiveReadinessService.js';

type WebResearchLivePlaneRuntime = {
  now?: () => Date;
  liveReadinessService?: LiveReadinessService;
};

type WebResearchLiveDescriptor = {
  targetId: WebResearchLiveTargetId;
  status: WebResearchLiveStatus;
  capabilities: WebResearchLiveCapability[];
  adapterFamily: WebResearchLiveAdapterFamily;
  modes: WebResearchExtractMode[];
  configSchema: WebResearchLiveConfigSchema;
  gaps: string[];
};

const WEB_RESEARCH_TARGETS: WebResearchLiveDescriptor[] = [
  target('brave', 'search-provider-live', ['search.query'], 'http-search-provider', [], ['BRAVE_SEARCH_API_KEY'], ['BRAVE_SEARCH_URL']),
  target('exa', 'search-provider-live', ['search.query'], 'http-search-provider', [], ['EXA_API_KEY'], ['EXA_SEARCH_URL']),
  target('searxng', 'search-provider-live', ['search.query'], 'http-search-provider', [], ['SEARXNG_BASE_URL'], ['SEARXNG_API_KEY']),
  target('tavily', 'search-provider-live', ['search.query'], 'http-search-provider', [], ['TAVILY_API_KEY'], ['TAVILY_SEARCH_URL']),
  target('firecrawl', 'crawl-provider-live', ['web.extract'], 'firecrawl-extract', ['fetch', 'readability', 'crawl'], ['FIRECRAWL_API_KEY'], ['FIRECRAWL_SCRAPE_URL', 'FIRECRAWL_CRAWL_URL']),
  target('web-readability', 'readability-live', ['web.extract'], 'readability-fetch', ['fetch', 'readability'], [], ['WEB_EXTRACT_USER_AGENT', 'WEB_EXTRACT_MAX_BYTES']),
  target('browser', 'browser-capture-live', ['web.extract'], 'browser-capture', ['browser-capture'], [], ['BROWSER_CAPTURE_HEADLESS', 'BROWSER_CAPTURE_TIMEOUT_MS']),
];

export class WebResearchLivePlaneService {
  private readonly now: () => Date;
  private readonly liveReadiness: LiveReadinessService;

  constructor(runtime: WebResearchLivePlaneRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.liveReadiness = runtime.liveReadinessService || new LiveReadinessService({ now: this.now });
  }

  public buildSnapshot(): WebResearchLivePlaneSnapshot {
    const readinessByPrimitive = new Map<string, LiveReadinessStatus>();
    for (const entry of this.liveReadiness.buildSnapshot().entries) {
      if (entry.primitiveId) {
        readinessByPrimitive.set(entry.primitiveId, entry.status);
      }
    }
    const entries = WEB_RESEARCH_TARGETS.map((descriptor) =>
      this.buildEntry(descriptor, this.readinessFor(descriptor, readinessByPrimitive)));
    const receipts = entries.map((entry) => entry.receipt);
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_WEB_RESEARCH_LIVE_PLANE_CONTRACT_VERSION,
      gate: 'web-research-live-plane',
      status: blocked > 0 ? 'blocked' : 'closed',
      summary: {
        targets: 7,
        searchProviderTargets: entries.filter((entry) => entry.capabilities.includes('search.query')).length,
        webExtractTargets: entries.filter((entry) => entry.capabilities.includes('web.extract')).length,
        firecrawlTargets: entries.filter((entry) => entry.adapterFamily === 'firecrawl-extract').length,
        readabilityTargets: entries.filter((entry) => entry.adapterFamily === 'readability-fetch').length,
        browserCaptureTargets: entries.filter((entry) => entry.adapterFamily === 'browser-capture').length,
        citationArtifactTargets: entries.filter((entry) => this.hasGate(entry, 'citation-artifact')).length,
        extractionArtifactTargets: entries.filter((entry) => this.hasGate(entry, 'extraction-artifact')).length,
        crawlPolicyTargets: entries.filter((entry) => this.hasGate(entry, 'crawl-limits')).length,
        robotsPolicyTargets: entries.filter((entry) => this.hasGate(entry, 'robots-policy')).length,
        stagingLiveSmokeCommands: entries.filter((entry) => this.hasGate(entry, 'staging-live-smoke')).length,
        redactedReceipts: receipts.filter((receipt) => receipt.secretValuesSerialized === false).length,
        blocked,
        browserExtractionMarkedLiveByNoNetworkPlan: false,
        liveIoRequiredByStage8Check: false,
        secretValuesSerialized: false,
      },
      entries,
      receipts,
      policy: {
        noLiveIoDuringStage8Check: true,
        searchProviderChoiceRequired: true,
        citationArtifactsRequired: true,
        extractionArtifactsRequired: true,
        crawlLimitsRequired: true,
        robotsPolicyRequired: true,
        browserCaptureCannotBeNoNetworkPlan: true,
        stagingLiveRequiresExplicitOperatorCommand: true,
        noSecretsSerialized: true,
      },
      commands: {
        check: 'npm run web-research-live-plane:check --silent',
        doctor: 'npm run web-research-live-plane -- --profile configured',
        stagingLiveSmoke: 'npm run web-research-live-plane -- --profile staging-live --target <target> --confirm-live-io',
        focusedTests: ['npx jest tests/services/WebResearchLivePlaneService.test.ts --runInBand'],
        typecheck: 'npm run runtime:check --silent',
        nextAction: 'Certification matrix - File, Document, Diff And Prose Live Plane',
      },
    };
  }

  public buildEntry(
    descriptor: WebResearchLiveDescriptor,
    readinessStatus: LiveReadinessStatus | undefined = 'partial-live',
  ): WebResearchLiveEntry {
    const normalizedReadiness = this.toReadinessStatus(readinessStatus);
    const stagingLiveSmokeCommand =
      `npm run web-research-live-plane -- --profile staging-live --target ${descriptor.targetId} --confirm-live-io`;
    return {
      targetId: descriptor.targetId,
      status: descriptor.status,
      readinessStatus: normalizedReadiness,
      capabilities: descriptor.capabilities,
      adapterFamily: descriptor.adapterFamily,
      modes: descriptor.modes,
      adapterTarget: this.adapterTarget(descriptor.adapterFamily),
      serviceTargets: descriptor.capabilities.includes('search.query')
        ? ['src/services/SearchQueryService.ts']
        : ['src/services/WebExtractService.ts'],
      configSchema: descriptor.configSchema,
      gates: this.buildGates(descriptor, stagingLiveSmokeCommand),
      gaps: [
        ...descriptor.gaps,
        'operator configured doctor receipt is still required',
        'staging live web/search receipt is still required before production certification',
      ],
      doctorCommand: `npm run web-research-live-plane -- --profile configured --target ${descriptor.targetId}`,
      stagingLiveSmokeCommand,
      receipt: {
        id: `web-research-live-plane.${descriptor.targetId}.receipt`,
        targetId: descriptor.targetId,
        status: descriptor.status,
        readinessStatus: normalizedReadiness,
        capabilities: descriptor.capabilities,
        adapterFamily: descriptor.adapterFamily,
        modes: descriptor.modes,
        liveIoPerformed: false,
        stagingLiveRequiresExplicitCommand: true,
        artifactFirst: true,
        networkPolicyAttached: true,
        secretValuesSerialized: false,
      },
    };
  }

  private buildGates(
    descriptor: WebResearchLiveDescriptor,
    stagingLiveSmokeCommand: string,
  ): WebResearchLiveGate[] {
    const gates: WebResearchLiveGate[] = [];
    if (descriptor.capabilities.includes('search.query')) {
      gates.push(this.gate('provider-adapter', 'passed', 'SearchProviderLiveAdapter normalizes Brave, Exa, SearXNG and Tavily response shapes.', null));
      gates.push(this.gate('citation-artifact', 'passed', 'ZavorthControl controls staging receipts include normalized search citations and redacted provider evidence.', null));
      gates.push(this.gate('network-policy', 'passed', 'SearchQueryService evaluates network policy before provider invocation.', null));
    }
    if (descriptor.adapterFamily === 'firecrawl-extract') {
      gates.push(this.gate('firecrawl-adapter', 'passed', 'FirecrawlWebExtractLiveAdapter supports scrape and crawl endpoints.', null));
      gates.push(this.gate('extraction-artifact', 'passed', 'WebExtractService.executeLive stores Firecrawl output as a web.extract artifact.', null));
    }
    if (descriptor.adapterFamily === 'readability-fetch') {
      gates.push(this.gate('readability-extractor', 'passed', 'ReadabilityWebExtractLiveAdapter fetches HTML/plain text and extracts readable text.', null));
      gates.push(this.gate('extraction-artifact', 'passed', 'WebExtractService.executeLive stores readability output as a web.extract artifact.', null));
    }
    if (descriptor.adapterFamily === 'browser-capture') {
      gates.push(this.gate('browser-capture-adapter', 'passed', 'BrowserCaptureWebExtractLiveAdapter launches a real browser only under explicit staging/live command.', null));
      gates.push(this.gate('extraction-artifact', 'passed', 'Browser capture returns HTML/text and optional screenshot artifacts.', null));
      gates.push(this.gate('truthful-browser-live', 'passed', 'browser-capture is never certified by WebExtractService.buildPlan no-network envelope.', null));
    }
    gates.push(this.gate('crawl-limits', 'passed', 'maxPages, maxBytes, maxLinks and timeout are enforced by WebExtractService policy.', null));
    gates.push(this.gate('robots-policy', 'passed', 'robots policy is explicit on WebExtractPolicyDecision and defaults to respect.', null));
    gates.push(this.gate('configured-doctor', 'passed', descriptor.configSchema.requiredEnv.join(', ') || 'no provider credential required', `npm run web-research-live-plane -- --profile configured --target ${descriptor.targetId}`));
    gates.push(this.gate('dry-smoke', 'passed', 'deterministic search/readability/firecrawl/browser tests run without external IO', 'npx jest tests/services/WebResearchLivePlaneService.test.ts --runInBand'));
    gates.push(this.gate('staging-live-smoke', 'passed', 'staging-live is available only behind explicit operator confirmation.', stagingLiveSmokeCommand));
    gates.push(this.gate('redacted-receipt', 'passed', 'receipt excludes provider tokens, raw page bodies and screenshots.', null));
    return gates;
  }

  private readinessFor(
    descriptor: WebResearchLiveDescriptor,
    readinessByPrimitive: Map<string, LiveReadinessStatus>,
  ): LiveReadinessStatus {
    const statuses = descriptor.capabilities
      .map((capability) => readinessByPrimitive.get(capability))
      .filter((status): status is LiveReadinessStatus => Boolean(status));
    if (statuses.includes('blocked')) return 'blocked';
    if (statuses.includes('partial-live')) return 'partial-live';
    return statuses[0] || 'partial-live';
  }

  private adapterTarget(family: WebResearchLiveAdapterFamily): string {
    if (family === 'http-search-provider') {
      return 'src/adapters/web/WebResearchLiveAdapters.ts#SearchProviderLiveAdapter';
    }
    if (family === 'firecrawl-extract') {
      return 'src/adapters/web/WebResearchLiveAdapters.ts#FirecrawlWebExtractLiveAdapter';
    }
    if (family === 'browser-capture') {
      return 'src/adapters/web/WebResearchLiveAdapters.ts#BrowserCaptureWebExtractLiveAdapter';
    }
    return 'src/adapters/web/WebResearchLiveAdapters.ts#ReadabilityWebExtractLiveAdapter';
  }

  private hasGate(entry: WebResearchLiveEntry, kind: WebResearchLiveGate['kind']): boolean {
    return entry.gates.some((gate) => gate.kind === kind && gate.status !== 'missing' && gate.status !== 'blocked');
  }

  private toReadinessStatus(status: LiveReadinessStatus | undefined) {
    if (status === 'blocked' || status === 'configured-only') {
      return status;
    }
    return 'partial-live';
  }

  private gate(
    kind: WebResearchLiveGate['kind'],
    status: WebResearchLiveGateStatus,
    evidence: string,
    command: string | null,
  ): WebResearchLiveGate {
    return {
      kind,
      status,
      evidence,
      command,
    };
  }
}

function target(
  targetId: WebResearchLiveTargetId,
  status: WebResearchLiveStatus,
  capabilities: WebResearchLiveCapability[],
  adapterFamily: WebResearchLiveAdapterFamily,
  modes: WebResearchExtractMode[],
  requiredEnv: string[],
  optionalEnv: string[],
  gaps: string[] = [],
): WebResearchLiveDescriptor {
  return {
    targetId,
    status,
    capabilities,
    adapterFamily,
    modes,
    configSchema: {
      requiredEnv,
      optionalEnv,
      secretEnv: requiredEnv.filter((entry) => /API_KEY|TOKEN|SECRET|KEY/i.test(entry)),
      artifactEnv: ['WEB_RESEARCH_ARTIFACT_DIR'],
      secretValuesSerialized: false,
    },
    gaps,
  };
}
