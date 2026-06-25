import type { LiveReadinessStatus } from './LiveReadinessContract.js';

export const ZAVORTH_WEB_RESEARCH_LIVE_PLANE_CONTRACT_VERSION = '2026-05-04.live-checkpoint-8' as const;

export type WebResearchLiveTargetId =
  | 'brave'
  | 'exa'
  | 'searxng'
  | 'tavily'
  | 'firecrawl'
  | 'web-readability'
  | 'browser';

export type WebResearchLiveCapability =
  | 'search.query'
  | 'web.extract';

export type WebResearchExtractMode = 'fetch' | 'readability' | 'crawl' | 'browser-capture';

export type WebResearchLiveStatus =
  | 'search-provider-live'
  | 'crawl-provider-live'
  | 'readability-live'
  | 'browser-capture-live'
  | 'blocked';

export type WebResearchLiveAdapterFamily =
  | 'http-search-provider'
  | 'firecrawl-extract'
  | 'readability-fetch'
  | 'browser-capture';

export type WebResearchLiveGateKind =
  | 'provider-adapter'
  | 'firecrawl-adapter'
  | 'readability-extractor'
  | 'browser-capture-adapter'
  | 'citation-artifact'
  | 'extraction-artifact'
  | 'crawl-limits'
  | 'robots-policy'
  | 'network-policy'
  | 'configured-doctor'
  | 'mock-smoke'
  | 'staging-live-smoke'
  | 'redacted-receipt'
  | 'truthful-browser-live';

export type WebResearchLiveGateStatus =
  | 'passed'
  | 'partial'
  | 'missing'
  | 'blocked';

export type WebResearchLiveConfigSchema = {
  requiredEnv: string[];
  optionalEnv: string[];
  secretEnv: string[];
  artifactEnv: string[];
  secretValuesSerialized: false;
};

export type WebResearchLiveGate = {
  kind: WebResearchLiveGateKind;
  status: WebResearchLiveGateStatus;
  evidence: string;
  command: string | null;
};

export type WebResearchLiveReceipt = {
  id: string;
  targetId: WebResearchLiveTargetId;
  status: WebResearchLiveStatus;
  readinessStatus: Extract<LiveReadinessStatus, 'partial-live' | 'configured-only' | 'blocked'>;
  capabilities: WebResearchLiveCapability[];
  adapterFamily: WebResearchLiveAdapterFamily;
  modes: WebResearchExtractMode[];
  liveIoPerformed: false;
  stagingLiveRequiresExplicitCommand: true;
  artifactFirst: true;
  networkPolicyAttached: true;
  secretValuesSerialized: false;
};

export type WebResearchLiveEntry = {
  targetId: WebResearchLiveTargetId;
  status: WebResearchLiveStatus;
  readinessStatus: Extract<LiveReadinessStatus, 'partial-live' | 'configured-only' | 'blocked'>;
  capabilities: WebResearchLiveCapability[];
  adapterFamily: WebResearchLiveAdapterFamily;
  modes: WebResearchExtractMode[];
  adapterTarget: string;
  serviceTargets: string[];
  configSchema: WebResearchLiveConfigSchema;
  gates: WebResearchLiveGate[];
  gaps: string[];
  doctorCommand: string;
  stagingLiveSmokeCommand: string;
  receipt: WebResearchLiveReceipt;
};

export type WebResearchLivePlaneSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_WEB_RESEARCH_LIVE_PLANE_CONTRACT_VERSION;
  phase: 'Dashboard controls - Research, Web Extraction And Browser Live Plane';
  status: 'closed' | 'attention' | 'blocked';
  summary: {
    targets: 7;
    searchProviderTargets: number;
    webExtractTargets: number;
    firecrawlTargets: number;
    readabilityTargets: number;
    browserCaptureTargets: number;
    citationArtifactTargets: number;
    extractionArtifactTargets: number;
    crawlPolicyTargets: number;
    robotsPolicyTargets: number;
    stagingLiveSmokeCommands: number;
    redactedReceipts: number;
    blocked: number;
    browserExtractionMarkedLiveByNoNetworkPlan: false;
    liveIoRequiredByStage8Check: false;
    secretValuesSerialized: false;
  };
  entries: WebResearchLiveEntry[];
  receipts: WebResearchLiveReceipt[];
  policy: {
    noLiveIoDuringStage8Check: true;
    searchProviderChoiceRequired: true;
    citationArtifactsRequired: true;
    extractionArtifactsRequired: true;
    crawlLimitsRequired: true;
    robotsPolicyRequired: true;
    browserCaptureCannotBeNoNetworkPlan: true;
    stagingLiveRequiresExplicitOperatorCommand: true;
    noSecretsSerialized: true;
  };
  commands: {
    check: 'npm run web-research-live-plane:check --silent';
    doctor: 'npm run web-research-live-plane -- --profile configured';
    stagingLiveSmoke: 'npm run web-research-live-plane -- --profile staging-live --target <target> --confirm-live-io';
    focusedTests: string[];
    typecheck: 'npm run runtime:check --silent';
    nextStage: 'Certification matrix - File, Document, Diff And Prose Live Plane';
  };
};
