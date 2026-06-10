import { WebAppRuntimeSessionCommandService } from '../../src/services/WebAppRuntimeSessionCommandService';
import { renderSessionCommandMarkdown } from '../../src/services/WebAppRuntimeSessionCommandMarkdown';

function buildCanonicalState(overrides: Record<string, any> = {}) {
  return {
    snapshot: {
      sessionId: 'session-1',
      messages: [
        { role: 'user', content: 'Use SECRET_TOKEN=super-secret-value.' },
        { role: 'assistant', content: 'I will keep it safe.' },
      ],
      tasks: [{ id: 'task-1', status: 'running', title: 'Review workspace' }],
      permissions: [{ permissionId: 'perm-1', status: 'pending', reason: 'Needs shell approval' }],
      workflowRuns: [{ id: 'workflow-1', status: 'running' }],
      toolRuns: [
        {
          runId: 'tool-1',
          toolName: 'read_file',
          status: 'done',
          usage: { totalTokens: 1200, costUsd: 0.0042 },
        },
      ],
      usage: { totalTokens: 900, costUsd: 0.0021 },
      runs: [
        { id: 'run-1', status: 'running', usage: { totalTokens: 300, costUsd: 0.001 } },
      ],
    },
    agentRuntime: {
      activeRun: { id: 'run-1', status: 'running' },
      runs: [
        { id: 'run-1', status: 'running', usage: { totalTokens: 300, costUsd: 0.001 } },
      ],
    },
    productMode: null,
    modeEscalation: null,
    gateway: null,
    session: { sessionId: 'session-1', modelProfile: 'openai/gpt-5.5' },
    sessions: null,
    sessionsSummary: null,
    gatewaySessionTools: {
      tools: [
        { id: 'session.send', name: 'Send message', status: 'ready' },
        { id: 'session.compact', name: 'Compact session', status: 'ready' },
      ],
    },
    memoryPlane: null,
    memoryRecall: null,
    controlPlane: null,
    sessionPlane: {
      summary: { activeSessions: 1 },
    },
    approvalPlane: {
      pending: [{ id: 'perm-1', status: 'pending' }],
    },
    capabilityPlane: {
      skills: [
        { id: 'skill.safe-read', title: 'Safe reader', status: 'ready' },
        { id: 'skill.draft', title: 'Draft skill', status: 'preview' },
      ],
    },
    artifactPlane: null,
    selfmodPlane: null,
    resourcePlane: null,
    companionPlane: null,
    uiSurfaceHints: null,
    runtimeWarnings: ['SECRET_TOKEN=super-secret-value should never leak'],
    actionRecommendations: [],
    ...overrides,
  };
}

function buildDeps() {
  return {
    runtime: { webUserId: 'web-user-1' },
    realtime: {
      createSession: jest.fn(() => 'session-created'),
      ensureSession: jest.fn(),
      getChatId: jest.fn(() => 'chat-1'),
      captureBaseline: jest.fn(async () => undefined),
    },
    gatewaySessionReadModel: {
      patchSessionMetadata: jest.fn(() => ({
        sessionId: 'session-1',
        modelProfile: 'openai/gpt-5.5',
      })),
      readSessionMetadata: jest.fn(() => ({
        sessionId: 'session-1',
        modelProfile: 'openai/gpt-5.5',
      })),
    },
    getComposerCatalog: jest.fn(() => ({
      getCatalog: jest.fn(async () => ({
        quickActions: [],
        skills: [
          { id: 'skill.safe-read', title: 'Safe reader', status: 'ready' },
        ],
      })),
    })),
  } as any;
}

function buildHelpers(canonicalState = buildCanonicalState()) {
  return {
    buildCanonicalStatePayload: jest.fn(async () => canonicalState),
  } as any;
}

