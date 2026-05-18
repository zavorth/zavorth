import type {
  RemoteMeshNotebookMcpApplyToolName,
  RemoteMeshNotebookMcpProxyApplyRequest,
  RemoteMeshNotebookMcpProxyAuthHeaderName,
  RemoteMeshNotebookMcpProxyConfig,
  RemoteMeshNotebookMcpProxyResult,
} from '../contracts/RemoteMeshNotebookMcpProxyContract.js';
import { ZAVORTH_REMOTE_MESH_NOTEBOOK_MCP_PROXY_VERSION } from '../contracts/RemoteMeshNotebookMcpProxyContract.js';
import type {
  RemoteMeshNotebookScopedMcpToolName,
} from '../contracts/RemoteMeshNotebookScopedMcpServerContract.js';
import type { RemoteMeshJson } from '../contracts/RemoteMeshSandboxContract.js';

type RemoteMeshNotebookMcpProxyRuntime = {
  now?: () => Date;
  fetcher?: typeof fetch;
};

type JsonRecord = Record<string, RemoteMeshJson>;

const APPLY_TOOL_ALLOWLIST: RemoteMeshNotebookMcpApplyToolName[] = [
  'notebook.docker.apply_control',
  'notebook.project_files.apply_read',
];

export class RemoteMeshNotebookMcpProxyService {
  private readonly now: () => Date;
  private readonly fetcher: typeof fetch;
  private readonly config: Required<RemoteMeshNotebookMcpProxyConfig>;

  constructor(
    config: RemoteMeshNotebookMcpProxyConfig,
    runtime: RemoteMeshNotebookMcpProxyRuntime = {},
  ) {
    this.config = normalizeConfig(config);
    this.now = runtime.now || (() => new Date());
    this.fetcher = runtime.fetcher || fetch;
  }

  public static fromEnv(
    env: Record<string, string | undefined> = process.env,
    runtime: RemoteMeshNotebookMcpProxyRuntime = {},
  ): RemoteMeshNotebookMcpProxyService {
    return new RemoteMeshNotebookMcpProxyService({
      endpointUrl: env.ZAVORTH_REMOTE_MESH_NOTEBOOK_MCP_URL
        || env.ZAVORTH_REMOTE_MESH_MCP_ENDPOINT
        || null,
      authToken: env.ZAVORTH_REMOTE_MESH_NOTEBOOK_MCP_TOKEN
        || env.ZAVORTH_REMOTE_MESH_MCP_TOKEN
        || null,
      authHeaderName: normalizeAuthHeaderName(env.ZAVORTH_REMOTE_MESH_NOTEBOOK_MCP_HEADER),
      allowInsecureHttpForTailnet: env.ZAVORTH_REMOTE_MESH_ALLOW_INSECURE_HTTP_FOR_TAILNET === '1'
        || env.ZAVORTH_REMOTE_MESH_ALLOW_INSECURE_HTTP === '1',
    }, runtime);
  }

