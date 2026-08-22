import type { ZavorthEchoService } from './ZavorthEchoService.js';
import type { PermissionRequest } from './ZavorthProactivePermissionService.js';
import type { EchoExecutionEntry, EchoToolCall } from '../tool-runtime/types/ToolRuntimeTypes.js';
import type {
  NormalizedInboundMessage,
  UniversalApprovalIntentDecisionResult,
  UniversalApprovalIntentResolveInput,
  UniversalAgentRunResult,
} from '../runtime/agent/index.js';
import {
  presentUniversalApprovalIntentDecision,
  renderUniversalApprovalIntentDecisionResult,
} from '../runtime/agent/index.js';
import { OperationalMaturityService } from '../domain/platform-ecosystem/application/OperationalMaturityService.js';

import type { OperationalMaturitySnapshot } from '../contracts/OperationalMaturityContract.js';
import type { NexusExecuteRequestDto } from './ZavorthControlEchoRouteSchemas.js';
import { AgentMeshOrchestrationService } from './AgentMeshOrchestrationService.js';
import { AgentMeshLedgerService } from './AgentMeshLedgerService.js';
import { AgentMeshExecutionService } from './AgentMeshExecutionService.js';
import { SalesPackChannelIoService } from './SalesPackChannelIoService.js';
import { ZavorthCapabilityPackReadinessDoctorService } from './ZavorthCapabilityPackReadinessDoctorService.js';
import type {
  CapabilityPackItemReadiness,
  CapabilityPackReadinessSnapshot,
} from '../contracts/CapabilityPackReadinessContract.js';

type AgentGatewayLike = {
  handle(input: NormalizedInboundMessage): Promise<UniversalAgentRunResult>;
  resolveApprovalIntent?: (
    input: Omit<UniversalApprovalIntentResolveInput, 'runs'>,
  ) => Promise<UniversalApprovalIntentDecisionResult>;
};

export type OperatorExecuteInput = {
  request: NexusExecuteRequestDto;
  echo: ZavorthEchoService;
  agentGateway?: AgentGatewayLike | null;
};

export type NexusExecuteInput = OperatorExecuteInput;

/**
 * ZavorthOperatorFacadeService is a product/API facade over the canonical runtime, not a parallel brain.
 * It prefers the Agent Gateway and falls back to Echo only as an edge layer.
 */
export class ZavorthOperatorFacadeService {
  private readonly maturity: OperationalMaturityService;
  private readonly readinessDoctor: ZavorthCapabilityPackReadinessDoctorService;
  private readonly agentMesh: AgentMeshOrchestrationService;
  private readonly agentMeshLedger: AgentMeshLedgerService;
  private readonly agentMeshExecutor: AgentMeshExecutionService;
  private readonly salesPackChannelIo: SalesPackChannelIoService;

  constructor(
    options: {
      maturity?: OperationalMaturityService;
      readinessDoctor?: ZavorthCapabilityPackReadinessDoctorService;
      agentMesh?: AgentMeshOrchestrationService;
      agentMeshLedger?: AgentMeshLedgerService;
      agentMeshExecutor?: AgentMeshExecutionService;
      salesPackChannelIo?: SalesPackChannelIoService;
    } = {},
  ) {
    this.maturity = options.maturity || new OperationalMaturityService();
    this.readinessDoctor = options.readinessDoctor || new ZavorthCapabilityPackReadinessDoctorService();
    this.agentMesh = options.agentMesh || new AgentMeshOrchestrationService();
    this.agentMeshLedger = options.agentMeshLedger || new AgentMeshLedgerService();
    this.agentMeshExecutor =
      options.agentMeshExecutor ||
      new AgentMeshExecutionService({
        orchestrationService: this.agentMesh,
        ledgerService: this.agentMeshLedger,
      });
    this.salesPackChannelIo = options.salesPackChannelIo || new SalesPackChannelIoService();
  }

