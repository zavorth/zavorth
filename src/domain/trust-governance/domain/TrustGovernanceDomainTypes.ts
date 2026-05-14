export type TrustPlaneSnapshotPort = {
  buildSnapshot: () => {
    generatedAt: string;
    summary?: {
      posture?: string | null;
      pendingApprovals?: number | null;
      highRiskCapabilities?: number | null;
      skillAllowedSources?: number | null;
    };
    narrative?: {
      headline?: string | null;
      operatorSummary?: string | null;
    };
  } | null;
};

export type GovernanceControlPlanePort = {
  buildSnapshot: (input?: { limit?: number | null }) => {
    generatedAt: string;
    summary?: {
      posture?: string | null;
      decisions?: number | null;
      readyChannels?: number | null;
      totalChannels?: number | null;
      remoteAttention?: number | null;
    };
    narrative?: {
      headline?: string | null;
      operatorSummary?: string | null;
    };
  } | null;
};

export type TrustGovernanceReadinessInput = {
  limit?: number | null;
};

export type TrustGovernanceDomainPort = {
  readTrustState(input?: TrustGovernanceReadinessInput): TrustGovernanceDomainReadModel;
};

export type TrustGovernanceDomainReadModel = {
  generatedAt: string;
  trustReady: boolean;
  governanceReady: boolean;
  policiesTracked: number;
  headline: string;
  operatorSummary: string;
  details: string[];
  source: 'planes' | 'seed';
};
