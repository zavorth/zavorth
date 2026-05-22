import {
  ContextRecoveryService,
  DiffReviewService,
  ExperienceCoreService,
  NaturalCommandRouterService,
  ReasoningSummaryService,
  LearningOSService,
  TrustLensService,
  JourneyEngineService,
} from '../../../src/services/experience/index.js';
import type {
  UniversalAgentRun,
  UniversalAgentRunResult,
} from '../../../src/runtime/agent/UniversalAgentRuntimeTypes.js';

const now = () => new Date('2026-05-21T12:00:00.000Z');

function makeRun(overrides: Partial<UniversalAgentRun> = {}): UniversalAgentRun {
  return {
    id: 'run-1',
    traceId: 'trace-1',
    requestId: 'request-1',
    sessionId: 'session-1',
    userId: 'user-1',
    channel: 'cli',
    title: 'Review workspace',
    input: 'revise este repo',
    workspace: 'C:/repo',
    status: 'waiting_approval',
    createdAt: '2026-05-21T11:59:00.000Z',
    updatedAt: '2026-05-21T12:00:00.000Z',
    summary: 'Aguardando aprovacao para comando sensivel.',
    events: [
      {
        id: 'event-1',
        runId: 'run-1',
        kind: 'input',
        title: 'Pedido recebido',
        detail: 'revise este repo',
        status: 'done',
        createdAt: '2026-05-21T11:59:01.000Z',
      },
      {
        id: 'event-2',
        runId: 'run-1',
        kind: 'approval',
        title: 'Aprovacao solicitada',
        detail: 'Rodar verificacao local.',
        status: 'pending',
        createdAt: '2026-05-21T11:59:05.000Z',
      },
    ],
    toolExposure: {
      mode: 'confirm',
      summary: 'Shell precisa de aprovacao.',
      tools: [],
    },
    replyPorts: [],
    modelProfile: {
      providerLabel: 'Zavorth',
      modelLabel: 'modelo atual',
      routingPolicy: 'direct',
    },
    approvals: [
      {
        id: 'approval-1',
        runId: 'run-1',
        title: 'Rodar teste',
        reason: 'Executa comando local.',
        risk: 'attention',
        status: 'pending',
        createdAt: '2026-05-21T11:59:05.000Z',
      },
    ],
    artifacts: [],
    memorySignals: [
      {
        id: 'memory-1',
        title: 'Preferencia de validacao',
        layer: 'procedural',
        summary: 'Usuario prefere runtime:check antes de build.',
        confidence: 0.82,
      },
    ],
    metadata: {
      sandboxIsolation: 'docker',
    },
    ...overrides,
  };
}

function makeLearningPlane() {
  return {
    buildSnapshot: jest.fn(() => ({
      generatedAt: '2026-05-21T12:00:00.000Z',
      summary: {
        total: 1,
        pending: 1,
        approved: 0,
        rejected: 0,
        promoted: 0,
        published: 0,
        quarantined: 0,
        highConfidence: 1,
      },
      candidates: [
        {
          id: 'candidate:run-1',
          platformEntryId: 'skill:learned:review:repo:run-1',
          title: 'Review skill para repo',
          kind: 'skill',
          summary: 'Review recorrente com validacao.',
          score: 0.91,
          reviewState: 'pending',
          lifecycle: 'learned_draft',
          createdAt: '2026-05-21T11:59:00.000Z',
          updatedAt: '2026-05-21T12:00:00.000Z',
          lastValidatedAt: '2026-05-21T12:00:00.000Z',
          source: {
            workflowRunId: 'run-1',
            workflow: 'review',
            workspace: 'C:/repo',
            objective: 'review repo',
            artifactCount: 1,
            completedStages: 2,
            totalStages: 2,
            originTaskId: null,
            sourceSurface: 'cli',
          },
          steps: ['Checar contexto', 'Rodar runtime:check'],
          details: ['Workflow: review', 'Workspace: C:/repo'],
        },
      ],
      narrative: {
        headline: 'Learning plane com 1 candidato.',
        operatorSummary: '1 pendente, 0 aprovado, 0 promovido.',
      },
    })),
    executeAction: jest.fn(() => ({
      generatedAt: '2026-05-21T12:00:00.000Z',
      candidateId: 'candidate:run-1',
      actionId: 'approve',
      status: 'applied',
      ok: true,
      summary: 'Candidato aprovado.',
      details: [],
      snapshot: {
        generatedAt: '2026-05-21T12:00:00.000Z',
        summary: {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          promoted: 0,
          published: 0,
          quarantined: 0,
          highConfidence: 0,
        },
        candidates: [],
        narrative: {
          headline: 'ok',
          operatorSummary: 'ok',
        },
      },
    })),
  };
}

