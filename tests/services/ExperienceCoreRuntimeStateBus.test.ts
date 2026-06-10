import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ExperienceCoreService } from '../../src/services/experience/ExperienceCoreService.js';
import { ZavorthRuntimeStateBusService } from '../../src/services/ZavorthRuntimeStateBusService.js';
import type {
  UniversalAgentRequest,
  UniversalAgentRun,
  UniversalAgentRunResult,
  UniversalAgentWorkflowJob,
} from '../../src/runtime/agent/UniversalAgentRuntimeTypes.js';

function makeRun(request: UniversalAgentRequest, overrides: Partial<UniversalAgentRun> = {}): UniversalAgentRun {
  const now = '2026-06-09T10:00:00.000Z';
  return {
    id: 'run-1',
    traceId: 'trace-1',
    requestId: request.requestId || 'request-1',
    sessionId: request.sessionId || 'session-1',
    userId: request.userId,
    channel: request.channel,
    title: 'Run code task',
    input: request.text,
    workspace: request.workspace || null,
    status: 'completed',
    createdAt: now,
    updatedAt: now,
    summary: 'done',
    events: [],
    toolExposure: {
      mode: 'safe',
      summary: 'no tools',
      tools: [],
    },
    replyPorts: [],
    modelProfile: {
      providerLabel: 'Zavorth',
      modelLabel: 'Zavorth Core',
      routingPolicy: 'gateway',
    },
    approvals: [],
    artifacts: [],
    memorySignals: [],
    metadata: request.metadata || {},
    ...overrides,
  };
}

function makeWorkflowJob(request: UniversalAgentRequest, overrides: Partial<UniversalAgentWorkflowJob> = {}): UniversalAgentWorkflowJob {
  const now = '2026-06-09T10:00:00.000Z';
  return {
    id: 'job-1',
    kind: 'resume_after_approval',
    runId: 'run-1',
    approvalId: 'approval-1',
    request,
    status: 'running',
    createdAt: now,
    updatedAt: now,
    attempts: 1,
    maxAttempts: 3,
    ...overrides,
  };
}

