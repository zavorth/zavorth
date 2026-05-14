import { v4 as uuidv4 } from 'uuid';
import { LogRepository } from '../storage/LogRepository.js';
import { ToolHookPipelineService } from '../services/ToolHookPipelineService.js';
import { TelemetryRuntimeService } from '../observability/telemetry/TelemetryRuntimeService.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import {
  AgentSecurityPolicyEngine,
  type AgentInputTrust,
  type AgentPolicyDecision,
} from '../security/AgentSecurityPolicyEngine.js';
import { resolveDefaultAgentToolSecurityDefinition } from '../security/AgentToolSecurityCatalog.js';
import { containsUntrustedContentMarker } from '../security/UntrustedContent.js';
import {
  extractToolSecurityApprovalEnvelope,
  verifyToolSecurityApprovalEnvelope,
} from '../security/ToolApprovalEnvelope.js';
import {
  formatUserFacingSecurityApprovalMessage,
  resolveSecurityProfile,
} from '../security/SecurityProfile.js';
import {
  decideSecurityPolicy,
  formatSecurityPolicyReceipt,
  type SecurityPolicyBrokerDecision,
} from '../security/SecurityPolicyBroker.js';
import {
  detectSensitiveData,
  redactSensitiveText,
  requiresSensitiveDataEgressGuard,
  type SensitiveDataFinding,
} from '../security/SensitiveDataGuard.js';

type ToolExecutorRuntime = {
  defaultWorkspace?: string | null;
  hookPipelineService?: Pick<ToolHookPipelineService, 'run'>;
  securityPolicyEngine?: Pick<AgentSecurityPolicyEngine, 'evaluateToolInvocation'>;
};

/**
 * ToolExecutor - Executor especializado para ferramentas TypeScript nativas.
 */
export class ToolExecutor {
  private registry: ToolRegistry;
  private logRepo: LogRepository;
  private telemetryRuntime: TelemetryRuntimeService | null;
  private defaultWorkspace: string | null;
  private hookPipeline: Pick<ToolHookPipelineService, 'run'>;
  private securityPolicyEngine: Pick<AgentSecurityPolicyEngine, 'evaluateToolInvocation'> | null;

  constructor(
    registry: ToolRegistry,
    logRepo: LogRepository,
    telemetryRuntime?: TelemetryRuntimeService | null,
    runtime: ToolExecutorRuntime = {},
  ) {
    this.registry = registry;
    this.logRepo = logRepo;
    this.telemetryRuntime = telemetryRuntime || null;
    this.defaultWorkspace = this.resolveWorkspace(runtime.defaultWorkspace);
    this.hookPipeline = runtime.hookPipelineService || new ToolHookPipelineService();
    this.securityPolicyEngine = runtime.securityPolicyEngine || null;
  }

