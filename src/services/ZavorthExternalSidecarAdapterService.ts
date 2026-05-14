import {
  ZAVORTH_EXTERNAL_SIDECAR_ADAPTER_CONTRACT_VERSION,
  type ZavorthExternalSidecarAdapterSnapshot,
  type ZavorthExternalSidecarAdapterStatus,
  type ZavorthExternalSidecarCapabilityRecord,
  type ZavorthExternalSidecarChannelRecord,
  type ZavorthExternalSidecarCommandCenterProjection,
  type ZavorthExternalSidecarEventRecord,
  type ZavorthExternalSidecarHealthRecord,
  type ZavorthExternalSidecarInboundEventInput,
  type ZavorthExternalSidecarInboundGatewayReceipt,
  type ZavorthExternalSidecarOutboundDryRunInput,
  type ZavorthExternalSidecarOutboundDryRunReceipt,
  type ZavorthExternalSidecarProbeMode,
  type ZavorthExternalSidecarReadOnlyProbeSnapshot,
  type ZavorthExternalSidecarSessionRecord,
  type ZavorthExternalSidecarSkillRecord,
  type ZavorthExternalSidecarSourceRef,
  type ZavorthExternalSidecarToolRecord,
  type ZavorthExternalSidecarWorkerHealthRecord,
} from '../contracts/ZavorthExternalSidecarAdapterContract.js';
import type {
  ZavorthExternalRuntimeNaturalFirstRoute,
} from '../contracts/ZavorthExternalRuntimeBridgeContract.js';
import type {
  ZavorthNativeEngineAbsorptionStatus,
} from '../contracts/ZavorthNativeEngineAbsorptionContract.js';

type Runtime = {
  now?: () => Date;
  nativeEngineStatus?: ZavorthNativeEngineAbsorptionStatus;
};

type SnapshotInput = {
  nativeEngineStatus?: ZavorthNativeEngineAbsorptionStatus | null;
  probeMode?: ZavorthExternalSidecarProbeMode | null;
};

const DEFAULT_SOURCE_REFS: ZavorthExternalSidecarSourceRef[] = [
  sourceRef('reference-runtime-a', 'Reference runtime A'),
  sourceRef('reference-runtime-b', 'Reference runtime B'),
];

