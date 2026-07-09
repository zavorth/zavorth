import { createHash, randomUUID } from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative as relativePath, resolve } from 'node:path';
import { Readable, Writable, Transform } from 'node:stream';
import readline from 'node:readline';
import type { RequestPermissionRequest, SessionNotification } from '@agentclientprotocol/sdk';
import {
  ZAVORTH_ACP_LIVE_BRIDGE_CONTRACT_VERSION,
  type AcpLiveSessionEvent,
  type AcpLiveSessionReceipt,
  type AcpLiveSessionStatus,
  type AcpLiveSessionToolDecision,
  type AcpLiveSessionTransportKind,
} from '../contracts/AcpLiveBridgeContract.js';
import { AcpLiveBridgeService } from './AcpLiveBridgeService.js';
import { SourceAgentRuntimeToolPolicyService } from './SourceAgentRuntimeToolPolicyService.js';
import { logger } from '../logger.js';

interface AcpElevatedApprovalRequest {
  id: string | number | null;
  method: string;
  params?: {
    type?: string;
    message?: string;
    metadata?: Record<string, unknown>;
  };
}

interface PendingJitApproval {
  id: string;
  type: string;
  message: string;
  metadata: Record<string, unknown> | undefined;
  createdAt: string;
  resolve: (val: boolean) => void;
}

interface GlobalWithJitApprovals {
  globalPendingJitApprovals?: Map<string, PendingJitApproval>;
}

type PlainStyle = ((value: string) => string) & {
  bold: (value: string) => string;
};

const plainStyle = ((value: string) => value) as PlainStyle;
plainStyle.bold = (value: string) => value;

const terminalStyle = {
  red: plainStyle,
  yellow: plainStyle,
  white: plainStyle,
  cyan: plainStyle,
};

class AcpStreamInterceptor extends Transform {
  private buffer = '';

  constructor(
    private readonly onElevatedApproval: (request: AcpElevatedApprovalRequest) => Promise<void>
  ) {
    super();
  }

  _transform(chunk: string | Buffer, encoding: string, callback: () => void) {
    this.buffer += chunk.toString('utf8');
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed);
        if (obj && obj.method === 'client:requestElevatedApproval') {
          void this.onElevatedApproval(obj);
          continue;
        }
      } catch (error: any) {
      // Not JSON or parse error, let it pass
      logger.warn('[Acp Live Session] JSON parse failed', error);
    }
      this.push(line + '\n');
    }
    callback();
  }

  _flush(callback: () => void) {
    if (this.buffer.trim()) {
      try {
        const obj = JSON.parse(this.buffer.trim());
        if (obj && obj.method === 'client:requestElevatedApproval') {
          void this.onElevatedApproval(obj);
        } else {
          this.push(this.buffer + '\n');
        }
      } catch (err: any) { const error = err; const e = err;
        this.push(this.buffer + '\n');
      }
    }
    callback();
  }
}

async function askElevatedApproval(
  requestId: string | number,
  type: string,
  message: string,
  metadata: Record<string, unknown> | undefined
): Promise<boolean> {
  const details = metadata ? JSON.stringify(metadata, null, 2) : 'None';

  // If stdin is not a TTY (like Next.js or background daemon processes),
  // queue in global map for zavorthControl / other channels to pick up
  if (!process.stdin.isTTY) {
    const jitMap = ((global as unknown as GlobalWithJitApprovals).globalPendingJitApprovals ??= new Map());
    return new Promise<boolean>((resolvePromise) => {
      jitMap.set(String(requestId), {
        id: String(requestId),
        type,
        message,
        metadata,
        createdAt: new Date().toISOString(),
        resolve: (val: boolean) => {
          jitMap.delete(String(requestId));
          resolvePromise(val);
        }
      });
    });
  }

  // Interactive CLI mode
  const title = terminalStyle.red.bold('SECURITY WARNING');
  const riskLine = `${terminalStyle.yellow.bold('RISK TYPE:')} ${terminalStyle.white(type)}`;
  const msgLine = `${terminalStyle.yellow.bold('MESSAGE:')} ${terminalStyle.white(message)}`;
  const detailsTitle = terminalStyle.yellow.bold('DETAILS:');
  const detailsBody = terminalStyle.cyan(details);

  const border = terminalStyle.red('================================================================================');
  console.log('\n' + border);
  console.log(title);
  console.log(border);
  console.log(riskLine);
  console.log(msgLine);
  console.log(border);
  console.log(detailsTitle);
  console.log(detailsBody);
  console.log(border + '\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question('Allow this action? [y/N]: ', (response) => {
      resolve(response);
    });
  });
  rl.close();

  return answer.trim().toLowerCase() === 'y';
}

