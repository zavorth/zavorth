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
  | 'needs-dashboard'
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
  id: 'cli' | 'control' | 'feedback' | 'docs' | 'pilot-ledger' | 'dashboard' | 'next-phase';
  label: string;
  routeOrCommand: string;
  status: PublicAdoptionPilotLoopGateStatus;
  detail: string;
};

export type PublicAdoptionPilotLoopReceipt = {
  id: string;
  kind: 'feedback-loop' | 'pilot-loop' | 'triage' | 'ledger' | 'dashboard' | 'policy';
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
    phase: '57' | null;
    artifactDir: string | null;
    templateCount: number;
    triageRuleCount: number;
    ledgerEntryCount: number;
    supportPolicyCount: number;
    dashboardMetricCount: number;
    nextStage: string | null;
  };
  artifacts: {
    feedbackPreviewPath: string | null;
    pilotLedgerPath: string | null;
    dashboardPath: string | null;
    feedbackPreviewReady: boolean;
    pilotLedgerReady: boolean;
    dashboardReady: boolean;
  };
  adoptionLoop: {
    plannedPilotCount: number;
    activePilotCount: number;
    completedPilotCount: number;
    highSeverityRuleCount: number;
    supportPolicyReady: boolean;
    dashboardAggregationOnly: boolean;
    noPayloadPolicy: boolean;
  };
  readiness: {
    feedbackProductLoopReady: boolean;
    pilotLoopContractLinked: boolean;
    templatesReady: boolean;
    triageReady: boolean;
    ledgerReady: boolean;
    supportReady: boolean;
    dashboardReady: boolean;
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
    dashboardAggregatedOnly: true;
    pilotRequiresExplicitOwner: true;
    naturalLanguageDoesNotBypassPolicy: true;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    feedbackRoute: '/feedback';
    docsAnchor: '/docs#pilot-loop';
    pilotLoopCommand: 'npm run pilot-loop';
    qaCommand: 'npm run qa:pilot-loop';
    phaseGateCommand: 'npm run qa:phase:57';
    ledgerArtifact: 'pilot-ledger.json';
    dashboardArtifact: 'support-dashboard.json';
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
  } catch {
    return null;
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
    const dashboardMetrics = arrayOrEmpty<{ aggregateOnly?: boolean; excludesPayload?: boolean }>(pilot?.dashboardMetrics);
    const feedbackProductLoopReady = feedbackProductLoop?.status === 'opt-in-ready';
    const templatesReady = templateCount >= 4;
    const triageReady = triageRuleCount >= 5 && arrayOrEmpty<{ severity?: string }>(pilot?.triageRules).some((rule) => rule.severity === 'high');
    const feedbackPreviewReady = hasPassingCheck(pilot, 'pilot-loop:feedback-preview');
    const pilotLedgerReady = hasPassingCheck(pilot, 'pilot-loop:pilot-ledger') && ledgerEntries.length >= 3;
    const dashboardReady = hasPassingCheck(pilot, 'pilot-loop:dashboard') && dashboardMetrics.length > 0;
    const supportReady = supportPolicyCount >= 3;
    const dashboardAggregationOnly = dashboardMetrics.length > 0 && dashboardMetrics.every((metric) => metric.aggregateOnly === true && metric.excludesPayload === true);
    const noPayloadPolicy = ledgerEntries.every((entry) => entry.dataPolicy === 'no-workspace-payload' || entry.dataPolicy === 'redacted-only');
    const canStartControlledPilot = Boolean(
      feedbackProductLoopReady
      && pilotStatus === 'ready'
      && templatesReady
      && triageReady
      && feedbackPreviewReady
      && pilotLedgerReady
      && dashboardReady
      && supportReady
      && dashboardAggregationOnly
      && noPayloadPolicy,
    );
    const status = this.resolveStatus({
      feedbackProductLoop,
      feedbackProductLoopReady,
      pilot,
      pilotStatus,
      feedbackPreviewReady,
      pilotLedgerReady,
      dashboardReady,
      canStartControlledPilot,
    });
    const readiness = {
      feedbackProductLoopReady,
      pilotLoopContractLinked: Boolean(pilot),
      templatesReady,
      triageReady,
      ledgerReady: pilotLedgerReady,
      supportReady,
      dashboardReady,
      canStartControlledPilot,
      canCollectPublicFeedback: canStartControlledPilot,
      canPublishPilotMetrics: canStartControlledPilot && dashboardAggregationOnly,
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
        phase: pilot?.phase === '57' ? '57' : null,
        artifactDir: normalizeText(pilot?.artifactDir) || null,
        templateCount,
        triageRuleCount,
        ledgerEntryCount: ledgerEntries.length,
        supportPolicyCount,
        dashboardMetricCount: dashboardMetrics.length,
        nextStage: normalizeText(pilot?.nextRecommendedPhase?.phase) || null,
      },
      artifacts: {
        feedbackPreviewPath: normalizeText(pilot?.artifacts.feedbackPreviewPath) || null,
        pilotLedgerPath: normalizeText(pilot?.artifacts.pilotLedgerPath) || null,
        dashboardPath: normalizeText(pilot?.artifacts.dashboardPath) || null,
        feedbackPreviewReady,
        pilotLedgerReady,
        dashboardReady,
      },
      adoptionLoop: {
        plannedPilotCount: ledgerEntries.filter((entry) => entry.status === 'planned').length,
        activePilotCount: ledgerEntries.filter((entry) => entry.status === 'active').length,
        completedPilotCount: ledgerEntries.filter((entry) => entry.status === 'complete').length,
        highSeverityRuleCount: arrayOrEmpty<{ severity?: string }>(pilot?.triageRules).filter((rule) => rule.severity === 'high' || rule.severity === 'critical').length,
        supportPolicyReady: supportReady,
        dashboardAggregationOnly,
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
        dashboardReady,
        supportReady,
        dashboardAggregationOnly,
        noPayloadPolicy,
      }),
      surfaces: this.buildSurfaces({
        canStartControlledPilot,
        feedbackProductLoopReady,
        pilotStatus,
        pilotLedgerReady,
        dashboardReady,
      }),
      receipts: this.buildReceipts({
        feedbackProductLoopReady,
        pilotLinked: Boolean(pilot),
        triageReady,
        pilotLedgerReady,
        dashboardReady,
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
        dashboardAggregatedOnly: true,
        pilotRequiresExplicitOwner: true,
        naturalLanguageDoesNotBypassPolicy: true,
      },
      surface: {
        cliCommand: `zavorth public-adoption-pilot-loop run ${run.id} --json`,
        commandCenterPath: `/control?runId=${encodeURIComponent(run.id)}&sector=config`,
        feedbackRoute: '/feedback',
        docsAnchor: '/docs#pilot-loop',
        pilotLoopCommand: 'npm run pilot-loop',
        qaCommand: 'npm run qa:pilot-loop',
        phaseGateCommand: 'npm run qa:phase:57',
        ledgerArtifact: 'pilot-ledger.json',
        dashboardArtifact: 'support-dashboard.json',
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
    dashboardReady: boolean;
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
    if (!input.dashboardReady) {
      return 'needs-dashboard';
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
    dashboardReady: boolean;
    supportReady: boolean;
    dashboardAggregationOnly: boolean;
    noPayloadPolicy: boolean;
  }): PublicAdoptionPilotLoopGate[] {
    return [
      {
        id: 'feedback-product-loop',
        label: 'Feedback product loop opt-in',
        status: input.feedbackProductLoopReady ? 'ready' : 'needs-action',
        source: 'FeedbackTelemetryProductLoopService',
        command: 'zavorth feedback-product-loop --json',
        detail: input.feedbackProductLoopReady
          ? 'Feedback esta opt-in-ready, redigido e reversivel.'
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
          ? 'Pilot loop validou templates, triagem, ledger e dashboard.'
          : 'Rodar gate de piloto antes de abrir adoption loop.',
        critical: true,
      },
      {
        id: 'feedback-preview-redacted',
        label: 'Feedback preview redigido',
        status: input.feedbackPreviewReady ? 'ready' : 'needs-action',
        source: 'PilotLoopService',
        command: 'npm run pilot-loop -- --preview',
        detail: input.feedbackPreviewReady
          ? 'Preview redigido de piloto esta disponivel.'
          : 'Gerar preview redigido antes de qualquer piloto.',
        critical: true,
      },
      {
        id: 'pilot-ledger-local',
        label: 'Pilot ledger local',
        status: input.pilotLedgerReady && input.noPayloadPolicy ? 'ready' : 'needs-action',
        source: 'PilotLoopService',
        command: 'npm run pilot-loop -- --ledger',
        detail: input.pilotLedgerReady && input.noPayloadPolicy
          ? 'Ledger local registra pilotos sem payload de workspace.'
          : 'Ledger precisa existir e excluir payload sensivel.',
        critical: true,
      },
      {
        id: 'support-dashboard-aggregated',
        label: 'Support dashboard agregado',
        status: input.dashboardReady && input.dashboardAggregationOnly ? 'ready' : 'needs-action',
        source: 'PilotLoopService',
        command: 'npm run pilot-loop -- --dashboard',
        detail: input.dashboardReady && input.dashboardAggregationOnly
          ? 'Dashboard usa somente metricas agregadas.'
          : 'Dashboard precisa ser agregado e sem payload bruto.',
        critical: true,
      },
      {
        id: 'templates-triage-support',
        label: 'Templates, triagem e suporte',
        status: input.templatesReady && input.triageReady && input.supportReady ? 'ready' : 'needs-action',
        source: 'PublicAdoptionPilotLoopService',
        command: 'npm run qa:phase:57',
        detail: input.templatesReady && input.triageReady && input.supportReady
          ? 'Templates, triagem e suporte cobrem o piloto controlado.'
          : 'Completar templates, triagem e suporte antes do piloto.',
        critical: true,
      },
    ];
  }

  private buildSurfaces(input: {
    canStartControlledPilot: boolean;
    feedbackProductLoopReady: boolean;
    pilotStatus: PublicAdoptionPilotLoopSnapshot['pilot']['contractStatus'];
    pilotLedgerReady: boolean;
    dashboardReady: boolean;
  }): PublicAdoptionPilotLoopSurface[] {
    return [
      {
        id: 'cli',
        label: 'CLI public adoption pilot loop',
        routeOrCommand: 'zavorth public-adoption-pilot-loop --json',
        status: 'ready',
        detail: 'Snapshot read-only para pilotos publicos controlados.',
      },
      {
        id: 'control',
        label: 'Command Center',
        routeOrCommand: '/control?sector=config',
        status: 'ready',
        detail: 'Config mostra readiness, ledger e dashboard do piloto.',
      },
      {
        id: 'feedback',
        label: 'Feedback opt-in',
        routeOrCommand: '/feedback',
        status: input.feedbackProductLoopReady ? 'ready' : 'needs-action',
        detail: 'Piloto so usa feedback com opt-in e preview redigido.',
      },
      {
        id: 'docs',
        label: 'Docs pilot loop',
        routeOrCommand: '/docs#pilot-loop',
        status: input.pilotStatus === 'ready' ? 'ready' : 'needs-action',
        detail: 'Docs devem explicar templates, triagem, suporte e ledger.',
      },
      {
        id: 'pilot-ledger',
        label: 'Pilot ledger',
        routeOrCommand: 'pilot-ledger.json',
        status: input.pilotLedgerReady ? 'ready' : 'needs-action',
        detail: 'Ledger local e revisavel antes de qualquer metric publicavel.',
      },
      {
        id: 'dashboard',
        label: 'Support dashboard',
        routeOrCommand: 'support-dashboard.json',
        status: input.dashboardReady ? 'ready' : 'needs-action',
        detail: 'Dashboard agrega area, severidade, status e follow-ups.',
      },
      {
        id: 'next-phase',
        label: 'Integration showcase',
        routeOrCommand: 'npm run qa:phase:58',
        status: input.canStartControlledPilot ? 'ready' : 'needs-action',
        detail: 'Readiness checkpoint 8 so deve abrir depois do piloto estar pronto.',
      },
    ];
  }

  private buildReceipts(input: {
    feedbackProductLoopReady: boolean;
    pilotLinked: boolean;
    triageReady: boolean;
    pilotLedgerReady: boolean;
    dashboardReady: boolean;
    supportReady: boolean;
    noPayloadPolicy: boolean;
  }): PublicAdoptionPilotLoopReceipt[] {
    return [
      {
        id: 'public-adoption-pilot:feedback-loop',
        kind: 'feedback-loop',
        source: 'FeedbackTelemetryProductLoopService',
        detail: input.feedbackProductLoopReady ? 'Feedback opt-in pronto.' : 'Feedback opt-in pendente.',
        status: input.feedbackProductLoopReady ? 'ready' : 'needs-action',
      },
      {
        id: 'public-adoption-pilot:pilot-loop',
        kind: 'pilot-loop',
        source: 'PilotLoopService',
        detail: input.pilotLinked ? 'PilotLoopSnapshot anexado.' : 'PilotLoopSnapshot ausente.',
        status: input.pilotLinked ? 'ready' : 'needs-action',
      },
      {
        id: 'public-adoption-pilot:triage',
        kind: 'triage',
        source: 'PilotLoopService',
        detail: input.triageReady && input.supportReady ? 'Triagem e suporte prontos.' : 'Triagem ou suporte pendente.',
        status: input.triageReady && input.supportReady ? 'ready' : 'needs-action',
      },
      {
        id: 'public-adoption-pilot:ledger',
        kind: 'ledger',
        source: 'PilotLoopService',
        detail: input.pilotLedgerReady && input.noPayloadPolicy ? 'Ledger local sem payload.' : 'Ledger ou data policy pendente.',
        status: input.pilotLedgerReady && input.noPayloadPolicy ? 'ready' : 'needs-action',
      },
      {
        id: 'public-adoption-pilot:dashboard',
        kind: 'dashboard',
        source: 'PilotLoopService',
        detail: input.dashboardReady ? 'Dashboard agregado disponivel.' : 'Dashboard agregado pendente.',
        status: input.dashboardReady ? 'ready' : 'needs-action',
      },
      {
        id: 'public-adoption-pilot:policy',
        kind: 'policy',
        source: 'PublicAdoptionPilotLoopService',
        detail: 'Piloto exige opt-in, ledger local e nenhuma coleta implicita.',
        status: 'ready',
      },
    ];
  }

  private resolveNextSafeAction(status: PublicAdoptionPilotLoopStatus): string {
    if (status === 'needs-feedback-product-loop') {
      return 'Publicar Feedback Telemetry como opt-in-ready antes de iniciar piloto.';
    }
    if (status === 'needs-pilot-loop') {
      return 'Rodar npm run qa:pilot-loop e anexar PilotLoopSnapshot ao run.';
    }
    if (status === 'needs-artifacts') {
      return 'Gerar preview redigido e pilot-ledger local com npm run pilot-loop -- --preview --ledger.';
    }
    if (status === 'needs-dashboard') {
      return 'Gerar support-dashboard agregado com npm run pilot-loop -- --dashboard.';
    }
    if (status === 'blocked') {
      return 'Corrigir bloqueios de feedback/piloto antes de qualquer coleta publica.';
    }
    if (status === 'adoption-disabled') {
      return 'Manter piloto desligado ate haver owner e opt-in explicito.';
    }
    return 'Abrir apenas piloto controlado, opt-in, redigido e com ledger revisavel.';
  }
}
