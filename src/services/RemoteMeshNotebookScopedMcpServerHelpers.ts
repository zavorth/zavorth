import { logger } from '../logger.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { networkInterfaces } from 'node:os';

import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { RemoteMeshJson } from '../contracts/RemoteMeshSandboxContract.js';
import type {
  RemoteMeshNotebookDockerControlAction,
  RemoteMeshNotebookDockerContainerSummary,
  RemoteMeshNotebookDockerControlSelfTest,
  RemoteMeshNotebookDockerObservabilitySelfTest,
  RemoteMeshNotebookProjectFileReadSelfTest,
  RemoteMeshNotebookProjectFileRootConfig,
  RemoteMeshNotebookScopedMcpSelfTest,
  RemoteMeshNotebookScopedMcpServerConfig,
  RemoteMeshNotebookScopedMcpServerConfigSnapshot,
  RemoteMeshNotebookScopedMcpServerGuard,
  RemoteMeshNotebookScopedMcpServerGuardId,
  RemoteMeshNotebookScopedMcpServerGuardStatus,
  RemoteMeshNotebookScopedMcpServerStatus,
  RemoteMeshNotebookScopedMcpToolName,
} from '../contracts/RemoteMeshNotebookScopedMcpServerContract.js';

import type {
  JsonRpcRequest,
  RemoteMeshNotebookDockerObservabilityProvider,
  RemoteMeshNotebookProjectFileReadProvider,
} from '../mesh/RemoteMeshNotebookScopedMcpServerService.js';

const execFileAsync = promisify(execFile);

export function normalizeConfig(config: RemoteMeshNotebookScopedMcpServerConfig): Required<RemoteMeshNotebookScopedMcpServerConfig> {
  const enableDockerControl = config.enableDockerControl === true;
  return {
    host: config.host || '127.0.0.1',
    port: Number.isFinite(config.port) ? config.port : 8787,
    authToken: config.authToken || null,
    tokenSource: config.tokenSource || (config.authToken ? 'test' : 'none'),
    authHeaderName: config.authHeaderName || 'Authorization',
    allowPrivateBind: config.allowPrivateBind === true,
    enableDockerObservability: config.enableDockerObservability === true || enableDockerControl,
    allowedDockerContainers: sanitizeDockerAllowlist(config.allowedDockerContainers || []),
    maxDockerLogLines: normalizeMaxDockerLogLines(config.maxDockerLogLines),
    dockerCliPath: config.dockerCliPath || 'docker',
    enableDockerControl,
    allowedDockerControlActions: sanitizeDockerControlActions(config.allowedDockerControlActions || []),
    dockerControlApprovalTtlMs: normalizeDockerControlApprovalTtlMs(config.dockerControlApprovalTtlMs),
    enableProjectFileRead: config.enableProjectFileRead === true,
    allowedProjectFileRoots: sanitizeProjectFileRoots(config.allowedProjectFileRoots || []),
    projectFileReadMaxBytes: normalizeProjectFileReadMaxBytes(config.projectFileReadMaxBytes),
    projectFileReadApprovalTtlMs: normalizeProjectFileReadApprovalTtlMs(config.projectFileReadApprovalTtlMs),
  };
}

export function guard(
  id: RemoteMeshNotebookScopedMcpServerGuardId,
  status: RemoteMeshNotebookScopedMcpServerGuardStatus,
  evidence: string,
  remediation: string | null,
): RemoteMeshNotebookScopedMcpServerGuard {
  return {
    id,
    status,
    evidence,
    remediation: status === 'passed' ? null : remediation,
  };
}

export function jsonRpcError(id: RemoteMeshJson, code: number, message: string): Record<string, RemoteMeshJson> {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
    },
  };
}

export function toolResult(id: RemoteMeshJson, structuredContent: unknown): Record<string, RemoteMeshJson> {
  const jsonContent = structuredContent as RemoteMeshJson;
  return {
    jsonrpc: '2.0',
    id,
    result: {
      content: [
        {
          type: 'text',
          text: JSON.stringify(jsonContent),
        },
      ],
      structuredContent: jsonContent,
      isError: false,
    },
  };
}

