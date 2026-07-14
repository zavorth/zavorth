import type {
  AutonomousMissionUsage,
  ZavorthAutonomyBudget,
} from './AutonomousEngineeringPartnerContract.js';

export type AgentRuntimeBudgetRequest = {
  workspaceId: string;
  missionId: string;
  budget: ZavorthAutonomyBudget;
  usage: Partial<AutonomousMissionUsage>;
  requested: Partial<AutonomousMissionUsage>;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
};

export type AgentRuntimeBudgetDecision = {
  allowed: boolean;
  workspaceId: string;
  missionId: string;
  evaluatedAt: string;
  usage: AutonomousMissionUsage;
  remaining: AutonomousMissionUsage;
  blockers: string[];
};

export type AgentMemoryKind = 'fact' | 'preference' | 'inference' | 'instruction';
export type AgentMemoryValidity = 'active' | 'expired' | 'contested' | 'forgotten';

export type AgentMemoryWriteInput = {
  workspaceId: string;
  memoryId: string;
  kind: AgentMemoryKind;
  text: string;
  confidence: number;
  source: {
    runtimeId: string;
    sessionId: string;
    eventIds: string[];
    references: string[];
  };
  expiresAt?: string | null;
};

export type AgentMemoryRecord = AgentMemoryWriteInput & {
  createdAt: string;
  updatedAt: string;
  validity: AgentMemoryValidity;
  contestedReason: string | null;
};

export type AgentHealthStatus = 'healthy' | 'attention' | 'critical' | 'unavailable';

export type AgentHealthDiagnostic = {
  id: string;
  label: string;
  status: AgentHealthStatus;
  summary: string;
  checkedAt: string;
  recommendedAction: string | null;
};

export type AgentHealthSnapshot = {
  workspaceId: string;
  generatedAt: string;
  status: Exclude<AgentHealthStatus, 'unavailable'>;
  diagnostics: AgentHealthDiagnostic[];
  summary: string;
};
