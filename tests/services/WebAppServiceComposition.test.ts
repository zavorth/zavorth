import { createWebAppServiceComposition } from '../../src/domain/surface/presentation/web-app/WebAppServiceComposition.js';
import {
  createWebAppOperationsState,
  createWebAppRuntimeServiceState,
} from '../../src/domain/surface/presentation/web-app/WebAppServiceState.js';
import { DashboardAuthService } from '../../src/services/DashboardAuthService.js';

import type { WatchModeRunSnapshot } from '../../src/services/ComputerUseWatchModeService.js';

function createComposition() {
  return createWebAppServiceComposition({
    auth: new DashboardAuthService(),
    operations: createWebAppOperationsState(),
    runtimeServices: createWebAppRuntimeServiceState(),
    getRuntime: () => null,
    getRealtime: () => null,
    getConversationService: () => {
      throw new Error('Conversation service should not be needed for this composition test.');
    },
    getSharedSurfaceFactorySource: () => {
      throw new Error('Shared surface source should not be needed for this composition test.');
    },
    isComputerUseEnabled: () => false,
  });
}

function createWatchModeRunSnapshot(
  overrides: Partial<WatchModeRunSnapshot> = {},
): WatchModeRunSnapshot {
  const now = '2026-04-27T12:45:00.000Z';
  return {
    runId: 'web-watch-run-1',
    status: 'waiting_approval',
    requestedBy: 'operator',
    targetWindow: 'Chrome',
    objective: 'Observar o dashboard web',
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
    pendingApprovalId: 'web-watch-approval-1',
    pendingApprovalCount: 1,
    nextOperatorStep: 'Waiting for approval visual.',
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

describe('WebAppServiceComposition', () => {
  it('injects the existing selfmod command service into the web agent gateway', async () => {
    const composition = createComposition();
    const createGoalPreview = jest
      .spyOn(composition.selfModificationCommandService, 'createGoalPreview')
      .mockResolvedValue({
        success: true,
        mode: 'goal',
        previewId: 'web-selfmod-preview-1',
        traceId: 'trace-web-selfmod',
        runId: 'run-web-selfmod',
        sessionId: 'web:session',
        artifactId: 'web-selfmod-preview-1',
        summary: 'Preview web preparado.',
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

    const result = await composition.agentGateway.handle({
      userId: 'operator',
      channel: 'web',
      sessionId: 'web:session',
      text: 'proponthere is uma auto melhoria segura para o command center',
      requestedTools: ['selfmod.preview'],
    });

    expect(createGoalPreview).toHaveBeenCalledWith(
      'proponthere is uma auto melhoria segura para o command center',
      'operator',
    );
    expect(result.run.status).toBe('completed');
    expect(result.run.summary).toBe('Preview web preparado.');
    expect(result.run.metadata).toEqual(expect.objectContaining({
      selfModificationPreview: expect.objectContaining({
        source: 'SelfModificationCommandService',
        operation: 'preview',
        previewId: 'web-selfmod-preview-1',
        previewFirst: true,
        applyServiceCalled: false,
        rollbackServiceCalled: false,
      }),
    }));
    expect(result.replies[0].text).toContain('Preview: web-selfmod-preview-1');
    expect(result.replies[0].text).toContain('Apply was not executado.');
  });

  it('injects the existing Watch Mode service into the web agent gateway', async () => {
    const composition = createComposition();
    const startRun = jest
      .spyOn(composition.computerUseWatchMode, 'startRun')
      .mockResolvedValue(createWatchModeRunSnapshot());

    const pending = await composition.agentGateway.handle({
      userId: 'operator',
      channel: 'web',
      sessionId: 'web:watch-session',
      text: 'use Watch Mode no Chrome para observar o dashboard web',
      requestedTools: ['watchmode.control'],
      metadata: {
        watchModePolicyAllowlisted: true,
        watchMode: {
          targetWindow: 'Chrome',
          objective: 'Observar o dashboard web',
        },
      },
    });
    const approved = await composition.agentGateway.approve(pending.run.approvals[0].id);

    expect(startRun).toHaveBeenCalledWith(expect.objectContaining({
      targetWindow: 'Chrome',
      objective: 'Observar o dashboard web',
      siteUrl: null,
      requestedBy: 'operator',
      strictApproval: true,
    }));
    expect(approved?.run.status).toBe('completed');
    expect(approved?.run.metadata.watchModeVisualProposal).toEqual(expect.objectContaining({
      target: 'watch-mode',
      targetWindow: 'Chrome',
      approvalOnly: false,
      startRunCalled: true,
      computerUseAgentCalled: true,
      watchModeServiceCalled: true,
      watchModeRun: expect.objectContaining({
        source: 'ComputerUseWatchModeService',
        runId: 'web-watch-run-1',
        status: 'waiting_approval',
      }),
    }));
    expect(approved?.replies[0].text).toContain('Run Watch Mode: web-watch-run-1');
  });
});
