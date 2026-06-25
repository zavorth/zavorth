import type { ZavorthProductMode, ZavorthProductModeSnapshot } from '../services/ProductModeService.js';
import type { TaskResourceImpact } from './TaskResourcePlannerContract.js';

export type ModeEscalationScope = 'once' | 'session' | 'host';

export type ModeEscalationRequestStatus = 'pending' | 'approved' | 'rejected';

export type ModeEscalationGrantStatus = 'active' | 'consumed';

export type ModeEscalationRequest = {
  id: string;
  createdAt: string;
  updatedAt: string;
  sessionId: string;
  requestedBy: string | null;
  intent: string;
  currentMode: ZavorthProductModeSnapshot;
  effectiveMode: ZavorthProductModeSnapshot;
  requiredMode: ZavorthProductModeSnapshot;
  reason: string;
  reasons: string[];
  recommendedScope: ModeEscalationScope;
  supportedScopes: ModeEscalationScope[];
  fallback: string;
  summary: string;
  status: ModeEscalationRequestStatus;
  resourceImpact: TaskResourceImpact | null;
  resolution: {
    decidedAt: string | null;
    decidedBy: string | null;
    scope: ModeEscalationScope | null;
    grantId: string | null;
  };
};

export type ModeEscalationGrant = {
  id: string;
  createdAt: string;
  updatedAt: string;
  sessionId: string | null;
  requestedBy: string | null;
  scope: ModeEscalationScope;
  targetMode: ZavorthProductMode;
  targetModeSnapshot: ZavorthProductModeSnapshot;
  reason: string;
  sourceRequestId: string | null;
  status: ModeEscalationGrantStatus;
  remainingUses: number | null;
};

export type ModeEscalationSnapshot = {
  generatedAt: string;
  sessionId: string;
  baseMode: ZavorthProductModeSnapshot;
  effectiveMode: ZavorthProductModeSnapshot;
  status: 'clear' | 'pending' | 'elevated';
  activeGrants: ModeEscalationGrant[];
  pendingRequest: ModeEscalationRequest | null;
  recentRequests: ModeEscalationRequest[];
  commands: {
    show: string;
    approve: string;
    reject: string;
    inspect: string;
    resolve: string;
  };
};

export type ModeEscalationEvaluation = {
  allowed: boolean;
  request: ModeEscalationRequest | null;
  snapshot: ModeEscalationSnapshot;
};

export type ModeEscalationResolution = {
  ok: boolean;
  decision: 'approve' | 'reject';
  request: ModeEscalationRequest;
  grant: ModeEscalationGrant | null;
  snapshot: ModeEscalationSnapshot;
  summary: string;
};