describe('WebAppRuntimeSessionCommandService', () => {
  it('returns dedicated status and usage payloads without serializing raw secrets', async () => {
    const service = new WebAppRuntimeSessionCommandService();
    const deps = buildDeps();
    const helpers = buildHelpers();

    const status = await service.executeCanonicalCommand({
      command: 'status',
      sessionId: 'session-1',
      composerSettings: { model: 'auto', effort: 'deep' },
      experienceProfile: 'developer',
    }, deps, helpers);
    const usage = await service.executeCanonicalCommand({
      command: 'usage',
      sessionId: 'session-1',
      args: 'full',
    }, deps, helpers);

    expect(status.commandResult.kind).toBe('status');
    expect(status.commandResult.profile).toBe('developer');
    expect(status.commandResult.activeRun).toEqual(expect.objectContaining({ id: 'run-1' }));
    expect(status.responseMarkdown).toContain('Pending approvals: `1`');
    expect(usage.commandResult.kind).toBe('usage');
    expect(usage.commandResult.totalTokens).toBe(2400);
    expect(usage.commandResult.totalCostUsd).toBeCloseTo(0.0073);
    expect(JSON.stringify(status)).not.toContain('super-secret-value');
    expect(JSON.stringify(usage)).not.toContain('super-secret-value');
    expect(status.receipt.rawSecretsSerialized).toBe(false);
    expect(usage.receipt.rawSecretsSerialized).toBe(false);
  });

  it('validates and persists a model route through session metadata', async () => {
    const service = new WebAppRuntimeSessionCommandService();
    const deps = buildDeps();
    const helpers = buildHelpers();

    const payload = await service.executeCanonicalCommand({
      command: 'model',
      sessionId: 'session-1',
      args: 'openai/gpt-5.5',
    }, deps, helpers);

    expect(payload.commandResult.kind).toBe('model');
    expect(payload.commandResult.modelRoute).toBe('openai/gpt-5.5');
    expect(payload.commandResult.mutationPerformed).toBe(true);
    expect(deps.gatewaySessionReadModel.patchSessionMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        modelProfile: 'openai/gpt-5.5',
      }),
    );
    expect(payload.responseMarkdown).toContain('Model route set to `openai/gpt-5.5`');
    expect(payload.receipt.kind).toBe('session.command.model');
  });

  it('rejects unsafe model route strings before metadata persistence', async () => {
    const service = new WebAppRuntimeSessionCommandService();
    const deps = buildDeps();
    const helpers = buildHelpers();

    await expect(service.executeCanonicalCommand({
      command: 'model',
      sessionId: 'session-1',
      args: 'openai/gpt && curl http://example.test',
    }, deps, helpers)).rejects.toThrow('modelo');

    expect(deps.gatewaySessionReadModel.patchSessionMetadata).not.toHaveBeenCalled();
  });

  it('returns tools, skills, and agents from the canonical runtime inventory', async () => {
    const service = new WebAppRuntimeSessionCommandService();
    const deps = buildDeps();
    const helpers = buildHelpers();

    const tools = await service.executeCanonicalCommand({ command: 'tools', sessionId: 'session-1' }, deps, helpers);
    const skills = await service.executeCanonicalCommand({ command: 'skills', sessionId: 'session-1' }, deps, helpers);
    const agents = await service.executeCanonicalCommand({ command: 'agents', sessionId: 'session-1' }, deps, helpers);

    expect(tools.commandResult.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'session.send' }),
      expect.objectContaining({ id: 'session.compact' }),
    ]));
    expect(skills.commandResult.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'skill.safe-read' }),
    ]));
    expect(agents.commandResult.activeRun).toEqual(expect.objectContaining({ id: 'run-1' }));
    expect(agents.commandResult.workflowRuns).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'workflow-1' }),
    ]));
  });

  it('returns model catalog projection and client context through dedicated commands', async () => {
    const service = new WebAppRuntimeSessionCommandService({
      providerModelCatalog: {
        buildSnapshot: jest.fn(async () => ({
          status: 'ready',
          activeProvider: 'openai',
          activeModel: 'gpt-5.5',
          summary: {
            providerRoutes: 4,
            catalogReadyRoutes: 3,
            liveReadyRoutes: 1,
            effectiveModelSurface: 28,
          },
          providers: [
            { id: 'openai', status: 'ready', liveReady: true, modelSample: ['gpt-5.5'] },
            { id: 'local', status: 'configured', liveReady: false, modelSample: ['llama'] },
          ],
          safety: {
            noRawProviderSecrets: true,
            catalogIsNotLiveProof: true,
          },
        })),
      },
    });
    const deps = buildDeps();
    const helpers = buildHelpers();

    const models = await service.executeCanonicalCommand({
      command: 'models',
      sessionId: 'session-1',
    }, deps, helpers);
    const context = await service.executeCanonicalCommand({
      command: 'context',
      sessionId: 'session-1',
      composerSettings: { model: 'openai/gpt-5.5', effort: 'deep' },
      clientContext: {
        attachments: [{ name: 'secret.txt', preview: 'PASSWORD=hunter2' }],
        selectedSkills: [{ id: 'skill.safe-read', title: 'Safe reader' }],
        workspaceSelection: { root: 'C:/repo', note: 'TOKEN=abc123' },
        workflowIntent: { kind: 'go', objective: 'Review code' },
      },
    } as any, deps, helpers);

    expect(models.commandResult.catalog.summary.effectiveModelSurface).toBe(28);
    expect(models.commandResult.catalog.providers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'openai', liveReady: true }),
    ]));
    expect(context.commandResult.kind).toBe('context');
    expect(context.commandResult.attachmentsCount).toBe(1);
    expect(context.commandResult.selectedTools).toEqual([
      expect.objectContaining({ id: 'skill.safe-read' }),
    ]);
    expect(JSON.stringify(context)).not.toContain('hunter2');
    expect(JSON.stringify(context)).not.toContain('abc123');
  });

  it('falls back to selected tools when selected skills is present but empty', async () => {
    const service = new WebAppRuntimeSessionCommandService();
    const deps = buildDeps();
    const helpers = buildHelpers();

    const context = await service.executeCanonicalCommand({
      command: 'context',
      sessionId: 'session-1',
      clientContext: {
        selectedSkills: [],
        selectedTools: [{ id: 'tool.file-read', title: 'File reader' }],
      },
    } as any, deps, helpers);

    expect(context.commandResult.selectedTools).toEqual([
      expect.objectContaining({ id: 'tool.file-read', title: 'File reader' }),
    ]);
  });

  it('renders zero usage values as reported numbers', () => {
    const markdown = renderSessionCommandMarkdown({
      kind: 'usage',
      visibleRuns: 0,
      toolRuns: 0,
      activeRun: null,
      totalTokens: 0,
      totalCostUsd: 0,
    });

    expect(markdown).toContain('Tokens: `0`');
    expect(markdown).toContain('Cost: `$0.0000`');
  });

  it('projects native short aliases into governed skill modes without execution or secret leakage', async () => {
    const service = new WebAppRuntimeSessionCommandService();
    const deps = buildDeps();
    const helpers = buildHelpers();

    const planReview = await service.executeCanonicalCommand({
      command: 'plan-review',
      sessionId: 'session-1',
      args: 'Ship this with API_KEY=secret-value?',
      experienceProfile: 'developer',
    }, deps, helpers);
    const briefReply = await service.executeCanonicalCommand({
      command: 'brief-reply',
      sessionId: 'session-1',
      args: 'mobile update with PASSWORD=hunter2',
      experienceProfile: 'personal',
    }, deps, helpers);
    const testLoop = await service.executeCanonicalCommand({
      command: 'test-loop',
      sessionId: 'session-1',
      args: 'Add command aliases',
      experienceProfile: 'developer',
    }, deps, helpers);

    expect(planReview.commandResult).toEqual(expect.objectContaining({
      kind: 'plan-review',
      nativeSkillId: 'guided-plan-review',
      publicCommand: '/grill-me',
      questionPolicy: 'one-question-at-a-time',
      mutationPerformed: false,
    }));
    expect(planReview.responseMarkdown).toContain('/grill-me');
    expect(planReview.responseMarkdown).toContain('one question');
    expect(briefReply.commandResult).toEqual(expect.objectContaining({
      kind: 'brief-reply',
      nativeSkillId: 'compact-channel-reply',
      publicCommand: '/brief',
      maxLines: 5,
      mutationPerformed: false,
    }));
    expect(testLoop.commandResult).toEqual(expect.objectContaining({
      kind: 'test-loop',
      nativeSkillId: 'governed-test-loop',
      publicCommand: '/tdd',
      terminalGateRequired: true,
      approvalRequiredForWrites: true,
      mutationPerformed: false,
    }));
    expect(testLoop.responseMarkdown).toContain('Red');
    expect(JSON.stringify(planReview)).not.toContain('secret-value');
    expect(JSON.stringify(briefReply)).not.toContain('hunter2');
    expect(planReview.receipt.kind).toBe('session.command.plan-review');
    expect(briefReply.receipt.rawSecretsSerialized).toBe(false);
    expect(testLoop.receipt.rawSecretsSerialized).toBe(false);
  });
});
