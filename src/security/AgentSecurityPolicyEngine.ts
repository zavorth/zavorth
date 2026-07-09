import {
  resolveSecurityProfile,
  resolveSecurityProfileConfirmationRequirement,
  resolveSecurityProfileDeniedCapabilities,
  type SecurityProfileId,
} from './SecurityProfile.js';

export type AgentToolCapability =
  | 'browser'
  | 'configuration'
  | 'credential'
  | 'credential_or_config'
  | 'desktop'
  | 'destructive'
  | 'audit'
  | 'encryption'
  | 'external-send'
  | 'filesystem'
  | 'local-observation'
  | 'mcp'
  | 'memory'
  | 'network'
  | 'plugin'
  | 'rag'
  | 'sandbox'
  | 'shell'
  | 'skill'
  | 'telegram'
  | 'untrusted-input'
  | 'webhook'
  | 'unknown';

export type AgentSecuritySurface =
  | 'native-tool'
  | 'mcp-tool'
  | 'telegram'
  | 'webhook'
  | 'rag'
  | 'skill'
  | 'plugin'
  | 'runtime-adapter'
  | 'runtime'
  | 'service'
  | 'unknown';

export type AgentRiskLevel = 'safe' | 'review' | 'dangerous' | 'forbidden';

export type AgentPolicyAction = 'allow' | 'require_confirmation' | 'deny';

export type AgentInputTrust =
  | 'trusted-system'
  | 'trusted-user'
  | 'trusted-runtime'
  | 'untrusted-content'
  | 'unknown';

export type AgentToolSecurityDefinition = {
  toolName: string;
  surface: AgentSecuritySurface;
  capabilities: AgentToolCapability[];
  defaultRisk: AgentRiskLevel;
  requiresConfirmation: boolean;
  canExfiltrateData?: boolean;
  canExecuteCode?: boolean;
  canMutateHost?: boolean;
  description: string;
  source?: 'explicit' | 'inferred' | 'fallback';
};

export type AgentToolInvocation = {
  toolName: string;
  operation?: string;
  sourceTrust?: AgentInputTrust;
  securityProfile?: SecurityProfileId | string;
  userConfirmed?: boolean;
  requestedCapabilities?: AgentToolCapability[];
  metadata?: Record<string, unknown>;
};

export type AgentPolicyDecision = {
  action: AgentPolicyAction;
  allowed: boolean;
  risk: AgentRiskLevel;
  toolName: string;
  surface: AgentSecuritySurface;
  capabilities: AgentToolCapability[];
  securityProfile?: {
    id: SecurityProfileId;
    label: string;
    source: string;
  };
  requiresConfirmation: boolean;
  reasons: string[];
  rule: string;
};

export const AGENT_SECURITY_DECISION_MATRIX: Record<AgentRiskLevel, AgentPolicyAction> = {
  safe: 'allow',
  review: 'require_confirmation',
  dangerous: 'require_confirmation',
  forbidden: 'deny',
};

const RISK_RANK: Record<AgentRiskLevel, number> = {
  safe: 0,
  review: 1,
  dangerous: 2,
  forbidden: 3,
};

const HIGH_RISK_UNTRUSTED_CAPABILITIES = new Set<AgentToolCapability>([
  'configuration',
  'credential',
  'desktop',
  'destructive',
  'external-send',
  'filesystem',
  'browser',
  'memory',
  'mcp',
  'plugin',
  'shell',
  'skill',
  'webhook',
]);

function normalizeToolName(toolName: string): string {
  return String(toolName || '').trim().toLowerCase();
}

function uniqueCapabilities(capabilities: AgentToolCapability[]): AgentToolCapability[] {
  return Array.from(new Set(capabilities.filter(Boolean))).sort();
}

function maxRisk(a: AgentRiskLevel, b: AgentRiskLevel): AgentRiskLevel {
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
}

function normalizeRisk(value: unknown): AgentRiskLevel {
  if (value === 'safe' || value === 'review' || value === 'dangerous' || value === 'forbidden') {
    return value;
  }

  return 'forbidden';
}

export function inferAgentToolCanExfiltrateData(capabilities: AgentToolCapability[]): boolean {
  return capabilities.some((capability) =>
    capability === 'credential'
    || capability === 'external-send'
    || capability === 'mcp'
    || capability === 'network'
    || capability === 'plugin'
    || capability === 'telegram'
    || capability === 'webhook',
  );
}

