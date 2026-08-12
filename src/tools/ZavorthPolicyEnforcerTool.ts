
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

interface PolicyRule {
  id: string;
  name: string;
  description: string;
  category: 'tool_access' | 'data_access' | 'network' | 'execution' | 'approval' | 'rate_limit' | 'time_window' | 'content';
  severity: 'info' | 'warning' | 'block';
  condition: string;
  action: 'allow' | 'deny' | 'require_approval' | 'log' | 'throttle';
  enabled: boolean;
}

interface PolicyCheckResult {
  allowed: boolean;
  policy_id: string;
  policy_name: string;
  action: string;
  severity: string;
  reason: string;
  requires_approval: boolean;
  alternative?: string;
}

export class ZavorthPolicyEnforcerTool extends BaseTool {
  public readonly name = 'zavorth_policy_enforcer';

  public readonly description =
    'Checks whether an action is allowed by Zavorth governance policies. Queries EffectPolicyKernel, AgentSecurityPolicyEngine, and custom rules before executing operations. Returns allow/deny/require_approval with justification.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'check', 'list_policies', 'add_policy', 'remove_policy', 'enable_policy', 'disable_policy', 'audit', 'test'.",
      },
      tool_name: {
        type: 'string',
        description: 'Name of the tool to be checked.',
      },
      tool_args: {
        type: 'string',
        description: 'JSON with the arguments that would be passed to the tool.',
      },
      policy_id: {
        type: 'string',
        description: 'Policy ID (for remove, enable, disable).',
      },
      policy_name: {
        type: 'string',
        description: 'Policy name (for add_policy).',
      },
      policy_description: {
        type: 'string',
        description: 'Policy description.',
      },
      policy_category: {
        type: 'string',
        description: "Category: 'tool_access', 'data_access', 'network', 'execution', 'approval', 'rate_limit', 'time_window', 'content'.",
      },
      policy_condition: {
        type: 'string',
        description: "Policy condition (evaluated expression). Ex: 'tool_name == \"send_email\" AND risk_level >= high'.",
      },
      policy_action: {
        type: 'string',
        description: "Policy action: 'allow', 'deny', 'require_approval', 'log', 'throttle'.",
      },
      policy_severity: {
        type: 'string',
        description: "Severity: 'info', 'warning', 'block'.",
      },
      risk_level: {
        type: 'string',
        description: "Operation risk level: 'low', 'medium', 'high', 'critical'.",
      },
      context: {
        type: 'string',
        description: 'JSON with additional context (user, channel, session, etc).',
      },
    },
    required: ['action'],
  };

  private readonly builtinPolicies: PolicyRule[] = [
    {
      id: 'pol_email_send',
      name: 'Email Send Approval',
      description: 'Email sending requires approval when risk_level >= high',
      category: 'approval',
      severity: 'warning',
      condition: 'tool_name == "send_email" AND risk_level >= high',
      action: 'require_approval',
      enabled: true,
    },
    {
      id: 'pol_destructive_cmd',
      name: 'Destructive Command Block',
      description: 'Blocks destructive commands without explicit approval',
      category: 'execution',
      severity: 'block',
      condition: 'command matches /(rm\\s+-rf|drop\\s+table|delete\\s+from|format|mkfs)/i',
      action: 'deny',
      enabled: true,
    },
    {
      id: 'pol_network_egress',
      name: 'Network Egress Guard',
      description: 'Requires approval for external HTTP requests to untrusted domains',
      category: 'network',
      severity: 'warning',
      condition: 'tool_name == "http_request" AND domain NOT IN trusted_domains',
      action: 'require_approval',
      enabled: true,
    },
    {
      id: 'pol_sensitive_data',
      name: 'Sensitive Data Guard',
      description: 'Blocks access to sensitive files (.env, credentials, keys)',
      category: 'data_access',
      severity: 'block',
      condition: 'file_path matches /\\.(env|credentials|pem|key|secret)$/i',
      action: 'deny',
      enabled: true,
    },
    {
      id: 'pol_rate_limit',
      name: 'Rate Limit',
      description: 'Limits tool execution to 100 calls per minute',
      category: 'rate_limit',
      severity: 'warning',
      condition: 'tool_calls_per_minute > 100',
      action: 'throttle',
      enabled: true,
    },
    {
      id: 'pol_night_mode',
      name: 'Night Mode',
      description: 'Blocks destructive actions between 00:00 and 06:00',
      category: 'time_window',
      severity: 'warning',
      condition: 'risk_level >= high AND hour >= 0 AND hour < 6',
      action: 'require_approval',
      enabled: true,
    },
    {
      id: 'pol_approval_signing',
      name: 'Approval Signing Required',
      description: 'Critical actions require cryptographically signed approval',
      category: 'approval',
      severity: 'block',
      condition: 'risk_level == critical AND NOT approval_signed',
      action: 'deny',
      enabled: true,
    },
    {
      id: 'pol_content_filter',
      name: 'Content Safety Filter',
      description: 'Filters generated content containing sensitive information',
      category: 'content',
      severity: 'warning',
      condition: 'output matches /(api[_-]?key|secret[_-]...key|password|token)\\s*[:=]/i',
      action: 'deny',
      enabled: true,
    },
    {
      id: 'pol_untrusted_plugin',
      name: 'Untrusted Plugin Block',
      description: 'Blocks execution of plugins with trust_state != trusted',
      category: 'tool_access',
      severity: 'block',
      condition: 'plugin_trust_state NOT IN [trusted, verified]',
      action: 'deny',
      enabled: true,
    },
    {
      id: 'pol_workspace_boundary',
      name: 'Workspace Boundary',
      description: 'Blocks access to files outside the workspace',
      category: 'data_access',
      severity: 'block',
      condition: 'file_path NOT IN workspace_paths',
      action: 'deny',
      enabled: true,
    },
  ];

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: the "action" parameter is required.';

    const validActions = ['check', 'list_policies', 'add_policy', 'remove_policy', 'enable_policy', 'disable_policy', 'audit', 'test'];
    if (!validActions.includes(action)) {
      return `Error: invalid action "${action}". Use: ${validActions.join(', ')}.`;
    }

    try {
      switch (action) {
        case 'check': return this.checkPolicy(args);
        case 'list_policies': return this.listPolicies();
        case 'add_policy': return this.addPolicy(args);
        case 'remove_policy': return this.removePolicy(args);
        case 'enable_policy': return this.togglePolicy(args, true);
        case 'disable_policy': return this.togglePolicy(args, false);
        case 'audit': return this.auditPolicies();
        case 'test': return this.testPolicy(args);
      }
      return 'Internal error.';
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth  Enforcer] delete operation failed', error);
    const message = error instanceof Error ? err.message : String(error);
      return `PolicyEnforcer error: ${message}`;
  }
  }

  private checkPolicy(args: Record<string, unknown>): string {
    const toolName = String(args.tool_name || '');
    if (!toolName) return 'Error: "tool_name" is required for check.';

    let toolArgs: Record<string, unknown> = {};
    if (typeof args.tool_args === 'string') {
      try { toolArgs = JSON.parse(args.tool_args); } catch (error: unknown) {/* ignore */ logger.warn('[Zavorth  Enforcer] JSON parse failed', error); }
    }

    const riskLevel = String(args.risk_level || 'medium');
    let context: Record<string, unknown> = {};
    if (typeof args.context === 'string') {
      try { context = JSON.parse(args.context); } catch (error: unknown) {/* ignore */ logger.warn('[Zavorth  Enforcer] JSON parse failed', error); }
    }

    const results = this.evaluatePolicies(toolName, toolArgs, riskLevel, context);

    if (results.length === 0) {
      return `No applicable policy for ${toolName}. Operation ALLOWED by default.`;
    }

    const hasDeny = results.some((r) => !r.allowed && r.severity === 'block');
    const hasRequireApproval = results.some((r) => r.requires_approval);

    const overallResult = hasDeny ? '🚫 BLOCKED' : hasRequireApproval ? '⚠️ REQUIRES APPROVAL' : '✅ ALLOWED';

    const lines: string[] = [
      `Policy Verification for "${toolName}":`,
      `Result: ${overallResult}`,
      '',
      `Evaluated policies (${results.length}):`,
    ];

    for (const result of results) {
      const icon = result.allowed ? '✅' : '🚫';
      const approval = result.requires_approval ? ' [REQUIRES APPROVAL]' : '';
      lines.push(`  ${icon} ${result.policy_name} (${result.severity})${approval}`);
      lines.push(`     ${result.reason}`);
      if (result.alternative) {
        lines.push(`     Alternative: ${result.alternative}`);
      }
    }

    return lines.join('\n');
  }

  private listPolicies(): string {
    const lines: string[] = ['Governance Policies:'];

    const byCategory: Record<string, PolicyRule[]> = {};
    for (const policy of this.builtinPolicies) {
      if (!byCategory[policy.category]) byCategory[policy.category] = [];
      byCategory[policy.category].push(policy);
    }

    for (const [category, policies] of Object.entries(byCategory)) {
      lines.push('');
      lines.push(`[${category}]`);
      for (const policy of policies) {
        const status = policy.enabled ? '✅' : '⏸️';
        const severity = { info: 'ℹ️', warning: '⚠️', block: '🚫' }[policy.severity];
        lines.push(`  ${status} ${severity} ${policy.id}: ${policy.name}`);
        lines.push(`     ${policy.description}`);
        lines.push(`     Action: ${policy.action} | Condition: ${policy.condition.slice(0, 80)}`);
      }
    }

    return lines.join('\n');
  }

  private addPolicy(args: Record<string, unknown>): string {
    const policyName = String(args.policy_name || '');
    if (!policyName) return 'Error: "policy_name" is required.';

    const policyId = `pol_custom_${policyName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 32)}`;

    const existing = this.builtinPolicies.find((p) => p.id === policyId);
    if (existing) return `Error: policy "${policyId}" already exists.`;

    const policy: PolicyRule = {
      id: policyId,
      name: policyName,
      description: String(args.policy_description || ''),
      category: (String(args.policy_category || 'tool_access')) as PolicyRule['category'],
      severity: (String(args.policy_severity || 'warning')) as PolicyRule['severity'],
      condition: String(args.policy_condition || ''),
      action: (String(args.policy_action || 'require_approval')) as PolicyRule['action'],
      enabled: true,
    };

    this.builtinPolicies.push(policy);

    return `Policy "${policyName}" created successfully. ID: ${policyId}`;
  }

  private removePolicy(args: Record<string, unknown>): string {
    const policyId = String(args.policy_id || '');
    if (!policyId) return 'Error: "policy_id" is required.';

    const index = this.builtinPolicies.findIndex((p) => p.id === policyId);
    if (index === -1) return `Error: policy "${policyId}" not found.`;

    const removed = this.builtinPolicies.splice(index, 1)[0];
    return `Policy "${removed.name}" (${policyId}) removed.`;
  }

  private togglePolicy(args: Record<string, unknown>, enabled: boolean): string {
    const policyId = String(args.policy_id || '');
    if (!policyId) return 'Error: "policy_id" is required.';

    const policy = this.builtinPolicies.find((p) => p.id === policyId);
    if (!policy) return `Error: policy "${policyId}" not found.`;

    policy.enabled = enabled;
    return `Policy "${policy.name}" (${policyId}) ${enabled ? 'enabled' : 'disabled'}.`;
  }

  private auditPolicies(): string {
    const enabled = this.builtinPolicies.filter((p) => p.enabled);
    const disabled = this.builtinPolicies.filter((p) => !p.enabled);

    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byAction: Record<string, number> = {};

    for (const p of enabled) {
      byCategory[p.category] = (byCategory[p.category] || 0) + 1;
      bySeverity[p.severity] = (bySeverity[p.severity] || 0) + 1;
      byAction[p.action] = (byAction[p.action] || 0) + 1;
    }

    const lines: string[] = [
      'Governance Policy Audit:',
      '',
      `Total: ${this.builtinPolicies.length} policies`,
      `Enabled: ${enabled.length}`,
      `Disabled: ${disabled.length}`,
      '',
      'By Category (enabled):',
      ...Object.entries(byCategory).map(([cat, count]) => `  ${cat}: ${count}`),
      '',
      'By Severity:',
      ...Object.entries(bySeverity).map(([sev, count]) => `  ${sev}: ${count}`),
      '',
      'By Action:',
      ...Object.entries(byAction).map(([act, count]) => `  ${act}: ${count}`),
    ];

    if (disabled.length > 0) {
      lines.push('', 'Disabled Policies:');
      for (const p of disabled) {
        lines.push(`  ⏸️ ${p.id}: ${p.name}`);
      }
    }

    return lines.join('\n');
  }

  private testPolicy(args: Record<string, unknown>): string {
    const toolName = String(args.tool_name || 'test_tool');
    const riskLevel = String(args.risk_level || 'medium');

    const testCases = [
      { tool: 'send_email', args: { to: 'user@example.com', subject: 'Test' }, risk: 'high' },
      { tool: 'remote_shell', args: { command: 'rm -rf /tmp/test' }, risk: 'critical' },
      { tool: 'http_request', args: { url: 'https://evil.com/exfil' }, risk: 'high' },
      { tool: 'read_file', args: { path: '.env' }, risk: 'medium' },
      { tool: 'web_search', args: { query: 'safe query' }, risk: 'low' },
      { tool: 'send_email', args: { to: 'user@example.com', subject: 'Test' }, risk: 'low' },
    ];

    const lines: string[] = ['Policy Test:', ''];

    for (const test of testCases) {
      const results = this.evaluatePolicies(test.tool, test.args, test.risk, {});
      const hasDeny = results.some((r) => !r.allowed && r.severity === 'block');
      const hasApproval = results.some((r) => r.requires_approval);

      const result = hasDeny ? '🚫 BLOCKED' : hasApproval ? '⚠️ APPROVAL' : '✅ ALLOWED';
      const triggered = results.length;
      const blocked = results.filter((r) => !r.allowed).length;

      lines.push(`${result} | ${test.tool} (risk:${test.risk}) | ${triggered} policies | ${blocked} blocked`);
    }

    return lines.join('\n');
  }

  private evaluatePolicies(
    toolName: string,
    toolArgs: Record<string, unknown>,
    riskLevel: string,
    context: Record<string, unknown>,
  ): PolicyCheckResult[] {
    const results: PolicyCheckResult[] = [];

    for (const policy of this.builtinPolicies) {
      if (!policy.enabled) continue;

      const matches = this.evaluateCondition(policy, toolName, toolArgs, riskLevel, context);
      if (!matches) continue;

      const allowed = policy.action === 'allow' || policy.action === 'log';
      const requiresApproval = policy.action === 'require_approval';

      let alternative: string | undefined;
      if (!allowed) {
        alternative = this.suggestAlternative(policy, toolName);
      }

      results.push({
        allowed,
        policy_id: policy.id,
        policy_name: policy.name,
        action: policy.action,
        severity: policy.severity,
        reason: `${policy.description} [${policy.condition}]`,
        requires_approval: requiresApproval,
        alternative,
      });
    }

    return results;
  }

  private evaluateCondition(
    policy: PolicyRule,
    toolName: string,
    toolArgs: Record<string, unknown>,
    riskLevel: string,
    context: Record<string, unknown>,
  ): boolean {
    const cond = policy.condition.toLowerCase();

    if (cond.includes('tool_name')) {
      if (!cond.includes(toolName.toLowerCase())) return false;
    }

    if (cond.includes('risk_level')) {
      const riskOrder: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
      const currentRisk = riskOrder[riskLevel] || 2;

      if (cond.includes('>= high') && currentRisk < 3) return false;
      if (cond.includes('== critical') && currentRisk < 4) return false;
      if (cond.includes('>= medium') && currentRisk < 2) return false;
    }

    if (cond.includes('command') && toolArgs.command) {
      const cmd = String(toolArgs.command);
      if (cond.includes('destructive') || cond.includes('rm\\s+-rf') || cond.includes('drop\\s+table')) {
        if (/(rm\s+-rf|drop\s+table|delete\s+from|format|mkfs)/i.test(cmd)) return true;
      }
    }

    if (cond.includes('file_path') && toolArgs.path) {
      const filePath = String(toolArgs.path);
      if (cond.includes('sensitive') || cond.includes('.env') || cond.includes('credentials')) {
        if (/\.(env|credentials|pem|key|secret)$/i.test(filePath)) return true;
      }
    }

    if (cond.includes('domain') && toolArgs.url) {
      const url = String(toolArgs.url);
      try {
        const parsed = new URL(url);
        const trustedDomains = ['github.com', 'google.com', 'openai.com', 'localhost'];
        if (!trustedDomains.some((d) => parsed.hostname.endsWith(d))) return true;
      } catch (error: unknown) {logger.warn('[Zavorth  Enforcer] parsing failed', error); return true; }
    }

    if (cond.includes('hour')) {
      const hour = new Date().getHours();
      if (cond.includes('hour >= 0 AND hour < 6') && hour >= 0 && hour < 6) return true;
    }

    if (cond.includes('tool_calls_per_minute')) {
      const callsPerMinute = typeof context.tool_calls_per_minute === 'number' ? context.tool_calls_per_minute : 0;
      if (callsPerMinute > 100) return true;
      return false;
    }

    if (cond.includes('approval_signed') && riskLevel === 'critical') {
      const signed = context.approval_signed === true;
      if (!signed) return true;
    }

    if (cond.includes('plugin_trust_state')) {
      if (context.plugin_trust_state !== undefined) {
        const trustState = String(context.plugin_trust_state);
        if (!['trusted', 'verified'].includes(trustState)) return true;
      }
      return false;
    }

    if (cond.includes('workspace_paths')) {
      const filePath = String(toolArgs.path || '');
      if (filePath && !filePath.startsWith(process.cwd())) return true;
    }

    if (cond.includes('output') && typeof toolArgs.output === 'string') {
      if (/(api[_-]?key|secret[_-]...key|password|token)\s*[:=]/i.test(toolArgs.output)) return true;
    }

    if (cond.includes('matches') || cond.includes('NOT IN')) {
      return false;
    }

    return false;
  }

  private suggestAlternative(policy: PolicyRule, toolName: string): string | undefined {
    switch (policy.category) {
      case 'execution':
        return `Use a sandbox (SandboxExecutionTool) for dangerous commands.`;
      case 'data_access':
        return `Request explicit file access or use a tool with limited scope.`;
      case 'network':
        return `Add the domain to the trust list or use an approved proxy.`;
      case 'approval':
        return `Request user approval via the Zavorth approval system.`;
      case 'time_window':
        return `Wait for the allowed time window or request explicit approval.`;
      default:
        return undefined;
    }
  }
}
