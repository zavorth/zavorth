import {
  queryUniversalAgentRuns,
  type UniversalAgentRunObservatoryReceipt,
  type UniversalAgentRunObservatorySnapshot,
} from './RunObservatory.js';
import type {
  UniversalAgentRun,
  UniversalAgentRunStatus,
  UniversalArtifactSummary,
} from './UniversalAgentRuntimeTypes.js';

export const RUN_ARTIFACT_RECEIPT_REPLAY_CONTRACT_VERSION = '2026-05-04.receipt-replay' as const;

export type RunArtifactReceiptReplayStatus = 'ready' | 'partial' | 'empty' | 'blocked';

export type RunArtifactReceiptReplayFrameKind =
  | 'event'
  | 'approval'
  | 'artifact'
  | 'memory'
  | 'observatory-receipt'
  | 'feature-receipt'
  | 'feature-snapshot';

export type RunArtifactReceiptReplayReceiptStatus =
  | UniversalAgentRunStatus
  | 'pending'
  | 'running'
  | 'done'
  | 'failed'
  | 'ready'
  | 'partial'
  | 'missing'
  | 'blocked'
  | 'requires-action'
  | 'approved'
  | 'rejected'
  | 'draft'
  | 'unknown';

export type RunArtifactReceiptReplayFeatureId =
  | 'capability-negotiation'
  | 'tool-rehearsal'
  | 'selfing-zavorthControl'
  | 'artifact-memory'
  | 'personal-ops-autopilot'
  | 'agent-team-compiler'
  | 'cross-channel-continuity'
  | 'ask-before-assumption'
  | 'provider-mesh'
  | 'uni-trust'
  | 'memory-with-receipts'
  | 'provider-arena'
  | 'safety-narrative'
  | 'skill-mcp-quarantine'
  | 'universal-preview'
  | 'capability-loop';

export type RunArtifactReceiptReplayFeatureCoverage = {
  featureId: RunArtifactReceiptReplayFeatureId;
  metadataKey: string;
  label: string;
  present: boolean;
  contractVersion: string | null;
  status: string | null;
  receiptCount: number;
  frameCount: number;
  source: string | null;
};

export type RunArtifactReceiptReplayFrame = {
  id: string;
  order: number;
  kind: RunArtifactReceiptReplayFrameKind;
  source: string;
  title: string;
  detail: string;
  status: RunArtifactReceiptReplayReceiptStatus;
  createdAt: string;
  runId: string;
  traceId: string;
  sessionId: string;
  receiptId: string | null;
  artifactId: string | null;
  featureId: RunArtifactReceiptReplayFeatureId | null;
  metadataKeys: string[];
};

export type RunArtifactReceiptReplayArtifactLink = {
  artifactId: string;
  title: string;
  kind: UniversalArtifactSummary['kind'] | 'run-summary';
  status: UniversalArtifactSummary['status'] | 'ready';
  createdAt: string;
  runId: string;
  traceId: string;
  sessionId: string;
  category: string;
  replayFrameId: string;
  observatoryReceiptId: string | null;
  memoryReceiptId: string | null;
  commands: {
    openCommand: string;
    replayCommand: string;
    citeCommand: string;
  };
};

export type RunArtifactReceiptReplayReceiptLink = {
  id: string;
  kind: string;
  source: string;
  featureId: RunArtifactReceiptReplayFeatureId | null;
  title: string;
  detail: string;
  status: RunArtifactReceiptReplayReceiptStatus;
  createdAt: string;
  runId: string;
  traceId: string;
  sessionId: string;
  artifactId: string | null;
  frameId: string | null;
};

