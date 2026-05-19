import {
  ZAVORTH_EXTERNAL_RUNTIME_BRIDGE_CONTRACT_VERSION,
  type ZavorthExternalRuntimeBridgeSnapshot,
  type ZavorthExternalRuntimeBridgeStatus,
  type ZavorthExternalRuntimeCandidate,
  type ZavorthExternalRuntimeCapabilityId,
  type ZavorthExternalRuntimeDecision,
  type ZavorthExternalRuntimeSourceRuntimeDescriptor,
} from '../contracts/ZavorthExternalRuntimeBridgeContract.js';

type Runtime = {
  now?: () => Date;
  naturalFirstPackStatus?: string;
};

type BridgeSnapshotInput = {
  naturalFirstPackStatus?: string | null;
};

const SURFACES: Array<'web' | 'cli' | 'telegram' | 'api'> = ['web', 'cli', 'telegram', 'api'];

const SOURCE_RUNTIMES: ZavorthExternalRuntimeSourceRuntimeDescriptor[] = [
  {
    id: 'reference-runtime',
    label: 'Architecture reference runtime fixture',
    role: 'architecture-reference',
    quarantine: {
      diagnosticsOnly: true,
      publicIdentityAllowed: false,
      sourceNamesAreCanonical: false,
      credentialsStayBehindPorts: true,
    },
    allowedReadSurface: [
      'read-only capability inventory',
      'architecture reference notes',
      'fixture-only behavior samples',
    ],
    blockedByDefault: [
      'source worker launch',
      'source skill mutation',
      'source direct messaging',
      'source tool execution',
    ],
  },
  {
    id: 'acp-compatible-sidecar',
    label: 'ACP-compatible sidecar fixture',
    role: 'optional-compatibility-fixture',
    quarantine: {
      diagnosticsOnly: true,
      publicIdentityAllowed: false,
      sourceNamesAreCanonical: false,
      credentialsStayBehindPorts: true,
    },
    allowedReadSurface: [
      'read-only channel descriptor inventory',
      'gateway/session/event fixture mapping',
      'sidecar health probe dry-run',
    ],
    blockedByDefault: [
      'live outbound messages',
      'live worker dispatch',
      'credential export',
      'external reply bypass',
    ],
  },
];