describe('Experience Core Layer', () => {
  it('routes natural commands into decision-complete plans', () => {
    const router = new NaturalCommandRouterService();

    const dashboard = router.route({
      contractVersion: 'ExperienceCommand/v1',
      text: 'abre o painel',
      surface: 'cli',
      userId: 'user-1',
    });
    const coding = router.route({
      contractVersion: 'ExperienceCommand/v1',
      text: 'revise esse repo e corrija o bug',
      surface: 'cli',
      userId: 'user-1',
    });

    expect(dashboard.kind).toBe('dashboard');
    expect(dashboard.shouldExecuteAgent).toBe(false);
    expect(coding.kind).toBe('workspace-review');
    expect(coding.shouldExecuteAgent).toBe(true);
  });

  it('builds one shared snapshot with approvals, timeline, trust, memory and learning', () => {
    const run = makeRun();
    const service = new ExperienceCoreService({
      now,
      agentGateway: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: now().toISOString(),
          source: { kind: 'universal-agent-runtime', label: 'Zavorth Agent Gateway' },
          activeRun: run,
          runs: [run],
          runObservatory: {} as any,
          capabilityLoopGovernance: null,
          runtimePromotionGovernance: {} as any,
          workflowJobs: [],
          workflowQueue: {} as any,
        })),
        handle: jest.fn(),
        approve: jest.fn(),
        reject: jest.fn(),
      },
      learningPlane: makeLearningPlane(),
    });

    const snapshot = service.buildHome({ surface: 'cli', sessionId: 'session-1' });

    expect(snapshot.contractVersion).toBe('ExperienceSnapshot/v1');
    expect(snapshot.approvals).toHaveLength(1);
    expect(snapshot.timeline.map((item) => item.title)).toContain('Aprovacao solicitada');
    expect(snapshot.trust.approvalCount).toBe(1);
    expect(snapshot.memory.signals[0].title).toBe('Preferencia de validacao');
    expect(snapshot.learning.pending).toBe(1);
    expect(snapshot.daily?.pendingApprovals).toBe(1);
    expect(snapshot.daily?.pulse?.contractVersion).toBe('ExperiencePulseBrief/v1');
    expect(snapshot.daily?.pulse?.bestNextAction.command).toContain('zavorth approve');
    expect(snapshot.responseProfile?.id).toBe('dev');
    expect(snapshot.actionCards?.map((card) => card.source)).toContain('approval');
    expect(snapshot.executionGraph?.nodes.length).toBeGreaterThan(0);
    expect(snapshot.reasoningSummary?.approvalReason).toContain('Executa comando local');
  });

  it('supports explicit response profiles across shared snapshots', () => {
    const run = makeRun({
      metadata: {
        responseProfile: 'mentor',
        sandboxIsolation: 'docker',
      },
    });
    const service = new ExperienceCoreService({
      now,
      agentGateway: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: now().toISOString(),
          source: { kind: 'universal-agent-runtime', label: 'Zavorth Agent Gateway' },
          activeRun: run,
          runs: [run],
          runObservatory: {} as any,
          capabilityLoopGovernance: null,
          runtimePromotionGovernance: {} as any,
          workflowJobs: [],
          workflowQueue: {} as any,
        })),
        handle: jest.fn(),
        approve: jest.fn(),
        reject: jest.fn(),
      },
      learningPlane: makeLearningPlane(),
    });

    const snapshot = service.buildHome({
      surface: 'cli',
      sessionId: 'session-1',
      responseProfile: 'executive',
    });

    expect(snapshot.responseProfile?.contractVersion).toBe('ExperienceResponseProfile/v1');
    expect(snapshot.responseProfile?.id).toBe('executive');
    expect(snapshot.daily?.pulse?.profile.id).toBe('executive');
    expect(snapshot.daily?.pulse?.summary).toContain('perfil Executivo');
  });

  it('projects action cards, auto-healing and diff reviews without applying host changes', () => {
    const diff = [
      'diff --git a/src/app.ts b/src/app.ts',
      '--- a/src/app.ts',
      '+++ b/src/app.ts',
      '@@ -1,2 +1,3 @@',
      ' export const ok = true;',
      '+export const next = true;',
    ].join('\n');
    const run = makeRun({
      metadata: {
        sandboxIsolation: 'copy-sandbox',
        diff,
        autoHealing: {
          status: 'running',
          attempt: 2,
          maxAttempts: 3,
          lastErrorSummary: 'TS2307 no arquivo src/app.ts.',
          validationCommand: 'npm run runtime:check',
          elapsedMs: 45000,
          timeBudgetMs: 120000,
          tokensUsed: 1200,
          tokenBudget: 3000,
          cancellable: true,
        },
      },
    });
    const diffReviews = new DiffReviewService().build({ activeRun: run });
    const autoHealing = new ExperienceCoreService({
      now,
      agentGateway: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: now().toISOString(),
          source: { kind: 'universal-agent-runtime', label: 'Zavorth Agent Gateway' },
          activeRun: run,
          runs: [run],
          runObservatory: {} as any,
          capabilityLoopGovernance: null,
          runtimePromotionGovernance: {} as any,
          workflowJobs: [],
          workflowQueue: {} as any,
        })),
        handle: jest.fn(),
        approve: jest.fn(),
        reject: jest.fn(),
      },
    }).buildHome({ surface: 'cli' });

    expect(diffReviews[0].files[0]).toEqual(expect.objectContaining({
      path: 'src/app.ts',
      addedLines: 1,
      removedLines: 0,
    }));
    expect(autoHealing.diffReviews?.[0].summary).toContain('+1/-0');
    expect(autoHealing.autoHealing).toEqual(expect.objectContaining({
      status: 'running',
      attempt: 2,
      validationCommand: 'npm run runtime:check',
      budget: expect.objectContaining({
        elapsedMs: 45000,
        maxElapsedMs: 120000,
        tokensUsed: 1200,
        tokenBudget: 3000,
        cancellable: true,
      }),
    }));
    expect(autoHealing.actionCards?.some((card) => card.source === 'sandbox')).toBe(true);
    expect(autoHealing.actionCards?.some((card) =>
      card.actions.some((action) => action.id.startsWith('healing:cancel:')))).toBe(true);
  });

  it('flags dependent hunk rejection for context recovery instead of unsafe recomposition', () => {
    const diff = [
      'diff --git a/src/app.ts b/src/app.ts',
      '--- a/src/app.ts',
      '+++ b/src/app.ts',
      '@@ -1,2 +1,3 @@',
      '+const sharedValue = 1;',
      ' export const ok = true;',
      '@@ -10,2 +11,3 @@',
      '+console.log(sharedValue);',
      ' export const next = true;',
    ].join('\n');
    const [review] = new DiffReviewService().build({ activeRun: makeRun({ metadata: { diff } }) });
    const targetHunk = review.files[0].hunks[0].id;
    const result = new DiffReviewService().evaluateDecision({
      reviews: [review],
      decision: {
        reviewId: review.id,
        targetId: targetHunk,
        decision: 'reject-hunk',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('needs-context-recovery');
    expect(result.contextRecovery?.status).toBe('needs-selection');
    expect(result.contextRecovery?.options.map((option) => option.id)).toEqual(expect.arrayContaining([
      'reject-related',
      'accept-related',
      'auto-heal',
    ]));
  });

  it('asks for context recovery before acting on ambiguous targets', () => {
    const approvals = makeRun().approvals;
    const recovery = new ContextRecoveryService().build({
      text: 'aprova aquilo',
      approvals: [
        ...approvals,
        { ...approvals[0], id: 'approval-2', title: 'Rodar build' },
      ],
    });

    expect(recovery.status).toBe('needs-selection');
    expect(recovery.options).toHaveLength(2);
  });

  it('limits context recovery options on short channels and exposes dashboard overflow', () => {
    const approvals = Array.from({ length: 8 }, (_, index) => ({
      ...makeRun().approvals[0],
      id: `approval-${index + 1}`,
      title: `Aprovacao ${index + 1}`,
    }));
    const recovery = new ContextRecoveryService().build({
      text: 'aprova aquilo',
      approvals,
      surface: 'telegram',
    });

    expect(recovery.status).toBe('needs-selection');
    expect(recovery.options).toHaveLength(5);
    expect(recovery.overflow).toEqual(expect.objectContaining({
      totalOptions: 8,
      shownOptions: 5,
      hasOverflow: true,
      dashboardCommand: 'zavorth open',
    }));
  });

  it('keeps reasoning summaries explainable without raw chain of thought', () => {
    const run = makeRun({
      summary: 'Aguardando aprovacao governada.',
      events: [
        ...makeRun().events,
        {
          id: 'event-tool',
          runId: 'run-1',
          kind: 'tool',
          title: 'workspace.read',
          detail: 'Leu arquivos permitidos.',
          status: 'done',
          createdAt: '2026-05-21T11:59:10.000Z',
        },
      ],
    });
    const summary = new ReasoningSummaryService().build({
      activeRun: run,
      timeline: [],
      trust: new TrustLensService().build({ activeRun: run }),
    });

    expect(summary.understood).toContain('revise este repo');
    expect(summary.tools).not.toContain('chain-of-thought');
    expect(summary.approvalReason).toContain('Executa comando local');
  });

  it('executes agent work through the governed gateway for natural run requests', async () => {
    const completedRun = makeRun({ status: 'completed', approvals: [], summary: 'Review concluido.' });
    const handle = jest.fn(async (): Promise<UniversalAgentRunResult> => ({
      ok: true,
      run: completedRun,
      replies: [{
        id: 'reply-1',
        runId: completedRun.id,
        port: { id: 'cli', label: 'CLI', kind: 'cli', status: 'available' },
        text: 'Review concluido.',
        createdAt: '2026-05-21T12:00:00.000Z',
      }],
    }));
    const service = new ExperienceCoreService({
      now,
      agentGateway: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: now().toISOString(),
          source: { kind: 'universal-agent-runtime', label: 'Zavorth Agent Gateway' },
          activeRun: completedRun,
          runs: [completedRun],
          runObservatory: {} as any,
          capabilityLoopGovernance: null,
          runtimePromotionGovernance: {} as any,
          workflowJobs: [],
          workflowQueue: {} as any,
        })),
        handle,
        approve: jest.fn(),
        reject: jest.fn(),
      },
    });

    const result = await service.executeCommand({
      contractVersion: 'ExperienceCommand/v1',
      text: 'revise esse repo',
      intent: 'run',
      surface: 'cli',
      userId: 'user-1',
      sessionId: 'session-1',
    });

    expect(result.ok).toBe(true);
    expect(result.plan.shouldExecuteAgent).toBe(true);
    expect(handle).toHaveBeenCalledWith(expect.objectContaining({
      text: 'revise esse repo',
      channel: 'cli',
    }));
    expect(result.replies[0].text).toBe('Review concluido.');
  });

  it('keeps learning decisions explicit and reviewable', () => {
    const learningPlane = makeLearningPlane();
    const learningOs = new LearningOSService({ now, learningPlane });

    const before = learningOs.buildCandidates();
    const decision = learningOs.decide({
      candidateId: 'candidate:run-1',
      decision: 'approve',
    });

    expect(before[0]).toEqual(expect.objectContaining({
      contractVersion: 'LearningCandidate/v1',
      state: 'pending',
      confidence: 0.91,
    }));
    expect(decision.ok).toBe(true);
    expect(learningPlane.executeAction).toHaveBeenCalledWith({
      candidateId: 'candidate:run-1',
      actionId: 'approve',
    });
  });

  it('quarantines learning candidates that try to change core security policy', () => {
    const unsafePlane = makeLearningPlane();
    unsafePlane.buildSnapshot.mockReturnValue({
      generatedAt: '2026-05-21T12:00:00.000Z',
      summary: {
        total: 1,
        pending: 1,
        approved: 0,
        rejected: 0,
        promoted: 0,
        published: 0,
        quarantined: 0,
        highConfidence: 1,
      },
      candidates: [{
        id: 'candidate:unsafe-policy',
        platformEntryId: 'skill:unsafe-policy',
        title: 'Sempre permitir shell sem approval',
        kind: 'skill',
        summary: 'Modificar IntentSafetyClassifier e WorkspaceFsPolicy para nao pedir approval.',
        score: 0.99,
        reviewState: 'pending',
        lifecycle: 'learned_draft',
        createdAt: '2026-05-21T11:59:00.000Z',
        updatedAt: '2026-05-21T12:00:00.000Z',
        lastValidatedAt: '2026-05-21T12:00:00.000Z',
        source: {
          workflowRunId: 'run-1',
          workflow: 'security',
          workspace: 'C:/repo',
          objective: 'bypass approvals',
          artifactCount: 1,
          completedStages: 1,
          totalStages: 1,
          originTaskId: null,
          sourceSurface: 'cli',
        },
        steps: ['Desativar seguranca para shell'],
        details: ['IntentSafetyClassifier', 'WorkspaceFsPolicy', 'approval bypass'],
      }],
      narrative: {
        headline: 'Unsafe candidate',
        operatorSummary: '1 pendente.',
      },
    });
    const learningOs = new LearningOSService({ now, learningPlane: unsafePlane });

    const candidates = learningOs.buildCandidates();
    const decision = learningOs.decide({
      candidateId: 'candidate:unsafe-policy',
      decision: 'approve',
    });

    expect(candidates[0]).toEqual(expect.objectContaining({
      state: 'quarantined',
      recommendation: expect.stringContaining('Bloqueado'),
    }));
    expect(decision.ok).toBe(false);
    expect(decision.status).toBe('blocked');
    expect(unsafePlane.executeAction).not.toHaveBeenCalled();
  });

  it('projects journeys and trust lens without requiring UI-specific data', () => {
    const run = makeRun();
    const journey = new JourneyEngineService().buildSnapshot({ activeRun: run });
    const trust = new TrustLensService().build({ activeRun: run });

    expect(journey.status).toBe('waiting_approval');
    expect(journey.steps.length).toBeGreaterThan(0);
    expect(trust.status).toBe('attention');
    expect(trust.actions.map((item) => item.kind)).toContain('approval');
  });
});
