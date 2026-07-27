export const ZAVORTH_INNOVATION_RADAR_CONTRACT_VERSION = '2026-06-02.innovation-radar.v1' as const;

export type ZavorthInnovationRadarCategory =
  | 'agent-runtime'
  | 'channels'
  | 'providers'
  | 'memory'
  | 'tooling'
  | 'sandbox'
  | 'multimodal'
  | 'workflow'
  | 'ux'
  | 'security'
  | 'unknown';

export type ZavorthInnovationRadarSignalInput = {
  id?: string | null;
  sourceId: string;
  sourceLabel?: string | null;
  title: string;
  summary?: string | null;
  url?: string | null;
  publishedAt?: string | null;
  category?: ZavorthInnovationRadarCategory | null;
  tags?: string[] | null;
};

export type ZavorthInnovationRadarSignal = {
  id: string;
  sourceId: string;
  sourceLabel: string;
  title: string;
  summary: string;
  url: string | null;
  publishedAt: string | null;
  category: ZavorthInnovationRadarCategory;
  tags: string[];
};

export type ZavorthInnovationRadarSourceReceipt = {
  id: string;
  kind: 'local-input' | 'json-file' | 'json-feed';
  locator: string;
  status: 'read' | 'blocked' | 'failed';
  signalCount: number;
  summary: string;
};

export type ZavorthInnovationRadarCandidate = {
  id: string;
  status: 'new' | 'watch' | 'known';
  title: string;
  summary: string;
  category: ZavorthInnovationRadarCategory;
  tags: string[];
  noveltyScore: number;
  confidence: number;
  sourceSignalIds: string[];
  sourceIds: string[];
  matchedExistingCapabilityIds: string[];
  reasons: string[];
  nextSafeAction: string;
};

export type ZavorthInnovationRadarSnapshot = {
  contractVersion: typeof ZAVORTH_INNOVATION_RADAR_CONTRACT_VERSION;
  generatedAt: string;
  surface: 'innovation-radar';
  status: 'ready' | 'attention' | 'blocked';
  reportFile: string | null;
  summary: {
    sources: number;
    sourcesRead: number;
    sourcesBlocked: number;
    sourcesFailed: number;
    signals: number;
    candidates: number;
    newCandidates: number;
    watchCandidates: number;
    knownCandidates: number;
  };
  sources: ZavorthInnovationRadarSourceReceipt[];
  candidates: ZavorthInnovationRadarCandidate[];
  safety: {
    observationOnly: true;
    noCapabilityRegistered: true;
    noCapabilityInstalled: true;
    noToolExposed: true;
    noLiveActivation: true;
    httpsFeedsOnly: true;
    feedHostsAllowlisted: true;
    secretsRedacted: true;
  };
  commands: {
    inspect: string;
    inspectJson: string;
    check: string;
    nextAction: string;
  };
};
