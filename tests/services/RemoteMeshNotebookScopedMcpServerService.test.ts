import type { Server } from 'node:http';

import type {
  RemoteMeshNotebookDockerObservabilityProvider,
  RemoteMeshNotebookProjectFileReadProvider,
} from '@zavorth/mesh/RemoteMeshNotebookScopedMcpServerService.js';
import { RemoteMeshNotebookScopedMcpServerService } from '@zavorth/mesh/RemoteMeshNotebookScopedMcpServerService.js';
import { RemoteMeshSandboxScopedMcpStatusTransportService } from '../../src/services/RemoteMeshSandboxScopedMcpStatusTransportService.js';
import type { RemoteMeshSandboxReadinessSnapshot } from '../../src/contracts/RemoteMeshSandboxReadinessContract.js';
import { ZAVORTH_REMOTE_MESH_SANDBOX_R0_CONTRACT_VERSION } from '../../src/contracts/RemoteMeshSandboxReadinessContract.js';

const token = 'zavorth-r7-5-test-token';
const allowedContainer = 'zavorth-r8-test';
const allowedProject = 'zavorth-r10-test';

const readiness = (target: string): RemoteMeshSandboxReadinessSnapshot => ({
  generatedAt: '2026-05-05T19:00:00.000Z',
  contractVersion: ZAVORTH_REMOTE_MESH_SANDBOX_R0_CONTRACT_VERSION,
  stage: 'R0',
  status: 'ready',
  target: {
    nodeId: target,
    expectedTailnetName: 'zavorth-tailnet',
    expectedPorts: [22],
  },
  summary: {
    checks: 1,
    passed: 1,
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
    nextStage: 'R1 - Remote Mesh and Sandbox Contracts',
  },
});

const service = () => new RemoteMeshNotebookScopedMcpServerService({
  host: '127.0.0.1',
  port: 0,
  authToken: token,
  tokenSource: 'test',
}, {
  now: () => new Date('2026-05-05T19:00:00.000Z'),
});

const dockerProvider: RemoteMeshNotebookDockerObservabilityProvider = {
  async listContainers() {
    return {
      processSpawned: false,
      containers: [
        {
          id: 'allowed001',
          name: allowedContainer,
          image: 'zavorth/test:local',
          state: 'running',
          status: 'Up 2 minutes',
          ports: null,
        },
        {
          id: 'hidden001',
          name: 'not-allowlisted',
          image: 'private/test:local',
          state: 'running',
          status: 'Up 2 minutes',
          ports: null,
        },
      ],
    };
  },
  async getLogs(input) {
    return {
      processSpawned: false,
      logs: [`container=${input.container}`, `lines=${input.lines}`, 'read-only-log'].join('\n'),
    };
  },
  async controlContainer(input) {
    return {
      processSpawned: false,
      dockerMutationPerformed: input.container === allowedContainer
        && (input.action === 'restart' || input.action === 'start' || input.action === 'stop'),
    };
  },
};

const r8Service = () => new RemoteMeshNotebookScopedMcpServerService({
  host: '127.0.0.1',
  port: 0,
  authToken: token,
  tokenSource: 'test',
  enableDockerObservability: true,
  allowedDockerContainers: [allowedContainer],
  maxDockerLogLines: 50,
}, {
  now: () => new Date('2026-05-05T19:00:00.000Z'),
  dockerProvider,
});

const r9Service = () => new RemoteMeshNotebookScopedMcpServerService({
  host: '127.0.0.1',
  port: 0,
  authToken: token,
  tokenSource: 'test',
  enableDockerControl: true,
  allowedDockerContainers: [allowedContainer],
  allowedDockerControlActions: ['restart'],
  maxDockerLogLines: 50,
}, {
  now: () => new Date('2026-05-05T19:00:00.000Z'),
  dockerProvider,
});

const projectFileContent = [
  '# Zavorth R10 Test',
  '',
  'Scoped project file reads are approved and receipted.',
].join('\n');

const projectFileProvider: RemoteMeshNotebookProjectFileReadProvider = {
  async statFile() {
    return {
      sizeBytes: Buffer.byteLength(projectFileContent, 'utf8'),
      isFile: true,
    };
  },
  async readFileUtf8() {
    return {
      content: projectFileContent,
      sizeBytes: Buffer.byteLength(projectFileContent, 'utf8'),
      truncated: false,
    };
  },
};

