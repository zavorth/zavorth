import type { RemoteMeshSandboxReadinessSnapshot } from '../../src/contracts/RemoteMeshSandboxReadinessContract.js';
import { ZAVORTH_REMOTE_MESH_SANDBOX_R0_CONTRACT_VERSION } from '../../src/contracts/RemoteMeshSandboxReadinessContract.js';
import type {
  RemoteMeshScopedMcpFetch,
} from '../../src/contracts/RemoteMeshSandboxScopedMcpTransportContract.js';
import {
  RemoteMeshSandboxScopedMcpStatusTransportService,
  ScopedMcpStatusHttpTransport,
} from '../../src/services/RemoteMeshSandboxScopedMcpStatusTransportService.js';

import type { RemoteMeshLiveProbeTransportInvocation } from '../../src/services/RemoteMeshSandboxLiveProbeExecutorService.js';

const readiness = (target = 'notebook-tailnet'): RemoteMeshSandboxReadinessSnapshot => ({
  generatedAt: '2026-05-05T18:00:00.000Z',
  contractVersion: ZAVORTH_REMOTE_MESH_SANDBOX_R0_CONTRACT_VERSION,
  stage: 'R0',
  status: 'ready',
  target: {
    nodeId: target,
    expectedTailnetName: 'zavorth-tailnet',
    expectedPorts: [22],
  },
  summary: {
    checks: 8,
    passed: 8,
    warnings: 0,
    missing: 0,
    blocked: 0,
    notRequired: 0,
    directRouteObserved: true,
    relayRouteObserved: false,
    remoteMutationPerformed: false,
    remoteExecutionRequiredToBuildSnapshot: false,
    freeformShellAllowed: false,
    secretValuesSerialized: false,
  },
  checks: [],
  receipts: [],
  policy: {
    allowRemoteMutationDuringReadiness: false,
    allowFreeformShell: false,
    allowUnauthenticatedMcp: false,
    allowDockerGroupPrivilege: false,
    requireTailscale: false,
    requireSshClient: false,
    requireTermuxForMobileNode: false,
    requireProotDistroForMobileNode: false,
    requireDockerRootlessWhenDockerAvailable: false,
  },
  nextActions: [],
  commands: {
    readiness: 'npx tsx scripts/remote-mesh-sandbox-readiness.ts --json',
    readinessNoLiveProbes: 'npx tsx scripts/remote-mesh-sandbox-readiness.ts --json --no-live-probes',
    focusedTests: 'npx jest tests/services/RemoteMeshSandboxReadinessService.test.ts --runInBand',
    nextAction: 'Remote mesh and sandbox contracts',
  },
});

const fakeFetch = (capture: { url-: string; method-: string; headers-: Record<string, string>; body-: string }): RemoteMeshScopedMcpFetch => async (url, init) => {
  capture.url = url;
  capture.method = init.method;
  capture.headers = init.headers;
  capture.body = init.body;
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    async text() {
      return JSON.stringify({
        result: {
          content: [{ type: 'text', text: 'notebook online' }],
          token: 'should-not-survive',
        },
      });
    },
  };
};

