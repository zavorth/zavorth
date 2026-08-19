import {
  AgentRunService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';
import type { WatchModeRunSnapshot } from '../../../src/services/ComputerUseWatchModeService.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-${++index}`;
}

function createWatchModeRunSnapshot(
  overrides: Partial<WatchModeRunSnapshot> = {},
): WatchModeRunSnapshot {
  const now = '2026-04-27T12:40:00.000Z';
  return {
    runId: 'watch-run-1',
    status: 'waiting_approval',
    requestedBy: 'operator',
    targetWindow: 'Chrome',
    objective: 'Observar o dashboard',
    siteUrl: null,
    strictApproval: true,
    budget: {
      maxIterations: 6,
      maxDurationMs: 120_000,
      maxScreenshots: 6,
      maxMemoryMb: 256,
      idleTtlMs: 30_000,
      delayBetweenActionsMs: 1200,
      screenshotTtlMs: 300_000,
      maxScreenshotBytes: 2_000_000,
      screenshotRedactionMode: 'metadata-only',
      sensitiveScreenPolicy: 'pause',
    },
    allowlist: {
      appConfigured: true,
      appMatched: true,
      siteConfigured: false,
      siteMatched: false,
      mode: 'allowlisted',
    },
    startedAt: now,
    finishedAt: null,
    updatedAt: now,
    latestScreenshotPath: null,
    pendingApprovalId: 'watch-approval-1',
    pendingApprovalCount: 1,
    nextOperatorStep: 'Aguardando approval visual.',
    lastError: null,
    buffers: {
      timelineEntries: 1,
      timelineLimit: 40,
      artifactEntries: 0,
      artifactLimit: 8,
      screenshotThrottleMs: 1200,
      throttledScreenshots: 0,
      droppedTimelineEntries: 0,
      persistedArtifacts: 0,
      approvalDecisions: 0,
      averageApprovalLatencyMs: 0,
      expiredArtifacts: 0,
      deletedScreenshotBytes: 0,
      activeVisualHandles: 1,
    },
    agent: null,
    approvals: [],
    timeline: [],
    artifacts: [],
    ...overrides,
  };
}

