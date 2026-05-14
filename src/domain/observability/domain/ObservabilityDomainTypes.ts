export type OperationsHealthPort = {
  readSnapshot?: () => {
    generatedAt: string;
    narrative?: {
      headline?: string | null;
      operatorSummary?: string | null;
    };
  } | null;
  buildSnapshot?: () => {
    generatedAt: string;
    narrative?: {
      headline?: string | null;
      operatorSummary?: string | null;
    };
  } | null;
};

export type ArchitectureScorecardPort = {
  buildSnapshot: () => {
    generatedAt: string;
    summary?: {
      controlPlaneFamiliesReady?: number | null;
      controlPlaneFamiliesTotal?: number | null;
    };
    narrative?: {
      operatorSummary?: string | null;
    };
  } | null;
};

export type IntegrationHealthPort = {
  listDoctorSnapshots: () => unknown[];
};

export type ObservabilityDomainPort = {
  readObservabilityState(): ObservabilityDomainReadModel;
};

export type ObservabilityDomainReadModel = {
  generatedAt: string;
  controlPlanes: number;
  scorecards: number;
  healthSignalsReady: boolean;
  headline: string;
  operatorSummary: string;
  details: string[];
  source: 'observability-stack' | 'seed';
};
