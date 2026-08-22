import type { UniversalAgentRequest, UniversalAgentRun, UniversalAgentRunResult, UniversalApprovalRequest } from './UniversalAgentRuntimeTypes.js';
import { type AgentRunFlowHost, normalizeText, recordOrNull, type SelfModificationActionOperation, type SelfModificationActionRequest } from './AgentRunSpecializedFlowUtils.js';

export function installAgentRunSelfModificationFlows(AgentRunServiceClass: { prototype: AgentRunFlowHost }): void {
  const proto = AgentRunServiceClass.prototype;

  proto.createSelfModificationPreviewIfNeeded = async function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    input: UniversalAgentRequest,
  ): Promise<UniversalAgentRunResult | null> {
    if (!this.shouldCreateSelfModificationPreview(input, run) || !this.selfModificationService) {
      return null;
    }

    const goal = normalizeText(input.text, run.input);
    const requestedBy = normalizeText(input.userId, run.userId);
    const preview = await this.selfModificationService.createGoalPreview(goal, requestedBy);
    const now = this.now().toISOString();
    const previewId = normalizeText(preview.previewId);
    const summary = normalizeText(
      preview.summary,
      preview.success ? 'Selfmod preview prepared by the supervised runtime.'
        : 'Selfmod preview blocked by the supervised runtime.',
    );

    run.status = preview.success ? 'completed' : 'failed';
    run.summary = summary;
    run.updatedAt = now;
    run.metadata = {
      ...run.metadata,
      selfModificationPreview: this.serializeSelfModificationPreview(preview),
    };
    run.events.push({
      id: this.idFactory('agent-event'),
      runId: run.id,
      kind: 'tool',
      title: 'SelfModificationCommandService',
      detail: summary,
      status: preview.success ? 'done' : 'failed',
      createdAt: now,
      metadata: {
        source: 'SelfModificationCommandService',
        operation: 'preview',
        previewId: previewId || null,
        changeCount: preview.changeCount || 0,
        applyServiceCalled: false,
        rollbackServiceCalled: false,
        previewFirst: true,
      },
    });

    if (previewId) {
      run.artifacts.push({
        id: previewId,
        title: 'Selfmod preview',
        kind: 'diff',
        createdAt: now,
        sessionId: run.sessionId,
        status: preview.success ? 'ready' : 'failed',
      });
    }

    this.applyCapabilityLoopGovernance(run, input);
    return this.replyPipeline.buildResult({
      run,
      text: this.buildSelfModificationPreviewReply(preview, summary),
    });
  };

  proto.createSelfModificationActionProposalIfNeeded = function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    input: UniversalAgentRequest,
  ): UniversalAgentRunResult | null {
    const action = this.resolveSelfModificationActionRequest(input);
    if (!action) {
      return null;
    }

    const now = this.now().toISOString();
    const tool = run.toolExposure.tools.find((candidate) => candidate.id === action.toolId);
    const proposal = {
      source: 'AgentRunService',
      operation: action.operation,
      toolId: action.toolId,
      targetId: action.targetId || null,
      targetField: action.targetField,
      targetLabel: action.targetLabel,
      previewRequired: action.operation === 'apply',
      changesetRequired: action.operation === 'rollback',
      directExecution: false,
      applyServiceCalled: false,
      rollbackServiceCalled: false,
    };

    if (!action.targetId) {
      const summary = `Request for ${action.toolId} needs ${action.targetField} existing before approval.`;
      run.status = 'completed';
      run.summary = summary;
      run.updatedAt = now;
      run.metadata = {
        ...run.metadata,
        selfModificationActionProposal: {
          ...proposal,
          approvalCreated: false,
          missingTarget: true,
        },
      };
      run.events.push({
        id: this.idFactory('agent-event'),
        runId: run.id,
        kind: 'planning',
        title: 'Self-modification action is waiting for a target',
        detail: summary,
        status: 'done',
        createdAt: now,
        metadata: {
          ...proposal,
          approvalCreated: false,
          missingTarget: true,
        },
      });
      this.applyCapabilityLoopGovernance(run, input);
      return this.replyPipeline.buildResult({
        run,
        text: [
          summary,
          `${action.operation === 'apply' ? 'Apply' : 'Rollback'} was not executed.`,
          'Provide an existing previewId or changeId to create an approvable proposal.',
        ].join('\n'),
      });
    }

    const approval: UniversalApprovalRequest = {
      id: this.idFactory('approval'),
      runId: run.id,
      title: `Approve proposed ${action.toolId}`,
      reason: `${action.toolId} requested via natural language for ${action.targetField} ${action.targetId}; approval records the proposal without executing the mutation directly.`,
      risk: tool?.risk || 'danger',
      status: 'pending',
      createdAt: now,
    };

    run.status = 'waiting_approval';
    run.summary = `Proposal for ${action.toolId} awaiting approval.`;
    run.updatedAt = now;
    run.metadata = {
      ...run.metadata,
      selfModificationActionProposal: {
        ...proposal,
        approvalId: approval.id,
        approvalCreated: true,
      },
    };
    run.events.push({
      id: this.idFactory('agent-event'),
      runId: run.id,
      kind: 'planning',
      title: 'Proposta de selfmod action',
      detail: `${action.toolId} planejado para ${action.targetField} ${action.targetId}.`,
      status: 'pending',
      createdAt: now,
      metadata: {
        ...proposal,
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
        target: 'selfmod',
        operation: action.operation,
        toolId: action.toolId,
        targetId: action.targetId,
        targetField: action.targetField,
        directExecution: false,
      },
    });

    this.applyCapabilityLoopGovernance(run, input);
    const narrative = this.applySafetyNarrative(run, now);
    return this.replyPipeline.buildResult({
      run,
      text: [
        this.buildSelfModificationActionProposalReply(action, approval.id),
        '',
        narrative.userMessage,
      ].join('\n'),
    });
  };

  proto.serializeSelfModificationPreview = function (this: AgentRunFlowHost,
    preview: SelfModificationPreviewResult,
  ): Record<string, unknown> {
    return {
      source: 'SelfModificationCommandService',
      operation: 'preview',
      success: preview.success,
      mode: preview.mode,
      previewId: preview.previewId || null,
      artifactId: preview.artifactId || preview.previewId || null,
      traceId: preview.traceId || null,
      runId: preview.runId || null,
      sessionId: preview.sessionId || null,
      changeCount: preview.changeCount || 0,
      validationPlan: preview.validationPlan || [],
      applyServiceCalled: false,
      rollbackServiceCalled: false,
      previewFirst: true,
    };
  };

  proto.buildSelfModificationPreviewReply = function (this: AgentRunFlowHost,
    preview: SelfModificationPreviewResult,
    summary: string,
  ): string {
    const previewId = normalizeText(preview.previewId);
    return [
      preview.success ? 'Selfmod preview prepared by the supervised runtime.'
        : 'Selfmod preview was not applied.',
      '',
      summary,
      previewId ? `Preview: ${previewId}` : '',
      `Modo: ${preview.mode}`,
      `changes planejadas: ${preview.changeCount || 0}`,
      preview.validationPlan?.length ? `Validation sugerida: ${preview.validationPlan.join(', ')}` : '',
      'Apply was not executed. Applying or reverting remains restricted to the existing owner/trusted flow.',
    ].filter(Boolean).join('\n');
  };

  proto.acknowledgeApprovedSelfModificationActionProposalIfNeeded = function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): UniversalAgentRunResult | null {
    const proposal = recordOrNull(run.metadata?.selfModificationActionProposal);
    const operation = normalizeText(proposal?.operation).toLowerCase();
    if (operation !== 'apply' && operation !== 'rollback') {
      return null;
    }

    const targetField = normalizeText(proposal?.targetField, operation === 'apply' ? 'previewId' : 'changeId');
    const targetId = normalizeText(proposal?.targetId);
    const now = this.now().toISOString();
    const toolId = normalizeText(proposal?.toolId, `selfmod.${operation}`);
    const summary = `Approval of ${toolId} recorded for ${targetField} ${targetId || 'not provided'}; direct execution was not performed.`;

    run.status = 'completed';
    run.summary = summary;
    run.updatedAt = now;
    run.metadata = {
      ...run.metadata,
      selfModificationActionProposal: {
        ...proposal,
        approvedAt: now,
        approvalOnly: true,
        directExecution: false,
        applyServiceCalled: false,
        rollbackServiceCalled: false,
      },
    };
    run.events.push({
      id: this.idFactory('agent-event'),
      runId: run.id,
      kind: 'approval',
      title: 'Selfmod action approved without direct execution',
      detail: summary,
      status: 'done',
      createdAt: now,
      metadata: {
        target: 'selfmod',
        operation,
        toolId,
        targetId: targetId || null,
        targetField,
        approvalOnly: true,
        directExecution: false,
        applyServiceCalled: false,
        rollbackServiceCalled: false,
      },
    });

    this.applyCapabilityLoopGovernance(run, request);
    return this.replyPipeline.buildResult({
      run,
      text: [
        summary,
        'Use the existing owner/trusted flow to run a mutation when the proposal is ready.',
      ].join('\n'),
    });
  };

  proto.buildSelfModificationActionProposalReply = function (this: AgentRunFlowHost,
    action: SelfModificationActionRequest,
    approvalId: string,
  ): string {
    return [
      `Proposal for ${action.toolId} prepared.`,
      '',
      `Alvo: ${action.targetField} ${action.targetId}`,
      'Waiting for approval. Apply/rollback was not executed by natural agent loop.',
      `Approval: ${approvalId}`,
    ].join('\n');
  };

  proto.resolveSelfModificationActionRequest = function (this: AgentRunFlowHost,
    input: UniversalAgentRequest,
  ): SelfModificationActionRequest | null {
    const responseDecision = recordOrNull(input.metadata?.responseDecision);
    const requestedTools = [
      ...(input.requestedTools || []),
      ...normalizeStringList(responseDecision?.requestedTools),
    ].map((tool: string) => normalizeText(tool).toLowerCase());
    const toolId = requestedTools.find((tool: string) => tool === 'selfmod.apply' || tool === 'selfmod.rollback') as
      | SelfModificationActionRequest['toolId']
      | undefined;
    if (!toolId) {
      return null;
    }

    const operation: SelfModificationActionOperation = toolId === 'selfmod.apply' ? 'apply' : 'rollback';
    return {
      operation,
      toolId,
      targetId: this.resolveSelfModificationActionTargetId(input, operation),
      targetField: operation === 'apply' ? 'previewId' : 'changeId',
      targetLabel: operation === 'apply' ? 'preview' : 'changeset',
    };
  };

  proto.resolveSelfModificationActionTargetId = function (this: AgentRunFlowHost,
    input: UniversalAgentRequest,
    operation: SelfModificationActionOperation,
  ): string {
    const responseDecision = recordOrNull(input.metadata?.responseDecision);
    const args = recordOrNull(responseDecision?.args)
      || recordOrNull(responseDecision?.arguments)
      || recordOrNull(responseDecision?.parameters);
    const selfmod = recordOrNull(input.metadata?.selfmod)
      || recordOrNull(input.metadata?.selfModification)
      || recordOrNull(responseDecision?.selfmod);
    const keys = operation === 'apply'
      ? ['previewId', 'previewID', 'selfmodPreviewId', 'preview']
      : ['changeId', 'changeID', 'changeSetId', 'changesetId', 'changeset'];
    const sources = [input.metadata, selfmod, args, responseDecision];
    for (const source of sources) {
      for (const key of keys) {
        const value = normalizeText(source?.[key]);
        if (value) {
          return value;
        }
      }
    }

    return this.extractSelfModificationTargetIdFromText(input.text, operation);
  };

  proto.extractSelfModificationTargetIdFromText = function (this: AgentRunFlowHost,
    text: string,
    operation: SelfModificationActionOperation,
  ): string {
    const matches = normalizeText(text).match(/\b[A-Za-z0-9_.:-]+\b/g) || [];
    const generic = operation === 'apply'
      ? new Set(['preview', 'selfmod'])
      : new Set(['change', 'changeset', 'change', 'selfmod']);
    const marker = operation === 'apply' ? 'preview' : 'change';
    const token = matches
      .map((match) => match.replace(/^[.:#-]+|[.:#-]+$/g, ''))
      .find((match) => {
        const lower = match.toLowerCase();
        return lower.includes(marker)
          && !generic.has(lower)
          && /[-_:0-9]/.test(match);
      });
    return normalizeText(token);
  };
}
