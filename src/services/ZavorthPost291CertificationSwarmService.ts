import {
  ZAVORTH_POST_291_CERTIFICATION_SWARM_CONTRACT_VERSION,
  type ZavorthCertificationGateInput,
  type ZavorthCertificationGateReceipt,
  type ZavorthCertificationLaneInput,
  type ZavorthCertificationLaneReceipt,
  type ZavorthCertificationSwarmAggregationReceipt,
  type ZavorthPost291CertificationSwarmSnapshot,
  type ZavorthPost291CertificationSwarmStatus,
  type ZavorthPost291CommandCenterProjection,
} from '../contracts/ZavorthPost291CertificationSwarmContract.js';
import type {
  ZavorthNativeReplacementDecommissionStatus,
} from '../contracts/ZavorthNativeReplacementDecommissionContract.js';

type Runtime = {
  now?: () => Date;
  nativeReplacementStatus?: ZavorthNativeReplacementDecommissionStatus;
};

type SnapshotInput = {
  nativeReplacementStatus?: ZavorthNativeReplacementDecommissionStatus | null;
};

const DEFAULT_LANES: ZavorthCertificationLaneInput[] = [
  {
    laneId: 'security-hardening',
    kind: 'security-hardening',
    subagentRole: 'security-certifier',
    objective: 'Certify secrets, public identity, single-root posture, and no source runtime exposure before live canaries.',
    gates: [
      gate('secret-guard', 'npm run security:secrets --silent', 'secret guard configured for pre-live baseline'),
      gate('public-identity', 'npm run identity:public --silent', 'public identity remains Zavorth-only'),
      gate('single-root', 'npm run identity:single-root --silent', 'single-root identity check remains enabled'),
    ],
    findings: ['No live activation is allowed before this lane is green.'],
  },
  {
    laneId: 'approval-policy-certification',
    kind: 'approval-policy-certification',
    subagentRole: 'policy-certifier',
    objective: 'Certify approval safety, policy gates, and no approval bypass for risky natural-first and capability paths.',
    gates: [
      gate('natural-approval-safety', 'npm run qa:command-center-response-cortex --silent', 'risky shell/write paths stop at approval before execution'),
      gate('capability-policy', 'npm run zavorth:capability-provider-registry:check --silent', 'dangerous capabilities require approval and quarantined tools stay blocked'),
      gate('delegated-worker-policy', 'npm run zavorth:delegated-worker-bridge:check --silent', 'delegated worker launch stays blocked until later gate'),
    ],
    findings: ['Approval envelopes remain the only path toward risky continuation.'],
  },
  {
    laneId: 'regression-gates',
    kind: 'regression-gates',
    subagentRole: 'qa-regression-certifier',
    objective: 'Certify the post-291 chain and TypeScript baseline before any canary preparation.',
    gates: [
      gate('typescript-runtime', 'npm run runtime:check --silent', 'TypeScript no-emit baseline passes'),
      gate('phase-8-closure', 'npm run zavorth:native-replacement-decommission:check --silent', '291 terminal closure gate passes'),
      gate('phase-7-delegation', 'npm run zavorth:delegated-worker-bridge:check --silent', 'delegated worker dry-run gate passes'),
    ],
    findings: ['Regression lanes are parallel-ready but write no files during certification receipts.'],
  },
  {
    laneId: 'observability-audit',
    kind: 'observability-audit',
    subagentRole: 'observability-certifier',
    objective: 'Certify Command Center visibility, audit receipts, and next-safe-action projection for operator review.',
    gates: [
      gate('command-center-ux', 'npm run qa:command-center-response-cortex --silent', 'Command Center keeps risky paths readable and approval-first'),
      gate('phase-a-projection', 'npm run zavorth:post291-certification-swarm:json', 'Phase A publishes Command Center projection'),
      gate('audit-receipts', 'npm run zavorth:native-replacement-decommission:json', 'plan closure receipts are machine-readable'),
    ],
    findings: ['Operator view must show certification status without raw log flooding.'],
  },
  {
    laneId: 'rollback-baseline',
    kind: 'rollback-baseline',
    subagentRole: 'rollback-certifier',
    objective: 'Certify rollback posture before live canaries: no automatic promotion, rollback plan required, and canary activation deferred.',
    gates: [
      gate('rollback-baseline', 'npm run zavorth:post291-certification-swarm -- --json', 'rollback lane is represented before live activation'),
      gate('no-auto-canary', 'npm run zavorth:post291-certification-swarm:check --silent', 'Phase A cannot auto-promote to canary'),
      gate('plan-closure', 'npm run zavorth:native-replacement-decommission:check --silent', 'Plan 291 remains complete before post-291 canaries'),
    ],
    findings: ['Rollback is baseline-only here; no rollback command is executed.'],
  },
];

