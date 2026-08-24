import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildInboundChannelEvent } from '../../../src/channels/contracts/ChannelMessageContract.js';
import { ChannelMeshOnboardingGate } from '../../../src/channels/onboarding/ChannelMeshOnboardingGate.js';
import { GatewayEventBus } from '../../../src/gateway/events/GatewayEventBus.js';
import {
  ZavorthAgentGateway,
  JsonAgentRunStore,
  JsonAgentWorkflowQueueStore,
} from '../../../src/runtime/agent/index.js';
import { MemoryReplyPort } from '../../../src/runtime/reply/index.js';

import type { UniversalAgentExecutor } from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

function createPassThroughOnboardingGate(): ChannelMeshOnboardingGate {
  return new ChannelMeshOnboardingGate({ isGlobalProfileComplete: () => true });
}

// Contention budget: agent-run pipeline tests exceed the 5s Jest default
// when full-group parallel workers load the machine.
jest.setTimeout(120000);

describe('ZavorthAgentGateway', () => {
  it('runs a channel-neutral agent execution and replies through the origin port', async () => {
    const executor: UniversalAgentExecutor = ({ run }) => ({
      status: 'completed',
      summary: 'Comparei o workspace e preparei um resumo.',
      replyText: 'Resumo pronto no Dashboard.',
      events: [
        {
          kind: 'tool',
          title: 'workspace_compare',
          detail: 'Comparacao executada em modo leitura.',
          status: 'done',
        },
      ],
      artifacts: [
        {
          id: 'artifact-1',
          title: 'Resumo de mudancas',
          kind: 'report',
          createdAt: run.createdAt,
          sessionId: run.sessionId,
          status: 'ready',
        },
      ],
    });
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T12:00:00.000Z'),
      idFactory: createIdFactory(),
      defaultProviderLabel: 'OpenAI',
      defaultModelLabel: 'gpt-4o',
      executor,
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-1',
      text: 'compare o que mudou nessa pasta',
      requestedTools: ['read_file'],
      modelProfile: {
        routingPolicy: 'gateway',
        supportsTools: true,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.run).toEqual(
      expect.objectContaining({
        status: 'completed',
        sessionId: 'session-1',
        channel: 'web',
        summary: 'Comparei o workspace e preparei um resumo.',
      }),
    );
    expect(result.run.toolExposure).toEqual(
      expect.objectContaining({
        mode: 'safe',
        tools: expect.arrayContaining([
          expect.objectContaining({
            id: 'read_file',
            risk: 'safe',
            requiresApproval: false,
          }),
        ]),
      }),
    );
    expect(result.run.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'input',
          title: 'Request received',
        }),
        expect.objectContaining({
          kind: 'tool',
          title: 'workspace_compare',
        }),
      ]),
    );
    expect(result.run.artifacts).toEqual([
      expect.objectContaining({
        id: 'artifact-1',
        status: 'ready',
      }),
    ]);
    expect(result.replies).toEqual([
      expect.objectContaining({
        runId: result.run.id,
        text: 'Resumo pronto no Dashboard.',
        port: expect.objectContaining({
          kind: 'web',
          label: 'ZavorthControl',
          primary: true,
        }),
      }),
    ]);
    expect(gateway.buildSnapshot().activeRun?.id).toBe(result.run.id);
  });

  it('subscribes to Channel Mesh events and routes normalized inbound messages through the gateway', async () => {
    const eventBus = new GatewayEventBus();
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(({ request }) => ({
      status: 'completed',
      summary: `Canal ${request.metadata?.platform} roteado.`,
      replyText: `Recebido de ${request.metadata?.platform}: ${request.text}`,
    }));
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T14:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const subscription = gateway.attachChannelMeshEventBus(eventBus, {}, {
      onboardingGate: createPassThroughOnboardingGate(),
    });

    await eventBus.emit(
      buildInboundChannelEvent({
        platform: 'slack',
        userId: 'U123',
        chatId: 'C-ops',
        rawText: 'compare o deploy',
        messageId: '171234.0001',
        now: new Date('2026-04-27T13:59:30.000Z'),
        fields: {
          channelId: 'C-ops',
        },
      }),
    );

    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor.mock.calls[0]?.[0].request).toEqual(
      expect.objectContaining({
        userId: 'U123',
        sessionId: 'slack:C-ops',
        channel: 'api',
        text: 'compare o deploy',
        metadata: expect.objectContaining({
          source: 'channel-mesh',
          platform: 'slack',
          normalizedInboundMessage: true,
          channelMeshBridge: expect.objectContaining({
            source: 'ZavorthAgentGateway.attachChannelMeshEventBus',
            receivedAt: '2026-04-27T14:00:00.000Z',
          }),
        }),
      }),
    );
    expect(gateway.buildSnapshot({ activeSessionId: 'slack:C-ops' }).activeRun).toEqual(
      expect.objectContaining({
        channel: 'api',
        sessionId: 'slack:C-ops',
        input: 'compare o deploy',
      }),
    );

    subscription.detach();
    await eventBus.emit(
      buildInboundChannelEvent({
        platform: 'slack',
        userId: 'U123',
        chatId: 'C-ops',
        rawText: 'ignorar depois do detach',
        messageId: '171234.0002',
        now: new Date('2026-04-27T14:01:00.000Z'),
      }),
    );

    expect(executor).toHaveBeenCalledTimes(1);
    expect(gateway.listRuns()).toHaveLength(1);
  });

  it('accepts a selfmod service attached after bootstrap-time gateway construction', async () => {
    const createGoalPreview = jest.fn().mockResolvedValue({
      success: true,
      mode: 'goal',
      previewId: 'bootstrap-selfmod-preview-1',
      traceId: 'trace-bootstrap-selfmod',
      runId: 'run-bootstrap-selfmod',
      sessionId: 'telegram:4242',
      artifactId: 'bootstrap-selfmod-preview-1',
      summary: 'Preview de bootstrap preparado.',
      changeCount: 1,
      validationPlan: ['npm run runtime:check'],
      execution_lifecycle: [
        {
          kind: 'plan',
          status: 'planned',
          source: 'selfmod',
        },
      ],
    });
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T13:00:00.000Z'),
      idFactory: createIdFactory(),
      defaultProviderLabel: 'Zavorth',
      defaultModelLabel: 'modelo atual',
    });

    gateway.attachSelfModificationService({ createGoalPreview });

    const result = await gateway.handle({
      userId: 'operator',
      channel: 'telegram',
      sessionId: 'telegram:4242',
      text: 'proponha uma auto melhoria segura no boot',
      requestedTools: ['selfmod.preview'],
    });

    expect(createGoalPreview).toHaveBeenCalledWith('proponha uma auto melhoria segura no boot', 'operator');
    expect(result.run.status).toBe('completed');
    expect(result.run.summary).toBe('Preview de bootstrap preparado.');
    expect(result.run.metadata).toEqual(
      expect.objectContaining({
        selfModificationPreview: expect.objectContaining({
          previewId: 'bootstrap-selfmod-preview-1',
          previewFirst: true,
          applyServiceCalled: false,
          rollbackServiceCalled: false,
        }),
      }),
    );
    expect(result.replies[0].text).toContain('Apply was not executed.');
  });

  it('keeps run, trace and session identity on gateway replies delivered by MemoryReplyPort', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T12:03:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed',
        summary: 'Identidade de run preservada.',
        replyText: 'Pacote pronto para entrega em memoria.',
      }),
    });

    const result = await gateway.handle({
      requestId: 'request-identity',
      traceId: 'trace-dashboard',
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-identity',
      text: 'confirme os identificadores do run',
      requestedTools: [],
    });
    const memoryPort = new MemoryReplyPort({
      now: () => new Date('2026-04-26T12:04:00.000Z'),
    });

    const deliveries = await memoryPort.sendAll(result.replies);

    expect(result.run).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^agent-run-/),
        requestId: 'request-identity',
        traceId: 'trace-dashboard',
        sessionId: 'session-identity',
      }),
    );
    expect(result.run.metadata).toEqual(
      expect.objectContaining({
        traceId: 'trace-dashboard',
        adapterSource: 'universal-agent-runtime',
      }),
    );
    expect(deliveries).toEqual([
      expect.objectContaining({
        runId: result.run.id,
        deliveredAt: '2026-04-26T12:04:00.000Z',
        metadata: expect.objectContaining({
          traceId: 'trace-dashboard',
          sessionId: 'session-identity',
        }),
      }),
    ]);
  });

  it('queries local runs through the Run Observatory by run, trace, session and status', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T12:04:30.000Z'),
      idFactory: createIdFactory(),
      executor: ({ request }) => ({
        status: request.text.includes('falhe') ? 'failed' : 'completed',
        summary: `Run ${request.traceId} processada.`,
        replyText: 'Run registrada.',
      }),
    });

    const first = await gateway.handle({
      requestId: 'request-observatory-1',
      traceId: 'trace-observatory-a',
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-observatory-a',
      text: 'responda algo simples',
      requestedTools: [],
    });
    const second = await gateway.handle({
      requestId: 'request-observatory-2',
      traceId: 'trace-observatory-b',
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-observatory-b',
      text: 'falhe de forma observavel',
      requestedTools: [],
    });

    expect(gateway.queryRuns({ runId: first.run.id }).runs).toEqual([
      expect.objectContaining({
        run: expect.objectContaining({ id: first.run.id }),
        matchedBy: ['runId'],
      }),
    ]);
    expect(gateway.queryRuns({ traceId: 'trace-observatory-b' }).runs).toEqual([
      expect.objectContaining({
        run: expect.objectContaining({ id: second.run.id }),
        matchedBy: ['traceId'],
      }),
    ]);
    expect(gateway.queryRuns({ sessionId: 'session-observatory-a' }).runs).toEqual([
      expect.objectContaining({
        run: expect.objectContaining({ id: first.run.id }),
        matchedBy: ['sessionId'],
      }),
    ]);
    expect(gateway.queryRuns({ status: 'failed' }).runs).toEqual([
      expect.objectContaining({
        run: expect.objectContaining({ id: second.run.id, status: 'failed' }),
        matchedBy: ['status'],
      }),
    ]);

    const snapshot = gateway.buildSnapshot({
      activeTraceId: 'trace-observatory-b',
      runStatus: 'failed',
    });

    expect(snapshot.activeRun?.id).toBe(second.run.id);
    expect(snapshot.runObservatory).toEqual(
      expect.objectContaining({
        query: expect.objectContaining({
          traceId: 'trace-observatory-b',
          status: 'failed',
        }),
        totalRuns: 2,
        matchedRuns: 1,
      }),
    );
    expect(snapshot.runObservatory.indexes.sessionIds).toEqual(
      expect.arrayContaining(['session-observatory-a', 'session-observatory-b']),
    );
  });

  it('keeps imported capability trust metadata observable in gateway snapshots', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T12:04:30.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed',
        summary: 'Trust snapshot preservado.',
        replyText: 'Trust snapshot preservado.',
      }),
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-trust-snapshot',
      text: 'observe capabilities importadas',
      requestedTools: [],
      metadata: {
        coldContext: {
          skillContext: {
            trustSummary: {
              trusted: 0,
              safe: 1,
              quarantined: 1,
            },
            riskReports: [
              {
                kind: 'skill',
                id: 'imported-skill-draft',
                trustState: 'quarantined',
                quarantined: true,
              },
            ],
          },
          mcpContext: {
            trustSummary: {
              trusted: 1,
              safe: 0,
              quarantined: 0,
            },
            riskReports: [
              {
                kind: 'mcp',
                id: 'zavorth-core',
                trustState: 'trusted',
                quarantined: false,
              },
            ],
          },
        },
      },
    });

    const snapshot = gateway.buildSnapshot({
      activeRunId: result.run.id,
    });

    expect(snapshot.activeRun?.metadata.importedCapabilityTrust).toEqual(
      expect.objectContaining({
        skill: {
          trusted: 0,
          safe: 1,
          quarantined: 1,
        },
        mcp: {
          trusted: 1,
          safe: 0,
          quarantined: 0,
        },
        total: {
          trusted: 1,
          safe: 1,
          quarantined: 1,
        },
        hasQuarantined: true,
        blockedTools: ['imported-skill-draft'],
        toolExposureGatedByImportedCapabilityTrust: true,
      }),
    );
    expect((snapshot.activeRun?.metadata.importedCapabilityTrust as any).riskReports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'imported-skill-draft',
          trustState: 'quarantined',
        }),
        expect.objectContaining({
          id: 'zavorth-core',
          trustState: 'trusted',
        }),
      ]),
    );
  });

  it('suppresses executor artifacts when the response decision says artifacts are not allowed', async () => {
    const executor: UniversalAgentExecutor = ({ run }) => ({
      status: 'completed',
      summary: 'Resposta simples processada.',
      replyText: 'Oi! Estou aqui.',
      artifacts: [
        {
          id: 'artifact-should-not-exist',
          title: 'Artefato indevido',
          kind: 'report',
          createdAt: run.createdAt,
          sessionId: run.sessionId,
          status: 'ready',
        },
      ],
    });
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T12:05:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-chat-only',
      text: 'responda oi',
      requestedTools: [],
      metadata: {
        artifactPolicy: {
          shouldCreateArtifact: false,
          shouldShowArtifactInChat: false,
          reason: 'conversation-response-does-not-create-artifact',
        },
      },
    });

    expect(result.run.status).toBe('completed');
    expect(result.run.artifacts).toEqual([]);
    expect(result.run.metadata).toEqual(
      expect.objectContaining({
        artifactPolicySuppressed: {
          count: 1,
          reason: 'conversation-response-does-not-create-artifact',
        },
      }),
    );
  });

  it('stops before sensitive tools and opens an approval request', async () => {
    const executor = jest.fn();
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T13:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-risky',
      text: 'rode um comando para corrigir tudo',
      requestedTools: ['shell.exec'],
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.run.status).toBe('waiting_approval');
    expect(result.run.approvals).toEqual([
      expect.objectContaining({
        title: 'Approve capability scope',
        risk: 'danger',
        status: 'pending',
      }),
    ]);
    expect(result.run.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'approval',
          status: 'pending',
        }),
      ]),
    );
    expect(result.replies[0]).toEqual(
      expect.objectContaining({
        text: expect.stringContaining('Capability Negotiation'),
        port: expect.objectContaining({
          kind: 'cli',
          label: 'Terminal',
        }),
      }),
    );
    expect(result.replies[0].text).toContain('Approval required: true');
  });

  it('approves a pending universal run and resumes the original executor', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(({ run }) => ({
      status: 'completed',
      summary: 'Comando executado apos aprovacao.',
      replyText: 'Aprovado. Continuei a execucao com seguranca.',
      events: [
        {
          kind: 'tool',
          title: 'shell.exec',
          detail: `Run ${run.id} liberado.`,
          status: 'done',
        },
      ],
    }));
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T13:10:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const pending = await gateway.handle({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-approval',
      text: 'rode npm test',
      requestedTools: ['shell.exec'],
    });

    const approvalId = pending.run.approvals[0].id;
    const approved = await gateway.approve(approvalId);

    expect(executor).toHaveBeenCalledTimes(1);
    expect(approved).toEqual(
      expect.objectContaining({
        ok: true,
        decision: 'approved',
        resumed: true,
      }),
    );
    expect(approved?.run.status).toBe('completed');
    expect(approved?.run.approvals[0].status).toBe('approved');
    expect(approved?.replies[0]).toEqual(
      expect.objectContaining({
        text: 'Aprovado. Continuei a execucao com seguranca.',
      }),
    );
  });

  it('resumes approved Echo Hands through the existing tool runtime without a parallel executor', async () => {
    const toolRuntime = {
      isAvailable: jest.fn(() => true),
      hasTool: jest.fn((toolName: string) => toolName === 'echo_hands'),
      executeTool: jest.fn().mockResolvedValue(
        JSON.stringify({
          ok: true,
          action: 'open_app',
          message: 'App iniciado: notepad.',
          approvalRequired: false,
        }),
      ),
    };
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T13:15:00.000Z'),
      idFactory: createIdFactory(),
      toolRuntime,
    });

    const pending = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-echo-tool-runtime',
      text: 'abra o notepad com Echo',
      requestedTools: ['echo_hands'],
      metadata: {
        echoHandsArgs: {
          action: 'open_app',
          args: { app: 'notepad' },
          risk: 'low',
        },
      },
    });

    const approved = await gateway.approve(pending.run.approvals[0].id);

    expect(toolRuntime.executeTool).toHaveBeenCalledWith(
      'echo_hands',
      expect.objectContaining({
        action: 'open_app',
        args: { app: 'notepad' },
        trusted: true,
        metadata: expect.objectContaining({
          governedBy: 'ToolExposurePolicy',
          sessionId: 'session-echo-tool-runtime',
        }),
      }),
    );
    expect(approved).toEqual(
      expect.objectContaining({
        ok: true,
        decision: 'approved',
        resumed: true,
        queued: false,
      }),
    );
    expect(approved?.run.status).toBe('completed');
    expect(approved?.run.summary).toBe('Echo Hands executed via governed tool runtime.');
    expect(approved?.workflowJob).toEqual(
      expect.objectContaining({
        status: 'completed',
        attempts: 1,
      }),
    );
  });

  it('approves a natural swarm proposal through the existing workflow and swarm service', async () => {
    const executor = jest.fn();
    const launchHierarchy = jest.fn();
    const launchHierarchyAndWait = jest.fn((input: any) => ({
      plan: {
        hierarchyId: input.hierarchyId,
        objective: input.objective,
        complexity: 'medium',
        maxDepth: 2,
        maxLeafRoles: 3,
        rootNodes: [],
        leafRoles: [{ id: 'planner', label: 'Planner', systemPrompt: 'Plan.' }],
        totalNodes: 1,
        traceId: input.hierarchyId,
        runId: input.hierarchyId,
        sessionId: null,
        execution_lifecycle: [],
        subagentReceipts: [{ roleId: 'planner', status: 'planned' }],
      },
      snapshot: {
        swarmId: input.hierarchyId,
        traceId: input.hierarchyId,
        runId: input.hierarchyId,
        sessionId: null,
        status: 'completed',
        objective: input.objective,
        roles: [],
        startedAt: '2026-04-26T13:18:00.000Z',
        finishedAt: '2026-04-26T13:18:01.000Z',
        synthesizedOutput: 'Swarm finalizou a revisao.',
        execution_lifecycle: [],
        subagentReceipts: [{ roleId: 'planner', status: 'completed' }],
      },
    }));
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T13:18:00.000Z'),
      idFactory: createIdFactory(),
      executor,
      swarmHierarchyService: { launchHierarchy, launchHierarchyAndWait } as any,
    });

    const pending = await gateway.handle({
      userId: 'grey',
      channel: 'telegram',
      sessionId: 'session-natural-swarm',
      text: 'monte uma equipe de agentes para revisar esta arquitetura',
      requestedTools: ['swarm.run'],
    });
    const approved = await gateway.approve(pending.run.approvals[0].id);

    expect(executor).not.toHaveBeenCalled();
    expect(launchHierarchyAndWait).toHaveBeenCalledWith(
      expect.objectContaining({
        hierarchyId: pending.run.id,
        objective: 'monte uma equipe de agentes para revisar esta arquitetura',
        requestedBy: 'grey',
        surface: 'telegram',
      }),
    );
    expect(launchHierarchy).not.toHaveBeenCalled();
    expect(approved).toEqual(
      expect.objectContaining({
        ok: true,
        decision: 'approved',
        resumed: true,
        queued: false,
      }),
    );
    expect(approved?.run.status).toBe('completed');
    expect(approved?.run.metadata.swarmExecutionResult).toEqual(
      expect.objectContaining({
        source: 'DynamicHierarchySwarmService',
        launchServiceCalled: true,
        status: 'completed',
        asyncCompletionReturned: true,
      }),
    );
    expect(approved?.replies[0].text).toContain('Swarm finalizou a revisao.');
    expect(approved?.workflowJob).toEqual(
      expect.objectContaining({
        status: 'completed',
        attempts: 1,
      }),
    );
  });

  it('rejects a pending universal approval without calling the executor', async () => {
    const executor = jest.fn();
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T13:20:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const pending = await gateway.handle({
      userId: 'grey',
      channel: 'telegram',
      sessionId: 'session-reject',
      text: 'edite o arquivo principal',
      requestedTools: ['write_file'],
    });

    const rejected = await gateway.reject(pending.run.id);

    expect(executor).not.toHaveBeenCalled();
    expect(rejected).toEqual(
      expect.objectContaining({
        ok: true,
        decision: 'rejected',
        resumed: false,
      }),
    );
    expect(rejected?.run.status).toBe('cancelled');
    expect(rejected?.run.approvals[0].status).toBe('rejected');
    expect(rejected?.run.metadata.lifecycleDefense).toEqual(
      expect.objectContaining({
        cancelled: expect.objectContaining({
          source: 'AgentRunRiskHooks',
          stage: 'cancelled',
          risk: 'danger',
          blocked: false,
          approvalRequiredToolIds: ['write_file'],
        }),
      }),
    );
    expect(rejected?.run.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'status',
          title: 'Defense hook cancelled',
          status: 'done',
          metadata: expect.objectContaining({
            source: 'AgentRunAuditHooks',
          }),
        }),
      ]),
    );
  });

  it('persists run history through the configured store', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-runs-'));
    const filePath = path.join(dir, 'runs.json');
    const runStore = new JsonAgentRunStore({ filePath });
    const firstGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T13:30:00.000Z'),
      idFactory: createIdFactory(),
      runStore,
      executor: () => ({
        status: 'completed',
        summary: 'Run persistido.',
        replyText: 'Run persistido.',
      }),
    });

    const result = await firstGateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-persisted',
      text: 'registre esta run',
      requestedTools: [],
    });
    const secondGateway = new ZavorthAgentGateway({
      runStore: new JsonAgentRunStore({ filePath }),
    });

    expect(secondGateway.getRun(result.run.id)).toEqual(
      expect.objectContaining({
        id: result.run.id,
        sessionId: 'session-persisted',
        summary: 'Run persistido.',
      }),
    );

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('hydrates legacy persisted runs with a derived trace id', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-legacy-runs-'));
    const filePath = path.join(dir, 'runs.json');
    fs.writeFileSync(
      filePath,
      `${JSON.stringify(
        {
          version: 'zavorth-universal-agent-runs/1',
          savedAt: '2026-04-26T13:35:00.000Z',
          runs: [
            {
              id: 'run-legacy',
              requestId: 'request-legacy',
              sessionId: 'session-legacy',
              userId: 'grey',
              channel: 'web',
              title: 'Run legado',
              input: 'pedido antigo',
              workspace: null,
              status: 'completed',
              createdAt: '2026-04-26T13:35:00.000Z',
              updatedAt: '2026-04-26T13:35:00.000Z',
              summary: 'Run salvo antes de traceId ser canonico.',
              events: [],
              toolExposure: {
                mode: 'unknown',
                summary: 'Sem ferramentas registradas.',
                tools: [],
              },
              replyPorts: [],
              modelProfile: {
                providerLabel: 'Zavorth',
                modelLabel: 'modelo legado',
                routingPolicy: 'unknown',
              },
              approvals: [],
              artifacts: [],
              memorySignals: [],
              metadata: {},
            },
          ],
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const gateway = new ZavorthAgentGateway({
      runStore: new JsonAgentRunStore({ filePath }),
    });

    expect(gateway.getRun('run-legacy')).toEqual(
      expect.objectContaining({
        traceId: 'web:session-legacy:request-legacy',
        metadata: expect.objectContaining({
          traceId: 'web:session-legacy:request-legacy',
        }),
      }),
    );

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('resumes an approved workflow after restart when a new executor is available', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-workflow-resume-'));
    const runStorePath = path.join(dir, 'runs.json');
    const queueStorePath = path.join(dir, 'workflow-jobs.json');
    const firstGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T13:40:00.000Z'),
      idFactory: createIdFactory(),
      runStore: new JsonAgentRunStore({ filePath: runStorePath }),
      workflowQueueStore: new JsonAgentWorkflowQueueStore({ filePath: queueStorePath }),
      executor: jest.fn(),
    });

    const pending = await firstGateway.handle({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-durable-approval',
      text: 'rode npm test depois da aprovacao',
      requestedTools: ['shell.exec'],
      metadata: {
        originalInput: 'rode npm test depois da aprovacao',
      },
    });
    const approvalId = pending.run.approvals[0].id;
    const resumedExecutor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(
      ({ request, run }) => ({
        status: 'completed',
        summary: `Workflow duravel retomado para ${request.text}.`,
        replyText: 'Retomei a execucao depois do restart.',
        events: [
          {
            kind: 'tool',
            title: 'durable-resume',
            detail: run.id,
            status: 'done',
          },
        ],
      }),
    );
    const secondGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T13:45:00.000Z'),
      idFactory: createIdFactory(),
      runStore: new JsonAgentRunStore({ filePath: runStorePath }),
      workflowQueueStore: new JsonAgentWorkflowQueueStore({ filePath: queueStorePath }),
      executor: resumedExecutor,
    });

    const approved = await secondGateway.approve(approvalId);

    expect(resumedExecutor).toHaveBeenCalledTimes(1);
    expect(approved).toEqual(
      expect.objectContaining({
        ok: true,
        decision: 'approved',
        resumed: true,
        queued: false,
      }),
    );
    expect(approved?.run.status).toBe('completed');
    expect(approved?.workflowJob).toEqual(
      expect.objectContaining({
        runId: pending.run.id,
        approvalId,
        status: 'completed',
        attempts: 1,
      }),
    );
    expect(approved?.replies[0]).toEqual(
      expect.objectContaining({
        text: 'Retomei a execucao depois do restart.',
      }),
    );

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('keeps approved workflow queued after restart until a worker processes it', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-workflow-queued-'));
    const runStorePath = path.join(dir, 'runs.json');
    const queueStorePath = path.join(dir, 'workflow-jobs.json');
    const firstGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T13:50:00.000Z'),
      idFactory: createIdFactory(),
      runStore: new JsonAgentRunStore({ filePath: runStorePath }),
      workflowQueueStore: new JsonAgentWorkflowQueueStore({ filePath: queueStorePath }),
    });

    const pending = await firstGateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-durable-queue',
      text: 'edite um arquivo depois',
      requestedTools: ['write_file'],
    });
    const approvalId = pending.run.approvals[0].id;
    const secondGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T13:55:00.000Z'),
      idFactory: createIdFactory(),
      runStore: new JsonAgentRunStore({ filePath: runStorePath }),
      workflowQueueStore: new JsonAgentWorkflowQueueStore({ filePath: queueStorePath }),
    });

    const approved = await secondGateway.approve(approvalId);

    expect(approved).toEqual(
      expect.objectContaining({
        ok: true,
        decision: 'approved',
        resumed: false,
        queued: true,
      }),
    );
    expect(approved?.run.status).toBe('queued');
    expect(approved?.workflowJob).toEqual(
      expect.objectContaining({
        status: 'queued',
        attempts: 0,
      }),
    );

    const workerExecutor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Worker processou a fila duravel.',
      replyText: 'Fila duravel processada.',
    }));
    const workerGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T14:00:00.000Z'),
      idFactory: createIdFactory(),
      runStore: new JsonAgentRunStore({ filePath: runStorePath }),
      workflowQueueStore: new JsonAgentWorkflowQueueStore({ filePath: queueStorePath }),
      executor: workerExecutor,
    });

    const processed = await workerGateway.processQueuedWorkflows();

    expect(workerExecutor).toHaveBeenCalledTimes(1);
    expect(processed).toHaveLength(1);
    expect(processed[0].run.status).toBe('completed');
    expect(workerGateway.listWorkflowJobs()[0]).toEqual(
      expect.objectContaining({
        status: 'completed',
        attempts: 1,
      }),
    );

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('leases queued workflows so another local worker cannot process the same job concurrently', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-workflow-lease-'));
    const runStorePath = path.join(dir, 'runs.json');
    const queueStorePath = path.join(dir, 'workflow-jobs.json');
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T14:10:00.000Z'),
      idFactory: createIdFactory(),
      runStore: new JsonAgentRunStore({ filePath: runStorePath }),
      workflowQueueStore: new JsonAgentWorkflowQueueStore({ filePath: queueStorePath }),
    });
    const pending = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-lease',
      text: 'edite com lease',
      requestedTools: ['write_file'],
    });
    await gateway.approve(pending.run.approvals[0].id);

    let releaseExecutor!: () => void;
    let startedExecutor!: () => void;
    const started = new Promise<void>((resolve) => {
      startedExecutor = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseExecutor = resolve;
    });
    const workerAExecutor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(
      async () => {
        startedExecutor();
        await release;
        return {
          status: 'completed',
          summary: 'Worker A concluiu.',
          replyText: 'Worker A concluiu.',
        };
      },
    );
    const workerBExecutor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Worker B nao deveria executar.',
      replyText: 'Worker B nao deveria executar.',
    }));
    const workerA = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T14:10:01.000Z'),
      idFactory: createIdFactory(),
      runStore: new JsonAgentRunStore({ filePath: runStorePath }),
      workflowQueueStore: new JsonAgentWorkflowQueueStore({ filePath: queueStorePath }),
      workflowWorkerId: 'worker-a',
      workflowLeaseMs: 60_000,
      executor: workerAExecutor,
    });
    const workerB = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T14:10:02.000Z'),
      idFactory: createIdFactory(),
      runStore: new JsonAgentRunStore({ filePath: runStorePath }),
      workflowQueueStore: new JsonAgentWorkflowQueueStore({ filePath: queueStorePath }),
      workflowWorkerId: 'worker-b',
      workflowLeaseMs: 60_000,
      executor: workerBExecutor,
    });

    const processingA = workerA.processQueuedWorkflows();
    await started;
    const processingB = await workerB.processQueuedWorkflows();
    releaseExecutor();
    const processedA = await processingA;

    expect(workerAExecutor).toHaveBeenCalledTimes(1);
    expect(workerBExecutor).not.toHaveBeenCalled();
    expect(processingB).toHaveLength(0);
    expect(processedA).toHaveLength(1);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('backs off failed workflow jobs and retries when the next run time arrives', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-workflow-backoff-'));
    const runStorePath = path.join(dir, 'runs.json');
    const queueStorePath = path.join(dir, 'workflow-jobs.json');
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T14:20:00.000Z'),
      idFactory: createIdFactory(),
      runStore: new JsonAgentRunStore({ filePath: runStorePath }),
      workflowQueueStore: new JsonAgentWorkflowQueueStore({ filePath: queueStorePath }),
      workflowMaxAttempts: 2,
      workflowBackoffMs: 1000,
    });
    const pending = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-backoff',
      text: 'rode com retry',
      requestedTools: ['shell.exec'],
    });
    await gateway.approve(pending.run.approvals[0].id);

    const failingWorker = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T14:20:01.000Z'),
      idFactory: createIdFactory(),
      runStore: new JsonAgentRunStore({ filePath: runStorePath }),
      workflowQueueStore: new JsonAgentWorkflowQueueStore({ filePath: queueStorePath }),
      workflowWorkerId: 'worker-fail',
      workflowBackoffMs: 1000,
      workflowMaxAttempts: 2,
      executor: jest.fn(() => {
        throw new Error('falha transiente');
      }),
    });

    const failed = await failingWorker.processQueuedWorkflows();
    expect(failed).toHaveLength(1);
    expect(failed[0].run.status).toBe('queued');
    expect(failingWorker.listWorkflowJobs()[0]).toEqual(
      expect.objectContaining({
        status: 'queued',
        attempts: 1,
        backoffMs: 1000,
        lastError: 'falha transiente',
      }),
    );

    const earlyWorker = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T14:20:01.500Z'),
      idFactory: createIdFactory(),
      runStore: new JsonAgentRunStore({ filePath: runStorePath }),
      workflowQueueStore: new JsonAgentWorkflowQueueStore({ filePath: queueStorePath }),
      executor: jest.fn(() => ({
        status: 'completed',
        summary: 'cedo demais',
        replyText: 'cedo demais',
      })),
    });

    expect(await earlyWorker.processQueuedWorkflows()).toHaveLength(0);

    const retryExecutor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Retry concluiu.',
      replyText: 'Retry concluiu.',
    }));
    const retryWorker = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T14:20:03.000Z'),
      idFactory: createIdFactory(),
      runStore: new JsonAgentRunStore({ filePath: runStorePath }),
      workflowQueueStore: new JsonAgentWorkflowQueueStore({ filePath: queueStorePath }),
      workflowWorkerId: 'worker-retry',
      workflowBackoffMs: 1000,
      workflowMaxAttempts: 2,
      executor: retryExecutor,
    });

    const retried = await retryWorker.processQueuedWorkflows();

    expect(retryExecutor).toHaveBeenCalledTimes(1);
    expect(retried).toHaveLength(1);
    expect(retried[0].run.status).toBe('completed');
    expect(retryWorker.listWorkflowJobs()[0]).toEqual(
      expect.objectContaining({
        status: 'completed',
        attempts: 2,
      }),
    );

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('recovers expired workflow leases so another worker can continue', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-workflow-expired-'));
    const runStorePath = path.join(dir, 'runs.json');
    const queueStorePath = path.join(dir, 'workflow-jobs.json');
    const queueStore = new JsonAgentWorkflowQueueStore({ filePath: queueStorePath });
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T14:30:00.000Z'),
      idFactory: createIdFactory(),
      runStore: new JsonAgentRunStore({ filePath: runStorePath }),
      workflowQueueStore: queueStore,
    });
    const pending = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-expired-lease',
      text: 'retome lease expirado',
      requestedTools: ['write_file'],
    });
    await gateway.approve(pending.run.approvals[0].id);
    const [claimedByOldWorker] = queueStore.claimQueuedJobs({
      workerId: 'old-worker',
      now: '2026-04-26T14:30:01.000Z',
      leaseMs: 1000,
      limit: 1,
    });

    expect(claimedByOldWorker).toEqual(
      expect.objectContaining({
        status: 'running',
        leaseOwner: 'old-worker',
      }),
    );

    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Lease expirado recuperado.',
      replyText: 'Lease expirado recuperado.',
    }));
    const recoveryWorker = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T14:30:03.000Z'),
      idFactory: createIdFactory(),
      runStore: new JsonAgentRunStore({ filePath: runStorePath }),
      workflowQueueStore: new JsonAgentWorkflowQueueStore({ filePath: queueStorePath }),
      workflowWorkerId: 'recovery-worker',
      workflowLeaseMs: 1000,
      executor,
    });

    const recovered = await recoveryWorker.processQueuedWorkflows();

    expect(executor).toHaveBeenCalledTimes(1);
    expect(recovered).toHaveLength(1);
    expect(recovered[0].run.status).toBe('completed');
    expect(recoveryWorker.listWorkflowJobs()[0]).toEqual(
      expect.objectContaining({
        status: 'completed',
        attempts: 2,
      }),
    );

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
