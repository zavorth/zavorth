import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { cpus, freemem, hostname, loadavg, platform, totalmem, uptime, arch } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  RemoteMeshNotebookDockerControlAction,
  RemoteMeshNotebookDockerControlPreviewPayload,
  RemoteMeshNotebookDockerControlReceiptPayload,
  RemoteMeshNotebookDockerControlSelfTest,
  RemoteMeshNotebookDockerContainerSummary,
  RemoteMeshNotebookDockerListContainersPayload,
  RemoteMeshNotebookDockerLogsPayload,
  RemoteMeshNotebookDockerObservabilitySelfTest,
  RemoteMeshNotebookProjectFileReadPreviewPayload,
  RemoteMeshNotebookProjectFileReadReceiptPayload,
  RemoteMeshNotebookProjectFileReadSelfTest,
  RemoteMeshNotebookProjectFileRootConfig,
  RemoteMeshNotebookScopedMcpSelfTest,
  RemoteMeshNotebookScopedMcpServerConfig,
  RemoteMeshNotebookScopedMcpServerConfigSnapshot,
  RemoteMeshNotebookScopedMcpServerGuard,
  RemoteMeshNotebookScopedMcpServerGuardId,
  RemoteMeshNotebookScopedMcpServerGuardStatus,
  RemoteMeshNotebookScopedMcpServerSnapshot,
  RemoteMeshNotebookScopedMcpServerStatus,
  RemoteMeshNotebookScopedMcpToolName,
  RemoteMeshNotebookStatusPayload,
} from '../contracts/RemoteMeshNotebookScopedMcpServerContract.js';
import {
  ZAVORTH_REMOTE_MESH_R7_5_NOTEBOOK_SCOPED_MCP_SERVER_VERSION,
  ZAVORTH_REMOTE_MESH_R8_NOTEBOOK_DOCKER_OBSERVABILITY_VERSION,
  ZAVORTH_REMOTE_MESH_R9_NOTEBOOK_DOCKER_CONTROL_VERSION,
  ZAVORTH_REMOTE_MESH_R10_NOTEBOOK_PROJECT_FILE_READ_VERSION,
} from '../contracts/RemoteMeshNotebookScopedMcpServerContract.js';
import type { RemoteMeshJson } from '../contracts/RemoteMeshSandboxContract.js';
import { RemoteMeshSandboxScopedMcpStatusTransportService } from '@zavorth/services/RemoteMeshSandboxScopedMcpStatusTransportService.js';
import type { RemoteMeshSandboxReadinessSnapshot } from '../contracts/RemoteMeshSandboxReadinessContract.js';
import {
  DockerCliObservabilityProvider,
  FsProjectFileReadProvider,
  approvalPhraseFor,
  closeServer,
  countLines,
  dockerControlExpectedEffect,
  emptyDockerControlSelfTest,
  emptyDockerSelfTest,
  emptyProjectFileReadSelfTest,
  emptySelfTest,
  getNestedToolName,
  guard,
  isDockerControlAction,
  isPathInsideRoot,
  isSafeDockerIdentifier,
  isSafeProjectName,
  isSafeRelativeProjectPath,
  isSensitiveFileName,
  jsonRpcError,
  normalizeConfig,
  normalizeLogLines,
  normalizeRelativeProjectPath,
  parseJsonRpc,
  projectFileApprovalPhraseFor,
  readBody,
  readProcessSpawned,
  redactServerResponse,
  structuredContentOf,
  toolErrorResult,
  toolResult,
  writeJson,
} from '@zavorth/services/RemoteMeshNotebookScopedMcpServerHelpers.js';
import {
  buildNotebookScopedMcpConfigSnapshot,
  buildNotebookScopedMcpGuards,
  hostForUrl,
  resolveNotebookScopedMcpStatus,
} from '@zavorth/services/RemoteMeshNotebookScopedMcpServerGuardHelpers.js';
import { buildNotebookScopedMcpSelfTestReadiness } from '@zavorth/services/RemoteMeshNotebookScopedMcpSelfTestReadiness.js';
import { safeFetch } from '../security/SafeFetchService.js';

export type RemoteMeshNotebookDockerObservabilityProvider = {
  listContainers: () => Promise<{
    containers: RemoteMeshNotebookDockerContainerSummary[];
    processSpawned: boolean;
  }>;
  getLogs: (input: { container: string; lines: number }) => Promise<{
    logs: string;
    processSpawned: boolean;
  }>;
  controlContainer?: (input: { container: string; action: RemoteMeshNotebookDockerControlAction }) => Promise<{
    processSpawned: boolean;
    dockerMutationPerformed: boolean;
  }>;
};

type PendingDockerControlApproval = {
  approvalId: string;
  approvalPhrase: string;
  container: string;
  action: RemoteMeshNotebookDockerControlAction;
  createdAt: number;
  expiresAt: number;
};

type PendingProjectFileReadApproval = {
  approvalId: string;
  approvalPhrase: string;
  project: string;
  relativePath: string;
  resolvedPath: string;
  sizeBytes: number;
  createdAt: number;
  expiresAt: number;
};

export type RemoteMeshNotebookProjectFileReadProvider = {
  statFile: (input: { resolvedPath: string }) => Promise<{ sizeBytes: number; isFile: boolean }>;
  readFileUtf8: (input: { resolvedPath: string; maxBytes: number }) => Promise<{ content: string; sizeBytes: number; truncated: boolean }>;
};

type RemoteMeshNotebookScopedMcpServerRuntime = {
  now?: () => Date;
  statusProvider?: () => RemoteMeshNotebookStatusPayload;
  dockerProvider?: RemoteMeshNotebookDockerObservabilityProvider;
  projectFileProvider?: RemoteMeshNotebookProjectFileReadProvider;
};

export type RemoteMeshNotebookScopedMcpServerSnapshotInput = {
  runSelfTest?: boolean;
  includeR7ClientSmoke?: boolean;
  includeDockerSelfTest?: boolean;
  includeDockerControlSelfTest?: boolean;
  includeProjectFileReadSelfTest?: boolean;
};

export type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: {
    name?: string;
    arguments?: Record<string, RemoteMeshJson> | null;
  };
};

export class RemoteMeshNotebookScopedMcpServerService {
  private readonly now: () => Date;
  private readonly config: Required<RemoteMeshNotebookScopedMcpServerConfig>;
  private readonly statusProvider?: () => RemoteMeshNotebookStatusPayload;
  private readonly dockerProvider: RemoteMeshNotebookDockerObservabilityProvider;
  private readonly projectFileProvider: RemoteMeshNotebookProjectFileReadProvider;
  private readonly pendingDockerControlApprovals = new Map<string, PendingDockerControlApproval>();
  private readonly pendingProjectFileReadApprovals = new Map<string, PendingProjectFileReadApproval>();