const BRIDGE_CANDIDATES: ZavorthExternalRuntimeCandidate[] = [
  candidate({
    id: 'external-capability-inventory',
    label: 'External Capability Inventory',
    sourceRuntimeIds: ['reference-runtime', 'acp-compatible-sidecar'],
    sourcePattern: 'catalog capabilities, tools, channels, workers, sessions, health, and policies as provider-agnostic evidence only',
    decision: 'adapt',
    phase: 'inventory',
    priority: 1,
    naturalFirstRoute: 'capability-discovery',
    contract: 'ZavorthExternalCapabilityInventoryContract',
    service: 'ZavorthExternalCapabilityInventoryService',
    projection: 'CommandCenterExternalCapabilityInventory',
    approvalRequiredForLive: false,
    noAutonomousSkillMutation: true,
    gates: [
      'inventory is read-only',
      'source runtime names stay in diagnostics',
      'no capability is exposed as a tool before Zavorth normalization',
    ],
    nextPack: '293 - Zavorth External Capability Inventory',
  }),
  candidate({
    id: 'external-runtime-readonly-probe',
    label: 'External Runtime Read-Only Probe',
    sourceRuntimeIds: ['reference-runtime', 'acp-compatible-sidecar'],
    sourcePattern: 'health, version, channel/session summaries, and degraded state probes',
    decision: 'externalize',
    phase: 'sidecar-adapter',
    priority: 2,
    naturalFirstRoute: 'capability-discovery',
    contract: 'ZavorthExternalRuntimeReadOnlyProbeContract',
    service: 'ZavorthExternalRuntimeReadOnlyProbeService',
    projection: 'CommandCenterExternalRuntimeProbe',
    approvalRequiredForLive: false,
    noAutonomousSkillMutation: true,
    gates: [
      'fixture probe before live read-only probe',
      'no sidecar start in bridge phase',
      'unavailable runtimes fail honestly',
    ],
    nextPack: '294 - Zavorth External Runtime Read-Only Probe',
  }),
  candidate({
    id: 'error-classifier',
    label: 'Zavorth Error Classifier',
    sourceRuntimeIds: ['reference-runtime'],
    sourcePattern: 'classify provider, terminal, permission, context, billing, rate-limit, and syntax failures',
    decision: 'absorb',
    phase: 'native-engine',
    priority: 3,
    naturalFirstRoute: 'governed-execution',
    contract: 'ZavorthErrorClassifierContract',
    service: 'ZavorthErrorClassifierService',
    projection: 'CommandCenterErrorRecoveryStrategy',
    approvalRequiredForLive: false,
    noAutonomousSkillMutation: true,
    gates: [
      'native Zavorth error taxonomy',
      'no retry loop without budget policy',
      'recovery strategy emits receipts',
    ],
    nextPack: '295 - Zavorth Error Classifier',
  }),
  candidate({
    id: 'tool-call-repair',
    label: 'Zavorth Tool Call Repair',
    sourceRuntimeIds: ['reference-runtime'],
    sourcePattern: 'repair malformed JSON/tool arguments before tool preview or approval',
    decision: 'absorb',
    phase: 'native-engine',
    priority: 4,
    naturalFirstRoute: 'tool-preview',
    contract: 'ZavorthToolCallRepairContract',
    service: 'ZavorthToolCallRepairService',
    projection: 'CommandCenterToolCallRepairReceipt',
    approvalRequiredForLive: false,
    noAutonomousSkillMutation: true,
    gates: [
      'repair is parse-first, not string-only',
      'repair cannot add missing authority',
      'dangerous repaired calls still require approval',
    ],
    nextPack: '296 - Zavorth Tool Call Repair',
  }),
  candidate({
    id: 'safe-tool-parallelism',
    label: 'Zavorth Safe Tool Parallelism',
    sourceRuntimeIds: ['reference-runtime'],
    sourcePattern: 'parallelize tool batches only when resource/write sets do not conflict',
    decision: 'absorb',
    phase: 'native-engine',
    priority: 5,
    naturalFirstRoute: 'governed-execution',
    contract: 'ZavorthSafeToolParallelismContract',
    service: 'ZavorthSafeToolParallelismService',
    projection: 'CommandCenterSafeParallelismPlan',
    approvalRequiredForLive: false,
    noAutonomousSkillMutation: true,
    gates: [
      'same file writes are serialized',
      'unknown resource sets are serialized',
      'parallel execution emits conflict receipts',
    ],
    nextPack: '297 - Zavorth Safe Tool Parallelism',
  }),
  candidate({
    id: 'procedural-memory',
    label: 'Procedural Memory',
    sourceRuntimeIds: ['reference-runtime'],
    sourcePattern: 'remember commands, failures, workarounds, and successful recovery paths',
    decision: 'absorb',
    phase: 'sessions-memory-continuation',
    priority: 6,
    naturalFirstRoute: 'memory-recall',
    contract: 'ZavorthProceduralMemoryContract',
    service: 'ZavorthProceduralMemoryService',
    projection: 'CommandCenterProceduralMemoryReceipts',
    approvalRequiredForLive: false,
    noAutonomousSkillMutation: true,
    gates: [
      'every memory has provenance',
      'forget/correct actions remain available',
      'no imported memory becomes authority without receipts',
    ],
    nextPack: '298 - Zavorth Procedural Memory',
  }),
  candidate({
    id: 'skill-curator',
    label: 'Zavorth Skill Curator',
    sourceRuntimeIds: ['reference-runtime'],
    sourcePattern: 'dedupe, merge, archive, pin, or propose skill changes with dry-run and rollback',
    decision: 'absorb',
    phase: 'native-engine',
    priority: 7,
    naturalFirstRoute: 'approval-proposal',
    contract: 'ZavorthSkillCuratorContract',
    service: 'ZavorthSkillCuratorService',
    projection: 'CommandCenterSkillCurationPlan',
    approvalRequiredForLive: true,
    noAutonomousSkillMutation: true,
    gates: [
      'dry-run diff before mutation',
      'snapshot and rollback required',
      'skill writes require Zavorth approval envelope',
    ],
    nextPack: '299 - Zavorth Skill Curator',
  }),
  candidate({
    id: 'channel-gateway-normalization',
    label: 'Channel Gateway Normalization',
    sourceRuntimeIds: ['acp-compatible-sidecar', 'reference-runtime'],
    sourcePattern: 'map external chat/channel events into NormalizedInboundMessage and ReplyPipeline',
    decision: 'adapt',
    phase: 'channels-messaging',
    priority: 8,
    naturalFirstRoute: 'capability-discovery',
    contract: 'ZavorthExternalChannelGatewayContract',
    service: 'ZavorthExternalChannelGatewayService',
    projection: 'CommandCenterExternalChannelGateway',
    approvalRequiredForLive: true,
    noAutonomousSkillMutation: true,
    gates: [
      'inbound events enter ZavorthAgentGateway',
      'outbound messages exit only through ReplyPipeline',
      'credentials stay behind ports',
    ],
    nextPack: '300 - Zavorth External Channel Gateway',
  }),
  candidate({
    id: 'delegated-workers',
    label: 'Delegated Workers',
    sourceRuntimeIds: ['acp-compatible-sidecar', 'reference-runtime'],
    sourcePattern: 'bounded sidecar/local worker tasks with timeout, cancel, and result mapping',
    decision: 'adapt',
    phase: 'delegated-workers',
    priority: 9,
    naturalFirstRoute: 'governed-execution',
    contract: 'ZavorthDelegatedWorkerBridgeContract',
    service: 'ZavorthDelegatedWorkerBridgeService',
    projection: 'CommandCenterDelegatedWorkerBridge',
    approvalRequiredForLive: true,
    noAutonomousSkillMutation: true,
    gates: [
      'worker dispatch is zavorth-gateway-delegated-only',
      'source worker launch is blocked until approval',
      'results return as Zavorth artifacts/events/status',
    ],
    nextPack: '301 - Zavorth Delegated Workers',
  }),
];