export class ZavorthExternalSidecarAdapterService {
  private readonly now: () => Date;
  private readonly defaultNativeEngineStatus: ZavorthNativeEngineAbsorptionStatus;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultNativeEngineStatus = runtime.nativeEngineStatus || 'native-engine-ready';
  }

  public buildSnapshot(input: SnapshotInput = {}): ZavorthExternalSidecarAdapterSnapshot {
    const previousNativeEngineStatus = input.nativeEngineStatus || this.defaultNativeEngineStatus;
    const readOnlyProbe = this.buildReadOnlyProbe(input.probeMode || 'fixture-readonly');
    const inboundGatewayReceipt = this.normalizeInboundEvent({
      sourceRuntimeId: 'reference-runtime-a',
      sourceEventId: 'evt-fixture-001',
      channelId: 'telegram-fixture',
      sessionId: 'session-fixture-001',
      text: 'analise esse repo e prepare um plano governado',
      authorRef: 'operator-fixture',
    });
    const outboundDryRunReceipt = this.evaluateOutboundDryRun({
      actionId: 'outbound-fixture-001',
      kind: 'message-send',
      targetRef: 'telegram-fixture',
      textPreview: 'Resumo pronto para envio pelo ReplyPipeline.',
      risk: 'low',
    });
    const riskyOutboundDryRunReceipt = this.evaluateOutboundDryRun({
      actionId: 'outbound-risky-fixture-001',
      kind: 'worker-launch',
      targetRef: 'external-worker-pool',
      textPreview: 'Launch worker and mutate repository state.',
      risk: 'high',
      approvalGranted: false,
    });
    const acceptanceMatrix = buildAcceptanceMatrix(
      previousNativeEngineStatus,
      readOnlyProbe,
      inboundGatewayReceipt,
      outboundDryRunReceipt,
      riskyOutboundDryRunReceipt,
    );
    const status = resolveStatus(previousNativeEngineStatus, acceptanceMatrix);
    const commandCenterProjection = this.buildCommandCenterProjection({
      status,
      readOnlyProbe,
      inboundGatewayReceipt,
      outboundDryRunReceipt,
      riskyOutboundDryRunReceipt,
    });

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_EXTERNAL_SIDECAR_ADAPTER_CONTRACT_VERSION,
      status,
      planId: '291 - Plano Zavorth External Runtime Absorption',
      phase: 'phase-3-sidecar-adapter',
      previousNativeEngineStatus,
      readOnlyProbe,
      inboundGatewayReceipt,
      outboundDryRunReceipt,
      riskyOutboundDryRunReceipt,
      commandCenterProjection,
      acceptanceMatrix,
      summary: {
        sourceChannelsListed: readOnlyProbe.channels.length,
        sourceSkillsListed: readOnlyProbe.skills.length,
        sourceToolsListed: readOnlyProbe.tools.length,
        sourceSessionsListed: readOnlyProbe.sessions.length,
        workerHealthRecordsListed: readOnlyProbe.workers.length,
        inboundEventsRoutedToGateway: inboundGatewayReceipt.status === 'routed-to-gateway' ? 1 : 0,
        outboundDryRunsEvaluated: [outboundDryRunReceipt, riskyOutboundDryRunReceipt]
          .filter((entry) => entry.safety.dryRunOnly && !entry.safety.liveIoPerformed).length,
        riskyOutboundActionsBlocked: riskyOutboundDryRunReceipt.policyDecision === 'blocked' ? 1 : 0,
        sidecarsStarted: false,
        liveIoPerformed: false,
      },
      safety: {
        readOnlyProbeOnly: true,
        sourceRuntimeCodeExecuted: false,
        sidecarsStarted: false,
        outboundIoPerformed: false,
        toolExecutionPerformed: false,
        workerLaunchPerformed: false,
        approvalBypassAllowed: false,
        publicIdentityChanged: false,
      },
      commands: {
        inspect: 'npm run zavorth:external-sidecar-adapter',
        inspectJson: 'npm run zavorth:external-sidecar-adapter:json',
        check: 'npm run zavorth:external-sidecar-adapter:check --silent',
        nextPhase: '291 Phase 4 - Capability Providers',
      },
    };
  }

  public buildReadOnlyProbe(
    mode: ZavorthExternalSidecarProbeMode = 'fixture-readonly',
  ): ZavorthExternalSidecarReadOnlyProbeSnapshot {
    const checkedAt = this.now().toISOString();
    const health: ZavorthExternalSidecarHealthRecord[] = [
      { sourceRuntimeId: 'reference-runtime-a', status: 'healthy', checkedAt, details: `${mode}: gateway metadata readable.` },
      { sourceRuntimeId: 'reference-runtime-b', status: 'degraded', checkedAt, details: `${mode}: worker queue metadata partially readable.` },
    ];
    const channels: ZavorthExternalSidecarChannelRecord[] = [
      {
        id: 'telegram-fixture',
        sourceRuntimeId: 'reference-runtime-a',
        kind: 'telegram',
        inboundSupported: true,
        outboundSupported: true,
        credentialBoundary: 'external-port',
      },
      {
        id: 'discord-fixture',
        sourceRuntimeId: 'reference-runtime-b',
        kind: 'discord',
        inboundSupported: true,
        outboundSupported: true,
        credentialBoundary: 'external-port',
      },
    ];
    const skills: ZavorthExternalSidecarSkillRecord[] = [
      {
        id: 'skill-error-recovery-fixture',
        sourceRuntimeId: 'reference-runtime-a',
        name: 'Error recovery routine',
        description: 'Advisory source skill for classifying operational failures.',
        mutationAllowed: false,
        importDecision: 'absorb',
      },
      {
        id: 'skill-channel-routing-fixture',
        sourceRuntimeId: 'reference-runtime-b',
        name: 'Channel routing routine',
        description: 'Advisory source skill for mapping chat events into sessions.',
        mutationAllowed: false,
        importDecision: 'adapt',
      },
    ];
    const tools: ZavorthExternalSidecarToolRecord[] = [
      {
        id: 'tool-message-send-fixture',
        sourceRuntimeId: 'reference-runtime-a',
        name: 'message.send',
        risk: 'medium',
        exposedDirectly: false,
        requiredGate: 'approval-proposal',
      },
      {
        id: 'tool-worker-launch-fixture',
        sourceRuntimeId: 'reference-runtime-b',
        name: 'worker.launch',
        risk: 'high',
        exposedDirectly: false,
        requiredGate: 'approval-proposal',
      },
    ];
    const sessions: ZavorthExternalSidecarSessionRecord[] = [
      {
        id: 'session-fixture-001',
        sourceRuntimeId: 'reference-runtime-a',
        channelId: 'telegram-fixture',
        status: 'active',
        mappedToZavorthSession: 'zavorth-session-fixture-001',
      },
      {
        id: 'session-fixture-002',
        sourceRuntimeId: 'reference-runtime-b',
        channelId: 'discord-fixture',
        status: 'idle',
        mappedToZavorthSession: 'zavorth-session-fixture-002',
      },
    ];
    const events: ZavorthExternalSidecarEventRecord[] = [
      {
        id: 'evt-fixture-001',
        sourceRuntimeId: 'reference-runtime-a',
        channelId: 'telegram-fixture',
        sessionId: 'session-fixture-001',
        direction: 'inbound',
        eventType: 'message',
        observedAt: checkedAt,
        textPreview: 'analise esse repo e prepare um plano governado',
      },
      {
        id: 'evt-fixture-002',
        sourceRuntimeId: 'reference-runtime-b',
        channelId: 'discord-fixture',
        sessionId: 'session-fixture-002',
        direction: 'outbound',
        eventType: 'message',
        observedAt: checkedAt,
        textPreview: 'dry-run reply candidate',
      },
    ];
    const workers: ZavorthExternalSidecarWorkerHealthRecord[] = [
      {
        id: 'worker-reader-fixture',
        sourceRuntimeId: 'reference-runtime-a',
        role: 'reader',
        health: 'ready',
        directExecutionAllowed: false,
      },
      {
        id: 'worker-runner-fixture',
        sourceRuntimeId: 'reference-runtime-b',
        role: 'runner',
        health: 'blocked',
        directExecutionAllowed: false,
      },
    ];
    const capabilities: ZavorthExternalSidecarCapabilityRecord[] = [
      ...skills.map((entry) => ({
        id: `capability.${entry.id}`,
        sourceRuntimeId: entry.sourceRuntimeId,
        name: entry.name,
        kind: 'skill' as const,
        risk: entry.importDecision === 'absorb' ? 'medium' as const : 'low' as const,
        availability: 'available' as const,
        zavorthEquivalent: entry.importDecision === 'absorb'
          ? 'ZavorthNativeEngineAbsorptionService'
          : 'ZavorthExternalSidecarAdapterService',
      })),
      ...tools.map((entry) => ({
        id: `capability.${entry.id}`,
        sourceRuntimeId: entry.sourceRuntimeId,
        name: entry.name,
        kind: 'tool' as const,
        risk: entry.risk,
        availability: 'degraded' as const,
        zavorthEquivalent: entry.requiredGate,
      })),
    ];

    return {
      mode,
      status: 'probe-ready',
      sourceRefs: DEFAULT_SOURCE_REFS,
      health,
      capabilities,
      channels,
      skills,
      tools,
      sessions,
      events,
      workers,
      summary: {
        sourceRuntimes: DEFAULT_SOURCE_REFS.length,
        healthRecords: health.length,
        capabilities: capabilities.length,
        channels: channels.length,
        skills: skills.length,
        tools: tools.length,
        sessions: sessions.length,
        events: events.length,
        workers: workers.length,
      },
      safety: {
        readOnly: true,
        fixtureAllowed: true,
        liveReadOnlyRequiresExplicitMode: true,
        noSourceRuntimeCodeExecuted: true,
        noSidecarStarted: true,
        noOutboundIo: true,
      },
    };
  }

  public normalizeInboundEvent(
    event: ZavorthExternalSidecarInboundEventInput,
  ): ZavorthExternalSidecarInboundGatewayReceipt {
    const text = String(event.text || '').trim();
    if (!event.sourceEventId || !event.sourceRuntimeId || !event.channelId || !event.sessionId || !text) {
      return {
        status: 'blocked',
        sourceEventId: event.sourceEventId || 'missing-source-event',
        gatewayEntrypoint: 'ZavorthAgentGateway',
        replyExit: 'ReplyPipeline',
        naturalFirstRoute: 'llm-reply',
        gatewayPacket: {
          adapterSource: 'external-sidecar-adapter',
          messageText: text,
          sourceRuntimeId: event.sourceRuntimeId || 'missing-source-runtime',
          channelId: event.channelId || 'missing-channel',
          sessionId: event.sessionId || 'missing-session',
          authorRef: event.authorRef || 'unknown-author',
          attachments: event.attachments || [],
        },
        safety: inboundSafety(),
      };
    }

    return {
      status: 'routed-to-gateway',
      sourceEventId: event.sourceEventId,
      gatewayEntrypoint: 'ZavorthAgentGateway',
      replyExit: 'ReplyPipeline',
      naturalFirstRoute: inferNaturalFirstRoute(text),
      gatewayPacket: {
        adapterSource: 'external-sidecar-adapter',
        messageText: text,
        sourceRuntimeId: event.sourceRuntimeId,
        channelId: event.channelId,
        sessionId: event.sessionId,
        authorRef: event.authorRef || 'unknown-author',
        attachments: event.attachments || [],
      },
      safety: inboundSafety(),
    };
  }

  public evaluateOutboundDryRun(
    input: ZavorthExternalSidecarOutboundDryRunInput,
  ): ZavorthExternalSidecarOutboundDryRunReceipt {
    const approvalGranted = input.approvalGranted === true;
    const approvalRequired = input.risk === 'high'
      || input.risk === 'critical'
      || input.kind === 'worker-launch'
      || input.kind === 'approval-decision';
    const allowed = !approvalRequired || approvalGranted;
    const policyDecision = allowed ? 'dry-run-allowed' : 'blocked';

    return {
      actionId: input.actionId,
      kind: input.kind,
      replyExit: 'ReplyPipeline',
      policyDecision,
      approvalRequired,
      approvalGranted,
      risk: input.risk,
      reason: allowed
        ? 'Action passed dry-run policy evaluation; live IO remains disabled until a Zavorth execution path takes over.'
        : 'Risky outbound action blocked because a Zavorth approval envelope was not granted.',
      nextSafeAction: allowed
        ? 'Keep the action inside ReplyPipeline or governed execution before live send.'
        : 'Open an approval proposal and keep the sidecar adapter in dry-run mode.',
      safety: {
        dryRunOnly: true,
        liveIoPerformed: false,
        replyPipelineRequired: true,
        noToolExecution: true,
        noWorkerLaunch: true,
        noApprovalBypass: true,
      },
    };
  }

  public buildCommandCenterProjection(input: {
    status: ZavorthExternalSidecarAdapterStatus;
    readOnlyProbe: ZavorthExternalSidecarReadOnlyProbeSnapshot;
    inboundGatewayReceipt: ZavorthExternalSidecarInboundGatewayReceipt;
    outboundDryRunReceipt: ZavorthExternalSidecarOutboundDryRunReceipt;
    riskyOutboundDryRunReceipt: ZavorthExternalSidecarOutboundDryRunReceipt;
  }): ZavorthExternalSidecarCommandCenterProjection {
    return {
      title: 'External Sidecar Adapter',
      status: input.status,
      tone: input.status === 'sidecar-adapter-ready' ? 'ready' : input.status === 'attention' ? 'attention' : 'blocked',
      cards: [
        card('health', 'Health', String(input.readOnlyProbe.summary.healthRecords), `${input.readOnlyProbe.summary.sourceRuntimes} source runtime(s) observed read-only`),
        card('channels', 'Channels', String(input.readOnlyProbe.summary.channels), 'Source channels mapped as Zavorth channels'),
        card('capabilities', 'Capabilities', String(input.readOnlyProbe.summary.capabilities), 'Skills and tools shown as governed capabilities'),
        card('sessions', 'Sessions', String(input.readOnlyProbe.summary.sessions), 'External sessions mapped to Zavorth session refs'),
        card('workers', 'Workers', String(input.readOnlyProbe.summary.workers), 'Worker health visible, direct execution blocked'),
        card('inbound', 'Inbound', input.inboundGatewayReceipt.status, `Route: ${input.inboundGatewayReceipt.naturalFirstRoute}`),
        card('outbound', 'Outbound Dry Run', input.outboundDryRunReceipt.policyDecision, 'Live sends remain behind ReplyPipeline'),
        card('risky', 'Risky Outbound', input.riskyOutboundDryRunReceipt.policyDecision, 'Approval required before risky continuation'),
      ],
      policyPills: [
        'read-only probe',
        'ZavorthAgentGateway inbound',
        'ReplyPipeline outbound',
        'approval-gated risk',
        'no sidecar execution',
      ],
      nextSafeAction: input.status === 'sidecar-adapter-ready'
        ? 'Proceed to 291 Phase 4 - Capability Providers.'
        : 'Fix failed adapter acceptance gates before continuing.',
    };
  }

  public formatSnapshotText(snapshot: ZavorthExternalSidecarAdapterSnapshot): string {
    const lines = [
      'Zavorth External Sidecar Adapter - Phase 3',
      '',
      `Status: ${snapshot.status}`,
      `Previous native engine: ${snapshot.previousNativeEngineStatus}`,
      `Probe mode: ${snapshot.readOnlyProbe.mode}`,
      `Channels: ${snapshot.summary.sourceChannelsListed}`,
      `Skills: ${snapshot.summary.sourceSkillsListed}`,
      `Tools: ${snapshot.summary.sourceToolsListed}`,
      `Sessions: ${snapshot.summary.sourceSessionsListed}`,
      `Worker health records: ${snapshot.summary.workerHealthRecordsListed}`,
      `Inbound routed to gateway: ${snapshot.summary.inboundEventsRoutedToGateway}`,
      `Outbound dry-runs evaluated: ${snapshot.summary.outboundDryRunsEvaluated}`,
      `Risky outbound blocked: ${snapshot.summary.riskyOutboundActionsBlocked}`,
      `Sidecars started: ${snapshot.safety.sidecarsStarted}`,
      `Live IO performed: ${snapshot.safety.outboundIoPerformed}`,
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

function sourceRef(sourceRuntimeId: string, sourceRuntimeLabel: string): ZavorthExternalSidecarSourceRef {
  return {
    sourceRuntimeId,
    sourceRuntimeLabel,
    diagnosticsOnly: true,
    publicName: 'Zavorth',
  };
}

function buildAcceptanceMatrix(
  previousNativeEngineStatus: ZavorthNativeEngineAbsorptionStatus,
  readOnlyProbe: ZavorthExternalSidecarReadOnlyProbeSnapshot,
  inboundGatewayReceipt: ZavorthExternalSidecarInboundGatewayReceipt,
  outboundDryRunReceipt: ZavorthExternalSidecarOutboundDryRunReceipt,
  riskyOutboundDryRunReceipt: ZavorthExternalSidecarOutboundDryRunReceipt,
): ZavorthExternalSidecarAdapterSnapshot['acceptanceMatrix'] {
  return [
    acceptance('phase-2-native-engine-ready', previousNativeEngineStatus === 'native-engine-ready', `previousNativeEngineStatus=${previousNativeEngineStatus}`),
    acceptance('read-only-probe-lists-source-surfaces', readOnlyProbe.summary.channels > 0
      && readOnlyProbe.summary.skills > 0
      && readOnlyProbe.summary.tools > 0
      && readOnlyProbe.summary.sessions > 0
      && readOnlyProbe.summary.workers > 0, `${readOnlyProbe.summary.channels} channel(s), ${readOnlyProbe.summary.skills} skill(s), ${readOnlyProbe.summary.tools} tool(s), ${readOnlyProbe.summary.sessions} session(s), ${readOnlyProbe.summary.workers} worker(s)`),
    acceptance('inbound-event-enters-zavorth-agent-gateway', inboundGatewayReceipt.status === 'routed-to-gateway'
      && inboundGatewayReceipt.gatewayEntrypoint === 'ZavorthAgentGateway'
      && inboundGatewayReceipt.safety.directReplyBlocked, `${inboundGatewayReceipt.status}, route=${inboundGatewayReceipt.naturalFirstRoute}`),
    acceptance('outbound-action-evaluated-by-policy-dry-run', outboundDryRunReceipt.policyDecision === 'dry-run-allowed'
      && outboundDryRunReceipt.safety.dryRunOnly
      && !outboundDryRunReceipt.safety.liveIoPerformed, `${outboundDryRunReceipt.policyDecision}, liveIo=${outboundDryRunReceipt.safety.liveIoPerformed}`),
    acceptance('risky-outbound-blocks-without-approval', riskyOutboundDryRunReceipt.policyDecision === 'blocked'
      && riskyOutboundDryRunReceipt.approvalRequired
      && !riskyOutboundDryRunReceipt.approvalGranted, `${riskyOutboundDryRunReceipt.policyDecision}, approvalRequired=${riskyOutboundDryRunReceipt.approvalRequired}`),
    acceptance('no-sidecar-or-live-io', readOnlyProbe.safety.noSidecarStarted
      && readOnlyProbe.safety.noSourceRuntimeCodeExecuted
      && readOnlyProbe.safety.noOutboundIo
      && !outboundDryRunReceipt.safety.liveIoPerformed
      && !riskyOutboundDryRunReceipt.safety.liveIoPerformed, 'probe and outbound gates are dry-run/read-only'),
  ];
}

function acceptance(
  requirementId: string,
  passed: boolean,
  evidence: string,
): ZavorthExternalSidecarAdapterSnapshot['acceptanceMatrix'][number] {
  return {
    requirementId,
    status: passed ? 'passed' : 'failed',
    evidence,
  };
}

function resolveStatus(
  previousNativeEngineStatus: ZavorthNativeEngineAbsorptionStatus,
  acceptanceMatrix: ZavorthExternalSidecarAdapterSnapshot['acceptanceMatrix'],
): ZavorthExternalSidecarAdapterStatus {
  if (previousNativeEngineStatus !== 'native-engine-ready') {
    return 'blocked';
  }
  if (acceptanceMatrix.some((entry) => entry.status === 'failed')) {
    return 'blocked';
  }
  return 'sidecar-adapter-ready';
}

function inferNaturalFirstRoute(text: string): ZavorthExternalRuntimeNaturalFirstRoute {
  if (/\b(como resolvemos|mem[oó]ria|lembra|continue de onde)\b/i.test(text)) {
    return 'memory-recall';
  }
  if (/\b(conecta|telegram|discord|canal|habilidade|capability|skill)\b/i.test(text)) {
    return 'capability-discovery';
  }
  if (/\b(rm\s+-rf|apague|delete|push|Remove-Item|DROP\s+DATABASE)\b/i.test(text)) {
    return 'approval-proposal';
  }
  if (/\b(rode|execute|npm\s+test|pytest|comando|tool)\b/i.test(text)) {
    return 'tool-preview';
  }
  if (/\b(analise|implemente|fa[cç]a|corrija|repo|documenta)\b/i.test(text)) {
    return 'governed-execution';
  }
  if (/^(oi|ol[aá]|valeu|obrigad[oa]|ok)\b/i.test(text)) {
    return 'light-chat';
  }
  return 'llm-reply';
}

function inboundSafety(): ZavorthExternalSidecarInboundGatewayReceipt['safety'] {
  return {
    directReplyBlocked: true,
    replyPipelineRequired: true,
    sourceRuntimeCodeExecuted: false,
    toolExecutionPerformed: false,
  };
}

function card(
  id: string,
  label: string,
  value: string,
  detail: string,
): ZavorthExternalSidecarCommandCenterProjection['cards'][number] {
  return { id, label, value, detail };
}
