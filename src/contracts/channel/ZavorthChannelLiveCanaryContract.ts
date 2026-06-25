export const ZAVORTH_CHANNEL_LIVE_CANARY_VERSION = '2026-06-02.channel-live-canary.v1' as const;

export type ZavorthChannelLiveCanaryStatus = 'ready' | 'attention' | 'blocked';

export type ZavorthChannelLiveCanaryItemStatus =
  | 'live_ready'
  | 'configured_pending_proof'
  | 'needs_allowlist'
  | 'needs_credentials'
  | 'needs_bridge'
  | 'safe_outbox'
  | 'catalog_only'
  | 'internal_ready';

export type ZavorthChannelLiveCanaryItem = {
  id: string;
  label: string;
  status: ZavorthChannelLiveCanaryItemStatus;
  canRunLiveProof: boolean;
  safeDefaultRoute: boolean;
  configuredRequiredEnvKeys: string[];
  missingRequiredEnvKeys: string[];
  allowlistConfigured: boolean;
  requiredEnvKeys: string[];
  allowlistEnvKeys: string[];
  canaryCommand: string;
  nextAction: string;
};

export type ZavorthChannelLiveCanarySnapshot = {
  contractVersion: typeof ZAVORTH_CHANNEL_LIVE_CANARY_VERSION;
  generatedAt: string;
  surface: 'channel-live-canary';
  status: ZavorthChannelLiveCanaryStatus;
  summary: {
    total: number;
    external: number;
    liveReady: number;
    configuredPendingProof: number;
    needsCredentials: number;
    needsAllowlist: number;
    needsBridge: number;
    safeOutbox: number;
    catalogOnly: number;
    canRunLiveProof: number;
    blocked: number;
  };
  items: ZavorthChannelLiveCanaryItem[];
  guarantees: {
    noExternalIoDuringCheck: true;
    liveProofRequiresCredentials: true;
    outboundRequiresAllowlist: true;
    defaultRoutingRequiresProofReceipt: true;
    secretsRedacted: true;
  };
  commands: {
    inspect: 'npm run zavorth:channel-live-canary --silent';
    inspectJson: 'npm run zavorth:channel-live-canary:json --silent';
    check: 'npm run zavorth:channel-live-canary:check --silent';
  };
};
