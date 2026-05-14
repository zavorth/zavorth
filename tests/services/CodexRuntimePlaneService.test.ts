import { CodexAppServerRpcAdapter } from '../../src/adapters/codex/CodexAppServerRpcAdapter.js';
import { CodexModelCatalogAdapter } from '../../src/adapters/codex/CodexModelCatalogAdapter.js';
import { CodexStdioTransportAdapter } from '../../src/adapters/codex/CodexStdioTransportAdapter.js';
import { CodexWebSocketTransportAdapter } from '../../src/adapters/codex/CodexWebSocketTransportAdapter.js';
import type { CodexRuntimeRpcRequest } from '../../src/contracts/CodexRuntimeContract.js';
import { CapabilityNormalizationService } from '../../src/services/CapabilityNormalizationService.js';
import { CodexRuntimePlaneService } from '../../src/services/CodexRuntimePlaneService.js';

describe('CodexRuntimePlaneService Worker 2', () => {
  it('closes Codex app-server runtime parity as Zavorth-native proof', () => {
    const snapshot = new CodexRuntimePlaneService({
      now: () => new Date('2026-05-04T23:00:00.000Z'),
    }).buildSnapshot({
      profile: {
        codexHome: 'C:/Users/example/.codex',
        appServerUrl: 'wss://codex.example.local/app-server',
        headers: {
          Authorization: 'Bearer secret-value',
          'X-Zavorth-Trace': 'trace-1',
        },
      },
    });

    expect(snapshot.contractVersion).toBe('2026-05-04.worker-2');
    expect(snapshot.status).toBe('closed');
    expect(snapshot.sourceModule).toBe('codex');
    expect(snapshot.primitiveId).toBe('agent.runtime');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        features: 14,
        nativeRuntimeProofs: 14,
        missing: 0,
        transports: 2,
        appServerRpcMethods: 12,
        fallbackModels: 4,
        approvalBridgeKinds: 6,
        eventProjectionKinds: 6,
        operatorCommands: 14,
        liveExternalCallRequired: false,
        liveAppServerRequired: false,
        processSpawnRequired: false,
        filesystemWriteRequired: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.transports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'stdio-app-server',
          command: 'codex',
          args: ['app-server', '--listen', 'stdio://'],
          envKeys: ['CODEX_HOME'],
          secretValuesSerialized: false,
        }),
        expect.objectContaining({
          kind: 'websocket-app-server',
          url: 'wss://codex.example.local/app-server',
          headers: expect.objectContaining({
            Authorization: '[redacted]',
            'X-Zavorth-Trace': 'trace-1',
          }),
          secretValuesSerialized: false,
        }),
      ]),
    );
    expect(snapshot.features).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'app-server-rpc', status: 'native-runtime-proof' }),
        expect.objectContaining({ id: 'dynamic-tools', status: 'native-runtime-proof' }),
        expect.objectContaining({ id: 'media-understanding', status: 'native-runtime-proof' }),
        expect.objectContaining({ id: 'migration-import', status: 'native-runtime-proof' }),
        expect.objectContaining({ id: 'computer-use-readiness', status: 'native-runtime-proof' }),
      ]),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        noSourceImports: true,
        noSourceManifestRuntimeDependency: true,
        noLiveIoInProof: true,
        noSecretsSerialized: true,
        artifactFirst: true,
        approvalFirstForSensitiveActions: true,
      }),
    );
  });

  it('keeps codex normalized to a native runtime contract target', () => {
    const normalization = new CapabilityNormalizationService();

    expect(normalization.resolveSourceModule('codex')).toEqual(
      expect.objectContaining({
        primitiveId: 'agent.runtime',
        status: 'normalized',
        targetFiles: expect.objectContaining({
          contract: 'src/contracts/CodexRuntimeContract.ts',
          service: 'src/services/CodexRuntimePlaneService.ts',
          adapter: 'src/adapters/codex',
        }),
      }),
    );
    expect(normalization.getPrimitive('agent.runtime')).toEqual(
      expect.objectContaining({
        runtimeStatus: 'native-contract',
        artifactKinds: ['agent.session', 'agent.transcript', 'agent.trajectory'],
      }),
    );
  });

  it('builds run, dynamic tool, media and migration plans without live IO', () => {
    const service = new CodexRuntimePlaneService();
    const runPlan = service.buildRunPlan({
      threadId: 'thread-1',
      prompt: 'Implement the focused change.',
      workspaceRoot: 'C:/work',
      hostTools: [
        { id: 'shell', label: 'Shell' },
        { id: 'search.query', label: 'Search' },
      ],
    });

    expect(runPlan).toEqual(
      expect.objectContaining({
        runId: 'codex-runtime-thread-1',
        threadId: 'thread-1',
        workspaceRoot: 'C:/work',
        actions: ['initialize', 'model/list', 'thread/resume', 'thread/turn/start'],
        liveIoRequired: false,
        secretValuesSerialized: false,
      }),
    );
    expect(runPlan.dynamicTools).toEqual([
      expect.objectContaining({
        id: 'shell',
        exposed: false,
        policy: 'native-first',
      }),
      expect.objectContaining({
        id: 'search.query',
        exposed: true,
        policy: 'native-first',
      }),
    ]);
    expect(service.buildMediaUnderstandingJob({ sourceArtifactId: 'artifact-image-1' })).toEqual(
      expect.objectContaining({
        sourceArtifactId: 'artifact-image-1',
        mode: 'image',
        sandbox: 'read-only',
        dynamicToolsEnabled: false,
        outputArtifactKind: 'agent.media-understanding',
      }),
    );
    expect(service.buildMigrationPlan({ sourceCodexHome: 'C:/Users/example/.codex' })).toEqual(
      expect.objectContaining({
        sourceCodexHome: 'C:/Users/example/.codex',
        imports: ['profiles', 'skills', 'mcp', 'transcripts', 'account-metadata'],
        automaticWrites: false,
        outputArtifactKind: 'migration.report',
      }),
    );
  });

  it('adapts mocked app-server RPC and model discovery without live app-server dependency', async () => {
    const calls: CodexRuntimeRpcRequest[] = [];
    const rpc = new CodexAppServerRpcAdapter({
      requester: async (request) => {
        calls.push(request);
        if (request.method === 'initialize') {
          return {
            id: request.id,
            result: {
              protocolVersion: '1.0',
              serverName: 'codex-test-server',
              capabilities: ['model/list', 'thread/turn/start'],
            },
          };
        }
        if (request.method === 'model/list') {
          return {
            id: request.id,
            result: {
              models: [
                {
                  id: 'codex-live',
                  label: 'Codex Live',
                  reasoningEfforts: ['medium', 'xhigh'],
                  supportsImages: true,
                  supportsTools: true,
                },
              ],
            },
          };
        }
        if (request.method === 'thread/turn/start') {
          return {
            id: request.id,
            result: {
              turnId: 'turn-1',
              threadId: 'thread-1',
            },
          };
        }
        return { id: request.id, result: {} };
      },
    });

    await expect(rpc.initialize({ clientName: 'zavorth-test' })).resolves.toEqual(
      expect.objectContaining({
        protocolVersion: '1.0',
        serverName: 'codex-test-server',
        capabilities: ['model/list', 'thread/turn/start'],
      }),
    );
    await expect(rpc.sendTurn({ threadId: null, prompt: 'hello' })).resolves.toEqual({
      turnId: 'turn-1',
      threadId: 'thread-1',
    });

    const catalog = new CodexModelCatalogAdapter({ rpcAdapter: rpc });
    await expect(catalog.listModels({ preferLiveDiscovery: true })).resolves.toEqual([
      expect.objectContaining({
        id: 'codex-live',
        source: 'app-server',
        reasoningEfforts: ['medium', 'xhigh'],
      }),
    ]);
    expect(calls.map((call) => call.method)).toEqual(['initialize', 'thread/turn/start', 'model/list']);
  });

  it('keeps transport adapters redacted and no-live-IO', () => {
    const stdio = new CodexStdioTransportAdapter().buildPlan({
      codexHome: 'C:/Users/example/.codex',
    });
    const websocket = new CodexWebSocketTransportAdapter().buildPlan({
      appServerUrl: 'ws://127.0.0.1:9876',
      headers: {
        Authorization: 'Bearer secret',
        Cookie: 'session=secret',
        'X-Trace': 'trace-public',
      },
    });

    expect(stdio).toEqual(
      expect.objectContaining({
        kind: 'stdio-app-server',
        envKeys: ['CODEX_HOME'],
        liveIoRequired: false,
        processSpawnRequired: false,
        secretValuesSerialized: false,
      }),
    );
    expect(websocket).toEqual(
      expect.objectContaining({
        kind: 'websocket-app-server',
        headers: {
          Authorization: '[redacted]',
          Cookie: '[redacted]',
          'X-Trace': 'trace-public',
        },
        liveIoRequired: false,
        secretValuesSerialized: false,
      }),
    );
  });
});
