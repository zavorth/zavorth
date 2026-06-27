import type { NormalizedInboundMessage } from '../../runtime/agent/contracts/index.js';
import type {
  RuntimeAdapterApprovalEnvelope,
  RuntimeAdapterEventEnvelope,
} from '../../runtime/zavorth-runtime-adapters/contracts.js';
import type {
  RuntimeAdapterGatewayHandshakeNormalization,
} from '../../runtime/zavorth-runtime-adapters/RuntimeAdapterGatewayHandshakeBoundary.js';
import type {
  SourceAgentRuntimeToolPolicyDoctorSnapshot,
} from './SourceAgentRuntimeBridgeContract.js';

export const ZAVORTH_ACP_GENERIC_CHANNEL_ADAPTER_CONTRACT_VERSION =
  'zavorth-acp-generic-channel-adapter/1' as const;

export type AcpGenericChannelFrameKind =
  | 'handshake'
  | 'message'
  | 'tool_request'
  | 'event'
  | 'response'
  | 'error';

export type AcpGenericChannelAdapterStatus =
  | 'ready'
  | 'accepted'
  | 'diagnostic'
  | 'approval_required'
  | 'duplicate'
  | 'blocked'
  | 'failed';

export type AcpGenericChannelEnvelope = {
  id?: string | number | null;
  idempotencyKey?: string | null;
  kind?: AcpGenericChannelFrameKind | string | null;
  protocol?: 'acp' | 'acp-compatible' | 'jsonrpc' | string | null;
  runtimeId?: string | null;
  sessionId?: string | null;
  operation?: string | null;
  method?: string | null;
  event?: string | null;
  status?: 'ok' | 'error' | string | null;
  sequence?: number | null;
  actor?: {
    id?: string | null;
    role?: 'user' | 'assistant' | 'system' | 'worker' | string | null;
  } | null;
  handshake?: {
    clientId?: string | null;
    role?: string | null;
    scopes?: string[];
    tokenPresent?: boolean;
  } | null;
  tool?: {
    name?: string | null;
    arguments?: Record<string, unknown> | null;
  } | null;
  payload?: {
    text?: string | null;
    channel?: string | null;
    workspace?: string | null;
    requestedTools?: string[];
    data?: Record<string, unknown>;
    errorCode?: string | null;
    errorMessage?: string | null;
  } | null;
  source?: {
    runtimeName?: string | null;
    runtimeVersion?: string | null;
    endpointHint?: string | null;
    paths?: string[];
    notes?: string[];
  } | null;
};

export type AcpGenericChannelAdapterSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_ACP_GENERIC_CHANNEL_ADAPTER_CONTRACT_VERSION;
  surface: 'acp-generic-channel-adapter';
  adapter: {
    id: 'acp-generic';
    label: 'ACP Generic Channel Adapter';
    protocolFamily: 'acp-compatible';
    conceptualDependency: 'zavorth-native';
    inbound: true;
    outbound: false;
    dispatchesDirectlyToExecutor: false;
  };
  summary: {
    accepted: number;
    approvalRequired: number;
    duplicates: number;
    blocked: number;
    failed: number;
    lastReceiptId: string | null;
  };
  safety: {
    sourceRuntimeAuthority: false;
    sourceTokensAuthoritative: false;
    toolExecutionPerformed: false;
    diskMutationPerformed: false;
    gatewayNormalizationOnly: true;
    rawSecretsSerialized: false;
  };
  routes: {
    dashboardStatus: '/api/web/acp-generic-channel-adapter';
    dashboardIngest: '/api/web/acp-generic-channel-adapter';
    cliStatus: 'zavorth acp channel status';
    cliIngest: 'zavorth acp channel ingest --text "<message>"';
  };
};

export type AcpGenericChannelAdapterReceipt = {
  id: string;
  generatedAt: string;
  contractVersion: typeof ZAVORTH_ACP_GENERIC_CHANNEL_ADAPTER_CONTRACT_VERSION;
  surface: 'acp-generic-channel-adapter';
  status: AcpGenericChannelAdapterStatus;
  adapter: {
    id: 'acp-generic';
    protocolFamily: 'acp-compatible';
    source: 'AcpGenericChannelAdapterService';
  };
  input: {
    frameId: string;
    frameKind: AcpGenericChannelFrameKind;
    runtimeId: string;
    sessionId: string;
    idempotencyKey: string;
    sourceRuntimeName: string | null;
    sourceRuntimeVersion: string | null;
  };
  normalization: {
    nativeContract:
      | 'NormalizedInboundMessage'
      | 'RuntimeAdapterEventEnvelope'
      | 'RuntimeAdapterGatewayHandshake'
      | 'ZavorthStructuredGatewayError/v1';
    reachesExecutor: boolean;
    gatewayEventEmitted: boolean;
    duplicateOf: string | null;
  };
  message: NormalizedInboundMessage | null;
  eventEnvelope: RuntimeAdapterEventEnvelope | null;
  handshake: RuntimeAdapterGatewayHandshakeNormalization | null;
  approvals: RuntimeAdapterApprovalEnvelope[];
  toolPolicy: SourceAgentRuntimeToolPolicyDoctorSnapshot | null;
  output: {
    text: string;
  };
  safety: AcpGenericChannelAdapterSnapshot['safety'];
};