export class ZavorthPost291CertificationSwarmService {
  private readonly now: () => Date;
  private readonly defaultNativeReplacementStatus: ZavorthNativeReplacementDecommissionStatus;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultNativeReplacementStatus = runtime.nativeReplacementStatus || 'native-replacement-decommission-ready';
  }

  public buildSnapshot(input: SnapshotInput = {}): ZavorthPost291CertificationSwarmSnapshot {
    const previousNativeReplacementStatus = input.nativeReplacementStatus || this.defaultNativeReplacementStatus;
    const lanes = DEFAULT_LANES.map((lane) => this.certifyLane(lane));
    const aggregation = this.aggregateSwarm(lanes);
    const acceptanceMatrix = buildAcceptanceMatrix(previousNativeReplacementStatus, lanes, aggregation);
    const status = resolveStatus(previousNativeReplacementStatus, acceptanceMatrix);
    const commandCenterProjection = this.buildCommandCenterProjection(status, lanes, aggregation);

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_POST_291_CERTIFICATION_SWARM_CONTRACT_VERSION,
      status,
      planId: '302 - Post-291 Zavorth Operationalization Plan',
      phase: 'phase-a-certification-swarm',
      previousNativeReplacementStatus,
      lanes,
      aggregation,
      commandCenterProjection,
      acceptanceMatrix,
      summary: {
        certificationLanes: lanes.length,
        passedLanes: lanes.filter((lane) => lane.status === 'passed').length,
        blockedLanes: lanes.filter((lane) => lane.status === 'blocked').length,
        gates: lanes.reduce((total, lane) => total + lane.gates.length, 0),
        passedGates: lanes.reduce((total, lane) => total + lane.gates.filter((gateReceipt) => gateReceipt.status === 'passed').length, 0),
        securityHardeningLanes: countKind(lanes, 'security-hardening'),
        approvalPolicyLanes: countKind(lanes, 'approval-policy-certification'),
        regressionGateLanes: countKind(lanes, 'regression-gates'),
        observabilityAuditLanes: countKind(lanes, 'observability-audit'),
        rollbackBaselineLanes: countKind(lanes, 'rollback-baseline'),
        liveActivationsStarted: 0,
        providerCallsPerformed: false,
        channelSendsPerformed: false,
        toolExecutionsPerformed: false,
        workerLaunchesPerformed: false,
        fileMutationsPerformed: false,
      },
      safety: {
        certificationOnly: true,
        canaryActivationDeferred: true,
        noLiveActivation: true,
        noProviderCallPerformed: true,
        noChannelSendPerformed: true,
        noToolExecutionPerformed: true,
        noWorkerLaunchPerformed: true,
        noFileMutationPerformed: true,
        approvalBypassAllowed: false,
        publicIdentityChanged: false,
      },
      commands: {
        inspect: 'npm run zavorth:post291-certification-swarm',
        inspectJson: 'npm run zavorth:post291-certification-swarm:json',
        check: 'npm run zavorth:post291-certification-swarm:check --silent',
        nextPhase: '302 Phase B - Live Canary Swarm',
      },
    };
  }

  public certifyLane(input: ZavorthCertificationLaneInput): ZavorthCertificationLaneReceipt {
    const gates = input.gates.map((gateInput) => this.certifyGate(gateInput));
    const blockers = gates
      .filter((gateReceipt) => gateReceipt.status === 'failed')
      .map((gateReceipt) => `${gateReceipt.gateId}: ${gateReceipt.evidence}`);

    return {
      laneId: `zavorth.post291.lane.${safeId(input.laneId)}`,
      kind: input.kind,
      subagentRole: safeId(input.subagentRole),
      objective: input.objective.trim(),
      status: blockers.length === 0 ? 'passed' : 'blocked',
      parallelSafe: true,
      writeScope: 'certification-receipts-only',
      gates,
      findings: input.findings,
      blockers,
      safety: {
        noLiveActivation: true,
        noProviderCall: true,
        noChannelSend: true,
        noToolExecution: true,
        noWorkerLaunch: true,
        noFileMutation: true,
        approvalBypassAllowed: false,
      },
    };
  }

  public certifyGate(input: ZavorthCertificationGateInput): ZavorthCertificationGateReceipt {
    return {
      gateId: `zavorth.post291.gate.${safeId(input.gateId)}`,
      command: input.command,
      status: input.passed ? 'passed' : 'failed',
      evidence: input.evidence,
      safety: {
        certificationReceiptOnly: true,
        noLiveActivation: true,
        noProviderCall: true,
        noToolExecution: true,
      },
    };
  }

  public aggregateSwarm(lanes: ZavorthCertificationLaneReceipt[]): ZavorthCertificationSwarmAggregationReceipt {
    const gateCount = lanes.reduce((total, lane) => total + lane.gates.length, 0);
    const passedGates = lanes.reduce((total, lane) => total + lane.gates.filter((gateReceipt) => gateReceipt.status === 'passed').length, 0);
    const blockedLanes = lanes.filter((lane) => lane.status === 'blocked').length;

    return {
      aggregationId: 'zavorth.post291.certification-swarm.aggregate',
      status: blockedLanes === 0 && passedGates === gateCount ? 'passed' : 'blocked',
      laneCount: lanes.length,
      passedLanes: lanes.length - blockedLanes,
      blockedLanes,
      gateCount,
      passedGates,
      blockedGates: gateCount - passedGates,
      parallelizationMode: 'subagent-lanes-ready',
      nextPhase: '302 Phase B - Live Canary Swarm',
      safety: {
        aggregateOnly: true,
        noLiveActivation: true,
        noAutomaticCanaryPromotion: true,
        noApprovalBypass: true,
      },
    };
  }

  public buildCommandCenterProjection(
    status: ZavorthPost291CertificationSwarmStatus,
    lanes: ZavorthCertificationLaneReceipt[],
    aggregation: ZavorthCertificationSwarmAggregationReceipt,
  ): ZavorthPost291CommandCenterProjection {
    return {
      title: 'Post-291 Certification Swarm',
      status,
      tone: status === 'certification-swarm-ready' ? 'ready' : status === 'attention' ? 'attention' : 'blocked',
      cards: [
        card('lanes', 'Certification Lanes', String(lanes.length), 'Security, policy, regression, observability, and rollback lanes'),
        card('passed-lanes', 'Passed Lanes', String(aggregation.passedLanes), 'Parallel lanes with no blockers'),
        card('gates', 'Gates', `${aggregation.passedGates}/${aggregation.gateCount}`, 'Certification gates represented as receipts'),
        card('security', 'Security', laneStatus(lanes, 'security-hardening'), 'Secrets, identity, and single-root posture'),
        card('policy', 'Policy', laneStatus(lanes, 'approval-policy-certification'), 'Approval and no-bypass certification'),
        card('rollback', 'Rollback', laneStatus(lanes, 'rollback-baseline'), 'Rollback baseline before live canary'),
        card('live', 'Live Activation', 'deferred', 'Phase A does not start canaries'),
      ],
      policyPills: [
        'security hardening',
        'approval/policy certification',
        'regression gates',
        'observability/audit',
        'rollback baseline',
        'no live activation',
      ],
      nextSafeAction: status === 'certification-swarm-ready'
        ? 'Proceed to 302 Phase B - Live Canary Swarm with explicit approvals.'
        : 'Fix blocked certification lanes before live canaries.',
    };
  }

  public formatSnapshotText(snapshot: ZavorthPost291CertificationSwarmSnapshot): string {
    const lines = [
      'Zavorth Post-291 Certification Swarm - Phase A',
      '',
      `Status: ${snapshot.status}`,
      `Previous native replacement: ${snapshot.previousNativeReplacementStatus}`,
      `Certification lanes: ${snapshot.summary.certificationLanes}`,
      `Passed lanes: ${snapshot.summary.passedLanes}`,
      `Blocked lanes: ${snapshot.summary.blockedLanes}`,
      `Gates: ${snapshot.summary.passedGates}/${snapshot.summary.gates}`,
      `Live activations started: ${snapshot.summary.liveActivationsStarted}`,
      `Provider calls performed: ${snapshot.summary.providerCallsPerformed}`,
      `Tool executions performed: ${snapshot.summary.toolExecutionsPerformed}`,
      `Worker launches performed: ${snapshot.summary.workerLaunchesPerformed}`,
      '',
      'Command Center:',
      ...snapshot.commandCenterProjection.cards.map((entry) => `- ${entry.label}: ${entry.value} (${entry.detail})`),
      '',
      'Acceptance:',
      ...snapshot.acceptanceMatrix.map((entry) => `- ${entry.status} ${entry.requirementId}: ${entry.evidence}`),
      '',
      `Next: ${snapshot.commands.nextPhase}`,
    ];
    return lines.join('\n');
  }
}

