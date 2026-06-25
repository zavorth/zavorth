export type ZavorthCompanionDependencyId =
  | 'wsl'
  | 'docker-desktop'
  | 'zavorthBridge'
  | 'codex-companion';

export type ZavorthImpactExposure = 'none' | 'local' | 'network' | 'public';

export type ZavorthExecutionBudget = {
  ramMb: number;
  cpuPercent: number;
  diskMb: number;
  processCount: number;
  externalExposure: ZavorthImpactExposure;
  recurring: boolean;
  companionDependencies: ZavorthCompanionDependencyId[];
  capabilityIds: string[];
  fallback: string;
  notes: string[];
};

export type CapabilityImpactEstimate = {
  capabilityId: string;
  label: string;
  approvalRequired: boolean;
  activationMode: 'builtin' | 'lazy' | 'sidecar';
  ramMb: number;
  cpuPercent: number;
  diskMb: number;
  processCount: number;
  externalExposure: ZavorthImpactExposure;
  companionDependencies: ZavorthCompanionDependencyId[];
  fallback: string;
  notes: string[];
};

export type CompanionImpactEstimate = {
  companionId: ZavorthCompanionDependencyId;
  actionId: 'inspect' | 'trim' | 'hibernate' | 'resume' | 'stop-idle' | 'restart-safe';
  requiresApproval: boolean;
  ramDeltaMb: number;
  cpuDeltaPercent: number;
  diskDeltaMb: number;
  processDelta: number;
  externalExposure: ZavorthImpactExposure;
  fallback: string;
  notes: string[];
};

export type TaskResourceImpact = {
  generatedAt: string;
  taskKind: 'chat' | 'capability' | 'companion';
  intent: string;
  heavy: boolean;
  approvalRequired: boolean;
  summary: string;
  userFacingSummary: string;
  budget: ZavorthExecutionBudget;
  capabilityEstimates: CapabilityImpactEstimate[];
  companionEstimates: CompanionImpactEstimate[];
  warnings: string[];
};
