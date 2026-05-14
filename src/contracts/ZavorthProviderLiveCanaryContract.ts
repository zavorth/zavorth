export const ZAVORTH_PROVIDER_LIVE_CANARY_VERSION =
  '2026-05-10.provider-live-canary' as const;

export type ZavorthProviderLiveCanaryStatus = 'passed' | 'attention' | 'blocked';

export type ZavorthProviderLiveCanaryProviderEntry = {
  providerName: string;
  available: boolean;
  selected: boolean;
  reason: string;
};

export type ZavorthProviderLiveCanarySnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_PROVIDER_LIVE_CANARY_VERSION;
  source: 'ZavorthProviderLiveCanaryService';
  status: ZavorthProviderLiveCanaryStatus;
  mode: 'dry-run' | 'live';
  selectedProviderName: string | null;
  selectedModelName: string | null;
  timeoutMs: number;
  canaryMarker: string;
  providerEntries: ZavorthProviderLiveCanaryProviderEntry[];
  live: {
    executed: boolean;
    completed: boolean;
    markerObserved: boolean;
    subagentStatus: string | null;
    workerResults: number;
    failedWorkerResults: number;
    externalIoPerformed: boolean;
    workspaceMutationPerformed: boolean;
    upstreamRuntimeCodeExecuted: boolean;
    error: string | null;
  };
  guarantees: {
    noSecretValuesSerialized: true;
    noWorkspaceMutationRequested: true;
    noToolsRequestedByCanary: true;
    singleWorkerOnly: true;
    boundedTimeout: true;
    providerCredentialsOnlyPresenceChecked: true;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
  commands: {
    dryRun: 'npm run zavorth:provider-live-canary';
    live: 'npm run zavorth:provider-live-canary -- --run-live';
    json: 'npm run zavorth:provider-live-canary:json -- --run-live';
    check: 'npm run zavorth:provider-live-canary:check --silent';
  };
};
