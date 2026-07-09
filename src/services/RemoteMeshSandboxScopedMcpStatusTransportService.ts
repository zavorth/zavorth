import type {
  RemoteMeshJson,
} from '../contracts/RemoteMeshSandboxContract.js';
import type {
  RemoteMeshScopedMcpFetch,
  RemoteMeshScopedMcpHttpRequest,
  RemoteMeshScopedMcpHttpResponse,
  RemoteMeshScopedMcpStatusHttpTransportConfig,
  RemoteMeshScopedMcpTransportConfigSnapshot,
  RemoteMeshScopedMcpTransportDiagnostics,
  RemoteMeshScopedMcpTransportGuard,
  RemoteMeshScopedMcpTransportGuardId,
  RemoteMeshScopedMcpTransportGuardStatus,
  RemoteMeshScopedMcpTransportSnapshot,
  RemoteMeshScopedMcpTransportStatus,
} from '../contracts/RemoteMeshSandboxScopedMcpTransportContract.js';
import { ZAVORTH_REMOTE_MESH_SANDBOX_R7_SCOPED_MCP_TRANSPORT_VERSION } from '../contracts/RemoteMeshSandboxScopedMcpTransportContract.js';
import type {
  RemoteMeshLiveProbeTransport,
  RemoteMeshLiveProbeTransportInvocation,
} from './RemoteMeshSandboxLiveProbeExecutorService.js';
import { RemoteMeshSandboxLiveProbeExecutorService } from './RemoteMeshSandboxLiveProbeExecutorService.js';
import type {
  RemoteMeshLiveProbeTransportResult,
} from '../contracts/RemoteMeshSandboxLiveProbeContract.js';
import { RemoteMeshSandboxAuditTimelineService } from './RemoteMeshSandboxAuditTimelineService.js';
import type { RemoteMeshSandboxReadinessSnapshot } from '../contracts/RemoteMeshSandboxReadinessContract.js';
import { safeFetch } from '../security/SafeFetchService.js';
import { logger } from '../logger.js';

type RemoteMeshScopedMcpStatusTransportRuntime = {
  now?: () => Date;
  fetcher?: RemoteMeshScopedMcpFetch;
};

export type RemoteMeshScopedMcpStatusTransportSnapshotInput = {
  executeLiveProbe?: boolean;
  target?: string | null;
  ownerTrust?: boolean;
  acknowledgedRisk?: boolean;
  acceptRelayRoute?: boolean;
  armLiveProbe?: boolean;
  readinessSnapshot?: RemoteMeshSandboxReadinessSnapshot;
};

export class ScopedMcpStatusHttpTransport implements RemoteMeshLiveProbeTransport {
  public readonly kind = 'mcp-http-status' as const;

  private readonly now: () => Date;
  private readonly fetcher: RemoteMeshScopedMcpFetch;
  private readonly config: RemoteMeshScopedMcpStatusHttpTransportConfig;

  constructor(
    config: RemoteMeshScopedMcpStatusHttpTransportConfig,
    runtime: RemoteMeshScopedMcpStatusTransportRuntime = {},
  ) {
    this.config = normalizeConfig(config);
    this.now = runtime.now || (() => new Date());
    this.fetcher = runtime.fetcher || defaultFetch;
  }

