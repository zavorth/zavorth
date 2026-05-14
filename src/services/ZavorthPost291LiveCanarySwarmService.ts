import {
  ZAVORTH_POST_291_LIVE_CANARY_SWARM_CONTRACT_VERSION,
  type ZavorthLiveCanaryActivationTicket,
  type ZavorthLiveCanaryInput,
  type ZavorthLiveCanaryKind,
  type ZavorthLiveCanaryPreparationReceipt,
  type ZavorthLiveCanaryRollbackReceipt,
  type ZavorthLiveCanarySequenceReceipt,
  type ZavorthPost291LiveCanaryCommandCenterProjection,
  type ZavorthPost291LiveCanarySwarmSnapshot,
  type ZavorthPost291LiveCanarySwarmStatus,
} from '../contracts/ZavorthPost291LiveCanarySwarmContract.js';
import type {
  ZavorthPost291CertificationSwarmStatus,
} from '../contracts/ZavorthPost291CertificationSwarmContract.js';

type Runtime = {
  now?: () => Date;
  certificationSwarmStatus?: ZavorthPost291CertificationSwarmStatus;
};

type SnapshotInput = {
  certificationSwarmStatus?: ZavorthPost291CertificationSwarmStatus | null;
};

const CANARY_ORDER: ZavorthLiveCanaryKind[] = [
  'provider',
  'channel',
  'tool-execution',
  'worker-activation',
];

const DEFAULT_CANARIES: ZavorthLiveCanaryInput[] = [
  {
    canaryId: 'provider-default',
    kind: 'provider',
    sequenceIndex: 1,
    targetRef: 'provider://configured-default',
    dryRunCommand: 'npm run zavorth:provider-live-canary:check --silent',
    liveCommand: 'npm run zavorth:provider-live-canary -- --require-live --owner-approval-id <id>',
    rollbackCommand: 'npm run zavorth:provider-live-canary:json -- --rollback-preview',
    requiredSecretRefs: ['secret://provider-api-key'],
    risk: 'high',
  },
  {
    canaryId: 'channel-default',
    kind: 'channel',
    sequenceIndex: 2,
    targetRef: 'channel://configured-operator-channel',
    dryRunCommand: 'npm run channel-experience-certification:check --silent',
    liveCommand: 'npm run qa:command-center-live-chat -- --allow-send --require-live --owner-approval-id <id>',
    rollbackCommand: 'npm run channel-experience-certification:json -- --rollback-preview',
    requiredSecretRefs: ['secret://channel-bot-token'],
    risk: 'high',
  },
  {
    canaryId: 'tool-execution-default',
    kind: 'tool-execution',
    sequenceIndex: 3,
    targetRef: 'tool://controlled-shell-exec',
    dryRunCommand: 'node scripts/zavorth-live-canary-executor-check.mjs',
    liveCommand: 'node scripts/zavorth-live-canary-executor.ts --require-live --owner-approval-id <id>',
    rollbackCommand: 'node scripts/zavorth-live-canary-executor-check.mjs --rollback-preview',
    requiredSecretRefs: [],
    risk: 'critical',
  },
  {
    canaryId: 'worker-activation-default',
    kind: 'worker-activation',
    sequenceIndex: 4,
    targetRef: 'worker://delegated-worker-activation',
    dryRunCommand: 'npm run zavorth:delegated-worker-bridge:check --silent',
    liveCommand: 'npm run zavorth:delegated-worker-bridge -- --require-live --owner-approval-id <id>',
    rollbackCommand: 'npm run zavorth:delegated-worker-bridge:json -- --rollback-preview',
    requiredSecretRefs: [],
    risk: 'critical',
  },
];

