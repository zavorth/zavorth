import type { PublicAdoptionReadinessSnapshot } from '../../contracts/PublicAdoptionReadinessContract.js';
import type { ReleaseTrainSnapshot } from '../../contracts/ReleaseTrainContract.js';
import type { IntegrationShowcasePartnerSurfaceSnapshot } from './IntegrationShowcasePartnerSurfaceService.js';
import type { PublicAdoptionPilotLoopSnapshot } from './PublicAdoptionPilotLoopService.js';
import type { FeedbackTelemetryProductLoopSnapshot } from './FeedbackTelemetryProductLoopService.js';
import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';export const RELEASE_ADOPTION_READINESS_CONTRACT_VERSION = '2026-05-04.release-readiness' as const;
export const RELEASE_ADOPTION_READINESS_METADATA_KEY = 'releaseAdoptionReadiness' as const;

export type ReleaseAdoptionReadinessStatus =
  | 'release-adoption-ready'
  | 'needs-integration-showcase'
  | 'needs-release-train'
  | 'needs-public-adoption'
  | 'needs-support-loop'
  | 'needs-feedback-metrics'
  | 'blocked';

export type ReleaseAdoptionReadinessGateStatus = 'ready' | 'needs-action' | 'blocked' | 'unknown';

export type ReleaseAdoptionReadinessGate = {
  id: string;
  label: string;
  status: ReleaseAdoptionReadinessGateStatus;
  source:
    | 'IntegrationShowcasePartnerSurfaceService'
    | 'ReleaseTrainService'
    | 'PublicAdoptionReadinessService'
    | 'PublicAdoptionPilotLoopService'
    | 'FeedbackTelemetryProductLoopService'
    | 'ReleaseAdoptionReadinessService';
  command: string;
  detail: string;
  critical: boolean;
};

export type ReleaseAdoptionReadinessSurface = {
  id: 'cli' | 'control' | 'release' | 'adoption' | 'support' | 'feedback' | 'docs' | 'next-cycle';
  label: string;
  routeOrCommand: string;
  status: ReleaseAdoptionReadinessGateStatus;
  detail: string;
};

export type ReleaseAdoptionReadinessReceipt = {
  id: string;
  kind: 'showcase' | 'release-train' | 'adoption' | 'support' | 'feedback' | 'policy';
  source: string;
  detail: string;
  status: ReleaseAdoptionReadinessGateStatus;
};