describe('RemoteMeshSandboxScopedMcpStatusTransportService R7', () => {
  it('defaults to not-configured without performing a network call', async () => {
    const capture: Record<string, unknown> = {};
    const snapshot = await new RemoteMeshSandboxScopedMcpStatusTransportService({
      endpointUrl: null,
      authToken: null,
    }, {
      now: () => new Date('2026-05-05T18:00:00.000Z'),
      fetcher: fakeFetch(capture),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-05.remote-mesh-sandbox-r7-scoped-mcp-status-transport');
    expect(snapshot.phase).toBe('R7');
    expect(snapshot.status).toBe('not-configured');
    expect(snapshot.summary.executionPerformed).toBe(false);
    expect(snapshot.summary.liveNetworkCallPerformed).toBe(false);
    expect(capture.url).toBeUndefined();
  });

  it('diagnoses a ready scoped HTTPS MCP status transport without serializing token material', () => {
    const diagnostics = RemoteMeshSandboxScopedMcpStatusTransportService.diagnose({
      endpointUrl: 'https://notebook.tailnet.example/mcp',
      authToken: 'secret-token-value',
      tokenSource: 'test',
    });

    expect(diagnostics.safeToAttemptNetwork).toBe(true);
    expect(diagnostics.config.endpointLabel).toBe('https://notebook.tailnet.example/mcp');
    expect(diagnostics.config.authTokenConfigured).toBe(true);
    expect(diagnostics.payloadPreview).toEqual(
      expect.objectContaining({
        method: 'tools/call',
        toolName: 'notebook.get_status',
        rawCommand: null,
        freeformShell: false,
        schemaLocked: true,
      }),
    );
    expect(JSON.stringify(diagnostics)).not.toContain('secret-token-value');
  });

  it('blocks credential-like query parameters and URL userinfo', () => {
    const diagnostics = RemoteMeshSandboxScopedMcpStatusTransportService.diagnose({
      endpointUrl: 'https://user:pass@notebook.tailnet.example/mcp-auth=secret-auth-value',
      authToken: 'header-token',
      tokenSource: 'test',
    });

    expect(diagnostics.safeToAttemptNetwork).toBe(false);
    expect(diagnostics.validationErrors.join('\n')).toContain('endpoint-no-query-token');
    expect(diagnostics.validationErrors.join('\n')).toContain('endpoint-no-userinfo');
    expect(JSON.stringify(diagnostics)).not.toContain('secret-token-value');
  });

  it('executes the R5/R6 path through one scoped MCP POST when fully armed', async () => {
    const capture: { url-: string; method-: string; headers-: Record<string, string>; body-: string } = {};
    const snapshot = await new RemoteMeshSandboxScopedMcpStatusTransportService({
      endpointUrl: 'https://notebook.tailnet.example/mcp',
      authToken: 'secret-token-value',
      tokenSource: 'test',
    }, {
      now: () => new Date('2026-05-05T18:00:00.000Z'),
      fetcher: fakeFetch(capture),
    }).buildSnapshot({
      executeLiveProbe: true,
      target: 'notebook-tailnet',
      readinessSnapshot: readiness('notebook-tailnet'),
      ownerTrust: true,
      acknowledgedRisk: true,
      armLiveProbe: true,
    });

    expect(snapshot.status).toBe('executed');
    expect(snapshot.summary.liveNetworkCallPerformed).toBe(true);
    expect(snapshot.summary.remoteProcessSpawned).toBe(false);
    expect(snapshot.summary.filesystemMutationPerformed).toBe(false);
    expect(capture.url).toBe('https://notebook.tailnet.example/mcp');
    expect(capture.method).toBe('POST');
    expect(capture.headers?.Authorization).toBe('Bearer secret-token-value');
    expect(JSON.parse(capture.body!)).toEqual({
      jsonrpc: '2.0',
      id: 'zavorth-r7-status-probe',
      method: 'tools/call',
      params: {
        name: 'notebook.get_status',
        arguments: {},
      },
    });
    expect(JSON.stringify(snapshot)).not.toContain('secret-token-value');
    expect(JSON.stringify(snapshot)).not.toContain('should-not-survive');
  });

  it('reports failed when the scoped MCP endpoint returns non-2xx', async () => {
    const snapshot = await new RemoteMeshSandboxScopedMcpStatusTransportService({
      endpointUrl: 'https://notebook.tailnet.example/mcp',
      authToken: 'secret-token-value',
      tokenSource: 'test',
    }, {
      fetcher: async () => ({
        ok: false,
        status: 503,
        statusText: 'Unavailable',
        async text() {
          return 'service unavailable';
        },
      }),
    }).buildSnapshot({
      executeLiveProbe: true,
      target: 'notebook-tailnet',
      readinessSnapshot: readiness('notebook-tailnet'),
      ownerTrust: true,
      acknowledgedRisk: true,
      armLiveProbe: true,
    });

    expect(snapshot.status).toBe('failed');
    expect(snapshot.auditTimeline.source.liveProbeStatus).toBe('failed');
    expect(snapshot.summary.liveNetworkCallPerformed).toBe(true);
  });

  it('refuses direct transport invocations outside notebook.get_status', async () => {
    const result = await new ScopedMcpStatusHttpTransport({
      endpointUrl: 'https://notebook.tailnet.example/mcp',
      authToken: 'secret-token-value',
      tokenSource: 'test',
    }, {
      fetcher: fakeFetch({}),
    }).execute({
      candidate: {
        id: 'unsafe',
        kind: 'mcp-status-probe',
        targetNodeId: 'remote-node:notebook:primary',
        tailnetTarget: 'notebook-tailnet',
        actionId: 'unsafe-action',
        evaluationId: 'unsafe-eval',
        adapterBindingId: 'unsafe-binding',
        toolId: 'notebook.status',
        transport: 'mcp-http',
        risk: 'level-0-readonly',
        approval: 'not-required',
        commandTemplateId: null,
        mcpToolName: 'notebook.get_status',
        rawCommand: null,
        maxRuntimeMs: 30000,
        teardownRequired: false,
      },
      payload: {
        toolName: 'notebook.git.status',
        params: {},
        timeoutMs: 30000,
        targetLabel: 'notebook-tailnet',
      },
      activation: {} as RemoteMeshLiveProbeTransportInvocation['activation'],
    });

    expect(result.status).toBe('failed');
    expect(result.liveNetworkCallPerformed).toBe(false);
    expect(result.remoteProcessSpawned).toBe(false);
    expect(result.filesystemMutationPerformed).toBe(false);
  });
});