  public async apply(input: RemoteMeshNotebookMcpProxyApplyRequest): Promise<RemoteMeshNotebookMcpProxyResult> {
    const validationError = this.validateApplyRequest(input)
      || this.validateConfig();

    if (validationError) {
      return this.result({
        ok: false,
        status: 'blocked',
        toolName: isApplyToolName(input.toolName) ? input.toolName : null,
        error: validationError,
        liveNetworkCallPerformed: false,
      });
    }

    const url = this.config.endpointUrl as string;
    const toolName = input.toolName;

    try {
      const response = await this.fetcher(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          [this.config.authHeaderName]: this.authHeaderValue(),
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `command-center-remote-mesh-${Date.now()}`,
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: input.arguments,
          },
        }),
      });
      const body = await readJson(response);
      const jsonRpcError = readJsonRpcError(body);
      const receipt = readReceipt(body);

      return this.result({
        ok: response.ok && !jsonRpcError,
        status: response.ok && !jsonRpcError ? 'executed' : 'failed',
        toolName,
        httpStatus: response.status,
        error: jsonRpcError?.message ?? (response.ok ? null : `HTTP ${response.status}`),
        jsonRpcError,
        receipt,
        liveNetworkCallPerformed: true,
      });
    } catch (error) {
      return this.result({
        ok: false,
        status: 'failed',
        toolName,
        error: error instanceof Error ? error.message : 'Unknown remote MCP proxy failure.',
        liveNetworkCallPerformed: true,
      });
    }
  }

  private validateApplyRequest(input: RemoteMeshNotebookMcpProxyApplyRequest): string | null {
    if (!isApplyToolName(input.toolName)) {
      return 'Only approved Remote Mesh apply tools can be called from Command Center.';
    }
    const args = input.arguments;
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      return 'Remote Mesh apply requires structured approval arguments.';
    }
    const extraKeys = Object.keys(args).filter((key) => key !== 'approvalId' && key !== 'approvalPhrase');
    if (extraKeys.length > 0) {
      return `Unsupported Remote Mesh approval argument: ${extraKeys[0]}.`;
    }
    if (!String(args.approvalId || '').trim()) {
      return 'Remote Mesh approvalId is required.';
    }
    if (!String(args.approvalPhrase || '').trim()) {
      return 'Remote Mesh approvalPhrase is required.';
    }
    return null;
  }

  private validateConfig(): string | null {
    if (!this.config.endpointUrl) {
      return 'ZAVORTH_REMOTE_MESH_NOTEBOOK_MCP_URL is not configured.';
    }
    if (!this.config.authToken || this.config.authToken.length < 16) {
      return 'ZAVORTH_REMOTE_MESH_NOTEBOOK_MCP_TOKEN must be configured with at least 16 characters.';
    }
    const parsed = parseEndpoint(this.config.endpointUrl);
    if (parsed.ok === false) {
      return parsed.error;
    }
    if (parsed.url.protocol === 'http:' && !isLoopback(parsed.url.hostname) && !this.config.allowInsecureHttpForTailnet) {
      return 'Plain HTTP notebook MCP requires ZAVORTH_REMOTE_MESH_ALLOW_INSECURE_HTTP_FOR_TAILNET=1 unless it is loopback.';
    }
    return null;
  }

  private authHeaderValue(): string {
    if (this.config.authHeaderName === 'Authorization') {
      return `Bearer ${this.config.authToken}`;
    }
    return this.config.authToken ?? '';
  }

  private result(input: {
    ok: boolean;
    status: RemoteMeshNotebookMcpProxyResult['status'];
    toolName: RemoteMeshNotebookMcpApplyToolName | null;
    httpStatus?: number | null;
    error?: string | null;
    jsonRpcError?: RemoteMeshNotebookMcpProxyResult['jsonRpcError'];
    receipt?: RemoteMeshNotebookMcpProxyResult['receipt'];
    liveNetworkCallPerformed: boolean;
  }): RemoteMeshNotebookMcpProxyResult {
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_REMOTE_MESH_NOTEBOOK_MCP_PROXY_VERSION,
      ok: input.ok,
      status: input.status,
      toolName: input.toolName,
      httpStatus: input.httpStatus ?? null,
      endpointLabel: this.endpointLabel(),
      error: input.error ?? null,
      jsonRpcError: input.jsonRpcError ?? null,
      receipt: input.receipt ?? null,
      safety: {
        browserReceivedToken: false,
        endpointAcceptedFromBrowser: false,
        applyToolAllowlisted: Boolean(input.toolName && APPLY_TOOL_ALLOWLIST.includes(input.toolName)),
        liveNetworkCallPerformed: input.liveNetworkCallPerformed,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      },
    };
  }

  private endpointLabel(): string | null {
    const parsed = parseEndpoint(this.config.endpointUrl);
    if (parsed.ok === false) {
      return null;
    }
    return `${parsed.url.protocol}//${parsed.url.host}${parsed.url.pathname}`;
  }
}