  /**
   * Executa uma ferramenta especifica do plano.
   */
  public async executeTool(toolName: string, args: unknown): Promise<string> {
    const input = args && typeof args === 'object' && !Array.isArray(args)
      ? args as Record<string, unknown>
      : {};
    const metadata = input.metadata && typeof input.metadata === 'object'
      ? input.metadata as Record<string, unknown>
      : {};
    const traceId = this.resolveTraceId(toolName, input);
    const workspace = this.resolveWorkspace(String(input.workspace || metadata.workspace || '') || null);
    const argKeys = this.describeArgKeys(input);
    const before = await this.hookPipeline.run({
      event: 'runtime.before_execute',
      workspace,
      context: {
        traceId,
        toolName,
        argKeys,
      },
    });
    if (!before.ok) {
      await this.recordTelemetry(traceId, 'tool.failed', 'blocked', {
        toolName,
        argKeys,
      });
      await this.hookPipeline.run({
        event: 'runtime.exec_failed',
        workspace,
        context: {
          traceId,
          toolName,
          reason: 'blocked_by_hook',
        },
      });
      throw new Error('Um hook bloqueou a execucao do runtime para essa tool.');
    }

    const tool = this.registry.getTool(toolName);

    if (!tool) {
      await this.recordTelemetry(traceId, 'tool.failed', 'tool_missing', {
        toolName,
        argKeys,
      });
      await this.hookPipeline.run({
        event: 'runtime.exec_failed',
        workspace,
        context: {
          traceId,
          toolName,
          reason: 'tool_missing',
          argKeys,
        },
      });
      throw new Error(`Ferramenta "${toolName}" nao encontrada no registro.`);
    }

    const securityDecision = this.evaluateSecurityPolicy(toolName, input, metadata, workspace);
    const securityBrokerDecision = this.evaluateSecurityPolicyBroker(
      toolName,
      input,
      metadata,
      workspace,
      securityDecision,
    );
    if (!securityBrokerDecision.allowed) {
      await this.recordTelemetry(traceId, 'tool.failed', 'blocked_by_security_policy', {
        toolName,
        argKeys,
        securityRule: securityDecision.rule,
        securityRisk: securityDecision.risk,
        securityAction: securityDecision.action,
        securityCapabilities: securityDecision.capabilities,
        policyBrokerAction: securityBrokerDecision.action,
        policyBrokerReceiptId: securityBrokerDecision.receipt.receiptId,
      });
      await this.hookPipeline.run({
        event: 'runtime.exec_failed',
        workspace,
        context: {
          traceId,
          toolName,
          reason: 'blocked_by_security_policy',
          securityRule: securityDecision.rule,
          securityRisk: securityDecision.risk,
          securityAction: securityDecision.action,
          policyBrokerAction: securityBrokerDecision.action,
          policyBrokerReceiptId: securityBrokerDecision.receipt.receiptId,
        },
      });
      throw new Error(this.formatSecurityBlockMessage(securityDecision, securityBrokerDecision));
    }

    const sensitiveDataFindings = this.evaluateSensitiveDataPolicy(input, securityDecision);
    if (sensitiveDataFindings.length > 0) {
      const sensitiveDataBrokerDecision = decideSecurityPolicy({
        surface: 'tool',
        operation: 'sensitive_data_egress',
        target: toolName,
        workspace,
        blocked: true,
        risk: 'forbidden',
        rule: 'RAW_SECRET_EGRESS_BLOCKED',
        reasons: [
          'Raw sensitive values were passed to a tool capable of external egress.',
          ...sensitiveDataFindings.slice(0, 5).map((finding) => `${finding.kind} em ${finding.path}.`),
        ],
      });
      await this.recordTelemetry(traceId, 'tool.failed', 'blocked_by_sensitive_data_policy', {
        toolName,
        argKeys,
        securityRule: 'RAW_SECRET_EGRESS_BLOCKED',
        findingCount: sensitiveDataFindings.length,
        findings: sensitiveDataFindings,
        policyBrokerAction: sensitiveDataBrokerDecision.action,
        policyBrokerReceiptId: sensitiveDataBrokerDecision.receipt.receiptId,
      });
      await this.hookPipeline.run({
        event: 'runtime.exec_failed',
        workspace,
        context: {
          traceId,
          toolName,
          reason: 'blocked_by_sensitive_data_policy',
          securityRule: 'RAW_SECRET_EGRESS_BLOCKED',
          findingCount: sensitiveDataFindings.length,
          policyBrokerAction: sensitiveDataBrokerDecision.action,
          policyBrokerReceiptId: sensitiveDataBrokerDecision.receipt.receiptId,
        },
      });
      throw new Error(this.formatSensitiveDataBlockMessage(
        toolName,
        sensitiveDataFindings,
        sensitiveDataBrokerDecision,
      ));
    }

    this.logRepo.log('info', 'ToolExecutor', `Executando tool: ${toolName}`);
    await this.recordTelemetry(traceId, 'tool.started', 'running', {
      toolName,
      argKeys,
      securityRule: securityDecision.rule,
      securityRisk: securityDecision.risk,
      securityAction: securityDecision.action,
      securityCapabilities: securityDecision.capabilities,
      policyBrokerAction: securityBrokerDecision.action,
      policyBrokerReceiptId: securityBrokerDecision.receipt.receiptId,
    });

    try {
      const result = await tool.execute(input);
      await this.recordTelemetry(traceId, 'tool.completed', 'success', {
        toolName,
        resultLength: String(result || '').length,
      });
      await this.hookPipeline.run({
        event: 'runtime.after_execute',
        workspace,
        context: {
          traceId,
          toolName,
          resultLength: String(result || '').length,
        },
      });
      return result;
    } catch (error: unknown) {
      const message = redactSensitiveText(error instanceof Error ? error.message : String(error));
      this.logRepo.log('error', 'ToolExecutor', `Erro na tool ${toolName}: ${message}`);
      await this.recordTelemetry(traceId, 'tool.failed', 'failed', {
        toolName,
        errorMessage: message,
      });
      await this.hookPipeline.run({
        event: 'runtime.exec_failed',
        workspace,
        context: {
          traceId,
          toolName,
          reason: 'tool_execution_failed',
          errorMessage: message,
        },
      });
      throw error;
    }
  }

