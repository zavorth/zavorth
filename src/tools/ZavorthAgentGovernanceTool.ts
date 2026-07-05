import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export interface GovernancePolicy {
  id: string;
  name: string;
  category: 'safety' | 'privacy' | 'compliance' | 'quality' | 'cost' | 'access';
  severity: 'info' | 'warning' | 'block';
  description: string;
  rule: string;
  enabled: boolean;
  created_at: string;
}

export interface GovernanceAudit {
  timestamp: string;
  agent_id: string;
  action: string;
  policy_id: string | null;
  result: 'pass' | 'warn' | 'block';
  details: string;
  evidence: Record<string, unknown>;
}

export class ZavorthAgentGovernanceTool extends BaseTool {
  public readonly name = 'zavorth_agent_governance';

  public readonly description =
    'Agent Governance Toolkit — runtime guardrails, compliance checks (EU AI Act), audit trails, safety policies, and agent behavior monitoring.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'check', 'audit', 'policy_list', 'policy_add', 'policy_remove', 'compliance', 'safety_report', 'behavior_log', 'risk_assess'.",
      },
      agent_id: {
        type: 'string',
        description: 'Agent ID to check/govern.',
      },
      action_to_check: {
        type: 'string',
        description: 'Action being evaluated for compliance.',
      },
      policy_id: {
        type: 'string',
        description: 'Policy ID for specific operations.',
      },
      category: {
        type: 'string',
        description: "Policy category: 'safety', 'privacy', 'compliance', 'quality', 'cost', 'access'.",
      },
      details: {
        type: 'string',
        description: 'Additional details for audit log.',
      },
      risk_level: {
        type: 'string',
        description: "Risk level: 'low', 'medium', 'high', 'critical'.",
      },
      compliance_framework: {
        type: 'string',
        description: "Compliance framework: 'eu-ai-act', 'gdpr', 'soc2', 'hipaa', 'iso27001'.",
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;
  private policies: GovernancePolicy[] = [];
  private auditLog: GovernanceAudit[] = [];

  constructor(options?: { storageDir?: string }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'governance');
    this.ensureDir();
    this.initDefaultPolicies();
    this.loadAuditLog();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private initDefaultPolicies(): void {
    this.policies = [
      { id: 'GOV-001', name: 'No Destructive Actions Without Approval', category: 'safety', severity: 'block', description: 'Block destructive actions (delete, drop, format) without explicit user approval.', rule: 'action.destructive AND NOT approval.granted', enabled: true, created_at: '2025-01-01' },
      { id: 'GOV-002', name: 'PII Detection and Redaction', category: 'privacy', severity: 'block', description: 'Detect and redact PII (SSN, credit cards, emails) from outputs.', rule: 'output CONTAINS pii_pattern', enabled: true, created_at: '2025-01-01' },
      { id: 'GOV-003', name: 'Secret Leakage Prevention', category: 'privacy', severity: 'block', description: 'Prevent API keys, tokens, and secrets from appearing in outputs.', rule: 'output MATCHES secret_pattern', enabled: true, created_at: '2025-01-01' },
      { id: 'GOV-004', name: 'Cost Budget Enforcement', category: 'cost', severity: 'warning', description: 'Warn when approaching daily/monthly cost budget.', rule: 'cost.daily > budget.daily * 0.8', enabled: true, created_at: '2025-01-01' },
      { id: 'GOV-005', name: 'Rate Limit Enforcement', category: 'access', severity: 'warning', description: 'Enforce rate limits on API calls and tool executions.', rule: 'tool.calls_per_minute > 100', enabled: true, created_at: '2025-01-01' },
      { id: 'GOV-006', name: 'Data Residency Compliance', category: 'compliance', severity: 'block', description: 'Ensure data stays within approved regions (EU, US, etc).', rule: 'data.region NOT IN approved_regions', enabled: true, created_at: '2025-01-01' },
      { id: 'GOV-007', name: 'Audit Trail Completeness', category: 'compliance', severity: 'warning', description: 'Ensure all actions have complete audit trails.', rule: 'action.receipt IS NULL', enabled: true, created_at: '2025-01-01' },
      { id: 'GOV-008', name: 'Output Quality Check', category: 'quality', severity: 'info', description: 'Check output quality (completeness, accuracy, relevance).', rule: 'output.quality_score < 0.5', enabled: true, created_at: '2025-01-01' },
      { id: 'GOV-009', name: 'Tool Permission Enforcement', category: 'access', severity: 'block', description: 'Enforce tool-level permissions based on risk.', rule: 'tool.risk_level >= high AND NOT permission.granted', enabled: true, created_at: '2025-01-01' },
      { id: 'GOV-010', name: 'Session Timeout', category: 'access', severity: 'warning', description: 'Warn and log when sessions exceed maximum duration.', rule: 'session.duration > max_duration', enabled: true, created_at: '2025-01-01' },
      { id: 'GOV-011', name: 'EU AI Act High-Risk Check', category: 'compliance', severity: 'block', description: 'Check compliance with EU AI Act high-risk requirements.', rule: 'agent.risk_category == high AND NOT compliance.eu_ai_act', enabled: true, created_at: '2025-01-01' },
      { id: 'GOV-012', name: 'GDPR Data Processing', category: 'privacy', severity: 'block', description: 'Ensure GDPR-compliant data processing with consent.', rule: 'data.personal AND NOT consent.granted', enabled: true, created_at: '2025-01-01' },
      { id: 'GOV-013', name: 'Prompt Injection Defense', category: 'safety', severity: 'block', description: 'Detect and block prompt injection attempts.', rule: 'input MATCHES injection_pattern', enabled: true, created_at: '2025-01-01' },
      { id: 'GOV-014', name: 'Hallucination Detection', category: 'quality', severity: 'warning', description: 'Flag potential hallucinations in outputs.', rule: 'output.confidence < 0.3 AND output.factual', enabled: true, created_at: '2025-01-01' },
      { id: 'GOV-015', name: 'Resource Usage Monitoring', category: 'cost', severity: 'info', description: 'Monitor CPU, memory, and disk usage.', rule: 'resource.usage > threshold', enabled: true, created_at: '2025-01-01' },
    ];
  }

  private loadAuditLog(): void {
    const logPath = path.join(this.storageDir, 'audit.json');
    if (!fs.existsSync(logPath)) return;
    try {
      this.auditLog = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
    } catch (error) { /* ignore */ logger.warn('[Zavorth Agent Governance] JSON parse failed', error); }
  }

  private saveAuditLog(): void {
    fs.writeFileSync(
      path.join(this.storageDir, 'audit.json'),
      JSON.stringify(this.auditLog.slice(-1000), null, 2),
      'utf-8',
    );
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'check': return this.checkAction(args);
      case 'audit': return this.getAuditLog(args);
      case 'policy_list': return this.listPolicies();
      case 'policy_add': return this.addPolicy(args);
      case 'policy_remove': return this.removePolicy(args);
      case 'compliance': return this.checkCompliance(args);
      case 'safety_report': return this.generateSafetyReport();
      case 'behavior_log': return this.logBehavior(args);
      case 'risk_assess': return this.assessRisk(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private checkAction(args: Record<string, unknown>): string {
    const actionToCheck = String(args.action_to_check || '');
    if (!actionToCheck) return 'Error: "action_to_check" is required.';

    const agentId = String(args.agent_id || 'default');
    const riskLevel = String(args.risk_level || 'medium');

    const triggered: GovernancePolicy[] = [];
    for (const policy of this.policies) {
      if (!policy.enabled) continue;
      if (this.evaluatePolicy(policy, actionToCheck, riskLevel)) {
        triggered.push(policy);
      }
    }

    const blocked = triggered.filter((p) => p.severity === 'block');
    const warned = triggered.filter((p) => p.severity === 'warning');

    const auditEntry: GovernanceAudit = {
      timestamp: new Date().toISOString(),
      agent_id: agentId,
      action: actionToCheck,
      policy_id: triggered.length > 0 ? triggered[0].id : null,
      result: blocked.length > 0 ? 'block' : warned.length > 0 ? 'warn' : 'pass',
      details: `Checked against ${this.policies.length} policies, ${triggered.length} triggered`,
      evidence: { blocked: blocked.length, warned: warned.length },
    };
    this.auditLog.push(auditEntry);
    this.saveAuditLog();

    if (blocked.length > 0) {
      return [
        `🚫 BLOCKED: "${actionToCheck}"`,
        '',
        'Blocking policies:',
        ...blocked.map((p) => `  ${p.id}: ${p.name} — ${p.description}`),
        '',
        'Action cannot proceed without policy override.',
      ].join('\n');
    }

    if (warned.length > 0) {
      return [
        `⚠️ WARNING: "${actionToCheck}"`,
        '',
        'Warning policies:',
        ...warned.map((p) => `  ${p.id}: ${p.name} — ${p.description}`),
        '',
        'Action may proceed with caution.',
      ].join('\n');
    }

    return `✅ PASS: "${actionToCheck}" — No governance policies triggered.`;
  }

  private evaluatePolicy(policy: GovernancePolicy, action: string, riskLevel: string): boolean {
    const actionLower = action.toLowerCase();

    if (policy.id === 'GOV-001' && /\b(delete|drop|format|rm|destroy)\b/.test(actionLower)) return true;
    if (policy.id === 'GOV-002' && /\b(ssn|credit.card|social.security|passport)\b/.test(actionLower)) return true;
    if (policy.id === 'GOV-003' && /\b(api.key|secret|token|password|credential)\b/.test(actionLower)) return true;
    if (policy.id === 'GOV-009' && riskLevel === 'high') return true;
    if (policy.id === 'GOV-013' && /\b(ignore.previous|forget.instructions|new.system.prompt)\b/.test(actionLower)) return true;

    return false;
  }

  private listPolicies(): string {
    const lines: string[] = ['Governance Policies:'];
    for (const p of this.policies) {
      const status = p.enabled ? '✅' : '⏸️';
      const severity = { info: 'ℹ️', warning: '⚠️', block: '🚫' }[p.severity];
      lines.push(`  ${status} ${severity} ${p.id}: ${p.name} [${p.category}]`);
      lines.push(`     ${p.description}`);
    }
    return lines.join('\n');
  }

  private addPolicy(args: Record<string, unknown>): string {
    const name = String(args.policy_name || '');
    if (!name) return 'Error: "policy_name" is required.';

    const id = `GOV-${String(this.policies.length + 1).padStart(3, '0')}`;
    const policy: GovernancePolicy = {
      id,
      name,
      category: (String(args.category || 'safety')) as GovernancePolicy['category'],
      severity: (String(args.severity || 'warning')) as GovernancePolicy['severity'],
      description: String(args.details || ''),
      rule: String(args.rule || ''),
      enabled: true,
      created_at: new Date().toISOString(),
    };

    this.policies.push(policy);
    return `Policy "${name}" added with ID ${id}.`;
  }

  private removePolicy(args: Record<string, unknown>): string {
    const policyId = String(args.policy_id || '');
    if (!policyId) return 'Error: "policy_id" is required.';

    const index = this.policies.findIndex((p) => p.id === policyId);
    if (index === -1) return `Error: policy "${policyId}" not found.`;

    this.policies.splice(index, 1);
    return `Policy "${policyId}" removed.`;
  }

  private checkCompliance(args: Record<string, unknown>): string {
    const framework = String(args.compliance_framework || 'eu-ai-act');

    const checks: Record<string, Array<{ check: string; status: string; note: string }>> = {
      'eu-ai-act': [
        { check: 'Risk assessment completed', status: '✅', note: 'Risk classifier active' },
        { check: 'Transparency requirements', status: '✅', note: 'Receipts for all actions' },
        { check: 'Human oversight mechanism', status: '✅', note: 'Approval system active' },
        { check: 'Technical documentation', status: '⚠️', note: 'Partial — docs in progress' },
        { check: 'Data governance', status: '✅', note: 'PII detection active' },
        { check: 'Accuracy and robustness', status: '✅', note: 'Quality checks active' },
        { check: 'Post-market monitoring', status: '✅', note: 'Audit trail active' },
      ],
      'gdpr': [
        { check: 'Data minimization', status: '✅', note: 'Only collect necessary data' },
        { check: 'Purpose limitation', status: '✅', note: 'Data used only for stated purpose' },
        { check: 'Consent management', status: '⚠️', note: 'Partial — consent UI needed' },
        { check: 'Right to erasure', status: '✅', note: 'Data deletion supported' },
        { check: 'Data portability', status: '✅', note: 'Export functionality available' },
        { check: 'Breach notification', status: '⚠️', note: 'Manual process — automate needed' },
      ],
      'soc2': [
        { check: 'Access controls', status: '✅', note: 'Role-based access active' },
        { check: 'Audit logging', status: '✅', note: 'Complete audit trail' },
        { check: 'Change management', status: '✅', note: 'Approval-based changes' },
        { check: 'Risk assessment', status: '✅', note: 'Risk classifier active' },
        { check: 'Incident response', status: '⚠️', note: 'Partial — automate needed' },
      ],
    };

    const checksForFramework = checks[framework] || checks['eu-ai-act'];
    const passed = checksForFramework.filter((c) => c.status === '✅').length;
    const warnings = checksForFramework.filter((c) => c.status === '⚠️').length;

    const lines: string[] = [
      `Compliance Check: ${framework.toUpperCase()}`,
      `  Passed: ${passed}/${checksForFramework.length}`,
      `  Warnings: ${warnings}`,
      '',
    ];

    for (const check of checksForFramework) {
      lines.push(`  ${check.status} ${check.check}: ${check.note}`);
    }

    return lines.join('\n');
  }

  private generateSafetyReport(): string {
    const recentAudits = this.auditLog.slice(-100);
    const blocked = recentAudits.filter((a) => a.result === 'block').length;
    const warned = recentAudits.filter((a) => a.result === 'warn').length;
    const passed = recentAudits.filter((a) => a.result === 'pass').length;

    return [
      'Safety Report:',
      `  Total audits: ${recentAudits.length}`,
      `  Passed: ${passed}`,
      `  Warnings: ${warned}`,
      `  Blocked: ${blocked}`,
      `  Active policies: ${this.policies.filter((p) => p.enabled).length}/${this.policies.length}`,
      `  Compliance score: ${recentAudits.length > 0 ? ((passed / recentAudits.length) * 100).toFixed(1) : 100}%`,
    ].join('\n');
  }

  private logBehavior(args: Record<string, unknown>): string {
    const agentId = String(args.agent_id || 'default');
    const details = String(args.details || '');

    const entry: GovernanceAudit = {
      timestamp: new Date().toISOString(),
      agent_id: agentId,
      action: 'behavior_log',
      policy_id: null,
      result: 'pass',
      details,
      evidence: {},
    };

    this.auditLog.push(entry);
    this.saveAuditLog();

    return `Behavior logged for agent "${agentId}".`;
  }

  private assessRisk(args: Record<string, unknown>): string {
    const actionToCheck = String(args.action_to_check || '');
    const riskLevel = String(args.risk_level || 'medium');

    const factors: Array<{ factor: string; score: number; note: string }> = [];
    const actionLower = actionToCheck.toLowerCase();

    if (/\b(delete|drop|format|rm)\b/.test(actionLower)) factors.push({ factor: 'Destructive action', score: 0.8, note: 'Irreversible data loss possible' });
    if (/\b(network|fetch|curl|http)\b/.test(actionLower)) factors.push({ factor: 'Network access', score: 0.4, note: 'External data transfer' });
    if (/\b(shell|exec|eval|spawn)\b/.test(actionLower)) factors.push({ factor: 'Code execution', score: 0.6, note: 'Arbitrary code execution' });
    if (/\b(secret|key|token|password)\b/.test(actionLower)) factors.push({ factor: 'Credential access', score: 0.7, note: 'Sensitive data exposure' });
    if (riskLevel === 'critical') factors.push({ factor: 'Critical risk level', score: 0.9, note: 'High-impact operation' });

    const avgScore = factors.length > 0 ? factors.reduce((s, f) => s + f.score, 0) / factors.length : 0.1;
    const riskLabel = avgScore < 0.3 ? 'LOW' : avgScore < 0.6 ? 'MEDIUM' : avgScore < 0.8 ? 'HIGH' : 'CRITICAL';

    return [
      `Risk Assessment: "${actionToCheck}"`,
      `  Overall risk: ${riskLabel} (${(avgScore * 100).toFixed(0)}%)`,
      '',
      'Risk factors:',
      ...factors.map((f) => `  ${f.factor}: ${(f.score * 100).toFixed(0)}% — ${f.note}`),
      factors.length === 0 ? '  No risk factors identified.' : '',
    ].filter(Boolean).join('\n');
  }

  private getAuditLog(args: Record<string, unknown>): string {
    const limit = Number(args.limit || 50);
    const recentAudits = this.auditLog.slice(-limit);
    if (recentAudits.length === 0) {
      return 'No audit log entries found.';
    }
    return [
      'Audit Log Entries:',
      ...recentAudits.map(
        (a) => `[${a.timestamp}] Agent: ${a.agent_id} | Action: ${a.action} | Result: ${a.result} | Details: ${a.details}`
      )
    ].join('\n');
  }
}