function normalizeConfig(config: RemoteMeshNotebookMcpProxyConfig): Required<RemoteMeshNotebookMcpProxyConfig> {
  return {
    endpointUrl: config.endpointUrl ? String(config.endpointUrl).trim() : null,
    authToken: config.authToken ? String(config.authToken).trim() : null,
    authHeaderName: normalizeAuthHeaderName(config.authHeaderName),
    allowInsecureHttpForTailnet: config.allowInsecureHttpForTailnet === true,
  };
}

function normalizeAuthHeaderName(value: unknown): RemoteMeshNotebookMcpProxyAuthHeaderName {
  return value === 'X-Zavorth-Remote-Token' ? 'X-Zavorth-Remote-Token' : 'Authorization';
}

function isApplyToolName(value: unknown): value is RemoteMeshNotebookMcpApplyToolName {
  return value === 'notebook.docker.apply_control'
    || value === 'notebook.project_files.apply_read';
}

function parseEndpoint(value: string | null): { ok: true; url: URL } | { ok: false; error: string } {
  if (!value) {
    return { ok: false, error: 'Remote Mesh notebook MCP endpoint is missing.' };
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, error: 'Remote Mesh notebook MCP endpoint must be http or https.' };
    }
    if (url.pathname !== '/mcp') {
      return { ok: false, error: 'Remote Mesh notebook MCP endpoint must point to /mcp.' };
    }
    return { ok: true, url };
  } catch {
    return { ok: false, error: 'Remote Mesh notebook MCP endpoint is not a valid URL.' };
  }
}

function isLoopback(hostname: string): boolean {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || hostname.startsWith('127.');
}

async function readJson(response: Response): Promise<JsonRecord> {
  try {
    const parsed = await response.json() as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as JsonRecord
      : {};
  } catch {
    return {};
  }
}

function readJsonRpcError(value: JsonRecord): RemoteMeshNotebookMcpProxyResult['jsonRpcError'] {
  const error = value.error;
  if (!error || typeof error !== 'object' || Array.isArray(error)) {
    return null;
  }
  const record = error as Record<string, RemoteMeshJson>;
  return {
    code: typeof record.code === 'number' ? record.code : null,
    message: typeof record.message === 'string' ? record.message : 'Remote MCP returned JSON-RPC error.',
  };
}

function readReceipt(value: JsonRecord): RemoteMeshNotebookMcpProxyResult['receipt'] {
  const result = value.result;
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return null;
  }
  const resultRecord = result as Record<string, RemoteMeshJson>;
  const structuredContent = resultRecord.structuredContent;
  const structuredRecord = structuredContent && typeof structuredContent === 'object' && !Array.isArray(structuredContent)
    ? structuredContent as Record<string, RemoteMeshJson>
    : null;
  const content = Array.isArray(resultRecord.content)
    ? resultRecord.content.find((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
    : null;
  const contentRecord = content as Record<string, RemoteMeshJson> | null;
  return {
    toolName: readToolName(structuredRecord),
    structuredContent: structuredRecord,
    contentText: typeof contentRecord?.text === 'string' ? contentRecord.text : null,
  };
}

function readToolName(value: Record<string, RemoteMeshJson> | null): RemoteMeshNotebookScopedMcpToolName | null {
  const toolName = value?.toolName;
  return typeof toolName === 'string' && (
    toolName === 'notebook.get_status'
    || toolName === 'notebook.docker.list_containers'
    || toolName === 'notebook.docker.get_logs'
    || toolName === 'notebook.docker.preview_control'
    || toolName === 'notebook.docker.apply_control'
    || toolName === 'notebook.project_files.preview_read'
    || toolName === 'notebook.project_files.apply_read'
  )
    ? toolName
    : null;
}