export type AcpLiveSessionInput = {
  prompt: string;
  serverId?: string;
  transport?: AcpLiveSessionTransportKind;
  receiptPath?: string;
  requireLiveBridgeReady?: boolean;
  stdioCommand?: string;
  stdioArgs?: string[];
  timeoutMs?: number;
};

export type AcpJsonRpcRequest = {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
};

export type AcpJsonRpcResponse = {
  jsonrpc?: '2.0';
  id?: string | number | null;
  result?: unknown;
  error?: unknown;
  method?: string;
  params?: Record<string, unknown>;
};

export interface AcpJsonRpcTransport {
  readonly kind: AcpLiveSessionTransportKind;
  open(): Promise<void>;
  request(request: AcpJsonRpcRequest): Promise<AcpJsonRpcResponse>;
  close(): Promise<void>;
}

type Runtime = {
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
  bridgeService?: AcpLiveBridgeService;
  toolPolicyService?: SourceAgentRuntimeToolPolicyService;
  transport?: AcpJsonRpcTransport;
};

const DEFAULT_RECEIPT_PATH = 'data/runtime/acp-live-session-last.json';
const SAFE_AUTO_ALLOWED_TOOLS = ['Read', 'Glob', 'Grep', 'LS'];
const CONFIGURED_TOOLS = ['Read', 'Glob', 'Grep', 'LS', 'Write', 'Edit', 'Bash'];