export type RunArtifactReceiptReplaySnapshot = {
  contractVersion: typeof RUN_ARTIFACT_RECEIPT_REPLAY_CONTRACT_VERSION;
  source: 'RunArtifactReceiptReplayService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: RunArtifactReceiptReplayStatus;
  summary: {
    runCount: number;
    frameCount: number;
    artifactCount: number;
    artifactLinkCount: number;
    observatoryReceiptCount: number;
    featureReceiptCount: number;
    memoryReceiptCount: number;
    coveredFeatureCount: number;
    missingFeatureCount: number;
    replayAnchorCount: number;
    replayable: boolean;
    runObservatoryLinked: boolean;
    artifactMemoryLinked: boolean;
    memoryWithReceiptsLinked: boolean;
  };
  observatory: {
    contractVersion: string;
    replayAvailable: boolean;
    receiptCount: number;
    timelineCount: number;
    healthStatus: string;
    nextSafeAction: string;
  };
  features: RunArtifactReceiptReplayFeatureCoverage[];
  frames: RunArtifactReceiptReplayFrame[];
  artifactLinks: RunArtifactReceiptReplayArtifactLink[];
  receiptLinks: RunArtifactReceiptReplayReceiptLink[];
  replay: {
    available: boolean;
    anchors: Array<{
      id: string;
      frameId: string;
      kind: RunArtifactReceiptReplayFrameKind;
      label: string;
      status: RunArtifactReceiptReplayReceiptStatus;
      createdAt: string;
    }>;
    commandHints: string[];
    summary: string;
  };
  policy: {
    noToolExecutedByReplay: true;
    noFilesystemReadPerformed: true;
    noArtifactContentInvented: true;
    noArtifactMutation: true;
    replayUsesReceiptsOnly: true;
    artifactsMustCiteOrigin: true;
    naturalLanguageDoesNotBypassPolicy: true;
    secretsSerialized: false;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
    replayHint: string;
    receiptHint: string;
  };
  nextSafeAction: string;
};

export type RunArtifactReceiptReplayInput = {
  run: UniversalAgentRun;
  relatedRuns?: UniversalAgentRun[] | null;
  generatedAt?: string | null;
};

type LooseRecord = Record<string, unknown>;

const FEATURE_DEFINITIONS: Array<{
  featureId: RunArtifactReceiptReplayFeatureId;
  metadataKey: string;
  label: string;
}> = [
  { featureId: 'capability-negotiation', metadataKey: 'capabilityNegotiation', label: 'Capability Negotiation' },
  { featureId: 'tool-rehearsal', metadataKey: 'toolRehearsal', label: 'Tool Rehearsal' },
  { featureId: 'selfing-zavorthControl', metadataKey: 'selfingZavorthControl', label: 'Selfing ZavorthControl' },
  { featureId: 'artifact-memory', metadataKey: 'artifactMemory', label: 'Artifact Memory' },
  { featureId: 'personal-ops-autopilot', metadataKey: 'personalOpsAutopilot', label: 'Personal Ops Autopilot' },
  { featureId: 'agent-team-compiler', metadataKey: 'agentTeamCompiler', label: 'Agent Team Compiler' },
  { featureId: 'cross-channel-continuity', metadataKey: 'crossChannelContinuity', label: 'Cross-Channel Continuity' },
  { featureId: 'ask-before-assumption', metadataKey: 'askBeforeAssumptionPolicy', label: 'Ask Before Assumption' },
  { featureId: 'provider-mesh', metadataKey: 'providerMeshConsolidation', label: 'Provider Mesh' },
  { featureId: 'uni-trust', metadataKey: 'universalIntentTrustEnforcement', label: 'UNI / Trust' },
  { featureId: 'memory-with-receipts', metadataKey: 'memoryWithReceipts', label: 'Memory With Receipts' },
  { featureId: 'provider-arena', metadataKey: 'providerArena', label: 'Provider Arena' },
  { featureId: 'safety-narrative', metadataKey: 'safetyNarrative', label: 'Safety Narrative' },
  { featureId: 'skill-mcp-quarantine', metadataKey: 'skillMcpQuarantine', label: 'Skill/MCP Quarantine' },
  { featureId: 'universal-preview', metadataKey: 'universalPreviewMode', label: 'Universal Preview' },
  { featureId: 'capability-loop', metadataKey: 'capabilityLoopGovernance', label: 'Capability Loop' },
];

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeKey(value: unknown, fallback = 'item'): string {
  return normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

function recordOrNull(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LooseRecord
    : null;
}

function listRecords(value: unknown): LooseRecord[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
      const record = recordOrNull(entry);
      return record ? [record] : [];
    })
    : [];
}

