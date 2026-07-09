import { spawn } from 'child_process';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import type { AgentMeshDynamicCapabilities, AgentMeshProtocol } from '../contracts/AgentMeshConsentContract.js';
import type { AgentMeshExecutionRequest } from '../contracts/AgentMeshExecutionContract.js';
import { sanitizeAgentMeshText } from './AgentMeshRedactionService.js';

export type AgentMeshDriverHandshake = {
  capabilities: AgentMeshDynamicCapabilities;
};

export type AgentMeshDriverExecution = {
  summary: string;
  toolCallsMade: number;
  partial?: boolean;
};

export type AgentMeshDriverContext = {
  bridgeId: string;
  protocol: AgentMeshProtocol;
  connectionRef: string;
  connectionLabel: string;
  connectionValue: string | null;
};

export interface AgentMeshProtocolDriver {
  readonly protocol: AgentMeshProtocol;
  handshake(context: AgentMeshDriverContext): Promise<AgentMeshDriverHandshake>;
  execute(context: AgentMeshDriverContext, request: AgentMeshExecutionRequest): Promise<AgentMeshDriverExecution>;
}

export class AgentMeshDriverUnavailableException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentMeshDriverUnavailableException';
  }
}

export class AgentMeshDriverRegistryService {
  private readonly drivers: Map<AgentMeshProtocol, AgentMeshProtocolDriver> = new Map();

  constructor(drivers: AgentMeshProtocolDriver[] = createDefaultAgentMeshDrivers()) {
    for (const driver of drivers) {
      this.register(driver);
    }
  }

  public register(driver: AgentMeshProtocolDriver): void {
    this.drivers.set(driver.protocol, driver);
  }

  public has(protocol: AgentMeshProtocol): boolean {
    return this.drivers.has(protocol);
  }

  public async handshake(context: AgentMeshDriverContext): Promise<AgentMeshDriverHandshake> {
    return this.get(context.protocol).handshake(context);
  }

  public async execute(
    context: AgentMeshDriverContext,
    request: AgentMeshExecutionRequest,
  ): Promise<AgentMeshDriverExecution> {
    return this.get(context.protocol).execute(context, request);
  }

  private get(protocol: AgentMeshProtocol): AgentMeshProtocolDriver {
    const driver = this.drivers.get(protocol);
    if (!driver) {
      throw new AgentMeshDriverUnavailableException(`No Agent Mesh driver registered for protocol: ${protocol}`);
    }
    return driver;
  }
}

class WebhookAgentMeshDriver implements AgentMeshProtocolDriver {
  public readonly protocol: AgentMeshProtocol = 'webhook';

  public async handshake(context: AgentMeshDriverContext): Promise<AgentMeshDriverHandshake> {
    const response = await postJson(context.connectionValue, {
      type: 'agent_mesh.handshake',
      bridgeId: context.bridgeId,
      protocol: context.protocol,
    }, 5000);
    return {
      capabilities: normalizeCapabilities(response, context.protocol, 'driver-handshake'),
    };
  }

  public async execute(
    context: AgentMeshDriverContext,
    request: AgentMeshExecutionRequest,
  ): Promise<AgentMeshDriverExecution> {
    const response = await postJson(context.connectionValue, {
      type: 'agent_mesh.execute',
      bridgeId: context.bridgeId,
      request: sanitizeExecutionRequest(request),
    }, request.budget.maxExecutionTimeMs);
    return normalizeExecution(response);
  }
}

class CliAgentMeshDriver implements AgentMeshProtocolDriver {
  public readonly protocol: AgentMeshProtocol = 'cli-wrapper';

  public async handshake(context: AgentMeshDriverContext): Promise<AgentMeshDriverHandshake> {
    const response = await runAgentMeshCommand(context.connectionValue, ['agent-mesh', 'handshake'], 5000);
    return {
      capabilities: normalizeCapabilities(parseJsonOutput(response), context.protocol, 'driver-handshake'),
    };
  }

  public async execute(
    context: AgentMeshDriverContext,
    request: AgentMeshExecutionRequest,
  ): Promise<AgentMeshDriverExecution> {
    const response = await runAgentMeshCommand(
      context.connectionValue,
      ['agent-mesh', 'execute'],
      request.budget.maxExecutionTimeMs,
      JSON.stringify(sanitizeExecutionRequest(request)),
    );
    return normalizeExecution(parseJsonOutput(response));
  }
}

class StdioAgentMeshDriver extends CliAgentMeshDriver {
  public override readonly protocol: AgentMeshProtocol = 'stdio';
}

class McpAgentMeshDriver implements AgentMeshProtocolDriver {
  public readonly protocol: AgentMeshProtocol = 'mcp';

  public async handshake(context: AgentMeshDriverContext): Promise<AgentMeshDriverHandshake> {
    const response = await runAgentMeshCommand(context.connectionValue, ['mcp', 'tools/list'], 5000);
    const parsed = parseJsonOutput(response);
    const tools = Array.isArray(parsed?.tools)
      ? parsed.tools.map((tool: any) => sanitizeAgentMeshText(tool?.name || tool?.id || 'tool')).filter(Boolean)
      : [];
    return {
      capabilities: {
        reportedToolCount: tools.length,
        reportedChannelCount: 0,
        primaryDomain: sanitizeAgentMeshText(parsed?.primaryDomain || 'mcp-tools'),
        discoveredTools: tools,
        supportedProtocols: ['mcp'],
        supportsDryRun: Boolean(parsed?.supportsDryRun ?? true),
        supportsCancellation: Boolean(parsed?.supportsCancellation ?? false),
        discoverySource: 'driver-handshake',
        driverStatus: 'available',
      },
    };
  }