export function inferAgentToolCanExecuteCode(capabilities: AgentToolCapability[]): boolean {
  return capabilities.some((capability) =>
    capability === 'plugin'
    || capability === 'sandbox'
    || capability === 'shell',
  );
}

export function inferAgentToolCanMutateHost(capabilities: AgentToolCapability[]): boolean {
  return capabilities.some((capability) =>
    capability === 'configuration'
    || capability === 'credential'
    || capability === 'desktop'
    || capability === 'destructive'
    || capability === 'filesystem'
    || capability === 'memory'
    || capability === 'shell'
    || capability === 'skill',
  );
}

export function normalizeAgentToolSecurityDefinition(
  definition: AgentToolSecurityDefinition,
): AgentToolSecurityDefinition {
  const capabilities = uniqueCapabilities(definition.capabilities || []);
  return {
    ...definition,
    toolName: String(definition.toolName || '').trim(),
    surface: definition.surface || 'unknown',
    capabilities,
    defaultRisk: normalizeRisk(definition.defaultRisk),
    requiresConfirmation: Boolean(definition.requiresConfirmation),
    canExfiltrateData: definition.canExfiltrateData ?? inferAgentToolCanExfiltrateData(capabilities),
    canExecuteCode: definition.canExecuteCode ?? inferAgentToolCanExecuteCode(capabilities),
    canMutateHost: definition.canMutateHost ?? inferAgentToolCanMutateHost(capabilities),
    description: String(definition.description || '').trim(),
    source: definition.source || 'explicit',
  };
}

export class AgentSecurityPolicyEngine {
  private readonly definitions = new Map<string, AgentToolSecurityDefinition>();

  public constructor(definitions: AgentToolSecurityDefinition[] = []) {
    for (const definition of definitions) {
      this.registerTool(definition);
    }
  }

  public static fromDefinitions(definitions: AgentToolSecurityDefinition[]): AgentSecurityPolicyEngine {
    return new AgentSecurityPolicyEngine(definitions);
  }

  public registerTool(definition: AgentToolSecurityDefinition): void {
    const normalized = normalizeAgentToolSecurityDefinition(definition);
    const key = normalizeToolName(normalized.toolName);
    if (!key) {
      return;
    }

    this.definitions.set(key, normalized);
  }

  public getToolDefinition(toolName: string): AgentToolSecurityDefinition | null {
    return this.definitions.get(normalizeToolName(toolName)) || null;
  }

  public listToolDefinitions(): AgentToolSecurityDefinition[] {
    return Array.from(this.definitions.values()).map((definition) => ({
      ...definition,
      capabilities: [...definition.capabilities],
    }));
  }