export class ZavorthExternalRuntimeBridgeService {
  private readonly now: () => Date;
  private readonly defaultNaturalFirstPackStatus: string;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultNaturalFirstPackStatus = runtime.naturalFirstPackStatus || 'checkpoint-9-complete';
  }

  public listCandidates(): ZavorthExternalRuntimeCandidate[] {
    return BRIDGE_CANDIDATES.map(clone);
  }

  public buildSnapshot(input: BridgeSnapshotInput = {}): ZavorthExternalRuntimeBridgeSnapshot {
    const naturalFirstPackStatus = String(input.naturalFirstPackStatus || this.defaultNaturalFirstPackStatus).trim();
    const naturalFirstClosed = naturalFirstPackStatus === 'checkpoint-9-complete' || naturalFirstPackStatus === 'checkpoint-10-complete';
    const candidates = this.listCandidates();
    const status = this.resolveStatus(naturalFirstClosed, candidates);
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_EXTERNAL_RUNTIME_BRIDGE_CONTRACT_VERSION,
      status,
      planId: 'Zavorth External Runtime Integration',
      naturalFirstPackStatus,
      externalRuntimes: SOURCE_RUNTIMES.map(clone),
      candidates,
      firstImplementationQueue: candidates
        .sort((left, right) => left.priority - right.priority)
        .map((entry) => entry.id),
      gatewayPolicy: {
        naturalFirstClosed,
        freeTextEntrypoint: 'ZavorthAgentGateway',
        allExternalInboundViaGateway: true,
        slashShortcutsPreserved: true,
        approvedSurfaces: SURFACES,
        noLlmDirectEntryForExternalRuntime: true,
        noExternalReplyBypass: true,
      },
      publicIdentityPolicy: {
        publicAgentName: 'Zavorth',
        externalRuntimeNamesQuarantinedToDiagnostics: true,
        noDefaultExternalRuntimeBranding: true,
        compatibilityFixturesAreOptional: true,
        noSourceRuntimeCanonicalFields: true,
        commandCenterMayShowAdapterDetailsOnly: true,
      },
      summary: buildSummary(candidates),
      nextActions: candidates.slice(0, 4).map((entry) => ({
        id: `next:${entry.id}`,
        label: entry.label,
        candidateId: entry.id,
        command: `npm run ${entry.nextPack.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}:check --silent`,
        requiresApproval: entry.safety.approvalRequiredForLive,
      })),
      policy: {
        zavorthRemainsOnlyKernel: true,
        acpSupportIsProviderAgnostic: true,
        noDefaultNamedCompatibilityBridge: true,
        noDefaultNamedExternalRuntime: true,
        externalRuntimeIsAdvisoryUntilNormalized: true,
        approvalEnvelopeRequiredForRiskyContinuation: true,
        importedMemoryRequiresProvenance: true,
        importedSkillMutationRequiresApproval: true,
        readOnlyProbeBeforeLiveSidecar: true,
        commandCenterProjectionRequired: true,
        noImplementationPerformedByBridge: true,
      },
      commands: {
        inspect: 'npm run zavorth:external-runtime-bridge',
        inspectJson: 'npm run zavorth:external-runtime-bridge:json',
        check: 'npm run zavorth:external-runtime-bridge:check --silent',
        nextStage: '291 Security contract - Freeze And Inventory',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthExternalRuntimeBridgeSnapshot): string {
    const lines = [
      'Zavorth External Runtime Bridge - Intent model0',
      '',
      `Status: ${snapshot.status}`,
      `Natural First: ${snapshot.naturalFirstPackStatus} | closed=${snapshot.gatewayPolicy.naturalFirstClosed}`,
      `Candidates: ${snapshot.summary.candidateCount} | absorb=${snapshot.summary.absorbCount} | adapt=${snapshot.summary.adaptCount} | externalize=${snapshot.summary.externalizeCount}`,
      `Execution performed: ${snapshot.summary.executionPerformed}`,
      `Source runtime code executed: ${snapshot.summary.sourceRuntimeCodeExecuted}`,
      '',
      'First implementation queue:',
    ];

    for (const candidateId of snapshot.firstImplementationQueue) {
      const candidateEntry = snapshot.candidates.find((entry) => entry.id === candidateId);
      if (!candidateEntry) {
        continue;
      }
      lines.push(
        `- ${candidateEntry.priority}. ${candidateEntry.label}: ${candidateEntry.decision} -> ${candidateEntry.phase} | route=${candidateEntry.naturalFirstRoute}`,
      );
    }

    lines.push('', 'Non-negotiables:');
    lines.push('- Zavorth remains the only kernel.');
    lines.push('- ACP support is provider-agnostic and has no default external runtime bridge.');
    lines.push('- Compatibility sidecars are optional fixtures/probes, never canonical product identity.');
    lines.push('- External runtimes are advisory until normalized into Zavorth contracts.');
    lines.push('- All inbound external events enter ZavorthAgentGateway.');
    lines.push('- All user-facing output exits through Zavorth ReplyPipeline.');
    lines.push('', `Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }

  private resolveStatus(
    naturalFirstClosed: boolean,
    candidates: ZavorthExternalRuntimeCandidate[],
  ): ZavorthExternalRuntimeBridgeStatus {
    if (!naturalFirstClosed) {
      return 'blocked';
    }
    const unsafe = candidates.some((entry) => (
      !entry.safety.dryRunFirst
      || !entry.safety.noSourceRuntimeCodeExecution
      || !entry.safety.noDirectToolExecution
      || !entry.safety.noDirectUserReply
      || entry.safety.gatewayEntry !== 'ZavorthAgentGateway'
    ));
    return unsafe ? 'blocked' : 'bridge-ready';
  }
}

function candidate(input: {
  id: ZavorthExternalRuntimeCapabilityId;
  label: string;
  sourceRuntimeIds: ZavorthExternalRuntimeCandidate['sourceRuntimeIds'];
  sourcePattern: string;
  decision: ZavorthExternalRuntimeDecision;
  phase: ZavorthExternalRuntimeCandidate['phase'];
  priority: number;
  naturalFirstRoute: ZavorthExternalRuntimeCandidate['naturalFirstRoute'];
  contract: string;
  service: string;
  projection: string;
  approvalRequiredForLive: boolean;
  noAutonomousSkillMutation: boolean;
  gates: string[];
  nextPack: string;
}): ZavorthExternalRuntimeCandidate {
  return {
    id: input.id,
    label: input.label,
    sourceRuntimeIds: input.sourceRuntimeIds,
    sourcePattern: input.sourcePattern,
    decision: input.decision,
    phase: input.phase,
    priority: input.priority,
    naturalFirstRoute: input.naturalFirstRoute,
    zavorthOwner: {
      contract: input.contract,
      service: input.service,
      commandCenterProjection: input.projection,
    },
    safety: {
      dryRunFirst: true,
      noSourceRuntimeCodeExecution: true,
      noDirectToolExecution: true,
      noDirectUserReply: true,
      noAutonomousSkillMutation: input.noAutonomousSkillMutation,
      approvalRequiredForLive: input.approvalRequiredForLive,
      gatewayEntry: 'ZavorthAgentGateway',
      replyExit: 'Zavorth ReplyPipeline',
      memoryOwner: 'Zavorth MemoryWithReceipts',
    },
    acceptanceGates: input.gates,
    nextPack: input.nextPack,
  };
}

function buildSummary(candidates: ZavorthExternalRuntimeCandidate[]): ZavorthExternalRuntimeBridgeSnapshot['summary'] {
  const count = (decision: ZavorthExternalRuntimeDecision) => candidates.filter((entry) => entry.decision === decision).length;
  return {
    candidateCount: candidates.length,
    absorbCount: count('absorb'),
    adaptCount: count('adapt'),
    externalizeCount: count('externalize'),
    replaceCount: count('replace'),
    rejectCount: count('reject'),
    approvalRequiredForLiveCount: candidates.filter((entry) => entry.safety.approvalRequiredForLive).length,
    dryRunOnlyCount: candidates.filter((entry) => entry.safety.dryRunFirst).length,
    executionPerformed: false,
    sourceRuntimeCodeExecuted: false,
    sidecarsStarted: false,
    toolsLaunched: false,
    filesMutated: false,
    userFacingSourceIdentityLeak: false,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
