import type * as http from 'http';
import type {
  GatewayControlEventKind,
  GatewayCanonicalSessionBundle,
  GatewayCanonicalStatePayload,
} from '../../contracts/GatewayContract.js';
import {
  GATEWAY_CONTRACT_VERSION,
  GATEWAY_WS_PROTOCOL_VERSION,
} from '../../contracts/GatewayContract.js';

import type { DesktopResourceSnapshot } from '../../contracts/DesktopResourceContract.js';
import type { ZavorthGatewayRuntimeSnapshot } from '../ZavorthGatewayRuntimeService.js';
import type { WebRealtimeEvent } from '../WebRealtimeService.js';

export type GatewayControlReplayMode = 'none' | 'state' | 'full';

export type GatewayControlSocketRequest = {
  id?: string | null;
  method?: string | null;
  params?: Record<string, unknown> | null;
};

export type GatewayControlSocketResponse =
  | {
      type: 'response';
      id: string | null;
      ok: true;
      result: unknown;
    }
  | {
      type: 'response';
      id: string | null;
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

export type GatewayControlSocketReady = {
  type: 'ready';
  protocolVersion: typeof GATEWAY_WS_PROTOCOL_VERSION;
  contractVersion: typeof GATEWAY_CONTRACT_VERSION;
  sessionId: string;
  chatId: string;
  methods: string[];
  replayModes: GatewayControlReplayMode[];
  controlPlane: ZavorthGatewayRuntimeSnapshot['controlPlane'];
};

export type GatewayControlSocketEvent =
  | GatewayControlSocketReady
  | {
      type: 'runtime';
      sessionId: string;
      payload: ZavorthGatewayRuntimeSnapshot;
    }
  | {
      type: 'hydrate';
      sessionId: string;
      replayMode: GatewayControlReplayMode;
      state: GatewayCanonicalStatePayload | null;
      history: GatewayCanonicalSessionBundle | null;
    }
  | {
      type: 'event';
      sessionId: string;
      channel: 'realtime';
      event:
        | (WebRealtimeEvent & { kind: GatewayControlEventKind })
        | {
            id: string;
            type: 'resource';
            createdAt: string;
            kind: 'health.resource';
            payload: DesktopResourceSnapshot;
          };
    }
  | {
      type: 'heartbeat';
      sessionId: string;
      createdAt: string;
    }
  | {
      type: 'warning';
      sessionId: string | null;
      message: string;
    }
  | GatewayControlSocketResponse;

export interface PatchSessionParams {
  sessionId: string;
  label?: string | null;
  workspaceHint?: string | null;
  pinned?: boolean;
  modelProfile?: string | null;
}

export interface ResolveApprovalParams {
  approvalId: string;
  decision: 'approve' | 'reject';
  sessionId?: string | null;
  scope?: string | null;
  approvalCode?: string | null;
  requestedBy?: string | null;
}

export interface ListArtifactsParams {
  sessionId: string;
  toolRunId?: string | null;
}

export interface ReadArtifactDiffParams {
  sessionId: string;
  toolRunId: string;
  path?: string | null;
}

export interface PreviewMemoryRecallParams {
  sessionId: string;
  query?: string | null;
  limit?: number | null;
}

export interface GetModeEscalationParams {
  sessionId: string;
}

export interface SetProductModeParams {
  mode: string;
  requestedBy?: string | null;
}

export interface ResolveModeEscalationParams {
  requestId: string;
  decision: 'approve' | 'reject';
  scope?: string | null;
  requestedBy?: string | null;
}

export interface EnableCapabilityParams {
  capabilityId: string;
  sessionId?: string | null;
  scope?: string | null;
  reason?: string | null;
  requestedBy?: string | null;
  sourceSurface?: string | null;
}

export interface DisableCapabilityParams {
  capabilityId: string;
  requestedBy?: string | null;
}

export interface PreviewSelfmodParams {
  mode: 'file' | 'goal';
  filePath?: string | null;
  instruction?: string | null;
  goal?: string | null;
  requestedBy?: string | null;
}

export interface ApplySelfmodParams {
  previewId: string;
  sessionId?: string | null;
  requestedBy?: string | null;
}

export interface RollbackSelfmodParams {
  changeId: string;
  requestedBy?: string | null;
}

export interface AbortChatParams {
  sessionId: string;
  requestedBy?: string | null;
}

export interface BuildRuntimeParams {
  sessionId: string | null;
  chatId: string | null;
  userId: string | null;
}

export type GatewayControlSocketDeps = {
  path?: string;
  authorize?: (req: http.IncomingMessage, url: URL) => boolean;
  unavailableReason?: string | null;
  resolveSessionId: (url: URL) => string;
  createSession: () => string;
  getChatId: (sessionId: string) => string;
  getUserId: () => string | null;
  ensureSession: (sessionId: string) => void;
  captureBaseline: (sessionId: string) => Promise<void>;
  subscribeRealtime: (sessionId: string, listener: (event: WebRealtimeEvent) => void) => () => void;
  buildCanonicalState: (sessionId: string) => Promise<GatewayCanonicalStatePayload>;
  buildCanonicalHistory: (sessionId: string) => Promise<GatewayCanonicalSessionBundle>;
  patchSession: (input: PatchSessionParams) => Promise<Record<string, unknown>>;
  listApprovals: (sessionId: string, limit?: number) => Promise<Record<string, unknown>>;
  resolveApproval: (input: ResolveApprovalParams) => Promise<Record<string, unknown>>;
  listArtifacts: (input: ListArtifactsParams) => Promise<Record<string, unknown>>;
  readArtifactDiff: (input: ReadArtifactDiffParams) => Promise<Record<string, unknown>>;
  previewMemoryRecall: (input: PreviewMemoryRecallParams) => Promise<Record<string, unknown>>;
  listMemorySources: (input: { sessionId: string }) => Promise<Record<string, unknown>>;
  getProductMode: () => Promise<Record<string, unknown>>;
  getModeEscalation: (input: GetModeEscalationParams) => Promise<Record<string, unknown>>;
  setProductMode: (input: SetProductModeParams) => Promise<Record<string, unknown>>;
  resolveModeEscalation: (input: ResolveModeEscalationParams) => Promise<Record<string, unknown>>;
  listCapabilities: () => Promise<Record<string, unknown>>;
  enableCapability: (input: EnableCapabilityParams) => Promise<Record<string, unknown>>;
  disableCapability: (input: DisableCapabilityParams) => Promise<Record<string, unknown>>;
  previewSelfmod: (input: PreviewSelfmodParams) => Promise<Record<string, unknown>>;
  applySelfmod: (input: ApplySelfmodParams) => Promise<Record<string, unknown>>;
  rollbackSelfmod: (input: RollbackSelfmodParams) => Promise<Record<string, unknown>>;
  abortChat: (input: AbortChatParams) => Promise<Record<string, unknown>>;
  readDesktopResources?: (input: {
    sessionId: string;
    preferCachedWithinMs?: number;
  }) => Promise<DesktopResourceSnapshot | null>;
  buildRuntime: (input: BuildRuntimeParams) => Promise<ZavorthGatewayRuntimeSnapshot>;
  processChatSend: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  spawnSession: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  heartbeatIntervalMs?: number;
};

export type GatewayConnectionState = {
  sessionId: string;
  heartbeat: ReturnType<typeof setInterval> | null;
  unsubscribe: (() => void) | null;
};

export type GatewayControlSocketSend = (payload: GatewayControlSocketEvent) => void;
export type GatewayControlSocketSendResponse = (id: string | null, result: unknown) => void;
export type GatewayControlSocketSendError = (
  id: string | null,
  code: string,
  message: string,
) => void;