  public async execute(input: RemoteMeshLiveProbeTransportInvocation): Promise<RemoteMeshLiveProbeTransportResult> {
    const diagnostics = RemoteMeshSandboxScopedMcpStatusTransportService.diagnose(this.config);
    const startedAt = this.now().toISOString();

    if (!diagnostics.safeToAttemptNetwork) {
      return {
        status: 'failed',
        startedAt,
        finishedAt: this.now().toISOString(),
        exitCode: 1,
        stdoutPreview: '',
        stderrPreview: diagnostics.validationErrors.join('; ') || 'Scoped MCP status transport is not safe to execute.',
        transportEvidence: [
          'transport refused before network call',
          ...diagnostics.validationErrors,
        ],
        liveNetworkCallPerformed: false,
        remoteProcessSpawned: false,
        filesystemMutationPerformed: false,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      };
    }

    if (
      input.payload.toolName !== 'notebook.get_status'
      || Object.keys(input.payload.params).length > 0
      || input.candidate.kind !== 'mcp-status-probe'
      || input.candidate.toolId !== 'notebook.status'
      || input.candidate.rawCommand !== null
    ) {
      return {
        status: 'failed',
        startedAt,
        finishedAt: this.now().toISOString(),
        exitCode: 1,
        stdoutPreview: '',
        stderrPreview: 'Transport accepts only notebook.get_status with empty schema-bound arguments.',
        transportEvidence: ['transport refused because invocation was outside the R7 scoped MCP status contract'],
        liveNetworkCallPerformed: false,
        remoteProcessSpawned: false,
        filesystemMutationPerformed: false,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      };
    }

    try {
      const response = await this.fetcher(diagnostics.redactedRequest!.url, this.buildRequestInit());
      const text = await response.text();
      const finishedAt = this.now().toISOString();
      const bodyPreview = sanitizeResponseText(text);
      return {
        status: response.ok ? 'success' : 'failed',
        startedAt,
        finishedAt,
        exitCode: response.ok ? 0 : 1,
        stdoutPreview: response.ok ? bodyPreview : '',
        stderrPreview: response.ok ? '' : `HTTP ${response.status} ${response.statusText || ''}`.trim(),
        transportEvidence: [
          'scoped MCP HTTP status transport performed one POST',
          `httpStatus=${response.status}`,
          `endpoint=${diagnostics.config.endpointLabel || 'redacted'}`,
          'tool=notebook.get_status',
        ],
        liveNetworkCallPerformed: true,
        remoteProcessSpawned: false,
        filesystemMutationPerformed: false,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      };
    } catch (error: unknown) {
      logger.warn('[Remote Mesh Sandbox Scoped Mcp Status Transport] network request failed', error);
    return {
        status: 'failed',
        startedAt,
        finishedAt: this.now().toISOString(),
        exitCode: 1,
        stdoutPreview: '',
        stderrPreview: error instanceof Error ? error.message : 'unknown scoped MCP transport failure',
        transportEvidence: [
          'scoped MCP HTTP status transport failed during POST',
          `endpoint=${diagnostics.config.endpointLabel || 'redacted'}`,
        ],
        liveNetworkCallPerformed: true,
        remoteProcessSpawned: false,
        filesystemMutationPerformed: false,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      };
  }
  }

  private buildRequestInit(): RemoteMeshScopedMcpHttpRequest['init'] {
    const diagnostics = RemoteMeshSandboxScopedMcpStatusTransportService.diagnose(this.config);
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      [diagnostics.config.authHeaderName]: diagnostics.config.authHeaderName === 'Authorization'
        ? 'Bearer <redacted>'
        : '<redacted>',
    };
    if (this.config.authToken) {
      headers[diagnostics.config.authHeaderName] = diagnostics.config.authHeaderName === 'Authorization'
        ? `Bearer ${this.config.authToken}`
        : this.config.authToken;
    }
    return {
      method: 'POST',
      headers,
      body: JSON.stringify(mcpStatusPayload()),
    };
  }
}

export class RemoteMeshSandboxScopedMcpStatusTransportService {
  private readonly now: () => Date;
  private readonly config: RemoteMeshScopedMcpStatusHttpTransportConfig;
  private readonly fetcher?: RemoteMeshScopedMcpFetch;

  constructor(
    config: RemoteMeshScopedMcpStatusHttpTransportConfig,
    runtime: RemoteMeshScopedMcpStatusTransportRuntime = {},
  ) {
    this.config = normalizeConfig(config);
    this.now = runtime.now || (() => new Date());
    this.fetcher = runtime.fetcher;
  }

  public static diagnose(config: RemoteMeshScopedMcpStatusHttpTransportConfig): RemoteMeshScopedMcpTransportDiagnostics {
    const normalized = normalizeConfig(config);
    const parsed = parseEndpoint(normalized.endpointUrl);
    const configSnapshot = buildConfigSnapshot(normalized, parsed);
    const guards = buildGuards(configSnapshot, parsed);
    const validationErrors = guards
      .filter((guard) => guard.status === 'blocked')
      .map((guard) => `${guard.id}: ${guard.evidence}`);
    const safeToInstantiateTransport = guards.every((guard) => guard.status !== 'blocked');
    const safeToAttemptNetwork = guards.every((guard) => guard.status === 'passed');
    const redactedRequest = safeToInstantiateTransport && parsed.url
      ? {
        url: redactedUrl(parsed.url),
        init: {
          method: 'POST' as const,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            [configSnapshot.authHeaderName]: '<redacted>',
          },
          body: JSON.stringify(mcpStatusPayload()),
        },
      }
      : null;

