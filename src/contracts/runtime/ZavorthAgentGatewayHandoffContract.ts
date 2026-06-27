import type {
  ZavorthGatewaySnapshot,
  ZavorthGatewayShellSnapshot,
} from '../../services/ZavorthGatewayService.js';
import type {
  ZavorthGatewayRuntimeHealthSnapshot,
  ZavorthGatewayRuntimeSnapshot,
} from '../../services/ZavorthGatewayRuntimeService.js';

export const ZAVORTH_AGENT_GATEWAY_HANDOFF_VERSION = 'zavorth-agent-gateway-handoff/1' as const;

export type ZavorthAgentGatewayHandoffPhase =
  | 'prepared'
  | 'blocked';

export type ZavorthAgentGatewayPlaneStatus =
  | 'ready'
  | 'partial'
  | 'blocked';

export type ZavorthAgentGatewayPlaneOwner =
  | 'ai-gateway'
  | 'agent-runtime'
  | 'shared';

export type ZavorthAgentGatewayPlaneId =
  | 'gateway-core'
  | 'legacy-pass-through-plane'
  | 'compatible-api-surface'
  | 'provider-auth-plane'
  | 'storage-plane'
  | 'proxy-transport-plane'
  | 'session-control-plane'
  | 'observability-plane';

export type ZavorthAgentGatewayHandoffContext = {
  sessionId?: string | null;
  chatId?: string | null;
  userId?: string | null;
  workspaceHint?: string | null;
  hydrated?: boolean;
};

export type ZavorthAgentGatewayPlaneHandoff = {
  id: ZavorthAgentGatewayPlaneId;
  label: string;
  status: ZavorthAgentGatewayPlaneStatus;
  owner: ZavorthAgentGatewayPlaneOwner;
  sourceFiles: string[];
  capabilities: string[];
  integrationContract: string;
  compatibilityBoundary: string | null;
  nextIntegrationSteps: string[];
  risks: string[];
};

export type ZavorthAgentGatewayConvergenceChecklistItem = {
  id: string;
  status: 'pending' | 'ready' | 'blocked';
  owner: 'gateway' | 'agent-loop' | 'shared';
  description: string;
  evidence: string[];
};

export type ZavorthAgentGatewayHandoffSnapshot = {
  version: typeof ZAVORTH_AGENT_GATEWAY_HANDOFF_VERSION;
  generatedAt: string;
  phase: ZavorthAgentGatewayHandoffPhase;
  context: ZavorthAgentGatewayHandoffContext;
  gateway: ZavorthGatewaySnapshot | ZavorthGatewayShellSnapshot | null;
  runtime: ZavorthGatewayRuntimeSnapshot | null;
  runtimeHealth: ZavorthGatewayRuntimeHealthSnapshot | null;
  planes: ZavorthAgentGatewayPlaneHandoff[];
  checklist: ZavorthAgentGatewayConvergenceChecklistItem[];
  blockers: string[];
  nextIntegrationSteps: string[];
  guardrails: string[];
};
