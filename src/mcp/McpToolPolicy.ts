import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import {
  decideSecurityPolicy,
  type SecurityPolicyBrokerAction,
  type SecurityPolicyBrokerReceipt,
} from '../security/SecurityPolicyBroker.js';

export type McpSecurityProfile = 'safe' | 'trusted' | 'dangerous';

export type McpToolPolicyDocument = {
  version: number;
  updatedAt: string | null;
  profile: McpSecurityProfile;
  allowlist: string[];
};

export type McpToolPolicyDecision = {
  allowed: boolean;
  profile: McpSecurityProfile;
  reason: string;
  policyAction: SecurityPolicyBrokerAction;
  policyReceipt: SecurityPolicyBrokerReceipt;
};

export const MCP_SAFE_TOOLS = [
  'browser_navigate',
  'get_datetime',
  'inspect_dom_element',
  'list_directory',
  'read_file',
  'semantic_memory',
  'web_search',
] as const;

export const MCP_TRUSTED_TOOLS = [
  ...MCP_SAFE_TOOLS,
  'create_file',
  'query_external_ai',
] as const;

export const MCP_DANGEROUS_TOOLS = [
  ...MCP_TRUSTED_TOOLS,
  'desktop_automation',
  'evaluate_js',
  'remote_shell',
  'run_sandbox_code',
] as const;

const SAFE_TOOLS = new Set(MCP_SAFE_TOOLS);
const TRUSTED_TOOLS = new Set(MCP_TRUSTED_TOOLS);
const DANGEROUS_TOOLS = new Set(MCP_DANGEROUS_TOOLS);
const DEFAULT_POLICY_DOCUMENT: McpToolPolicyDocument = {
  version: 1,
  updatedAt: null,
  profile: 'safe',
  allowlist: [],
};

export class McpToolPolicy {
  public readonly profile: McpSecurityProfile;
  private readonly allowlist: Set<string>;

  constructor(options: { profile?: string; allowlist?: string[] } = {}) {
    this.profile = this.normalizeProfile(options.profile);
    this.allowlist = new Set(
      (options.allowlist || [])
        .map((entry) => this.normalizeToolName(entry))
        .filter(Boolean),
    );
  }

  public static fromEnv(
    env: NodeJS.ProcessEnv = process.env,
    runtime: {
      policyFile?: string;
      existsSync?: typeof fs.existsSync;
      readFileSync?: typeof fs.readFileSync;
    } = {},
  ): McpToolPolicy {
    const document = this.readDocument(runtime.policyFile, runtime);
    return new McpToolPolicy({
      profile: env.ZAVORTH_MCP_PROFILE || env.MCP_PROFILE || document.profile || 'safe',
      allowlist: [
        ...document.allowlist,
        ...String(env.ZAVORTH_MCP_ALLOW_TOOLS || env.MCP_ALLOW_TOOLS || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
      ],
    });
  }

  public static readDocument(
    policyFile = path.join(config.projectRoot, 'config', 'mcp-tool-policy.json'),
    runtime: {
      existsSync?: typeof fs.existsSync;
      readFileSync?: typeof fs.readFileSync;
    } = {},
  ): McpToolPolicyDocument {
    const existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    const readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    try {
      if (!existsSyncImpl(policyFile)) {
        return { ...DEFAULT_POLICY_DOCUMENT };
      }
      const parsed = JSON.parse(readFileSyncImpl(policyFile, 'utf8')) as Partial<McpToolPolicyDocument>;
      const normalized = new McpToolPolicy({
        profile: parsed.profile,
        allowlist: Array.isArray(parsed.allowlist) ? parsed.allowlist : [],
      });
      return {
        version: Number.isFinite(parsed.version) ? Number(parsed.version) : 1,
        updatedAt: typeof parsed.updatedAt === 'string' && parsed.updatedAt.trim()
          ? parsed.updatedAt.trim()
          : null,
        profile: normalized.profile,
        allowlist: normalized.getAllowlist(),
      };
    } catch {
      return { ...DEFAULT_POLICY_DOCUMENT };
    }
  }

  public decide(toolName: string): McpToolPolicyDecision {
    const normalized = this.normalizeToolName(toolName);

    if (this.allowlist.has(normalized)) {
      return this.withBrokerDecision(normalized, {
        allowed: true,
        profile: this.profile,
        reason: `Tool "${normalized}" permitida por allowlist MCP explicita.`,
      });
    }

    const allowedByProfile = this.allowedToolsForProfile(this.profile);
    if (allowedByProfile.has(normalized)) {
      return this.withBrokerDecision(normalized, {
        allowed: true,
        profile: this.profile,
        reason: `Tool "${normalized}" permitida pelo perfil MCP "${this.profile}".`,
      });
    }

    return this.withBrokerDecision(normalized, {
      allowed: false,
      profile: this.profile,
      reason:
        `Tool "${normalized}" bloqueada pelo perfil MCP "${this.profile}". `
        + 'Use ZAVORTH_MCP_PROFILE=trusted|dangerous ou ZAVORTH_MCP_ALLOW_TOOLS para liberar explicitamente.',
    });
  }

  public filterDefinitions<T extends { name: string }>(definitions: T[]): T[] {
    return definitions.filter((definition) => this.decide(definition.name).allowed);
  }

  public describe(): {
    profile: McpSecurityProfile;
    allowlist: string[];
    allowedTools: string[];
    blockedDangerousTools: string[];
  } {
    const allowedTools = Array.from(this.allowedToolsForProfile(this.profile).values()).sort((left, right) =>
      left.localeCompare(right, 'en'),
    );
    const dangerousTools = Array.from(DANGEROUS_TOOLS.values());
    return {
      profile: this.profile,
      allowlist: this.getAllowlist(),
      allowedTools,
      blockedDangerousTools: dangerousTools
        .filter((toolName) => !allowedTools.includes(toolName) && !this.allowlist.has(toolName))
        .sort((left, right) => left.localeCompare(right, 'en')),
    };
  }

  public getAllowlist(): string[] {
    return Array.from(this.allowlist.values()).sort((left, right) => left.localeCompare(right, 'en'));
  }

  private allowedToolsForProfile(profile: McpSecurityProfile): Set<string> {
    if (profile === 'dangerous') {
      return DANGEROUS_TOOLS;
    }
    if (profile === 'trusted') {
      return TRUSTED_TOOLS;
    }
    return SAFE_TOOLS;
  }

  private normalizeToolName(name: string): string {
    return String(name || '').trim().toLowerCase();
  }

  private withBrokerDecision(
    toolName: string,
    decision: Omit<McpToolPolicyDecision, 'policyAction' | 'policyReceipt'>,
  ): McpToolPolicyDecision {
    const brokerDecision = decideSecurityPolicy({
      surface: 'mcp',
      operation: 'tool_access',
      target: toolName,
      mcpDecision: decision,
      adminPolicyRequired: !decision.allowed,
      rule: decision.allowed ? 'MCP_TOOL_POLICY_ALLOWED' : 'MCP_ADMIN_POLICY_REQUIRED',
      reasons: [decision.reason],
    });
    return {
      ...decision,
      policyAction: brokerDecision.action,
      policyReceipt: brokerDecision.receipt,
    };
  }

  private normalizeProfile(profile: string | undefined): McpSecurityProfile {
    const normalized = String(profile || 'safe').trim().toLowerCase();
    if (normalized === 'dangerous' || normalized === 'trusted' || normalized === 'safe') {
      return normalized;
    }
    return 'safe';
  }
}