  public async execute(
    context: AgentMeshDriverContext,
    request: AgentMeshExecutionRequest,
  ): Promise<AgentMeshDriverExecution> {
    const response = await runAgentMeshCommand(
      context.connectionValue,
      ['mcp', 'call'],
      request.budget.maxExecutionTimeMs,
      JSON.stringify(sanitizeExecutionRequest(request)),
    );
    return normalizeExecution(parseJsonOutput(response));
  }
}

function createDefaultAgentMeshDrivers(): AgentMeshProtocolDriver[] {
  return [
    new WebhookAgentMeshDriver(),
    new CliAgentMeshDriver(),
    new StdioAgentMeshDriver(),
    new McpAgentMeshDriver(),
  ];
}

function normalizeCapabilities(
  value: any,
  protocol: AgentMeshProtocol,
  discoverySource: AgentMeshDynamicCapabilities['discoverySource'],
): AgentMeshDynamicCapabilities {
  const capabilities = value?.capabilities || value || {};
  const discoveredTools = Array.isArray(capabilities.discoveredTools)
    ? capabilities.discoveredTools.map((tool: unknown) => sanitizeAgentMeshText(tool)).filter(Boolean)
    : [];
  return {
    reportedToolCount: Number(capabilities.reportedToolCount ?? discoveredTools.length ?? 0),
    reportedChannelCount: Number(capabilities.reportedChannelCount ?? 0),
    primaryDomain: sanitizeAgentMeshText(capabilities.primaryDomain || 'runtime-adapter'),
    discoveredTools,
    supportedProtocols: normalizeProtocols(capabilities.supportedProtocols, protocol),
    supportsDryRun: Boolean(capabilities.supportsDryRun ?? true),
    supportsCancellation: Boolean(capabilities.supportsCancellation ?? false),
    discoverySource,
    driverStatus: 'available',
  };
}

function normalizeExecution(value: any): AgentMeshDriverExecution {
  return {
    summary: sanitizeAgentMeshText(value?.summary || value?.finalResponseSummary || 'runtime adapter execution completed.'),
    toolCallsMade: Math.max(0, Number(value?.toolCallsMade ?? value?.metrics?.toolCallsMade ?? 1)),
    partial: Boolean(value?.partial),
  };
}

function normalizeProtocols(value: unknown, fallback: AgentMeshProtocol): AgentMeshProtocol[] {
  const allowed = new Set<AgentMeshProtocol>(['mcp', 'cli-wrapper', 'websocket', 'webhook', 'stdio']);
  const protocols = Array.isArray(value)
    ? value.filter((entry): entry is AgentMeshProtocol => allowed.has(entry as AgentMeshProtocol))
    : [];
  return protocols.length > 0 ? protocols : [fallback];
}

function sanitizeExecutionRequest(request: AgentMeshExecutionRequest): AgentMeshExecutionRequest {
  return {
    ...request,
    intent: {
      ...request.intent,
      goal: sanitizeAgentMeshText(request.intent.goal),
      context: sanitizeAgentMeshText(request.intent.context),
      requestedTools: request.intent.requestedTools?.map(sanitizeAgentMeshText),
    },
    secretRefs: Object.fromEntries(
      Object.entries(request.secretRefs || {}).map(([key]) => [sanitizeAgentMeshText(key), 'secret-ref:[redacted]']),
    ),
  };
}

function postJson(urlValue: string | null, payload: unknown, timeoutMs: number): Promise<any> {
  if (!urlValue) {
    throw new AgentMeshDriverUnavailableException('Agent Mesh webhook driver requires a runtime connection value.');
  }
  const url = new URL(urlValue);
  const body = JSON.stringify(payload);
  const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = transport({
      method: 'POST',
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
      timeout: Math.max(1, timeoutMs),
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if ((res.statusCode || 500) >= 400) {
          reject(new Error(`Agent Mesh webhook returned HTTP ${res.statusCode}: ${sanitizeAgentMeshText(text)}`));
          return;
        }
        try {
          resolve(text ? JSON.parse(text) : {});
        } catch (error: any) {
          reject(new Error('Agent Mesh webhook returned invalid JSON.'));
        }
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error('Agent Mesh webhook timed out.'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function runAgentMeshCommand(
  commandValue: string | null,
  args: string[],
  timeoutMs: number,
  stdin?: string,
): Promise<string> {
  if (!commandValue) {
    throw new AgentMeshDriverUnavailableException('Agent Mesh CLI driver requires a runtime command value.');
  }
  const command = commandValue.trim();
  if (!command) {
    throw new AgentMeshDriverUnavailableException('Agent Mesh CLI driver received an empty command.');
  }
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Agent Mesh CLI driver timed out.'));
    }, Math.max(1, timeoutMs));
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Agent Mesh CLI exited with code ${code}: ${sanitizeAgentMeshText(Buffer.concat(stderr).toString('utf8'))}`));
        return;
      }
      resolve(Buffer.concat(stdout).toString('utf8'));
    });
    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
}

function parseJsonOutput(output: string): any {
  try {
    return JSON.parse(output || '{}');
  } catch (error: any) {
    throw new Error('Agent Mesh driver returned invalid JSON.');
  }
}
