import type { PilotLoopSnapshot } from '../../contracts/PilotLoopContract.js';
import type { FeedbackTelemetryProductLoopSnapshot } from './FeedbackTelemetryProductLoopService.js';
import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';
export const PUBLIC_ADOPTION_PILOT_LOOP_CONTRACT_VERSION = '2026-05-04.adoption-pilot' as const;
export const PUBLIC_ADOPTION_PILOT_LOOP_METADATA_KEY = 'publicAdoptionPilotLoop' as const;

export type PublicAdoptionPilotLoopStatus =
  | 'pilot-ready'
  | 'needs-feedback-product-loop'
  | 'needs-pilot-loop'
  | 'needs-artifacts'
  | 'needs-zavorthControl'
  | 'blocked'
  | 'adoption-disabled';

export type PublicAdoptionPilotLoopGateStatus = 'ready' | 'needs-action' | 'blocked' | 'unknown';

export type PublicAdoptionPilotLoopGate = {
  id: string;
  label: string;
  status: PublicAdoptionPilotLoopGateStatus;
  source:
    | 'FeedbackTelemetryProductLoopService'
    | 'PilotLoopService'
    | 'PublicAdoptionPilotLoopService';
  command: string;
  detail: string;
  critical: boolean;
};

export type PublicAdoptionPilotLoopSurface = {
  id: 'cli' | 'control' | 'feedback' | 'docs' | 'pilot-ledger' | 'zavorthControl' | 'next-release-state';
  label: string;
  routeOrCommand: string;
  status: PublicAdoptionPilotLoopGateStatus;
  detail: string;
};

export type PublicAdoptionPilotLoopReceipt = {
  id: string;
  kind: 'feedback-loop' | 'pilot-loop' | 'triage' | 'ledger' | 'zavorthControl' | 'policy';
  source: string;
  detail: string;
  status: PublicAdoptionPilotLoopGateStatus;
};

export type PublicAdoptionPilotLoopSnapshot = {
  contractVersion: typeof PUBLIC_ADOPTION_PILOT_LOOP_CONTRACT_VERSION;
  source: 'PublicAdoptionPilotLoopService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: PublicAdoptionPilotLoopStatus;
  feedbackProductLoop: {
    linked: boolean;
    status: FeedbackTelemetryProductLoopSnapshot['status'] | 'unknown';
    optInReady: boolean;
    previewCommand: string | null;
    revokeCommand: string | null;
    deleteCommand: string | null;
  };
  pilot: {
    contractLinked: boolean;
    contractStatus: 'ready' | 'attention' | 'blocked' | 'unknown';
    gate: 'pilot-loop' | null;
    artifactDir: string | null;
    templateCount: number;
    triageRuleCount: number;
    ledgerEntryCount: number;
    supportPolicyCount: number;
    zavorthControlMetricCount: number;
    nextAction: string | null;
  };
  artifacts: {
    feedbackPreviewPath: string | null;
    pilotLedgerPath: string | null;
    zavorthControlPath: string | null;
    feedbackPreviewReady: boolean;
    pilotLedgerReady: boolean;
    zavorthControlReady: boolean;
  };
  adoptionLoop: {
    plannedPilotCount: number;
    activePilotCount: number;
    completedPilotCount: number;
    highSeverityRuleCount: number;
    supportPolicyReady: boolean;
    zavorthControlAggregationOnly: boolean;
    noPayloadPolicy: boolean;
  };
  readiness: {
    feedbackProductLoopReady: boolean;
    pilotLoopContractLinked: boolean;
    templatesReady: boolean;
    triageReady: boolean;
    ledgerReady: boolean;
    supportReady: boolean;
    zavorthControlReady: boolean;
    canStartControlledPilot: boolean;
    canCollectPublicFeedback: boolean;
    canPublishPilotMetrics: boolean;
  };
  gates: PublicAdoptionPilotLoopGate[];
  surfaces: PublicAdoptionPilotLoopSurface[];
  receipts: PublicAdoptionPilotLoopReceipt[];
  policy: {
    noImplicitCollection: true;
    noTelemetryEnabled: true;
    noExternalSubmission: true;
    noWorkspacePayloadStored: true;
    noSecretsSerialized: true;
    optInRequired: true;
    redactedPreviewRequired: true;
    localLedgerOnly: true;
    zavorthControlAggregatedOnly: true;
    pilotRequiresExplicitOwner: true;
    naturalLanguageDoesNotBypassPolicy: true;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
    feedbackRoute: '/feedback';
    docsAnchor: '/docs#pilot-loop';
    pilotLoopCommand: 'npm run pilot-loop';
    qaCommand: 'npm run qa:pilot-loop';
    gateCommand: 'npm run qa:pilot-loop';
    ledgerArtifact: 'pilot-ledger.json';
    zavorthControlArtifact: 'support-zavorthControl.json';
  };
  nextSafeAction: string;
};

export type PublicAdoptionPilotLoopInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
};

type PublicAdoptionPilotLoopDependencies = {
  now?: () => Date;
  pilotLoopService?: { buildSnapshot(): PilotLoopSnapshot } | null;
};

type LooseRecord = Record<string, unknown>;

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function recordOrNull(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LooseRecord
    : null;
}

function arrayOrEmpty<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function safeCall<T>(factory: () => T): T | null {
  try {
    return factory();
  } catch (error: unknown) {return null;
  }
}

function normalizePilotStatus(value: unknown): PublicAdoptionPilotLoopSnapshot['pilot']['contractStatus'] {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'ready' || raw === 'attention' || raw === 'blocked') {
    return raw;
  }
  return 'unknown';
}

function gateStatusFromPilotStatus(status: PublicAdoptionPilotLoopSnapshot['pilot']['contractStatus']): PublicAdoptionPilotLoopGateStatus {
  if (status === 'ready') {
    return 'ready';
  }
  if (status === 'blocked') {
    return 'blocked';
  }
  if (status === 'attention') {
    return 'needs-action';
  }
  return 'unknown';
}

function hasPassingCheck(pilot: PilotLoopSnapshot | null, checkId: string): boolean {
  return Boolean(pilot?.checks?.some((check) => check.id === checkId && check.status === 'pass'));
}

export class PublicAdoptionPilotLoopService {
  private readonly now: () => Date;
  private readonly pilotLoopService: { buildSnapshot(): PilotLoopSnapshot } | null;

  constructor(runtime: PublicAdoptionPilotLoopDependencies = {}) {
    this.now = runtime.now || (() => new Date());
    this.pilotLoopService = runtime.pilotLoopService || null;
  }

