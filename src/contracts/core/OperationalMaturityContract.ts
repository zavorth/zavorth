export type OperationalMaturityStatus =
  | 'stable'
  | 'official-but-provisioned'
  | 'experimental'
  | 'draft'
  | 'deprecated';

export type OperationalMaturityCommandKind = 'npm-script' | 'cli' | 'direct';

export type OperationalMaturityCommand = {
  kind: OperationalMaturityCommandKind;
  value: string;
};

export type OperationalMaturityCapability = {
  id: string;
  label: string;
  status: OperationalMaturityStatus;
  role: string;
  runtimeTruth: string;
  publicStatus: string;
  ownerLayer: string;
  isPrimaryBrain: boolean;
  isParallelRuntime: boolean;
  evidence: string[];
  commands: OperationalMaturityCommand[];
  limitations: string[];
  nextStep: string;
};

export type OperationalMaturityMatrix = {
  schemaVersion: 'operational-maturity.v1';
  statuses: OperationalMaturityStatus[];
  capabilities: OperationalMaturityCapability[];
};

export type OperationalMaturitySummary = {
  total: number;
  stable: number;
  officialButProvisioned: number;
  experimental: number;
  draft: number;
  deprecated: number;
  needsConfiguration: number;
};

export type OperationalMaturitySnapshot = {
  generatedAt: string;
  schemaVersion: string;
  source: string;
  summary: OperationalMaturitySummary;
  capabilities: OperationalMaturityCapability[];
  consoleRows: Array<{
    id: string;
    label: string;
    status: OperationalMaturityStatus;
    displayStatus: string;
    role: string;
    nextStep: string;
  }>;
  invariants: {
    nexusIsSurfaceOnly: boolean;
    echoIsEdgeLayerOnly: boolean;
    noParallelRuntimeClaim: boolean;
  };
};

export type OperationalMaturityValidationIssue = {
  severity: 'error' | 'warning';
  id: string;
  message: string;
  target?: string;
};

export type OperationalMaturityValidationReport = {
  ok: boolean;
  checkedAt: string;
  issues: OperationalMaturityValidationIssue[];
  snapshot: OperationalMaturitySnapshot;
};
