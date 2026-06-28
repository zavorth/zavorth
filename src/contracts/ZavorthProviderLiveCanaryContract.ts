export * from './provider/ZavorthProviderLiveCanaryContract.js';

export const ZAVORTH_PROVIDER_LIVE_CANARY_PUBLIC_MARKERS = {
  kind: 'provider-live-canary',
  guarantees: {
    noSecretValuesSerialized: true,
    singleWorkerOnly: true,
  },
} as const;
