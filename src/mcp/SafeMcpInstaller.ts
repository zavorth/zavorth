import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { McpSecurityGuard, type McpRiskAssessment, type McpSecurityInput } from './McpSecurityGuard.js';
import type { McpServerManifestEntry } from './McpManifest.js';
import type { McpToolPolicyDocument } from './McpToolPolicy.js';
import { asErrorLike } from '../utils/errorLike.js';

export type McpDiscoveredToolRisk = 'safe' | 'attention' | 'high' | 'critical' | 'unknown';

export type McpDiscoveredTool = {
  name: string;
  description?: string;
  inputSchema?: unknown;
  risk?: McpDiscoveredToolRisk;
};

export type McpDiscoverySandboxEvidence = {
  cwd: string;
  restrictedEnv: boolean;
  timeoutMs: number;
  killedOnTimeout: boolean;
};

export type McpDiscoveryResult = {
  ok: boolean;
  tools: McpDiscoveredTool[];
  stdout?: string;
  stderr?: string;
  error?: string;
  sandbox: McpDiscoverySandboxEvidence;
};

export type McpDiscoveryRequest = {
  serverId: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  allowedEnv?: string[];
  timeoutMs?: number;
};

export type McpDiscoveryRunnerRequest = {
  serverId: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
  timeoutMs: number;
};

export type McpDiscoveryRunner = (
  request: McpDiscoveryRunnerRequest,
) => Promise<Omit<McpDiscoveryResult, 'sandbox'>>;

export type McpInstallRequest = {
  id: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  allowedEnv?: string[];
  capability?: string;
  source?: McpSecurityInput['source'];
  confirmInstall?: boolean;
  confirmRisk?: boolean;
  timeoutMs?: number;
};

export type McpInstallToolReceipt = {
  namespacedToolId: string;
  serverId: string;
  toolName: string;
  fingerprint: string;
  status: 'pending_approval' | 'approved' | 'blocked';
  approvalRequired: boolean;
  risk: McpDiscoveredToolRisk;
  pendingReason: 'new_tool' | 'schema_drift';
};

export type McpInstallResult = {
  ok: boolean;
  state: 'blocked' | 'failed' | 'installed_pending_tool_approval';
  serverId: string;
  risk: McpRiskAssessment;
  discoveryStarted: boolean;
  discovery: McpDiscoveryResult | null;
  tools: McpInstallToolReceipt[];
  errors: string[];
  summary: string;
};

type McpManifestStore = {
  list: () => McpServerManifestEntry[];
  save: (manifest: McpServerManifestEntry[]) => void;
};

type McpPolicyStore = {
  read: () => McpToolPolicyDocument;
  save: (policy: McpToolPolicyDocument) => void;
};

type McpAuditSink = {
  write: (record: Record<string, unknown>) => void | Promise<void>;
};

export type SafeMcpInstallerRuntime = {
  now?: () => Date;
  securityGuard?: McpSecurityGuard;
  manifestStore: McpManifestStore;
  policyStore: McpPolicyStore;
  discovery: Pick<McpDiscoverySandbox, 'discover'>;
  auditSink: McpAuditSink;
};

const FORBIDDEN_SECRET_PATTERNS = [
  /Authorization\s*[:=]?\s*[^\s,;]*/gi,
  /Bearer\s+[^\s,;]*/gi,
  /apiKey\s*=\s*[^\s,;]*/gi,
  /raw-[A-Za-z0-9_-]+/gi,
  /Authorization/gi,
  /Bearer/gi,
  /secretRef/gi,
  /apiKey/gi,
  /rawKey/gi,
  /ciphertext/gi,
  /authTag/gi,
  /BEGIN PRIVATE KEY/gi,
  /OPENAI_API_KEY/gi,
  /ANTHROPIC_API_KEY/gi,
  /GOOGLE_API_KEY/gi,
  /sk-[A-Za-z0-9_-]+/g,
  /\bsecret\b/gi,
];

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalStringify(record[key])}`).join(',')}}`;
}

export function sanitizeMcpInstallText(input: unknown): string {
  let text = String(input ?? '');
  for (const pattern of FORBIDDEN_SECRET_PATTERNS) {
    text = text.replace(pattern, '[REDACTED]');
  }
  text = text.replace(/([A-Za-z0-9_]*KEY[A-Za-z0-9_]*=)[^\s,;]+/gi, '$1[REDACTED]');
  return text;
}

function sanitizeRecord<T>(value: T): T {
  if (typeof value === 'string') return sanitizeMcpInstallText(value) as T;
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeRecord(item)) as T;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      sanitizeMcpInstallText(key),
      sanitizeRecord(entry),
    ]),
  ) as T;
}

