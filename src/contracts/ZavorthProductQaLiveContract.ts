export * from './release/ZavorthProductQaLiveContract.js';

export const ZAVORTH_PRODUCT_QA_LIVE_PUBLIC_MARKERS = {
  contractVersion: '2026-05-24.product-qa-live-phase-9',
  rowIds: [
    'fresh-install',
    'real-provider',
    'real-telegram',
    'rollback-sandbox',
  ],
  policy: {
    dryRunDoesNotClaimLiveProvider: true,
    dryRunDoesNotClaimLiveTelegram: true,
  },
} as const;
