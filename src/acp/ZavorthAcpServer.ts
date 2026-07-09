import { randomUUID } from 'node:crypto';
import { Readable, Writable } from 'node:stream';

import type {
  AcpServerManifest,
  AcpServerSnapshot,
  AcpServerSessionReceipt,
  AcpServerSessionStatus,
  AcpServerToolDef,
  AcpServerCapability,
} from './AcpServerManifest.js';
import { ZAVORTH_ACP_SERVER_CONTRACT_VERSION, buildDefaultManifest } from './AcpServerManifest.js';

type AcpJsonRpcRequest = {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
};

type AcpJsonRpcResponse = {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
  method?: string;
  params?: Record<string, unknown>;
};

type AcpServerSession = {
  id: string;
  cwd: string;
  startedAt: Date;
  endedAt: Date | null;
  status: AcpServerSessionStatus;
  toolCalls: AcpServerSessionReceipt['toolCalls'];
  messagesProcessed: number;
  error: string | null;
};

type ZavorthAcpServerOptions = {
  manifest?: AcpServerManifest;
  stdin?: Readable;
  stdout?: Writable;
  stderr?: Writable;
  now?: () => Date;
  onToolCall?: (name: string, args: Record<string, unknown>) => Promise<string>;
};

const JSONRPC_PARSE_ERROR = -32700;
const JSONRPC_INVALID_REQUEST = -32600;
const JSONRPC_METHOD_NOT_FOUND = -32601;
const JSONRPC_INTERNAL_ERROR = -32603;
const MAX_BUFFER_SIZE = 1024 * 1024;
const MAX_LINE_LENGTH = 64 * 1024;

export class ZavorthAcpServer {
  private readonly manifest: AcpServerManifest;
  private readonly stdin: Readable;
  private readonly stdout: Writable;
  private readonly stderr: Writable;
  private readonly now: () => Date;
  private readonly onToolCall?: (name: string, args: Record<string, unknown>) => Promise<string>;
  private readonly sessions: Map<string, AcpServerSession> = new Map();
  private readonly tools: Map<string, AcpServerToolDef> = new Map();
  private readonly pendingRequests = new Map<string | number, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private status: AcpServerSnapshot['status'] = 'starting';
  private totalSessions = 0;
  private lastError: string | null = null;
  private buffer = '';
  private listening = false;

  constructor(options: ZavorthAcpServerOptions = {}) {
    this.manifest = options.manifest || buildDefaultManifest();
    this.stdin = options.stdin || process.stdin;
    this.stdout = options.stdout || process.stdout;
    this.stderr = options.stderr || process.stderr;
    this.now = options.now || (() => new Date());
    this.onToolCall = options.onToolCall;

    for (const entry of this.manifest.entries) {
      if (entry.enabled !== false) {
        for (const tool of entry.tools) {
          this.tools.set(tool.name, tool);
        }
      }
    }
  }

  async start(): Promise<void> {
    this.status = 'listening';
    this.listening = true;
    this.log(`ACP Server "${this.manifest.serverName}" v${this.manifest.serverVersion} listening on stdio`);
    this.log(`Tools registered: ${[...this.tools.keys()].join(', ')}`);

    return new Promise<void>((resolve, reject) => {
      this.stdin.setEncoding('utf-8');
      this.stdin.on('data', (chunk: string) => {
        this.buffer += chunk;
        if (this.buffer.length > MAX_BUFFER_SIZE) {
          this.log(`Buffer overflow rejected (${this.buffer.length} bytes)`);
          this.buffer = '';
          this.sendError(null, JSONRPC_INVALID_REQUEST, 'Message too large');
          return;
        }
        this.processBuffer();
      });
      this.stdin.on('end', () => {
        this.status = 'stopped';
        this.listening = false;
        resolve();
      });
      this.stdin.on('error', (err: Error) => {
        this.status = 'error';
        this.lastError = err.message;
        reject(err);
      });
    });
  }

  stop(): void {
    this.listening = false;
    this.status = 'stopped';
    for (const [id, session] of this.sessions) {
      if (session.status === 'active') {
        session.status = 'completed';
        session.endedAt = this.now();
      }
    }
  }