  public async execute(input: NexusExecuteInput): Promise<Record<string, unknown>> {
    const normalizedInboundMessage = this.buildInboundMessage(input.request);

    if (input.agentGateway) {
      // agent-first: free-text prompts never keyword-route to approvals.
      // Only structured metadata.decision/ref or explicit slash/callback tokens.
      const approvalInput = this.buildApprovalIntentInput(input.request, normalizedInboundMessage);
      const hasStructuredApprovalSignal =
        Boolean(approvalInput.decision || approvalInput.ref) ||
        /^\/(approve|reject|approve|reject)\b/i.test(String(approvalInput.text || '')) ||
        /\b(?:approval|agent|run|task):?(approve|reject|approve|reject):/i.test(String(approvalInput.text || ''));
      const approvalIntent =
        hasStructuredApprovalSignal && input.agentGateway.resolveApprovalIntent
          ? await input.agentGateway.resolveApprovalIntent(approvalInput)
          : null;
      if (approvalIntent && approvalIntent.resolution.status !== 'not_approval_intent') {
        return this.buildApprovalIntentGatewayResponse(approvalIntent, normalizedInboundMessage);
      }

      const result = await input.agentGateway.handle(normalizedInboundMessage);
      return this.buildGatewayResponse(result, normalizedInboundMessage);
    }

    const fallback = await input.echo.processIntent(input.request.prompt, {
      category: input.request.category,
      sessionId: input.request.sessionId,
      requestedBy: input.request.requestedBy,
      surface: input.request.surface || 'nexus',
    });
    return this.buildEchoFallbackResponse(fallback, normalizedInboundMessage);
  }

  public async buildStatus(input: {
    echo: ZavorthEchoService;
    agentGatewayAvailable: boolean;
  }): Promise<Record<string, unknown>> {
    const [echoSnapshot, maturitySnapshot] = await Promise.all([
      input.echo.buildSnapshot(),
      Promise.resolve(this.maturity.buildSnapshot()),
    ]);
    return this.buildStatusPayload({
      echoSnapshot,
      maturitySnapshot,
      agentGatewayAvailable: input.agentGatewayAvailable,
    });
  }

  public async buildCapabilities(input: { echo: ZavorthEchoService }): Promise<Record<string, unknown>> {
    const [echoSnapshot, maturitySnapshot] = await Promise.all([
      input.echo.buildSnapshot(),
      Promise.resolve(this.maturity.buildSnapshot()),
    ]);

    return {
      ok: true,
      source: 'NexusFacadeService',
      role: 'capability-surface',
      tools: Array.isArray(echoSnapshot.tools) ? echoSnapshot.tools : [],
      capabilityLifecycle: Array.isArray(echoSnapshot.capabilityLifecycle) ? echoSnapshot.capabilityLifecycle : [],
      maturity: maturitySnapshot.consoleRows,
      receipts: ['capabilities-read-from-canonical-echo-surface', 'maturity-read-from-operational-truth-matrix'],
    };
  }