export function toolErrorResult(id: RemoteMeshJson, structuredContent: unknown): Record<string, RemoteMeshJson> {
  const jsonContent = structuredContent as RemoteMeshJson;
  return {
    jsonrpc: '2.0',
    id,
    result: {
      content: [
        {
          type: 'text',
          text: JSON.stringify(jsonContent),
        },
      ],
      structuredContent: jsonContent,
      isError: true,
    },
  };
}

export function writeJson(response: ServerResponse, statusCode: number, body: Record<string, RemoteMeshJson>): void {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

export function readBody(request: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Request body too large.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

export function parseJsonRpc(rawBody: string): { ok: true; request: JsonRpcRequest } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(rawBody) as JsonRpcRequest;
    return { ok: true, request: parsed };
  } catch (error: unknown) {logger.warn('[Remote Mesh Notebook Scoped Mcp Server Helpers] JSON parse failed', error);
    return { ok: false, error: 'Invalid JSON body.' };
  }
}

export function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export function emptySelfTest(requested: boolean): RemoteMeshNotebookScopedMcpSelfTest {
  return {
    requested,
    performed: false,
    passed: false,
    endpointLabel: null,
    httpStatus: null,
    toolName: null,
    responsePreview: null,
    errors: [],
    serverClosed: true,
    liveNetworkCallPerformed: false,
    remoteProcessSpawned: false,
    filesystemMutationPerformed: false,
    rawCommandSerialized: false,
    secretValuesSerialized: false,
  };
}

export function emptyDockerSelfTest(requested: boolean): RemoteMeshNotebookDockerObservabilitySelfTest {
  return {
    requested,
    performed: false,
    passed: false,
    endpointLabel: null,
    httpStatus: null,
    tools: {
      listContainers: false,
      getLogs: false,
    },
    responsePreview: null,
    errors: [],
    serverClosed: true,
    liveNetworkCallPerformed: false,
    remoteProcessSpawned: false,
    filesystemMutationPerformed: false,
    dockerMutationPerformed: false,
    rawCommandSerialized: false,
    secretValuesSerialized: false,
  };
}

export function emptyDockerControlSelfTest(requested: boolean): RemoteMeshNotebookDockerControlSelfTest {
  return {
    requested,
    performed: false,
    passed: false,
    endpointLabel: null,
    httpStatus: null,
    tools: {
      previewControl: false,
      applyControl: false,
    },
    responsePreview: null,
    receiptPreview: null,
    errors: [],
    serverClosed: true,
    liveNetworkCallPerformed: false,
    remoteProcessSpawned: false,
    filesystemMutationPerformed: false,
    dockerMutationPerformed: false,
    rawCommandSerialized: false,
    secretValuesSerialized: false,
  };
}

export function emptyProjectFileReadSelfTest(requested: boolean): RemoteMeshNotebookProjectFileReadSelfTest {
  return {
    requested,
    performed: false,
    passed: false,
    endpointLabel: null,
    httpStatus: null,
    tools: {
      previewRead: false,
      applyRead: false,
    },
    responsePreview: null,
    receiptPreview: null,
    errors: [],
    serverClosed: true,
    liveNetworkCallPerformed: false,
    remoteProcessSpawned: false,
    filesystemMutationPerformed: false,
    rawPathSerialized: false,
    rawCommandSerialized: false,
    secretValuesSerialized: false,
  };
}

export function getNestedToolName(json: Record<string, RemoteMeshJson>): RemoteMeshNotebookScopedMcpToolName | null {
  const structuredContent = structuredContentOf(json);
  if (!structuredContent) {
    return null;
  }
  const toolName = structuredContent.toolName;
  if (
    toolName === 'notebook.get_status'
    || toolName === 'notebook.docker.list_containers'
    || toolName === 'notebook.docker.get_logs'
    || toolName === 'notebook.docker.preview_control'
    || toolName === 'notebook.docker.apply_control'
    || toolName === 'notebook.project_files.preview_read'
    || toolName === 'notebook.project_files.apply_read'
  ) {
    return toolName;
  }
  return null;
}

