import { DynamicHierarchySwarmService, type DynamicHierarchyLaunchResult } from '../../domain/execution/application/DynamicHierarchySwarmService.js';
import type { ExecutionEscalationDecision } from './ExecutionEscalationPolicy.js';
import type { SelfModificationPreviewResult } from '../../services/SelfModificationCommandService.js';
import type { WatchModeRunSnapshot } from '../../services/ComputerUseWatchModeService.js';
import type { TrustSliderLevel, TrustSliderPolicyDecision, UniversalIntentUserRole } from '../uni/UniversalIntentContracts.js';
import type { CapabilityNegotiationSnapshot } from './CapabilityNegotiationService.js';
import type { ToolRehearsalSnapshot } from './ToolRehearsalService.js';
import type { UniversalAgentExecutor, UniversalAgentRequest, UniversalAgentRun, UniversalAgentRunResult, UniversalApprovalRequest } from './UniversalAgentRuntimeTypes.js';
import { type AgentRunFlowHost, hasRequestedTool, normalizeStringList, normalizeText, recordOrNull } from './AgentRunSpecializedFlowUtils.js';

export function installAgentRunSwarmFlows(AgentRunServiceClass: { prototype: AgentRunFlowHost }): void {
  const proto = AgentRunServiceClass.prototype;

  proto.createSwarmEscalationProposalIfNeeded = function (this: AgentRunFlowHost, 
    run: UniversalAgentRun,
    input: UniversalAgentRequest,
  ): UniversalAgentRunResult | null {
    if (!this.shouldProposeSwarmEscalation(input, run)) {
      return null;
    }

    const decision = this.executionEscalationPolicy.resolve({
      complexObjective: true,
      taskGoal: normalizeText(input.text, run.input),
      suggestedSubagents: this.resolveSuggestedSubagents(input.metadata),
      metadata: {
        requestedTools: input.requestedTools || [],
        responseDecision: input.metadata?.responseDecision || null,
      },
    });
    if (!decision.shouldEscalate || decision.target !== 'swarm') {
      return null;
    }

    const now = this.now().toISOString();
    const approval: UniversalApprovalRequest = {
      id: this.idFactory('approval'),
      runId: run.id,
      title: 'Aprovar swarm estruturado',
      reason: 'Pedido natural gerou proposta de subagentes; aprovacao e exigida antes de executar o Swarm.',
      risk: 'attention',
      status: 'pending',
      createdAt: now,
    };

    run.status = 'waiting_approval';
    run.summary = 'Proposta de swarm estruturado aguardando aprovacao.';
    run.updatedAt = now;
    run.metadata = {
      ...run.metadata,
      executionEscalation: decision,
      swarmEscalationProposal: {
        source: 'AgentRunService',
        target: decision.target,
        reason: decision.reason,
        subagentReceiptCount: decision.subagentReceipts.length,
        approvalId: approval.id,
        launchServiceCalled: false,
      },
    };
    run.events.push({
      id: this.idFactory('agent-event'),
      runId: run.id,
      kind: 'planning',
      title: 'Proposta de swarm estruturada',
      detail: `Escalacao para swarm planejada com ${decision.subagentReceipts.length} subagente(s).`,
      status: 'pending',
      createdAt: now,
      metadata: {
        target: decision.target,
        reason: decision.reason,
        subagentReceiptCount: decision.subagentReceipts.length,
        launchServiceCalled: false,
      },
    });
    run.approvals.push(approval);
    run.events.push({
      id: this.idFactory('agent-event'),
      runId: run.id,
      kind: 'approval',
      title: approval.title,
      detail: approval.reason,
      status: 'pending',
      createdAt: now,
      metadata: {
        approvalId: approval.id,
        target: 'swarm',
        subagentReceiptCount: decision.subagentReceipts.length,
      },
    });

    this.applyCapabilityLoopGovernance(run, input);
    const narrative = this.applySafetyNarrative(run, now);
    return this.replyPipeline.buildResult({
      run,
      text: [
        this.buildSwarmEscalationReply(decision, approval.id),
        '',
        narrative.userMessage,
      ].join('\n'),
    });
  };

  proto.resolveSuggestedSubagents = function (this: AgentRunFlowHost, metadata?: Record<string, unknown>): string[] {
    const responseDecision = recordOrNull(metadata?.responseDecision);
    return Array.from(new Set([
      ...normalizeStringList(metadata?.suggestedSubagents),
      ...normalizeStringList(metadata?.subagents),
      ...normalizeStringList(responseDecision?.suggestedSubagents),
    ])).slice(0, 8);
  };

  proto.buildSwarmEscalationReply = function (this: AgentRunFlowHost, 
    decision: ExecutionEscalationDecision,
    approvalId: string,
  ): string {
    return [
      'Proposta de swarm estruturado preparada.',
      '',
      `Objetivo: ${decision.taskGoal || 'objetivo nao informado'}`,
      `Subagentes planejados: ${decision.subagentReceipts.length}.`,
      'Aguardando aprovacao antes de executar subagentes ou abrir o Swarm.',
      `Approval: ${approvalId}`,
    ].join('\n');
  };

  proto.executeApprovedSwarmProposalIfNeeded = async function (this: AgentRunFlowHost, 
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): Promise<UniversalAgentRunResult | null> {
    const proposal = recordOrNull(run.metadata?.swarmEscalationProposal);
    const escalation = recordOrNull(run.metadata?.executionEscalation);
    const target = normalizeText(proposal?.target, normalizeText(escalation?.target));
    if (target !== 'swarm' && !this.shouldProposeSwarmEscalation(request, run)) {
      return null;
    }

    const swarmHierarchyService = this.swarmHierarchyService || new DynamicHierarchySwarmService();
    const launchInput = {
      hierarchyId: run.id,
      objective: normalizeText(request.text, run.input),
      requestedBy: normalizeText(request.userId, run.userId),
      surface: request.channel || run.channel,
      subagentBudget: recordOrNull(proposal?.subagentBudget) || null,
    };
    const launchHierarchyAndWait = swarmHierarchyService.launchHierarchyAndWait;
    const asyncCompletionReturned = typeof launchHierarchyAndWait === 'function';
    const launchResult = await Promise.resolve(asyncCompletionReturned
      ? launchHierarchyAndWait(launchInput)
      : swarmHierarchyService.launchHierarchy(launchInput));
    const now = this.now().toISOString();
    const snapshot = launchResult.snapshot;
    const completed = snapshot.status === 'completed';
    const failed = snapshot.status === 'failed' || snapshot.status === 'cancelled' || snapshot.status === 'timed_out';
    const statusText = completed
      ? 'concluido'
      : failed
        ? `finalizado com status ${snapshot.status}`
        : `iniciado com status ${snapshot.status}`;
    const summary = `Swarm aprovado e ${statusText} pelo runtime existente.`;

    run.status = failed ? 'failed' : 'completed';
    run.summary = summary;
    run.updatedAt = now;
    run.metadata = {
      ...run.metadata,
      swarmEscalationProposal: {
        ...(proposal || {}),
        launchServiceCalled: true,
        asyncCompletionReturned,
        approvedAt: now,
      },
      swarmExecutionResult: {
        ...this.serializeSwarmLaunchResult(launchResult),
        asyncCompletionReturned,
      },
    };
    run.events.push({
      id: this.idFactory('agent-event'),
      runId: run.id,
      kind: 'tool',
      title: 'DynamicHierarchySwarmService',
      detail: summary,
      status: failed ? 'failed' : 'done',
      createdAt: now,
      metadata: {
        source: 'DynamicHierarchySwarmService',
        swarmId: snapshot.swarmId,
        swarmStatus: snapshot.status,
        subagentReceiptCount: snapshot.subagentReceipts?.length || launchResult.plan.subagentReceipts.length,
        replyPipelineReturn: true,
        asyncCompletionReturned,
      },
    });

    this.applyCapabilityLoopGovernance(run, request);
    return this.replyPipeline.buildResult({
      run,
      text: this.buildSwarmExecutionReply(launchResult, summary),
    });
  };

  proto.serializeSwarmLaunchResult = function (this: AgentRunFlowHost, 
    launchResult: DynamicHierarchyLaunchResult,
  ): Record<string, unknown> {
    return {
      source: 'DynamicHierarchySwarmService',
      launchServiceCalled: true,
      hierarchyId: launchResult.plan.hierarchyId,
      swarmId: launchResult.snapshot.swarmId,
      status: launchResult.snapshot.status,
      objective: launchResult.plan.objective,
      complexity: launchResult.plan.complexity,
      leafRoleCount: launchResult.plan.leafRoles.length,
      subagentReceiptCount: launchResult.snapshot.subagentReceipts?.length || launchResult.plan.subagentReceipts.length,
      traceId: launchResult.snapshot.traceId || launchResult.plan.traceId,
      runId: launchResult.snapshot.runId || launchResult.plan.runId,
    };
  };

  proto.buildSwarmExecutionReply = function (this: AgentRunFlowHost, 
    launchResult: DynamicHierarchyLaunchResult,
    summary: string,
  ): string {
    const snapshot = launchResult.snapshot;
    const synthesizedOutput = normalizeText(snapshot.synthesizedOutput);
    return [
      summary,
      '',
      `Swarm: ${snapshot.swarmId}`,
      `Status: ${snapshot.status}`,
      `Subagentes: ${snapshot.subagentReceipts?.length || launchResult.plan.subagentReceipts.length}`,
      synthesizedOutput ? ['', synthesizedOutput].join('\n') : '',
    ].filter(Boolean).join('\n');
  };
}