describe('AgentRunService Watch Mode escalation', () => {
  it('blocks natural visual control when policy allowlist metadata is absent', async () => {
    const executor = jest.fn();
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T12:30:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'operator',
      channel: 'telegram',
      sessionId: 'telegram:watch',
      text: 'ative o Watch Mode para observar a tela',
      requestedTools: ['watchmode.control'],
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.run.status).toBe('failed');
    expect(result.run.summary).toBe('Watch Mode visual bloqueado: policy/allowlist explicita ausente.');
    expect(result.run.approvals).toEqual([]);
    expect(result.run.toolExposure).toEqual(expect.objectContaining({
      mode: 'restricted',
      tools: expect.arrayContaining([
        expect.objectContaining({
          id: 'watchmode.control',
          group: 'local_control',
          risk: 'danger',
          requiresApproval: true,
          policyTags: expect.arrayContaining(['policy-allowlist-required', 'visual-action']),
        }),
      ]),
    }));
    expect(result.run.metadata.watchModeVisualProposal).toEqual(expect.objectContaining({
      target: 'watch-mode',
      capabilityId: 'computer_use.visual_action',
      policyAllowlisted: false,
      blocked: true,
      blockedReason: 'policy-allowlist-required',
      directExecution: false,
      startRunCalled: false,
      computerUseAgentCalled: false,
    }));
    expect(result.replies[0].text).toContain('No visual action was executed.');
  });

  it('turns allowlisted natural visual control into an approval proposal without starting Watch Mode', async () => {
    const executor = jest.fn();
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T12:35:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'operator',
      channel: 'web',
      sessionId: 'web:watch',
      text: 'abra o navegador e observe o dashboard',
      requestedTools: ['watchmode.control'],
      metadata: {
        watchMode: {
          policyAllowlisted: true,
          targetWindow: 'Chrome',
          objective: 'Observar o dashboard',
        },
      },
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.run.status).toBe('waiting_approval');
    expect(result.run.summary).toBe('Proposta de Watch Mode visual aguardando aprovacao.');
    expect(result.run.approvals).toEqual([
      expect.objectContaining({
        title: 'Aprovar Watch Mode visual supervisionado',
        risk: 'danger',
        status: 'pending',
      }),
    ]);
    expect(result.run.metadata.watchModeVisualProposal).toEqual(expect.objectContaining({
      target: 'watch-mode',
      capabilityId: 'computer_use.visual_action',
      objective: 'Observar o dashboard',
      targetWindow: 'Chrome',
      policyAllowlisted: true,
      strictApprovalRequired: true,
      directExecution: false,
      startRunCalled: false,
      computerUseAgentCalled: false,
      approvalCreated: true,
    }));
    expect(result.replies[0].text).toContain('Proposta de Watch Mode visual preparada.');
    expect(result.replies[0].text).toContain('Computer Use nao foi iniciado');
  });

  it('routes discovered watchmode intent before generic capability negotiation', async () => {
    const executor = jest.fn();
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T12:37:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'operator',
      channel: 'web',
      sessionId: 'web:watch-natural',
      text: 'use Watch Mode no Chrome para observar o dashboard',
      requestedTools: [],
      metadata: {
        watchModePolicyAllowlisted: true,
        watchMode: {
          targetWindow: 'Chrome',
          objective: 'Observar o dashboard',
        },
      },
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.run.status).toBe('waiting_approval');
    expect(result.run.metadata.naturalCapabilityDiscovery).toEqual(expect.objectContaining({
      recommendedToolNames: expect.arrayContaining(['watchmode.control']),
    }));
    expect(result.run.metadata.capabilityNegotiation).toBeUndefined();
    expect(result.run.metadata.watchModeVisualProposal).toEqual(expect.objectContaining({
      target: 'watch-mode',
      targetWindow: 'Chrome',
      approvalCreated: true,
      startRunCalled: false,
    }));
    expect(result.replies[0].text).toContain('Proposta de Watch Mode visual preparada.');
  });

  it('starts the existing Watch Mode service after approval for allowlisted proposals', async () => {
    const startRun = jest.fn().mockResolvedValue(createWatchModeRunSnapshot());
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T12:40:00.000Z'),
      idFactory: createIdFactory(),
      watchModeService: {
        startRun,
      },
    });

    const pending = await gateway.handle({
      userId: 'operator',
      channel: 'web',
      sessionId: 'web:watch-approval',
      text: 'use Watch Mode no Chrome para observar o dashboard',
      requestedTools: ['watchmode.control'],
      metadata: {
        watchModePolicyAllowlisted: true,
        watchMode: {
          targetWindow: 'Chrome',
          objective: 'Observar o dashboard',
        },
      },
    });
    const approved = await gateway.approve(pending.run.approvals[0].id);

    expect(startRun).toHaveBeenCalledWith(expect.objectContaining({
      targetWindow: 'Chrome',
      objective: 'Observar o dashboard',
      siteUrl: null,
      requestedBy: 'operator',
      strictApproval: true,
    }));
    expect(approved?.run.status).toBe('completed');
    expect(approved?.run.summary).toContain('Watch Mode aprovado e iniciado pelo servico existente');
    expect(approved?.run.metadata.watchModeVisualProposal).toEqual(expect.objectContaining({
      target: 'watch-mode',
      targetWindow: 'Chrome',
      approvalOnly: false,
      directExecution: false,
      startRunCalled: true,
      computerUseAgentCalled: true,
      watchModeServiceCalled: true,
      watchModeRun: expect.objectContaining({
        source: 'ComputerUseWatchModeService',
        runId: 'watch-run-1',
        status: 'waiting_approval',
      }),
    }));
    expect(approved?.replies[0].text).toContain('Run Watch Mode: watch-run-1');
    expect(approved?.replies[0].text).toContain('Aguardando approval visual.');
  });
});
