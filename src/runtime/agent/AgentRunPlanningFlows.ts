import type {
  TrustSliderLevel,
  TrustSliderPolicyDecision,
  UniversalIntentUserRole,
} from '../uni/UniversalIntentContracts.js';
import type { CapabilityNegotiationSnapshot } from './CapabilityNegotiationService.js';
import type { ToolRehearsalSnapshot } from './ToolRehearsalService.js';
import type {
  UniversalAgentExecutor,
  UniversalAgentRequest,
  UniversalAgentRun,
  UniversalAgentRunResult,
  UniversalApprovalRequest,
} from './UniversalAgentRuntimeTypes.js';
import { assessSwarmWorkload } from './SwarmWorkloadAssessmentService.js';
import {
  type AgentRunFlowHost,
  hasRequestedTool,
  normalizeStringList,
  normalizeText,
  recordOrNull,
} from './AgentRunSpecializedFlowUtils.js';
import { decorateResultWithWaitingApprovalCard } from './UniversalApprovalPickerPresentation.js';

export function installAgentRunPlanningFlows(AgentRunServiceClass: { prototype: AgentRunFlowHost }): void {
  const proto = AgentRunServiceClass.prototype;

  proto.resolveTrustSliderDecision = function (
    this: AgentRunFlowHost,
    input: UniversalAgentRequest,
  ): TrustSliderPolicyDecision {
    const metadata = input.metadata || {};
    const trustSlider = recordOrNull(metadata.trustSlider) || recordOrNull(metadata.trust);
    const responseDecision = recordOrNull(metadata.responseDecision);
    const responseDiagnostics = recordOrNull(responseDecision?.diagnostics);
    const responseTrustSlider = recordOrNull(responseDiagnostics?.trustSlider);
    const universalIntent =
      recordOrNull(metadata.universalIntent) || recordOrNull(responseDiagnostics?.universalIntent);
    const universalTrustSlider = recordOrNull(universalIntent?.trustSlider);
    const requestedTools = Array.from(
      new Set([
        ...(input.requestedTools || []),
        ...normalizeStringList(responseDecision?.requestedTools),
        ...normalizeStringList(universalIntent?.capabilityRequired),
      ]),
    );

    return this.trustSliderPolicy.evaluate({
      level: this.resolveTrustSliderLevel(
        trustSlider?.level ||
          metadata.trustMode ||
          metadata.trustSliderLevel ||
          universalTrustSlider?.level ||
          responseTrustSlider?.level,
      ),
      previousLevel: this.resolveTrustSliderLevel(
        trustSlider?.previousLevel ||
          trustSlider?.fromLevel ||
          metadata.previousTrustMode ||
          metadata.previousTrustSliderLevel,
      ),
      userRole: this.resolveTrustSliderUserRole(input, metadata, trustSlider),
      ownerConfirmed: this.resolveBooleanFlag(
        trustSlider?.ownerConfirmed,
        metadata.ownerConfirmed,
        metadata.operatorConfirmed,
      ),
      killSwitchActive: this.resolveBooleanFlag(
        trustSlider?.killSwitchActive,
        metadata.killSwitchActive,
        metadata.overlordKillSwitchActive,
      ),
      workspaceRoot:
        normalizeText(
          trustSlider?.workspaceRoot || metadata.workspaceRoot || metadata.workspacePath || input.workspace,
        ) || null,
      targetPath: normalizeText(trustSlider?.targetPath || metadata.targetPath || metadata.filePath) || null,
      hostScopeRequested: this.resolveBooleanFlag(
        trustSlider?.hostScopeRequested,
        metadata.hostScopeRequested,
        universalTrustSlider?.hostScopeRequested,
      ),
      requestedTools,
      reason: normalizeText(trustSlider?.reason, 'agent-run-review'),
    });
  };

  proto.serializeTrustSliderDecision = function (
    this: AgentRunFlowHost,
    decision: TrustSliderPolicyDecision,
  ): Record<string, unknown> {
    return {
      schemaVersion: decision.schemaVersion,
      generatedAt: decision.generatedAt,
      level: decision.level,
      decision: decision.decision,
      reason: decision.reason,
      sandboxTier: decision.sandboxTier,
      permissionBoundary: decision.permissionBoundary,
      permissionScope: decision.permissionScope,
      hostAllowed: decision.hostAllowed,
      workspaceRoot: decision.workspaceRoot,
      targetPath: decision.targetPath,
      previewRequired: decision.previewRequired,
      approvalRequired: decision.approvalRequired,
      auditTrailRequired: decision.auditTrailRequired,
      killSwitchRequired: decision.killSwitchRequired,
      ownerOrOperatorRequired: decision.ownerOrOperatorRequired,
      blocked: decision.blocked,
      blockReason: decision.blockReason,
      snapshot: decision.snapshot,
      receipt: decision.receipt,
      enforcement: decision.enforcement,
    };
  };

  proto.resolveTrustSliderLevel = function (this: AgentRunFlowHost, value: unknown): TrustSliderLevel | null {
    const normalized = normalizeText(value).toLowerCase();
    if (normalized === 'protected' || normalized === 'collaborator' || normalized === 'overlord') {
      return normalized;
    }
    return null;
  };

  proto.resolveTrustSliderUserRole = function (
    this: AgentRunFlowHost,
    input: UniversalAgentRequest,
    metadata: Record<string, unknown>,
    trustSlider: Record<string, unknown> | null,
  ): UniversalIntentUserRole {
    const explicit = normalizeText(trustSlider?.userRole || metadata.userRole || metadata.operatorRole);
    if (explicit) {
      return explicit;
    }
    return normalizeText(input.userId).toLowerCase() === 'operator' ? 'operator' : 'common';
  };

  proto.resolveBooleanFlag = function (this: AgentRunFlowHost, ...values: unknown[]): boolean {
    return values.some((value) => value === true || value === 'true' || value === 1 || value === '1');
  };

  proto.createUniversalPreviewResultIfRequested = function (
    this: AgentRunFlowHost,
    run: UniversalAgentRun,
    input: UniversalAgentRequest,
  ): UniversalAgentRunResult | null {
    const preview = recordOrNull(run.metadata?.universalPreviewMode);
    if (!preview || normalizeText(preview.mode) !== 'preview-only') {
      return null;
    }

    const now = this.now().toISOString();
    const planSteps = Array.isArray(preview.planSteps) ? preview.planSteps : [];
    const risk = recordOrNull(preview.risk) || {};
    const summary = `Universal Preview Mode prepared with ${planSteps.length} stage(s); no tool was executed.`;
    run.status = 'completed';
    run.summary = summary;
    run.updatedAt = now;
    run.metadata = {
      ...run.metadata,
      universalPreviewMode: {
        ...preview,
        completedAt: now,
        previewOnly: true,
        executorBlocked: true,
        toolsActuallyCalled: [],
      },
    };
    run.events.push({
      id: this.idFactory('agent-event'),
      runId: run.id,
      kind: 'planning',
      title: 'Universal Preview Mode',
      detail: summary,
      status: 'done',
      createdAt: now,
      metadata: {
        source: 'UniversalPreviewModeService',
        contractVersion: preview.contractVersion,
        mode: preview.mode,
        highestRisk: risk.highestRisk || 'unknown',
        requiresApproval: risk.requiresApproval === true,
        previewRequired: risk.previewRequired === true,
        noExecutionPerformed: true,
      },
    });

    this.applyCapabilityLoopGovernance(run, input);
    const narrative = this.applySafetyNarrative(run, now);
    return this.replyPipeline.buildResult({
      run,
      text: [this.buildUniversalPreviewReply(run), '', narrative.userMessage].join('\n'),
    });
  };

  proto.createCapabilityNegotiationProposalIfNeeded = function (
    this: AgentRunFlowHost,
    run: UniversalAgentRun,
    input: UniversalAgentRequest,
  ): UniversalAgentRunResult | null {
    if (this.shouldBypassCapabilityNegotiationForSpecializedFlow(run, input)) {
      return null;
    }

    const existing = recordOrNull(run.metadata.capabilityNegotiation);
    const snapshot = existing
      ? (existing as unknown as CapabilityNegotiationSnapshot)
      : this.applyCapabilityNegotiation(run, input, run.updatedAt);
    if (!snapshot || snapshot.status !== 'proposal') {
      if (snapshot?.status === 'blocked') {
        return this.createCapabilityNegotiationBlockedResult(run, input, snapshot);
      }
      return null;
    }

    const now = this.now().toISOString();
    const approval: UniversalApprovalRequest = {
      id: this.idFactory('approval'),
      runId: run.id,
      title: 'Approve capability scope',
      reason: snapshot.proposal?.summary || snapshot.nextSafeAction,
      risk: snapshot.summary.highestRisk === 'safe' ? 'attention' : snapshot.summary.highestRisk,
      status: 'pending',
      createdAt: now,
    };
    const updatedSnapshot: CapabilityNegotiationSnapshot = {
      ...snapshot,
      generatedAt: now,
      status: 'waiting-approval',
      scope: {
        ...snapshot.scope,
        approved: false,
      },
      proposal: snapshot.proposal
        ? {
            ...snapshot.proposal,
            approvalId: approval.id,
          }
        : null,
      policy: {
        ...snapshot.policy,
        approvalsStillRequired: true,
      },
      nextSafeAction: 'Aguardar approval do operador for o escopo proposto.',
    };

    run.status = 'waiting_approval';
    run.summary = 'Capability Negotiation waiting for scope approval.';
    run.updatedAt = now;
    run.metadata = {
      ...run.metadata,
      capabilityNegotiation: {
        ...updatedSnapshot,
        approvalId: approval.id,
        approvalCreated: true,
        approvedScope: updatedSnapshot.scope,
      },
    };
    run.events.push({
      id: this.idFactory('agent-event'),
      runId: run.id,
      kind: 'planning',
      title: 'Capability Negotiation',
      detail: updatedSnapshot.proposal?.summary || updatedSnapshot.scope.summary,
      status: 'pending',
      createdAt: now,
      metadata: {
        source: 'CapabilityNegotiationService',
        contractVersion: updatedSnapshot.contractVersion,
        scopeId: updatedSnapshot.scope.id,
        allowedToolIds: updatedSnapshot.scope.allowedToolIds,
        blockedToolIds: updatedSnapshot.scope.blockedToolIds,
        noExecutionPerformed: true,
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
        source: 'CapabilityNegotiationService',
        scopeId: updatedSnapshot.scope.id,
        allowedToolIds: updatedSnapshot.scope.allowedToolIds,
        blockedToolIds: updatedSnapshot.scope.blockedToolIds,
      },
    });

    this.applyCapabilityLoopGovernance(run, input);
    const narrative = this.applySafetyNarrative(run, now);
    return decorateResultWithWaitingApprovalCard(
      this.replyPipeline.buildResult({
        run,
        text: [this.buildCapabilityNegotiationReply(updatedSnapshot, approval.id), '', narrative.userMessage].join(
          '\n',
        ),
      }),
      approval,
      run.channel,
    );
  };

  proto.createCapabilityNegotiationBlockedResult = function (
    this: AgentRunFlowHost,
    run: UniversalAgentRun,
    input: UniversalAgentRequest,
    snapshot: CapabilityNegotiationSnapshot,
  ): UniversalAgentRunResult {
    const now = this.now().toISOString();
    run.status = 'failed';
    run.summary = 'Capability Negotiation blocked execution until scope review.';
    run.updatedAt = now;
    run.metadata = {
      ...run.metadata,
      capabilityNegotiation: snapshot,
    };
    run.events.push({
      id: this.idFactory('agent-event'),
      runId: run.id,
      kind: 'planning',
      title: 'Capability Negotiation blocked',
      detail: snapshot.nextSafeAction,
      status: 'failed',
      createdAt: now,
      metadata: {
        source: 'CapabilityNegotiationService',
        blockedToolIds: snapshot.scope.blockedToolIds,
        noExecutionPerformed: true,
      },
    });
    this.applyCapabilityLoopGovernance(run, input);
    const narrative = this.applySafetyNarrative(run, now);
    return this.replyPipeline.buildResult({
      run,
      text: [this.buildCapabilityNegotiationReply(snapshot, null), '', narrative.userMessage].join('\n'),
    });
  };

  proto.createToolRehearsalProposalIfNeeded = function (
    this: AgentRunFlowHost,
    run: UniversalAgentRun,
    input: UniversalAgentRequest,
  ): UniversalAgentRunResult | null {
    const toolRehearsalRequested =
      this.resolveBooleanFlag(
        input.metadata?.toolRehearsalRequired,
        recordOrNull(input.metadata?.toolRehearsal)?.required,
        run.metadata?.toolRehearsalRequired,
        recordOrNull(run.metadata?.toolRehearsal)?.required,
      ) || this.hasResolvedTool(input, 'echo_hands', run);
    if (!toolRehearsalRequested) {
      return null;
    }

    const existing = recordOrNull(run.metadata.toolRehearsal);
    const snapshot = existing
      ? (existing as unknown as ToolRehearsalSnapshot)
      : this.applyToolRehearsal(run, input, run.updatedAt);
    if (!snapshot || snapshot.status !== 'proposal') {
      if (snapshot?.status === 'blocked') {
        return this.createToolRehearsalBlockedResult(run, input, snapshot);
      }
      return null;
    }

    const now = this.now().toISOString();
    const approval: UniversalApprovalRequest = {
      id: this.idFactory('approval'),
      runId: run.id,
      title: 'Approve tool rehearsal',
      reason: `Rehearsal of ${snapshot.summary.callCount} tool(s) prepared without executing real effects.`,
      risk: snapshot.summary.highestRisk === 'safe' ? 'attention' : snapshot.summary.highestRisk,
      status: 'pending',
      createdAt: now,
    };
    const updatedSnapshot: ToolRehearsalSnapshot = {
      ...snapshot,
      generatedAt: now,
      status: 'waiting-approval',
      approval: {
        ...snapshot.approval,
        required: true,
        approvalId: approval.id,
      },
      policy: {
        ...snapshot.policy,
        approvalsStillRequired: true,
      },
      nextSafeAction: 'Wait for operator approval before running the approved rehearsal.',
    };

    run.status = 'waiting_approval';
    run.summary = 'Tool Rehearsal waiting for approval before real execution.';
    run.updatedAt = now;
    run.metadata = {
      ...run.metadata,
      toolRehearsal: {
        ...updatedSnapshot,
        approvalId: approval.id,
        approvalCreated: true,
      },
    };
    run.events.push({
      id: this.idFactory('agent-event'),
      runId: run.id,
      kind: 'planning',
      title: 'Tool Rehearsal',
      detail: `Rehearsal prepared with ${updatedSnapshot.summary.callCount} tool(s); no tool was executed.`,
      status: 'pending',
      createdAt: now,
      metadata: {
        source: 'ToolRehearsalService',
        contractVersion: updatedSnapshot.contractVersion,
        callCount: updatedSnapshot.summary.callCount,
        noToolExecuted: true,
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
        source: 'ToolRehearsalService',
        callIds: updatedSnapshot.calls.map((call: { id?: unknown; toolId?: unknown }) => call.id),
        toolIds: updatedSnapshot.calls.map((call: { id?: unknown; toolId?: unknown }) => call.toolId),
      },
    });

    this.applyCapabilityLoopGovernance(run, input);
    const narrative = this.applySafetyNarrative(run, now);
    return this.replyPipeline.buildResult({
      run,
      text: [this.buildToolRehearsalReply(updatedSnapshot, approval.id), '', narrative.userMessage].join('\n'),
    });
  };

  proto.createToolRehearsalBlockedResult = function (
    this: AgentRunFlowHost,
    run: UniversalAgentRun,
    input: UniversalAgentRequest,
    snapshot: ToolRehearsalSnapshot,
  ): UniversalAgentRunResult {
    const now = this.now().toISOString();
    run.status = 'failed';
    run.summary = 'Tool Rehearsal blocked execution until rehearsal adjustment.';
    run.updatedAt = now;
    run.metadata = {
      ...run.metadata,
      toolRehearsal: snapshot,
    };
    run.events.push({
      id: this.idFactory('agent-event'),
      runId: run.id,
      kind: 'planning',
      title: 'Tool Rehearsal blocked',
      detail: snapshot.nextSafeAction,
      status: 'failed',
      createdAt: now,
      metadata: {
        source: 'ToolRehearsalService',
        noToolExecuted: true,
        blockedCallCount: snapshot.summary.blockedCallCount,
      },
    });
    this.applyCapabilityLoopGovernance(run, input);
    const narrative = this.applySafetyNarrative(run, now);
    return this.replyPipeline.buildResult({
      run,
      text: [this.buildToolRehearsalReply(snapshot, null), '', narrative.userMessage].join('\n'),
    });
  };

  proto.canExecute = function (
    this: AgentRunFlowHost,
    options: { executor?: UniversalAgentExecutor | null; toolRuntime?: unknown | null } = {},
    request?: UniversalAgentRequest,
  ): boolean {
    if ('executor' in options) {
      return Boolean(options.executor);
    }
    if (this.executor) {
      return true;
    }
    if (request && this.shouldProposeSwarmEscalation(request)) {
      return true;
    }
    if (request && this.shouldCreateSelfModificationPreview(request)) {
      return Boolean(this.selfModificationService);
    }
    if (request && this.resolveSelfModificationActionRequest(request)) {
      return true;
    }
    if (request && this.resolveWatchModeVisualRequest(request)) {
      return true;
    }
    if (this.llmRuntimeExecutor.isAvailable()) {
      return true;
    }
    return request ? this.echoHandsExecutor.canExecute(request, options.toolRuntime ?? this.toolRuntime) : false;
  };

  proto.shouldBypassCapabilityNegotiationForSpecializedFlow = function (
    this: AgentRunFlowHost,
    run: UniversalAgentRun,
    input: UniversalAgentRequest,
  ): boolean {
    return (
      (this.selfModificationService && this.shouldCreateSelfModificationPreview(input, run)) ||
      Boolean(this.resolveSelfModificationActionRequest(input)) ||
      this.shouldProposeSwarmEscalation(input, run) ||
      Boolean(this.resolveWatchModeVisualRequest(input, run)) ||
      this.hasResolvedTool(input, 'echo_hands', run) ||
      this.shouldUseNaturalCapabilityDiscoveryWithoutNegotiation(run, input)
    );
  };

  proto.shouldProposeSwarmEscalation = function (
    this: AgentRunFlowHost,
    input: UniversalAgentRequest,
    run?: UniversalAgentRun | null,
  ): boolean {
    const assessment = assessSwarmWorkload({
      text: input.text || run?.input || '',
      requestedTools: input.requestedTools || [],
      metadata: input.metadata || {},
    });
    return (
      this.hasResolvedTool(input, 'swarm.run', run) ||
      this.hasResolvedTool(input, 'swarm.scale', run) ||
      this.hasResolvedTool(input, 'swarm.massive', run) ||
      this.hasResolvedTool(input, 'swarm.scale.live', run) ||
      assessment.shouldUseSwarm
    );
  };

  proto.shouldCreateSelfModificationPreview = function (
    this: AgentRunFlowHost,
    input: UniversalAgentRequest,
    run?: UniversalAgentRun | null,
  ): boolean {
    if (this.resolveSelfModificationActionRequest(input)) {
      return false;
    }
    return this.hasResolvedTool(input, 'selfmod.preview', run);
  };

  proto.shouldUseNaturalCapabilityDiscoveryWithoutNegotiation = function (
    this: AgentRunFlowHost,
    run: UniversalAgentRun,
    input: UniversalAgentRequest,
  ): boolean {
    const discovery = recordOrNull(run.metadata?.naturalCapabilityDiscovery);
    if (!discovery || this.collectNaturalCapabilityToolIds(run.metadata).length === 0) {
      return false;
    }
    const requestNegotiation = recordOrNull(input.metadata?.capabilityNegotiation);
    const runNegotiation = recordOrNull(run.metadata?.capabilityNegotiation);
    if (
      this.resolveBooleanFlag(
        input.metadata?.capabilityNegotiationRequired,
        requestNegotiation?.required,
        run.metadata?.capabilityNegotiationRequired,
        runNegotiation?.required,
      )
    ) {
      return false;
    }
    return (
      run.toolExposure.tools.length > 0 &&
      !run.toolExposure.blockedTools?.length &&
      run.toolExposure.tools.every(
        (tool: { id?: unknown; risk?: unknown; requiresApproval?: unknown }) =>
          tool.risk === 'safe' && !tool.requiresApproval,
      )
    );
  };

  proto.hasResolvedTool = function (
    this: AgentRunFlowHost,
    input: UniversalAgentRequest,
    toolId: string,
    run?: UniversalAgentRun | null,
  ): boolean {
    if (hasRequestedTool(input, toolId)) {
      return true;
    }
    const normalized = normalizeText(toolId).toLowerCase();
    return this.collectResolvedToolIds(input, run).some(
      (tool: { id?: unknown; risk?: unknown; requiresApproval?: unknown }) => tool === normalized,
    );
  };

  proto.collectResolvedToolIds = function (
    this: AgentRunFlowHost,
    input: UniversalAgentRequest,
    run?: UniversalAgentRun | null,
  ): string[] {
    const responseDecision = recordOrNull(input.metadata?.responseDecision);
    return Array.from(
      new Set(
        [
          ...(input.requestedTools || []),
          ...normalizeStringList(responseDecision?.requestedTools),
          ...this.collectNaturalCapabilityToolIds(input.metadata),
          ...this.collectNaturalCapabilityToolIds(run?.metadata),
          ...(run?.toolExposure.tools.map(
            (tool: { id?: unknown; risk?: unknown; requiresApproval?: unknown }) => tool.id,
          ) || []),
        ]
          .map((tool: { id?: unknown; risk?: unknown; requiresApproval?: unknown }) =>
            normalizeText(tool).toLowerCase(),
          )
          .filter(Boolean),
      ),
    );
  };

  proto.collectNaturalCapabilityToolIds = function (
    this: AgentRunFlowHost,
    metadata?: Record<string, unknown>,
  ): string[] {
    const discovery = recordOrNull(metadata?.naturalCapabilityDiscovery);
    const recommendations = discovery?.recommendations;
    const recommendationTools = Array.isArray(recommendations)
      ? recommendations.flatMap((entry) => {
          const recommendation = recordOrNull(entry);
          return normalizeStringList(recommendation?.toolIds);
        })
      : [];
    return Array.from(new Set([...normalizeStringList(discovery?.recommendedToolNames), ...recommendationTools]));
  };

  proto.buildUniversalPreviewReply = function (this: AgentRunFlowHost, run: UniversalAgentRun): string {
    const preview = recordOrNull(run.metadata?.universalPreviewMode) || {};
    const risk = recordOrNull(preview.risk) || {};
    const safety = recordOrNull(preview.safety) || {};
    const planSteps = Array.isArray(preview.planSteps) ? preview.planSteps : [];
    const nextSafeAction = normalizeText(preview.nextSafeAction, 'Confirm scope before running.');
    const lines = [
      'Universal Preview Mode - Universal Preview',
      '',
      run.summary,
      `Risk: ${normalizeText(risk.highestRisk, 'unknown')}`,
      `Approval still required: ${String(risk.requiresApproval === true)}`,
      `Specific preview required: ${String(risk.previewRequired === true)}`,
      `Executor blocked in preview: ${String(safety.executorBlockedInPreviewMode !== false)}`,
      '',
      'Plan',
    ];

    for (const rawStep of planSteps.slice(0, 6)) {
      const step = recordOrNull(rawStep) || {};
      lines.push(
        `- ${normalizeText(step.label, 'Step')} [${normalizeText(step.risk, 'unknown')}] ${normalizeText(step.action)}`,
      );
    }

    lines.push('', `Next step: ${nextSafeAction}`);
    return lines.join('\n');
  };

  proto.buildCapabilityNegotiationReply = function (
    this: AgentRunFlowHost,
    snapshot: CapabilityNegotiationSnapshot,
    approvalId: string | null,
  ): string {
    const lines = [
      'Capability Negotiation - Capability Negotiation',
      '',
      snapshot.proposal?.summary || snapshot.scope.summary,
      `Status: ${snapshot.status}`,
      `Risk: ${snapshot.summary.highestRisk}`,
      `Approval required: ${String(snapshot.summary.approvalRequired)}`,
      `Preview required: ${String(snapshot.summary.previewRequired)}`,
      approvalId ? 'Approval: waiting - tap Approve/Reject or /approve / /reject' : '',
      '',
      'Scope',
      `- allowed tools: ${snapshot.scope.allowedToolIds.join(', ') || 'none'}`,
      `- blocked tools: ${snapshot.scope.blockedToolIds.join(', ') || 'none'}`,
      `- paths: ${snapshot.scope.pathHints.join(', ') || 'not declared'}`,
      '',
      'Capabilities',
    ].filter(Boolean);

    for (const capability of snapshot.capabilities.slice(0, 6)) {
      lines.push(
        `- ${capability.label} [${capability.risk}] ${capability.requiresApproval ? 'approval' : capability.permission}`,
        `  tools: ${capability.toolIds.join(', ') || 'none'}; ${capability.blocked ? 'blocked' : 'available'}`,
      );
    }

    lines.push('', `Next step: ${snapshot.nextSafeAction}`);
    return lines.join('\n');
  };

  proto.buildToolRehearsalReply = function (
    this: AgentRunFlowHost,
    snapshot: ToolRehearsalSnapshot,
    approvalId: string | null,
  ): string {
    const lines = [
      'Tool Rehearsal - Tool Rehearsal',
      '',
      `Status: ${snapshot.status}`,
      `Rehearsed tools: ${snapshot.summary.callCount}`,
      `Risk: ${snapshot.summary.highestRisk}`,
      `Scope approved: ${String(snapshot.summary.scopeApproved)}`,
      approvalId ? `Approval: ${approvalId}` : '',
      '',
      'Rehearsal',
    ].filter(Boolean);

    for (const call of snapshot.calls.slice(0, 6)) {
      lines.push(
        `- ${call.order}. ${call.toolId} [${call.risk}] ${call.allowedByScope ? 'inside scope' : 'outside/pending'}`,
        `  args: ${JSON.stringify(call.approximateArguments)}`,
        `  expected: ${call.expectedOutput}`,
      );
    }

    lines.push('', 'Ajustes');
    for (const adjustment of snapshot.adjustments.slice(0, 4)) {
      lines.push(`- ${adjustment.label}: ${adjustment.detail}`);
    }

    lines.push('', `Next step: ${snapshot.nextSafeAction}`);
    return lines.join('\n');
  };
}
