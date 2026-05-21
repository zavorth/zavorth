import {
  ExperienceCoreService,
  NaturalCommandRouterService,
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