    return {
      config: configSnapshot,
      guards,
      payloadPreview: {
        method: 'tools/call',
        toolName: 'notebook.get_status',
        arguments: {},
        rawCommand: null,
        freeformShell: false,
        schemaLocked: true,
      },
      safeToInstantiateTransport,
      safeToAttemptNetwork,
      validationErrors,
      redactedRequest,
      rawEndpointSerialized: false,
      rawTokenSerialized: false,
      rawCommandSerialized: false,
      secretValuesSerialized: false,
    };
  }

  public async buildSnapshot(
    input: RemoteMeshScopedMcpStatusTransportSnapshotInput = {},
  ): Promise<RemoteMeshScopedMcpTransportSnapshot> {
    const diagnostics = RemoteMeshSandboxScopedMcpStatusTransportService.diagnose(this.config);
    const transport = new ScopedMcpStatusHttpTransport(this.config, {
      now: this.now,
      fetcher: this.fetcher,
    });
    const liveProbeService = new RemoteMeshSandboxLiveProbeExecutorService({
      now: this.now,
      transport,
    });
    const auditTimeline = await new RemoteMeshSandboxAuditTimelineService({
      now: this.now,
      liveProbeService,
    }).buildSnapshot({
      liveProbeInput: {
        executeLiveProbe: input.executeLiveProbe === true,
        activationInput: {
          tailnetTarget: input.target || null,
          readinessSnapshot: input.readinessSnapshot,
          ownerTrust: {
            trusted: input.ownerTrust === true,
            source: input.ownerTrust ? 'test' : 'none',
            operatorLabel: input.ownerTrust ? 'operator' : null,
            acknowledgedRisk: input.acknowledgedRisk === true,
          },
          acceptRelayRoute: input.acceptRelayRoute === true,
          armLiveProbe: input.armLiveProbe === true,
        },
      },
    });
    const transportResult = null;
    const executionResult = auditTimeline.timeline.find((entry) => entry.kind === 'live-probe-result');
    const status = this.resolveStatus({
      diagnostics,
      executionRequested: input.executeLiveProbe === true,
      timelineStatus: auditTimeline.status,
      liveProbeStatus: auditTimeline.source.liveProbeStatus,
    });

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_REMOTE_MESH_SANDBOX_R7_SCOPED_MCP_TRANSPORT_VERSION,
      phase: 'R7',
      status,
      summary: {
        guards: diagnostics.guards.length,
        passed: diagnostics.guards.filter((guard) => guard.status === 'passed').length,
        waiting: diagnostics.guards.filter((guard) => guard.status === 'waiting').length,
        blocked: diagnostics.guards.filter((guard) => guard.status === 'blocked').length,
        endpointConfigured: diagnostics.config.endpointConfigured,
        authTokenConfigured: diagnostics.config.authTokenConfigured,
        transportReady: diagnostics.safeToAttemptNetwork,
        executionRequested: input.executeLiveProbe === true,
        executionPerformed: auditTimeline.summary.executed > 0 || auditTimeline.summary.failed > 0,
        liveNetworkCallPerformed: auditTimeline.summary.liveNetworkCallPerformed,
        remoteProcessSpawned: auditTimeline.summary.remoteProcessSpawned,
        filesystemMutationPerformed: auditTimeline.summary.filesystemMutationPerformed,
        mutationPerformed: auditTimeline.summary.mutationPerformed,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      },
      config: diagnostics.config,
      payloadPreview: diagnostics.payloadPreview,
      guards: diagnostics.guards,
      transportResult: executionResult
        ? {
          status: executionResult.status === 'executed' ? 'success' : 'failed',
          startedAt: executionResult.at,
          finishedAt: executionResult.at,
          exitCode: executionResult.status === 'executed' ? 0 : 1,
          stdoutPreview: '',
          stderrPreview: executionResult.status === 'failed' ? executionResult.evidence : '',
          transportEvidence: [executionResult.evidence],
          liveNetworkCallPerformed: executionResult.sideEffects.liveNetworkCallPerformed,
          remoteProcessSpawned: false,
          filesystemMutationPerformed: false,
          rawCommandSerialized: false,
          secretValuesSerialized: false,
        }
        : transportResult,
      auditTimeline,
      commands: {
        check: 'npm run remote-mesh:sandbox:scoped-mcp-transport --silent',
        focusedTests: 'npx jest tests/services/RemoteMeshSandboxScopedMcpStatusTransportService.test.ts --runInBand',
        typecheck: 'npm run runtime:check --silent',
        nextStage: 'Remote Mesh Cycle 1 Complete',
      },
    };
  }

  private resolveStatus(input: {
    diagnostics: RemoteMeshScopedMcpTransportDiagnostics;
    executionRequested: boolean;
    timelineStatus: string;
    liveProbeStatus: string;
  }): RemoteMeshScopedMcpTransportStatus {
    if (input.diagnostics.guards.some((guard) => guard.status === 'blocked')) {
      return 'blocked';
    }
    if (!input.diagnostics.config.endpointConfigured || !input.diagnostics.config.authTokenConfigured) {
      return 'not-configured';
    }
    if (input.executionRequested && input.liveProbeStatus === 'executed') {
      return 'executed';
    }
    if (input.executionRequested && input.liveProbeStatus === 'failed') {
      return 'failed';
    }
    return input.diagnostics.safeToAttemptNetwork ? 'ready' : 'not-configured';
  }
}