describe('ExperienceCoreService runtime state bus integration', () => {
  it('syncs desktop model, effort and workspace into gateway metadata and home projection', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-experience-runtime-state-'));
    const workspace = path.join(root, 'workspace');
    fs.mkdirSync(workspace, { recursive: true });
    let capturedRequest: UniversalAgentRequest | null = null;
    const runtimeStateBus = new ZavorthRuntimeStateBusService({
      stateFilePath: path.join(root, 'runtime-state.json'),
      allowedWorkspaceRoots: [root],
      now: () => new Date('2026-06-09T10:00:00.000Z'),
    });
    const agentGateway = {
      handle: jest.fn(async (request: UniversalAgentRequest): Promise<UniversalAgentRunResult> => {
        capturedRequest = request;
        return {
          ok: true,
          run: makeRun(request),
          replies: [],
        };
      }),
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-06-09T10:00:00.000Z',
        source: {
          kind: 'universal-agent-runtime',
          label: 'Zavorth Agent Gateway',
        },
        activeRun: null,
        runs: [],
        runObservatory: null,
        capabilityLoopGovernance: null,
        runtimePromotionGovernance: null,
        workflowJobs: [],
        workflowQueue: { kind: 'memory' },
      })),
      approve: jest.fn(),
      reject: jest.fn(),
    } as any;

    const service = new ExperienceCoreService({
      agentGateway,
      runtimeStateBus,
      now: () => new Date('2026-06-09T10:00:00.000Z'),
    });

    expect(service.dispatchRuntimeStateAction({
      type: 'set-model',
      approved: true,
      source: 'zavorth-desktop-bridge',
      connectedModelIds: ['zavorth:core', 'openai:gpt-5'],
      payload: { model: 'openai:gpt-5' },
    })?.ok).toBe(true);
    expect(service.dispatchRuntimeStateAction({
      type: 'set-effort',
      approved: true,
      source: 'zavorth-desktop-bridge',
      payload: { effort: 'ultra' },
    })?.ok).toBe(true);
    expect(service.dispatchRuntimeStateAction({
      type: 'set-workspace',
      approved: true,
      source: 'zavorth-desktop-bridge',
      payload: {
        workspace: {
          id: 'folder:test',
          label: 'workspace',
          kind: 'folder',
          path: workspace,
        },
      },
    })?.ok).toBe(true);

    const result = await service.executeCommand({
      text: 'implementar uma melhoria no workspace',
      intent: 'run',
      surface: 'api',
      userId: 'desktop-user',
      sessionId: 'desktop-main',
      responseProfile: 'dev',
      metadata: {
        client: 'zavorth-desktop',
        connectedModelIds: ['zavorth:core', 'openai:gpt-5'],
      },
    });

    expect(result.ok).toBe(true);
    expect(agentGateway.handle).toHaveBeenCalledTimes(1);
    expect(capturedRequest?.metadata?.effortControl).toMatchObject({
      effectiveLevel: 'ultra-code',
      routing: {
        dynamicWorkflowsRecommended: true,
      },
    });
    expect(capturedRequest?.metadata?.runtimeState).toMatchObject({
      model: {
        id: 'openai:gpt-5',
      },
      workspace: {
        path: path.resolve(workspace),
      },
    });

    const runtimeState = (result.snapshot.raw?.runtimeState || {}) as any;
    expect(runtimeState.state.model.id).toBe('openai:gpt-5');
    expect(runtimeState.state.effort.level).toBe('ultra-code');
    expect(runtimeState.projections.lifecycle.defaultFlow).toBe('preview -> approval -> execution -> receipt -> learning');

    const actionResult = service.dispatchRuntimeStateAction({
      type: 'operate-domain',
      approved: true,
      payload: {
        domain: {
          domain: 'cron',
          operation: 'pause',
        },
      },
    });
    expect(actionResult?.snapshot.state.cron.status).toBe('paused');
    expect(actionResult?.receipt.action).toBe('operate-domain');
  });

  it('uses persisted runtime selections for the next agent execution when the command omits local controls', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-experience-runtime-continuity-'));
    const workspace = path.join(root, 'workspace');
    fs.mkdirSync(workspace, { recursive: true });
    let capturedRequest: UniversalAgentRequest | null = null;
    const runtimeStateBus = new ZavorthRuntimeStateBusService({
      stateFilePath: path.join(root, 'runtime-state.json'),
      allowedWorkspaceRoots: [root],
      now: () => new Date('2026-06-09T10:00:00.000Z'),
    });
    const agentGateway = {
      handle: jest.fn(async (request: UniversalAgentRequest): Promise<UniversalAgentRunResult> => {
        capturedRequest = request;
        return {
          ok: true,
          run: makeRun(request),
          replies: [],
        };
      }),
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-06-09T10:00:00.000Z',
        source: {
          kind: 'universal-agent-runtime',
          label: 'Zavorth Agent Gateway',
        },
        activeRun: null,
        runs: [],
        runObservatory: null,
        capabilityLoopGovernance: null,
        runtimePromotionGovernance: null,
        workflowJobs: [],
        workflowQueue: { kind: 'memory' },
      })),
      approve: jest.fn(),
      reject: jest.fn(),
    } as any;
    const service = new ExperienceCoreService({
      agentGateway,
      runtimeStateBus,
      now: () => new Date('2026-06-09T10:00:00.000Z'),
    });

    expect(service.dispatchRuntimeStateAction({
      type: 'set-model',
      approved: true,
      source: 'zavorth-desktop-bridge',
      connectedModelIds: ['zavorth:core', 'openai:gpt-5'],
      payload: { model: 'openai:gpt-5' },
    })?.ok).toBe(true);
    expect(service.dispatchRuntimeStateAction({
      type: 'set-effort',
      approved: true,
      source: 'zavorth-desktop-bridge',
      payload: { effort: 'high' },
    })?.ok).toBe(true);
    expect(service.dispatchRuntimeStateAction({
      type: 'set-workspace',
      approved: true,
      source: 'zavorth-desktop-bridge',
      payload: {
        workspace: {
          id: 'folder:test',
          label: 'workspace',
          kind: 'folder',
          path: workspace,
        },
      },
    })?.ok).toBe(true);

    const result = await service.executeCommand({
      text: 'revise o workspace selecionado',
      intent: 'run',
      surface: 'api',
      userId: 'desktop-user',
      sessionId: 'desktop-main',
      responseProfile: 'dev',
      metadata: {
        client: 'zavorth-desktop',
      },
    });

    expect(result.ok).toBe(true);
    expect(capturedRequest?.workspace).toBe(path.resolve(workspace));
    expect(capturedRequest?.modelProfile).toMatchObject({
      providerLabel: 'OpenAI',
      modelLabel: 'GPT-5',
      routingPolicy: 'gateway',
      routeId: 'openai:gpt-5',
      ready: true,
    });
    expect(capturedRequest?.metadata?.effortControl).toMatchObject({
      effectiveLevel: 'high',
    });
    expect(result.snapshot.workspace).toBe(path.resolve(workspace));
  });

  it('publishes live gateway, agents, cron, context and session state into the runtime bus', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-experience-live-state-'));
    const runtimeStateBus = new ZavorthRuntimeStateBusService({
      stateFilePath: path.join(root, 'runtime-state.json'),
      now: () => new Date('2026-06-09T10:00:00.000Z'),
    });
    const request: UniversalAgentRequest = {
      userId: 'desktop-user',
      sessionId: 'session-live',
      channel: 'api',
      text: 'continue the current run',
      workspace: root,
    };
    const approval = {
      id: 'approval-1',
      runId: 'run-1',
      title: 'Allow workspace write',
      reason: 'Needs an operator decision.',
      risk: 'attention' as const,
      status: 'pending' as const,
      createdAt: '2026-06-09T10:00:00.000Z',
    };
    const activeRun = makeRun(request, {
      status: 'running',
      approvals: [approval],
      memorySignals: [{
        id: 'memory-1',
        title: 'Workspace preference',
        layer: 'working',
        summary: 'Use the selected workspace boundary.',
      }],
    });
    const workflowJob = makeWorkflowJob(request);
    const agentGateway = {
      handle: jest.fn(),
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-06-09T10:00:00.000Z',
        source: {
          kind: 'universal-agent-runtime',
          label: 'Zavorth Agent Gateway',
        },
        activeRun,
        runs: [activeRun],
        runObservatory: null,
        capabilityLoopGovernance: null,
        runtimePromotionGovernance: null,
        workflowJobs: [workflowJob],
        workflowQueue: { kind: 'memory' },
      })),
      approve: jest.fn(),
      reject: jest.fn(),
    } as any;

    const service = new ExperienceCoreService({
      agentGateway,
      runtimeStateBus,
      now: () => new Date('2026-06-09T10:00:00.000Z'),
    });

    const home = service.buildHome({
      surface: 'api',
      sessionId: 'session-live',
      userId: 'desktop-user',
      workspace: root,
    });
    const runtimeState = (home.raw?.runtimeState || {}) as any;

    expect(runtimeState.state.gateway.status).toBe('attention');
    expect(runtimeState.state.agents.status).toBe('running');
    expect(runtimeState.state.cron.status).toBe('running');
    expect(runtimeState.state.context.status).toBe('ready');
    expect(runtimeState.state.session.sessionId).toBe('session-live');
    expect(runtimeState.state.session.surface).toBe('api');
    expect(runtimeState.receipts.some((receipt: any) => receipt.action === 'domain-state' && receipt.domain === 'agents')).toBe(true);
    expect(runtimeState.receipts.some((receipt: any) => receipt.action === 'domain-state' && receipt.domain === 'cron')).toBe(true);
  });

  it('records learning decisions as learning-phase runtime receipts', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-experience-learning-state-'));
    const runtimeStateBus = new ZavorthRuntimeStateBusService({
      stateFilePath: path.join(root, 'runtime-state.json'),
      now: () => new Date('2026-06-09T10:00:00.000Z'),
    });
    const learningPlane = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-06-09T10:00:00.000Z',
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
          id: 'learn-1',
          platformEntryId: 'platform-learn-1',
          title: 'Prefer local workspace receipts',
          kind: 'playbook',
          summary: 'Use receipts before mutating project files.',
          score: 0.91,
          reviewState: 'pending',
          lifecycle: 'learned_draft',
          createdAt: '2026-06-09T10:00:00.000Z',
          updatedAt: '2026-06-09T10:00:00.000Z',
          lastValidatedAt: '2026-06-09T10:00:00.000Z',
          source: {
            workflowRunId: 'run-1',
            workflow: 'experience',
            workspace: root,
            objective: 'improve routing',
            artifactCount: 1,
            completedStages: 1,
            totalStages: 1,
            originTaskId: null,
            sourceSurface: 'desktop',
          },
          steps: ['Check runtime receipts before action.'],
          details: ['Derived from a completed local run.'],
        }],
        narrative: {
          headline: 'Learning pending',
          operatorSummary: '1 learning candidate pending.',
        },
      })),
      executeAction: jest.fn(() => ({
        generatedAt: '2026-06-09T10:00:00.000Z',
        candidateId: 'learn-1',
        actionId: 'approve',
        status: 'applied',
        ok: true,
        summary: 'Learning approved.',
        details: ['Stored as governed memory.'],
        snapshot: {
          generatedAt: '2026-06-09T10:00:00.000Z',
          summary: {
            total: 1,
            pending: 0,
            approved: 1,
            rejected: 0,
            promoted: 0,
            published: 0,
            quarantined: 0,
            highConfidence: 1,
          },
          candidates: [],
          narrative: {
            headline: 'Learning approved',
            operatorSummary: 'Learning approved.',
          },
        },
      })),
    };
    const service = new ExperienceCoreService({
      learningPlane: learningPlane as any,
      runtimeStateBus,
      now: () => new Date('2026-06-09T10:00:00.000Z'),
    });

    const result = await service.executeCommand({
      text: 'aprovar aprendizado',
      surface: 'api',
      userId: 'desktop-user',
      sessionId: 'session-learning',
      workspace: root,
      learning: {
        candidateId: 'learn-1',
        decision: 'approve',
      },
    });

    const runtimeState = (result.snapshot.raw?.runtimeState || {}) as any;
    expect(result.ok).toBe(true);
    expect(runtimeState.state.context.summary).toContain('Learning approved');
    expect(runtimeState.receipts.some((receipt: any) => (
      receipt.domain === 'context'
      && receipt.action === 'domain-state'
      && receipt.phase === 'learning'
    ))).toBe(true);
  });

  it('exposes sanitized runtime capabilities from the same runtime state bus', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-experience-capabilities-'));
    const runtimeStateBus = new ZavorthRuntimeStateBusService({
      stateFilePath: path.join(root, 'runtime-state.json'),
      now: () => new Date('2026-06-10T11:30:00.000Z'),
    });
    const service = new ExperienceCoreService({
      runtimeStateBus,
      now: () => new Date('2026-06-10T11:30:00.000Z'),
    });

    service.dispatchRuntimeStateAction({
      type: 'register-personal-connector',
      approved: true,
      payload: {
        personalConnector: {
          id: 'calendar:primary',
          kind: 'calendar',
          label: 'Primary calendar',
          configured: true,
          rawToken: 'calendar-token-should-not-leak',
        },
      },
    });

    const capabilities = service.buildRuntimeCapabilities();

    expect(capabilities?.contractVersion).toBe('zavorth-runtime-capabilities/1');
    expect(capabilities?.personalOps.connectors.find((connector) => connector.id === 'calendar:primary')).toMatchObject({
      status: 'configured',
      enabled: false,
      writeRequiresApproval: true,
    });
    expect(capabilities?.modelSpecs.selectedSpecId).toBe('daily');
    expect(JSON.stringify(capabilities)).not.toContain('calendar-token-should-not-leak');
  });

  it('syncs operational spine state before building runtime capabilities', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-experience-runtime-spine-'));
    const runtimeStateBus = new ZavorthRuntimeStateBusService({
      stateFilePath: path.join(root, 'runtime-state.json'),
      now: () => new Date('2026-06-10T12:30:00.000Z'),
    });
    const service = new ExperienceCoreService({
      runtimeStateBus,
      runtimeOperationalSpine: {
        syncOperationalState: async () => {
          runtimeStateBus.dispatch({
            type: 'set-provider-connection',
            approved: true,
            source: 'test-spine',
            payload: {
              providerConnection: {
                providerId: 'ollama',
                label: 'Ollama local',
                targetUrl: 'http://127.0.0.1:11434',
              },
            },
          });
          return {
            ok: true,
            generatedAt: '2026-06-10T12:30:00.000Z',
            summary: {
              providerConnections: 1,
              connectedModels: 1,
              trustedWorkspaces: 0,
              recoverableJobs: 0,
              mcpServers: 0,
              sessionResumable: false,
            },
          };
        },
      },
      now: () => new Date('2026-06-10T12:30:00.000Z'),
    });

    await service.syncRuntimeOperationalState({
      userId: 'desktop-user',
      sessionId: 'desktop-main',
    });
    const capabilities = service.buildRuntimeCapabilities();

    expect(capabilities?.providers.connected).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'ollama' }),
    ]));
  });
});
