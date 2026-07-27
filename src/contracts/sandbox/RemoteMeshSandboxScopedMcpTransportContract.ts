import type { RemoteMeshJson } from './RemoteMeshSandboxContract.js';
import type { RemoteMeshSandboxAuditTimelineSnapshot } from './RemoteMeshSandboxAuditTimelineContract.js';
import type { RemoteMeshLiveProbeTransportResult } from './RemoteMeshSandboxLiveProbeContract.js';

export const ZAVORTH_REMOTE_MESH_SANDBOX_R7_SCOPED_MCP_TRANSPORT_VERSION =
  '2026-05-05.remote-mesh-sandbox-r7-scoped-mcp-status-transport' as const;

export type RemoteMeshScopedMcpTransportStatus =
  | 'not-configured'
  | 'ready'
  | 'blocked'
  | 'executed'
  | 'failed';

export type RemoteMeshScopedMcpTransportGuardId =
  | 'endpoint-configured'
  | 'endpoint-http-or-https'
  | 'endpoint-no-query-token'
  | 'endpoint-no-userinfo'
  | 'auth-token-configured'
  | 'auth-token-header-only'
  | 'tool-locked'
  | 'schema-only-payload'
  | 'post-only';

export type RemoteMeshScopedMcpTransportGuardStatus =
  | 'passed'
  | 'waiting'
  | 'blocked';

export type RemoteMeshScopedMcpTransportGuard = {
  id: RemoteMeshScopedMcpTransportGuardId;
  status: RemoteMeshScopedMcpTransportGuardStatus;
  evidence: string;
  remediation: string | null;
};

export type RemoteMeshScopedMcpTransportConfigSnapshot = {
  endpointConfigured: boolean;
  endpointLabel: string | null;
  protocol: 'http:' | 'https:' | null;
  hostLabel: string | null;
  authHeaderName: 'Authorization' | 'X-Zavorth-Remote-Token';
  authTokenConfigured: boolean;
  tokenSource: 'none' | 'env' | 'test';
  allowInsecureHttpForTailnet: boolean;
  timeoutMs: number;
  queryKeysRedacted: string[];
};

export type RemoteMeshScopedMcpStatusPayloadPreview = {
  method: 'tools/call';
  toolName: 'notebook.get_status';
  arguments: Record<string, never>;
  rawCommand: null;
  freeformShell: false;
  schemaLocked: true;
};

export type RemoteMeshScopedMcpTransportSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_REMOTE_MESH_SANDBOX_R7_SCOPED_MCP_TRANSPORT_VERSION;
  phase: 'R7';
  status: RemoteMeshScopedMcpTransportStatus;
  summary: {
    guards: number;
    passed: number;
    waiting: number;
    blocked: number;
    endpointConfigured: boolean;
    authTokenConfigured: boolean;
    transportReady: boolean;
    executionRequested: boolean;
    executionPerformed: boolean;
    liveNetworkCallPerformed: boolean;
    remoteProcessSpawned: boolean;
    filesystemMutationPerformed: boolean;
    mutationPerformed: boolean;
    rawCommandSerialized: false;
    secretValuesSerialized: false;
  };
  config: RemoteMeshScopedMcpTransportConfigSnapshot;
  payloadPreview: RemoteMeshScopedMcpStatusPayloadPreview;
  guards: RemoteMeshScopedMcpTransportGuard[];
  transportResult: RemoteMeshLiveProbeTransportResult | null;
  auditTimeline: RemoteMeshSandboxAuditTimelineSnapshot;
  commands: {
    check: 'npm run remote-mesh:sandbox:scoped-mcp-transport --silent';
    focusedTests: 'npx jest tests/services/RemoteMeshSandboxScopedMcpStatusTransportService.test.ts --runInBand';
    typecheck: 'npm run runtime:check --silent';
    nextAction: 'Remote Mesh Cycle 1 Complete';
  };
};

export type RemoteMeshScopedMcpStatusHttpTransportConfig = {
  endpointUrl: string | null;
  authToken: string | null;
  tokenSource?: 'none' | 'env' | 'test';
  authHeaderName?: 'Authorization' | 'X-Zavorth-Remote-Token';
  allowInsecureHttpForTailnet?: boolean;
  timeoutMs?: number;
};

export type RemoteMeshScopedMcpHttpRequest = {
  url: string;
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
  };
};

export type RemoteMeshScopedMcpHttpResponse = {
  ok: boolean;
  status: number;
  statusText?: string;
  text(): Promise<string>;
};

export type RemoteMeshScopedMcpFetch = (
  url: string,
  init: RemoteMeshScopedMcpHttpRequest['init'],
) => Promise<RemoteMeshScopedMcpHttpResponse>;

export type RemoteMeshScopedMcpExecutionInput = {
  executeLiveProbe?: boolean;
  target?: string | null;
  ownerTrust?: boolean;
  acknowledgedRisk?: boolean;
  acceptRelayRoute?: boolean;
  armLiveProbe?: boolean;
  readinessSnapshot?: unknown;
  fetcher?: RemoteMeshScopedMcpFetch;
};

export type RemoteMeshScopedMcpTransportDiagnostics = {
  config: RemoteMeshScopedMcpTransportConfigSnapshot;
  guards: RemoteMeshScopedMcpTransportGuard[];
  payloadPreview: RemoteMeshScopedMcpStatusPayloadPreview;
  safeToInstantiateTransport: boolean;
  safeToAttemptNetwork: boolean;
  validationErrors: string[];
  redactedRequest: RemoteMeshScopedMcpHttpRequest | null;
  rawEndpointSerialized: false;
  rawTokenSerialized: false;
  rawCommandSerialized: false;
  secretValuesSerialized: false;
};

export type RemoteMeshScopedMcpStatusResponsePreview = {
  status: 'success' | 'failed';
  httpStatus: number | null;
  bodyPreview: Record<string, RemoteMeshJson> | string | null;
};