function normalizeConfig(
  config: RemoteMeshScopedMcpStatusHttpTransportConfig,
): Required<RemoteMeshScopedMcpStatusHttpTransportConfig> {
  return {
    endpointUrl: config.endpointUrl || null,
    authToken: config.authToken || null,
    tokenSource: config.tokenSource || (config.authToken ? 'test' : 'none'),
    authHeaderName: config.authHeaderName || 'Authorization',
    allowInsecureHttpForTailnet: config.allowInsecureHttpForTailnet === true,
    timeoutMs: config.timeoutMs || 30000,
  };
}

function parseEndpoint(endpointUrl: string | null): {
  url: URL | null;
  error: string | null;
} {
  if (!endpointUrl) {
    return { url: null, error: null };
  }
  try {
    return { url: new URL(endpointUrl), error: null };
  } catch (error: unknown) {logger.warn('[Remote Mesh Sandbox Scoped Mcp Status Transport] network request failed', error);
    return { url: null, error: 'Endpoint is not a valid URL.' };
  }
}

function buildConfigSnapshot(
  config: Required<RemoteMeshScopedMcpStatusHttpTransportConfig>,
  parsed: { url: URL | null },
): RemoteMeshScopedMcpTransportConfigSnapshot {
  return {
    endpointConfigured: Boolean(config.endpointUrl),
    endpointLabel: parsed.url ? redactedUrl(parsed.url) : null,
    protocol: parsed.url?.protocol === 'http:' || parsed.url?.protocol === 'https:'
      ? parsed.url.protocol
      : null,
    hostLabel: parsed.url?.host || null,
    authHeaderName: config.authHeaderName,
    authTokenConfigured: Boolean(config.authToken),
    tokenSource: config.authToken ? config.tokenSource : 'none',
    allowInsecureHttpForTailnet: config.allowInsecureHttpForTailnet,
    timeoutMs: config.timeoutMs,
    queryKeysRedacted: parsed.url ? Array.from(parsed.url.searchParams.keys()) : [],
  };
}