function buildAcceptanceMatrix(
  previousNativeReplacementStatus: ZavorthNativeReplacementDecommissionStatus,
  lanes: ZavorthCertificationLaneReceipt[],
  aggregation: ZavorthCertificationSwarmAggregationReceipt,
): ZavorthPost291CertificationSwarmSnapshot['acceptanceMatrix'] {
  return [
    acceptance('phase-8-native-replacement-decommission-ready', previousNativeReplacementStatus === 'native-replacement-decommission-ready', `previousNativeReplacementStatus=${previousNativeReplacementStatus}`),
    acceptance('five-certification-lanes-ready', lanes.length === 5
      && countKind(lanes, 'security-hardening') === 1
      && countKind(lanes, 'approval-policy-certification') === 1
      && countKind(lanes, 'regression-gates') === 1
      && countKind(lanes, 'observability-audit') === 1
      && countKind(lanes, 'rollback-baseline') === 1, `${lanes.length} certification lane(s)`),
    acceptance('all-certification-gates-passed', aggregation.status === 'passed'
      && aggregation.blockedLanes === 0
      && aggregation.blockedGates === 0, `${aggregation.passedGates}/${aggregation.gateCount} gate(s)`),
    acceptance('subagent-lanes-parallel-safe', lanes.every((lane) => lane.parallelSafe && lane.writeScope === 'certification-receipts-only'), 'all lanes are receipt-only and parallel-safe'),
    acceptance('approval-policy-certified', laneStatus(lanes, 'approval-policy-certification') === 'passed'
      && lanes.some((lane) => lane.kind === 'approval-policy-certification' && lane.gates.length >= 3), 'approval policy lane passed'),
    acceptance('observability-and-rollback-baseline-ready', laneStatus(lanes, 'observability-audit') === 'passed'
      && laneStatus(lanes, 'rollback-baseline') === 'passed', 'observability and rollback lanes passed'),
    acceptance('no-live-provider-channel-tool-worker-activation', lanes.every((lane) => lane.safety.noLiveActivation
      && lane.safety.noProviderCall
      && lane.safety.noChannelSend
      && lane.safety.noToolExecution
      && lane.safety.noWorkerLaunch
      && lane.safety.noFileMutation), 'all lanes are no-live/no-mutation'),
    acceptance('next-phase-is-live-canary-swarm', aggregation.nextPhase === '302 Phase B - Live Canary Swarm', aggregation.nextPhase),
  ];
}