export class AcpLiveSessionService {
  private readonly now: () => Date;
  private readonly env: NodeJS.ProcessEnv;
  private readonly bridgeService: AcpLiveBridgeService;
  private readonly toolPolicyService: SourceAgentRuntimeToolPolicyService;
  private readonly injectedTransport?: AcpJsonRpcTransport;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.env = runtime.env || process.env;
    this.bridgeService = runtime.bridgeService || new AcpLiveBridgeService({ now: this.now, env: this.env });
    this.toolPolicyService = runtime.toolPolicyService || new SourceAgentRuntimeToolPolicyService({ now: this.now });
    this.injectedTransport = runtime.transport;
  }

  public async run(input: AcpLiveSessionInput): Promise<AcpLiveSessionReceipt> {
    const prompt = String(input.prompt || '').trim();
    const transportKind = input.transport || (this.injectedTransport?.kind ?? 'mock-jsonrpc');
    const serverId = String(input.serverId || this.env.ZAVORTH_ACPX_BRIDGE_SERVER_ID || 'local-acp').trim();
    const sessionId = `acp-${randomUUID()}`;
    const events: AcpLiveSessionEvent[] = [];
    const toolDecisions: AcpLiveSessionToolDecision[] = [];
    const bridge = this.bridgeService.buildSnapshot();
    const requireLiveBridgeReady = input.requireLiveBridgeReady ?? transportKind !== 'mock-jsonrpc';

    const push = (kind: AcpLiveSessionEvent['kind'], summary: string, data?: Record<string, unknown>) => {
      events.push({ kind, at: this.now().toISOString(), summary: sanitizeText(summary), data: sanitizeObject(data) });
    };

    push('bridge-readiness', `ACP bridge status is ${bridge.status}.`, {
      executionAuthorityGranted: bridge.receipt.executionAuthorityGranted,
      liveReady: bridge.summary.liveReady,
    });

    if (requireLiveBridgeReady && bridge.status !== 'ready') {
      const receipt = this.buildReceipt({
        status: 'blocked',
        sessionId,
        serverId,
        transportKind,
        prompt,
        bridge,
        events,
        toolDecisions,
        outputText: 'ACP session blocked until live bridge governance is ready.',
      });
      this.writeReceipt(receipt, input.receiptPath);
      return receipt;
    }

    const allowlisted = this.isServerAllowlisted(serverId, transportKind);
    if (!allowlisted) {
      push('error', `ACP server ${serverId} is not allowlisted.`);
      const receipt = this.buildReceipt({
        status: 'blocked',
        sessionId,
        serverId,
        transportKind,
        prompt,
        bridge,
        events,
        toolDecisions,
        outputText: 'ACP session blocked because the server is not allowlisted.',
      });
      this.writeReceipt(receipt, input.receiptPath);
      return receipt;
    }

    if (transportKind === 'acp-sdk-stdio') {
      return this.runSdkStdioSession({
        input,
        sessionId,
        serverId,
        prompt,
        bridge,
        events,
        toolDecisions,
        push,
      });
    }

    const transport = this.injectedTransport || this.createTransport(input, transportKind);
    let outputText = '';
    let status: AcpLiveSessionStatus = 'completed';

    try {
      await transport.open();
      push('transport-opened', `${transport.kind} transport opened.`, { serverId });

      const init = await transport.request(jsonRpc('initialize', {
        clientInfo: { name: 'zavorth', protocol: 'ACP', governedBy: 'Zavorth' },
      }));
      push('initialize', 'ACP initialize completed.', summarizeResponse(init));

      const started = await transport.request(jsonRpc('session/start', {
        sessionId,
        cwd: this.env.ZAVORTH_ACPX_BRIDGE_CWD || process.cwd(),
      }));
      push('session-start', 'ACP session started.', summarizeResponse(started));

      const message = await transport.request(jsonRpc('message/send', {
        sessionId,
        prompt,
      }));
      push('message-send', 'Prompt sent to ACP session.', { promptHash: hashPrompt(prompt) });

      const messageEvents = extractMessageEvents(message);
      for (const event of messageEvents) {
        if (event.type === 'tool_request') {
          const decision = this.decideTool(event);
          toolDecisions.push(decision);
          push('tool-request', `${decision.toolName} requested by ACP server.`, {
            requestId: decision.requestId,
            toolName: decision.toolName,
          });
          push('tool-decision', `${decision.toolName}: ${decision.decision}.`, {
            requestId: decision.requestId,
            reason: decision.reason,
            liveToolExecutionPerformed: false,
          });
          if (decision.decision === 'approval_required') {
            status = 'approval_required';
          }
        } else {
          const text = String(event.text || event.summary || '').trim();
          if (text) outputText = outputText ? `${outputText}\n${text}` : text;
          push('message-event', text || 'ACP message event received.', { type: event.type });
        }
      }

      await transport.request(jsonRpc('session/end', { sessionId }));
      push('session-end', 'ACP session ended.');
    } catch (error: any) {
      status = 'failed';
      outputText = error instanceof Error ? error.message : String(error);
      push('error', outputText);
    } finally {
      await transport.close().catch(() => undefined);
      push('transport-closed', `${transport.kind} transport closed.`);
    }

    if (!outputText && status === 'completed') {
      outputText = 'ACP session completed without text output.';
    }

    const receipt = this.buildReceipt({
      status,
      sessionId,
      serverId,
      transportKind,
      prompt,
      bridge,
      events,
      toolDecisions,
      outputText,
    });
    this.writeReceipt(receipt, input.receiptPath);
    return receipt;
  }

  public renderText(receipt: AcpLiveSessionReceipt): string {
    return [
      'Zavorth ACP Session',
      `Status: ${receipt.status}`,
      `Server: ${receipt.session.serverId}`,
      `Transport: ${receipt.session.transport}`,
      `Live execution: ${receipt.session.liveExecutionPerformed ? 'yes' : 'no'}`,
      `Tool execution: ${receipt.session.liveToolExecutionPerformed ? 'yes' : 'no'}`,
      '',
      receipt.output.text,
      '',
      'Tool decisions',
      ...(receipt.toolDecisions.length
        ? receipt.toolDecisions.map((decision) => `- ${decision.toolName}: ${decision.decision}. ${decision.reason}`)
        : ['- none']),
    ].join('\n');
  }

  private createTransport(input: AcpLiveSessionInput, transportKind: AcpLiveSessionTransportKind): AcpJsonRpcTransport {
    if (transportKind === 'mock-jsonrpc') {
      return new MockAcpJsonRpcTransport();
    }
    const command = input.stdioCommand || this.env.ZAVORTH_ACPX_BRIDGE_STDIO_COMMAND;
    if (!command) {
      throw new Error('ZAVORTH_ACPX_BRIDGE_STDIO_COMMAND is required for stdio-jsonrpc ACP transport.');
    }
    return new StdioAcpJsonRpcTransport(command, input.stdioArgs || parseList(this.env.ZAVORTH_ACPX_BRIDGE_STDIO_ARGS));
  }

  private async runSdkStdioSession(params: {
    input: AcpLiveSessionInput;
    sessionId: string;
    serverId: string;
    prompt: string;
    bridge: ReturnType<AcpLiveBridgeService['buildSnapshot']>;
    events: AcpLiveSessionEvent[];
    toolDecisions: AcpLiveSessionToolDecision[];
    push: (kind: AcpLiveSessionEvent['kind'], summary: string, data?: Record<string, unknown>) => void;
  }): Promise<AcpLiveSessionReceipt> {
    const command = params.input.stdioCommand || this.env.ZAVORTH_ACPX_BRIDGE_STDIO_COMMAND;
    const timeoutMs = params.input.timeoutMs || Number(this.env.ZAVORTH_ACPX_BRIDGE_SESSION_TIMEOUT_MS || 120000);
    if (!command) {
      params.push('error', 'ZAVORTH_ACPX_BRIDGE_STDIO_COMMAND is required for acp-sdk-stdio.');
      const receipt = this.buildReceipt({
        status: 'blocked',
        sessionId: params.sessionId,
        serverId: params.serverId,
        transportKind: 'acp-sdk-stdio',
        prompt: params.prompt,
        bridge: params.bridge,
        events: params.events,
        toolDecisions: params.toolDecisions,
        outputText: 'ACP SDK session blocked because no stdio command was configured.',
      });
      this.writeReceipt(receipt, params.input.receiptPath);
      return receipt;
    }

    const args = params.input.stdioArgs || parseList(this.env.ZAVORTH_ACPX_BRIDGE_STDIO_ARGS);
    const cwd = this.env.ZAVORTH_ACPX_BRIDGE_CWD || process.cwd();
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
      env: this.buildSafeSpawnEnv(),
      windowsHide: true,
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    params.push('transport-opened', 'ACP SDK stdio transport opened.', {
      serverId: params.serverId,
      command,
      args,
    });

    let status: AcpLiveSessionStatus = 'completed';
    let outputText = '';
    try {
      if (!child.stdin || !child.stdout) {
        throw new Error('Failed to create ACP stdio pipes.');
      }

      const acpSdk = await import('@agentclientprotocol/sdk');

      const handleElevatedApproval = async (request: AcpElevatedApprovalRequest) => {
        const requestId = request.id ?? randomUUID();
        const reqParams = request.params || {};
        const type = reqParams.type || 'N/A';
        const message = reqParams.message || 'No message provided.';
        const approved = await askElevatedApproval(requestId, type, message, reqParams.metadata);
        const response = {
          jsonrpc: '2.0',
          id: requestId,
          result: {
            approved
          }
        };
        child.stdin?.write(JSON.stringify(response) + '\n', 'utf8');
      };

      const interceptor = new AcpStreamInterceptor(handleElevatedApproval);
      child.stdout.pipe(interceptor);

      const stream = acpSdk.ndJsonStream(
        Writable.toWeb(child.stdin),
        Readable.toWeb(interceptor) as unknown as ReadableStream<Uint8Array>,
      );
      const client = new acpSdk.ClientSideConnection(
        () => ({
          sessionUpdate: async (notification: SessionNotification) => {
            const text = extractAcpNotificationText(notification);
            if (text) {
              outputText += text;
              params.push('message-event', text, { update: extractAcpUpdateKind(notification) });
            } else {
              params.push('message-event', 'ACP session notification received.', {
                update: extractAcpUpdateKind(notification),
              });
            }
          },
          requestPermission: async (request: RequestPermissionRequest) => {
            const toolName = extractAcpPermissionToolName(request);
            const decision = this.decideTool({
              type: 'tool_request',
              requestId: randomUUID(),
              toolName,
            });
            params.toolDecisions.push(decision);
            params.push('tool-request', `${decision.toolName} requested by ACP server.`, {
              toolName: decision.toolName,
            });
            params.push('tool-decision', `${decision.toolName}: ${decision.decision}.`, {
              reason: decision.reason,
              liveToolExecutionPerformed: false,
            });
            if (decision.decision === 'approval_required') {
              status = 'approval_required';
            }
            return { outcome: { outcome: 'selected', optionId: decision.decision === 'allow' ? 'allow' : 'reject' } };
          },
        }),
        stream,
      );

      await withTimeout(client.initialize({
        protocolVersion: acpSdk.PROTOCOL_VERSION,
        clientCapabilities: {
          fs: { readTextFile: true, writeTextFile: false },
          terminal: false,
        },
        clientInfo: { name: 'zavorth-runtime-adapter', version: '1.0.0' },
      }), timeoutMs, 'ACP initialize timed out.');
      params.push('initialize', 'ACP SDK initialize completed.', { protocolVersion: acpSdk.PROTOCOL_VERSION });

      const session = await withTimeout(client.newSession({ cwd, mcpServers: [] }), timeoutMs, 'ACP newSession timed out.');
      params.push('session-start', 'ACP SDK session started.', { sessionId: session.sessionId });

      const response = await withTimeout(client.prompt({
        sessionId: session.sessionId,
        prompt: [{ type: 'text', text: params.prompt }],
      }), timeoutMs, 'ACP prompt timed out.');
      params.push('message-send', 'Prompt sent to ACP SDK session.', {
        promptHash: hashPrompt(params.prompt),
        stopReason: response.stopReason,
      });
      params.push('session-end', 'ACP SDK session ended.', { stopReason: response.stopReason });
    } catch (error: any) {
      status = 'failed';
      outputText = error instanceof Error ? error.message : String(error);
      params.push('error', outputText, stderr ? { stderr: sanitizeText(stderr) } : undefined);
    } finally {
      child.kill();
      params.push('transport-closed', 'ACP SDK stdio transport closed.');
    }

    const receipt = this.buildReceipt({
      status,
      sessionId: params.sessionId,
      serverId: params.serverId,
      transportKind: 'acp-sdk-stdio',
      prompt: params.prompt,
      bridge: params.bridge,
      events: params.events,
      toolDecisions: params.toolDecisions,
      outputText: outputText.trim() || (status === 'completed' ? 'ACP SDK session completed without text output.' : 'ACP SDK session failed.'),
    });
    this.writeReceipt(receipt, params.input.receiptPath);
    return receipt;
  }

  private decideTool(event: Record<string, unknown>): AcpLiveSessionToolDecision {
    const requestId = String(event.requestId || event.id || randomUUID());
    const toolName = String(event.toolName || event.name || 'unknown').trim();
    const doctor = this.toolPolicyService.buildDoctor({
      mode: 'configured',
      requestedTools: [toolName],
      allowedTools: CONFIGURED_TOOLS,
      approvedToolIds: SAFE_AUTO_ALLOWED_TOOLS,
      approvalGranted: true,
    });
    const decision = doctor.decisions[0];
    return {
      requestId,
      toolName,
      decision: decision?.decision || 'deny',
      reason: decision?.reason || `${toolName} is denied because Zavorth could not classify the tool safely.`,
      approvalRequired: decision?.approvalRequired ?? true,
      liveToolExecutionPerformed: false,
    };
  }

  private isServerAllowlisted(serverId: string, transportKind: AcpLiveSessionTransportKind): boolean {
    if (transportKind === 'mock-jsonrpc') return true;
    return parseList(this.env.ZAVORTH_ACPX_BRIDGE_ALLOWED_SERVERS)
      .some((allowed) => allowed === serverId || allowed === '*');
  }

  private buildReceipt(input: {
    status: AcpLiveSessionStatus;
    sessionId: string;
    serverId: string;
    transportKind: AcpLiveSessionTransportKind;
    prompt: string;
    bridge: ReturnType<AcpLiveBridgeService['buildSnapshot']>;
    events: AcpLiveSessionEvent[];
    toolDecisions: AcpLiveSessionToolDecision[];
    outputText: string;
  }): AcpLiveSessionReceipt {
    return {
      contractVersion: ZAVORTH_ACP_LIVE_BRIDGE_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'acp-live-session',
      generatedAt: this.now().toISOString(),
      status: input.status,
      session: {
        id: input.sessionId,
        serverId: input.serverId,
        transport: input.transportKind,
        promptHash: hashPrompt(input.prompt),
        liveExecutionPerformed: input.transportKind === 'stdio-jsonrpc' || input.transportKind === 'acp-sdk-stdio',
        liveToolExecutionPerformed: false,
      },
      governance: {
        bridgeStatus: input.bridge.status,
        executionAuthorityGranted: input.bridge.receipt.executionAuthorityGranted,
        approvalRef: input.bridge.receipt.approvalRef,
        serverAllowlisted: this.isServerAllowlisted(input.serverId, input.transportKind),
        rawSecretsSerialized: false,
      },
      events: input.events,
      toolDecisions: input.toolDecisions,
      output: {
        text: sanitizeText(input.outputText),
        eventCount: input.events.length,
      },
    };
  }

  private writeReceipt(receipt: AcpLiveSessionReceipt, path = DEFAULT_RECEIPT_PATH): void {
    const runtimeDir = resolve('data', 'runtime');
    const requested = resolve(path);
    const relative = path ? requested : resolve(DEFAULT_RECEIPT_PATH);
    const fullPath = isInsideDirectory(relative, runtimeDir) ? relative : resolve(DEFAULT_RECEIPT_PATH);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  }

  private buildSafeSpawnEnv(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
      if (/api[_-]?key|token|secret|password|authorization/i.test(key)) {
        delete env[key];
      }
    }
    return env;
  }
}

