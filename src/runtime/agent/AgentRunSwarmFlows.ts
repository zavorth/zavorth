import { DynamicHierarchySwarmService, type DynamicHierarchyLaunchResult } from '../../domain/execution/infrastructure/DynamicHierarchySwarmService.js';
import type {
  SwarmScaleExecutionMode,
  SwarmScalePlannerMode,
  SwarmScaleSnapshot,
} from '../../domain/execution/infrastructure/SwarmScalePlaneService.js';
import type { ExecutionEscalationDecision } from './ExecutionEscalationPolicy.js';
import { assessSwarmWorkload, type SwarmWorkloadAssessment } from './SwarmWorkloadAssessmentService.js';
import type { SelfModificationPreviewResult } from '../../services/SelfModificationCommandService.js';
import type { WatchModeRunSnapshot } from '../../services/ComputerUseWatchModeService.js';
import type { TrustSliderLevel, TrustSliderPolicyDecision, UniversalIntentUserRole } from '../uni/UniversalIntentContracts.js';
import type { CapabilityNegotiationSnapshot } from './CapabilityNegotiationService.js';
import type { ToolRehearsalSnapshot } from './ToolRehearsalService.js';
import type { UniversalAgentExecutor, UniversalAgentRequest, UniversalAgentRun, UniversalAgentRunResult, UniversalApprovalRequest } from './UniversalAgentRuntimeTypes.js';
import { type AgentRunFlowHost, hasRequestedTool, normalizeStringList, normalizeText, recordOrNull } from './AgentRunSpecializedFlowUtils.js';

