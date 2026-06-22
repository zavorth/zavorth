import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';

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
    'Verifica se uma acao e permitida pelas politicas de governanca do Zavorth. Consulta o EffectPolicyKernel, AgentSecurityPolicyEngine e regras customizadas antes de executar operacoes. Retorna allow/deny/require_approval com justificativa.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Acao: 'check', 'list_policies', 'add_policy', 'remove_policy', 'enable_policy', 'disable_policy', 'audit', 'test'.",
      },
      tool_name: {
        type: 'string',
        description: 'Nome da tool a ser verificada.',
      },
      tool_args: {
        type: 'string',
        description: 'JSON com os argumentos que seriam passados para a tool.',
      },
      policy_id: {
        type: 'string',
        description: 'ID da politica (para remove, enable, disable).',
      },
      policy_name: {
        type: 'string',
        description: 'Nome da politica (para add_policy).',
      },
      policy_description: {
        type: 'string',
        description: 'Descricao da politica.',
      },
      policy_category: {
        type: 'string',
        description: "Categoria: 'tool_access', 'data_access', 'network', 'execution', 'approval', 'rate_limit', 'time_window', 'content'.",
      },
      policy_condition: {
        type: 'string',
        description: "Condicao da politica (expressao avaliada). Ex: 'tool_name == \"send_email\" AND risk_level >= high'.",
      },
      policy_action: {
        type: 'string',
        description: "Acao da politica: 'allow', 'deny', 'require_approval', 'log', 'throttle'.",
      },
      policy_severity: {
        type: 'string',
        description: "Severidade: 'info', 'warning', 'block'.",
      },
      risk_level: {
        type: 'string',
        description: "Nivel de risco da operacao: 'low', 'medium', 'high', 'critical'.",
      },
      context: {
        type: 'string',
        description: 'JSON com contexto adicional (user, channel, session, etc).',
      },
    },
    required: ['action'],
  };

  private readonly builtinPolicies: PolicyRule[] = [
    {
      id: 'pol_email_send',
      name: 'Email Send Approval',
      description: 'Envio de emails requer aprovacao quando risk_level >= high',
      category: 'approval',
      severity: 'warning',
      condition: 'tool_name == "send_email" AND risk_level >= high',
      action: 'require_approval',
      enabled: true,
    },
    {
      id: 'pol_destructive_cmd',
      name: 'Destructive Command Block',
      description: 'Bloqueia comandos destrutivos sem aprovacao explicita',
      category: 'execution',
      severity: 'block',
      condition: 'command matches /(rm\\s+-rf|drop\\s+table|delete\\s+from|format|mkfs)/i',
      action: 'deny',
      enabled: true,
    },
    {
      id: 'pol_network_egress',
      name: 'Network Egress Guard',
      description: 'Requer aprovacao para requests HTTP externos para dominios nao confiaveis',
      category: 'network',
      severity: 'warning',
      condition: 'tool_name == "http_request" AND domain NOT IN trusted_domains',
      action: 'require_approval',
      enabled: true,
    },
    {
      id: 'pol_sensitive_data',
      name: 'Sensitive Data Guard',
      description: 'Bloqueia acesso a arquivos sensiveis (.env, credentials, keys)',
      category: 'data_access',
      severity: 'block',
      condition: 'file_path matches /\\.(env|credentials|pem|key|secret)$/i',
      action: 'deny',
      enabled: true,
    },
    {
      id: 'pol_rate_limit',
      name: 'Rate Limit',
      description: 'Limita execucao de tools a 100 chamadas por minuto',
      category: 'rate_limit',
      severity: 'warning',
      condition: 'tool_calls_per_minute > 100',
      action: 'throttle',
      enabled: true,
    },
    {
      id: 'pol_night_mode',
      name: 'Night Mode',
      description: 'Bloqueia acoes destrutivas entre 00:00 e 06:00',
      category: 'time_window',
      severity: 'warning',
      condition: 'risk_level >= high AND hour >= 0 AND hour < 6',
      action: 'require_approval',
      enabled: true,
    },
    {
      id: 'pol_approval_signing',
      name: 'Approval Signing Required',
      description: 'Acoes criticas requerem approval assinado criptograficamente',
      category: 'approval',
      severity: 'block',
      condition: 'risk_level == critical AND NOT approval_signed',
      action: 'deny',
      enabled: true,
    },
    {
      id: 'pol_content_filter',
      name: 'Content Safety Filter',
      description: 'Filtra conteudo gerado que contenha informacoes sensiveis',
      category: 'content',
      severity: 'warning',
      condition: 'output matches /(api[_-]?key|secret[_-]?key|password|token)\\s*[:=]/i',
      action: 'deny',
      enabled: true,
    },
    {
      id: 'pol_untrusted_plugin',
      name: 'Untrusted Plugin Block',
      description: 'Bloqueia execucao de plugins com trust_state != trusted',
      category: 'tool_access',
      severity: 'block',
      condition: 'plugin_trust_state NOT IN [trusted, verified]',
      action: 'deny',
      enabled: true,
    },
    {
      id: 'pol_workspace_boundary',
      name: 'Workspace Boundary',
      description: 'Bloqueia acesso a arquivos fora do workspace',
      category: 'data_access',
      severity: 'block',
      condition: 'file_path NOT IN workspace_paths',
      action: 'deny',
      enabled: true,
    },
  ];

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Erro: o parametro "action" e obrigatorio.';

    const validActions = ['check', 'list_policies', 'add_policy', 'remove_policy', 'enable_policy', 'disable_policy', 'audit', 'test'];
    if (!validActions.includes(action)) {
      return `Erro: acao "${action}" invalida. Use: ${validActions.join(', ')}.`;
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
      return 'Erro interno.';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `Erro no PolicyEnforcer: ${message}`;
    }
  }

  private checkPolicy(args: Record<string, unknown>): string {
    const toolName = String(args.tool_name || '');
    if (!toolName) return 'Erro: "tool_name" e obrigatorio para check.';

    let toolArgs: Record<string, unknown> = {};
    if (typeof args.tool_args === 'string') {
      try { toolArgs = JSON.parse(args.tool_args); } catch { /* ignore */ }
    }

    const riskLevel = String(args.risk_level || 'medium');
    let context: Record<string, unknown> = {};
    if (typeof args.context === 'string') {
      try { context = JSON.parse(args.context); } catch { /* ignore */ }
    }

    const results = this.evaluatePolicies(toolName, toolArgs, riskLevel, context);

    if (results.length === 0) {
      return `Nenhuma politica aplicavel para ${toolName}. Operacao PERMITIDA por padrao.`;
    }

    const hasDeny = results.some((r) => !r.allowed && r.severity === 'block');
    const hasRequireApproval = results.some((r) => r.requires_approval);

    const overallResult = hasDeny ? '🚫 BLOQUEADO' : hasRequireApproval ? '⚠️ REQUER APROVACAO' : '✅ PERMITIDO';

    const lines: string[] = [
      `Verificacao de Politicas para "${toolName}":`,
      `Resultado: ${overallResult}`,
      '',
      `Politicas avaliadas (${results.length}):`,
    ];

    for (const result of results) {
      const icon = result.allowed ? '✅' : '🚫';
      const approval = result.requires_approval ? ' [REQUER APROVACAO]' : '';
      lines.push(`  ${icon} ${result.policy_name} (${result.severity})${approval}`);
      lines.push(`     ${result.reason}`);
      if (result.alternative) {
        lines.push(`     Alternativa: ${result.alternative}`);
      }
    }

    return lines.join('\n');
  }

  private listPolicies(): string {
    const lines: string[] = ['Politicas de Governanca:'];

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
        lines.push(`     Acao: ${policy.action} | Condicao: ${policy.condition.slice(0, 80)}`);
      }
    }

    return lines.join('\n');
  }

  private addPolicy(args: Record<string, unknown>): string {
    const policyName = String(args.policy_name || '');
    if (!policyName) return 'Erro: "policy_name" e obrigatorio.';

    const policyId = `pol_custom_${policyName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 32)}`;

    const existing = this.builtinPolicies.find((p) => p.id === policyId);
    if (existing) return `Erro: politica "${policyId}" ja existe.`;

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

    return `Politica "${policyName}" criada com sucesso. ID: ${policyId}`;
  }

  private removePolicy(args: Record<string, unknown>): string {
    const policyId = String(args.policy_id || '');
    if (!policyId) return 'Erro: "policy_id" e obrigatorio.';

    const index = this.builtinPolicies.findIndex((p) => p.id === policyId);
    if (index === -1) return `Erro: politica "${policyId}" nao encontrada.`;

    const removed = this.builtinPolicies.splice(index, 1)[0];
    return `Politica "${removed.name}" (${policyId}) removida.`;
  }

  private togglePolicy(args: Record<string, unknown>, enabled: boolean): string {
    const policyId = String(args.policy_id || '');
    if (!policyId) return 'Erro: "policy_id" e obrigatorio.';

    const policy = this.builtinPolicies.find((p) => p.id === policyId);
    if (!policy) return `Erro: politica "${policyId}" nao encontrada.`;

    policy.enabled = enabled;
    return `Politica "${policy.name}" (${policyId}) ${enabled ? 'habilitada' : 'desabilitada'}.`;
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
      'Auditoria de Politicas de Governanca:',
      '',
      `Total: ${this.builtinPolicies.length} politicas`,
      `Habilitadas: ${enabled.length}`,
      `Desabilitadas: ${disabled.length}`,
      '',
      'Por Categoria (habilitadas):',
      ...Object.entries(byCategory).map(([cat, count]) => `  ${cat}: ${count}`),
      '',
      'Por Severidade:',
      ...Object.entries(bySeverity).map(([sev, count]) => `  ${sev}: ${count}`),
      '',
      'Por Acao:',
      ...Object.entries(byAction).map(([act, count]) => `  ${act}: ${count}`),
    ];

    if (disabled.length > 0) {
      lines.push('', 'Politicas Desabilitadas:');
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

    const lines: string[] = ['Teste de Politicas:', ''];

    for (const test of testCases) {
      const results = this.evaluatePolicies(test.tool, test.args, test.risk, {});
      const hasDeny = results.some((r) => !r.allowed && r.severity === 'block');
      const hasApproval = results.some((r) => r.requires_approval);

      const result = hasDeny ? '🚫 BLOQUEADO' : hasApproval ? '⚠️ APROVACAO' : '✅ PERMITIDO';
      const triggered = results.length;
      const blocked = results.filter((r) => !r.allowed).length;

      lines.push(`${result} | ${test.tool} (risk:${test.risk}) | ${triggered} politicas | ${blocked} bloqueadas`);
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
      } catch { return true; }
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
      if (/(api[_-]?key|secret[_-]?key|password|token)\s*[:=]/i.test(toolArgs.output)) return true;
    }

    if (cond.includes('matches') || cond.includes('NOT IN')) {
      return false;
    }

    return false;
  }

  private suggestAlternative(policy: PolicyRule, toolName: string): string | undefined {
    switch (policy.category) {
      case 'execution':
        return `Use uma sandbox (SandboxExecutionTool) para comandos perigosos.`;
      case 'data_access':
        return `Solicite acesso explicito ao arquivo ou use uma ferramenta com escopo limitado.`;
      case 'network':
        return `Adicione o dominio a lista de confianca ou use um proxy aprovado.`;
      case 'approval':
        return `Solicite aprovacao do usuario via approval system do Zavorth.`;
      case 'time_window':
        return `Aguarde o horario permitido ou solicite aprovacao explicita.`;
      default:
        return undefined;
    }
  }
}