export class MockAcpJsonRpcTransport implements AcpJsonRpcTransport {
  public readonly kind = 'mock-jsonrpc' as const;

  public async open(): Promise<void> {}

  public async close(): Promise<void> {}

  public async request(request: AcpJsonRpcRequest): Promise<AcpJsonRpcResponse> {
    if (request.method === 'initialize') {
      return { jsonrpc: '2.0', id: request.id, result: { protocol: 'ACP', serverInfo: { name: 'mock-acp' } } };
    }
    if (request.method === 'session/start') {
      return { jsonrpc: '2.0', id: request.id, result: { sessionId: request.params?.sessionId } };
    }
    if (request.method === 'message/send') {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          events: [
            { type: 'message', text: 'Mock ACP response received by Zavorth.' },
            { type: 'tool_request', requestId: 'tool-write-1', toolName: 'Write', input: { path: 'example.txt' } },
          ],
        },
      };
    }
    if (request.method === 'session/end') {
      return { jsonrpc: '2.0', id: request.id, result: { ended: true } };
    }
    return { jsonrpc: '2.0', id: request.id, result: {} };
  }
}

class StdioAcpJsonRpcTransport implements AcpJsonRpcTransport {
  public readonly kind = 'stdio-jsonrpc' as const;
  private child: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private readonly pending = new Map<string | number, {
    resolve: (response: AcpJsonRpcResponse) => void;
    reject: (error: Error) => void;
  }>();

