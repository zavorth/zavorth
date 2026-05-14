export type SelfmodRuntimeRiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export type SelfmodRollbackConfidenceLabel = 'low' | 'medium' | 'high';

export type SelfmodPatternSignalStrength = 'low' | 'medium' | 'high';

export type SelfmodResourceDelta = {
  ramIdleMb: number;
  diskMb: number;
  processCount: number;
  summary: string;
  notes: string[];
};

export type SelfmodRuntimeRiskReport = {
  level: SelfmodRuntimeRiskLevel;
  score: number;
  reasons: string[];
  requiresRestart: boolean;
  requiresSupervisorAttention: boolean;
  launcherTouch: boolean;
};

export type SelfmodCompanionImpact = {
  level: 'none' | 'low' | 'moderate' | 'high';
  companionIds: string[];
  summary: string;
  notes: string[];
  recommendedActions: string[];
};

export type SelfmodOptimizationOpportunity = {
  id: string;
  category: 'runtime' | 'workspace' | 'companion' | 'watchers' | 'ui';
  title: string;
  summary: string;
  recommendedCommand?: string;
  appliesBecause: string[];
};

export type SelfmodPatternSignal = {
  key: string;
  summary: string;
  strength: SelfmodPatternSignalStrength;
};

export type SelfmodOptimizationAnalysis = {
  resourceDelta: SelfmodResourceDelta;
  runtimeRisk: SelfmodRuntimeRiskReport;
  companionImpact: SelfmodCompanionImpact;
  rollbackConfidence: number;
  rollbackConfidenceLabel: SelfmodRollbackConfidenceLabel;
  opportunities: SelfmodOptimizationOpportunity[];
  patternSignals: SelfmodPatternSignal[];
};

export type SelfmodPatternMemoryEntry = {
  key: string;
  goalSample: string;
  pathSignature: string[];
  previewCount: number;
  applyCount: number;
  rollbackCount: number;
  averageRollbackConfidence: number;
  lastRuntimeRiskLevel: SelfmodRuntimeRiskLevel;
  lastSeenAt: string;
};

export type SelfmodPatternMemorySnapshot = {
  updatedAt: string;
  entries: SelfmodPatternMemoryEntry[];
};
