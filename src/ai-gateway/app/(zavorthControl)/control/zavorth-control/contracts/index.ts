export const ZAVORTH_ZAVORTH_CONTROL_ASSIMILATION_VERSION = 'zavorth-control-assimilation/v1' as const;

export type ZavorthControlRunObservatoryQuery = {
  runId?: string;
  traceId?: string;
  sessionId?: string;
  status?: string | string[];
  limit?: number;
};

export type ZavorthControlRunObservatoryStatusIndex = {
  status: string;
  count: number;
};

export type ZavorthControlRunObservatoryRun = {
  id: string;
  traceId?: string;
  requestId?: string;
  sessionId?: string;
  title?: string;
  status: string;
  summary?: string;
  updatedAt?: string;
  eventCount?: number;
  artifactCount?: number;
  approvalCount?: number;
  matchedBy?: string[];
  [key: string]: unknown;
};

export type ZavorthControlRunObservatorySnapshot = {
  generatedAt: string;
  query: ZavorthControlRunObservatoryQuery;
  totalRuns: number;
  matchedRuns: number;
  indexes: {
    runIds: string[];
    traceIds: string[];
    sessionIds: string[];
    statuses: ZavorthControlRunObservatoryStatusIndex[];
    [key: string]: unknown;
  };
  runs: ZavorthControlRunObservatoryRun[];
  [key: string]: unknown;
};