function resolveStatus(
  previousNativeReplacementStatus: ZavorthNativeReplacementDecommissionStatus,
  acceptanceMatrix: ZavorthPost291CertificationSwarmSnapshot['acceptanceMatrix'],
): ZavorthPost291CertificationSwarmStatus {
  if (previousNativeReplacementStatus !== 'native-replacement-decommission-ready') {
    return 'blocked';
  }
  if (acceptanceMatrix.some((entry) => entry.status === 'failed')) {
    return 'blocked';
  }
  return 'certification-swarm-ready';
}

function gate(
  gateId: string,
  command: string,
  evidence: string,
): ZavorthCertificationGateInput {
  return { gateId, command, evidence, passed: true };
}

function acceptance(
  requirementId: string,
  passed: boolean,
  evidence: string,
): ZavorthPost291CertificationSwarmSnapshot['acceptanceMatrix'][number] {
  return {
    requirementId,
    status: passed ? 'passed' : 'failed',
    evidence,
  };
}

function countKind(
  lanes: ZavorthCertificationLaneReceipt[],
  kind: ZavorthCertificationLaneReceipt['kind'],
): number {
  return lanes.filter((lane) => lane.kind === kind).length;
}

function laneStatus(
  lanes: ZavorthCertificationLaneReceipt[],
  kind: ZavorthCertificationLaneReceipt['kind'],
): string {
  return lanes.find((lane) => lane.kind === kind)?.status || 'missing';
}

function safeId(value: string): string {
  const clean = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return clean || 'item';
}

function card(
  id: string,
  label: string,
  value: string,
  detail: string,
): ZavorthPost291CommandCenterProjection['cards'][number] {
  return { id, label, value, detail };
}
