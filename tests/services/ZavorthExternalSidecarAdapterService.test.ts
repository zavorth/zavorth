import {
  ZAVORTH_EXTERNAL_SIDECAR_ADAPTER_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthExternalSidecarAdapterContract.js';
import { ZavorthExternalSidecarAdapterService } from '../../src/services/ZavorthExternalSidecarAdapterService.js';

describe('ZavorthExternalSidecarAdapterService Approval gate', () => {
  it('publishes the sidecar adapter snapshot after Preview engine readiness', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot).toEqual(expect.objectContaining({
      generatedAt: '2026-05-11T20:45:00.000Z',
      contractVersion: ZAVORTH_EXTERNAL_SIDECAR_ADAPTER_CONTRACT_VERSION,
      status: 'sidecar-adapter-ready',
      planId: 'Zavorth External Runtime Integration',
      stage: 'sidecar-adapter',
      previousNativeEngineStatus: 'native-engine-ready',
    }));
    expect(snapshot.summary).toEqual(expect.objectContaining({
      sourceChannelsListed: 2,
      sourceSkillsListed: 2,
      sourceToolsListed: 2,
      sourceSessionsListed: 2,
      workerHealthRecordsListed: 2,
      inboundEventsRoutedToGateway: 1,
      outboundDryRunsEvaluated: 2,
      riskyOutboundActionsBlocked: 1,
      sidecarsStarted: false,
      liveIoPerformed: false,
    }));
    expect(snapshot.commands.nextStage).toBe('291 Connector registry - Capability Providers');
  });

  it('lists external surfaces through a read-only probe without starting sidecars', () => {
    const probe = createService().buildReadOnlyProbe('live-readonly');

    expect(probe).toEqual(expect.objectContaining({
      mode: 'live-readonly',
      status: 'probe-ready',
      summary: expect.objectContaining({
        sourceRuntimes: 2,
        channels: 2,
        skills: 2,
        tools: 2,
        sessions: 2,
        workers: 2,
      }),
      safety: expect.objectContaining({
        readOnly: true,
        liveReadOnlyRequiresExplicitMode: true,
        noSourceRuntimeCodeExecuted: true,
        noSidecarStarted: true,
        noOutboundIo: true,
      }),
    }));
    expect(probe.sourceRefs.every((entry) => entry.diagnosticsOnly && entry.publicName === 'Zavorth')).toBe(true);
    expect(probe.tools.every((entry) => entry.exposedDirectly === false)).toBe(true);
    expect(probe.workers.every((entry) => entry.directExecutionAllowed === false)).toBe(true);
  });

  it('normalizes inbound source events into ZavorthAgentGateway packets', () => {
    const receipt = createService().normalizeInboundEvent({
      sourceRuntimeId: 'source-runtime-test',
      sourceEventId: 'evt-test-001',
      channelId: 'telegram-test',
      sessionId: 'session-test-001',
      text: 'analise esse repo',
      authorRef: 'operator-test',
      attachments: [{ id: 'att-1', kind: 'text', safeRef: 'attachment://att-1' }],
    });

    expect(receipt).toEqual(expect.objectContaining({
      status: 'routed-to-gateway',
      sourceEventId: 'evt-test-001',
      gatewayEntrypoint: 'ZavorthAgentGateway',
      naturalFirstRoute: 'governed-execution',
      gatewayPacket: expect.objectContaining({
        adapterSource: 'external-sidecar-adapter',
        messageText: 'analise esse repo',
        sourceRuntimeId: 'source-runtime-test',
        channelId: 'telegram-test',
        sessionId: 'session-test-001',
        authorRef: 'operator-test',
      }),
      safety: expect.objectContaining({
        directReplyBlocked: true,
        replyPipelineRequired: true,
        sourceRuntimeCodeExecuted: false,
        toolExecutionPerformed: false,
      }),
    }));
  });

  it('evaluates outbound actions in dry-run and blocks risky actions without approval', () => {
    const service = createService();
    const safe = service.evaluateOutboundDryRun({
      actionId: 'safe-001',
      kind: 'message-send',
      targetRef: 'telegram-test',
      textPreview: 'Safe reply preview',
      risk: 'low',
    });
    const risky = service.evaluateOutboundDryRun({
      actionId: 'risky-001',
      kind: 'worker-launch',
      targetRef: 'external-worker',
      textPreview: 'Launch worker',
      risk: 'high',
      approvalGranted: false,
    });

    expect(safe).toEqual(expect.objectContaining({
      policyDecision: 'dry-run-allowed',
      approvalRequired: false,
      approvalGranted: false,
      safety: expect.objectContaining({
        dryRunOnly: true,
        liveIoPerformed: false,
        replyPipelineRequired: true,
        noToolExecution: true,
        noWorkerLaunch: true,
      }),
    }));
    expect(risky).toEqual(expect.objectContaining({
      policyDecision: 'blocked',
      approvalRequired: true,
      approvalGranted: false,
      reason: expect.stringContaining('blocked'),
      safety: expect.objectContaining({
        dryRunOnly: true,
        liveIoPerformed: false,
        noApprovalBypass: true,
      }),
    }));
  });

  it('projects adapter state for Dashboard as Zavorth concepts', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot.dashboardProjection).toEqual(expect.objectContaining({
      title: 'External Sidecar Adapter',
      status: 'sidecar-adapter-ready',
      tone: 'ready',
      policyPills: expect.arrayContaining([
        'read-only probe',
        'ZavorthAgentGateway inbound',
        'ReplyPipeline outbound',
        'approval-gated risk',
        'no sidecar execution',
      ]),
      nextSafeAction: 'Proceed to 291 Connector registry - Capability Providers.',
    }));
    expect(snapshot.dashboardProjection.cards.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'health',
      'channels',
      'capabilities',
      'sessions',
      'workers',
      'inbound',
      'outbound',
      'risky',
    ]));
  });

  it('blocks Approval gate if Preview engine native engine is not ready', () => {
    const snapshot = createService().buildSnapshot({ nativeEngineStatus: 'blocked' });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.previousNativeEngineStatus).toBe('blocked');
    expect(snapshot.acceptanceMatrix.find((entry) => entry.requirementId === 'native-engine-ready')).toEqual(expect.objectContaining({
      status: 'failed',
    }));
  });

  it('formats an operator summary for the sidecar adapter pack', () => {
    const service = createService();
    const text = service.formatSnapshotText(service.buildSnapshot());

    expect(text).toContain('Zavorth External Sidecar Adapter - Approval gate');
    expect(text).toContain('Status: sidecar-adapter-ready');
    expect(text).toContain('Inbound routed to gateway: 1');
    expect(text).toContain('Risky outbound blocked: 1');
    expect(text).toContain('Sidecars started: false');
    expect(text).toContain('Next: 291 Connector registry - Capability Providers');
  });
});

function createService(): ZavorthExternalSidecarAdapterService {
  return new ZavorthExternalSidecarAdapterService({
    now: () => new Date('2026-05-11T20:45:00.000Z'),
    nativeEngineStatus: 'native-engine-ready',
  });
}