  public async buildWorkbench(input: {
    echo: ZavorthEchoService;
    agentGatewayAvailable: boolean;
  }): Promise<Record<string, unknown>> {
    const [echoSnapshot, connection, maturitySnapshot] = await Promise.all([
      input.echo.buildSnapshot(),
      input.echo.testConnection(),
      Promise.resolve(this.maturity.buildSnapshot()),
    ]);
    const pendingPermissions = input.echo.getPendingPermissions();
    const status = this.buildStatusPayload({
      echoSnapshot,
      maturitySnapshot,
      agentGatewayAvailable: input.agentGatewayAvailable,
    });
    const echoExperience = this.buildEchoExperiencePayload({
      echoSnapshot,
      connection,
      pendingPermissions,
    });
    const summary = this.toRecord(echoSnapshot.summary);
    const tools = Array.isArray(echoSnapshot.tools) ? echoSnapshot.tools : [];
    const capabilityLifecycle = Array.isArray(echoSnapshot.capabilityLifecycle) ? echoSnapshot.capabilityLifecycle : [];
    const history = input.echo.getHistory(10);
    const categoryCounts = this.toRecord(summary.categoryCounts);
    const firstNonStableCapability = maturitySnapshot.consoleRows.find((row) => row.status !== 'stable') || null;
    const provisionedEdges = this.buildProvisionedEdgeReadiness(maturitySnapshot);
    const operatorExperience = this.buildOperatorExperiencePayload({
      agentGatewayAvailable: input.agentGatewayAvailable,
      providerOnline: connection.online,
      pendingCount: pendingPermissions.length,
      capabilityNextStep: firstNonStableCapability?.nextStep || null,
      provisionedEdges,
    });

    return {
      ok: true,
      source: 'NexusFacadeService',
      view: 'nexus-workbench',
      generatedAt: new Date().toISOString(),
      operatorExperience,
      runtime: {
        primary: input.agentGatewayAvailable ? 'ZavorthAgentGateway' : 'ZavorthEchoService',
        agentGatewayAvailable: input.agentGatewayAvailable,
        echoFallbackAvailable: true,
        status,
      },
      execution: {
        recentCount: history.length,
        recent: history.map((entry: EchoExecutionEntry) => ({
          id: entry.id,
          timestamp: entry.timestamp,
          prompt: entry.prompt,
          status: entry.status,
          durationMs: entry.durationMs,
          tools: Array.isArray(entry.toolCalls) ? entry.toolCalls.map((toolCall: EchoToolCall) => toolCall.toolName) : [],
          finalResponse: entry.finalResponse,
        })),
      },
      approvals: {
        pendingCount: pendingPermissions.length,
        pending: pendingPermissions.map((permission: PermissionRequest) => ({
          id: permission.id,
          action: permission.action,
          reason: permission.reason,
          requestedAt: permission.requestedAt,
          status: permission.status,
          resolveRoute: '/api/v2/nexus/permissions/resolve',
        })),
      },
      capabilities: {
        totalTools: tools.length || Number(summary.totalTools || 0),
        categories: categoryCounts,
        lifecycle: capabilityLifecycle,
        maturity: maturitySnapshot.consoleRows,
        provisionedEdges,
        readiness: firstNonStableCapability
          ? {
              state: 'needs_attention',
              capabilityId: firstNonStableCapability.id,
              status: firstNonStableCapability.status,
              nextStep: firstNonStableCapability.nextStep,
            }
          : {
              state: 'ready',
              capabilityId: null,
              status: 'stable',
              nextStep: null,
            },
      },
      agentMesh: {
        orchestration: this.agentMesh.buildSnapshot(),
        ledger: this.agentMeshLedger.buildSnapshot(),
      },
      salesPackChannelIo: this.salesPackChannelIo.buildSnapshot(),
      echoExperience,
      actions: [
        {
          id: 'safe-status-check',
          kind: 'safe_execution',
          method: 'POST',
          route: '/api/v2/nexus/execute',
          risk: 'read_only',
          prompt:
            'Mostre um status operational resumido do Zavorth without alterar files, run shell, acessar rede external or secrets.',
        },
        {
          id: 'resolve-approval',
          kind: 'approval_resolution',
          method: 'POST',
          route: '/api/v2/nexus/permissions/resolve',
          risk: 'owner_decision',
        },
        {
          id: 'capability-readiness',
          kind: 'capability_readiness',
          method: 'GET',
          route: '/api/v2/nexus/capabilities',
          risk: 'read_only',
        },
      ],
      receipts: [
        'nexus-workbench-uses-canonical-gateway',
        'echo-fallback-visible-not-hidden',
        'approvals-resolve-through-canonical-echo-route',
        'provisioned-voice-browser-readiness-visible',
        'operator-experience-summary-visible',
      ],
    };
  }

  public async buildEchoExperience(input: { echo: ZavorthEchoService }): Promise<Record<string, unknown>> {
    const [echoSnapshot, connection] = await Promise.all([input.echo.buildSnapshot(), input.echo.testConnection()]);
    return this.buildEchoExperiencePayload({
      echoSnapshot,
      connection,
      pendingPermissions: input.echo.getPendingPermissions(),
    });
  }