function buildGuards(
  config: RemoteMeshScopedMcpTransportConfigSnapshot,
  parsed: { url: URL | null; error: string | null },
): RemoteMeshScopedMcpTransportGuard[] {
  const insecureHttpAllowed = parsed.url?.protocol === 'http:'
    && (config.allowInsecureHttpForTailnet || isLoopbackHost(parsed.url.hostname));
  const protocolAllowed = parsed.url?.protocol === 'https:' || insecureHttpAllowed;
  const tokenQueryKeys = config.queryKeysRedacted.filter((key) => /token|secret|key|auth|credential/i.test(key));

  return [
    guard(
      'endpoint-configured',
      config.endpointConfigured && parsed.url ? 'passed' : config.endpointConfigured ? 'blocked' : 'waiting',
      parsed.error || (config.endpointConfigured ? 'Scoped MCP endpoint is configured.' : 'Scoped MCP endpoint is not configured.'),
      'Set ZAVORTH_REMOTE_MESH_MCP_ENDPOINT to the scoped notebook MCP endpoint.',
    ),
    guard(
      'endpoint-http-or-https',
      !config.endpointConfigured
        ? 'waiting'
        : protocolAllowed
          ? 'passed'
          : 'blocked',
      parsed.url
        ? `Endpoint protocol is ${parsed.url.protocol}.`
        : 'No endpoint protocol can be verified.',
      'Use HTTPS, loopback HTTP, or explicitly allow tailnet HTTP with --allow-tailnet-http.',
    ),
    guard(
      'endpoint-no-query-token',
      tokenQueryKeys.length === 0 ? 'passed' : 'blocked',
      tokenQueryKeys.length === 0
        ? 'Endpoint does not include token-like query parameters.'
        : 'Endpoint contains token-like query parameters.',
      'Move all credentials into headers or environment variables.',
    ),
    guard(
      'endpoint-no-userinfo',
      parsed.url && (parsed.url.username || parsed.url.password) ? 'blocked' : 'passed',
      parsed.url && (parsed.url.username || parsed.url.password)
        ? 'Endpoint URL contains username or password.'
        : 'Endpoint URL contains no username/password.',
      'Remove userinfo from the URL and use a scoped auth header.',
    ),
    guard(
      'auth-token-configured',
      config.authTokenConfigured ? 'passed' : 'waiting',
      config.authTokenConfigured
        ? `Auth token is configured from ${config.tokenSource}.`
        : 'No scoped MCP auth token is configured.',
      'Set ZAVORTH_REMOTE_MESH_MCP_TOKEN; do not pass tokens in URLs.',
    ),
    guard(
      'auth-token-header-only',
      config.authTokenConfigured && tokenQueryKeys.length === 0 ? 'passed' : config.authTokenConfigured ? 'blocked' : 'waiting',
      config.authTokenConfigured && tokenQueryKeys.length === 0
        ? `Auth is sent through ${config.authHeaderName}.`
        : 'Auth cannot be proven header-only yet.',
      'Use Authorization or X-Zavorth-Remote-Token header only.',
    ),
    guard(
      'tool-locked',
      'passed',
      'Transport is locked to notebook.get_status.',
      null,
    ),
    guard(
      'schema-only-payload',
      'passed',
      'Transport sends empty schema-bound arguments only.',
      null,
    ),
    guard(
      'post-only',
      'passed',
      'Transport uses POST only.',
      null,
    ),
  ];
}

function guard(
  id: RemoteMeshScopedMcpTransportGuardId,
  status: RemoteMeshScopedMcpTransportGuardStatus,
  evidence: string,
  remediation: string | null,
): RemoteMeshScopedMcpTransportGuard {
  return {
    id,
    status,
    evidence,
    remediation: status === 'passed' ? null : remediation,
  };
}

function mcpStatusPayload(): {
  jsonrpc: '2.0';
  id: 'zavorth-r7-status-probe';
  method: 'tools/call';
  params: {
    name: 'notebook.get_status';
    arguments: Record<string, never>;
  };
} {
  return {
    jsonrpc: '2.0',
    id: 'zavorth-r7-status-probe',
    method: 'tools/call',
    params: {
      name: 'notebook.get_status',
      arguments: {},
    },
  };
}

function redactedUrl(url: URL): string {
  return `${url.protocol}//${url.host}${url.pathname}`;
}

function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

async function defaultFetch(
  url: string,
  init: RemoteMeshScopedMcpHttpRequest['init'],
): Promise<RemoteMeshScopedMcpHttpResponse> {
  return safeFetch(url, init, {
    serviceName: 'Remote mesh scoped MCP status transport',
    allowLoopback: true,
    allowPrivateEnvVar: 'ALLOW_PRIVATE_REMOTE_MESH_TARGETS',
  });
}

function sanitizeResponseText(text: string): string {
  const trimmed = text.slice(0, 2000);
  try {
    const parsed = JSON.parse(trimmed) as RemoteMeshJson;
    return JSON.stringify(redactJson(parsed)).slice(0, 2000);
  } catch (error: unknown) {logger.warn('[Remote Mesh Sandbox Scoped Mcp Status Transport] JSON parse failed', error);
    return trimmed.replace(/(sk-[A-Za-z0-9_-]{8,}|xox[baprs]-[A-Za-z0-9-]{8,})/g, '<redacted>');
  }
}

function redactJson(value: RemoteMeshJson): RemoteMeshJson {
  if (Array.isArray(value)) {
    return value.map((item) => redactJson(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      key,
      /token|secret|key|auth|credential/i.test(key) ? '<redacted>' : redactJson(entry),
    ]));
  }
  if (typeof value === 'string') {
    return value.replace(/(sk-[A-Za-z0-9_-]{8,}|xox[baprs]-[A-Za-z0-9-]{8,})/g, '<redacted>');
  }
  return value;
}