export function structuredContentOf(json: Record<string, RemoteMeshJson>): { [key: string]: RemoteMeshJson } | null {
  const result = json.result;
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return null;
  }
  const structuredContent = result.structuredContent;
  if (!structuredContent || typeof structuredContent !== 'object' || Array.isArray(structuredContent)) {
    return null;
  }
  return structuredContent;
}

export function readProcessSpawned(value: { [key: string]: RemoteMeshJson } | null): boolean {
  return value?.processSpawned === true;
}

export function normalizeMaxDockerLogLines(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 120;
  }
  return Math.max(1, Math.min(500, Math.floor(value || 120)));
}

export function normalizeLogLines(value: RemoteMeshJson | undefined, maxLines: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return Math.min(120, maxLines);
  }
  return Math.max(1, Math.min(maxLines, Math.floor(value)));
}

export function sanitizeDockerAllowlist(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(isSafeDockerIdentifier)));
}

export function sanitizeDockerControlActions(values: RemoteMeshNotebookDockerControlAction[]): RemoteMeshNotebookDockerControlAction[] {
  return Array.from(new Set(values.filter(isDockerControlAction)));
}

export function isDockerControlAction(value: unknown): value is RemoteMeshNotebookDockerControlAction {
  return value === 'start' || value === 'stop' || value === 'restart';
}

export function normalizeDockerControlApprovalTtlMs(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 120_000;
  }
  return Math.max(30_000, Math.min(600_000, Math.floor(value || 120_000)));
}

export function normalizeProjectFileReadMaxBytes(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 64 * 1024;
  }
  return Math.max(1, Math.min(262_144, Math.floor(value || 64 * 1024)));
}

export function normalizeProjectFileReadApprovalTtlMs(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 120_000;
  }
  return Math.max(30_000, Math.min(600_000, Math.floor(value || 120_000)));
}

export function sanitizeProjectFileRoots(values: RemoteMeshNotebookProjectFileRootConfig[]): RemoteMeshNotebookProjectFileRootConfig[] {
  const roots = new Map<string, RemoteMeshNotebookProjectFileRootConfig>();
  for (const value of values) {
    const name = value.name.trim();
    const rootPath = resolve(value.rootPath);
    if (isSafeProjectName(name) && rootPath) {
      roots.set(name, { name, rootPath });
    }
  }
  return Array.from(roots.values());
}

export function isSafeProjectName(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(value);
}

export function isSafeRelativeProjectPath(value: string): boolean {
  if (!value || value.length > 512 || isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value)) {
    return false;
  }
  const normalized = normalizeRelativeProjectPath(value);
  if (!normalized || normalized.startsWith('../') || normalized === '..' || normalized.includes('\0')) {
    return false;
  }
  return !normalized.split('/').some((part) => part === '..' || part === '');
}

export function normalizeRelativeProjectPath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

export function isPathInsideRoot(rootPath: string, resolvedPath: string): boolean {
  const rel = relative(resolve(rootPath), resolve(resolvedPath));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export function isSensitiveFileName(relativePathValue: string): boolean {
  return /(^|\/)(\.env|id_rsa|id_ed25519|.*secret.*|.*token.*|.*credential.*|.*key.*)$/i.test(relativePathValue);
}

export function projectFileApprovalPhraseFor(project: string, relativePathValue: string): string {
  return `APPROVE FILE READ ${project}/${relativePathValue}`;
}

export function approvalPhraseFor(action: RemoteMeshNotebookDockerControlAction, container: string): string {
  return `APPROVE DOCKER ${action.toUpperCase()} ${container}`;
}

export function dockerControlExpectedEffect(action: RemoteMeshNotebookDockerControlAction, container: string): string {
  if (action === 'start') {
    return `Start allowlisted Docker container ${container}.`;
  }
  if (action === 'stop') {
    return `Stop allowlisted Docker container ${container}.`;
  }
  return `Restart allowlisted Docker container ${container}.`;
}

export function isSafeDockerIdentifier(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(value);
}

export function countLines(value: string): number {
  if (!value) {
    return 0;
  }
  return value.split(/\r...\n/).filter((line) => line.length > 0).length;
}

export function redactServerResponse(value: RemoteMeshJson): RemoteMeshJson {
  if (Array.isArray(value)) {
    return value.map((entry) => redactServerResponse(entry));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      key,
      /token|secret|key|credential|authorization/i.test(key) ? '<redacted>' : redactServerResponse(entry),
    ]));
  }
  return value;
}