  private buildEchoExperiencePayload(input: {
    echoSnapshot: Awaited<ReturnType<ZavorthEchoService['buildSnapshot']>>;
    connection: Awaited<ReturnType<ZavorthEchoService['testConnection']>>;
    pendingPermissions: ReturnType<ZavorthEchoService['getPendingPermissions']>;
  }): Record<string, unknown> {
    const { echoSnapshot, connection, pendingPermissions } = input;
    const summary = this.toRecord(echoSnapshot.summary);
    const watchMode = this.toRecord(echoSnapshot.watchMode);
    const voiceMetrics = this.toRecord(echoSnapshot.voiceMetrics);

    return {
      source: 'NexusFacadeService',
      view: 'echo-continuity',
      status: pendingPermissions.length > 0 ? 'waiting_confirmation' : connection.online ? 'ready' : 'degraded',
      provider: {
        online: connection.online,
        model: connection.model,
        providerName: connection.providerName,
        latencyMs: connection.latencyMs,
      },
      fallback: {
        available: true,
        recentExecutions: Number(summary.recentExecutions || 0),
      },
      voice: {
        totalRequests: Number(voiceMetrics.totalRequests || 0),
        successes: Number(voiceMetrics.successes || 0),
        failures: Number(voiceMetrics.failures || 0),
        surfaces: Array.isArray(voiceMetrics.surfaces) ? voiceMetrics.surfaces : [],
      },
      watchMode: {
        posture: this.readString(watchMode.posture) || 'unknown',
        activeStatus: this.readString(watchMode.activeStatus) || null,
        pendingApprovals: Number(watchMode.pendingApprovals || 0),
        nextAction: this.readString(watchMode.nextAction) || null,
      },
      approvals: {
        pendingCount: pendingPermissions.length,
        route: '/api/v2/echo/permissions',
      },
      receipts: ['echo-experience-is-read-only', 'voice-and-fallback-state-visible', 'pending-approvals-surfaced'],
    };
  }

  private buildStatusPayload(input: {
    echoSnapshot: Awaited<ReturnType<ZavorthEchoService['buildSnapshot']>>;
    maturitySnapshot: OperationalMaturitySnapshot;
    agentGatewayAvailable: boolean;
  }): Record<string, unknown> {
    const echoSummary = this.toRecord(input.echoSnapshot.summary);

    return {
      ok: true,
      source: 'NexusFacadeService',
      role: 'converged-product-surface',
      primaryRuntime: input.agentGatewayAvailable ? 'ZavorthAgentGateway' : 'ZavorthEchoService',
      agentGatewayAvailable: input.agentGatewayAvailable,
      echoFallbackAvailable: true,
      maturity: {
        summary: input.maturitySnapshot.summary,
        invariants: input.maturitySnapshot.invariants,
      },
      echo: {
        totalTools: Number(echoSummary.totalTools || 0),
        llmOnline: echoSummary.llmOnline === true,
        preferredProvider: this.readString(echoSummary.preferredProvider) || 'unknown',
        recentExecutions: Number(echoSummary.recentExecutions || 0),
      },
      receipts: ['nexus-is-facade-not-parallel-runtime', 'agent-gateway-preferred', 'echo-is-edge-fallback'],
    };
  }