function normalizeServerId(input: unknown): string {
  return String(input || '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

function normalizeToolName(input: unknown): string {
  return String(input || '').trim();
}

function isSchemaObject(input: unknown): boolean {
  return Boolean(input && typeof input === 'object' && !Array.isArray(input));
}


export class McpDiscoverySandbox {
  private readonly sandboxCwd: string;
  private readonly runner: McpDiscoveryRunner;
  private readonly kill: (serverId: string) => void;

  constructor(runtime: {
    sandboxCwd?: string;
    runner?: McpDiscoveryRunner;
    kill?: (serverId: string) => void;
  } = {}) {
    this.sandboxCwd = path.resolve(runtime.sandboxCwd || path.join(os.tmpdir(), 'zavorth-mcp-discovery-sandbox'));
    this.runner = runtime.runner || (async () => ({
      ok: false,
      tools: [],
      stdout: '',
      stderr: '',
      error: 'No MCP discovery runner configured.',
    }));
    this.kill = runtime.kill || (() => {});
  }

  public async discover(input: McpDiscoveryRequest): Promise<McpDiscoveryResult> {
    fs.mkdirSync(this.sandboxCwd, { recursive: true });
    const timeoutMs = Math.max(1, Number(input.timeoutMs || 5000));
    const env = this.restrictEnv(input.env || {}, input.allowedEnv || []);
    let timedOut = false;
    const timeout = new Promise<Omit<McpDiscoveryResult, 'sandbox'>>((resolve) => {
      setTimeout(() => {
        timedOut = true;
        this.kill(input.serverId);
        resolve({
          ok: false,
          tools: [],
          stdout: '',
          stderr: '',
          error: `MCP discovery timed out after ${timeoutMs}ms.`,
        });
      }, timeoutMs);
    });
    const runnerResult = this.runner({
      serverId: input.serverId,
      command: input.command,
      args: input.args || [],
      env,
      cwd: this.sandboxCwd,
      timeoutMs,
    });
    const result = await Promise.race([runnerResult, timeout]);
    return {
      ...sanitizeRecord(result),
      tools: Array.isArray(result.tools) ? result.tools : [],
      sandbox: {
        cwd: this.sandboxCwd,
        restrictedEnv: true,
        timeoutMs,
        killedOnTimeout: timedOut,
      },
    };
  }

  private restrictEnv(input: Record<string, string>, allowedEnv: string[]): Record<string, string> {
    const allowed = new Set(allowedEnv.map((entry) => String(entry || '').trim()).filter(Boolean));
    return Object.fromEntries(Object.entries(input).filter(([key]) => allowed.has(key)));
  }
}

export class SafeMcpInstaller {
  private readonly now: () => Date;
  private readonly securityGuard: McpSecurityGuard;

  constructor(private readonly runtime: SafeMcpInstallerRuntime) {
    this.now = runtime.now || (() => new Date());
    this.securityGuard = runtime.securityGuard || new McpSecurityGuard();
  }

  public static computeToolFingerprint(serverId: string, toolName: string, inputSchema: unknown): string {
    return crypto.createHash('sha256').update(canonicalStringify({
      serverId,
      toolName,
      inputSchema: inputSchema || {},
    })).digest('hex');
  }

  public async install(request: McpInstallRequest): Promise<McpInstallResult> {
    const serverId = normalizeServerId(request.id);
    const risk = this.securityGuard.assess({
      id: serverId,
      command: request.command,
      args: request.args || [],
      env: request.env || {},
      capability: request.capability,
      source: request.source || 'user',
    });

    if (!request.confirmInstall) {
      return this.blocked(serverId, risk, false, 'Server install consent is required before discovery.');
    }
    if ((risk.riskLevel === 'high' || risk.riskLevel === 'critical') && !request.confirmRisk) {
      return this.blocked(serverId, risk, false, `${risk.riskLevel} risk confirmation is required before discovery.`);
    }
    if (risk.blocked && !request.confirmRisk) {
      return this.blocked(serverId, risk, false, 'Critical risk install input is blocked without explicit confirmation.');
    }

    const discovery = await this.runtime.discovery.discover({
      serverId,
      command: request.command,
      args: request.args || [],
      env: request.env || {},
      allowedEnv: request.allowedEnv || [],
      timeoutMs: request.timeoutMs,
    });

    if (!discovery.ok) {
      return this.failed(serverId, risk, discovery, sanitizeMcpInstallText(discovery.error || 'MCP discovery failed.'));
    }

    const invalidTool = discovery.tools.find((tool) => !normalizeToolName(tool.name) || !isSchemaObject(tool.inputSchema || {}));
    if (invalidTool) {
      return this.failed(serverId, risk, discovery, `Invalid tool schema for ${sanitizeMcpInstallText(invalidTool.name)}.`);
    }
    const seenToolIds = new Set<string>();
    for (const tool of discovery.tools) {
      const namespacedToolId = `${serverId}:${normalizeToolName(tool.name)}`;
      if (seenToolIds.has(namespacedToolId)) {
        return this.failed(serverId, risk, discovery, `Namespace collision detected for ${namespacedToolId}.`);
      }
      seenToolIds.add(namespacedToolId);
    }

    const existingManifest = this.runtime.manifestStore.list();
    const nextManifest = existingManifest.filter((entry) => normalizeServerId(entry.id) !== serverId);
    nextManifest.push({
      id: serverId,
      command: request.command,
      args: request.args || [],
      env: {},
      allowedEnv: request.allowedEnv || [],
      capability: request.capability,
      enabled: false,
    });

    const policy = this.runtime.policyStore.read();
    const nextPolicy: McpToolPolicyDocument = {
      ...policy,
      allowlist: [...(policy.allowlist || [])],
      tools: { ...(policy.tools || {}) },
      updatedAt: this.now().toISOString(),
    };
    const toolReceipts = discovery.tools.map((tool) => this.prepareTool(serverId, tool, nextPolicy));

    try {
      await this.writeAudit({
        event: 'safe_mcp_install_prepared',
        serverId,
        risk,
        discovery: {
          ok: discovery.ok,
          stdout: discovery.stdout,
          stderr: discovery.stderr,
          sandbox: discovery.sandbox,
        },
        tools: toolReceipts,
      });
      this.runtime.manifestStore.save(nextManifest);
      this.runtime.policyStore.save(nextPolicy);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      return this.failed(serverId, risk, discovery, `Audit or persistence failed: ${sanitizeMcpInstallText(error instanceof Error ? err.message : String(error))}.`);
    }

    return sanitizeRecord({
      ok: true,
      state: 'installed_pending_tool_approval',
      serverId,
      risk,
      discoveryStarted: true,
      discovery,
      tools: toolReceipts,
      errors: [],
      summary: `MCP server ${serverId} installed disabled; ${toolReceipts.length} tool(s) pending approval.`,
    });
  }

  private prepareTool(
    serverId: string,
    tool: McpDiscoveredTool,
    policy: McpToolPolicyDocument,
  ): McpInstallToolReceipt {
    const toolName = normalizeToolName(tool.name);
    const namespacedToolId = `${serverId}:${toolName}`;
    const fingerprint = SafeMcpInstaller.computeToolFingerprint(serverId, toolName, tool.inputSchema || {});
    const existing = policy.tools?.[namespacedToolId];
    const drifted = Boolean(existing?.status === 'approved' && existing.fingerprint !== fingerprint);
    policy.allowlist = (policy.allowlist || []).filter((entry) => entry !== namespacedToolId);
    policy.tools = policy.tools || {};
    policy.tools[namespacedToolId] = {
      status: 'pending_approval',
      fingerprint,
      description: existing?.description,
      lastSeenDescription: tool.description || existing?.lastSeenDescription,
      lastSeenAt: this.now().toISOString(),
      pendingReason: drifted ? 'schema_drift' : 'new_tool',
    };
    const risk = tool.risk || 'unknown';
    return {
      namespacedToolId,
      serverId,
      toolName,
      fingerprint,
      status: 'pending_approval',
      approvalRequired: true,
      risk,
      pendingReason: drifted ? 'schema_drift' : 'new_tool',
    };
  }

  private async writeAudit(record: Record<string, unknown>): Promise<void> {
    await this.runtime.auditSink.write(sanitizeRecord(record));
  }

  private blocked(serverId: string, risk: McpRiskAssessment, discoveryStarted: boolean, error: string): McpInstallResult {
    return sanitizeRecord({
      ok: false,
      state: 'blocked',
      serverId,
      risk,
      discoveryStarted,
      discovery: null,
      tools: [],
      errors: [error],
      summary: `Safe MCP install blocked for ${serverId}.`,
    });
  }

  private failed(serverId: string, risk: McpRiskAssessment, discovery: McpDiscoveryResult, error: string): McpInstallResult {
    return sanitizeRecord({
      ok: false,
      state: 'failed',
      serverId,
      risk,
      discoveryStarted: true,
      discovery,
      tools: [],
      errors: [error],
      summary: `Safe MCP install failed for ${serverId}.`,
    });
  }
}