  private resolveTraceId(toolName: string, args: Record<string, unknown>): string {
    const metadata = args.metadata && typeof args.metadata === 'object'
      ? args.metadata as Record<string, unknown>
      : {};
    const candidates = [
      args.traceId,
      args.trace_id,
      metadata.traceId,
      metadata.trace_id,
      args.taskId ? `task:${String(args.taskId)}` : null,
      args.task_id ? `task:${String(args.task_id)}` : null,
    ];

    for (const candidate of candidates) {
      const normalized = String(candidate || '').trim();
      if (normalized) {
        return normalized;
      }
    }

    return `tool:${toolName}:${uuidv4()}`;
  }

  private describeArgKeys(args: unknown): string[] {
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      return [];
    }

    return Object.keys(args).slice(0, 20);
  }

  private evaluateSecurityPolicy(
    toolName: string,
    args: Record<string, unknown>,
    metadata: Record<string, unknown>,
    workspace: string | null,
  ): AgentPolicyDecision {
    const registryWithSecurity = this.registry as ToolRegistry & {
      getAllToolSecurityDefinitions?: () => ReturnType<ToolRegistry['getAllToolSecurityDefinitions']>;
    };
    const securityDefinitions = typeof registryWithSecurity.getAllToolSecurityDefinitions === 'function'
      ? registryWithSecurity.getAllToolSecurityDefinitions()
      : [resolveDefaultAgentToolSecurityDefinition(toolName)];
    const engine = this.securityPolicyEngine || AgentSecurityPolicyEngine.fromDefinitions(
      securityDefinitions,
    );

    const sourceTrust = this.resolveInputTrust(args, metadata);
    const securityProfile = resolveSecurityProfile({
      profile: metadata.securityProfile || metadata.security_profile || args.securityProfile || args.security_profile,
      metadata,
      workspace,
    });
    return engine.evaluateToolInvocation({
      toolName,
      operation: 'execute',
      sourceTrust,
      securityProfile: securityProfile.profile.id,
      userConfirmed: sourceTrust === 'untrusted-content'
        ? false
        : this.resolveUserConfirmation(toolName, args, metadata),
      metadata: {
        argKeys: this.describeArgKeys(args),
        securityProfile: securityProfile.profile.id,
        securityProfileSource: securityProfile.source,
      },
    });
  }

  private resolveInputTrust(
    args: Record<string, unknown>,
    metadata: Record<string, unknown>,
  ): AgentInputTrust {
    if (containsUntrustedContentMarker(args) || containsUntrustedContentMarker(metadata)) {
      return 'untrusted-content';
    }

    const candidates = [
      metadata.sourceTrust,
      metadata.inputTrust,
      args.sourceTrust,
      args.inputTrust,
    ].map((value) => String(value || '').trim());
    const candidate = candidates.find(Boolean);
    if (
      candidate === 'trusted-system' ||
      candidate === 'trusted-user' ||
      candidate === 'trusted-runtime' ||
      candidate === 'untrusted-content' ||
      candidate === 'unknown'
    ) {
      return candidate;
    }

    return 'trusted-user';
  }

  private resolveUserConfirmation(
    toolName: string,
    args: Record<string, unknown>,
    metadata: Record<string, unknown>,
  ): boolean {
    const verification = verifyToolSecurityApprovalEnvelope({
      toolName,
      args,
      envelope: extractToolSecurityApprovalEnvelope(args, metadata),
    });

    return verification.ok;
  }

  private evaluateSensitiveDataPolicy(
    args: Record<string, unknown>,
    decision: AgentPolicyDecision,
  ): SensitiveDataFinding[] {
    if (!requiresSensitiveDataEgressGuard(decision.capabilities)) {
      return [];
    }
    return detectSensitiveData(args);
  }

  private evaluateSecurityPolicyBroker(
    toolName: string,
    args: Record<string, unknown>,
    metadata: Record<string, unknown>,
    workspace: string | null,
    decision: AgentPolicyDecision,
  ): SecurityPolicyBrokerDecision {
    return decideSecurityPolicy({
      surface: 'tool',
      operation: 'execute',
      target: toolName,
      workspace,
      sourceTrust: this.resolveInputTrust(args, metadata),
      profile: decision.securityProfile?.id,
      metadata,
      toolDecision: decision,
      reasons: ['Tool invocation was evaluated by the central policy broker.'],
    });
  }

  private formatSecurityBlockMessage(
    decision: AgentPolicyDecision,
    brokerDecision: SecurityPolicyBrokerDecision,
  ): string {
    if (decision.action === 'require_confirmation') {
      return [
        formatUserFacingSecurityApprovalMessage(decision),
        `A tool "${decision.toolName}" exige confirmacao de seguranca antes da execucao.`,
        `Risco: ${decision.risk}.`,
        `Capacidades: ${decision.capabilities.join(', ')}.`,
        `Regra: ${decision.rule}.`,
        formatSecurityPolicyReceipt(brokerDecision.receipt),
      ].join(' ');
    }

    return [
      `A tool "${decision.toolName}" foi bloqueada pela politica central de seguranca.`,
      `Regra: ${decision.rule}.`,
      `Motivos: ${decision.reasons.join(' ')}`,
      formatSecurityPolicyReceipt(brokerDecision.receipt),
    ].join(' ');
  }

  private formatSensitiveDataBlockMessage(
    toolName: string,
    findings: SensitiveDataFinding[],
    brokerDecision: SecurityPolicyBrokerDecision,
  ): string {
    const summary = findings
      .slice(0, 5)
      .map((finding) => `${finding.kind} em ${finding.path}`)
      .join(', ');
    return [
      `A tool "${toolName}" foi bloqueada pela politica de exfiltracao de dados sensiveis.`,
      'Use SecretRef ou um canal de credenciais aprovado em vez de passar segredo bruto nos argumentos.',
      `Regra: RAW_SECRET_EGRESS_BLOCKED.`,
      `Achados: ${summary}.`,
      formatSecurityPolicyReceipt(brokerDecision.receipt),
    ].join(' ');
  }

  private resolveWorkspace(value: string | null | undefined): string | null {
    const normalized = String(value || '').trim();
    if (normalized) {
      return normalized;
    }
    return this.defaultWorkspace || process.cwd();
  }

  private async recordTelemetry(
    traceId: string,
    eventType: string,
    status: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!this.telemetryRuntime) {
      return;
    }

    try {
      await this.telemetryRuntime.record({
        traceId,
        source: 'tool-executor',
        eventType,
        status,
        payload,
      });
    } catch {
      // telemetry should never break tool execution
    }
  }
}
