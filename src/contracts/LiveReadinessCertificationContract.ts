export * from './core/LiveReadinessCertificationContract.js';

export type LiveReadinessCertificationPublicAuditInventory = {
  sourceModules: number;
  providers: number;
  channels: number;
};

export type LiveReadinessCertificationPublicAuditDisallowedStatus = {
  misleadingAdapterBacked: 0;
  dryRunOnly: number;
  templateOnly: number;
  planned: number;
};

export const LIVE_READINESS_CERTIFICATION_PUBLIC_MARKERS = {
  contractVersion: '2026-05-05.live-checkpoint-13',
  gate: 'live-consistency-certification',
  profiles: ['staging-live', 'production-live'],
  inventory: {
    sourceModules: 0 as number,
    providers: 0 as number,
    channels: 0 as number,
  },
  disallowedStatus: {
    misleadingAdapterBacked: 0,
    dryRunOnly: 0 as number,
    templateOnly: 0 as number,
    planned: 0 as number,
  },
  policy: {
    noLiveIoDuringCertification: true,
    productionLiveRequiresOperatorReceiptLedger: true,
  },
} as const;
