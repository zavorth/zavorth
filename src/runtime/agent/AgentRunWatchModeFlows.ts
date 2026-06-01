import type { DynamicHierarchyLaunchResult } from '../../domain/execution/infrastructure/DynamicHierarchySwarmService.js';
import type { SelfModificationPreviewResult } from '../../services/SelfModificationCommandService.js';
import type { WatchModeRunSnapshot } from '../../services/ComputerUseWatchModeService.js';
import type { TrustSliderLevel, TrustSliderPolicyDecision, UniversalIntentUserRole } from '../uni/UniversalIntentContracts.js';
import type { CapabilityNegotiationSnapshot } from './CapabilityNegotiationService.js';
import type { ToolRehearsalSnapshot } from './ToolRehearsalService.js';
import type { UniversalAgentExecutor, UniversalAgentRequest, UniversalAgentRun, UniversalAgentRunResult, UniversalApprovalRequest } from './UniversalAgentRuntimeTypes.js';
import { type AgentRunFlowHost, hasRequestedTool, normalizeStringList, normalizeText, recordOrNull, type WatchModeVisualRequest } from './AgentRunSpecializedFlowUtils.js';

export function installAgentRunWatchModeFlows(AgentRunServiceClass: { prototype: AgentRunFlowHost }): void {
  const proto = AgentRunServiceClass.prototype;

  proto.createWatchModeVisualProposalIfNeeded = function (this: AgentRunFlowHost, 
    run: UniversalAgentRun,
    input: UniversalAgentRequest,
  ): UniversalAgentRunResult | null {
    const request = this.resolveWatchModeVisualRequest(input, run);
    if (!request) {
      return null;
    }

    const now = this.now().toISOString();
    const baseProposal = {
      source: 'AgentRunService',
      target: 'watch-mode',
      capabilityId: 'computer_use.visual_action',
      toolId: request.toolId,
      objective: request.objective,
      targetWindow: request.targetWindow || null,
      policyAllowlisted: request.policyAllowlisted,
      policySource: request.policySource,
      strictApprovalRequired: true,
      directExecution: false,
      startRunCalled: false,
      computerUseAgentCalled: false,
    };

    if (!request.policyAllowlisted || !request.targetWindow) {
      const reason = !request.policyAllowlisted
        ? 'policy-allowlist-required'
        : 'target-window-required';
      const summary = !request.policyAllowlisted
        ? 'Watch Mode visual bloqueado: policy/allowlist explicita ausente.'
        : 'Watch Mode visual bloqueado: targetWindow obrigatorio para acao visual.';

      run.status = 'failed';
      run.summary = summary;
      run.updatedAt = now;
      run.metadata = {
        ...run.metadata,
        watchModeVisualProposal: {
          ...baseProposal,
          blocked: true,
          blockedReason: reason,
          approvalCreated: false,
        },
      };
      run.events.push({
        id: this.idFactory('agent-event'),
        runId: run.id,
        kind: 'planning',
        title: 'Watch Mode visual bloqueado',
        detail: summary,
        status: 'failed',
        createdAt: now,
        metadata: {
          ...baseProposal,
          blocked: true,
          blockedReason: reason,
          approvalCreated: false,
        },
      });

      this.applyCapabilityLoopGovernance(run, input);
      const narrative = this.applySafetyNarrative(run, now);
      return this.replyPipeline.buildResult({
        run,
        text: [
          'Nenhuma acao visual foi executada.',
          '',
          narrative.userMessage,
        ].join('\n'),
      });
    }

    const approval: UniversalApprovalRequest = {
      id: this.idFactory('approval'),
      runId: run.id,
      title: 'Aprovar Watch Mode visual supervisionado',
      reason: `Pedido visual para ${request.targetWindow} exige approval antes de iniciar Watch Mode/Computer Use.`,
      risk: 'danger',
      status: 'pending',
      createdAt: now,
    };

    run.status = 'waiting_approval';
    run.summary = 'Proposta de Watch Mode visual aguardando aprovacao.';
    run.updatedAt = now;
    run.metadata = {
      ...run.metadata,
      watchModeVisualProposal: {
        ...baseProposal,
        approvalId: approval.id,
        approvalCreated: true,
        blocked: false,
      },
    };
    run.events.push({
      id: this.idFactory('agent-event'),
      runId: run.id,
      kind: 'planning',
      title: 'Proposta de Watch Mode visual',
      detail: `Watch Mode planejado para ${request.targetWindow}.`,
      status: 'pending',
      createdAt: now,
      metadata: {
        ...baseProposal,
        approvalId: approval.id,
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
        target: 'watch-mode',
        capabilityId: 'computer_use.visual_action',
        toolId: request.toolId,
        targetWindow: request.targetWindow,
        strictApprovalRequired: true,
        directExecution: false,
      },
    });

    this.applyCapabilityLoopGovernance(run, input);
    const narrative = this.applySafetyNarrative(run, now);
    return this.replyPipeline.buildResult({
      run,
      text: [
        this.buildWatchModeVisualProposalReply(request, approval.id),
        '',
        narrative.userMessage,
      ].join('\n'),
    });
  };

  proto.acknowledgeApprovedWatchModeVisualProposalIfNeeded = async function (this: AgentRunFlowHost, 
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): Promise<UniversalAgentRunResult | null> {
    const proposal = recordOrNull(run.metadata?.watchModeVisualProposal);
    if (normalizeText(proposal?.target) !== 'watch-mode') {
      return null;
    }

    const now = this.now().toISOString();
    const targetWindow = normalizeText(proposal?.targetWindow, 'alvo visual nao informado');
    const objective = normalizeText(proposal?.objective, run.input);
    const siteUrl = normalizeText(proposal?.siteUrl) || null;

    if (!this.watchModeService) {
      const summary = `Aprovacao de Watch Mode registrada para ${targetWindow}; startRun nao foi chamado pelo agent loop natural.`;
      run.status = 'completed';
      run.summary = summary;
      run.updatedAt = now;
      run.metadata = {
        ...run.metadata,
        watchModeVisualProposal: {
          ...proposal,
          approvedAt: now,
          approvalOnly: true,
          directExecution: false,
          startRunCalled: false,
          computerUseAgentCalled: false,
        },
      };
      run.events.push({
        id: this.idFactory('agent-event'),
        runId: run.id,
        kind: 'approval',
        title: 'Watch Mode aprovado sem execucao direta',
        detail: summary,
        status: 'done',
        createdAt: now,
        metadata: {
          target: 'watch-mode',
          capabilityId: 'computer_use.visual_action',
          targetWindow,
          approvalOnly: true,
          directExecution: false,
          startRunCalled: false,
          computerUseAgentCalled: false,
        },
      });

      this.applyCapabilityLoopGovernance(run, request);
      return this.replyPipeline.buildResult({
        run,
        text: [
          summary,
          'Use o fluxo Watch Mode owner/trusted existente para iniciar, pausar, retomar ou parar a execucao visual.',
        ].join('\n'),
      });
    }

    const watchModeRun = await this.watchModeService.startRun({
      targetWindow,
      objective,
      siteUrl,
      requestedBy: normalizeText(run.userId, 'operator'),
      strictApproval: true,
    });
    const summary = `Watch Mode aprovado e iniciado pelo servico existente para ${targetWindow}.`;

    run.status = 'completed';
    run.summary = summary;
    run.updatedAt = now;
    run.metadata = {
      ...run.metadata,
      watchModeVisualProposal: {
        ...proposal,
        approvedAt: now,
        approvalOnly: false,
        directExecution: false,
        startRunCalled: true,
        computerUseAgentCalled: true,
        watchModeServiceCalled: true,
        watchModeRun: this.serializeWatchModeRun(watchModeRun),
      },
    };
    run.events.push({
      id: this.idFactory('agent-event'),
      runId: run.id,
      kind: 'tool',
      title: 'ComputerUseWatchModeService.startRun',
      detail: summary,
      status: 'done',
      createdAt: now,
      metadata: {
        target: 'watch-mode',
        capabilityId: 'computer_use.visual_action',
        targetWindow,
        watchModeRunId: watchModeRun.runId,
        watchModeRunStatus: watchModeRun.status,
        approvalOnly: false,
        directExecution: false,
        startRunCalled: true,
        computerUseAgentCalled: true,
      },
    });

    this.applyCapabilityLoopGovernance(run, request);
    return this.replyPipeline.buildResult({
      run,
      text: [
        summary,
        `Run Watch Mode: ${watchModeRun.runId}`,
        `Status: ${watchModeRun.status}`,
        watchModeRun.nextOperatorStep || 'Controle o run pelo fluxo Watch Mode owner/trusted existente.',
      ].join('\n'),
    });
  };

  proto.serializeWatchModeRun = function (this: AgentRunFlowHost, run: WatchModeRunSnapshot): Record<string, unknown> {
    return {
      source: 'ComputerUseWatchModeService',
      runId: run.runId,
      status: run.status,
      targetWindow: run.targetWindow,
      objective: run.objective,
      siteUrl: run.siteUrl || null,
      pendingApprovalCount: run.pendingApprovalCount || 0,
      pendingApprovalId: run.pendingApprovalId || null,
      nextOperatorStep: run.nextOperatorStep || null,
      latestScreenshotPath: run.latestScreenshotPath || null,
      strictApproval: run.strictApproval === true,
      allowlist: run.allowlist || null,
    };
  };

  proto.buildWatchModeVisualProposalReply = function (this: AgentRunFlowHost, 
    request: WatchModeVisualRequest,
    approvalId: string,
  ): string {
    return [
      'Proposta de Watch Mode visual preparada.',
      '',
      `Alvo: ${request.targetWindow}`,
      `Objetivo: ${request.objective}`,
      'Aguardando aprovacao. Computer Use nao foi iniciado pelo agent loop natural.',
      `Approval: ${approvalId}`,
    ].join('\n');
  };

  proto.resolveWatchModeVisualRequest = function (this: AgentRunFlowHost, 
    input: UniversalAgentRequest,
    run?: UniversalAgentRun | null,
  ): WatchModeVisualRequest | null {
    const responseDecision = recordOrNull(input.metadata?.responseDecision);
    const requestedTools = this.collectResolvedToolIds(input, run);
    if (!requestedTools.some((tool: string) => tool === 'watchmode.control')) {
      return null;
    }

    const watchMode = recordOrNull(input.metadata?.watchMode)
      || recordOrNull(input.metadata?.watchmode)
      || recordOrNull(input.metadata?.computerUse)
      || recordOrNull(responseDecision?.watchMode)
      || recordOrNull(responseDecision?.computerUse);
    const policy = recordOrNull(input.metadata?.watchModePolicy)
      || recordOrNull(watchMode?.policy)
      || recordOrNull(responseDecision?.watchModePolicy);

    return {
      toolId: 'watchmode.control',
      objective: normalizeText(watchMode?.objective, normalizeText(responseDecision?.objective, input.text)),
      targetWindow: this.resolveWatchModeTargetWindow(input, watchMode, responseDecision),
      siteUrl: normalizeText(watchMode?.siteUrl, normalizeText(responseDecision?.siteUrl)) || null,
      policyAllowlisted: this.isWatchModePolicyAllowlisted(input.metadata, watchMode, policy, responseDecision),
      policySource: normalizeText(policy?.source, 'metadata'),
    };
  };

  proto.resolveWatchModeTargetWindow = function (this: AgentRunFlowHost, 
    input: UniversalAgentRequest,
    watchMode: Record<string, unknown> | null,
    responseDecision: Record<string, unknown> | null,
  ): string {
    const direct = normalizeText(watchMode?.targetWindow)
      || normalizeText(watchMode?.windowTitle)
      || normalizeText(responseDecision?.targetWindow)
      || normalizeText(input.metadata?.targetWindow);
    if (direct) {
      return direct;
    }

    const normalized = normalizeText(input.text).toLowerCase();
    if (/\b(chrome|browser|navegador|site|web)\b/.test(normalized)) {
      return 'browser';
    }
    if (/\b(desktop|tela|screen|ui|janela)\b/.test(normalized)) {
      return 'desktop';
    }
    return '';
  };

  proto.isWatchModePolicyAllowlisted = function (this: AgentRunFlowHost, 
    metadata: Record<string, unknown> | undefined,
    watchMode: Record<string, unknown> | null,
    policy: Record<string, unknown> | null,
    responseDecision: Record<string, unknown> | null,
  ): boolean {
    const candidates = [
      metadata?.watchModePolicyAllowlisted,
      metadata?.computerUsePolicyAllowlisted,
      watchMode?.policyAllowlisted,
      watchMode?.allowlisted,
      watchMode?.allowedByPolicy,
      watchMode?.executionAllowed,
      policy?.allowlisted,
      policy?.allowedByPolicy,
      policy?.executionAllowed,
      responseDecision?.watchModePolicyAllowlisted,
    ];
    return candidates.some((value) => value === true);
  };
}

