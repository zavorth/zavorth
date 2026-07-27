export const ZAVORTH_HOST_LIVE_CERTIFICATION_VERSION = 'zavorth-host-live-certification.v1' as const;

export type ZavorthHostLiveChannelStatus =
  | 'live-ready'
  | 'host-ready'
  | 'contract-only'
  | 'local-or-partial'
  | 'blocked';

export type ZavorthHostLiveRequirementStatus = 'pass' | 'fail' | 'warning' | 'na';

export type ZavorthHostLiveRequirement = {
  id: string;
  label: string;
  status: ZavorthHostLiveRequirementStatus;
  requiredForLive: boolean;
  detail: string;
  evidence: string[];
};

export type ZavorthHostLiveChannelEntry = {
  channelId: string;
  label: string;
  status: ZavorthHostLiveChannelStatus;
  contractReady: boolean;
  hostReady: boolean;
  productionLiveReady: boolean;
  providerConfigured: boolean;
  credentialsOrBridgeHealthy: boolean;
  webhookReachableOrNotRequired: boolean;
  recipientsBounded: boolean;
  outboundAllowed: boolean;
  localOrPartial: boolean;
  provider: string | null;
  transport: string;
  setupMode: string | null;
  readiness: string;
  implementationState: string;
  lastHealth: string | null;
  blockers: string[];
  nextAction: string;
  requirements: ZavorthHostLiveRequirement[];
};

export type ZavorthHostLiveCertificationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_HOST_LIVE_CERTIFICATION_VERSION;
  summary: {
    total: number;
    liveReady: number;
    hostReady: number;
    contractOnly: number;
    localOrPartial: number;
    blocked: number;
    productionLiveCertified: boolean;
  };
  entries: ZavorthHostLiveChannelEntry[];
  selected: ZavorthHostLiveChannelEntry | null;
  distinctions: {
    contractReadyIsNotLive: boolean;
    noExternalSendDuringCertification: boolean;
    localsAndPartialsAreVisible: boolean;
    liveRequiresBoundedRecipients: boolean;
    liveRequiresProviderEvidence: boolean;
  };
  commands: {
    report: string;
    json: string;
    check: string;
    nextStep: string;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};