export type ReleaseAdoptionReadinessSnapshot = {
  contractVersion: typeof RELEASE_ADOPTION_READINESS_CONTRACT_VERSION;
  source: 'ReleaseAdoptionReadinessService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: ReleaseAdoptionReadinessStatus;
  integrationShowcase: {
    linked: boolean;
    status: IntegrationShowcasePartnerSurfaceSnapshot['status'] | 'unknown';
    showcaseReady: boolean;
    vendorCount: number;
    fixtureReadyCount: number;
    partnerClaimBlocked: boolean;
    qaCommand: string | null;
  };
  releaseTrain: {
    linked: boolean;
    status: ReleaseTrainSnapshot['status'] | 'unknown';
    gate: ReleaseTrainSnapshot['gate'] | null;
    baselineVersion: string | null;
    packageVersion: string | null;
    policyCount: number;
    calendarItemCount: number;
    releaseCandidateItemCount: number;
    hotfixStepCount: number;
    failedCheckCount: number;
    qaCommand: 'npm run qa:release-train';
  };
  publicAdoption: {
    linked: boolean;
    status: PublicAdoptionReadinessSnapshot['status'] | 'unknown';
    gate: PublicAdoptionReadinessSnapshot['gate'] | null;
    readinessScore: number;
    claimCount: number;
    riskCount: number;
    runbookStepCount: number;
    failedCheckCount: number;
    qaCommand: 'npm run qa:public-adoption';
  };
  supportLoop: {
    feedbackLoopReady: boolean;
    pilotLoopReady: boolean;
    supportPolicyCount: number;
    triageRuleCount: number;
    plannedPilotCount: number;
    zavorthControlAggregatedOnly: boolean;
    noPayloadPolicy: boolean;
    metricsReady: boolean;
  };
  readiness: {
    integrationShowcaseReady: boolean;
    releaseTrainReady: boolean;
    publicAdoptionReady: boolean;
    supportLoopReady: boolean;
    feedbackMetricsReady: boolean;
    ltsHotfixPolicyReady: boolean;
    docsRunbookReady: boolean;
    canOpenPublicAdoption: boolean;
    canStartCanary: false;
  };
  gates: ReleaseAdoptionReadinessGate[];
  surfaces: ReleaseAdoptionReadinessSurface[];
  receipts: ReleaseAdoptionReadinessReceipt[];
  policy: {
    noDeployExecuted: true;
    noTelemetryEnabled: true;
    noImplicitCollection: true;
    noExternalSubmission: true;
    noRawPayloadSerialized: true;
    noStableClaimWithoutEvidence: true;
    noCanaryStarted: true;
    noNetworkRequiredForReadiness: true;
    releaseRequiresRollbackPreview: true;
    adoptionMetricsAggregatedOnly: true;
    naturalLanguageDoesNotBypassPolicy: true;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
    releaseRoute: '/release';
    feedbackRoute: '/feedback';
    docsRoute: '/docs';
    releaseTrainCommand: 'npm run qa:release-train';
    publicAdoptionCommand: 'npm run qa:public-adoption';
    pilotLoopCommand: 'npm run qa:pilot-loop';
    feedbackPreviewCommand: 'npm run feedback:preview';
    gateCommand: 'npm run qa:release-train';
  };
  nextSafeAction: string;
};

export type ReleaseAdoptionReadinessInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
};

