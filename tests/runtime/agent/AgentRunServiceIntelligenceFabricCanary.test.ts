import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  AgentRunService,
  type UniversalAgentLlmRuntime,
  type UniversalAgentExecutor,
} from '../../../src/runtime/agent/index';
import { ZavorthIntelligenceFabricService } from '../../../src/services/ZavorthIntelligencePipelineService';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

function createMutationPlaneMock() {
  const plans: Array<Record<string, unknown>> = [];
  return {
    plans,
    createPlan: jest.fn((input: Record<string, unknown>) => {
      const approvalRequired = input.approvalRequired === true;
      const plan = {
        id: `fabric-draft-plan-${plans.length + 1}`,
        domain: input.domain,
        actionId: input.actionId,
        title: input.title,
        summary: input.summary,
        status: approvalRequired ? 'waiting_approval' : 'draft',
        riskLevel: input.riskLevel,
        approval: {
          required: approvalRequired,
          status: approvalRequired ? 'pending' : 'not_required',
          permissionId: null,
          defaultScope: 'once',
          availableScopes: ['once', 'session', 'host'],
          reason: input.approvalReason,
        },
        payload: input.payload,
        validationPlan: input.validationPlan,
        rollbackPlan: input.rollbackPlan,
      };
      plans.unshift(plan);
      return plan;
    }),
    readPlan: jest.fn((planId: string) => plans.find((plan) => plan.id === planId) || null),
    approvePlan: jest.fn((planId: string, approval: Record<string, unknown>) => {
      const plan = plans.find((entry) => entry.id === planId);
      if (!plan) throw new Error('missing plan');
      plan.status = 'approved';
      plan.approval = {
        ...(plan.approval as Record<string, unknown>),
        status: 'approved',
        permissionId: approval.permissionId || null,
      };
      return plan;
    }),
    markApplied: jest.fn((planId: string, summary: string, appliedActions: string[]) => {
      const plan = plans.find((entry) => entry.id === planId);
      if (!plan) throw new Error('missing plan');
      plan.status = 'applied';
      plan.audit = [{ event: 'plan.applied', message: summary, metadata: { appliedActions } }];
      return plan;
    }),
  };
}

