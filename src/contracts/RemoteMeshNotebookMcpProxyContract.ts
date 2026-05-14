import type {
  RemoteMeshNotebookScopedMcpToolName,
} from './RemoteMeshNotebookScopedMcpServerContract.js';
import type { RemoteMeshJson } from './RemoteMeshSandboxContract.js';

export const ZAVORTH_REMOTE_MESH_NOTEBOOK_MCP_PROXY_VERSION =
  '2026-05-05.remote-mesh-command-center-real-mcp-proxy' as const;

export type RemoteMeshNotebookMcpApplyToolName =
  | 'notebook.docker.apply_control'
  | 'notebook.project_files.apply_read';

export type RemoteMeshNotebookMcpProxyAuthHeaderName =
  | 'Authorization'
  | 'X-Zavorth-Remote-Token';

export type RemoteMeshNotebookMcpProxyConfig = {
  endpointUrl: string | null;
  authToken: string | null;
  authHeaderName?: RemoteMeshNotebookMcpProxyAuthHeaderName;
  allowInsecureHttpForTailnet?: boolean;
};

export type RemoteMeshNotebookMcpProxyApplyRequest = {
  toolName: RemoteMeshNotebookMcpApplyToolName;
  arguments: {
    approvalId: string;
    approvalPhrase: string;
  };
};

export type RemoteMeshNotebookMcpProxyReceipt = {
  toolName: RemoteMeshNotebookScopedMcpToolName | null;
  structuredContent: Record<string, RemoteMeshJson> | null;
  contentText: string | null;
};

export type RemoteMeshNotebookMcpProxyResult = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_REMOTE_MESH_NOTEBOOK_MCP_PROXY_VERSION;
  ok: boolean;
  status: 'executed' | 'blocked' | 'failed';
  toolName: RemoteMeshNotebookMcpApplyToolName | null;
  httpStatus: number | null;
  endpointLabel: string | null;
  error: string | null;
  jsonRpcError: {
    code: number | null;
    message: string;
  } | null;
  receipt: RemoteMeshNotebookMcpProxyReceipt | null;
  safety: {
    browserReceivedToken: false;
    endpointAcceptedFromBrowser: false;
    applyToolAllowlisted: boolean;
    liveNetworkCallPerformed: boolean;
    rawCommandSerialized: false;
    secretValuesSerialized: false;
  };
};