  public buildSnapshot(input: PublicAdoptionPilotLoopInput): PublicAdoptionPilotLoopSnapshot {
    const { run } = input;
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const feedbackProductLoop = recordOrNull(run.metadata.feedbackTelemetryProductLoop) as FeedbackTelemetryProductLoopSnapshot | null;
    const pilot = this.readPilotLoop(run);
    const pilotStatus = normalizePilotStatus(pilot?.status);
    const templateCount = arrayOrEmpty(pilot?.templates).length;
    const triageRuleCount = arrayOrEmpty(pilot?.triageRules).length;
    const ledgerEntries = arrayOrEmpty<{ status?: string; dataPolicy?: string }>(pilot?.pilotLedger);
    const supportPolicyCount = arrayOrEmpty(pilot?.supportPolicy).length;
    const zavorthControlMetrics = arrayOrEmpty<{ aggregateOnly?: boolean; excludesPayload?: boolean }>(pilot?.zavorthControlMetrics);
    const feedbackProductLoopReady = feedbackProductLoop?.status === 'opt-in-ready';
    const templatesReady = templateCount >= 4;
    const triageReady = triageRuleCount >= 5 && arrayOrEmpty<{ severity?: string }>(pilot?.triageRules).some((rule) => rule.severity === 'high');
    const feedbackPreviewReady = hasPassingCheck(pilot, 'pilot-loop:feedback-preview');
    const pilotLedgerReady = hasPassingCheck(pilot, 'pilot-loop:pilot-ledger') && ledgerEntries.length >= 3;
    const zavorthControlReady = hasPassingCheck(pilot, 'pilot-loop:zavorthControl') && zavorthControlMetrics.length > 0;
    const supportReady = supportPolicyCount >= 3;
    const zavorthControlAggregationOnly = zavorthControlMetrics.length > 0 && zavorthControlMetrics.every((metric) => metric.aggregateOnly === true && metric.excludesPayload === true);
    const noPayloadPolicy = ledgerEntries.every((entry) => entry.dataPolicy === 'no-workspace-payload' || entry.dataPolicy === 'redacted-only');
    const canStartControlledPilot = Boolean(
      feedbackProductLoopReady
      && pilotStatus === 'ready'
      && templatesReady
      && triageReady
      && feedbackPreviewReady
      && pilotLedgerReady
      && zavorthControlReady
      && supportReady
      && zavorthControlAggregationOnly
      && noPayloadPolicy,
    );
    const status = this.resolveStatus({
      feedbackProductLoop,
      feedbackProductLoopReady,
      pilot,
      pilotStatus,
      feedbackPreviewReady,
      pilotLedgerReady,
      zavorthControlReady,
      canStartControlledPilot,
    });
    const readiness = {
      feedbackProductLoopReady,
      pilotLoopContractLinked: Boolean(pilot),
      templatesReady,
      triageReady,
      ledgerReady: pilotLedgerReady,
      supportReady,
      zavorthControlReady,
      canStartControlledPilot,
      canCollectPublicFeedback: canStartControlledPilot,
      canPublishPilotMetrics: canStartControlledPilot && zavorthControlAggregationOnly,
    };

    return {
      contractVersion: PUBLIC_ADOPTION_PILOT_LOOP_CONTRACT_VERSION,
      source: 'PublicAdoptionPilotLoopService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
      },
      status,
      feedbackProductLoop: {
        linked: Boolean(feedbackProductLoop),
        status: feedbackProductLoop?.status || 'unknown',
        optInReady: feedbackProductLoopReady,
        previewCommand: feedbackProductLoop?.surface.previewCommand || null,
        revokeCommand: feedbackProductLoop?.surface.revokeCommand || null,
        deleteCommand: feedbackProductLoop?.surface.deleteCommand || null,
      },
      pilot: {
        contractLinked: Boolean(pilot),
        contractStatus: pilotStatus,
        gate: pilot?.gate === 'pilot-loop' ? 'pilot-loop' : null,
        artifactDir: normalizeText(pilot?.artifactDir) || null,
        templateCount,
        triageRuleCount,
        ledgerEntryCount: ledgerEntries.length,
        supportPolicyCount,
        zavorthControlMetricCount: zavorthControlMetrics.length,
        nextAction: normalizeText(pilot?.nextRecommendedGate?.gate) || null,
      },
      artifacts: {
        feedbackPreviewPath: normalizeText(pilot?.artifacts.feedbackPreviewPath) || null,
        pilotLedgerPath: normalizeText(pilot?.artifacts.pilotLedgerPath) || null,
        zavorthControlPath: normalizeText(pilot?.artifacts.zavorthControlPath) || null,
        feedbackPreviewReady,
        pilotLedgerReady,
        zavorthControlReady,
      },
      adoptionLoop: {
        plannedPilotCount: ledgerEntries.filter((entry) => entry.status === 'planned').length,
        activePilotCount: ledgerEntries.filter((entry) => entry.status === 'active').length,
        completedPilotCount: ledgerEntries.filter((entry) => entry.status === 'complete').length,
        highSeverityRuleCount: arrayOrEmpty<{ severity?: string }>(pilot?.triageRules).filter((rule) => rule.severity === 'high' || rule.severity === 'critical').length,
        supportPolicyReady: supportReady,
        zavorthControlAggregationOnly,
        noPayloadPolicy,
      },
      readiness,
      gates: this.buildGates({
        feedbackProductLoopReady,
        pilotStatus,
        templatesReady,
        triageReady,
        feedbackPreviewReady,
        pilotLedgerReady,
        zavorthControlReady,
        supportReady,
        zavorthControlAggregationOnly,
        noPayloadPolicy,
      }),
      surfaces: this.buildSurfaces({
        canStartControlledPilot,
        feedbackProductLoopReady,
        pilotStatus,
        pilotLedgerReady,
        zavorthControlReady,
      }),
      receipts: this.buildReceipts({
        feedbackProductLoopReady,
        pilotLinked: Boolean(pilot),
        triageReady,
        pilotLedgerReady,
        zavorthControlReady,
        supportReady,
        noPayloadPolicy,
      }),
      policy: {
        noImplicitCollection: true,
        noTelemetryEnabled: true,
        noExternalSubmission: true,
        noWorkspacePayloadStored: true,
        noSecretsSerialized: true,
        optInRequired: true,
        redactedPreviewRequired: true,
        localLedgerOnly: true,
        zavorthControlAggregatedOnly: true,
        pilotRequiresExplicitOwner: true,
        naturalLanguageDoesNotBypassPolicy: true,
      },
      surface: {
        cliCommand: `zavorth public-adoption-pilot-loop run ${run.id} --json`,
        zavorthControlPath: `/zavorthControl...runId=${encodeURIComponent(run.id)}&sector=config`,
        feedbackRoute: '/feedback',
        docsAnchor: '/docs#pilot-loop',
        pilotLoopCommand: 'npm run pilot-loop',
        qaCommand: 'npm run qa:pilot-loop',
        gateCommand: 'npm run qa:pilot-loop',
        ledgerArtifact: 'pilot-ledger.json',
        zavorthControlArtifact: 'support-zavorthControl.json',
      },
      nextSafeAction: this.resolveNextSafeAction(status),
    };
  }

  private readPilotLoop(run: UniversalAgentRun): PilotLoopSnapshot | null {
    const metadata = recordOrNull(run.metadata.pilotLoop)
      || recordOrNull(run.metadata.pilotLoopSnapshot)
      || recordOrNull(run.metadata.publicAdoptionPilotLoopContract);
    if (metadata) {
      return metadata as unknown as PilotLoopSnapshot;
    }
    return this.pilotLoopService ? safeCall(() => this.pilotLoopService!.buildSnapshot()) : null;
  }

  private resolveStatus(input: {
    feedbackProductLoop: FeedbackTelemetryProductLoopSnapshot | null;
    feedbackProductLoopReady: boolean;
    pilot: PilotLoopSnapshot | null;
    pilotStatus: PublicAdoptionPilotLoopSnapshot['pilot']['contractStatus'];
    feedbackPreviewReady: boolean;
    pilotLedgerReady: boolean;
    zavorthControlReady: boolean;
    canStartControlledPilot: boolean;
  }): PublicAdoptionPilotLoopStatus {
    if (!input.feedbackProductLoop) {
      return 'needs-feedback-product-loop';
    }
    if (input.feedbackProductLoop.status === 'blocked' || input.pilotStatus === 'blocked') {
      return 'blocked';
    }
    if (!input.feedbackProductLoopReady) {
      return 'needs-feedback-product-loop';
    }
    if (!input.pilot) {
      return 'needs-pilot-loop';
    }
    if (!input.feedbackPreviewReady || !input.pilotLedgerReady) {
      return 'needs-artifacts';
    }
    if (!input.zavorthControlReady) {
      return 'needs-zavorthControl';
    }
    return input.canStartControlledPilot ? 'pilot-ready' : 'needs-pilot-loop';
  }

  private buildGates(input: {
    feedbackProductLoopReady: boolean;
    pilotStatus: PublicAdoptionPilotLoopSnapshot['pilot']['contractStatus'];
    templatesReady: boolean;
    triageReady: boolean;
    feedbackPreviewReady: boolean;
    pilotLedgerReady: boolean;
    zavorthControlReady: boolean;
    supportReady: boolean;
    zavorthControlAggregationOnly: boolean;
    noPayloadPolicy: boolean;
  }): PublicAdoptionPilotLoopGate[] {
    return [
      {
        id: 'feedback-product-loop',
        label: 'Feedback product loop opt-in',
        status: input.feedbackProductLoopReady ? 'ready' : 'needs-action',
        source: 'FeedbackTelemetryProductLoopService',
        command: 'zavorth feedback-product-loop --json',
        detail: input.feedbackProductLoopReady ? 'Feedback is opt-in-ready, redacted, and reversible.'
          : 'Piloto depende da Feedback Telemetry opt-in-ready.',
        critical: true,
      },
      {
        id: 'pilot-loop-contract',
        label: 'Pilot loop contract',
        status: gateStatusFromPilotStatus(input.pilotStatus),
        source: 'PilotLoopService',
        command: 'npm run qa:pilot-loop',
        detail: input.pilotStatus === 'ready'
          ? 'Pilot loop validated templates, intake, ledger, and zavorthControl.'
          : 'run gate de piloto before abrir adoption loop.',
        critical: true,
      },
      {
        id: 'feedback-preview-redacted',
        label: 'Redacted feedback preview',
        status: input.feedbackPreviewReady ? 'ready' : 'needs-action',
        source: 'PilotLoopService',
        command: 'npm run pilot-loop -- --preview',
        detail: input.feedbackPreviewReady ? 'Redacted pilot preview is available.'
          : 'Generate drafted preview before any pilot.',
        critical: true,
      },
      {
        id: 'pilot-ledger-local',
        label: 'Pilot ledger local',
        status: input.pilotLedgerReady && input.noPayloadPolicy ? 'ready' : 'needs-action',
        source: 'PilotLoopService',
        command: 'npm run pilot-loop -- --ledger',
        detail: input.pilotLedgerReady && input.noPayloadPolicy ? 'Ledger local registra pilotos without payload de workspace.'
          : 'Ledger must exist and exclude sensitive payload.',
        critical: true,
      },
      {
        id: 'support-zavorthControl-aggregated',
        label: 'Support zavorthControl agregado',
        status: input.zavorthControlReady && input.zavorthControlAggregationOnly ? 'ready' : 'needs-action',
        source: 'PilotLoopService',
        command: 'npm run pilot-loop -- --zavorthControl',
        detail: input.zavorthControlReady && input.zavorthControlAggregationOnly ? 'ZavorthControl uses only aggregate metrics.'
          : 'ZavorthControl must be aggregated and without raw payload.',
        critical: true,
      },
      {
        id: 'templates-triage-support',
        label: 'Templates, triagem e suporte',
        status: input.templatesReady && input.triageReady && input.supportReady ? 'ready' : 'needs-action',
        source: 'PublicAdoptionPilotLoopService',
        command: 'npm run qa:pilot-loop',
        detail: input.templatesReady && input.triageReady && input.supportReady ? 'Templates, triagem e suporte cobrem o piloto controlado.'
          : 'Completar templates, triagem e suporte before do piloto.',
        critical: true,
      },
    ];
  }

  private buildSurfaces(input: {
    canStartControlledPilot: boolean;
    feedbackProductLoopReady: boolean;
    pilotStatus: PublicAdoptionPilotLoopSnapshot['pilot']['contractStatus'];
    pilotLedgerReady: boolean;
    zavorthControlReady: boolean;
  }): PublicAdoptionPilotLoopSurface[] {
    return [
      {
        id: 'cli',
        label: 'CLI public adoption pilot loop',
        routeOrCommand: 'zavorth public-adoption-pilot-loop --json',
        status: 'ready',
        detail: 'Read-only snapshot for controlled public pilots.',
      },
      {
        id: 'control',
        label: 'ZavorthControl',
        routeOrCommand: '/zavorthControl...sector=config',
        status: 'ready',
        detail: 'Config mostra readiness, ledger e zavorthControl do piloto.',
      },
      {
        id: 'feedback',
        label: 'Feedback opt-in',
        routeOrCommand: '/feedback',
        status: input.feedbackProductLoopReady ? 'ready' : 'needs-action',
        detail: 'Pilot only uses feedback with opt-in and redacted preview.',
      },
      {
        id: 'docs',
        label: 'Docs pilot loop',
        routeOrCommand: '/docs#pilot-loop',
        status: input.pilotStatus === 'ready' ? 'ready' : 'needs-action',
        detail: 'Docs must explain templates, triagem, suporte e ledger.',
      },
      {
        id: 'pilot-ledger',
        label: 'Pilot ledger',
        routeOrCommand: 'pilot-ledger.json',
        status: input.pilotLedgerReady ? 'ready' : 'needs-action',
        detail: 'Local reviewable ledger before any publishable metric.',
      },
      {
        id: 'zavorthControl',
        label: 'Support zavorthControl',
        routeOrCommand: 'support-zavorthControl.json',
        status: input.zavorthControlReady ? 'ready' : 'needs-action',
        detail: 'ZavorthControl aggregates area, severity, status, and follow-ups.',
      },
      {
        id: 'next-release-state',
        label: 'Integration showcase',
        routeOrCommand: 'npm run qa:integration-showcase',
        status: input.canStartControlledPilot ? 'ready' : 'needs-action',
        detail: 'readiness gate opens only after the pilot is ready.',
      },
    ];
  }

  private buildReceipts(input: {
    feedbackProductLoopReady: boolean;
    pilotLinked: boolean;
    triageReady: boolean;
    pilotLedgerReady: boolean;
    zavorthControlReady: boolean;
    supportReady: boolean;
    noPayloadPolicy: boolean;
  }): PublicAdoptionPilotLoopReceipt[] {
    return [
      {
        id: 'public-adoption-pilot:feedback-loop',
        kind: 'feedback-loop',
        source: 'FeedbackTelemetryProductLoopService',
        detail: input.feedbackProductLoopReady ? 'Feedback opt-in ready.' : 'Feedback opt-in pending.',
        status: input.feedbackProductLoopReady ? 'ready' : 'needs-action',
      },
      {
        id: 'public-adoption-pilot:pilot-loop',
        kind: 'pilot-loop',
        source: 'PilotLoopService',
        detail: input.pilotLinked ? 'PilotLoopSnapshot anexado.' : 'PilotLoopSnapshot missing.',
        status: input.pilotLinked ? 'ready' : 'needs-action',
      },
      {
        id: 'public-adoption-pilot:triage',
        kind: 'triage',
        source: 'PilotLoopService',
        detail: input.triageReady && input.supportReady ? 'Triagem e suporte ready.' : 'Triagem ou suporte pending.',
        status: input.triageReady && input.supportReady ? 'ready' : 'needs-action',
      },
      {
        id: 'public-adoption-pilot:ledger',
        kind: 'ledger',
        source: 'PilotLoopService',
        detail: input.pilotLedgerReady && input.noPayloadPolicy ? 'Ledger local without payload.' : 'Ledger ou data policy pending.',
        status: input.pilotLedgerReady && input.noPayloadPolicy ? 'ready' : 'needs-action',
      },
      {
        id: 'public-adoption-pilot:zavorthControl',
        kind: 'zavorthControl',
        source: 'PilotLoopService',
        detail: input.zavorthControlReady ? 'ZavorthControl agregado available.' : 'ZavorthControl agregado pending.',
        status: input.zavorthControlReady ? 'ready' : 'needs-action',
      },
      {
        id: 'public-adoption-pilot:policy',
        kind: 'policy',
        source: 'PublicAdoptionPilotLoopService',
        detail: 'Pilot requires opt-in, local ledger, and no implicit collection.',
        status: 'ready',
      },
    ];
  }

  private resolveNextSafeAction(status: PublicAdoptionPilotLoopStatus): string {
    if (status === 'needs-feedback-product-loop') {
      return 'Publicar Feedback Telemetry como opt-in-ready before iniciar piloto.';
    }
    if (status === 'needs-pilot-loop') {
      return 'run npm run qa:pilot-loop e anexar PilotLoopSnapshot ao run.';
    }
    if (status === 'needs-artifacts') {
      return 'Generate drafted preview and local pilot ledger with npm run pilot-loop -- --preview --ledger.';
    }
    if (status === 'needs-zavorthControl') {
      return 'Generate aggregated support-zavorthControl with npm run pilot-loop -- --zavorthControl.';
    }
    if (status === 'blocked') {
      return 'Fix feedback/pilot blockers before any public collection.';
    }
    if (status === 'adoption-disabled') {
      return 'Keep the pilot disabled until an owner and explicit opt-in exist.';
    }
    return 'Open only a controlled opt-in pilot with redacted preview and reviewable ledger.';
  }
}
