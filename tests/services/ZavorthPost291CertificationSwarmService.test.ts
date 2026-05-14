import {
  ZAVORTH_POST_291_CERTIFICATION_SWARM_CONTRACT_VERSION,
  type ZavorthCertificationLaneInput,
} from '../../src/contracts/ZavorthPost291CertificationSwarmContract.js';
import { ZavorthPost291CertificationSwarmService } from '../../src/services/ZavorthPost291CertificationSwarmService.js';

describe('ZavorthPost291CertificationSwarmService Phase A', () => {
  it('publishes the post-291 certification swarm snapshot after Phase 8 readiness', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot).toEqual(expect.objectContaining({
      generatedAt: '2026-05-11T23:15:00.000Z',
      contractVersion: ZAVORTH_POST_291_CERTIFICATION_SWARM_CONTRACT_VERSION,
      status: 'certification-swarm-ready',
      planId: '302 - Post-291 Zavorth Operationalization Plan',
      phase: 'phase-a-certification-swarm',
      previousNativeReplacementStatus: 'native-replacement-decommission-ready',
    }));
    expect(snapshot.summary).toEqual(expect.objectContaining({
      certificationLanes: 5,
      passedLanes: 5,
      blockedLanes: 0,
      securityHardeningLanes: 1,
      approvalPolicyLanes: 1,
      regressionGateLanes: 1,
      observabilityAuditLanes: 1,
      rollbackBaselineLanes: 1,
      liveActivationsStarted: 0,
      providerCallsPerformed: false,
      channelSendsPerformed: false,
      toolExecutionsPerformed: false,
      workerLaunchesPerformed: false,
      fileMutationsPerformed: false,
    }));
    expect(snapshot.summary.passedGates).toBe(snapshot.summary.gates);
    expect(snapshot.commands.nextPhase).toBe('302 Phase B - Live Canary Swarm');
  });

  it('certifies a lane as parallel-safe receipt-only work', () => {
    const receipt = createService().certifyLane(createLane());

    expect(receipt).toEqual(expect.objectContaining({
      laneId: 'zavorth.post291.lane.security-test',
      kind: 'security-hardening',
      subagentRole: 'security-certifier',
      status: 'passed',
      parallelSafe: true,
      writeScope: 'certification-receipts-only',
      blockers: [],
    }));
    expect(receipt.gates).toEqual([
      expect.objectContaining({
        gateId: 'zavorth.post291.gate.secret-guard',
        status: 'passed',
        command: 'npm run security:secrets --silent',
      }),
    ]);
    expect(receipt.safety).toEqual(expect.objectContaining({
      noLiveActivation: true,
      noProviderCall: true,
      noChannelSend: true,
      noToolExecution: true,
      noWorkerLaunch: true,
      noFileMutation: true,
      approvalBypassAllowed: false,
    }));
  });

  it('blocks a lane when any certification gate fails', () => {
    const lane = createLane();
    lane.gates[0].passed = false;
    lane.gates[0].evidence = 'missing secret guard';

    const receipt = createService().certifyLane(lane);

    expect(receipt.status).toBe('blocked');
    expect(receipt.blockers).toEqual(['zavorth.post291.gate.secret-guard: missing secret guard']);
    expect(receipt.gates[0]).toEqual(expect.objectContaining({
      status: 'failed',
      evidence: 'missing secret guard',
    }));
  });

  it('aggregates five lanes into a subagent-ready certification swarm', () => {
    const service = createService();
    const snapshot = service.buildSnapshot();
    const aggregation = service.aggregateSwarm(snapshot.lanes);

    expect(aggregation).toEqual(expect.objectContaining({
      aggregationId: 'zavorth.post291.certification-swarm.aggregate',
      status: 'passed',
      laneCount: 5,
      passedLanes: 5,
      blockedLanes: 0,
      blockedGates: 0,
      parallelizationMode: 'subagent-lanes-ready',
      nextPhase: '302 Phase B - Live Canary Swarm',
    }));
    expect(aggregation.passedGates).toBe(aggregation.gateCount);
    expect(aggregation.safety).toEqual(expect.objectContaining({
      aggregateOnly: true,
      noLiveActivation: true,
      noAutomaticCanaryPromotion: true,
      noApprovalBypass: true,
    }));
  });

  it('projects certification state for Command Center', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot.commandCenterProjection).toEqual(expect.objectContaining({
      title: 'Post-291 Certification Swarm',
      status: 'certification-swarm-ready',
      tone: 'ready',
      policyPills: expect.arrayContaining([
        'security hardening',
        'approval/policy certification',
        'regression gates',
        'observability/audit',
        'rollback baseline',
        'no live activation',
      ]),
      nextSafeAction: 'Proceed to 302 Phase B - Live Canary Swarm with explicit approvals.',
    }));
    expect(snapshot.commandCenterProjection.cards.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'lanes',
      'passed-lanes',
      'gates',
      'security',
      'policy',
      'rollback',
      'live',
    ]));
  });

  it('blocks Phase A if Phase 8 is not ready', () => {
    const snapshot = createService().buildSnapshot({ nativeReplacementStatus: 'blocked' });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.previousNativeReplacementStatus).toBe('blocked');
    expect(snapshot.acceptanceMatrix.find((entry) => entry.requirementId === 'phase-8-native-replacement-decommission-ready')).toEqual(expect.objectContaining({
      status: 'failed',
    }));
  });

  it('formats an operator summary for certification swarm status', () => {
    const service = createService();
    const text = service.formatSnapshotText(service.buildSnapshot());

    expect(text).toContain('Zavorth Post-291 Certification Swarm - Phase A');
    expect(text).toContain('Status: certification-swarm-ready');
    expect(text).toContain('Certification lanes: 5');
    expect(text).toContain('Live activations started: 0');
    expect(text).toContain('Provider calls performed: false');
    expect(text).toContain('Next: 302 Phase B - Live Canary Swarm');
  });
});

function createService(): ZavorthPost291CertificationSwarmService {
  return new ZavorthPost291CertificationSwarmService({
    now: () => new Date('2026-05-11T23:15:00.000Z'),
    nativeReplacementStatus: 'native-replacement-decommission-ready',
  });
}

function createLane(): ZavorthCertificationLaneInput {
  return {
    laneId: 'security-test',
    kind: 'security-hardening',
    subagentRole: 'security-certifier',
    objective: 'certify security baseline',
    gates: [
      {
        gateId: 'secret-guard',
        command: 'npm run security:secrets --silent',
        evidence: 'secret guard ready',
        passed: true,
      },
    ],
    findings: ['no blockers'],
  };
}