describe('AgentRunService Intelligence Fabric canary', () => {
  it('uses Intelligence Fabric as the default orchestrator while retaining current runtime fallback', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Executor atual respondeu.',
      replyText: 'Resposta pelo runtime atual.',
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'owner',
      channel: 'web',
      sessionId: 'session-fabric-default',
      text: 'responda oi',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
      },
    });

    const metadata = result.run.metadata.intelligenceFabricCanary as Record<string, unknown>;

    expect(executor).toHaveBeenCalledTimes(1);
    expect(metadata).toEqual(
      expect.objectContaining({
        mode: 'default',
        selectedPath: 'intelligence-fabric-default',
        dispatchTarget: 'current-runtime',
        fallback: expect.objectContaining({
          available: true,
          route: 'current-runtime',
        }),
        safety: expect.objectContaining({
          currentRuntimeFallbackRetained: true,
        }),
        receipts: expect.arrayContaining(['intelligence-fabric-default-active', 'fallback-and-rollback-ready']),
      }),
    );
    expect(metadata.orientation).toEqual(
      expect.objectContaining({
        applied: true,
        scope: 'risk-0-2-safe',
        executorDispatchChanged: false,
        toolExecutionChanged: false,
      }),
    );
    expect(result.run.metadata.intelligenceFabricContextPack).toEqual(
      expect.objectContaining({
        source: 'IntelligenceFabricDefault',
        taskKind: 'casual_chat',
        riskLevel: 0,
      }),
    );
  });

  it('attaches canary metadata and learning while preserving current executor dispatch', async () => {
    const learning = {
      recordSnapshot: jest.fn(),
    };
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Executor atual respondeu.',
      replyText: 'Resposta pelo runtime atual.',
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
      intelligenceFabricMode: 'canary',
      intelligenceFabricLearning: learning,
    });

    const result = await service.run({
      userId: 'owner',
      channel: 'web',
      sessionId: 'session-fabric-canary',
      text: 'responda oi',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
      },
    });

    const metadata = result.run.metadata.intelligenceFabricCanary as Record<string, unknown>;

    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.replies[0].text).toBe('Resposta pelo runtime atual.');
    expect(metadata).toEqual(
      expect.objectContaining({
        source: 'AgentRunIntelligenceFabricCanary',
        mode: 'canary',
        status: 'observed',
        dispatchTarget: 'current-runtime',
        selectedPath: 'intelligence-fabric-canary',
        fallback: expect.objectContaining({
          available: true,
          route: 'current-runtime',
        }),
        rollback: expect.objectContaining({
          available: true,
          runtimeChanged: false,
          stateChanged: false,
        }),
        safety: expect.objectContaining({
          rawSecretsSerialized: false,
          liveActionApplied: false,
          defaultRuntimeChanged: false,
          currentRuntimeFallbackRetained: true,
        }),
      }),
    );
    expect(metadata.fabric).toEqual(
      expect.objectContaining({
        taskKind: 'casual_chat',
        riskLevel: 0,
        proposal: expect.objectContaining({
          liveActionApplied: false,
        }),
      }),
    );
    expect(learning.recordSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'canary',
      }),
    );
    expect(metadata.orientation).toEqual(
      expect.objectContaining({
        applied: true,
        scope: 'risk-0-2-safe',
        contextPackAttached: true,
        executorDispatchChanged: false,
        toolExecutionChanged: false,
      }),
    );
    expect(result.run.metadata.intelligenceFabricContextPack).toEqual(
      expect.objectContaining({
        taskKind: 'casual_chat',
        riskLevel: 0,
      }),
    );
  });

  it('orients safe risk 0-2 LLM runs with Fabric model and context while keeping runtime fallback', async () => {
    const llmRuntime: UniversalAgentLlmRuntime = {
      chatDetailed: jest.fn(async () => ({
        route: 'primary',
        providerName: 'zavorth-test-provider',
        modelName: 'zavorth-test-model',
        response: {
          content: 'Resposta orientada pelo Fabric.',
          finishReason: 'stop',
        },
        metadata: {
          fixture: true,
        },
      })),
    };
    const fabric = new ZavorthIntelligenceFabricService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      idFactory: createIdFactory(),
      modelPicker: {
        buildPicker: () => ({
          schemaVersion: 1,
          generatedAt: '2026-05-08T14:00:00.000Z',
          contract: {} as never,
          families: [],
          selected: {
            familyId: 'zavorth-test-family',
            routeId: 'zavorth-test-route',
            modelId: 'zavorth-test-model',
            providerId: 'zavorth-test-provider',
            ready: true,
            explanation: ['fixture selected for Fabric canary orientation'],
          },
          explanation: ['fixture selected for Fabric canary orientation'],
        }),
      },
    });
    const service = new AgentRunService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      idFactory: createIdFactory(),
      llmRuntime,
      intelligenceFabricMode: 'canary',
      intelligenceFabric: fabric,
    });

    const result = await service.run({
      userId: 'owner',
      channel: 'web',
      sessionId: 'session-fabric-orienting',
      text: 'responda oi',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
      },
    });

    const chatCall = (llmRuntime.chatDetailed as jest.Mock).mock.calls[0];
    const messages = chatCall[0] as Array<{ role: string; content: string }>;
    const options = chatCall[2] as Record<string, unknown>;
    const metadata = result.run.metadata.intelligenceFabricCanary as Record<string, unknown>;

    expect(result.replies[0].text).toBe('Resposta orientada pelo Fabric.');
    expect(options).toEqual(
      expect.objectContaining({
        allowFallback: true,
      }),
    );
    expect(messages[0].content).toContain('Intelligence Fabric context pack:');
    expect(messages[0].content).toContain('use this package as cognitive guidance');
    expect(metadata.orientation).toEqual(
      expect.objectContaining({
        applied: true,
        scope: 'risk-0-2-safe',
        modelSelectionApplied: false,
        contextPackAttached: true,
        executorDispatchChanged: false,
        toolExecutionChanged: false,
      }),
    );
    expect(result.run.metadata.modelPickerSelection).toBeNull();
  });

  it('keeps Fabric context orientation and explicit model fallback when ModelPicker is not ready', async () => {
    const llmRuntime: UniversalAgentLlmRuntime = {
      chatDetailed: jest.fn(async () => ({
        route: 'fallback',
        providerName: 'current-provider',
        modelName: 'current-model',
        response: {
          content: 'Resposta com fallback de modelo.',
          finishReason: 'stop',
        },
        metadata: {
          fallback: true,
        },
      })),
    };
    const fabric = new ZavorthIntelligenceFabricService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      idFactory: createIdFactory(),
      modelPicker: {
        buildPicker: () => ({
          schemaVersion: 1,
          generatedAt: '2026-05-08T14:00:00.000Z',
          contract: {} as never,
          families: [],
          selected: {
            familyId: 'zavorth-unready-family',
            routeId: 'route:unready',
            modelId: 'zavorth-unready-model',
            providerId: 'fixture-unready-provider',
            ready: false,
            explanation: ['fixture route unavailable'],
          },
          explanation: ['fixture route unavailable'],
        }),
      },
    });
    const service = new AgentRunService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      idFactory: createIdFactory(),
      llmRuntime,
      intelligenceFabricMode: 'default',
      intelligenceFabric: fabric,
    });

    const result = await service.run({
      userId: 'owner',
      channel: 'web',
      sessionId: 'session-fabric-model-fallback',
      text: 'responda oi',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
      },
    });

    const metadata = result.run.metadata.intelligenceFabricCanary as Record<string, unknown>;
    const orientation = metadata.orientation as Record<string, unknown>;
    const metrics = metadata.metrics as Record<string, unknown>;

    expect(llmRuntime.chatDetailed).toHaveBeenCalledTimes(1);
    expect(orientation).toEqual(
      expect.objectContaining({
        applied: true,
        scope: 'risk-0-2-safe',
        modelSelectionApplied: false,
        contextPackAttached: true,
        modelRoutingReady: false,
        modelRoutingSource: 'ModelPickerService',
        modelFallbackReason:
          'ModelPicker did not return a ready route; current runtime model selection remains the fallback.',
      }),
    );
    expect(metrics).toEqual(
      expect.objectContaining({
        modelRoutingReady: false,
        modelRoutingSource: 'ModelPickerService',
        modelFallbackReason:
          'ModelPicker did not return a ready route; current runtime model selection remains the fallback.',
      }),
    );
    expect(typeof metrics.totalLatencyMs).toBe('number');
    expect(result.run.metadata.modelPickerSelection).toBeNull();
    expect(result.run.metadata.intelligenceFabricContextPack).toEqual(
      expect.objectContaining({
        source: 'IntelligenceFabricDefault',
        modelRoutingReady: false,
        modelRoutingSource: 'ModelPickerService',
        modelFallbackReason:
          'ModelPicker did not return a ready route; current runtime model selection remains the fallback.',
      }),
    );
  });

  it('does not orient risk 4 requests before approval or sandbox', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Runtime atual manteve controle.',
      replyText: 'Sem orientacao para risco alto.',
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
      intelligenceFabricMode: 'canary',
    });

    const result = await service.run({
      userId: 'owner',
      channel: 'web',
      sessionId: 'session-fabric-high-risk',
      text: 'rode npm install lodash no terminal',
      requestedTools: ['shell'],
      metadata: {
        capabilityNegotiationApproved: true,
      },
    });

    const metadata = result.run.metadata.intelligenceFabricCanary as Record<string, unknown>;

    expect(metadata.orientation).toEqual(
      expect.objectContaining({
        applied: false,
        scope: 'not-eligible',
        contextPackAttached: false,
        modelSelectionApplied: false,
        executorDispatchChanged: false,
        toolExecutionChanged: false,
      }),
    );
    expect(result.run.metadata.intelligenceFabricContextPack).toBeUndefined();
    expect(result.run.metadata.modelPickerSelection).not.toEqual(
      expect.objectContaining({
        source: 'intelligence-fabric-canary',
      }),
    );
  });

  it('attaches risk 3 draft guidance without applying patch, tools or commit', async () => {
    const mutationPlane = createMutationPlaneMock();
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Runtime atual recebeu o rascunho.',
      replyText: 'Rascunho preparado sem aplicar nada.',
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
      intelligenceFabricMode: 'canary',
      mutationPlaneService: mutationPlane,
    });

    const result = await service.run({
      userId: 'owner',
      channel: 'web',
      sessionId: 'session-fabric-risk3-draft',
      text: 'write a notes file in the workspace as a reversible patch',
      workspace: 'C:/repo/Zavorth',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
        intelligenceFabricTrustMode: 'local_owner',
      },
    });

    const metadata = result.run.metadata.intelligenceFabricCanary as Record<string, unknown>;
    const guidance = result.run.metadata.intelligenceFabricDraftGuidance as Record<string, unknown>;
    const previewEvent = result.run.events.find(
      (event) => (event.metadata as Record<string, unknown> | undefined)?.source === 'IntelligenceFabricDraftPreview',
    );

    expect(metadata.orientation).toEqual(
      expect.objectContaining({
        applied: true,
        scope: 'risk-3-draft-guidance',
        modelSelectionApplied: false,
        contextPackAttached: true,
        draftGuidanceAttached: true,
        executorDispatchChanged: false,
        toolExecutionChanged: false,
      }),
    );
    expect(guidance).toEqual(
      expect.objectContaining({
        source: 'IntelligenceFabricCanary',
        mode: 'draft-guidance',
        riskLevel: 3,
        approval: expect.objectContaining({
          riskGateDecision: 'allow',
        }),
        mutationPlan: expect.objectContaining({
          id: 'fabric-draft-plan-1',
          status: 'draft',
          approvalRequired: false,
          approvalStatus: 'not_required',
          approvalReason: 'Explicit allow policy permits apply only after user request.',
          policyAllowExplicit: true,
          applyRequiresRequest: true,
        }),
        observability: expect.objectContaining({
          planGenerated: true,
          planId: 'fabric-draft-plan-1',
          mutationPlaneStatus: 'draft',
          mutationPlaneApprovalStatus: 'not_required',
          approvalPath: 'policy_allow_explicit',
          approvalReason: 'Explicit allow policy permits apply only after user request.',
          riskGateDecision: 'allow',
          riskGateCanExecuteNow: true,
          applyState: 'not_requested',
          liveActionApplied: false,
        }),
        rollbackPlan: expect.any(String),
        testsToRun: expect.arrayContaining(['targeted unit tests']),
      }),
    );
    expect(mutationPlane.createPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'capability',
        approvalRequired: false,
        payload: expect.objectContaining({
          source: 'IntelligenceFabricCanary',
          policyAllowExplicit: true,
          applyRequiresRiskGate: true,
          liveActionApplied: false,
        }),
      }),
    );
    expect(guidance.proposedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          riskLevel: 3,
          reversible: true,
          insideWorkspace: true,
        }),
      ]),
    );
    // Without structured workspaceWrites/patches, the diff receipt has no files and
    // the preview event is intentionally omitted (renderer returns null).
    if (previewEvent) {
      expect(previewEvent).toEqual(
        expect.objectContaining({
          kind: 'planning',
          status: 'pending',
          metadata: expect.objectContaining({
            planId: 'fabric-draft-plan-1',
            status: 'draft',
            approvalRequired: false,
          }),
        }),
      );
      expect(String(previewEvent.title || '')).toMatch(/Change preview|draft/i);
    } else {
      expect(previewEvent).toBeUndefined();
    }
    expect(result.run.metadata.modelPickerSelection).not.toEqual(
      expect.objectContaining({
        source: 'intelligence-fabric-canary',
      }),
    );
  });

  it('applies a risk 3 draft only through an approved or policy-allowed Mutation Plane plan', async () => {
    const mutationPlane = createMutationPlaneMock();
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-fabric-risk3-'));
    const service = new AgentRunService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      idFactory: createIdFactory(),
      executor: jest.fn(() => ({
        status: 'completed',
        summary: 'Executor nao deve aplicar draft.',
        replyText: 'Executor nao deve aplicar draft.',
      })),
      intelligenceFabricMode: 'canary',
      mutationPlaneService: mutationPlane,
    });

    await service.run({
      userId: 'owner',
      channel: 'web',
      sessionId: 'session-fabric-risk3-create',
      text: 'write a notes file in the workspace as a reversible patch',
      workspace: workspaceRoot,
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
        intelligenceFabricTrustMode: 'local_owner',
        intelligenceFabricDraftWorkspaceWrites: [
          {
            path: 'notes/fabric-risk3.txt',
            content: 'draft applied with rollback\n',
            description: 'Reversible Risk 3 executor test file.',
          },
        ],
      },
    });
    const plan = mutationPlane.plans[0];

    const applied = await service.run({
      userId: 'owner',
      channel: 'web',
      sessionId: 'session-fabric-risk3-apply',
      text: 'aplicar este rascunho',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
        intelligenceFabricApplyDraftGuidance: true,
        intelligenceFabricApplyDraftPlanId: plan.id,
      },
    });

    expect(mutationPlane.markApplied).toHaveBeenCalledWith(
      plan.id,
      expect.stringContaining('Draft guidance'),
      expect.arrayContaining(['intelligence-fabric.draft-guidance.apply', 'workspace-write:notes/fabric-risk3.txt']),
    );
    expect(fs.readFileSync(path.join(workspaceRoot, 'notes', 'fabric-risk3.txt'), 'utf8')).toBe(
      'draft applied with rollback\n',
    );
    expect(applied.run.status).toBe('completed');
    expect(applied.run.metadata.intelligenceFabricDraftApply).toEqual(
      expect.objectContaining({
        status: 'applied',
        planId: plan.id,
        applied: true,
        approvalRequired: false,
        execution: expect.objectContaining({
          status: 'applied',
          rollbackAvailable: true,
          touchedFiles: ['notes/fabric-risk3.txt'],
        }),
      }),
    );
    expect(applied.replies[0].text).toContain('Draft applied by the governed Mutation Plane.');
  });

  it('blocks risk 3 draft apply when no explicit workspace write payload exists', async () => {
    const mutationPlane = createMutationPlaneMock();
    const service = new AgentRunService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      idFactory: createIdFactory(),
      executor: jest.fn(() => ({
        status: 'completed',
        summary: 'Executor nao deve aplicar draft.',
        replyText: 'Executor nao deve aplicar draft.',
      })),
      intelligenceFabricMode: 'canary',
      mutationPlaneService: mutationPlane,
    });

    await service.run({
      userId: 'owner',
      channel: 'web',
      sessionId: 'session-fabric-risk3-no-payload-create',
      text: 'modify file in workspace as a reversible patch',
      workspace: fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-fabric-no-payload-')),
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
        intelligenceFabricTrustMode: 'local_owner',
      },
    });
    const plan = mutationPlane.plans[0];

    const blocked = await service.run({
      userId: 'owner',
      channel: 'web',
      sessionId: 'session-fabric-risk3-no-payload-apply',
      text: 'aplicar este rascunho',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
        intelligenceFabricApplyDraftGuidance: true,
        intelligenceFabricApplyDraftPlanId: plan.id,
      },
    });

    expect(mutationPlane.markApplied).not.toHaveBeenCalled();
    expect(blocked.run.status).toBe('failed');
    expect(blocked.run.metadata.intelligenceFabricDraftApply).toEqual(
      expect.objectContaining({
        status: 'blocked',
        applied: false,
        execution: expect.objectContaining({
          status: 'blocked',
          rollbackAvailable: false,
        }),
      }),
    );
    expect(blocked.replies[0].text).toContain('No explicit workspaceWrites');
  });

  it('uses structured workspaceWrites metadata before governed apply (free-text never plans writes)', async () => {
    const mutationPlane = createMutationPlaneMock();
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-fabric-llm-writes-'));
    const service = new AgentRunService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      idFactory: createIdFactory(),
      intelligenceFabricMode: 'canary',
      mutationPlaneService: mutationPlane,
    });

    const draftContent = 'Original request: write a notes file\n';
    const drafted = await service.run({
      userId: 'owner',
      channel: 'web',
      sessionId: 'session-fabric-llm-writes-draft',
      text: 'write a notes file in the workspace as a reversible patch',
      workspace: workspaceRoot,
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
        intelligenceFabricTrustMode: 'local_owner',
        intelligenceFabricDraftWorkspaceWrites: [
          {
            path: 'notes/intelligence-fabric-draft.txt',
            content: draftContent,
            description: 'Structured draft write from UI/tool payload.',
          },
        ],
      },
    });

    const guidance = drafted.run.metadata.intelligenceFabricDraftGuidance as Record<string, unknown>;
    const mutationPlan = guidance.mutationPlan as Record<string, unknown>;
    // plans are unshifted: [0] is the latest promotion plan; attach + promote both create plans.
    const latestPayload = mutationPlane.plans[0].payload as Record<string, unknown>;
    const requestMetadataPlan = mutationPlane.plans.find(
      (plan) => (plan.payload as Record<string, unknown> | undefined)?.workspaceWritesSource === 'request-metadata',
    );

    expect(mutationPlane.createPlan).toHaveBeenCalledTimes(2);
    expect(requestMetadataPlan).toBeDefined();
    expect(latestPayload.workspaceWritesSource).toBe('planner-promotion');
    expect(latestPayload.workspaceWrites).toEqual([
      expect.objectContaining({
        path: 'notes/intelligence-fabric-draft.txt',
        content: expect.stringContaining('Original request: write a notes file'),
      }),
    ]);
    expect(mutationPlan).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^fabric-draft-plan-\d+$/),
        policyAllowExplicit: true,
      }),
    );

    const applied = await service.run({
      userId: 'owner',
      channel: 'web',
      sessionId: 'session-fabric-llm-writes-apply',
      text: 'aplicar este rascunho',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
        intelligenceFabricApplyDraftGuidance: true,
        intelligenceFabricApplyDraftPlanId: mutationPlan.id,
      },
    });

    expect(fs.readFileSync(path.join(workspaceRoot, 'notes', 'intelligence-fabric-draft.txt'), 'utf8')).toContain(
      'Original request: write a notes file',
    );
    expect(applied.run.status).toBe('completed');
    expect(applied.run.metadata.intelligenceFabricDraftApply).toEqual(
      expect.objectContaining({
        status: 'applied',
        planId: mutationPlan.id,
        execution: expect.objectContaining({
          touchedFiles: ['notes/intelligence-fabric-draft.txt'],
        }),
      }),
    );
  });

  it('uses structured workspacePatches for reversible edits to existing files', async () => {
    const mutationPlane = createMutationPlaneMock();
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-fabric-patches-'));
    fs.mkdirSync(path.join(workspaceRoot, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(workspaceRoot, 'docs', 'sample.md'), 'alpha\n', 'utf8');
    const service = new AgentRunService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      idFactory: createIdFactory(),
      intelligenceFabricMode: 'canary',
      mutationPlaneService: mutationPlane,
    });

    const drafted = await service.run({
      userId: 'owner',
      channel: 'web',
      sessionId: 'session-fabric-patch-draft',
      text: 'modify file in workspace as a reversible patch: replace "alpha" with "beta" in docs/sample.md',
      workspace: workspaceRoot,
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
        intelligenceFabricTrustMode: 'local_owner',
        intelligenceFabricDraftWorkspacePatches: [
          {
            path: 'docs/sample.md',
            search: 'alpha',
            replace: 'beta',
            hunks: [{ search: 'alpha', replace: 'beta' }],
            description: 'Structured patch from UI/tool payload.',
          },
        ],
      },
    });

    const guidance = drafted.run.metadata.intelligenceFabricDraftGuidance as Record<string, unknown>;
    const mutationPlan = guidance.mutationPlan as Record<string, unknown>;
    // Latest plan is post-promotion (planner-promotion); attach path still records request-metadata.
    const planPayload = mutationPlane.plans[0].payload as Record<string, unknown>;
    const requestMetadataPlan = mutationPlane.plans.find(
      (plan) => (plan.payload as Record<string, unknown> | undefined)?.workspacePatchesSource === 'request-metadata',
    );

    expect(mutationPlane.createPlan.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(requestMetadataPlan).toBeDefined();
    expect(planPayload.workspacePatchesSource).toBe('planner-promotion');
    expect(planPayload.workspacePatches).toEqual([
      expect.objectContaining({
        path: 'docs/sample.md',
        search: 'alpha',
        replace: 'beta',
        hunks: [
          expect.objectContaining({
            search: 'alpha',
            replace: 'beta',
          }),
        ],
      }),
    ]);
    expect(planPayload.workspacePatchVerifier).toEqual(
      expect.objectContaining({
        status: 'passed',
        ambiguous: false,
        sideEffectsApplied: false,
      }),
    );
    expect(planPayload.workspaceDiffReceipt).toEqual(
      expect.objectContaining({
        title: 'Intelligence Fabric diff receipt',
        riskLevel: 3,
        applyRequiresRequest: true,
        rollbackAvailable: true,
        verifier: expect.objectContaining({
          status: 'passed',
          ambiguous: false,
          sideEffectsApplied: false,
        }),
        files: [
          expect.objectContaining({
            path: 'docs/sample.md',
            operation: 'patch',
            hunkCount: 1,
            hunks: [
              expect.objectContaining({
                index: 1,
                searchPreview: 'alpha',
                replacePreview: 'beta',
              }),
            ],
          }),
        ],
      }),
    );

    const applied = await service.run({
      userId: 'owner',
      channel: 'web',
      sessionId: 'session-fabric-patch-apply',
      text: 'aplicar este rascunho',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
        intelligenceFabricApplyDraftGuidance: true,
        intelligenceFabricApplyDraftPlanId: mutationPlan.id,
      },
    });

    expect(fs.readFileSync(path.join(workspaceRoot, 'docs', 'sample.md'), 'utf8')).toBe('beta\n');
    expect(mutationPlane.markApplied).toHaveBeenCalledWith(
      mutationPlan.id,
      expect.stringContaining('Draft guidance'),
      expect.arrayContaining(['intelligence-fabric.draft-guidance.apply', 'workspace-patch:docs/sample.md']),
    );
    expect(applied.run.metadata.intelligenceFabricDraftApply).toEqual(
      expect.objectContaining({
        status: 'applied',
        execution: expect.objectContaining({
          touchedFiles: ['docs/sample.md'],
        }),
      }),
    );
  });

  it('applies multi-hunk workspacePatches only after verifier preview passes', async () => {
    const mutationPlane = createMutationPlaneMock();
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-fabric-multi-hunk-'));
    fs.mkdirSync(path.join(workspaceRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(workspaceRoot, 'src', 'config.txt'), 'title=old\nmode=slow\n', 'utf8');
    const service = new AgentRunService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      idFactory: createIdFactory(),
      intelligenceFabricMode: 'canary',
      mutationPlaneService: mutationPlane,
    });

    const drafted = await service.run({
      userId: 'owner',
      channel: 'web',
      sessionId: 'session-fabric-multi-hunk-draft',
      text: 'modify file in workspace as a reversible patch',
      workspace: workspaceRoot,
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
        intelligenceFabricTrustMode: 'local_owner',
        intelligenceFabricDraftWorkspacePatches: [
          {
            path: 'src/config.txt',
            hunks: [
              { search: 'title=old', replace: 'title=new' },
              { search: 'mode=slow', replace: 'mode=fast' },
            ],
          },
        ],
      },
    });

    const guidance = drafted.run.metadata.intelligenceFabricDraftGuidance as Record<string, unknown>;
    const mutationPlan = guidance.mutationPlan as Record<string, unknown>;
    const planPayload = mutationPlane.plans[0].payload as Record<string, unknown>;
    const preview = planPayload.workspacePatchPreview as Record<string, unknown>;

    expect(planPayload.workspacePatchesSource).toBe('planner-promotion');
    expect(planPayload.workspacePatchVerifier).toEqual(
      expect.objectContaining({
        status: 'passed',
        ambiguous: false,
        sideEffectsApplied: false,
      }),
    );
    expect(preview.files).toEqual([
      expect.objectContaining({
        path: 'src/config.txt',
        status: 'passed',
        hunkCount: 2,
        beforeHash: expect.any(String),
        afterHash: expect.any(String),
      }),
    ]);
    expect(planPayload.workspaceDiffReceipt).toEqual(
      expect.objectContaining({
        summary: expect.stringContaining('1 file(s), 2 hunk(s)'),
        files: [
          expect.objectContaining({
            path: 'src/config.txt',
            operation: 'patch',
            status: 'passed',
            hunkCount: 2,
            hunks: [
              expect.objectContaining({
                index: 1,
                searchPreview: 'title=old',
                replacePreview: 'title=new',
              }),
              expect.objectContaining({
                index: 2,
                searchPreview: 'mode=slow',
                replacePreview: 'mode=fast',
              }),
            ],
          }),
        ],
        receipts: expect.arrayContaining([
          'workspace-diff-receipt',
          'diff-receipt-no-live-action',
          'diff-receipt-verifier-passed',
        ]),
      }),
    );

    const applied = await service.run({
      userId: 'owner',
      channel: 'web',
      sessionId: 'session-fabric-multi-hunk-apply',
      text: 'aplicar este rascunho',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
        intelligenceFabricApplyDraftGuidance: true,
        intelligenceFabricApplyDraftPlanId: mutationPlan.id,
      },
    });

    expect(fs.readFileSync(path.join(workspaceRoot, 'src', 'config.txt'), 'utf8')).toBe('title=new\nmode=fast\n');
    expect(mutationPlane.markApplied).toHaveBeenCalledWith(
      'fabric-draft-plan-2',
      expect.stringContaining('Draft guidance'),
      expect.arrayContaining(['intelligence-fabric.draft-guidance.apply', 'workspace-patch:src/config.txt']),
    );
    expect(applied.run.metadata.intelligenceFabricDraftApply).toEqual(
      expect.objectContaining({
        status: 'applied',
        diffReceipt: expect.objectContaining({
          riskLevel: 3,
          files: [
            expect.objectContaining({
              path: 'src/config.txt',
              hunkCount: 2,
            }),
          ],
        }),
        diffReceiptText: expect.stringContaining('Change preview'),
        execution: expect.objectContaining({
          touchedFiles: ['src/config.txt'],
        }),
      }),
    );
    expect(applied.replies[0].text).toContain('Change preview');
    expect(applied.replies[0].text).toContain('- src/config.txt: patch, 2 hunk(s), passed');
    expect(applied.replies[0].text).toContain('"title=old" -> "title=new"');
  });

  it('blocks ambiguous multi-hunk workspacePatches before apply', async () => {
    const mutationPlane = createMutationPlaneMock();
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-fabric-ambiguous-hunk-'));
    fs.mkdirSync(path.join(workspaceRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(workspaceRoot, 'src', 'ambiguous.txt'), 'same\nsame\n', 'utf8');
    const service = new AgentRunService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      idFactory: createIdFactory(),
      intelligenceFabricMode: 'canary',
      mutationPlaneService: mutationPlane,
    });

    const drafted = await service.run({
      userId: 'owner',
      channel: 'web',
      sessionId: 'session-fabric-ambiguous-hunk-draft',
      text: 'modify file in workspace as a reversible patch',
      workspace: workspaceRoot,
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
        intelligenceFabricTrustMode: 'local_owner',
        intelligenceFabricDraftWorkspacePatches: [
          {
            path: 'src/ambiguous.txt',
            hunks: [{ search: 'same', replace: 'changed' }],
          },
        ],
      },
    });

    const guidance = drafted.run.metadata.intelligenceFabricDraftGuidance as Record<string, unknown>;
    const mutationPlan = guidance.mutationPlan as Record<string, unknown>;
    const planPayload = mutationPlane.plans[0].payload as Record<string, unknown>;

    expect(planPayload.workspacePatchVerifier).toEqual(
      expect.objectContaining({
        status: 'blocked',
        ambiguous: true,
        sideEffectsApplied: false,
      }),
    );
    expect(planPayload.workspaceDiffReceipt).toEqual(
      expect.objectContaining({
        verifier: expect.objectContaining({
          status: 'blocked',
          ambiguous: true,
        }),
        files: [
          expect.objectContaining({
            path: 'src/ambiguous.txt',
            status: 'blocked',
            reasons: expect.arrayContaining([expect.stringContaining('unambiguous')]),
          }),
        ],
        receipts: expect.arrayContaining(['diff-receipt-verifier-blocked']),
      }),
    );

    const blocked = await service.run({
      userId: 'owner',
      channel: 'web',
      sessionId: 'session-fabric-ambiguous-hunk-apply',
      text: 'aplicar este rascunho',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
        intelligenceFabricApplyDraftGuidance: true,
        intelligenceFabricApplyDraftPlanId: mutationPlan.id,
      },
    });

    expect(fs.readFileSync(path.join(workspaceRoot, 'src', 'ambiguous.txt'), 'utf8')).toBe('same\nsame\n');
    expect(mutationPlane.markApplied).not.toHaveBeenCalled();
    expect(blocked.run.status).toBe('failed');
    expect(blocked.run.metadata.intelligenceFabricDraftApply).toEqual(
      expect.objectContaining({
        status: 'blocked',
        applied: false,
        diffReceiptText: expect.stringContaining('Verifier: blocked (ambiguous).'),
      }),
    );
    expect(blocked.replies[0].text).toContain('multi-hunk patch preview');
    expect(blocked.replies[0].text).toContain('Change preview');
    expect(blocked.replies[0].text).toContain('block: Patch blocked');
  });

  it('falls back to current runtime when the Fabric canary fails', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Fallback respondeu.',
      replyText: 'Fallback atual intacto.',
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
      intelligenceFabricMode: 'canary',
      intelligenceFabric: {
        buildShadowSnapshot: () => {
          throw new Error('fabric fixture failure');
        },
      },
    });

    const result = await service.run({
      userId: 'owner',
      channel: 'web',
      sessionId: 'session-fabric-fallback',
      text: 'responda mesmo se o canary falhar',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
      },
    });

    const metadata = result.run.metadata.intelligenceFabricCanary as Record<string, unknown>;

    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.replies[0].text).toBe('Fallback atual intacto.');
    expect(metadata).toEqual(
      expect.objectContaining({
        source: 'AgentRunIntelligenceFabricCanary',
        status: 'fallback-current-runtime',
        selectedPath: 'current-runtime-fallback',
        dispatchTarget: 'current-runtime',
        error: 'fabric fixture failure',
        fallback: expect.objectContaining({
          available: true,
          route: 'current-runtime',
        }),
        rollback: expect.objectContaining({
          available: true,
          runtimeChanged: false,
          stateChanged: false,
        }),
      }),
    );
  });

  it('can be disabled per request without changing executor behavior', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Disabled respondeu.',
      replyText: 'Canary desligado.',
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
      intelligenceFabricMode: 'canary',
    });

    const result = await service.run({
      userId: 'owner',
      channel: 'web',
      sessionId: 'session-fabric-disabled',
      text: 'responda sem fabric',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
        intelligenceFabricMode: 'disabled',
      },
    });

    const metadata = result.run.metadata.intelligenceFabricCanary as Record<string, unknown>;

    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.replies[0].text).toBe('Canary desligado.');
    expect(metadata).toEqual(
      expect.objectContaining({
        status: 'disabled',
        selectedPath: 'current-runtime-fallback',
        dispatchTarget: 'current-runtime',
      }),
    );
  });
});
