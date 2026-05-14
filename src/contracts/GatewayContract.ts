import type { ZavorthGatewaySnapshot } from '../services/ZavorthGatewayService.js';
import type {
  ZavorthSessionPlaneSnapshot,
  ZavorthSessionPlaneStatusSummarySnapshot,
} from '../services/ZavorthSessionPlaneService.js';
import type {
  GatewaySessionListSnapshot,
  GatewaySessionListSummarySnapshot,
  GatewaySessionSnapshot,
} from '../runtime/sessions/GatewaySessionService.js';
import type {
  GatewaySessionSendResult,
  GatewaySessionSpawnResult,
  GatewaySessionToolDescriptor,
} from '../runtime/sessions/GatewaySessionToolsService.js';
import type { ZavorthProductModeSnapshot } from '../services/ProductModeService.js';
import type { ProductChannelExperienceSnapshot } from '../services/ProductChannelExperienceService.js';
import type { ModeEscalationSnapshot } from './ModeEscalationContract.js';
import type { HybridMemoryRecallResult } from './HybridMemoryContract.js';
import type { ZavorthAgentGatewaySnapshot } from '../runtime/agent/index.js';

export const GATEWAY_CONTRACT_VERSION = 'v1' as const;
export const GATEWAY_WS_PROTOCOL_VERSION = 'zavorth-gateway-ws/1' as const;

export const GATEWAY_SESSION_ROUTE_PATHS = {
  state: '/api/web/state',
  plane: '/api/web/gateway/sessions',
  history: '/api/web/gateway/sessions/history',
  send: '/api/web/gateway/sessions/send',
  spawn: '/api/web/gateway/sessions/spawn',
} as const;

export type GatewayControlEventKind =
  | 'session'
  | 'chat'
  | 'agent'
  | 'tool'
  | 'approval'
  | 'artifact'
  | 'capability'
  | 'selfmod'
  | 'health'
  | 'health.resource'
  | 'presence'
  | 'tick';

export const LEGACY_GATEWAY_SESSION_ROUTE_ALIASES = {
  plane: ['/api/web/session-tools', '/api/web/sessions'],
  send: ['/api/web/session-tools/send', '/api/web/sessions/send', '/api/web/chat/send'],
  spawn: ['/api/web/session-tools/spawn', '/api/web/sessions/spawn'],
} as const;

export type GatewayCanonicalSessionContext = {
  sessionId: string;
  chatId: string;
  userId: string;
  sourceUserId: string;
  platform: string;
};

export type GatewayCanonicalSessionBundle = {
  gateway: ZavorthGatewaySnapshot | null;
  session: GatewaySessionSnapshot | null;
  sessions: GatewaySessionListSnapshot | null;
  sessionsSummary: GatewaySessionListSummarySnapshot | null;
  gatewaySessionTools: {
    tools: GatewaySessionToolDescriptor[];
    sessions: GatewaySessionListSnapshot | null;
    sessionsSummary: GatewaySessionListSummarySnapshot | null;
    history: GatewaySessionSnapshot | null;
  } | null;
};

export type GatewayCanonicalStatePayload = GatewayCanonicalSessionBundle & {
  snapshot: Record<string, any> | null;
  agentRuntime: ZavorthAgentGatewaySnapshot | null;
  productMode: ZavorthProductModeSnapshot | null;
  modeEscalation: ModeEscalationSnapshot | null;
  uiSurfaceHints: ProductChannelExperienceSnapshot | null;
  memoryPlane: ZavorthGatewaySnapshot['memoryPlane'] | null;
  memoryRecall: HybridMemoryRecallResult | null;
  controlPlane: ZavorthGatewaySnapshot['controlPlane'] | null;
  sessionPlane: ZavorthSessionPlaneSnapshot | ZavorthSessionPlaneStatusSummarySnapshot | null;
  approvalPlane: Record<string, any> | null;
  capabilityPlane: Record<string, any> | null;
  artifactPlane: Record<string, any> | null;
  selfmodPlane: Record<string, any> | null;
  resourcePlane: Record<string, any> | null;
  companionPlane: Record<string, any> | null;
  runtimeWarnings: string[];
  actionRecommendations: Record<string, any>[];
};

export type GatewayCanonicalSendPayload = GatewayCanonicalStatePayload & {
  send: GatewaySessionSendResult | null;
};

export type GatewayCanonicalSpawnPayload = GatewayCanonicalStatePayload & {
  spawn: GatewaySessionSpawnResult | null;
  spawnedFrom: string | null;
  seededPrompt: string | null;
};