  public constructor(
    private readonly command: string,
    private readonly args: string[] = [],
  ) {}

  public async open(): Promise<void> {
    this.child = spawn(this.command, this.args, { stdio: ['pipe', 'pipe', 'pipe'], shell: false, windowsHide: true });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => this.handleChunk(chunk));
    this.child.on('exit', () => {
      for (const pending of this.pending.values()) {
        pending.reject(new Error('ACP stdio transport exited before response.'));
      }
      this.pending.clear();
    });
  }

  public async close(): Promise<void> {
    this.child?.kill();
    this.child = null;
  }

  public request(request: AcpJsonRpcRequest): Promise<AcpJsonRpcResponse> {
    if (!this.child) {
      return Promise.reject(new Error('ACP stdio transport is not open.'));
    }
    const id = request.id || this.nextId++;
    const message = { ...request, id };
    const childRef = this.child;
    return new Promise((resolveResponse, reject) => {
      this.pending.set(id, { resolve: resolveResponse, reject });
      childRef.stdin.write(`${JSON.stringify(message)}\n`, 'utf8');
      setTimeout(() => {
        if (this.pending.delete(id)) {
          // Kill the child process on timeout to prevent orphan
          try {
            childRef.kill('SIGTERM');
            setTimeout(() => {
              try { childRef.kill('SIGKILL'); } catch { /* already exited */ }
            }, 2000);
          } catch { /* already exited */ }
          reject(new Error(`ACP stdio transport timed out waiting for ${request.method}.`));
        }
      }, 15000).unref();
    });
  }

  private handleChunk(chunk: string): void {
    for (const line of chunk.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean)) {
      try {
        const response = JSON.parse(line) as AcpJsonRpcResponse;
        if (response.method === 'client:requestElevatedApproval') {
          void this.handleElevatedApproval(response as unknown as AcpElevatedApprovalRequest);
          continue;
        }
        if (response.id !== undefined && response.id !== null && this.pending.has(response.id)) {
          this.pending.get(response.id)?.resolve(response);
          this.pending.delete(response.id);
        }
      } catch (error: any) {
      // Ignore non-JSON diagnostic output from third-party ACP servers.
      logger.warn('[Acp Live Session] delete operation failed', error);
    }
    }
  }

  private async handleElevatedApproval(request: AcpElevatedApprovalRequest): Promise<void> {
    const requestId = request.id ?? randomUUID();
    const params = request.params || {};
    const type = params.type || 'N/A';
    const message = params.message || 'No message provided.';
    const approved = await askElevatedApproval(requestId, type, message, params.metadata);
    const response = {
      jsonrpc: '2.0',
      id: requestId,
      result: {
        approved
      }
    };
    this.child?.stdin.write(JSON.stringify(response) + '\n', 'utf8');
  }
}