  async sendRequest(method: string, params: unknown): Promise<any> {
    const id = randomUUID();
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      try {
        this.stdout.write(JSON.stringify(request) + '\n');
      } catch (err: any) { const error = err; const e = err;
        this.pendingRequests.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  async requestElevatedApproval(
    type: string,
    message: string,
    metadata: Record<string, unknown>
  ): Promise<boolean> {
    try {
      const response = await this.sendRequest('client:requestElevatedApproval', {
        type,
        message,
        metadata,
      });
      return response && response.approved === true;
    } catch (err: any) { const error = err; const e = err;
      this.log(`Elevated approval request failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  getSnapshot(): AcpServerSnapshot {
    return {
      contractVersion: ZAVORTH_ACP_SERVER_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      serverId: this.manifest.serverId,
      status: this.status,
      activeSessions: [...this.sessions.values()].filter((s) => s.status === 'active').length,
      totalSessions: this.totalSessions,
      toolsRegistered: [...this.tools.keys()],
      capabilities: this.getCapabilities(),
      lastError: this.lastError,
    };
  }

  getManifest(): AcpServerManifest {
    return { ...this.manifest };
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.length > MAX_LINE_LENGTH) {
        this.sendError(null, JSONRPC_INVALID_REQUEST, 'Line too large');
        continue;
      }

      let msg: any;
      try {
        msg = JSON.parse(trimmed);
      } catch (error: any) { const err = error; const e = error;
        this.sendError(null, JSONRPC_PARSE_ERROR, 'Parse error');
        continue;
      }

      // Intercept incoming JSON-RPC responses (have an 'id' and either 'result' or 'error' but do NOT have a 'method')
      if (
        msg &&
        typeof msg === 'object' &&
        msg.id !== undefined &&
        msg.id !== null &&
        ('result' in msg || 'error' in msg) &&
        !('method' in msg)
      ) {
        if (this.pendingRequests.has(msg.id)) {
          const pending = this.pendingRequests.get(msg.id)!;
          this.pendingRequests.delete(msg.id);
          if (msg.error) {
            pending.reject(new Error(msg.error.message || 'JSON-RPC request failed'));
          } else {
            pending.resolve(msg.result);
          }
          continue;
        }
      }

      const request = msg as AcpJsonRpcRequest;
      this.handleRequest(request).catch((err) => {
        this.sendError(request.id, JSONRPC_INTERNAL_ERROR, err instanceof Error ? err.message : 'Internal error');
      });
    }
  }

  private async handleRequest(request: AcpJsonRpcRequest): Promise<void> {
    const { id, method, params } = request;

    switch (method) {
      case 'initialize':
        this.handleInitialize(id, params);
        break;
      case 'session/start':
        await this.handleSessionStart(id, params);
        break;
      case 'session/end':
        this.handleSessionEnd(id, params);
        break;
      case 'message/send':
        await this.handleMessageSend(id, params);
        break;
      case 'tools/list':
        this.handleToolsList(id);
        break;
      case 'tools/call':
        await this.handleToolsCall(id, params);
        break;
      case 'ping':
        this.sendResult(id, { pong: true });
        break;
      default:
        this.sendError(id, JSONRPC_METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
  }

  private handleInitialize(id: string | number, params?: Record<string, unknown>): void {
    const clientInfo = (params?.clientInfo as Record<string, unknown>) || {};
    this.log(`Client connected: ${clientInfo.name || 'unknown'} v${clientInfo.version || '?'}`);

    this.sendResult(id, {
      serverInfo: {
        name: this.manifest.serverName,
        version: this.manifest.serverVersion,
        serverId: this.manifest.serverId,
      },
      capabilities: {
        tools: true,
        chat: true,
        filesystem: true,
        search: true,
        shell: true,
      },
      protocolVersion: ZAVORTH_ACP_SERVER_CONTRACT_VERSION,
    });
  }

  private async handleSessionStart(id: string | number, params?: Record<string, unknown>): Promise<void> {
    const sessionId = String(params?.sessionId || randomUUID());
    const cwd = String(params?.cwd || process.cwd());

    const session: AcpServerSession = {
      id: sessionId,
      cwd,
      startedAt: this.now(),
      endedAt: null,
      status: 'active',
      toolCalls: [],
      messagesProcessed: 0,
      error: null,
    };

    this.sessions.set(sessionId, session);
    this.totalSessions++;
    this.log(`Session started: ${sessionId} (cwd: ${cwd})`);

    this.sendResult(id, { sessionId, status: 'started' });
  }

  private handleSessionEnd(id: string | number, params?: Record<string, unknown>): void {
    const sessionId = String(params?.sessionId || '');
    const session = this.sessions.get(sessionId);

    if (session) {
      session.status = 'completed';
      this.log(`Session ended: ${sessionId}`);
    }

    this.sendResult(id, { sessionId, status: 'ended' });
  }

  private async handleMessageSend(id: string | number, params?: Record<string, unknown>): Promise<void> {
    const sessionId = String(params?.sessionId || '');
    const content = String(params?.content || '');
    const session = this.sessions.get(sessionId);

    if (!session || session.status !== 'active') {
      this.sendError(id, JSONRPC_INVALID_REQUEST, `No active session: ${sessionId}`);
      return;
    }

    session.messagesProcessed++;

    this.sendEvent('message/event', {
      sessionId,
      type: 'thinking',
      content: 'Processing...',
    });

    try {
      const response = await this.processMessage(content, session);

      this.sendEvent('message/event', {
        sessionId,
        type: 'text',
        content: response,
      });

      this.sendResult(id, { sessionId, status: 'completed' });
    } catch (err: any) { const error = err; const e = err;
      session.status = 'failed';
      session.error = err instanceof Error ? err.message : 'Unknown error';
      this.sendError(id, JSONRPC_INTERNAL_ERROR, session.error);
    }
  }

  private handleToolsList(id: string | number): void {
    const tools = [...this.tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      requiresApproval: tool.requiresApproval,
      parameters: tool.parameters || {
        type: 'object',
        properties: {},
      },
    }));

    this.sendResult(id, { tools });
  }

  private async handleToolsCall(id: string | number, params?: Record<string, unknown>): Promise<void> {
    const toolName = String(params?.name || '').trim();
    const args = (params?.arguments as Record<string, unknown>) || {};

    if (!toolName) {
      this.sendError(id, JSONRPC_INVALID_REQUEST, 'Tool name is required');
      return;
    }

    const session = [...this.sessions.values()].find((s) => s.status === 'active');
    if (!session) {
      this.sendError(id, JSONRPC_INVALID_REQUEST, 'No active session');
      return;
    }

    try {
      const result = await this.executeToolCall(toolName, args, session);
      this.sendResult(id, { content: [{ type: 'text', text: result }], isError: false });
    } catch (err: any) { const e = err;
      const error = err instanceof Error ? err.message : 'Tool execution failed';
      this.sendResult(id, { content: [{ type: 'text', text: error }], isError: true });
    }
  }

  private async processMessage(content: string, session: AcpServerSession): Promise<string> {
    const toolCallMatch = content.match(/^use\s+(\w+)\s+(.*)/is);
    if (toolCallMatch) {
      const toolName = toolCallMatch[1];
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(toolCallMatch[2]);
      } catch (error: any) { const err = error; const e = error;
        args = { input: toolCallMatch[2] };
      }
      return this.executeToolCall(toolName, args, session);
    }

    return `Zavorth received your message. ${session.messagesProcessed} messages processed in this session. Use "use <ToolName> <args>" to invoke tools.`;
  }

  private async executeToolCall(
    toolName: string,
    args: Record<string, unknown>,
    session: AcpServerSession,
  ): Promise<string> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return `Tool not found: ${toolName}. Available: ${[...this.tools.keys()].join(', ')}`;
    }

    const startTime = Date.now();

    this.sendEvent('tool/event', {
      sessionId: session.id,
      name: toolName,
      status: 'started',
      args,
    });

    try {
      let result: string;
      if (this.onToolCall) {
        result = await this.onToolCall(toolName, args);
      } else {
        result = await this.defaultToolExecution(toolName, args);
      }

      const durationMs = Date.now() - startTime;
      session.toolCalls.push({
        name: toolName,
        approved: !tool.requiresApproval,
        result: result.slice(0, 1000),
        durationMs,
      });

      this.sendEvent('tool/event', {
        sessionId: session.id,
        name: toolName,
        status: 'completed',
        result: result.slice(0, 2000),
        durationMs,
      });

      return result;
    } catch (err: any) { const e = err;
      const durationMs = Date.now() - startTime;
      const error = err instanceof Error ? err.message : 'Tool execution failed';
      session.toolCalls.push({
        name: toolName,
        approved: false,
        result: `ERROR: ${error}`,
        durationMs,
      });

      this.sendEvent('tool/event', {
        sessionId: session.id,
        name: toolName,
        status: 'failed',
        error,
        durationMs,
      });

      return `Tool ${toolName} failed: ${error}`;
    }
  }

  private async defaultToolExecution(toolName: string, args: Record<string, unknown>): Promise<string> {
    const fs = await import('fs');
    const pathMod = await import('path');

    const cwd = this.getCwd();
    const containedPath = async (target: string): Promise<string | null> => {
      const resolved = pathMod.resolve(cwd, target);
      if (!resolved.startsWith(cwd)) {
        if (args.bypassPathRestriction === true) {
          return resolved;
        }
        const approved = await this.requestElevatedApproval(
          'path_traversal',
          'The agent is trying to read/write a file outside the workspace.',
          { path: resolved }
        );
        if (approved) {
          args.bypassPathRestriction = true;
          return resolved;
        }
        return null;
      }
      return resolved;
    };

    switch (toolName) {
      case 'Read': {
        const filePath = String(args.path || args.file || '');
        if (!filePath) return 'Error: no file path provided';
        const resolved = await containedPath(filePath);
        if (!resolved) return 'Error: path traversal denied';
        if (!fs.existsSync(resolved)) return `File not found: ${resolved}`;

        const stats = fs.statSync(resolved);
        const size = stats.size;
        const limit = 5 * 1024 * 1024; // 5MB
        if (size > limit) {
          if (args.bypassSizeLimit !== true) {
            const sizeInMB = (size / (1024 * 1024)).toFixed(2);
            const msg = `The agent is trying to read a ${sizeInMB}MB file. This may cause slowness or memory pressure.`;
            const approved = await this.requestElevatedApproval('file_size', msg, { path: filePath, size });
            if (approved) {
              args.bypassSizeLimit = true;
            } else {
              return `Error: File size exceeds 5MB limit (${sizeInMB}MB) and elevated approval was denied.`;
            }
          }
        }

        return fs.readFileSync(resolved, 'utf-8');
      }
      case 'LS': {
        const dirPath = String(args.path || args.directory || '.');
        const resolved = await containedPath(dirPath);
        if (!resolved) return 'Error: path traversal denied';
        if (!fs.existsSync(resolved)) return `Directory not found: ${resolved}`;
        const entries = fs.readdirSync(resolved, { withFileTypes: true });
        return entries.map((e) => `${e.isDirectory() ? 'd' : 'f'} ${e.name}`).join('\n');
      }
      case 'Glob': {
        return `Glob search for "${args.pattern || '*'}" — integrate with Zavorth GlobTool for full results.`;
      }
      case 'Grep': {
        return `Grep search for "${args.pattern || ''}" — integrate with Zavorth GrepTool for full results.`;
      }
      case 'Write': {
        return `Write approval required. Path: ${args.path || 'unknown'}`;
      }
      case 'Edit': {
        return `Edit approval required. Path: ${args.path || 'unknown'}`;
      }
      case 'Bash': {
        return `Bash approval required. Command: ${args.command || 'unknown'}`;
      }
      case 'WebSearch': {
        return `Web search for "${args.query || ''}" — integrate with Zavorth WebSearchTool for full results.`;
      }
      default:
        return `Tool ${toolName} executed with default handler.`;
    }
  }

  private getCapabilities(): AcpServerCapability[] {
    const caps = new Set<AcpServerCapability>();
    for (const entry of this.manifest.entries) {
      if (entry.enabled !== false) {
        for (const cap of entry.capabilities) {
          caps.add(cap);
        }
      }
    }
    return [...caps];
  }

  private getCwd(): string {
    for (const session of this.sessions.values()) {
      if (session.status === 'active') return session.cwd;
    }
    return process.cwd();
  }

  private sendResult(id: string | number, result: unknown): void {
    const response: AcpJsonRpcResponse = { jsonrpc: '2.0', id, result };
    this.send(response);
  }

  private sendError(id: string | number | null, code: number, message: string, data?: unknown): void {
    const response: AcpJsonRpcResponse = {
      jsonrpc: '2.0',
      id,
      error: { code, message, data },
    };
    this.send(response);
  }

  private sendEvent(method: string, params: Record<string, unknown>): void {
    const event: AcpJsonRpcResponse = { jsonrpc: '2.0', id: null, method, params };
    this.send(event);
  }

  private send(response: AcpJsonRpcResponse): void {
    try {
      this.stdout.write(JSON.stringify(response) + '\n');
    } catch (err: any) { const error = err; const e = err;
      this.log(`Failed to write response: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  private log(message: string): void {
    try {
      this.stderr.write(`[ACP] ${message}\n`);
    } catch (error: any) { const err = error; const e = error;
      // ignore
    }
  }
}