const r10Service = () => new RemoteMeshNotebookScopedMcpServerService({
  host: '127.0.0.1',
  port: 0,
  authToken: token,
  tokenSource: 'test',
  enableProjectFileRead: true,
  allowedProjectFileRoots: [
    {
      name: allowedProject,
      rootPath: 'C:\\zavorth-r10-test',
    },
  ],
  projectFileReadMaxBytes: 4096,
}, {
  now: () => new Date('2026-05-05T19:00:00.000Z'),
  projectFileProvider,
});

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

describe('RemoteMeshNotebookScopedMcpServerService R7.5', () => {
  it('defaults to not-configured when no token is present', async () => {
    const snapshot = await new RemoteMeshNotebookScopedMcpServerService({
      host: '127.0.0.1',
      port: 8787,
      authToken: null,
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-05.remote-mesh-r7.5-notebook-scoped-mcp-server');
    expect(snapshot.phase).toBe('R7.5');
    expect(snapshot.status).toBe('not-configured');
    expect(snapshot.summary.readyToServe).toBe(false);
    expect(snapshot.config.exposedTools).toEqual(['notebook.get_status']);
    expect(JSON.stringify(snapshot)).not.toContain(token);
  });

  it('passes self-test and closes the ephemeral server', async () => {
    const snapshot = await service().buildSnapshot({ runSelfTest: true });

    expect(snapshot.status).toBe('self-test-passed');
    expect(snapshot.selfTest).toEqual(
      expect.objectContaining({
        requested: true,
        performed: true,
        passed: true,
        httpStatus: 200,
        toolName: 'notebook.get_status',
        serverClosed: true,
        liveNetworkCallPerformed: true,
        remoteProcessSpawned: false,
        filesystemMutationPerformed: false,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      }),
    );
    expect(JSON.stringify(snapshot)).not.toContain(token);
  });

  it('serves tools/list with only notebook.get_status', async () => {
    const started = await service().start();
    try {
      const response = await fetch(started.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'tools-list',
          method: 'tools/list',
        }),
      });
      const json = await response.json() as { result: { tools: Array<{ name: string }> } };
      expect(response.status).toBe(200);
      expect(json.result.tools.map((tool) => tool.name)).toEqual(['notebook.get_status']);
    } finally {
      await close(started.server);
    }
  });

  it('rejects missing auth, GET requests, unknown paths, unknown tools, and non-empty arguments', async () => {
    const started = await service().start();
    try {
      const missingAuth = await fetch(started.url, { method: 'POST', body: '{}' });
      const getRequest = await fetch(started.url, { method: 'GET' });
      const unknownPath = await fetch(started.url.replace('/mcp', '/shell'), { method: 'POST' });
      const unknownTool = await fetch(started.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'unknown-tool',
          method: 'tools/call',
          params: { name: 'shell.run', arguments: {} },
        }),
      });
      const argumentsRequest = await fetch(started.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'arguments',
          method: 'tools/call',
          params: { name: 'notebook.get_status', arguments: { path: 'C:\\Windows' } },
        }),
      });

      expect(missingAuth.status).toBe(401);
      expect(getRequest.status).toBe(405);
      expect(unknownPath.status).toBe(404);
      expect(unknownTool.status).toBe(403);
      expect(argumentsRequest.status).toBe(400);
    } finally {
      await close(started.server);
    }
  });

  it('supports the R7 client end-to-end against the scoped server', async () => {
    const started = await service().start();
    try {
      const snapshot = await new RemoteMeshSandboxScopedMcpStatusTransportService({
        endpointUrl: started.url,
        authToken: token,
        tokenSource: 'test',
        allowInsecureHttpForTailnet: true,
      }).buildSnapshot({
        executeLiveProbe: true,
        target: '127.0.0.1',
        readinessSnapshot: readiness('127.0.0.1'),
        ownerTrust: true,
        acknowledgedRisk: true,
        armLiveProbe: true,
      });

      expect(snapshot.status).toBe('executed');
      expect(snapshot.summary.liveNetworkCallPerformed).toBe(true);
      expect(snapshot.summary.remoteProcessSpawned).toBe(false);
      expect(snapshot.summary.filesystemMutationPerformed).toBe(false);
      expect(JSON.stringify(snapshot)).not.toContain(token);
    } finally {
      await close(started.server);
    }
  });

  it('blocks unsafe public bind unless explicitly allowed', async () => {
    const blocked = await new RemoteMeshNotebookScopedMcpServerService({
      host: '0.0.0.0',
      port: 8787,
      authToken: token,
      tokenSource: 'test',
    }).buildSnapshot();
    const allowed = await new RemoteMeshNotebookScopedMcpServerService({
      host: '0.0.0.0',
      port: 8787,
      authToken: token,
      tokenSource: 'test',
      allowPrivateBind: true,
    }).buildSnapshot();

    expect(blocked.status).toBe('blocked');
    expect(blocked.guards.find((guard) => guard.id === 'bind-host-safe')?.status).toBe('blocked');
    expect(allowed.status).toBe('ready');
  });

  it('enables R8 Docker observability only with an allowlist', async () => {
    const snapshot = await r8Service().buildSnapshot({
      runSelfTest: true,
      includeDockerSelfTest: true,
    });

    expect(snapshot.contractVersion).toBe('2026-05-05.remote-mesh-r8-notebook-docker-observability');
    expect(snapshot.phase).toBe('R8');
    expect(snapshot.status).toBe('self-test-passed');
    expect(snapshot.config.exposedTools).toEqual([
      'notebook.get_status',
      'notebook.docker.list_containers',
      'notebook.docker.get_logs',
    ]);
    expect(snapshot.config.allowedDockerContainers).toEqual([allowedContainer]);
    expect(snapshot.dockerSelfTest.passed).toBe(true);
    expect(snapshot.summary.dockerMutationPerformed).toBe(false);
    expect(JSON.stringify(snapshot)).not.toContain(token);
  });

  it('serves read-only Docker tools and filters non-allowlisted containers', async () => {
    const started = await r8Service().start();
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      const toolsResponse = await fetch(started.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'tools-list',
          method: 'tools/list',
        }),
      });
      const listResponse = await fetch(started.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'list',
          method: 'tools/call',
          params: {
            name: 'notebook.docker.list_containers',
            arguments: {},
          },
        }),
      });
      const logsResponse = await fetch(started.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'logs',
          method: 'tools/call',
          params: {
            name: 'notebook.docker.get_logs',
            arguments: {
              container: allowedContainer,
              lines: 999,
            },
          },
        }),
      });

      const toolsJson = await toolsResponse.json() as { result: { tools: Array<{ name: string }> } };
      const listJson = await listResponse.json() as {
        result: { structuredContent: { containers: Array<{ name: string }> } };
      };
      const logsJson = await logsResponse.json() as {
        result: { structuredContent: { toolName: string; container: string; requestedLines: number; logs: string } };
      };

      expect(toolsJson.result.tools.map((tool) => tool.name)).toEqual([
        'notebook.get_status',
        'notebook.docker.list_containers',
        'notebook.docker.get_logs',
      ]);
      expect(listJson.result.structuredContent.containers.map((container) => container.name)).toEqual([allowedContainer]);
      expect(logsJson.result.structuredContent).toEqual(
        expect.objectContaining({
          toolName: 'notebook.docker.get_logs',
          container: allowedContainer,
          requestedLines: 50,
        }),
      );
      expect(logsJson.result.structuredContent.logs).toContain('read-only-log');
    } finally {
      await close(started.server);
    }
  });

  it('rejects unsafe Docker observability calls and keeps Docker control unavailable', async () => {
    const started = await r8Service().start();
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      const blockedContainer = await fetch(started.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'blocked-container',
          method: 'tools/call',
          params: {
            name: 'notebook.docker.get_logs',
            arguments: {
              container: 'not-allowlisted',
              lines: 10,
            },
          },
        }),
      });
      const unsafeName = await fetch(started.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'unsafe-name',
          method: 'tools/call',
          params: {
            name: 'notebook.docker.get_logs',
            arguments: {
              container: '../zavorth',
              lines: 10,
            },
          },
        }),
      });
      const dockerControl = await fetch(started.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'docker-control',
          method: 'tools/call',
          params: {
            name: 'notebook.docker.restart_container',
            arguments: {
              container: allowedContainer,
            },
          },
        }),
      });

      expect(blockedContainer.status).toBe(403);
      expect(unsafeName.status).toBe(400);
      expect(dockerControl.status).toBe(403);
    } finally {
      await close(started.server);
    }
  });

  it('enables R9 Docker control with preview, approval, and receipt', async () => {
    const snapshot = await r9Service().buildSnapshot({
      runSelfTest: true,
      includeDockerSelfTest: true,
      includeDockerControlSelfTest: true,
    });

    expect(snapshot.contractVersion).toBe('2026-05-05.remote-mesh-r9-notebook-docker-control');
    expect(snapshot.phase).toBe('R9');
    expect(snapshot.config.exposedTools).toEqual([
      'notebook.get_status',
      'notebook.docker.list_containers',
      'notebook.docker.get_logs',
      'notebook.docker.preview_control',
      'notebook.docker.apply_control',
    ]);
    expect(snapshot.config.allowedDockerControlActions).toEqual(['restart']);
    expect(snapshot.dockerControlSelfTest.passed).toBe(true);
    expect(snapshot.dockerControlSelfTest.tools).toEqual({
      previewControl: true,
      applyControl: true,
    });
    expect(snapshot.summary.dockerMutationPerformed).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain(token);
  });

  it('requires an exact approval phrase before applying Docker control', async () => {
    const started = await r9Service().start();
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      const previewResponse = await fetch(started.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'preview',
          method: 'tools/call',
          params: {
            name: 'notebook.docker.preview_control',
            arguments: {
              container: allowedContainer,
              action: 'restart',
            },
          },
        }),
      });
      const previewJson = await previewResponse.json() as {
        result: { structuredContent: { approvalId: string; approvalPhrase: string; dockerMutationPerformed: boolean } };
      };
      const badApproval = await fetch(started.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'bad-approval',
          method: 'tools/call',
          params: {
            name: 'notebook.docker.apply_control',
            arguments: {
              approvalId: previewJson.result.structuredContent.approvalId,
              approvalPhrase: 'APPROVE SOMETHING ELSE',
            },
          },
        }),
      });
      const applyResponse = await fetch(started.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'apply',
          method: 'tools/call',
          params: {
            name: 'notebook.docker.apply_control',
            arguments: {
              approvalId: previewJson.result.structuredContent.approvalId,
              approvalPhrase: previewJson.result.structuredContent.approvalPhrase,
            },
          },
        }),
      });
      const applyJson = await applyResponse.json() as {
        result: { structuredContent: { toolName: string; action: string; container: string; dockerMutationPerformed: boolean } };
      };
      const replayResponse = await fetch(started.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'replay',
          method: 'tools/call',
          params: {
            name: 'notebook.docker.apply_control',
            arguments: {
              approvalId: previewJson.result.structuredContent.approvalId,
              approvalPhrase: previewJson.result.structuredContent.approvalPhrase,
            },
          },
        }),
      });

      expect(previewResponse.status).toBe(200);
      expect(previewJson.result.structuredContent.dockerMutationPerformed).toBe(false);
      expect(badApproval.status).toBe(403);
      expect(applyResponse.status).toBe(200);
      expect(applyJson.result.structuredContent).toEqual(
        expect.objectContaining({
          toolName: 'notebook.docker.apply_control',
          action: 'restart',
          container: allowedContainer,
          dockerMutationPerformed: true,
        }),
      );
      expect(replayResponse.status).toBe(403);
    } finally {
      await close(started.server);
    }
  });

  it('blocks non-allowlisted Docker control actions and raw control shapes', async () => {
    const started = await r9Service().start();
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      const stopResponse = await fetch(started.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'stop',
          method: 'tools/call',
          params: {
            name: 'notebook.docker.preview_control',
            arguments: {
              container: allowedContainer,
              action: 'stop',
            },
          },
        }),
      });
      const rawShapeResponse = await fetch(started.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'raw',
          method: 'tools/call',
          params: {
            name: 'notebook.docker.preview_control',
            arguments: {
              container: allowedContainer,
              action: 'restart',
              command: 'docker restart zavorth-r8-test',
            },
          },
        }),
      });
      const execResponse = await fetch(started.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'exec',
          method: 'tools/call',
          params: {
            name: 'notebook.docker.exec',
            arguments: {
              container: allowedContainer,
            },
          },
        }),
      });

      expect(stopResponse.status).toBe(403);
      expect(rawShapeResponse.status).toBe(400);
      expect(execResponse.status).toBe(403);
    } finally {
      await close(started.server);
    }
  });

  it('enables R10 project file reads with preview, approval, and receipt', async () => {
    const snapshot = await r10Service().buildSnapshot({
      runSelfTest: true,
      includeProjectFileReadSelfTest: true,
    });

    expect(snapshot.contractVersion).toBe('2026-05-05.remote-mesh-r10-notebook-project-file-read');
    expect(snapshot.phase).toBe('R10');
    expect(snapshot.config.exposedTools).toEqual([
      'notebook.get_status',
      'notebook.project_files.preview_read',
      'notebook.project_files.apply_read',
    ]);
    expect(snapshot.config.allowedProjectFileRoots).toEqual([allowedProject]);
    expect(snapshot.projectFileReadSelfTest.passed).toBe(true);
    expect(snapshot.summary.projectFileReadPerformed).toBe(true);
    expect(snapshot.summary.filesystemMutationPerformed).toBe(false);
    expect(JSON.stringify(snapshot)).not.toContain(token);
    expect(JSON.stringify(snapshot)).not.toContain('C:\\zavorth-r10-test');
  });

  it('reads an approved project file and blocks approval replay', async () => {
    const started = await r10Service().start();
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      const previewResponse = await fetch(started.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'preview-file',
          method: 'tools/call',
          params: {
            name: 'notebook.project_files.preview_read',
            arguments: {
              project: allowedProject,
              relativePath: 'README.md',
            },
          },
        }),
      });
      const previewJson = await previewResponse.json() as {
        result: { structuredContent: { approvalId: string; approvalPhrase: string; filesystemMutationPerformed: boolean; rawPathSerialized: boolean } };
      };
      const badApproval = await fetch(started.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'bad-file-approval',
          method: 'tools/call',
          params: {
            name: 'notebook.project_files.apply_read',
            arguments: {
              approvalId: previewJson.result.structuredContent.approvalId,
              approvalPhrase: 'APPROVE SOMETHING ELSE',
            },
          },
        }),
      });
      const applyResponse = await fetch(started.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'apply-file',
          method: 'tools/call',
          params: {
            name: 'notebook.project_files.apply_read',
            arguments: {
              approvalId: previewJson.result.structuredContent.approvalId,
              approvalPhrase: previewJson.result.structuredContent.approvalPhrase,
            },
          },
        }),
      });
      const applyJson = await applyResponse.json() as {
        result: { structuredContent: { toolName: string; content: string; filesystemMutationPerformed: boolean; rawPathSerialized: boolean } };
      };
      const replayResponse = await fetch(started.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'replay-file',
          method: 'tools/call',
          params: {
            name: 'notebook.project_files.apply_read',
            arguments: {
              approvalId: previewJson.result.structuredContent.approvalId,
              approvalPhrase: previewJson.result.structuredContent.approvalPhrase,
            },
          },
        }),
      });

      expect(previewResponse.status).toBe(200);
      expect(previewJson.result.structuredContent.filesystemMutationPerformed).toBe(false);
      expect(previewJson.result.structuredContent.rawPathSerialized).toBe(false);
      expect(badApproval.status).toBe(403);
      expect(applyResponse.status).toBe(200);
      expect(applyJson.result.structuredContent).toEqual(
        expect.objectContaining({
          toolName: 'notebook.project_files.apply_read',
          filesystemMutationPerformed: false,
          rawPathSerialized: false,
        }),
      );
      expect(applyJson.result.structuredContent.content).toContain('Scoped project file reads');
      expect(replayResponse.status).toBe(403);
    } finally {
      await close(started.server);
    }
  });

  it('blocks traversal, absolute paths, unknown projects, and file write tools', async () => {
    const started = await r10Service().start();
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      const traversal = await fetch(started.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'traversal',
          method: 'tools/call',
          params: {
            name: 'notebook.project_files.preview_read',
            arguments: {
              project: allowedProject,
              relativePath: '../secret.txt',
            },
          },
        }),
      });
      const absolute = await fetch(started.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'absolute',
          method: 'tools/call',
          params: {
            name: 'notebook.project_files.preview_read',
            arguments: {
              project: allowedProject,
              relativePath: 'C:\\Windows\\win.ini',
            },
          },
        }),
      });
      const unknownProject = await fetch(started.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'unknown-project',
          method: 'tools/call',
          params: {
            name: 'notebook.project_files.preview_read',
            arguments: {
              project: 'other-project',
              relativePath: 'README.md',
            },
          },
        }),
      });
      const writeTool = await fetch(started.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'write-tool',
          method: 'tools/call',
          params: {
            name: 'notebook.project_files.write',
            arguments: {
              project: allowedProject,
              relativePath: 'README.md',
              content: 'nope',
            },
          },
        }),
      });

      expect(traversal.status).toBe(400);
      expect(absolute.status).toBe(400);
      expect(unknownProject.status).toBe(403);
      expect(writeTool.status).toBe(403);
    } finally {
      await close(started.server);
    }
  });
});