  public evaluateToolInvocation(invocation: AgentToolInvocation): AgentPolicyDecision {
    const toolName = String(invocation.toolName || '').trim();
    const securityProfile = resolveSecurityProfile({
      profile: invocation.securityProfile,
      metadata: invocation.metadata,
    });
    const definition = this.getToolDefinition(toolName);
    
    let isPredictiveSafe = false;
    const command = (invocation.metadata?.command || invocation.metadata?.args || '') as string;
    if (command) {
      const lowerCmd = command.trim().toLowerCase();
      // Block shell command chaining/injection characters
      const hasInjection = /[;&|\n\r`$]/.test(command);
      if (!hasInjection) {
        const readOnlyGitPatterns = /^(git\s+(status|diff|log|show|branch|rev-parse|tag|remote|config\s+-l))/;
        const readOnlySysPatterns = /^(ls|dir|pwd|cat|type|echo)\b/;
        const lintCheckPatterns = /^(eslint|prettier\s+--check|tsc\s+--noemit)/;
        
        if (readOnlyGitPatterns.test(lowerCmd) || readOnlySysPatterns.test(lowerCmd) || lintCheckPatterns.test(lowerCmd)) {
          isPredictiveSafe = true;
        }
      }
    }

    if (definition && (definition.surface === 'rag' || definition.toolName === 'workspace.files.read' || definition.toolName === 'workspace.files.list')) {
      isPredictiveSafe = true;
    }
    
    if (!toolName || !definition) {
      return this.deny({
        toolName: toolName || '<missing>',
        surface: 'unknown',
        capabilities: ['unknown'],
        risk: 'forbidden',
        rule: 'UNKNOWN_TOOL_DEFAULT_DENY',
        reasons: ['Tool has no security definition; default deny applies.'],
        securityProfile,
      });
    }

    const capabilities = uniqueCapabilities([
      ...definition.capabilities,
      ...(invocation.requestedCapabilities || []),
    ]);

    if (capabilities.length === 0) {
      return this.deny({
        toolName: definition.toolName,
        surface: definition.surface,
        capabilities: ['unknown'],
        risk: 'forbidden',
        rule: 'MISSING_CAPABILITY_DECLARATION',
        reasons: ['Tool has no declared capabilities; default deny applies.'],
        securityProfile,
      });
    }

    const deniedByProfile = resolveSecurityProfileDeniedCapabilities(securityProfile.profile, capabilities);
    if (deniedByProfile.length > 0) {
      return this.deny({
        toolName: definition.toolName,
        surface: definition.surface,
        capabilities,
        risk: 'forbidden',
        rule: 'SECURITY_PROFILE_DENY',
        reasons: [
          `Security profile ${securityProfile.profile.id} denies capability: ${deniedByProfile.join(', ')}.`,
        ],
        securityProfile,
      });
    }

    const sourceTrust = invocation.sourceTrust || 'unknown';
    if (sourceTrust === 'untrusted-content') {
      const forbiddenCapabilities = capabilities.filter((capability) =>
        HIGH_RISK_UNTRUSTED_CAPABILITIES.has(capability),
      );

      if (forbiddenCapabilities.length > 0) {
        return this.deny({
          toolName: definition.toolName,
          surface: definition.surface,
          capabilities,
          risk: 'forbidden',
          rule: 'UNTRUSTED_CONTENT_HIGH_RISK_TOOL',
          reasons: [
            `Untrusted content cannot trigger high-risk capabilities: ${forbiddenCapabilities.join(', ')}.`,
          ],
          securityProfile,
        });
      }
    }

    const risk = definition.defaultRisk;
    if (risk === 'forbidden' || AGENT_SECURITY_DECISION_MATRIX[risk] === 'deny') {
      return this.deny({
        toolName: definition.toolName,
        surface: definition.surface,
        capabilities,
        risk: 'forbidden',
        rule: 'FORBIDDEN_TOOL',
        reasons: ['Tool is classified as forbidden by the security catalog.'],
        securityProfile,
      });
    }

    const profileConfirmation = resolveSecurityProfileConfirmationRequirement(
      securityProfile.profile,
      capabilities,
      definition,
    );
    let requiresConfirmation =
      definition.requiresConfirmation ||
      AGENT_SECURITY_DECISION_MATRIX[risk] === 'require_confirmation' ||
      profileConfirmation.required;

    if (isPredictiveSafe) {
      requiresConfirmation = false;
    }

    if (requiresConfirmation && !invocation.userConfirmed) {
      return {
        action: 'require_confirmation',
        allowed: false,
        risk: maxRisk(risk, 'review'),
        toolName: definition.toolName,
        surface: definition.surface,
        capabilities,
        securityProfile: {
          id: securityProfile.profile.id,
          label: securityProfile.profile.label,
          source: securityProfile.source,
        },
        requiresConfirmation: true,
        rule: 'CONFIRMATION_REQUIRED',
        reasons: [
          `Tool risk is ${risk}.`,
          ...profileConfirmation.reasons,
          'Human or upstream policy confirmation is required before execution.',
        ],
      };
    }

    return {
      action: 'allow',
      allowed: true,
      risk,
      toolName: definition.toolName,
      surface: definition.surface,
      capabilities,
      securityProfile: {
        id: securityProfile.profile.id,
        label: securityProfile.profile.label,
        source: securityProfile.source,
      },
      requiresConfirmation,
      rule: invocation.userConfirmed && requiresConfirmation ? 'CONFIRMED_ALLOW' : 'SAFE_ALLOW',
      reasons: requiresConfirmation
        ? ['Confirmation was supplied by the caller policy context.']
        : ['Tool is classified as safe for direct execution.'],
    };
  }

  private deny(input: {
    toolName: string;
    surface: AgentSecuritySurface;
    capabilities: AgentToolCapability[];
    risk: AgentRiskLevel;
    rule: string;
    reasons: string[];
    securityProfile?: ReturnType<typeof resolveSecurityProfile>;
  }): AgentPolicyDecision {
    return {
      action: 'deny',
      allowed: false,
      risk: input.risk,
      toolName: input.toolName,
      surface: input.surface,
      capabilities: uniqueCapabilities(input.capabilities),
      securityProfile: input.securityProfile
        ? {
            id: input.securityProfile.profile.id,
            label: input.securityProfile.profile.label,
            source: input.securityProfile.source,
          }
        : undefined,
      requiresConfirmation: false,
      rule: input.rule,
      reasons: input.reasons,
    };
  }
}
