export type ZavorthMaturityStatus = 'mature' | 'needs-attention' | 'blocked';

export type ZavorthMaturityGateStatus = 'passed' | 'attention' | 'blocked';

export type ZavorthMaturityGate = {
  id: string;
  label: string;
  status: ZavorthMaturityGateStatus;
  required: boolean;
  summary: string;
  evidence: string[];
  commands: string[];
  nextAction: string;
};

export type ZavorthMaturityDistinctions = {
  contractReady: boolean;
  dailyUseReady: boolean;
  productionLiveReady: boolean;
  dashboardVisualQaClaimed: boolean;
  stubsAndPartialsExplicit: boolean;
  externalReferenceLeakFree: boolean;
  hostLiveCertificationHonest: boolean;
  dataLifecycleComplete: boolean;
};

export type ZavorthMaturitySnapshot = {
  generatedAt: string;
  contractVersion: 'zavorth-maturity.v1';
  phase: 'product-runtime-maturity';
  status: ZavorthMaturityStatus;
  summary: {
    totalGates: number;
    passed: number;
    attention: number;
    blocked: number;
    dailyUseReady: boolean;
    productionLiveReady: boolean;
    channelContractsReleaseReady: boolean;
    channelContractsCertified: number;
    channelContractsTotal: number;
    liveParityCertified: boolean;
    hostLiveReadyChannels: number;
    hostLiveTotalChannels: number;
    dataLifecycleReleaseReady: boolean;
    dashboardVisualQaEvidenceReady: boolean;
    operationalMaturityOk: boolean;
    stubsOrPartials: number;
    externalReferenceLeaks: number;
  };
  gates: ZavorthMaturityGate[];
  distinctions: ZavorthMaturityDistinctions;
  commands: {
    report: string;
    json: string;
    check: string;
    focusedTests: string[];
    nextStep: string;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};