  constructor(
    config: RemoteMeshNotebookScopedMcpServerConfig,
    runtime: RemoteMeshNotebookScopedMcpServerRuntime = {},
  ) {
    this.now = runtime.now || (() => new Date());
    this.config = normalizeConfig(config);
    this.statusProvider = runtime.statusProvider;
    this.dockerProvider = runtime.dockerProvider || new DockerCliObservabilityProvider(this.config.dockerCliPath);
    this.projectFileProvider = runtime.projectFileProvider || new FsProjectFileReadProvider();
  }

  public static generatedSelfTestToken(): string {
    return `zavorth-r7-5-${randomUUID()}`;
  }

  public buildServer(): Server {
    return createServer((request, response) => {
      this.handleRequest(request, response).catch((error) => {
        writeJson(response, 500, jsonRpcError(null, -32603, error instanceof Error ? error.message : 'Internal server error.'));
      });
    });
  }

  public async start(): Promise<{ server: Server; url: string }> {
    const server = this.buildServer();
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(this.config.port, this.config.host, () => {
        server.off('error', reject);
        resolve();
      });
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : this.config.port;
    return {
      server,
      url: `http://${hostForUrl(this.config.host)}:${port}/mcp`,
    };
  }

  public async buildSnapshot(
    input: RemoteMeshNotebookScopedMcpServerSnapshotInput = {},
  ): Promise<RemoteMeshNotebookScopedMcpServerSnapshot> {
    const guards = buildNotebookScopedMcpGuards({
      config: this.config,
      exposedTools: this.exposedTools(),
    });
    const readyToServe = guards.every((guard) => guard.status === 'passed');
    const selfTest = input.runSelfTest ? await this.runSelfTest(readyToServe) : emptySelfTest(false);
    const dockerSelfTest = input.includeDockerSelfTest
      ? await this.runDockerSelfTest(readyToServe)
      : emptyDockerSelfTest(false);
    const dockerControlSelfTest = input.includeDockerControlSelfTest
      ? await this.runDockerControlSelfTest(readyToServe)
      : emptyDockerControlSelfTest(false);
    const projectFileReadSelfTest = input.includeProjectFileReadSelfTest
      ? await this.runProjectFileReadSelfTest(readyToServe)
      : emptyProjectFileReadSelfTest(false);
    const r7ClientSmoke = input.includeR7ClientSmoke && selfTest.passed
      ? await this.runR7ClientSmoke()
      : null;
    const status = resolveNotebookScopedMcpStatus({ guards, selfTest, readyToServe });
    const exposedTools = this.exposedTools();
    const r10Enabled = this.config.enableProjectFileRead;
    const r9Enabled = this.config.enableDockerControl;
    const r8Enabled = this.config.enableDockerObservability || r9Enabled;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: r10Enabled
        ? ZAVORTH_REMOTE_MESH_R10_NOTEBOOK_PROJECT_FILE_READ_VERSION
        : r9Enabled
          ? ZAVORTH_REMOTE_MESH_R9_NOTEBOOK_DOCKER_CONTROL_VERSION
          : r8Enabled
            ? ZAVORTH_REMOTE_MESH_R8_NOTEBOOK_DOCKER_OBSERVABILITY_VERSION
            : ZAVORTH_REMOTE_MESH_R7_5_NOTEBOOK_SCOPED_MCP_SERVER_VERSION,
      phase: r10Enabled ? 'R10' : r9Enabled ? 'R9' : r8Enabled ? 'R8' : 'R7.5',
      status,
      summary: {
        guards: guards.length,
        passed: guards.filter((guard) => guard.status === 'passed').length,
        waiting: guards.filter((guard) => guard.status === 'waiting').length,
        blocked: guards.filter((guard) => guard.status === 'blocked').length,
        readyToServe,
        selfTestRequested: input.runSelfTest === true,
        selfTestPassed: selfTest.passed,
        dockerSelfTestRequested: input.includeDockerSelfTest === true,
        dockerSelfTestPassed: dockerSelfTest.passed,
        dockerControlSelfTestRequested: input.includeDockerControlSelfTest === true,
        dockerControlSelfTestPassed: dockerControlSelfTest.passed,
        projectFileReadSelfTestRequested: input.includeProjectFileReadSelfTest === true,
        projectFileReadSelfTestPassed: projectFileReadSelfTest.passed,
        exposedToolCount: exposedTools.length,
        liveNetworkCallPerformed: selfTest.liveNetworkCallPerformed
          || dockerSelfTest.liveNetworkCallPerformed
          || dockerControlSelfTest.liveNetworkCallPerformed
          || projectFileReadSelfTest.liveNetworkCallPerformed
          || r7ClientSmoke?.summary.liveNetworkCallPerformed === true,
        remoteProcessSpawned: selfTest.remoteProcessSpawned
          || dockerSelfTest.remoteProcessSpawned
          || dockerControlSelfTest.remoteProcessSpawned,
        filesystemMutationPerformed: false,
        mutationPerformed: dockerControlSelfTest.dockerMutationPerformed,
        dockerMutationPerformed: dockerControlSelfTest.dockerMutationPerformed,
        projectFileReadPerformed: projectFileReadSelfTest.passed,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      },
      config: buildNotebookScopedMcpConfigSnapshot({
        config: this.config,
        exposedTools: this.exposedTools(),
      }),
      guards,
      selfTest,
      dockerSelfTest,
      dockerControlSelfTest,
      projectFileReadSelfTest,
      r7ClientSmoke,
      commands: {
        check: 'npm run remote-mesh:notebook:scoped-mcp-server --silent',
        serve: 'npm run remote-mesh:notebook:scoped-mcp-server:serve --silent',
        focusedTests: 'npx jest tests/services/RemoteMeshNotebookScopedMcpServerService.test.ts --runInBand',
        typecheck: 'npm run runtime:check --silent',
        nextStage: r10Enabled
          ? 'R11 - Mobile UX Integration'
          : r9Enabled
            ? 'R10 - Scoped Project File Reads'
            : r8Enabled
              ? 'R9 - Docker Control With Approval'
              : 'R8 - Docker Observability Tools',
      },
    };
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (requestUrl.pathname !== '/mcp') {
      writeJson(response, 404, jsonRpcError(null, -32004, 'Only /mcp is exposed by the scoped notebook MCP server.'));
      return;
    }
    if (request.method !== 'POST') {
      writeJson(response, 405, jsonRpcError(null, -32005, 'Only POST is allowed.'));
      return;
    }
    if (!this.isAuthorized(request)) {
      writeJson(response, 401, jsonRpcError(null, -32001, 'Unauthorized scoped MCP request.'));
      return;
    }