function redactText(value: unknown, fallback = '', maxLength = 260): string {
  const text = normalizeText(value, fallback)
    .replace(/((?:api[_-]?key|token|secret|password)\s*[:=]\s*)\S+/gi, '$1[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function normalizeStatus(value: unknown, fallback: RunArtifactReceiptReplayReceiptStatus = 'unknown'): RunArtifactReceiptReplayReceiptStatus {
  const raw = normalizeText(value).toLowerCase();
  const allowed: RunArtifactReceiptReplayReceiptStatus[] = [
    'queued',
    'thinking',
    'running',
    'waiting_approval',
    'completed',
    'failed',
    'cancelled',
    'pending',
    'done',
    'ready',
    'partial',
    'missing',
    'blocked',
    'requires-action',
    'approved',
    'rejected',
    'draft',
    'unknown',
  ];
  return allowed.includes(raw as RunArtifactReceiptReplayReceiptStatus)
    ? raw as RunArtifactReceiptReplayReceiptStatus
    : fallback;
}

function metadataKeys(value: unknown): string[] {
  const record = recordOrNull(value);
  return record ? Object.keys(record).sort().slice(0, 18) : [];
}

function artifactKind(value: unknown): UniversalArtifactSummary['kind'] {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'file' || raw === 'report' || raw === 'diff' || raw === 'log' || raw === 'plan' || raw === 'handoff') {
    return raw;
  }
  return 'file';
}

function artifactStatus(value: unknown): UniversalArtifactSummary['status'] | 'ready' {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'draft' || raw === 'ready' || raw === 'failed') {
    return raw;
  }
  return 'ready';
}

export class RunArtifactReceiptReplayService {
  private readonly now: () => Date;

