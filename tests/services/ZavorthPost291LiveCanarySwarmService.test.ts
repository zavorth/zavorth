import {
  ZAVORTH_POST_291_LIVE_CANARY_SWARM_CONTRACT_VERSION,
  type ZavorthLiveCanaryInput,
} from '../../src/contracts/ZavorthPost291LiveCanarySwarmContract.js';
import { ZavorthPost291LiveCanarySwarmService } from '../../src/services/ZavorthPost291LiveCanarySwarmService.js';

describe('ZavorthPost291LiveCanarySwarmService Phase B', () => {
  it('publishes the post-291 live canary swarm snapshot after Phase A readiness', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot).toEqual(expect.objectContaining({
      generatedAt: '2026-05-11T23:40:00.000Z',
      contractVersion: ZAVORTH_POST_291_LIVE_CANARY_SWARM_CONTRACT_VERSION,
      status: 'live-canary-swarm-ready',
      planId: '302 - Post-291 Zavorth Operationalization Plan',
      phase: 'phase-b-live-canary-swarm',
      previousCertificationSwarmStatus: 'certification-swarm-ready',
    }));
    expect(snapshot.summary).toEqual(expect.objectContaining({
      canariesPrepared: 4,
      providerCanaries: 1,
      channelCanaries: 1,
      toolCanaries: 1,
      workerCanaries: 1,
      activationTickets: 4,
      dryRunPreviewsReady: 4,
      rollbackReceiptsReady: 4,
      ownerApprovalsRequired: 4,
      liveActivationsPerformed: 0,
      providerCallsPerformed: false,
      channelSendsPerformed: false,
      toolExecutionsPerformed: false,
      workerLaunchesPerformed: false,
      secretsSerialized: false,
      automaticPromotionsPerformed: false,
    }));
    expect(snapshot.commands.nextPhase).toBe('302 Phase C - Release Candidate');
  });

  it('prepares canaries as parallel-safe previews without serializing secret values', () => {
    const preparation = createService().prepareCanary(createCanary());

    expect(preparation).toEqual(expect.objectContaining({
      canaryId: 'zavorth.post291.canary.provider-test',
      kind: 'provider',
      sequenceIndex: 1,
      targetRef: 'provider://test',
      targetPublicName: 'Zavorth',
      status: 'prepared',
      parallelPreparationSafe: true,
      sequentialActivationRequired: true,
      dryRunPreviewReady: true,
      approvalRequired: true,
      ownerApprovalId: null,
      requiredSecretRefs: ['secret://provider-token'],
      risk: 'high',
    }));
    expect(preparation.safety).toEqual(expect.objectContaining({
      preparationOnly: true,
      noSecretValueSerialized: true,
      noLiveActivation: true,
      noProviderCall: true,
      noChannelSend: true,
      noToolExecution: true,
      noWorkerLaunch: true,
    }));
  });

  it('builds manual activation tickets that require approval and perform no live effects', () => {
    const service = createService();
    const preparation = service.prepareCanary(createCanary());
    const ticket = service.buildActivationTicket(preparation);

    expect(ticket).toEqual(expect.objectContaining({
      canaryId: preparation.canaryId,
      kind: 'provider',
      sequenceIndex: 1,
      status: 'approval-required',
      activationMode: 'manual-approval-required',
      ownerApprovalId: null,
      approvalGranted: false,
      liveActivationPerformed: false,
      sequenceBlockedUntilPreviousPasses: false,
      rollbackRequiredBeforeNext: true,
    }));
    expect(ticket.safety).toEqual(expect.objectContaining({
      ticketOnly: true,
      noAutomaticActivation: true,
      noApprovalBypass: true,
      noLiveSideEffect: true,
    }));
  });

  it('keeps approved tickets manual and side-effect free', () => {
    const service = createService();
    const preparation = service.prepareCanary({
      ...createCanary(),
      ownerApprovalId: 'approval-123',
    });
    const ticket = service.buildActivationTicket(preparation);

    expect(ticket).toEqual(expect.objectContaining({
      status: 'ready-for-manual-live-activation',
      ownerApprovalId: 'approval-123',
      approvalGranted: true,
      liveActivationPerformed: false,
      activationMode: 'manual-approval-required',
    }));
  });

  it('prepares rollback receipts before activation', () => {
    const service = createService();
    const preparation = service.prepareCanary(createCanary());
    const rollback = service.buildRollbackReceipt(preparation);

    expect(rollback).toEqual(expect.objectContaining({
      canaryId: preparation.canaryId,
      kind: 'provider',
      rollbackToken: 'zavorth.rollback.zavorth-post291-canary-provider-test',
      status: 'rollback-ready',
      automaticRollback: false,
      liveRollbackPerformed: false,
    }));
    expect(rollback.safety).toEqual(expect.objectContaining({
      rollbackPreparedOnly: true,
      noRollbackExecuted: true,
      operatorConfirmationRequired: true,
    }));
  });

  it('builds provider channel tool worker sequence in the required order', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot.sequence).toEqual(expect.objectContaining({
      sequenceId: 'zavorth.post291.live-canary.sequence',
      status: 'sequence-ready',
      order: ['provider', 'channel', 'tool-execution', 'worker-activation'],
      parallelPreparationAllowed: true,
      sequentialActivationRequired: true,
      nextCanaryKind: 'provider',
    }));
    expect(snapshot.sequence.safety).toEqual(expect.objectContaining({
      providerBeforeChannel: true,
      channelBeforeTool: true,
      toolBeforeWorker: true,
      noAutomaticPromotion: true,
    }));
  });

  it('projects live canary state for Command Center', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot.commandCenterProjection).toEqual(expect.objectContaining({
      title: 'Post-291 Live Canary Swarm',
      status: 'live-canary-swarm-ready',
      tone: 'ready',
      policyPills: expect.arrayContaining([
        'parallel preparation',
        'sequential activation',
        'owner approval required',
        'dry-run preview',
        'rollback before next',
        'no automatic promotion',
      ]),
      nextSafeAction: 'Collect explicit owner approvals and execute canaries manually before 302 Phase C - Release Candidate.',
    }));
    expect(snapshot.commandCenterProjection.cards.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'canaries',
      'sequence',
      'approvals',
      'dry-run',
      'rollback',
      'live',
      'next',
    ]));
  });

  it('blocks Phase B if Phase A certification swarm is not ready', () => {
    const snapshot = createService().buildSnapshot({ certificationSwarmStatus: 'blocked' });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.previousCertificationSwarmStatus).toBe('blocked');
    expect(snapshot.acceptanceMatrix.find((entry) => entry.requirementId === 'phase-a-certification-swarm-ready')).toEqual(expect.objectContaining({
      status: 'failed',
    }));
  });

  it('formats an operator summary for live canary swarm status', () => {
    const service = createService();
    const text = service.formatSnapshotText(service.buildSnapshot());

    expect(text).toContain('Zavorth Post-291 Live Canary Swarm - Phase B');
    expect(text).toContain('Status: live-canary-swarm-ready');
    expect(text).toContain('Canaries prepared: 4');
    expect(text).toContain('Live activations performed: 0');
    expect(text).toContain('Provider calls performed: false');
    expect(text).toContain('Next: 302 Phase C - Release Candidate');
  });
});

function createService(): ZavorthPost291LiveCanarySwarmService {
  return new ZavorthPost291LiveCanarySwarmService({
    now: () => new Date('2026-05-11T23:40:00.000Z'),
    certificationSwarmStatus: 'certification-swarm-ready',
  });
}

function createCanary(): ZavorthLiveCanaryInput {
  return {
    canaryId: 'provider-test',
    kind: 'provider',
    sequenceIndex: 1,
    targetRef: 'provider://test',
    dryRunCommand: 'npm run provider:test',
    liveCommand: 'npm run provider:live',
    rollbackCommand: 'npm run provider:rollback',
    requiredSecretRefs: ['provider-token'],
    risk: 'high',
  };
}
