import { renderSurfaceResponseForTarget } from '../../../src/domain/surface/application/surface-response';
import { ZavorthAgentSurfaceUxService } from '../../../src/services/ZavorthAgentSurfaceUxService';

describe('Agent surface UX', () => {
  it('renders agent runtime actions across Telegram, Discord and text-only channels', () => {
    const service = new ZavorthAgentSurfaceUxService();
    const response = service.buildSubagentRuntimeResponse(buildSnapshot() as any);

    const telegram = renderSurfaceResponseForTarget('telegram', response);
    const discord = renderSurfaceResponseForTarget('discord', response);

    expect(telegram.text).toContain('Zavorth agents');
    expect(telegram.text).toContain('/agents read latest');
    expect((telegram.native as any).replyMarkup.inline_keyboard.flat()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'Status' }),
        expect.objectContaining({ text: 'New agent' }),
        expect.objectContaining({ text: 'Read latest' }),
      ]),
    );
    expect((discord.native as any).components[0].components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Status' }),
        expect.objectContaining({ label: 'New agent' }),
      ]),
    );

    for (const target of ['whatsapp', 'signal', 'imessage', 'cli', 'web'] as const) {
      const rendered = renderSurfaceResponseForTarget(target, response);
      expect(rendered.text).toContain('Zavorth agents');
      expect(rendered.text).toContain('/agents status');
      expect(rendered.text).toContain('/agents cancel latest');
    }
  });

  it('renders natural invocation as the same shared response in every surface', () => {
    const service = new ZavorthAgentSurfaceUxService();
    const response = service.buildNaturalInvocationResponse(buildPlan() as any);

    const telegram = renderSurfaceResponseForTarget('telegram', response);
    const discord = renderSurfaceResponseForTarget('discord', response);
    const signal = renderSurfaceResponseForTarget('signal', response);

    expect(telegram.text).toContain('Zavorth Natural Invoke');
    expect(telegram.text).toMatch(/Action: spawn_team|Acao: spawn_team|spawn_team/i);
    expect((telegram.native as any).replyMarkup.inline_keyboard.flat()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'Plan' }),
        expect.objectContaining({ text: 'Agents' }),
        expect.objectContaining({ text: 'Spawn' }),
      ]),
    );
    expect((discord.native as any).components[0].components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Plan' }),
        expect.objectContaining({ label: 'Agents' }),
      ]),
    );
    expect(signal.text).toContain('/invoke "mande um agente pesquisar');
    expect(signal.text).toContain('/agents status');
  });
});

function buildSnapshot() {
  return {
    generatedAt: '2026-05-11T12:00:00.000Z',
    source: 'ZavorthSubagentRuntimeService',
    action: 'subagents.list',
    status: 'ready',
    projectRoot: 'C:/repo',
    mode: 'oneshot',
    selectedSessionId: 'latest',
    selectedRunId: 'run-1',
    sessions: [{
      sessionId: 'latest',
      mode: 'session',
      executionMode: 'mock-live',
      sourceSurface: 'channel',
      channel: 'telegram',
      actorId: 'user-1',
      threadId: 'chat-1',
      status: 'running',
      createdAt: '2026-05-11T12:00:00.000Z',
      updatedAt: '2026-05-11T12:01:00.000Z',
      roleIds: ['planner', 'qa'],
      profileSummaries: [],
      messages: [{
        id: 'msg-1',
        generatedAt: '2026-05-11T12:01:00.000Z',
        role: 'subagent',
        text: 'Analise parcial concluida.',
        receiptId: null,
      }],
      runIds: ['run-1'],
    }],
    runs: [],
    timeline: [{
      id: 'event-1',
      generatedAt: '2026-05-11T12:01:00.000Z',
      kind: 'spawn',
      sessionId: 'latest',
      runId: 'run-1',
      status: 'running',
      detail: 'Workers read-only iniciados.',
      receiptId: null,
    }],
    parentChildTree: [],
    summary: {
      sessions: 1,
      activeSessions: 1,
      runs: 1,
      runningRuns: 1,
      completedRuns: 0,
      approvalRequiredRuns: 0,
      deniedRuns: 0,
      policyReceipts: 1,
      subagentReceipts: 2,
      workerResults: 2,
      failedWorkerResults: 0,
      liveRuns: 1,
      invocationReceipts: 1,
      workspaceMutationPerformed: false,
      externalIoPerformed: false,
      upstreamRuntimeCodeExecuted: false,
      autoInvocationDecisions: 1,
    },
    autoInvocationTelemetry: {
      latest: null,
      decisions: [],
      dashboardProjection: {
        available: true,
        title: 'Auto subagents',
        summary: 'Zavorth escolheu subagentes read-only.',
        selectedBy: 'explicit-user-request',
        roles: ['planner', 'qa'],
        triggers: ['subagentes'],
        riskSignals: [],
        nextSafeAction: '/agents read latest',
      },
    },
    limits: {},
    policy: {},
    receipts: [],
    commands: {},
  };
}

function buildPlan() {
  return {
    generatedAt: '2026-05-11T12:00:00.000Z',
    source: 'ZavorthNaturalInvocationRouter',
    status: 'ready',
    channel: 'telegram',
    actorId: 'user-1',
    requestText: 'mande um agente pesquisar e outro validar canais',
    primaryAction: 'spawn_team',
    actions: ['spawn_team'],
    confidence: 0.94,
    candidates: [{
      id: 'subagent:session',
      label: 'Governed subagent team',
      kind: 'team',
      confidence: 0.94,
      reason: 'Pedido explicito de subagentes.',
      requiresApproval: false,
    }],
    selectedSkillName: null,
    selectedSubagentMode: 'session',
    selectedRoleIds: ['planner', 'researcher', 'qa'],
    subagentAutoInvocation: null,
    sourcePath: null,
    approval: { required: false, reason: null, approvalId: null },
    safety: {},
    execution: {
      subagentRuntime: {
        status: 'completed',
        summary: { liveRuns: 1, workerResults: 3 },
      },
      skillBridge: null,
    },
    surfaceCommands: [
      { command: '/agents', label: 'Agents' },
      { command: '/agents spawn <task>', label: 'Spawn agent' },
      { command: '/invoke <request>', label: 'Natural invoke' },
    ],
    receipts: [],
    narrative: {
      headline: 'Natural invocation routed',
      summary: 'Router selected spawn_team.',
      nextAction: 'Acompanhe em /agents status.',
    },
    commands: {},
  };
}