  private buildOperatorExperiencePayload(input: {
    agentGatewayAvailable: boolean;
    providerOnline: boolean;
    pendingCount: number;
    capabilityNextStep: string | null;
    provisionedEdges: Array<Record<string, unknown>>;
  }): Record<string, unknown> {
    const provisionedAttention =
      input.provisionedEdges.find((edge) => {
        const readiness = this.toRecord(edge.readiness);
        return this.readString(readiness.status) !== 'ready_for_activation_request';
      }) || null;
    const capabilityNextStep =
      input.capabilityNextStep ||
      this.readString(this.toRecord(provisionedAttention?.readiness).nextAction) ||
      this.readString(provisionedAttention?.nextStep) ||
      null;
    const tone =
      input.pendingCount > 0
        ? 'decision'
        : !input.providerOnline ? 'warning'
          : !input.agentGatewayAvailable ? 'fallback'
            : capabilityNextStep ? 'attention'
              : 'ok';
    const primaryMessage =
      input.pendingCount > 0
        ? `${input.pendingCount} confirmation(s) await your decision.`
        : !input.providerOnline ? 'Primary provider did not respond; Echo keeps exposing state safely.'
          : !input.agentGatewayAvailable ? 'Agent Gateway unavailable; Nexus is usando fallback Echo without esconder isso.'
            : capabilityNextStep ? 'Nexus is ready, mas ha uma provisioned capability que merece attention.'
              : 'Nexus is ready to operate as Zavorth convergent panel.';
    const nextStep =
      input.pendingCount > 0
        ? 'Approve or deny pending requests.'
        : capabilityNextStep || 'Continue using it; no urgent correction.';

    return {
      statusLabel:
        tone === 'ok'
          ? 'ready'
          : tone === 'decision'
            ? 'Waiting for decision'
            : tone === 'fallback'
              ? 'Fallback seguro'
              : 'Atencao',
      tone,
      primaryMessage,
      nextStep,
      cards: [
        {
          id: 'runtime',
          label: 'Runtime',
          value: input.agentGatewayAvailable ? 'Principal' : 'Fallback Echo',
          tone: input.agentGatewayAvailable ? 'ok' : 'fallback',
          detail: input.agentGatewayAvailable ? 'Nexus is ligado ao Agent Gateway.'
            : 'Nexus does not bypass the gateway; fallback to Echo remains visible.',
        },
        {
          id: 'approvals',
          label: 'Approvals',
          value: input.pendingCount > 0 ? `${input.pendingCount} pending(s)` : 'Livre',
          tone: input.pendingCount > 0 ? 'decision' : 'ok',
          detail:
            input.pendingCount > 0
              ? 'requests sensitive are pausados ate sua decision.'
              : 'No sensitive request is waiting.',
        },
        {
          id: 'provider',
          label: 'Provider',
          value: input.providerOnline ? 'Online' : 'Em observation',
          tone: input.providerOnline ? 'ok' : 'warning',
          detail: input.providerOnline ? 'Modelo respondeu no latest probe do Echo.'
            : 'Use readiness/provider doctor before depender de LLM live.',
        },
        {
          id: 'capabilities',
          label: 'Capacidades',
          value: capabilityNextStep ? 'Ajustar' : 'Readys',
          tone: capabilityNextStep ? 'attention' : 'ok',
          detail: capabilityNextStep || 'without next passo pending.',
        },
      ],
    };
  }

  private buildProvisionedEdgeReadiness(maturitySnapshot: OperationalMaturitySnapshot): Array<Record<string, unknown>> {
    return maturitySnapshot.capabilities
      .filter((capability) => capability.status === 'official-but-provisioned')
      .map((capability) => {
        const readiness = this.resolveProvisionedReadiness(capability.id);
        return {
          id: capability.id,
          label: capability.label,
          status: capability.status,
          publicStatus: capability.publicStatus,
          runtimeTruth: capability.runtimeTruth,
          ownerLayer: capability.ownerLayer,
          commands: capability.commands.map((command) => command.value),
          limitations: capability.limitations,
          nextStep: capability.nextStep,
          readiness: readiness ? this.serializeReadiness(readiness) : null,
        };
      });
  }

  private resolveProvisionedReadiness(capabilityId: string): CapabilityPackItemReadiness | null {
    const target = this.resolveReadinessTarget(capabilityId);
    if (!target) {
      return null;
    }
    const snapshot: CapabilityPackReadinessSnapshot = this.readinessDoctor.buildSnapshot(target);
    return snapshot.items[0] || null;
  }

  private resolveReadinessTarget(capabilityId: string): { packId: string; targetItemId: string } | null {
    if (capabilityId === 'browser-mcp') {
      return {
        packId: 'official-tool-bridges',
        targetItemId: 'mcp:browser-sidecar',
      };
    }
    if (capabilityId === 'local-voice-dictation') {
      return {
        packId: 'official-tool-bridges',
        targetItemId: 'runtime-capability:local-voice-dictation',
      };
    }
    return null;
  }

  private serializeReadiness(readiness: CapabilityPackItemReadiness): Record<string, unknown> {
    return {
      itemId: readiness.itemId,
      label: readiness.label,
      kind: readiness.kind,
      status: readiness.status,
      nextAction: readiness.nextAction,
      blockers: readiness.blockers,
      checks: readiness.checks.map((check) => ({
        id: check.id,
        kind: check.kind,
        status: check.status,
        summary: check.summary,
      })),
    };
  }