export function isLocalInterface(hostValue: string): boolean {
  const interfaces = networkInterfaces();
  return Object.values(interfaces)
    .flatMap((entries) => entries ?? [])
    .some((entry) => entry.address === hostValue);
}

export class FsProjectFileReadProvider implements RemoteMeshNotebookProjectFileReadProvider {
  public async statFile(input: { resolvedPath: string }): Promise<{ sizeBytes: number; isFile: boolean }> {
    const fileStat = await stat(input.resolvedPath);
    return {
      sizeBytes: fileStat.size,
      isFile: fileStat.isFile(),
    };
  }

  public async readFileUtf8(input: { resolvedPath: string; maxBytes: number }): Promise<{
    content: string;
    sizeBytes: number;
    truncated: boolean;
  }> {
    const bytes = await readFile(input.resolvedPath);
    const truncated = bytes.length > input.maxBytes;
    const slice = truncated ? bytes.subarray(0, input.maxBytes) : bytes;
    return {
      content: slice.toString('utf8'),
      sizeBytes: bytes.length,
      truncated,
    };
  }
}

export class DockerCliObservabilityProvider implements RemoteMeshNotebookDockerObservabilityProvider {
  constructor(private readonly dockerCliPath: string) {}

  public async listContainers(): Promise<{
    containers: RemoteMeshNotebookDockerContainerSummary[];
    processSpawned: boolean;
  }> {
    const { stdout } = await execFileAsync(this.dockerCliPath, [
      'ps',
      '--format',
      '{{json .}}',
    ], {
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });
    const containers = String(stdout)
      .split(/\r...\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseDockerContainerLine)
      .filter((container): container is RemoteMeshNotebookDockerContainerSummary => Boolean(container));

    return {
      containers,
      processSpawned: true,
    };
  }

  public async getLogs(input: { container: string; lines: number }): Promise<{
    logs: string;
    processSpawned: boolean;
  }> {
    const { stdout, stderr } = await execFileAsync(this.dockerCliPath, [
      'logs',
      '--tail',
      String(input.lines),
      input.container,
    ], {
      windowsHide: true,
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
    });

    return {
      logs: [String(stdout), String(stderr)].filter(Boolean).join('\n').trim(),
      processSpawned: true,
    };
  }

  public async controlContainer(input: {
    container: string;
    action: RemoteMeshNotebookDockerControlAction;
  }): Promise<{
    processSpawned: boolean;
    dockerMutationPerformed: boolean;
  }> {
    await execFileAsync(this.dockerCliPath, [
      input.action,
      input.container,
    ], {
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });

    return {
      processSpawned: true,
      dockerMutationPerformed: true,
    };
  }
}

export function parseDockerContainerLine(line: string): RemoteMeshNotebookDockerContainerSummary | null {
  try {
    const parsed = JSON.parse(line) as {
      ID?: string;
      Names?: string;
      Image?: string;
      State?: string;
      Status?: string;
      Ports?: string;
    };
    const name = String(parsed.Names || '').split(',')[0]?.trim();
    if (!name || !isSafeDockerIdentifier(name)) {
      return null;
    }
    return {
      id: String(parsed.ID || ''),
      name,
      image: String(parsed.Image || ''),
      state: String(parsed.State || ''),
      status: String(parsed.Status || ''),
      ports: parsed.Ports ? String(parsed.Ports) : null,
    };
  } catch (error: unknown) {logger.warn('[Remote Mesh Notebook Scoped Mcp Server Helpers] parsing failed', error); return null; }
}
