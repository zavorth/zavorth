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
  params?: Record<string, any> | null;
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
  patchSession: (input: {
    sessionId: string;
    label?: string | null;
    workspaceHint?: string | null;
    pinned?: boolean;
    modelProfile?: string | null;
  }) => Promise<Record<string, any>>;
  listApprovals: (sessionId: string, limit?: number) => Promise<Record<string, any>>;
  resolveApproval: (input: {
    approvalId: string;
    decision: 'approve' | 'reject';
    sessionId?: string | null;
    scope?: string | null;
    approvalCode?: string | null;
    requestedBy?: string | null;
  }) => Promise<Record<string, any>>;
  listArtifacts: (input: {
    sessionId: string;
    toolRunId?: string | null;
  }) => Promise<Record<string, any>>;
  readArtifactDiff: (input: {
    sessionId: string;
    toolRunId: string;
    path?: string | null;
  }) => Promise<Record<string, any>>;
  previewMemoryRecall: (input: {
    sessionId: string;
    query?: string | null;
    limit?: number | null;
  }) => Promise<Record<string, any>>;
  listMemorySources: (input: {
    sessionId: string;
  }) => Promise<Record<string, any>>;
  getProductMode: () => Promise<Record<string, any>>;
  getModeEscalation: (input: {
    sessionId: string;
  }) => Promise<Record<string, any>>;
  setProductMode: (input: {
    mode: string;
    requestedBy?: string | null;
  }) => Promise<Record<string, any>>;
  resolveModeEscalation: (input: {
    requestId: string;
    decision: 'approve' | 'reject';
    scope?: string | null;
    requestedBy?: string | null;
  }) => Promise<Record<string, any>>;
  listCapabilities: () => Promise<Record<string, any>>;
  enableCapability: (input: {
    capabilityId: string;
    sessionId?: string | null;
    scope?: string | null;
    reason?: string | null;
    requestedBy?: string | null;
    sourceSurface?: string | null;
  }) => Promise<Record<string, any>>;
  disableCapability: (input: {
    capabilityId: string;
    requestedBy?: string | null;
  }) => Promise<Record<string, any>>;
  previewSelfmod: (input: {
    mode: 'file' | 'goal';
    filePath?: string | null;
    instruction?: string | null;
    goal?: string | null;
    requestedBy?: string | null;
  }) => Promise<Record<string, any>>;
  applySelfmod: (input: {
    previewId: string;
    sessionId?: string | null;
    requestedBy?: string | null;
  }) => Promise<Record<string, any>>;
  rollbackSelfmod: (input: {
    changeId: string;
    requestedBy?: string | null;
  }) => Promise<Record<string, any>>;
  abortChat: (input: {
    sessionId: string;
    requestedBy?: string | null;
  }) => Promise<Record<string, any>>;
  readDesktopResources?: (input: {
    sessionId: string;
    preferCachedWithinMs?: number;
  }) => Promise<DesktopResourceSnapshot | null>;
  buildRuntime: (input: {
    sessionId: string | null;
    chatId: string | null;
    userId: string | null;
  }) => Promise<ZavorthGatewayRuntimeSnapshot>;
  processChatSend: (body: Record<string, any>) => Promise<Record<string, any>>;
  spawnSession: (body: Record<string, any>) => Promise<Record<string, any>>;
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