function jsonRpc(method: string, params?: Record<string, unknown>): AcpJsonRpcRequest {
  return { jsonrpc: '2.0', id: randomUUID(), method, params };
}

function extractMessageEvents(response: AcpJsonRpcResponse): Record<string, unknown>[] {
  const result = response.result as Record<string, unknown> | undefined;
  const events = result?.events;
  return Array.isArray(events) ? events.filter((event): event is Record<string, unknown> => Boolean(event) && typeof event === 'object') : [];
}

function summarizeResponse(response: AcpJsonRpcResponse): Record<string, unknown> {
  const result = response.result;
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    return sanitizeObject(result as Record<string, unknown>) || {};
  }
  return {};
}

function sanitizeObject(input?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!input) return undefined;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (/key|token|secret|password|authorization/i.test(key)) {
      output[key] = '[redacted]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (typeof value === 'string') {
      output[key] = sanitizeText(value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex');
}

function parseList(value: unknown): string[] {
  return String(value || '').split(/[,\n;]/).map((entry) => entry.trim()).filter(Boolean);
}

function extractAcpNotificationText(notification: SessionNotification): string {
  const update = notification.update;
  if (!update || typeof update !== 'object' || !('sessionUpdate' in update)) return '';
  const sessionUpdate = String(update.sessionUpdate || '');
  if (sessionUpdate !== 'agent_message_chunk') return '';
  const content = (update as { content?: { type?: string; text?: string } }).content;
  return content?.type === 'text' ? String(content.text || '') : '';
}

function extractAcpUpdateKind(notification: SessionNotification): string {
  const update = notification.update;
  if (!update || typeof update !== 'object' || !('sessionUpdate' in update)) return 'unknown';
  return String(update.sessionUpdate || 'unknown');
}

function extractAcpPermissionToolName(request: RequestPermissionRequest): string {
  const record = request as unknown as Record<string, unknown>;
  const toolCall = record.toolCall as Record<string, unknown> | undefined;
  return String(record.toolName || toolCall?.name || record.title || 'unknown').trim();
}

function sanitizeText(value: string): string {
  return String(value || '')
    .replace(/\b(sk-[A-Za-z0-9_-]{12,})\b/g, 'sk-[redacted]')
    .replace(/\b(xox[baprs]-[A-Za-z0-9-]{12,})\b/g, 'xox-[redacted]')
    .replace(/\b(gh[pousr]_[A-Za-z0-9_]{12,})\b/g, 'gh_[redacted]')
    .replace(/\b([A-Za-z0-9+/]{40,}={0,2})\b/g, '[redacted-secret-like-token]')
    .replace(/\b([A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL|AUTHORIZATION)[A-Z0-9_]*)\s*[:=]\s*([^\s"'`,;]+)/gi, '$1=[redacted]')
    .slice(0, 2000);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    timeout.unref?.();
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function isInsideDirectory(candidate: string, root: string): boolean {
  const rel = relativePath(root, candidate);
  return Boolean(rel) && !rel.startsWith('..') && !isAbsolute(rel);
}