  public buildInboundMessage(request: NexusExecuteRequestDto): NormalizedInboundMessage {
    const requestedBy = request.requestedBy || 'nexus-agent';
    const surface = request.surface || 'nexus';
    const sessionId = request.sessionId || `nexus:${requestedBy}`;
    const userId = request.userId || requestedBy;

    return {
      requestId: request.requestId || undefined,
      traceId: request.traceId || null,
      userId,
      sessionId,
      channel: 'api',
      text: request.prompt,
      workspace: request.workspace || null,
      requestedTools: request.requestedTools || [],
      replyPort: {
        id: `${sessionId}:nexus`,
        label: 'Nexus',
        kind: 'api',
        status: 'available',
        primary: true,
        description: 'Surface Nexus convergida to o Zavorth Agent Gateway.',
      },
      metadata: {
        ...(request.metadata || {}),
        source: 'nexus-surface',
        surface,
        requestedBy,
        category: request.category,
        route: '/api/v2/nexus/execute',
        normalizedInboundMessage: true,
      },
    };
  }

  private buildApprovalIntentInput(
    request: NexusExecuteRequestDto,
    normalizedInboundMessage: NormalizedInboundMessage,
  ): Omit<UniversalApprovalIntentResolveInput, 'runs'> {
    const metadata = this.toRecord(request.metadata);
    const ref =
      this.readString(metadata.approvalId) ||
      this.readString(metadata.approval_id) ||
      this.readString(metadata.runId) ||
      this.readString(metadata.run_id) ||
      this.readString(metadata.id) ||
      null;
    const decision = this.readString(metadata.decision) || this.readString(metadata.approvalDecision) || null;

    return {
      text: request.prompt,
      ref,
      decision: decision as UniversalApprovalIntentResolveInput['decision'],
      source: 'api',
      channel: 'api',
      userId: normalizedInboundMessage.userId,
      sessionId: normalizedInboundMessage.sessionId,
    };
  }

  private buildApprovalIntentGatewayResponse(
    result: UniversalApprovalIntentDecisionResult,
    normalizedInboundMessage: NormalizedInboundMessage,
  ): Record<string, unknown> {
    const channel = String(normalizedInboundMessage.channel || result.resolution.channel || 'api').toLowerCase();
    const presentation = presentUniversalApprovalIntentDecision(result, channel);
    return {
      ok: result.ok,
      source: 'ZavorthAgentGateway',
      response: presentation.text || renderUniversalApprovalIntentDecisionResult(result),
      surfaceResponse: presentation.surfaceResponse,
      usedNativeButtons: presentation.usedNativeButtons,
      approvalActions: presentation.actions,
      normalizedInboundMessage,
      approvalIntent: result.resolution,
      run: result.result?.run || result.resolution.target?.run || null,
      approval: result.result?.approval || result.resolution.target?.approval || null,
      replies: result.result?.replies || [],
      nexus: {
        facade: true,
        fallbackUsed: false,
        approvalIntent: true,
        multiApprovalPicker: Boolean(presentation.surfaceResponse),
      },
    };
  }

  private buildGatewayResponse(
    result: UniversalAgentRunResult,
    normalizedInboundMessage: NormalizedInboundMessage,
  ): Record<string, unknown> {
    return {
      ok: result.ok,
      source: 'ZavorthAgentGateway',
      response: result.replies[0]?.text || result.run.summary,
      normalizedInboundMessage,
      run: result.run,
      replies: result.replies,
      nexus: {
        facade: true,
        fallbackUsed: false,
      },
    };
  }

  private buildEchoFallbackResponse(
    result: unknown,
    normalizedInboundMessage: NormalizedInboundMessage,
  ): Record<string, unknown> {
    const gateway = {
      ok: false,
      reason: 'agent_gateway_unavailable',
      fallback: 'ZavorthEchoService',
    };

    if (result && typeof result === 'object' && !Array.isArray(result)) {
      return {
        ...(result as Record<string, unknown>),
        source: 'ZavorthEchoService',
        normalizedInboundMessage,
        gateway,
        nexus: {
          facade: true,
          fallbackUsed: true,
        },
      };
    }

    return {
      status: 'success',
      source: 'ZavorthEchoService',
      result,
      normalizedInboundMessage,
      gateway,
      nexus: {
        facade: true,
        fallbackUsed: true,
      },
    };
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }
}

export { ZavorthOperatorFacadeService as NexusFacadeService };