export class ZavorthPost291LiveCanarySwarmService {
  private readonly now: () => Date;
  private readonly defaultCertificationSwarmStatus: ZavorthPost291CertificationSwarmStatus;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultCertificationSwarmStatus = runtime.certificationSwarmStatus || 'certification-swarm-ready';
  }

  public buildSnapshot(input: SnapshotInput = {}): ZavorthPost291LiveCanarySwarmSnapshot {
    const previousCertificationSwarmStatus = input.certificationSwarmStatus || this.defaultCertificationSwarmStatus;
    const preparations = DEFAULT_CANARIES.map((canary) => this.prepareCanary(canary));
    const activationTickets = preparations.map((preparation) => this.buildActivationTicket(preparation));
    const rollbackReceipts = preparations.map((preparation) => this.buildRollbackReceipt(preparation));
    const sequence = this.buildSequenceReceipt(preparations, activationTickets);
    const acceptanceMatrix = buildAcceptanceMatrix(
      previousCertificationSwarmStatus,
      preparations,
      activationTickets,
      rollbackReceipts,
      sequence,
    );
    const status = resolveStatus(previousCertificationSwarmStatus, acceptanceMatrix);
    const commandCenterProjection = this.buildCommandCenterProjection(status, preparations, activationTickets, rollbackReceipts, sequence);

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_POST_291_LIVE_CANARY_SWARM_CONTRACT_VERSION,
      status,
      planId: '302 - Post-291 Zavorth Operationalization Plan',
      phase: 'phase-b-live-canary-swarm',
      previousCertificationSwarmStatus,
      preparations,
      activationTickets,
      rollbackReceipts,
      sequence,
      commandCenterProjection,
      acceptanceMatrix,
      summary: {
        canariesPrepared: preparations.length,
        providerCanaries: countKind(preparations, 'provider'),
        channelCanaries: countKind(preparations, 'channel'),
        toolCanaries: countKind(preparations, 'tool-execution'),
        workerCanaries: countKind(preparations, 'worker-activation'),
        activationTickets: activationTickets.length,
        dryRunPreviewsReady: preparations.filter((entry) => entry.dryRunPreviewReady).length,
        rollbackReceiptsReady: rollbackReceipts.filter((entry) => entry.status === 'rollback-ready').length,
        ownerApprovalsRequired: activationTickets.filter((entry) => entry.status === 'approval-required').length,
        liveActivationsPerformed: 0,
        providerCallsPerformed: false,
        channelSendsPerformed: false,
        toolExecutionsPerformed: false,
        workerLaunchesPerformed: false,
        secretsSerialized: false,
        automaticPromotionsPerformed: false,
      },
      safety: {
        liveCanaryControlPlaneOnly: true,
        parallelPreparationAllowed: true,
        sequentialActivationRequired: true,
        noLiveActivationPerformed: true,
        noProviderCallPerformed: true,
        noChannelSendPerformed: true,
        noToolExecutionPerformed: true,
        noWorkerLaunchPerformed: true,
        noSecretValueSerialized: true,
        noAutomaticPromotion: true,
        approvalBypassAllowed: false,
        publicIdentityChanged: false,
      },
      commands: {
        inspect: 'npm run zavorth:post291-live-canary-swarm',
        inspectJson: 'npm run zavorth:post291-live-canary-swarm:json',
        check: 'npm run zavorth:post291-live-canary-swarm:check --silent',
        nextPhase: '302 Phase C - Release Candidate',
      },
    };
  }

  public prepareCanary(input: ZavorthLiveCanaryInput): ZavorthLiveCanaryPreparationReceipt {
    return {
      canaryId: `zavorth.post291.canary.${safeId(input.canaryId)}`,
      kind: input.kind,
      sequenceIndex: input.sequenceIndex,
      targetRef: input.targetRef,
      targetPublicName: 'Zavorth',
      status: 'prepared',
      parallelPreparationSafe: true,
      sequentialActivationRequired: true,
      dryRunPreviewReady: true,
      approvalRequired: true,
      ownerApprovalId: input.ownerApprovalId || null,
      requiredSecretRefs: input.requiredSecretRefs.map((entry) => secretRefOnly(entry)),
      risk: input.risk,
      safety: {
        preparationOnly: true,
        noSecretValueSerialized: true,
        noLiveActivation: true,
        noProviderCall: true,
        noChannelSend: true,
        noToolExecution: true,
        noWorkerLaunch: true,
      },
    };
  }

  public buildActivationTicket(
    preparation: ZavorthLiveCanaryPreparationReceipt,
  ): ZavorthLiveCanaryActivationTicket {
    const approvalGranted = Boolean(preparation.ownerApprovalId);
    return {
      canaryId: preparation.canaryId,
      kind: preparation.kind,
      sequenceIndex: preparation.sequenceIndex,
      status: approvalGranted ? 'ready-for-manual-live-activation' : 'approval-required',
      activationMode: 'manual-approval-required',
      dryRunCommand: dryRunCommandFor(preparation.kind),
      liveCommand: liveCommandFor(preparation.kind),
      ownerApprovalId: preparation.ownerApprovalId,
      approvalGranted,
      liveActivationPerformed: false,
      sequenceBlockedUntilPreviousPasses: preparation.sequenceIndex > 1,
      rollbackRequiredBeforeNext: true,
      safety: {
        ticketOnly: true,
        noAutomaticActivation: true,
        noApprovalBypass: true,
        noLiveSideEffect: true,
      },
    };
  }

  public buildRollbackReceipt(
    preparation: ZavorthLiveCanaryPreparationReceipt,
  ): ZavorthLiveCanaryRollbackReceipt {
    return {
      canaryId: preparation.canaryId,
      kind: preparation.kind,
      rollbackToken: `zavorth.rollback.${safeId(preparation.canaryId)}`,
      rollbackCommand: rollbackCommandFor(preparation.kind),
      status: 'rollback-ready',
      automaticRollback: false,
      liveRollbackPerformed: false,
      safety: {
        rollbackPreparedOnly: true,
        noRollbackExecuted: true,
        operatorConfirmationRequired: true,
      },
    };
  }

  public buildSequenceReceipt(
    preparations: ZavorthLiveCanaryPreparationReceipt[],
    activationTickets: ZavorthLiveCanaryActivationTicket[],
  ): ZavorthLiveCanarySequenceReceipt {
    const order = preparations
      .slice()
      .sort((left, right) => left.sequenceIndex - right.sequenceIndex)
      .map((entry) => entry.kind);
    const blocked = !sameOrder(order, CANARY_ORDER) || activationTickets.some((ticket) => ticket.liveActivationPerformed);
    const nextTicket = activationTickets
      .slice()
      .sort((left, right) => left.sequenceIndex - right.sequenceIndex)
      .find((ticket) => ticket.status === 'approval-required');

    return {
      sequenceId: 'zavorth.post291.live-canary.sequence',
      status: blocked ? 'blocked' : 'sequence-ready',
      order,
      parallelPreparationAllowed: true,
      sequentialActivationRequired: true,
      nextCanaryKind: nextTicket?.kind || null,
      safety: {
        providerBeforeChannel: order[0] === 'provider',
        channelBeforeTool: order[1] === 'channel',
        toolBeforeWorker: order[2] === 'tool-execution' && order[3] === 'worker-activation',
        noAutomaticPromotion: true,
      },
    };
  }

  public buildCommandCenterProjection(
    status: ZavorthPost291LiveCanarySwarmStatus,
    preparations: ZavorthLiveCanaryPreparationReceipt[],
    activationTickets: ZavorthLiveCanaryActivationTicket[],
    rollbackReceipts: ZavorthLiveCanaryRollbackReceipt[],
    sequence: ZavorthLiveCanarySequenceReceipt,
  ): ZavorthPost291LiveCanaryCommandCenterProjection {
    return {
      title: 'Post-291 Live Canary Swarm',
      status,
      tone: status === 'live-canary-swarm-ready' ? 'ready' : status === 'attention' ? 'attention' : 'blocked',
      cards: [
        card('canaries', 'Canaries', String(preparations.length), 'Provider, channel, tool, and worker canaries prepared'),
        card('sequence', 'Sequence', sequence.status, sequence.order.join(' -> ')),
        card('approvals', 'Approvals', String(activationTickets.filter((entry) => entry.status === 'approval-required').length), 'Owner approvals required before manual live activation'),
        card('dry-run', 'Dry Run', String(preparations.filter((entry) => entry.dryRunPreviewReady).length), 'Dry-run previews ready'),
        card('rollback', 'Rollback', String(rollbackReceipts.length), 'Rollback receipts prepared before activation'),
        card('live', 'Live Effects', '0', 'No provider/channel/tool/worker live effect performed by Phase B gate'),
        card('next', 'Next', 'Phase C', 'Release Candidate after approved canary evidence'),
      ],
      policyPills: [
        'parallel preparation',
        'sequential activation',
        'owner approval required',
        'dry-run preview',
        'rollback before next',
        'no automatic promotion',
      ],
      nextSafeAction: status === 'live-canary-swarm-ready'
        ? 'Collect explicit owner approvals and execute canaries manually before 302 Phase C - Release Candidate.'
        : 'Fix blocked canary sequencing or prerequisites before live activation.',
    };
  }

  public formatSnapshotText(snapshot: ZavorthPost291LiveCanarySwarmSnapshot): string {
    const lines = [
      'Zavorth Post-291 Live Canary Swarm - Phase B',
      '',
      `Status: ${snapshot.status}`,
      `Previous certification swarm: ${snapshot.previousCertificationSwarmStatus}`,
      `Canaries prepared: ${snapshot.summary.canariesPrepared}`,
      `Activation tickets: ${snapshot.summary.activationTickets}`,
      `Dry-run previews ready: ${snapshot.summary.dryRunPreviewsReady}`,
      `Rollback receipts ready: ${snapshot.summary.rollbackReceiptsReady}`,
      `Owner approvals required: ${snapshot.summary.ownerApprovalsRequired}`,
      `Live activations performed: ${snapshot.summary.liveActivationsPerformed}`,
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
  previousCertificationSwarmStatus: ZavorthPost291CertificationSwarmStatus,
  preparations: ZavorthLiveCanaryPreparationReceipt[],
  activationTickets: ZavorthLiveCanaryActivationTicket[],
  rollbackReceipts: ZavorthLiveCanaryRollbackReceipt[],
  sequence: ZavorthLiveCanarySequenceReceipt,
): ZavorthPost291LiveCanarySwarmSnapshot['acceptanceMatrix'] {
  return [
    acceptance('phase-a-certification-swarm-ready', previousCertificationSwarmStatus === 'certification-swarm-ready', `previousCertificationSwarmStatus=${previousCertificationSwarmStatus}`),
    acceptance('four-live-canaries-prepared', preparations.length === 4
      && countKind(preparations, 'provider') === 1
      && countKind(preparations, 'channel') === 1
      && countKind(preparations, 'tool-execution') === 1
      && countKind(preparations, 'worker-activation') === 1, `${preparations.length} canary preparation(s)`),
    acceptance('parallel-preparation-sequential-activation', preparations.every((entry) => entry.parallelPreparationSafe && entry.sequentialActivationRequired)
      && sequence.parallelPreparationAllowed
      && sequence.sequentialActivationRequired
      && sequence.status === 'sequence-ready', sequence.order.join(' -> ')),
    acceptance('activation-tickets-approval-required', activationTickets.length === preparations.length
      && activationTickets.every((entry) => entry.status === 'approval-required' && entry.activationMode === 'manual-approval-required' && !entry.liveActivationPerformed), `${activationTickets.length} activation ticket(s)`),
    acceptance('dry-run-previews-and-rollback-ready', preparations.every((entry) => entry.dryRunPreviewReady)
      && rollbackReceipts.length === preparations.length
      && rollbackReceipts.every((entry) => entry.status === 'rollback-ready' && !entry.liveRollbackPerformed), `${rollbackReceipts.length} rollback receipt(s)`),
    acceptance('sequence-order-provider-channel-tool-worker', sameOrder(sequence.order, CANARY_ORDER)
      && sequence.safety.providerBeforeChannel
      && sequence.safety.channelBeforeTool
      && sequence.safety.toolBeforeWorker, sequence.order.join(' -> ')),
    acceptance('no-secrets-serialized', preparations.every((entry) => entry.safety.noSecretValueSerialized
      && entry.requiredSecretRefs.every((secretRef) => secretRef.startsWith('secret://'))), 'secret refs only'),
    acceptance('no-live-provider-channel-tool-worker-effects', preparations.every((entry) => entry.safety.noLiveActivation
      && entry.safety.noProviderCall
      && entry.safety.noChannelSend
      && entry.safety.noToolExecution
      && entry.safety.noWorkerLaunch)
      && activationTickets.every((entry) => entry.safety.noLiveSideEffect), 'all canaries are tickets/previews only'),
  ];
}

function resolveStatus(
  previousCertificationSwarmStatus: ZavorthPost291CertificationSwarmStatus,
  acceptanceMatrix: ZavorthPost291LiveCanarySwarmSnapshot['acceptanceMatrix'],
): ZavorthPost291LiveCanarySwarmStatus {
  if (previousCertificationSwarmStatus !== 'certification-swarm-ready') {
    return 'blocked';
  }
  if (acceptanceMatrix.some((entry) => entry.status === 'failed')) {
    return 'blocked';
  }
  return 'live-canary-swarm-ready';
}

function acceptance(
  requirementId: string,
  passed: boolean,
  evidence: string,
): ZavorthPost291LiveCanarySwarmSnapshot['acceptanceMatrix'][number] {
  return {
    requirementId,
    status: passed ? 'passed' : 'failed',
    evidence,
  };
}

function countKind(
  preparations: ZavorthLiveCanaryPreparationReceipt[],
  kind: ZavorthLiveCanaryKind,
): number {
  return preparations.filter((entry) => entry.kind === kind).length;
}

function dryRunCommandFor(kind: ZavorthLiveCanaryKind): string {
  return DEFAULT_CANARIES.find((entry) => entry.kind === kind)?.dryRunCommand || 'npm run runtime:check --silent';
}

function liveCommandFor(kind: ZavorthLiveCanaryKind): string {
  return DEFAULT_CANARIES.find((entry) => entry.kind === kind)?.liveCommand || 'manual-live-command-required';
}

function rollbackCommandFor(kind: ZavorthLiveCanaryKind): string {
  return DEFAULT_CANARIES.find((entry) => entry.kind === kind)?.rollbackCommand || 'manual-rollback-command-required';
}

function secretRefOnly(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('secret://')) return trimmed;
  return `secret://${safeId(trimmed)}`;
}

function sameOrder(left: ZavorthLiveCanaryKind[], right: ZavorthLiveCanaryKind[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
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
): ZavorthPost291LiveCanaryCommandCenterProjection['cards'][number] {
  return { id, label, value, detail };
}