  constructor(runtime: { now?: () => Date } = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: RunArtifactReceiptReplayInput): RunArtifactReceiptReplaySnapshot {
    const { run } = input;
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const runs = this.resolveRuns(input);
    const observatory = queryUniversalAgentRuns({
      runs,
      query: {
        runId: run.id,
        limit: runs.length || 1,
      },
      generatedAt,
    });
    const featureCoverage = this.buildFeatureCoverage(run);
    const receiptLinks = [
      ...this.receiptsFromObservatory(observatory),
      ...this.receiptsFromFeatures(run, featureCoverage, generatedAt),
    ];
    const frames = this.buildFrames(run, observatory, featureCoverage, receiptLinks, generatedAt);
    const artifactLinks = this.buildArtifactLinks(run, frames);
    const replay = this.buildReplay(frames, artifactLinks, receiptLinks);
    const status = this.resolveStatus(frames, artifactLinks, featureCoverage, replay.available);
    const coveredFeatureCount = featureCoverage.filter((feature) => feature.present).length;
    const missingFeatureCount = featureCoverage.length - coveredFeatureCount;
    const featureReceiptCount = receiptLinks.filter((receipt) => receipt.featureId).length;
    const memoryReceiptCount = receiptLinks.filter((receipt) => receipt.featureId === 'memory-with-receipts').length;

    return {
      contractVersion: RUN_ARTIFACT_RECEIPT_REPLAY_CONTRACT_VERSION,
      source: 'RunArtifactReceiptReplayService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
      },
      status,
      summary: {
        runCount: observatory.matchedRuns || runs.length,
        frameCount: frames.length,
        artifactCount: run.artifacts.length,
        artifactLinkCount: artifactLinks.length,
        observatoryReceiptCount: observatory.receipts.length,
        featureReceiptCount,
        memoryReceiptCount,
        coveredFeatureCount,
        missingFeatureCount,
        replayAnchorCount: replay.anchors.length,
        replayable: replay.available,
        runObservatoryLinked: observatory.receipts.length > 0,
        artifactMemoryLinked: featureCoverage.some((feature) => feature.featureId === 'artifact-memory' && feature.present),
        memoryWithReceiptsLinked: featureCoverage.some((feature) => feature.featureId === 'memory-with-receipts' && feature.present),
      },
      observatory: {
        contractVersion: observatory.contractVersion,
        replayAvailable: observatory.replay.available,
        receiptCount: observatory.receipts.length,
        timelineCount: observatory.timeline.length,
        healthStatus: observatory.health.status,
        nextSafeAction: observatory.health.nextSafeAction,
      },
      features: featureCoverage,
      frames,
      artifactLinks,
      receiptLinks,
      replay,
      policy: {
        noToolExecutedByReplay: true,
        noFilesystemReadPerformed: true,
        noArtifactContentInvented: true,
        noArtifactMutation: true,
        replayUsesReceiptsOnly: true,
        artifactsMustCiteOrigin: true,
        naturalLanguageDoesNotBypassPolicy: true,
        secretsSerialized: false,
      },
      surface: {
        cliCommand: `zavorth replay run ${run.id} --json`,
        zavorthControlPath: `/zavorthControl...runId=${encodeURIComponent(run.id)}`,
        replayHint: 'Replay uses events, artifacts, and receipts; it does not re-execute tools.',
        receiptHint: 'Receipts citam origem de feature, artifact e observatory before reutilizar.',
      },
      nextSafeAction: this.resolveNextSafeAction(status, replay.available, missingFeatureCount),
    };
  }

  private resolveRuns(input: RunArtifactReceiptReplayInput): UniversalAgentRun[] {
    const related = Array.isArray(input.relatedRuns) ? input.relatedRuns : [];
    const byId = new Map<string, UniversalAgentRun>();
    for (const run of [input.run, ...related]) {
      byId.set(run.id, run);
    }
    return Array.from(byId.values());
  }

  private buildFeatureCoverage(run: UniversalAgentRun): RunArtifactReceiptReplayFeatureCoverage[] {
    return FEATURE_DEFINITIONS.map((definition) => {
      const raw = recordOrNull(run.metadata[definition.metadataKey]);
      const receipts = listRecords(raw?.receipts);
      const status = normalizeText(raw?.status)
        || normalizeText(recordOrNull(raw?.summary)?.status)
        || null;
      return {
        featureId: definition.featureId,
        metadataKey: definition.metadataKey,
        label: definition.label,
        present: Boolean(raw),
        contractVersion: normalizeText(raw?.contractVersion) || null,
        status,
        receiptCount: receipts.length,
        frameCount: raw ? Math.max(1, receipts.length) : 0,
        source: normalizeText(raw?.source, definition.label) || null,
      };
    });
  }

  private receiptsFromObservatory(observatory: UniversalAgentRunObservatorySnapshot): RunArtifactReceiptReplayReceiptLink[] {
    return observatory.receipts.map((receipt) => ({
      id: receipt.id,
      kind: receipt.kind,
      source: receipt.source,
      featureId: null,
      title: receipt.title,
      detail: redactText(receipt.detail, receipt.kind),
      status: normalizeStatus(receipt.status, 'done'),
      createdAt: receipt.createdAt,
      runId: receipt.runId,
      traceId: receipt.traceId,
      sessionId: receipt.sessionId,
      artifactId: normalizeText(receipt.metadata?.artifactId) || null,
      frameId: null,
    }));
  }

  private receiptsFromFeatures(
    run: UniversalAgentRun,
    featureCoverage: RunArtifactReceiptReplayFeatureCoverage[],
    generatedAt: string,
  ): RunArtifactReceiptReplayReceiptLink[] {
    const links: RunArtifactReceiptReplayReceiptLink[] = [];
    for (const feature of featureCoverage) {
      const raw = recordOrNull(run.metadata[feature.metadataKey]);
      if (!raw) {
        continue;
      }
      const receipts = listRecords(raw.receipts);
      if (receipts.length === 0) {
        links.push({
          id: `feature:${feature.featureId}:snapshot`,
          kind: 'snapshot',
          source: feature.source || feature.label,
          featureId: feature.featureId,
          title: feature.label,
          detail: `${feature.label} published a snapshot without internal receipts.`,
          status: normalizeStatus(feature.status, 'ready'),
          createdAt: normalizeText(raw.generatedAt, generatedAt),
          runId: run.id,
          traceId: run.traceId,
          sessionId: run.sessionId,
          artifactId: null,
          frameId: null,
        });
        continue;
      }
      receipts.forEach((receipt, index) => {
        links.push({
          id: normalizeText(receipt.id, `feature:${feature.featureId}:receipt:${index + 1}`),
          kind: normalizeText(receipt.kind, 'policy'),
          source: normalizeText(receipt.source, feature.source || feature.label),
          featureId: feature.featureId,
          title: normalizeText(receipt.title, feature.label),
          detail: redactText(receipt.detail, `${feature.label} receipt`),
          status: normalizeStatus(receipt.status, 'ready'),
          createdAt: normalizeText(receipt.createdAt, normalizeText(raw.generatedAt, generatedAt)),
          runId: run.id,
          traceId: run.traceId,
          sessionId: run.sessionId,
          artifactId: normalizeText(receipt.artifactId) || null,
          frameId: null,
        });
      });
    }
    return links;
  }

  private buildFrames(
    run: UniversalAgentRun,
    observatory: UniversalAgentRunObservatorySnapshot,
    featureCoverage: RunArtifactReceiptReplayFeatureCoverage[],
    receiptLinks: RunArtifactReceiptReplayReceiptLink[],
    generatedAt: string,
  ): RunArtifactReceiptReplayFrame[] {
    const frames: Array<Omit<RunArtifactReceiptReplayFrame, 'order'>> = [];

    for (const event of run.events) {
      frames.push({
        id: `frame:event:${event.id}`,
        kind: 'event',
        source: normalizeText(event.metadata?.source, `agent.${event.kind}`),
        title: event.title,
        detail: redactText(event.detail, event.kind),
        status: normalizeStatus(event.status, 'done'),
        createdAt: event.createdAt,
        runId: run.id,
        traceId: run.traceId,
        sessionId: run.sessionId,
        receiptId: `receipt:${event.id}`,
        artifactId: null,
        featureId: null,
        metadataKeys: metadataKeys(event.metadata),
      });
    }

    for (const approval of run.approvals) {
      frames.push({
        id: `frame:approval:${approval.id}`,
        kind: 'approval',
        source: 'approval-gate',
        title: approval.title,
        detail: redactText(approval.reason, 'Approval waiting for a decision.'),
        status: normalizeStatus(approval.status, 'pending'),
        createdAt: approval.createdAt,
        runId: run.id,
        traceId: run.traceId,
        sessionId: run.sessionId,
        receiptId: `receipt:${approval.id}`,
        artifactId: null,
        featureId: null,
        metadataKeys: ['approvalId', 'risk'],
      });
    }

    for (const artifact of run.artifacts) {
      frames.push({
        id: `frame:artifact:${artifact.id}`,
        kind: 'artifact',
        source: 'artifact-ledger',
        title: artifact.title,
        detail: artifact.kind,
        status: normalizeStatus(artifact.status, 'ready'),
        createdAt: artifact.createdAt,
        runId: run.id,
        traceId: run.traceId,
        sessionId: artifact.sessionId || run.sessionId,
        receiptId: `receipt:${artifact.id}`,
        artifactId: artifact.id,
        featureId: null,
        metadataKeys: ['artifactId', 'kind', 'sessionId'],
      });
    }

    for (const signal of run.memorySignals) {
      frames.push({
        id: `frame:memory:${signal.id}`,
        kind: 'memory',
        source: 'memory-signal',
        title: signal.title,
        detail: redactText(signal.summary, signal.layer),
        status: 'done',
        createdAt: run.updatedAt,
        runId: run.id,
        traceId: run.traceId,
        sessionId: run.sessionId,
        receiptId: `receipt:${signal.id}`,
        artifactId: null,
        featureId: null,
        metadataKeys: ['memorySignalId', 'layer', 'confidence'],
      });
    }

    for (const receipt of observatory.receipts) {
      frames.push({
        id: `frame:observatory:${normalizeKey(receipt.id)}`,
        kind: 'observatory-receipt',
        source: receipt.source,
        title: receipt.title,
        detail: redactText(receipt.detail, receipt.kind),
        status: normalizeStatus(receipt.status, 'done'),
        createdAt: receipt.createdAt,
        runId: receipt.runId,
        traceId: receipt.traceId,
        sessionId: receipt.sessionId,
        receiptId: receipt.id,
        artifactId: normalizeText(receipt.metadata?.artifactId) || null,
        featureId: null,
        metadataKeys: metadataKeys(receipt.metadata),
      });
    }

    for (const receipt of receiptLinks.filter((entry) => entry.featureId)) {
      const kind: RunArtifactReceiptReplayFrameKind = receipt.kind === 'snapshot'
        ? 'feature-snapshot'
        : 'feature-receipt';
      frames.push({
        id: `frame:feature:${normalizeKey(receipt.id)}`,
        kind,
        source: receipt.source,
        title: receipt.title,
        detail: receipt.detail,
        status: receipt.status,
        createdAt: receipt.createdAt || generatedAt,
        runId: receipt.runId,
        traceId: receipt.traceId,
        sessionId: receipt.sessionId,
        receiptId: receipt.id,
        artifactId: receipt.artifactId,
        featureId: receipt.featureId,
        metadataKeys: receipt.featureId
          ? metadataKeys(run.metadata[FEATURE_DEFINITIONS.find((feature) => feature.featureId === receipt.featureId)?.metadataKey || ''])
          : [],
      });
    }

    for (const feature of featureCoverage.filter((entry) => entry.present && entry.frameCount === 0)) {
      frames.push({
        id: `frame:feature:${feature.featureId}:snapshot`,
        kind: 'feature-snapshot',
        source: feature.source || feature.label,
        title: feature.label,
        detail: `${feature.label} present no metadata do run.`,
        status: normalizeStatus(feature.status, 'ready'),
        createdAt: generatedAt,
        runId: run.id,
        traceId: run.traceId,
        sessionId: run.sessionId,
        receiptId: null,
        artifactId: null,
        featureId: feature.featureId,
        metadataKeys: metadataKeys(run.metadata[feature.metadataKey]),
      });
    }

    return frames
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
      .map((frame, index) => ({
        ...frame,
        order: index + 1,
      }));
  }

  private buildArtifactLinks(
    run: UniversalAgentRun,
    frames: RunArtifactReceiptReplayFrame[],
  ): RunArtifactReceiptReplayArtifactLink[] {
    const links: RunArtifactReceiptReplayArtifactLink[] = run.artifacts.map((artifact) => {
      const frame = frames.find((entry) => entry.artifactId === artifact.id);
      return {
        artifactId: artifact.id,
        title: artifact.title,
        kind: artifact.kind,
        status: artifact.status,
        createdAt: artifact.createdAt,
        runId: run.id,
        traceId: run.traceId,
        sessionId: artifact.sessionId || run.sessionId,
        category: artifact.kind,
        replayFrameId: frame?.id || `frame:artifact:${artifact.id}`,
        observatoryReceiptId: `receipt:${artifact.id}`,
        memoryReceiptId: null,
        commands: {
          openCommand: `zavorth artifact open ${artifact.id}`,
          replayCommand: `zavorth replay artifact ${artifact.id}`,
          citeCommand: `zavorth artifact cite ${artifact.id}`,
        },
      };
    });

    const artifactMemory = recordOrNull(run.metadata.artifactMemory);
    for (const entry of listRecords(artifactMemory?.entries)) {
      const artifactId = normalizeText(entry.artifactId);
      if (!artifactId || links.some((link) => link.artifactId === artifactId)) {
        continue;
      }
      const receipt = recordOrNull(entry.receipt) || {};
      links.push({
        artifactId,
        title: normalizeText(entry.title, artifactId),
        kind: artifactKind(entry.kind),
        status: artifactStatus(entry.status),
        createdAt: normalizeText(entry.createdAt, run.updatedAt),
        runId: normalizeText(entry.runId, run.id),
        traceId: normalizeText(entry.traceId, run.traceId),
        sessionId: normalizeText(entry.sessionId, run.sessionId),
        category: normalizeText(entry.category, 'artifact-memory'),
        replayFrameId: `frame:artifact-memory:${artifactId}`,
        observatoryReceiptId: normalizeText(receipt.observatoryReceiptId) || null,
        memoryReceiptId: normalizeText(receipt.memoryReceiptId) || null,
        commands: {
          openCommand: `zavorth artifact open ${artifactId}`,
          replayCommand: `zavorth replay artifact ${artifactId}`,
          citeCommand: `zavorth artifact cite ${artifactId}`,
        },
      });
    }

    return links;
  }

  private buildReplay(
    frames: RunArtifactReceiptReplayFrame[],
    artifacts: RunArtifactReceiptReplayArtifactLink[],
    receipts: RunArtifactReceiptReplayReceiptLink[],
  ): RunArtifactReceiptReplaySnapshot['replay'] {
    const anchors = frames
      .filter((frame) => ['event', 'approval', 'artifact', 'feature-receipt', 'observatory-receipt'].includes(frame.kind))
      .slice(0, 24)
      .map((frame) => ({
        id: `anchor:${frame.id}`,
        frameId: frame.id,
        kind: frame.kind,
        label: frame.title,
        status: frame.status,
        createdAt: frame.createdAt,
      }));
    const available = frames.length > 0 || artifacts.length > 0 || receipts.length > 0;
    return {
      available,
      anchors,
      commandHints: [
        'zavorth replay latest --json',
        'zavorth replay run <runId> --json',
        'zavorth replay artifact <artifactId> --json',
        'zavorth observatory run <runId> --json',
      ],
      summary: available ? `${frames.length} frame(s), ${receipts.length} receipt(s), and ${artifacts.length} artifact link(s) ready for auditable replay.`
        : 'No frame or receipt is available for auditable replay.',
    };
  }

  private resolveStatus(
    frames: RunArtifactReceiptReplayFrame[],
    artifacts: RunArtifactReceiptReplayArtifactLink[],
    features: RunArtifactReceiptReplayFeatureCoverage[],
    replayAvailable: boolean,
  ): RunArtifactReceiptReplayStatus {
    if (frames.some((frame) => frame.status === 'blocked')) {
      return 'blocked';
    }
    if (!replayAvailable || frames.length === 0) {
      return 'empty';
    }
    if (artifacts.length === 0 || features.some((feature) => !feature.present)) {
      return 'partial';
    }
    return 'ready';
  }

  private resolveNextSafeAction(
    status: RunArtifactReceiptReplayStatus,
    replayAvailable: boolean,
    missingFeatureCount: number,
  ): string {
    if (status === 'blocked') {
      return 'Review blocked gates before reusing any artifact or resuming execution.';
    }
    if (!replayAvailable) {
      return 'Generate a run with events, receipts, or artifacts before trying replay.';
    }
    if (missingFeatureCount > 0) {
      return 'Use replay as partial and prioritize features without snapshot/receipt in the next execution.';
    }
    return 'Replay ready for audit; cite receipts before reusing artifact or decision.';
  }
}
