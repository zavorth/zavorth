import type { ZavorthGatewaySnapshot } from '../../services/ZavorthGatewayService.js';
import type {
  ZavorthSessionPlaneSnapshot,
  ZavorthSessionPlaneStatusSummarySnapshot,
} from '../../services/ZavorthSessionPlaneService.js';
import type {
  GatewaySessionListSnapshot,
  GatewaySessionListSummarySnapshot,
  GatewaySessionSnapshot,
} from '../../runtime/sessions/GatewaySessionService.js';
import type {
  GatewaySessionSendResult,
  GatewaySessionSpawnResult,
  GatewaySessionToolDescriptor,
} from '../../runtime/sessions/GatewaySessionToolsService.js';
import type { ZavorthProductModeSnapshot } from '../../services/ProductModeService.js';
import type { ProductChannelExperienceSnapshot } from '../../services/ProductChannelExperienceService.js';
import type { ModeEscalationSnapshot } from '../ModeEscalationContract.js';
import type { HybridMemoryRecallResult } from '../HybridMemoryContract.js';
import type { ZavorthAgentGatewaySnapshot } from '../../runtime/agent/index.js';

export const GATEWAY_CONTRACT_VERSION = 'v1' as const;
export const GATEWAY_WS_PROTOCOL_VERSION = 'zavorth-gateway-ws/1' as const;

export const GATEWAY_SESSION_ROUTE_PATHS = {
  state: '/api/web/state',
  plane: '/api/web/gateway/sessions',
  history: '/api/web/gateway/sessions/history',
  send: '/api/web/gateway/sessions/send',
  spawn: '/api/web/gateway/sessions/spawn',
  compact: '/api/web/gateway/sessions/compact',
  command: '/api/web/gateway/sessions/command',
  status: '/api/web/gateway/sessions/status',
  usage: '/api/web/gateway/sessions/usage',
  model: '/api/web/gateway/sessions/model',
  models: '/api/web/gateway/sessions/models',
  profile: '/api/web/gateway/sessions/profile',
  tools: '/api/web/gateway/sessions/tools',
  skills: '/api/web/gateway/sessions/skills',
  agents: '/api/web/gateway/sessions/agents',
  whoami: '/api/web/gateway/sessions/whoami',
  context: '/api/web/gateway/sessions/context',
  'plan-review': '/api/web/gateway/sessions/plan-review',
  'brief-reply': '/api/web/gateway/sessions/brief-reply',
  'test-loop': '/api/web/gateway/sessions/test-loop',
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
  compact: ['/api/web/session-tools/compact', '/api/web/sessions/compact', '/api/web/session/compact'],
  command: ['/api/web/session-tools/command', '/api/web/sessions/command', '/api/web/session/command'],
  status: ['/api/web/session-tools/status', '/api/web/sessions/status', '/api/web/session/status'],
  usage: ['/api/web/session-tools/usage', '/api/web/sessions/usage', '/api/web/session/usage'],
  model: ['/api/web/session-tools/model', '/api/web/sessions/model', '/api/web/session/model'],
  models: ['/api/web/session-tools/models', '/api/web/sessions/models', '/api/web/session/models'],
  profile: ['/api/web/session-tools/profile', '/api/web/sessions/profile', '/api/web/session/profile'],
  tools: ['/api/web/session-tools/tools', '/api/web/sessions/tools', '/api/web/session/tools'],
  skills: ['/api/web/session-tools/skills', '/api/web/sessions/skills', '/api/web/session/skills'],
  agents: ['/api/web/session-tools/agents', '/api/web/sessions/agents', '/api/web/session/agents'],
  whoami: ['/api/web/session-tools/whoami', '/api/web/sessions/whoami', '/api/web/session/whoami'],
  context: ['/api/web/session-tools/context', '/api/web/sessions/context', '/api/web/session/context'],
  'plan-review': ['/api/web/session-tools/plan-review', '/api/web/sessions/plan-review', '/api/web/session/plan-review'],
  'brief-reply': ['/api/web/session-tools/brief-reply', '/api/web/sessions/brief-reply', '/api/web/session/brief-reply'],
  'test-loop': ['/api/web/session-tools/test-loop', '/api/web/sessions/test-loop', '/api/web/session/test-loop'],
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