type ReleaseAdoptionReadinessDependencies = {
  now?: () => Date;
  releaseTrainService?: { buildSnapshot(): ReleaseTrainSnapshot } | null;
  publicAdoptionReadinessService?: { buildSnapshot(): PublicAdoptionReadinessSnapshot } | null;
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

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function safeCall<T>(factory: () => T): T | null {
  try {
    return factory();
  } catch (error: unknown) {return null;
  }
}

function gateStatus(ready: boolean, linked = true, blocked = false): ReleaseAdoptionReadinessGateStatus {
  if (blocked) {
    return 'blocked';
  }
  if (ready) {
    return 'ready';
  }
  return linked ? 'needs-action' : 'unknown';
}

export class ReleaseAdoptionReadinessService {
  private readonly now: () => Date;
  private readonly releaseTrainService: { buildSnapshot(): ReleaseTrainSnapshot } | null;
  private readonly publicAdoptionReadinessService: { buildSnapshot(): PublicAdoptionReadinessSnapshot } | null;

  constructor(runtime: ReleaseAdoptionReadinessDependencies = {}) {
    this.now = runtime.now || (() => new Date());
    this.releaseTrainService = runtime.releaseTrainService || null;
    this.publicAdoptionReadinessService = runtime.publicAdoptionReadinessService || null;
  }

  public buildSnapshot(input: ReleaseAdoptionReadinessInput): ReleaseAdoptionReadinessSnapshot {
    const { run } = input;
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const showcase = recordOrNull(run.metadata.integrationShowcasePartnerSurface) as IntegrationShowcasePartnerSurfaceSnapshot | null;
    const releaseTrain = this.readReleaseTrain(run);
    const publicAdoption = this.readPublicAdoption(run);
    const pilotLoop = recordOrNull(run.metadata.publicAdoptionPilotLoop) as PublicAdoptionPilotLoopSnapshot | null;
    const feedbackLoop = recordOrNull(run.metadata.feedbackTelemetryProductLoop) as FeedbackTelemetryProductLoopSnapshot | null;
    const releasePolicies = arrayOrEmpty(releaseTrain?.policies);
    const releaseCalendar = arrayOrEmpty(releaseTrain?.calendar);
    const releaseCandidateChecklist = arrayOrEmpty(releaseTrain?.releaseCandidateChecklist);
    const hotfixPlaybook = arrayOrEmpty(releaseTrain?.hotfixPlaybook);
    const adoptionClaims = arrayOrEmpty(publicAdoption?.claims);
    const adoptionRisks = arrayOrEmpty(publicAdoption?.risks);
    const adoptionRunbook = arrayOrEmpty(publicAdoption?.demoRunbook);
    const releaseSummary = recordOrNull(releaseTrain?.summary);
    const adoptionSummary = recordOrNull(publicAdoption?.summary);

    const showcaseReady = showcase?.status === 'showcase-ready';
    const partnerClaimBlocked = showcase?.status === 'partner-claim-blocked';
    const releaseReady = releaseTrain?.status === 'ready';
    const adoptionReady = publicAdoption?.status === 'ready'
      && numberOrZero(adoptionSummary?.readinessScore) >= 80;
    const supportPolicyCount = numberOrZero(recordOrNull(pilotLoop?.pilot)?.supportPolicyCount);
    const triageRuleCount = numberOrZero(recordOrNull(pilotLoop?.pilot)?.triageRuleCount);
    const plannedPilotCount = numberOrZero(recordOrNull(pilotLoop?.adoptionLoop)?.plannedPilotCount);
    const zavorthControlAggregatedOnly = recordOrNull(pilotLoop?.adoptionLoop)?.zavorthControlAggregationOnly === true
      || recordOrNull(pilotLoop?.policy)?.zavorthControlAggregatedOnly === true;
    const noPayloadPolicy = recordOrNull(pilotLoop?.adoptionLoop)?.noPayloadPolicy === true
      || recordOrNull(pilotLoop?.policy)?.noWorkspacePayloadStored === true;
    const pilotLoopReady = pilotLoop?.status === 'pilot-ready';
    const feedbackPolicy = recordOrNull(feedbackLoop?.policy);
    const feedbackLoopReady = feedbackLoop?.status === 'opt-in-ready'
      || (feedbackPolicy?.noTelemetryEnabled === true && feedbackPolicy?.noFeedbackSent === true);
    const feedbackMetricsReady = feedbackLoopReady && zavorthControlAggregatedOnly && noPayloadPolicy;
    const supportLoopReady = pilotLoopReady
      && feedbackLoopReady
      && supportPolicyCount >= 3
      && triageRuleCount >= 5
      && plannedPilotCount >= 3;
    const ltsHotfixPolicyReady = Boolean(
      releaseTrain
      && releasePolicies.length >= 4
      && hotfixPlaybook.length >= 4
      && releaseCalendar.length >= 4,
    );
    const docsRunbookReady = Boolean(
      publicAdoption
      && adoptionRunbook.length >= 6
      && adoptionClaims.length >= 5
      && adoptionRisks.length >= 4,
    );
    const blocked = partnerClaimBlocked
      || releaseTrain?.status === 'blocked'
      || publicAdoption?.status === 'blocked'
      || showcase?.status === 'blocked';
    const canOpenPublicAdoption = Boolean(
      showcaseReady
      && releaseReady
      && adoptionReady
      && supportLoopReady
      && feedbackMetricsReady
      && ltsHotfixPolicyReady
      && docsRunbookReady
      && !blocked,
    );
    const status = this.resolveStatus({
      blocked,
      showcaseReady,
      releaseReady,
      adoptionReady,
      supportLoopReady,
      feedbackMetricsReady,
      canOpenPublicAdoption,
    });
    const readiness = {
      integrationShowcaseReady: showcaseReady,
      releaseTrainReady: releaseReady,
      publicAdoptionReady: adoptionReady,
      supportLoopReady,
      feedbackMetricsReady,
      ltsHotfixPolicyReady,
      docsRunbookReady,
      canOpenPublicAdoption,
      canStartCanary: false as const,
    };

    return {
      contractVersion: RELEASE_ADOPTION_READINESS_CONTRACT_VERSION,
      source: 'ReleaseAdoptionReadinessService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
      },
      status,
      integrationShowcase: {
        linked: Boolean(showcase),
        status: showcase?.status || 'unknown',
        showcaseReady,
        vendorCount: numberOrZero(recordOrNull(showcase?.showcase)?.vendorCount),
        fixtureReadyCount: numberOrZero(recordOrNull(showcase?.showcase)?.fixtureReadyCount),
        partnerClaimBlocked,
        qaCommand: normalizeText(recordOrNull(showcase?.surface)?.qaCommand) || null,
      },
      releaseTrain: {
        linked: Boolean(releaseTrain),
        status: releaseTrain?.status || 'unknown',
        gate: releaseTrain?.gate || null,
        baselineVersion: normalizeText(releaseTrain?.baseline?.version) || null,
        packageVersion: normalizeText(releaseTrain?.baseline?.packageVersion) || null,
        policyCount: releasePolicies.length,
        calendarItemCount: releaseCalendar.length,
        releaseCandidateItemCount: releaseCandidateChecklist.length,
        hotfixStepCount: hotfixPlaybook.length,
        failedCheckCount: numberOrZero(releaseSummary?.failed),
        qaCommand: 'npm run qa:release-train',
      },
      publicAdoption: {
        linked: Boolean(publicAdoption),
        status: publicAdoption?.status || 'unknown',
        gate: publicAdoption?.gate || null,
        readinessScore: numberOrZero(adoptionSummary?.readinessScore),
        claimCount: adoptionClaims.length,
        riskCount: adoptionRisks.length,
        runbookStepCount: adoptionRunbook.length,
        failedCheckCount: numberOrZero(adoptionSummary?.failed),
        qaCommand: 'npm run qa:public-adoption',
      },
      supportLoop: {
        feedbackLoopReady,
        pilotLoopReady,
        supportPolicyCount,
        triageRuleCount,
        plannedPilotCount,
        zavorthControlAggregatedOnly,
        noPayloadPolicy,
        metricsReady: feedbackMetricsReady,
      },
      readiness,
      gates: this.buildGates({
        showcaseReady,
        partnerClaimBlocked,
        releaseReady,
        adoptionReady,
        supportLoopReady,
        feedbackMetricsReady,
        ltsHotfixPolicyReady,
        docsRunbookReady,
        releaseLinked: Boolean(releaseTrain),
        adoptionLinked: Boolean(publicAdoption),
      }),
      surfaces: this.buildSurfaces({
        canOpenPublicAdoption,
        releaseReady,
        adoptionReady,
        supportLoopReady,
        feedbackMetricsReady,
      }),
      receipts: this.buildReceipts({
        showcaseReady,
        releaseReady,
        adoptionReady,
        supportLoopReady,
        feedbackMetricsReady,
        ltsHotfixPolicyReady,
      }),
      policy: {
        noDeployExecuted: true,
        noTelemetryEnabled: true,
        noImplicitCollection: true,
        noExternalSubmission: true,
        noRawPayloadSerialized: true,
        noStableClaimWithoutEvidence: true,
        noCanaryStarted: true,
        noNetworkRequiredForReadiness: true,
        releaseRequiresRollbackPreview: true,
        adoptionMetricsAggregatedOnly: true,
        naturalLanguageDoesNotBypassPolicy: true,
      },
      surface: {
        cliCommand: `zavorth release-adoption-readiness run ${run.id} --json`,
        zavorthControlPath: `/zavorthControl?runId=${encodeURIComponent(run.id)}&sector=config`,
        releaseRoute: '/release',
        feedbackRoute: '/feedback',
        docsRoute: '/docs',
        releaseTrainCommand: 'npm run qa:release-train',
        publicAdoptionCommand: 'npm run qa:public-adoption',
        pilotLoopCommand: 'npm run qa:pilot-loop',
        feedbackPreviewCommand: 'npm run feedback:preview',
        gateCommand: 'npm run qa:release-train',
      },
      nextSafeAction: this.resolveNextSafeAction(status),
    };
  }

  private readReleaseTrain(run: UniversalAgentRun): ReleaseTrainSnapshot | null {
    const metadata = recordOrNull(run.metadata.releaseTrain)
      || recordOrNull(run.metadata.releaseTrainSnapshot)
      || recordOrNull(run.metadata.v1ReleaseTrain);
    if (metadata) {
      return metadata as unknown as ReleaseTrainSnapshot;
    }
    return this.releaseTrainService ? safeCall(() => this.releaseTrainService!.buildSnapshot()) : null;
  }

  private readPublicAdoption(run: UniversalAgentRun): PublicAdoptionReadinessSnapshot | null {
    const metadata = recordOrNull(run.metadata.publicAdoptionReadiness)
      || recordOrNull(run.metadata.publicAdoption)
      || recordOrNull(run.metadata.adoptionReadiness);
    if (metadata) {
      return metadata as unknown as PublicAdoptionReadinessSnapshot;
    }
    return this.publicAdoptionReadinessService ? safeCall(() => this.publicAdoptionReadinessService!.buildSnapshot()) : null;
  }

  private resolveStatus(input: {
    blocked: boolean;
    showcaseReady: boolean;
    releaseReady: boolean;
    adoptionReady: boolean;
    supportLoopReady: boolean;
    feedbackMetricsReady: boolean;
    canOpenPublicAdoption: boolean;
  }): ReleaseAdoptionReadinessStatus {
    if (input.blocked) {
      return 'blocked';
    }
    if (!input.showcaseReady) {
      return 'needs-integration-showcase';
    }
    if (!input.releaseReady) {
      return 'needs-release-train';
    }
    if (!input.adoptionReady) {
      return 'needs-public-adoption';
    }
    if (!input.supportLoopReady) {
      return 'needs-support-loop';
    }
    if (!input.feedbackMetricsReady) {
      return 'needs-feedback-metrics';
    }
    return input.canOpenPublicAdoption ? 'release-adoption-ready' : 'needs-public-adoption';
  }

  private buildGates(input: {
    showcaseReady: boolean;
    partnerClaimBlocked: boolean;
    releaseReady: boolean;
    adoptionReady: boolean;
    supportLoopReady: boolean;
    feedbackMetricsReady: boolean;
    ltsHotfixPolicyReady: boolean;
    docsRunbookReady: boolean;
    releaseLinked: boolean;
    adoptionLinked: boolean;
  }): ReleaseAdoptionReadinessGate[] {
    return [
      {
        id: 'integration-showcase',
        label: 'Integration showcase fechado',
        status: gateStatus(input.showcaseReady, true, input.partnerClaimBlocked),
        source: 'IntegrationShowcasePartnerSurfaceService',
        command: 'zavorth integration-showcase-partner-surface --json',
        detail: input.showcaseReady
          ? 'Integration Showcase publicou showcase fixture-first e partner surface auditavel.'
          : 'Release/adoption depende da showcase de integracoes sem claim formal indevido.',
        critical: true,
      },
      {
        id: 'release-train',
        label: 'Release train v1.x',
        status: gateStatus(input.releaseReady, input.releaseLinked),
        source: 'ReleaseTrainService',
        command: 'npm run qa:release-train',
        detail: input.releaseReady
          ? 'Release train cobre baseline, RC, rollback, hotfix e LTS.'
          : 'Anexar ReleaseTrainSnapshot ready antes de abrir adocao publica.',
        critical: true,
      },
      {
        id: 'public-adoption',
        label: 'Public adoption readiness',
        status: gateStatus(input.adoptionReady, input.adoptionLinked),
        source: 'PublicAdoptionReadinessService',
        command: 'npm run qa:public-adoption',
        detail: input.adoptionReady
          ? 'Onboarding, docs, claims, riscos e runbook publico estao prontos.'
          : 'Adoção publica precisa score, runbook e claims com evidencia.',
        critical: true,
      },
      {
        id: 'support-loop',
        label: 'Support loop controlado',
        status: gateStatus(input.supportLoopReady),
        source: 'PublicAdoptionPilotLoopService',
        command: 'npm run qa:pilot-loop',
        detail: input.supportLoopReady
          ? 'Pilotos, triagem, suporte e zavorthControl agregado estao disponiveis.'
          : 'Suporte precisa ledger, triagem, pilotos planejados e zavorthControl agregado.',
        critical: true,
      },
      {
        id: 'feedback-metrics',
        label: 'Feedback e metricas agregadas',
        status: gateStatus(input.feedbackMetricsReady),
        source: 'FeedbackTelemetryProductLoopService',
        command: 'npm run feedback:preview',
        detail: input.feedbackMetricsReady
          ? 'Feedback segue opt-in, redigido e agregado.'
          : 'Feedback nao pode ligar telemetry, envio externo ou payload bruto.',
        critical: true,
      },
      {
        id: 'lts-hotfix-policy',
        label: 'LTS e hotfix policy',
        status: gateStatus(input.ltsHotfixPolicyReady, input.releaseLinked),
        source: 'ReleaseTrainService',
        command: 'npm run qa:release-train',
        detail: input.ltsHotfixPolicyReady
          ? 'Patch, minor, breaking, calendario e hotfix playbook estao definidos.'
          : 'Release train precisa politica LTS/hotfix antes de publicacao forte.',
        critical: true,
      },
      {
        id: 'docs-runbook',
        label: 'Docs e runbook publico',
        status: gateStatus(input.docsRunbookReady, input.adoptionLinked),
        source: 'PublicAdoptionReadinessService',
        command: 'npm run public-adoption',
        detail: input.docsRunbookReady
          ? 'Runbook, riscos e claims tem evidencia local.'
          : 'Docs/runbook precisam explicar limites, suporte e fluxo de adocao.',
        critical: true,
      },
    ];
  }

  private buildSurfaces(input: {
    canOpenPublicAdoption: boolean;
    releaseReady: boolean;
    adoptionReady: boolean;
    supportLoopReady: boolean;
    feedbackMetricsReady: boolean;
  }): ReleaseAdoptionReadinessSurface[] {
    return [
      {
        id: 'cli',
        label: 'CLI release/adoption readiness',
        routeOrCommand: 'zavorth release-adoption-readiness --json',
        status: 'ready',
        detail: 'Snapshot read-only para release, adocao, suporte e feedback.',
      },
      {
        id: 'control',
        label: 'ZavorthControl',
        routeOrCommand: '/zavorthControl?sector=config',
        status: 'ready',
        detail: 'Config mostra release train, adoption readiness e suporte.',
      },
      {
        id: 'release',
        label: 'Release route',
        routeOrCommand: '/release',
        status: input.releaseReady ? 'ready' : 'needs-action',
        detail: 'Release publica baseline, rollback, changelog e hotfix.',
      },
      {
        id: 'adoption',
        label: 'Public adoption gate',
        routeOrCommand: 'npm run qa:public-adoption',
        status: input.adoptionReady ? 'ready' : 'needs-action',
        detail: 'Onboarding publico e claims precisam evidencia local.',
      },
      {
        id: 'support',
        label: 'Support zavorthControl',
        routeOrCommand: 'support-zavorthControl.json',
        status: input.supportLoopReady ? 'ready' : 'needs-action',
        detail: 'Suporte usa triagem e metricas agregadas.',
      },
      {
        id: 'feedback',
        label: 'Feedback opt-in',
        routeOrCommand: '/feedback',
        status: input.feedbackMetricsReady ? 'ready' : 'needs-action',
        detail: 'Feedback permanece preview/redigido/revoke-delete.',
      },
      {
        id: 'docs',
        label: 'Docs publicas',
        routeOrCommand: '/docs',
        status: input.adoptionReady ? 'ready' : 'needs-action',
        detail: 'Docs explicam limites, rollback e suporte.',
      },
      {
        id: 'next-cycle',
        label: 'Proximo ciclo',
        routeOrCommand: 'v1.1.0 planning',
        status: input.canOpenPublicAdoption ? 'ready' : 'needs-action',
        detail: 'Novas features devem entrar como v1.1.0 planejado ou hotfix estreito.',
      },
    ];
  }

  private buildReceipts(input: {
    showcaseReady: boolean;
    releaseReady: boolean;
    adoptionReady: boolean;
    supportLoopReady: boolean;
    feedbackMetricsReady: boolean;
    ltsHotfixPolicyReady: boolean;
  }): ReleaseAdoptionReadinessReceipt[] {
    return [
      {
        id: 'release-adoption:showcase',
        kind: 'showcase',
        source: 'IntegrationShowcasePartnerSurfaceService',
        detail: input.showcaseReady ? 'Showcase pronto.' : 'Showcase pendente.',
        status: input.showcaseReady ? 'ready' : 'needs-action',
      },
      {
        id: 'release-adoption:release-train',
        kind: 'release-train',
        source: 'ReleaseTrainService',
        detail: input.releaseReady ? 'Release train ready.' : 'Release train pendente.',
        status: input.releaseReady ? 'ready' : 'needs-action',
      },
      {
        id: 'release-adoption:public-adoption',
        kind: 'adoption',
        source: 'PublicAdoptionReadinessService',
        detail: input.adoptionReady ? 'Public adoption ready.' : 'Public adoption pendente.',
        status: input.adoptionReady ? 'ready' : 'needs-action',
      },
      {
        id: 'release-adoption:support',
        kind: 'support',
        source: 'PublicAdoptionPilotLoopService',
        detail: input.supportLoopReady ? 'Support loop controlado pronto.' : 'Support loop pendente.',
        status: input.supportLoopReady ? 'ready' : 'needs-action',
      },
      {
        id: 'release-adoption:feedback',
        kind: 'feedback',
        source: 'FeedbackTelemetryProductLoopService',
        detail: input.feedbackMetricsReady ? 'Metricas agregadas e feedback opt-in.' : 'Metricas/feedback pendentes.',
        status: input.feedbackMetricsReady ? 'ready' : 'needs-action',
      },
      {
        id: 'release-adoption:policy',
        kind: 'policy',
        source: 'ReleaseAdoptionReadinessService',
        detail: input.ltsHotfixPolicyReady
          ? 'Sem deploy/canary, sem telemetry implicita e com rollback preview obrigatorio.'
          : 'Politica LTS/hotfix precisa ficar pronta antes de release forte.',
        status: input.ltsHotfixPolicyReady ? 'ready' : 'needs-action',
      },
    ];
  }

  private resolveNextSafeAction(status: ReleaseAdoptionReadinessStatus): string {
    if (status === 'needs-integration-showcase') {
      return 'Fechar Integration Showcase como showcase-ready antes de consolidar release/adoption.';
    }
    if (status === 'needs-release-train') {
      return 'Anexar ReleaseTrainSnapshot ready com baseline, rollback, hotfix e LTS.';
    }
    if (status === 'needs-public-adoption') {
      return 'Anexar PublicAdoptionReadinessSnapshot ready com runbook, claims e riscos.';
    }
    if (status === 'needs-support-loop') {
      return 'Fechar suporte com pilotos planejados, triagem, ledger e zavorthControl agregado.';
    }
    if (status === 'needs-feedback-metrics') {
      return 'Manter feedback opt-in e publicar apenas metricas agregadas.';
    }
    if (status === 'blocked') {
      return 'Remover bloqueios de showcase, release train ou public adoption antes de abrir adocao.';
    }
    return 'Abrir adocao publica controlada sem deploy/canary automatico; novas features entram em v1.1.0 planejado.';
  }
}