    const rawBody = await readBody(request, 16 * 1024);
    const parsed = parseJsonRpc(rawBody);
    if (!parsed.ok) {
      writeJson(response, 400, jsonRpcError(null, -32700, parsed.error));
      return;
    }

    const result = await this.dispatchJsonRpc(parsed.request);
    writeJson(response, result.httpStatus, result.body);
  }

  private async dispatchJsonRpc(request: JsonRpcRequest): Promise<{
    httpStatus: number;
    body: Record<string, RemoteMeshJson>;
  }> {
    const id = request.id ?? null;

    if (request.jsonrpc !== '2.0') {
      return { httpStatus: 400, body: jsonRpcError(id, -32600, 'JSON-RPC 2.0 is required.') };
    }

    if (request.method === 'tools/list') {
      return {
        httpStatus: 200,
        body: {
          jsonrpc: '2.0',
          id,
          result: {
            tools: this.toolDefinitions(),
          },
        },
      };
    }

    if (request.method !== 'tools/call') {
      return {
        httpStatus: 400,
        body: jsonRpcError(id, -32601, 'Only tools/list and tools/call are supported.'),
      };
    }

    const toolName = request.params?.name;
    const toolArgs = request.params?.arguments || {};
    if (!toolName || !this.exposedTools().includes(toolName as RemoteMeshNotebookScopedMcpToolName)) {
      return {
        httpStatus: 403,
        body: jsonRpcError(id, -32003, this.config.enableDockerObservability
          ? 'Only notebook.get_status and read-only Docker observability tools are exposed.'
          : 'Only notebook.get_status is exposed.'),
      };
    }

    if (toolName === 'notebook.get_status') {
      if (Object.keys(toolArgs).length > 0) {
        return {
          httpStatus: 400,
          body: jsonRpcError(id, -32602, 'notebook.get_status does not accept arguments.'),
        };
      }

      const status = this.statusProvider ? this.statusProvider() : this.defaultNotebookStatus();
      return {
        httpStatus: 200,
        body: toolResult(id, status),
      };
    }

    if (toolName === 'notebook.docker.list_containers') {
      return this.handleDockerListContainers(id, toolArgs);
    }

    if (toolName === 'notebook.docker.get_logs') {
      return this.handleDockerGetLogs(id, toolArgs);
    }

    if (toolName === 'notebook.docker.preview_control') {
      return this.handleDockerPreviewControl(id, toolArgs);
    }

    if (toolName === 'notebook.docker.apply_control') {
      return this.handleDockerApplyControl(id, toolArgs);
    }

    if (toolName === 'notebook.project_files.preview_read') {
      return this.handleProjectFilePreviewRead(id, toolArgs);
    }

    if (toolName === 'notebook.project_files.apply_read') {
      return this.handleProjectFileApplyRead(id, toolArgs);
    }

    return {
      httpStatus: 403,
      body: jsonRpcError(id, -32003, 'Tool is not exposed.'),
    };
  }

  private exposedTools(): RemoteMeshNotebookScopedMcpToolName[] {
    const tools: RemoteMeshNotebookScopedMcpToolName[] = ['notebook.get_status'];
    if (this.config.enableDockerObservability) {
      tools.push('notebook.docker.list_containers', 'notebook.docker.get_logs');
    }
    if (this.config.enableDockerControl) {
      tools.push('notebook.docker.preview_control', 'notebook.docker.apply_control');
    }
    if (this.config.enableProjectFileRead) {
      tools.push('notebook.project_files.preview_read', 'notebook.project_files.apply_read');
    }
    return tools;
  }

  private toolDefinitions(): RemoteMeshJson[] {
    const definitions: RemoteMeshJson[] = [
      {
        name: 'notebook.get_status',
        description: 'Return a read-only Zavorth notebook status snapshot.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
    ];

    if (this.config.enableDockerObservability) {
      definitions.push(
        {
          name: 'notebook.docker.list_containers',
          description: 'Return read-only summaries for Docker containers allowed by Zavorth policy.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
        },
        {
          name: 'notebook.docker.get_logs',
          description: 'Return tail logs for one allowlisted Docker container without accepting raw shell commands.',
          inputSchema: {
            type: 'object',
            required: ['container'],
            properties: {
              container: {
                type: 'string',
                enum: this.config.allowedDockerContainers,
              },
              lines: {
                type: 'integer',
                minimum: 1,
                maximum: this.config.maxDockerLogLines,
              },
            },
            additionalProperties: false,
          },
        },
      );
    }

    if (this.config.enableDockerControl) {
      definitions.push(
        {
          name: 'notebook.docker.preview_control',
          description: 'Preview an allowlisted Docker lifecycle action and create a short-lived approval request.',
          inputSchema: {
            type: 'object',
            required: ['container', 'action'],
            properties: {
              container: {
                type: 'string',
                enum: this.config.allowedDockerContainers,
              },
              action: {
                type: 'string',
                enum: this.config.allowedDockerControlActions,
              },
            },
            additionalProperties: false,
          },
        },
        {
          name: 'notebook.docker.apply_control',
          description: 'Apply a previously previewed Docker lifecycle action after conversational approval.',
          inputSchema: {
            type: 'object',
            required: ['approvalId', 'approvalPhrase'],
            properties: {
              approvalId: {
                type: 'string',
              },
              approvalPhrase: {
                type: 'string',
              },
            },
            additionalProperties: false,
          },
        },
      );
    }

    if (this.config.enableProjectFileRead) {
      definitions.push(
        {
          name: 'notebook.project_files.preview_read',
          description: 'Preview a read from an allowlisted project root and create a short-lived approval request.',
          inputSchema: {
            type: 'object',
            required: ['project', 'relativePath'],
            properties: {
              project: {
                type: 'string',
                enum: this.config.allowedProjectFileRoots.map((rootEntry) => rootEntry.name),
              },
              relativePath: {
                type: 'string',
              },
            },
            additionalProperties: false,
          },
        },
        {
          name: 'notebook.project_files.apply_read',
          description: 'Read an approved project file using an exact approval phrase and return a receipt.',
          inputSchema: {
            type: 'object',
            required: ['approvalId', 'approvalPhrase'],
            properties: {
              approvalId: {
                type: 'string',
              },
              approvalPhrase: {
                type: 'string',
              },
            },
            additionalProperties: false,
          },
        },
      );
    }

    return definitions;
  }

  private async handleDockerListContainers(
    id: RemoteMeshJson,
    args: Record<string, RemoteMeshJson>,
  ): Promise<{ httpStatus: number; body: Record<string, RemoteMeshJson> }> {
    if (Object.keys(args).length > 0) {
      return {
        httpStatus: 400,
        body: jsonRpcError(id, -32602, 'notebook.docker.list_containers does not accept arguments.'),
      };
    }

    try {
      const result = await this.dockerProvider.listContainers();
      const allowed = new Set(this.config.allowedDockerContainers);
      const payload: RemoteMeshNotebookDockerListContainersPayload = {
        schemaVersion: 1,
        generatedAt: this.now().toISOString(),
        toolName: 'notebook.docker.list_containers',
        containers: result.containers.filter((container) => allowed.has(container.name)),
        allowedContainers: this.config.allowedDockerContainers,
        readOnly: true,
        processSpawned: result.processSpawned,
        rawCommandSerialized: false,
      };
      return {
        httpStatus: 200,
        body: toolResult(id, payload),
      };
    } catch (error) {
      return {
        httpStatus: 200,
        body: toolErrorResult(id, {
          toolName: 'notebook.docker.list_containers',
          readOnly: true,
          error: error instanceof Error ? error.message : 'Docker container listing failed.',
        }),
      };
    }
  }

  private async handleDockerGetLogs(
    id: RemoteMeshJson,
    args: Record<string, RemoteMeshJson>,
  ): Promise<{ httpStatus: number; body: Record<string, RemoteMeshJson> }> {
    const extraKeys = Object.keys(args).filter((key) => key !== 'container' && key !== 'lines');
    if (extraKeys.length > 0) {
      return {
        httpStatus: 400,
        body: jsonRpcError(id, -32602, `Unsupported notebook.docker.get_logs argument: ${extraKeys[0]}.`),
      };
    }

    const container = args.container;
    if (typeof container !== 'string' || !isSafeDockerIdentifier(container)) {
      return {
        httpStatus: 400,
        body: jsonRpcError(id, -32602, 'container must be a safe Docker container name from the allowlist.'),
      };
    }
    if (!this.config.allowedDockerContainers.includes(container)) {
      return {
        httpStatus: 403,
        body: jsonRpcError(id, -32030, `Container ${container} is not allowlisted for Zavorth Docker observability.`),
      };
    }

    const requestedLines = normalizeLogLines(args.lines, this.config.maxDockerLogLines);
    try {
      const result = await this.dockerProvider.getLogs({ container, lines: requestedLines });
      const payload: RemoteMeshNotebookDockerLogsPayload = {
        schemaVersion: 1,
        generatedAt: this.now().toISOString(),
        toolName: 'notebook.docker.get_logs',
        container,
        requestedLines,
        maxLines: this.config.maxDockerLogLines,
        logs: result.logs,
        lineCount: countLines(result.logs),
        readOnly: true,
        processSpawned: result.processSpawned,
        rawCommandSerialized: false,
      };
      return {
        httpStatus: 200,
        body: toolResult(id, payload),
      };
    } catch (error) {
      return {
        httpStatus: 200,
        body: toolErrorResult(id, {
          toolName: 'notebook.docker.get_logs',
          container,
          requestedLines,
          readOnly: true,
          error: error instanceof Error ? error.message : 'Docker logs read failed.',
        }),
      };
    }
  }

  private async handleDockerPreviewControl(
    id: RemoteMeshJson,
    args: Record<string, RemoteMeshJson>,
  ): Promise<{ httpStatus: number; body: Record<string, RemoteMeshJson> }> {
    const extraKeys = Object.keys(args).filter((key) => key !== 'container' && key !== 'action');
    if (extraKeys.length > 0) {
      return {
        httpStatus: 400,
        body: jsonRpcError(id, -32602, `Unsupported notebook.docker.preview_control argument: ${extraKeys[0]}.`),
      };
    }

    const parsed = this.parseDockerControlTarget(id, args, 'preview');
    if (!parsed.ok) {
      return parsed.error;
    }

    const nowMs = this.now().getTime();
    const approvalId = `zdc-${randomUUID()}`;
    const approvalPhrase = approvalPhraseFor(parsed.action, parsed.container);
    const expiresAt = nowMs + this.config.dockerControlApprovalTtlMs;
    this.pendingDockerControlApprovals.set(approvalId, {
      approvalId,
      approvalPhrase,
      container: parsed.container,
      action: parsed.action,
      createdAt: nowMs,
      expiresAt,
    });

    const payload: RemoteMeshNotebookDockerControlPreviewPayload = {
      schemaVersion: 1,
      generatedAt: this.now().toISOString(),
      toolName: 'notebook.docker.preview_control',
      approvalId,
      approvalPhrase,
      expiresAt: new Date(expiresAt).toISOString(),
      container: parsed.container,
      action: parsed.action,
      risk: 'medium',
      reversible: parsed.action === 'start' || parsed.action === 'stop' || parsed.action === 'restart',
      templateLabel: 'docker-container-lifecycle',
      expectedEffect: dockerControlExpectedEffect(parsed.action, parsed.container),
      requiresApproval: true,
      processSpawned: false,
      dockerMutationPerformed: false,
      rawCommandSerialized: false,
    };

    return {
      httpStatus: 200,
      body: toolResult(id, payload),
    };
  }

  private async handleDockerApplyControl(
    id: RemoteMeshJson,
    args: Record<string, RemoteMeshJson>,
  ): Promise<{ httpStatus: number; body: Record<string, RemoteMeshJson> }> {
    const extraKeys = Object.keys(args).filter((key) => key !== 'approvalId' && key !== 'approvalPhrase');
    if (extraKeys.length > 0) {
      return {
        httpStatus: 400,
        body: jsonRpcError(id, -32602, `Unsupported notebook.docker.apply_control argument: ${extraKeys[0]}.`),
      };
    }

    const approvalId = args.approvalId;
    const approvalPhrase = args.approvalPhrase;
    if (typeof approvalId !== 'string' || !approvalId.startsWith('zdc-')) {
      return {
        httpStatus: 400,
        body: jsonRpcError(id, -32602, 'approvalId must be a Zavorth Docker control approval id.'),
      };
    }
    if (typeof approvalPhrase !== 'string' || approvalPhrase.length > 200) {
      return {
        httpStatus: 400,
        body: jsonRpcError(id, -32602, 'approvalPhrase must be the exact phrase from preview.'),
      };
    }

    const pending = this.pendingDockerControlApprovals.get(approvalId);
    if (!pending) {
      return {
        httpStatus: 403,
        body: jsonRpcError(id, -32040, 'Docker control approval was not found or was already used.'),
      };
    }
    if (pending.expiresAt < this.now().getTime()) {
      this.pendingDockerControlApprovals.delete(approvalId);
      return {
        httpStatus: 403,
        body: jsonRpcError(id, -32041, 'Docker control approval expired.'),
      };
    }
    if (approvalPhrase !== pending.approvalPhrase) {
      return {
        httpStatus: 403,
        body: jsonRpcError(id, -32042, 'Docker control approval phrase did not match.'),
      };
    }
    if (!this.dockerProvider.controlContainer) {
      return {
        httpStatus: 403,
        body: jsonRpcError(id, -32043, 'Docker control provider is not available.'),
      };
    }

    this.pendingDockerControlApprovals.delete(approvalId);
    const result = await this.dockerProvider.controlContainer({
      container: pending.container,
      action: pending.action,
    });
    const payload: RemoteMeshNotebookDockerControlReceiptPayload = {
      schemaVersion: 1,
      generatedAt: this.now().toISOString(),
      toolName: 'notebook.docker.apply_control',
      receiptId: `zdr-${randomUUID()}`,
      approvalId,
      container: pending.container,
      action: pending.action,
      status: 'executed',
      templateLabel: 'docker-container-lifecycle',
      processSpawned: result.processSpawned,
      dockerMutationPerformed: result.dockerMutationPerformed,
      filesystemMutationPerformed: false,
      rawCommandSerialized: false,
    };

    return {
      httpStatus: 200,
      body: toolResult(id, payload),
    };
  }

  private async handleProjectFilePreviewRead(
    id: RemoteMeshJson,
    args: Record<string, RemoteMeshJson>,
  ): Promise<{ httpStatus: number; body: Record<string, RemoteMeshJson> }> {
    const extraKeys = Object.keys(args).filter((key) => key !== 'project' && key !== 'relativePath');
    if (extraKeys.length > 0) {
      return {
        httpStatus: 400,
        body: jsonRpcError(id, -32602, `Unsupported notebook.project_files.preview_read argument: ${extraKeys[0]}.`),
      };
    }

    const resolved = this.resolveProjectFileTarget(id, args);
    if (!resolved.ok) {
      return resolved.error;
    }

    const fileInfo = await this.projectFileProvider.statFile({ resolvedPath: resolved.resolvedPath });
    if (!fileInfo.isFile) {
      return {
        httpStatus: 400,
        body: jsonRpcError(id, -32602, 'Project file read target must be a regular file.'),
      };
    }
    if (fileInfo.sizeBytes > this.config.projectFileReadMaxBytes) {
      return {
        httpStatus: 403,
        body: jsonRpcError(id, -32060, `Project file exceeds the configured read limit of ${this.config.projectFileReadMaxBytes} bytes.`),
      };
    }

    const nowMs = this.now().getTime();
    const approvalId = `zfr-${randomUUID()}`;
    const approvalPhrase = projectFileApprovalPhraseFor(resolved.project, resolved.relativePath);
    const expiresAt = nowMs + this.config.projectFileReadApprovalTtlMs;
    this.pendingProjectFileReadApprovals.set(approvalId, {
      approvalId,
      approvalPhrase,
      project: resolved.project,
      relativePath: resolved.relativePath,
      resolvedPath: resolved.resolvedPath,
      sizeBytes: fileInfo.sizeBytes,
      createdAt: nowMs,
      expiresAt,
    });

    const payload: RemoteMeshNotebookProjectFileReadPreviewPayload = {
      schemaVersion: 1,
      generatedAt: this.now().toISOString(),
      toolName: 'notebook.project_files.preview_read',
      approvalId,
      approvalPhrase,
      expiresAt: new Date(expiresAt).toISOString(),
      project: resolved.project,
      relativePath: resolved.relativePath,
      sizeBytes: fileInfo.sizeBytes,
      maxBytes: this.config.projectFileReadMaxBytes,
      contentRisk: isSensitiveFileName(resolved.relativePath) ? 'sensitive-name' : 'normal',
      readOnly: true,
      requiresApproval: true,
      resolvedPathLabel: 'allowlisted-project-root',
      processSpawned: false,
      filesystemMutationPerformed: false,
      rawPathSerialized: false,
      rawCommandSerialized: false,
    };

    return {
      httpStatus: 200,
      body: toolResult(id, payload),
    };
  }

  private async handleProjectFileApplyRead(
    id: RemoteMeshJson,
    args: Record<string, RemoteMeshJson>,
  ): Promise<{ httpStatus: number; body: Record<string, RemoteMeshJson> }> {
    const extraKeys = Object.keys(args).filter((key) => key !== 'approvalId' && key !== 'approvalPhrase');
    if (extraKeys.length > 0) {
      return {
        httpStatus: 400,
        body: jsonRpcError(id, -32602, `Unsupported notebook.project_files.apply_read argument: ${extraKeys[0]}.`),
      };
    }

    const approvalId = args.approvalId;
    const approvalPhrase = args.approvalPhrase;
    if (typeof approvalId !== 'string' || !approvalId.startsWith('zfr-')) {
      return {
        httpStatus: 400,
        body: jsonRpcError(id, -32602, 'approvalId must be a Zavorth project file read approval id.'),
      };
    }
    if (typeof approvalPhrase !== 'string' || approvalPhrase.length > 300) {
      return {
        httpStatus: 400,
        body: jsonRpcError(id, -32602, 'approvalPhrase must be the exact phrase from preview.'),
      };
    }

    const pending = this.pendingProjectFileReadApprovals.get(approvalId);
    if (!pending) {
      return {
        httpStatus: 403,
        body: jsonRpcError(id, -32061, 'Project file read approval was not found or was already used.'),
      };
    }
    if (pending.expiresAt < this.now().getTime()) {
      this.pendingProjectFileReadApprovals.delete(approvalId);
      return {
        httpStatus: 403,
        body: jsonRpcError(id, -32062, 'Project file read approval expired.'),
      };
    }
    if (approvalPhrase !== pending.approvalPhrase) {
      return {
        httpStatus: 403,
        body: jsonRpcError(id, -32063, 'Project file read approval phrase did not match.'),
      };
    }

    this.pendingProjectFileReadApprovals.delete(approvalId);
    const file = await this.projectFileProvider.readFileUtf8({
      resolvedPath: pending.resolvedPath,
      maxBytes: this.config.projectFileReadMaxBytes,
    });
    const payload: RemoteMeshNotebookProjectFileReadReceiptPayload = {
      schemaVersion: 1,
      generatedAt: this.now().toISOString(),
      toolName: 'notebook.project_files.apply_read',
      receiptId: `zfrc-${randomUUID()}`,
      approvalId,
      project: pending.project,
      relativePath: pending.relativePath,
      encoding: 'utf8',
      content: file.content,
      sizeBytes: file.sizeBytes,
      truncated: file.truncated,
      lineCount: countLines(file.content),
      readOnly: true,
      processSpawned: false,
      filesystemMutationPerformed: false,
      rawPathSerialized: false,
      rawCommandSerialized: false,
    };

    return {
      httpStatus: 200,
      body: toolResult(id, payload),
    };
  }

  private resolveProjectFileTarget(
    id: RemoteMeshJson,
    args: Record<string, RemoteMeshJson>,
  ): { ok: true; project: string; relativePath: string; resolvedPath: string } | {
    ok: false;
    error: { httpStatus: number; body: Record<string, RemoteMeshJson> };
  } {
    const project = args.project;
    const relativePathValue = args.relativePath;
    if (typeof project !== 'string' || !isSafeProjectName(project)) {
      return {
        ok: false,
        error: {
          httpStatus: 400,
          body: jsonRpcError(id, -32602, 'project must be an allowlisted project name.'),
        },
      };
    }
    if (typeof relativePathValue !== 'string' || !isSafeRelativeProjectPath(relativePathValue)) {
      return {
        ok: false,
        error: {
          httpStatus: 400,
          body: jsonRpcError(id, -32602, 'relativePath must be a safe relative file path.'),
        },
      };
    }

    const root = this.config.allowedProjectFileRoots.find((entry) => entry.name === project);
    if (!root) {
      return {
        ok: false,
        error: {
          httpStatus: 403,
          body: jsonRpcError(id, -32064, `Project ${project} is not allowlisted for file reads.`),
        },
      };
    }

    const normalizedRelativePath = normalizeRelativeProjectPath(relativePathValue);
    const resolvedPath = resolve(root.rootPath, normalizedRelativePath);
    if (!isPathInsideRoot(root.rootPath, resolvedPath)) {
      return {
        ok: false,
        error: {
          httpStatus: 403,
          body: jsonRpcError(id, -32065, 'Project file read path escapes the allowlisted project root.'),
        },
      };
    }

    return {
      ok: true,
      project,
      relativePath: normalizedRelativePath,
      resolvedPath,
    };
  }

  private parseDockerControlTarget(
    id: RemoteMeshJson,
    args: Record<string, RemoteMeshJson>,
    context: 'preview',
  ): { ok: true; container: string; action: RemoteMeshNotebookDockerControlAction } | {
    ok: false;
    error: { httpStatus: number; body: Record<string, RemoteMeshJson> };
  } {
    const container = args.container;
    const action = args.action;
    if (typeof container !== 'string' || !isSafeDockerIdentifier(container)) {
      return {
        ok: false,
        error: {
          httpStatus: 400,
          body: jsonRpcError(id, -32602, `container must be a safe Docker container name for ${context}.`),
        },
      };
    }
    if (!this.config.allowedDockerContainers.includes(container)) {
      return {
        ok: false,
        error: {
          httpStatus: 403,
          body: jsonRpcError(id, -32044, `Container ${container} is not allowlisted for Docker control.`),
        },
      };
    }
    if (!isDockerControlAction(action) || !this.config.allowedDockerControlActions.includes(action)) {
      return {
        ok: false,
        error: {
          httpStatus: 403,
          body: jsonRpcError(id, -32045, `Docker action ${String(action)} is not allowlisted for control.`),
        },
      };
    }
    return {
      ok: true,
      container,
      action,
    };
  }

  private isAuthorized(request: IncomingMessage): boolean {
    if (!this.config.authToken) {
      return false;
    }
    if (this.config.authHeaderName === 'Authorization') {
      const header = request.headers.authorization || '';
      return header === `Bearer ${this.config.authToken}`;
    }
    const header = request.headers['x-zavorth-remote-token'];
    return header === this.config.authToken;
  }

  private defaultNotebookStatus(): RemoteMeshNotebookStatusPayload {
    return {
      schemaVersion: 1,
      generatedAt: this.now().toISOString(),
      nodeRole: 'primary-notebook-executor',
      toolName: 'notebook.get_status',
      hostname: hostname(),
      platform: platform(),
      arch: arch(),
      uptimeSeconds: Math.floor(uptime()),
      freeMemoryMb: Math.round(freemem() / 1024 / 1024),
      totalMemoryMb: Math.round(totalmem() / 1024 / 1024),
      cpuCount: cpus().length,
      loadAverage: loadavg(),
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        zavorthVersion: process.env.npm_package_version || null,
      },
      capabilities: this.exposedTools(),
      safety: {
        shellAvailable: false,
        filesystemMutationAvailable: false,
        sudoAvailable: false,
        rawCommandAccepted: false,
        dockerMutationAvailable: this.config.enableDockerControl,
        dockerRawCommandAccepted: false,
        projectFileReadAvailable: this.config.enableProjectFileRead,
        projectFileWriteAvailable: false,
      },
    };
  }

  private async runSelfTest(readyToServe: boolean): Promise<RemoteMeshNotebookScopedMcpSelfTest> {
    if (!readyToServe) {
      return {
        ...emptySelfTest(true),
        errors: ['Server is not ready to serve; self-test skipped.'],
      };
    }

    let server: Server | null = null;
    let serverClosed = false;
    try {
      const selfTestService = new RemoteMeshNotebookScopedMcpServerService({
        ...this.config,
        host: '127.0.0.1',
        port: 0,
      }, {
        now: this.now,
        statusProvider: this.statusProvider,
      });
      const started = await selfTestService.start();
      server = started.server;
      const authHeaderValue = this.config.authHeaderName === 'Authorization'
        ? `Bearer ${this.config.authToken ?? ''}`
        : this.config.authToken ?? '';
      const response = await safeFetch(started.url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          [this.config.authHeaderName]: authHeaderValue,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'r7.5-self-test',
          method: 'tools/call',
          params: {
            name: 'notebook.get_status',
            arguments: {},
          },
        }),
      }, { serviceName: 'Remote mesh notebook self-test', allowLoopback: true });
      const json = await response.json() as Record<string, RemoteMeshJson>;
      await closeServer(server);
      serverClosed = true;
      return {
        requested: true,
        performed: true,
        passed: response.ok && getNestedToolName(json) === 'notebook.get_status',
        endpointLabel: started.url,
        httpStatus: response.status,
        toolName: getNestedToolName(json),
        responsePreview: redactServerResponse(json),
        errors: response.ok ? [] : [`HTTP ${response.status}`],
        serverClosed,
        liveNetworkCallPerformed: true,
        remoteProcessSpawned: false,
        filesystemMutationPerformed: false,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      };
    } catch (error) {
      if (server) {
        await closeServer(server).catch(() => undefined);
        serverClosed = true;
      }
      return {
        ...emptySelfTest(true),
        performed: true,
        endpointLabel: null,
        errors: [error instanceof Error ? error.message : 'unknown self-test failure'],
        serverClosed,
        liveNetworkCallPerformed: true,
      };
    }
  }

  private async runDockerSelfTest(readyToServe: boolean): Promise<RemoteMeshNotebookDockerObservabilitySelfTest> {
    if (!this.config.enableDockerObservability) {
      return {
        ...emptyDockerSelfTest(true),
        errors: ['Docker observability is not enabled; docker self-test skipped.'],
      };
    }
    if (!readyToServe) {
      return {
        ...emptyDockerSelfTest(true),
        errors: ['Server is not ready to serve; docker self-test skipped.'],
      };
    }

    let server: Server | null = null;
    let serverClosed = false;
    let remoteProcessSpawned = false;
    try {
      const selfTestService = new RemoteMeshNotebookScopedMcpServerService({
        ...this.config,
        host: '127.0.0.1',
        port: 0,
      }, {
        now: this.now,
        statusProvider: this.statusProvider,
        dockerProvider: this.dockerProvider,
      });
      const started = await selfTestService.start();
      server = started.server;

      const listResponse = await this.callSelfTestTool(started.url, 'notebook.docker.list_containers', {});
      const firstContainer = this.config.allowedDockerContainers[0];
      const logsResponse = await this.callSelfTestTool(started.url, 'notebook.docker.get_logs', {
        container: firstContainer,
        lines: Math.min(5, this.config.maxDockerLogLines),
      });
      const listJson = await listResponse.json() as Record<string, RemoteMeshJson>;
      const logsJson = await logsResponse.json() as Record<string, RemoteMeshJson>;
      const listStructured = structuredContentOf(listJson);
      const logsStructured = structuredContentOf(logsJson);
      remoteProcessSpawned = readProcessSpawned(listStructured) || readProcessSpawned(logsStructured);

      await closeServer(server);
      serverClosed = true;

      const listPassed = listResponse.ok && getNestedToolName(listJson) === 'notebook.docker.list_containers';
      const logsPassed = logsResponse.ok && getNestedToolName(logsJson) === 'notebook.docker.get_logs';
      return {
        requested: true,
        performed: true,
        passed: listPassed && logsPassed,
        endpointLabel: started.url,
        httpStatus: logsResponse.status,
        tools: {
          listContainers: listPassed,
          getLogs: logsPassed,
        },
        responsePreview: redactServerResponse({
          list: listJson,
          logs: logsJson,
        }),
        errors: listPassed && logsPassed ? [] : [`list=${listResponse.status} logs=${logsResponse.status}`],
        serverClosed,
        liveNetworkCallPerformed: true,
        remoteProcessSpawned,
        filesystemMutationPerformed: false,
        dockerMutationPerformed: false,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      };
    } catch (error) {
      if (server) {
        await closeServer(server).catch(() => undefined);
        serverClosed = true;
      }
      return {
        ...emptyDockerSelfTest(true),
        performed: true,
        endpointLabel: null,
        errors: [error instanceof Error ? error.message : 'unknown docker self-test failure'],
        serverClosed,
        liveNetworkCallPerformed: true,
        remoteProcessSpawned,
      };
    }
  }

  private async runDockerControlSelfTest(readyToServe: boolean): Promise<RemoteMeshNotebookDockerControlSelfTest> {
    if (!this.config.enableDockerControl) {
      return {
        ...emptyDockerControlSelfTest(true),
        errors: ['Docker control is not enabled; control self-test skipped.'],
      };
    }
    if (!readyToServe) {
      return {
        ...emptyDockerControlSelfTest(true),
        errors: ['Server is not ready to serve; docker control self-test skipped.'],
      };
    }

    let server: Server | null = null;
    let serverClosed = false;
    let remoteProcessSpawned = false;
    let dockerMutationPerformed = false;
    try {
      const selfTestService = new RemoteMeshNotebookScopedMcpServerService({
        ...this.config,
        host: '127.0.0.1',
        port: 0,
      }, {
        now: this.now,
        statusProvider: this.statusProvider,
        dockerProvider: this.dockerProvider,
      });
      const started = await selfTestService.start();
      server = started.server;

      const container = this.config.allowedDockerContainers[0];
      const action = this.config.allowedDockerControlActions[0];
      const previewResponse = await selfTestService.callSelfTestTool(started.url, 'notebook.docker.preview_control', {
        container,
        action,
      });
      const previewJson = await previewResponse.json() as Record<string, RemoteMeshJson>;
      const previewStructured = structuredContentOf(previewJson);
      const approvalId = typeof previewStructured?.approvalId === 'string' ? previewStructured.approvalId : null;
      const approvalPhrase = typeof previewStructured?.approvalPhrase === 'string' ? previewStructured.approvalPhrase : null;

      const applyResponse = approvalId && approvalPhrase
        ? await selfTestService.callSelfTestTool(started.url, 'notebook.docker.apply_control', {
          approvalId,
          approvalPhrase,
        })
        : null;
      const applyJson = applyResponse
        ? await applyResponse.json() as Record<string, RemoteMeshJson>
        : null;
      const receiptStructured = applyJson ? structuredContentOf(applyJson) : null;
      remoteProcessSpawned = readProcessSpawned(receiptStructured);
      dockerMutationPerformed = receiptStructured?.dockerMutationPerformed === true;

      await closeServer(server);
      serverClosed = true;

      const previewPassed = previewResponse.ok && getNestedToolName(previewJson) === 'notebook.docker.preview_control';
      const applyPassed = Boolean(applyResponse?.ok && applyJson && getNestedToolName(applyJson) === 'notebook.docker.apply_control');
      return {
        requested: true,
        performed: true,
        passed: previewPassed && applyPassed && dockerMutationPerformed,
        endpointLabel: started.url,
        httpStatus: applyResponse?.status ?? previewResponse.status,
        tools: {
          previewControl: previewPassed,
          applyControl: applyPassed,
        },
        responsePreview: redactServerResponse(previewJson),
        receiptPreview: redactServerResponse(applyJson || {}),
        errors: previewPassed && applyPassed ? [] : [`preview=${previewResponse.status} apply=${applyResponse?.status ?? 'skipped'}`],
        serverClosed,
        liveNetworkCallPerformed: true,
        remoteProcessSpawned,
        filesystemMutationPerformed: false,
        dockerMutationPerformed,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      };
    } catch (error) {
      if (server) {
        await closeServer(server).catch(() => undefined);
        serverClosed = true;
      }
      return {
        ...emptyDockerControlSelfTest(true),
        performed: true,
        endpointLabel: null,
        errors: [error instanceof Error ? error.message : 'unknown docker control self-test failure'],
        serverClosed,
        liveNetworkCallPerformed: true,
        remoteProcessSpawned,
        dockerMutationPerformed,
      };
    }
  }

  private async runProjectFileReadSelfTest(readyToServe: boolean): Promise<RemoteMeshNotebookProjectFileReadSelfTest> {
    if (!this.config.enableProjectFileRead) {
      return {
        ...emptyProjectFileReadSelfTest(true),
        errors: ['Project file reads are not enabled; file read self-test skipped.'],
      };
    }
    if (!readyToServe) {
      return {
        ...emptyProjectFileReadSelfTest(true),
        errors: ['Server is not ready to serve; project file read self-test skipped.'],
      };
    }

    let server: Server | null = null;
    let serverClosed = false;
    try {
      const selfTestService = new RemoteMeshNotebookScopedMcpServerService({
        ...this.config,
        host: '127.0.0.1',
        port: 0,
      }, {
        now: this.now,
        statusProvider: this.statusProvider,
        dockerProvider: this.dockerProvider,
        projectFileProvider: this.projectFileProvider,
      });
      const started = await selfTestService.start();
      server = started.server;

      const project = this.config.allowedProjectFileRoots[0]?.name;
      const previewResponse = await selfTestService.callSelfTestTool(started.url, 'notebook.project_files.preview_read', {
        project: project || '',
        relativePath: 'README.md',
      });
      const previewJson = await previewResponse.json() as Record<string, RemoteMeshJson>;
      const previewStructured = structuredContentOf(previewJson);
      const approvalId = typeof previewStructured?.approvalId === 'string' ? previewStructured.approvalId : null;
      const approvalPhrase = typeof previewStructured?.approvalPhrase === 'string' ? previewStructured.approvalPhrase : null;
      const applyResponse = approvalId && approvalPhrase
        ? await selfTestService.callSelfTestTool(started.url, 'notebook.project_files.apply_read', {
          approvalId,
          approvalPhrase,
        })
        : null;
      const applyJson = applyResponse
        ? await applyResponse.json() as Record<string, RemoteMeshJson>
        : null;

      await closeServer(server);
      serverClosed = true;

      const previewPassed = previewResponse.ok && getNestedToolName(previewJson) === 'notebook.project_files.preview_read';
      const applyPassed = Boolean(applyResponse?.ok && applyJson && getNestedToolName(applyJson) === 'notebook.project_files.apply_read');
      return {
        requested: true,
        performed: true,
        passed: previewPassed && applyPassed,
        endpointLabel: started.url,
        httpStatus: applyResponse?.status ?? previewResponse.status,
        tools: {
          previewRead: previewPassed,
          applyRead: applyPassed,
        },
        responsePreview: redactServerResponse(previewJson),
        receiptPreview: redactServerResponse(applyJson || {}),
        errors: previewPassed && applyPassed ? [] : [`preview=${previewResponse.status} apply=${applyResponse?.status ?? 'skipped'}`],
        serverClosed,
        liveNetworkCallPerformed: true,
        remoteProcessSpawned: false,
        filesystemMutationPerformed: false,
        rawPathSerialized: false,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      };
    } catch (error) {
      if (server) {
        await closeServer(server).catch(() => undefined);
        serverClosed = true;
      }
      return {
        ...emptyProjectFileReadSelfTest(true),
        performed: true,
        endpointLabel: null,
        errors: [error instanceof Error ? error.message : 'unknown project file read self-test failure'],
        serverClosed,
        liveNetworkCallPerformed: true,
      };
    }
  }

  private async callSelfTestTool(
    url: string,
    name: RemoteMeshNotebookScopedMcpToolName,
    args: Record<string, RemoteMeshJson>,
  ): Promise<Response> {
    const authHeaderValue = this.config.authHeaderName === 'Authorization'
      ? `Bearer ${this.config.authToken ?? ''}`
      : this.config.authToken ?? '';
    return safeFetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        [this.config.authHeaderName]: authHeaderValue,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `self-test-${name}`,
        method: 'tools/call',
        params: {
          name,
          arguments: args,
        },
      }),
    }, { serviceName: 'Remote mesh notebook self-test tool call', allowLoopback: true, allowPrivateEnvVar: 'ALLOW_PRIVATE_REMOTE_MESH_TARGETS' });
  }

  private async runR7ClientSmoke() {
    const selfTestService = new RemoteMeshNotebookScopedMcpServerService({
      ...this.config,
      host: '127.0.0.1',
      port: 0,
    }, {
      now: this.now,
      statusProvider: this.statusProvider,
    });
    const started = await selfTestService.start();
    try {
      return await new RemoteMeshSandboxScopedMcpStatusTransportService({
        endpointUrl: started.url,
        authToken: this.config.authToken,
        tokenSource: 'test',
        authHeaderName: this.config.authHeaderName,
        allowInsecureHttpForTailnet: true,
      }).buildSnapshot({
        executeLiveProbe: true,
        target: '127.0.0.1',
        readinessSnapshot: this.selfTestReadiness('127.0.0.1'),
        ownerTrust: true,
        acknowledgedRisk: true,
        armLiveProbe: true,
      });
    } finally {
      await closeServer(started.server).catch(() => undefined);
    }
  }

  private selfTestReadiness(target: string): RemoteMeshSandboxReadinessSnapshot {
    return buildNotebookScopedMcpSelfTestReadiness({
      target,
      port: this.config.port,
      now: this.now,
    });
  }
}