type SwarmScalePlan = {
  enabled: boolean;
  desiredAgents: number;
  maxAgents: number;
  maxSteps: number;
  maxConcurrency: number;
  plannerMode: SwarmScalePlannerMode;
  executionMode: SwarmScaleExecutionMode;
  rationale: string;
  assessment: SwarmWorkloadAssessment;
};

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

    const scalePlan = this.resolveSwarmScalePlan(input, run);
    const now = this.now().toISOString();
    const approval: UniversalApprovalRequest = {
      id: this.idFactory('approval'),
      runId: run.id,
      title: scalePlan.enabled ? 'Aprovar Swarm Scale Plane' : 'Aprovar swarm estruturado',
      reason: scalePlan.enabled
        ? 'Natural request asked for massive scale; approval is required before opening the Swarm Scale Plane.'
        : 'Natural request generated a subagent proposal; approval is required before executing the Swarm.',
      risk: 'attention',
      status: 'pending',
      createdAt: now,
    };

    run.status = 'waiting_approval';
    run.summary = 'Structured swarm proposal waiting for approval.';
    run.updatedAt = now;
    run.metadata = {
      ...run.metadata,
      executionEscalation: decision,
      swarmEscalationProposal: {
        source: 'AgentRunService',
        target: decision.target,
        kind: scalePlan.enabled ? 'scale-plane' : 'dynamic-hierarchy',
        reason: decision.reason,
        subagentReceiptCount: decision.subagentReceipts.length,
        approvalId: approval.id,
        launchServiceCalled: false,
        scalePlan: scalePlan.enabled ? scalePlan : null,
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
        kind: scalePlan.enabled ? 'scale-plane' : 'dynamic-hierarchy',
        reason: decision.reason,
        subagentReceiptCount: decision.subagentReceipts.length,
        launchServiceCalled: false,
        scalePlan: scalePlan.enabled ? scalePlan : null,
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
        kind: scalePlan.enabled ? 'scale-plane' : 'dynamic-hierarchy',
        subagentReceiptCount: decision.subagentReceipts.length,
      },
    });

    this.applyCapabilityLoopGovernance(run, input);
    const narrative = this.applySafetyNarrative(run, now);
    return this.replyPipeline.buildResult({
      run,
      text: [
        scalePlan.enabled
          ? this.buildSwarmScaleProposalReply(decision, approval.id, scalePlan)
          : this.buildSwarmEscalationReply(decision, approval.id),
        '',
        narrative.userMessage,
      ].join('\n'),
    });
  };

  proto.resolveSwarmScalePlan = function (this: AgentRunFlowHost,
    input: UniversalAgentRequest,
    run?: UniversalAgentRun | null,
  ): SwarmScalePlan {
    const metadata = recordOrNull(input.metadata) || {};
    const responseDecision = recordOrNull(metadata.responseDecision);
    const text = normalizeText(input.text, run?.input);
    const assessment = assessSwarmWorkload({
      text,
      requestedTools: input.requestedTools || [],
      metadata: {
        ...metadata,
        ...(responseDecision || {}),
      },
    });
    const explicitAgents = firstFiniteNumber(
      metadata.desiredAgents,
      metadata.agentCount,
      metadata.swarmAgents,
      metadata.swarmScaleAgents,
      responseDecision?.desiredAgents,
      responseDecision?.agentCount,
    );
    const desiredAgents = clampInteger(
      explicitAgents || assessment.recommendedAgents,
      1,
      4000,
      20,
    );
    const explicitScale = this.shouldUseSwarmScalePlane(input, run, assessment);
    const maxAgents = clampInteger(firstFiniteNumber(metadata.maxAgents, metadata.swarmScaleMaxAgents), 1, 4000, 4000);
    const maxSteps = clampInteger(
      firstFiniteNumber(metadata.maxSteps, metadata.swarmScaleMaxSteps),
      Math.max(1, desiredAgents),
      4000,
      assessment.recommendedMaxSteps,
    );
    const maxConcurrency = clampInteger(
      firstFiniteNumber(metadata.maxConcurrency, metadata.swarmScaleConcurrency),
      1,
      4000,
      assessment.recommendedMaxConcurrency,
    );
    const hasLlm = Boolean(this.llmRuntimeExecutor?.isAvailable?.());
    const requestedExecutionMode = normalizeScaleExecutionMode(metadata.executionMode || metadata.swarmScaleExecutionMode);
    const requestedPlannerMode = normalizeScalePlannerMode(metadata.plannerMode || metadata.swarmScalePlannerMode);
    const wantsLive = requestedExecutionMode === 'llm-live'
      || hasRequestedTool(input, 'swarm.scale.live')
      || metadata.swarmScaleLive === true;
    return {
      enabled: explicitScale,
      desiredAgents,
      maxAgents,
      maxSteps,
      maxConcurrency,
      plannerMode: requestedPlannerMode || (hasLlm ? 'llm' : 'heuristic'),
      executionMode: requestedExecutionMode || (hasLlm && (wantsLive || desiredAgents <= 8) ? 'llm-live' : 'deterministic'),
      rationale: explicitScale
        ? `Scale plane selected from Zavorth workload assessment: ${assessment.reasons.join('; ')}.`
        : 'Dynamic hierarchy swarm remains sufficient for this request.',
      assessment,
    };
  };

  proto.shouldUseSwarmScalePlane = function (this: AgentRunFlowHost,
    input: UniversalAgentRequest,
    run?: UniversalAgentRun | null,
    assessment?: SwarmWorkloadAssessment,
  ): boolean {
    const metadata = recordOrNull(input.metadata) || {};
    const workload = assessment || assessSwarmWorkload({
      text: normalizeText(input.text, run?.input),
      requestedTools: input.requestedTools || [],
      metadata,
    });
    return hasRequestedTool(input, 'swarm.scale')
      || hasRequestedTool(input, 'swarm.massive')
      || hasRequestedTool(input, 'swarm.scale.live')
      || metadata.swarmScale === true
      || metadata.massiveSwarm === true
      || workload.shouldUseScalePlane;
  };

  proto.buildSwarmScaleProposalReply = function (this: AgentRunFlowHost,
    decision: ExecutionEscalationDecision,
    approvalId: string,
    scalePlan: SwarmScalePlan,
  ): string {
    return [
      'Proposta de Swarm Scale Plane preparada.',
      '',
      `Objective: ${decision.taskGoal || 'objective not provided'}`,
      `Agentes planejados: ${scalePlan.desiredAgents}.`,
      `Ledger global: ${scalePlan.maxSteps} step(s).`,
      `Concorrencia: ${scalePlan.maxConcurrency}.`,
      `Planner: ${scalePlan.plannerMode}.`,
      `Execucao: ${scalePlan.executionMode}.`,
      `Decisao: ${scalePlan.assessment.band} score=${scalePlan.assessment.score}.`,
      'Waiting for approval before starting the massive mesh.',
      `Approval: ${approvalId}`,
    ].join('\n');
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
      `Objective: ${decision.taskGoal || 'objective not provided'}`,
      `Subagentes planejados: ${decision.subagentReceipts.length}.`,
      'Waiting for approval before running subagents or opening the Swarm.',
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
    if (normalizeText(proposal?.kind) === 'scale-plane') {
      return this.executeApprovedSwarmScaleProposal(run, request, proposal);
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
    const summary = `Swarm approved and ${statusText} by the existing runtime.`;

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

  proto.executeApprovedSwarmScaleProposal = async function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    proposal: Record<string, unknown>,
  ): Promise<UniversalAgentRunResult | null> {
    const scalePlan = recordOrNull(proposal.scalePlan) || this.resolveSwarmScalePlan(request, run);
    const service = this.swarmScalePlaneService;
    if (!service?.launch) {
      throw new Error('Swarm Scale Plane runtime indisponivel.');
    }
    const launchResult: SwarmScaleSnapshot = await service.launch({
      runId: `agent-run:${run.id}:scale`,
      objective: normalizeText(request.text, run.input),
      desiredAgents: clampInteger(scalePlan.desiredAgents, 1, 4000, 20),
      maxAgents: clampInteger(scalePlan.maxAgents, 1, 4000, 4000),
      maxSteps: clampInteger(scalePlan.maxSteps, 1, 4000, 4000),
      maxConcurrency: clampInteger(scalePlan.maxConcurrency, 1, 4000, 30),
      plannerMode: normalizeScalePlannerMode(scalePlan.plannerMode) || 'heuristic',
      executionMode: normalizeScaleExecutionMode(scalePlan.executionMode) || 'deterministic',
      persistState: true,
      approvalId: normalizeText(proposal.approvalId),
    });
    const now = this.now().toISOString();
    const failed = launchResult.status === 'failed' || launchResult.status === 'cancelled';
    const completed = launchResult.status === 'completed';
    const summary = completed
      ? `Swarm Scale Plane approved and completed with ${launchResult.metrics.completedAgents}/${launchResult.planner.plannedAgents} agent(s).`
      : `Swarm Scale Plane approved and returned status ${launchResult.status}.`;

    run.status = failed ? 'failed' : completed ? 'completed' : 'running';
    run.summary = summary;
    run.updatedAt = now;
    run.metadata = {
      ...run.metadata,
      swarmEscalationProposal: {
        ...(proposal || {}),
        launchServiceCalled: true,
        approvedAt: now,
      },
      swarmScaleExecutionResult: this.serializeSwarmScaleSnapshot(launchResult),
    };
    run.events.push({
      id: this.idFactory('agent-event'),
      runId: run.id,
      kind: 'tool',
      title: 'SwarmScalePlaneService',
      detail: summary,
      status: failed ? 'failed' : completed ? 'done' : 'running',
      createdAt: now,
      metadata: {
        source: 'SwarmScalePlaneService',
        runId: launchResult.runId,
        status: launchResult.status,
        plannedAgents: launchResult.planner.plannedAgents,
        completedAgents: launchResult.metrics.completedAgents,
        usedSteps: launchResult.ledger.usedSteps,
        maxSteps: launchResult.ledger.maxSteps,
        actualMaxConcurrency: launchResult.workerPool.actualMaxConcurrency,
        executionMode: launchResult.workerPool.mode,
        replyPipelineReturn: true,
      },
    });

    this.applyCapabilityLoopGovernance(run, request);
    return this.replyPipeline.buildResult({
      run,
      text: this.buildSwarmScaleExecutionReply(launchResult, summary),
    });
  };

  proto.serializeSwarmScaleSnapshot = function (this: AgentRunFlowHost,
    snapshot: SwarmScaleSnapshot,
  ): Record<string, unknown> {
    return {
      source: 'SwarmScalePlaneService',
      contractVersion: snapshot.contractVersion,
      runId: snapshot.runId,
      status: snapshot.status,
      objective: snapshot.objective,
      planner: snapshot.planner,
      workerPool: snapshot.workerPool,
      metrics: snapshot.metrics,
      ledger: {
        maxSteps: snapshot.ledger.maxSteps,
        usedSteps: snapshot.ledger.usedSteps,
        remainingSteps: snapshot.ledger.remainingSteps,
      },
      reducer: snapshot.reducer,
      agentPreview: snapshot.agents.slice(0, 12).map((agent) => ({
        agentId: agent.agentId,
        lane: agent.lane,
        status: agent.status,
        summary: agent.summary,
      })),
    };
  };

  proto.buildSwarmScaleExecutionReply = function (this: AgentRunFlowHost,
    snapshot: SwarmScaleSnapshot,
    summary: string,
  ): string {
    return [
      summary,
      '',
      `Scale run: ${snapshot.runId}`,
      `Status: ${snapshot.status}`,
      `Agentes: ${snapshot.metrics.completedAgents}/${snapshot.planner.plannedAgents}`,
      `Steps: ${snapshot.ledger.usedSteps}/${snapshot.ledger.maxSteps}`,
      `Concorrencia real: ${snapshot.workerPool.actualMaxConcurrency}/${snapshot.workerPool.maxConcurrency}`,
      `Reducer: ${snapshot.reducer.status} (${snapshot.reducer.conflictCount} conflito(s))`,
      snapshot.reducer.synthesis ? ['', snapshot.reducer.synthesis].join('\n') : '',
    ].filter(Boolean).join('\n');
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

function firstFiniteNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.trunc(parsed);
    }
  }
  return null;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function normalizeScaleExecutionMode(value: unknown): SwarmScaleExecutionMode | null {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'deterministic' || normalized === 'llm-live' || normalized === 'custom') {
    return normalized;
  }
  return null;
}

function normalizeScalePlannerMode(value: unknown): SwarmScalePlannerMode | null {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'heuristic' || normalized === 'llm' || normalized === 'custom') {
    return normalized;
  }
  return null;
}

