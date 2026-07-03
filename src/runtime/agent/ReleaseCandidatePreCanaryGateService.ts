import type { CapabilityAutopilotReleaseCandidateSnapshot } from '../../services/CapabilityAutopilotReleaseCandidateGateService.js';
import type { IntegrationShowcasePartnerSurfaceSnapshot } from './IntegrationShowcasePartnerSurfaceService.js';
import type { ReleaseAdoptionReadinessSnapshot } from './ReleaseAdoptionReadinessService.js';
import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';

export const RELEASE_CANDIDATE_PRE_CANARY_GATE_CONTRACT_VERSION = '2026-05-04.pre-canary' as const;
export const RELEASE_CANDIDATE_PRE_CANARY_GATE_METADATA_KEY = 'releaseCandidatePreCanaryGate' as const;

export type ReleaseCandidatePreCanaryGateStatus =
  | 'pre-canary-ready'
  | 'needs-release-adoption-readiness'
  | 'needs-evidence-pack'
  | 'needs-ecosystem-publishing'
  | 'needs-autopilot-readiness'
  | 'needs-go-no-go'
  | 'blocked';

export type ReleaseCandidatePreCanaryGateStatusLevel = 'ready' | 'needs-action' | 'blocked' | 'unknown';

export type ReleaseCandidatePreCanaryGateSource =
  | 'ReleaseAdoptionReadinessService'
  | 'ReleaseCandidateEvidencePack'
  | 'IntegrationShowcasePartnerSurfaceService'
  | 'CapabilityAutopilotReleaseCandidateGateService'
  | 'ReleaseCandidatePreCanaryGateService';

export type ReleaseCandidatePreCanaryGate = {
  id: string;
  label: string;
  status: ReleaseCandidatePreCanaryGateStatusLevel;
  source: ReleaseCandidatePreCanaryGateSource;
  command: string;
  detail: string;
  critical: boolean;
};

export type ReleaseCandidatePreCanarySurface = {
  id: 'cli' | 'control' | 'evidence' | 'ecosystem' | 'autopilot' | 'go-no-go' | 'rollback' | 'next-cycle';
  label: string;
  routeOrCommand: string;
  status: ReleaseCandidatePreCanaryGateStatusLevel;
  detail: string;
};

export type ReleaseCandidatePreCanaryReceipt = {
  id: string;
  kind: 'release-adoption' | 'evidence' | 'ecosystem' | 'autopilot' | 'go-no-go' | 'policy';
  source: ReleaseCandidatePreCanaryGateSource;
  detail: string;
  status: ReleaseCandidatePreCanaryGateStatusLevel;
};

export type ReleaseCandidatePreCanaryEvidencePack = {
  linked: boolean;
  status: string;
  checkCount: number;
  passCount: number;
  artifactCount: number;
  releaseNotesReady: boolean;
  changelogReady: boolean;
  rollbackPreviewReady: boolean;
  knownIssuesReady: boolean;
  evidencePackReady: boolean;
};

export type ReleaseCandidatePreCanaryEcosystem = {
  linked: boolean;
  status: string;
  integrationCount: number;
  fixtureReadyCount: number;
  docsReady: boolean;
  matrixReady: boolean;
  partnerSurfaceReady: boolean;
  noFormalPartnerClaim: boolean;
  ecosystemPublishingReady: boolean;
};

export type ReleaseCandidatePreCanaryAutopilot = {
  linked: boolean;
  status: CapabilityAutopilotReleaseCandidateSnapshot['status'] | 'unknown';
  recommendation: CapabilityAutopilotReleaseCandidateSnapshot['recommendation'] | 'unknown';
  releaseCandidateReady: boolean;
  killSwitchReady: boolean;
  stagedRolloutPlanReady: boolean;
  rollbackRehearsalFresh: boolean;
  telemetryReviewPassed: boolean;
  privacyReviewPassed: boolean;
  rcFlagDefaultOff: boolean;
  globalRolloutEnabled: boolean;
  autoPromoteEnabled: boolean;
  blockerCount: number;
};

export type ReleaseCandidatePreCanaryGateSnapshot = {
  contractVersion: typeof RELEASE_CANDIDATE_PRE_CANARY_GATE_CONTRACT_VERSION;
  source: 'ReleaseCandidatePreCanaryGateService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: ReleaseCandidatePreCanaryGateStatus;
  releaseAdoption: {
    linked: boolean;
    status: ReleaseAdoptionReadinessSnapshot['status'] | 'unknown';
    ready: boolean;
    canOpenPublicAdoption: boolean;
    canStartCanary: false;
  };
  evidencePack: ReleaseCandidatePreCanaryEvidencePack;
  ecosystem: ReleaseCandidatePreCanaryEcosystem;
  autopilot: ReleaseCandidatePreCanaryAutopilot;
  goNoGo: {
    linked: boolean;
    decision: 'go' | 'no-go' | 'unknown';
    ready: boolean;
    explicitApproval: boolean;
    approverId: string | null;
    approvalReceiptId: string | null;
    rollbackOwner: string | null;
    incidentOwner: string | null;
    reasonCount: number;
    canaryStarted: false;
    rolloutStarted: false;
  };
  readiness: {
    releaseAdoptionReady: boolean;
    evidencePackReady: boolean;
    ecosystemPublishingReady: boolean;
    autopilotReleaseCandidateReady: boolean;
    goNoGoReady: boolean;
    governanceReady: boolean;
    rollbackReady: boolean;
    canOpenPreCanary: boolean;
    canStartCanary: false;
    rolloutStarted: false;
  };
  gates: ReleaseCandidatePreCanaryGate[];
  surfaces: ReleaseCandidatePreCanarySurface[];
  receipts: ReleaseCandidatePreCanaryReceipt[];
  policy: {
    noCanaryStarted: true;
    noRolloutStarted: true;
    noDeployExecuted: true;
    noGlobalRolloutEnabled: true;
    noAutoPromoteEnabled: true;
    noTelemetryEnabled: true;
    noExternalMutation: true;
    noSecretsSerialized: true;
    goNoGoRequiresExplicitApproval: true;
    rollbackPreviewRequired: true;
    ecosystemClaimsRequireEvidence: true;
    naturalLanguageDoesNotBypassPolicy: true;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
    evidencePackCommand: 'npm run qa:release-train';
    integrationCommand: 'npm run qa:integration-showcase';
    autopilotCommand: 'npm run qa:capability-autopilot-release-candidate';
    phaseGateCommand: 'npm run qa:phase:59';
    rollbackPreviewCommand: 'npm run release:rollback-preview';
  };
  nextSafeAction: string;
};

export type ReleaseCandidatePreCanaryGateInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
};

type ReleaseCandidatePreCanaryGateRuntime = {
  now?: () => Date;
};

import {
  arrayOrEmpty,
  booleanFromRecord,
  normalizeText,
  numberOrZero,
  recordOrNull,
  resolveReleaseCandidateNextSafeAction,
  statusLevel,
  type LooseRecord,
} from './ReleaseCandidatePreCanaryGateHelpers.js';

export class ReleaseCandidatePreCanaryGateService {
  private readonly now: () => Date;

  constructor(runtime: ReleaseCandidatePreCanaryGateRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: ReleaseCandidatePreCanaryGateInput): ReleaseCandidatePreCanaryGateSnapshot {
    const { run } = input;
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const releaseAdoption = this.readReleaseAdoption(run);
    const evidencePack = this.readEvidencePack(run);
    const ecosystem = this.readEcosystem(run);
    const autopilot = this.readAutopilot(run);
    const goNoGo = this.readGoNoGo(run);

    const releaseAdoptionReady = Boolean(
      releaseAdoption?.status === 'release-adoption-ready'
      && releaseAdoption.readiness?.canOpenPublicAdoption === true
      && releaseAdoption.readiness?.canStartCanary === false,
    );
    const governanceReady = Boolean(
      autopilot.rcFlagDefaultOff
      && !autopilot.globalRolloutEnabled
      && !autopilot.autoPromoteEnabled
      && autopilot.telemetryReviewPassed
      && autopilot.privacyReviewPassed,
    );
    const rollbackReady = evidencePack.rollbackPreviewReady
      && autopilot.killSwitchReady
      && autopilot.rollbackRehearsalFresh;
    const autopilotReleaseCandidateReady = Boolean(
      autopilot.releaseCandidateReady
      && autopilot.status === 'release_candidate_ready'
      && autopilot.recommendation === 'promote_to_release_candidate'
      && autopilot.blockerCount === 0
      && governanceReady
      && rollbackReady,
    );
    const canOpenPreCanary = Boolean(
      releaseAdoptionReady
      && evidencePack.evidencePackReady
      && ecosystem.ecosystemPublishingReady
      && autopilotReleaseCandidateReady
      && goNoGo.ready,
    );
    const blocked = Boolean(
      releaseAdoption?.status === 'blocked'
      || evidencePack.status === 'blocked'
      || ecosystem.status === 'blocked'
      || autopilot.status === 'blocked'
      || autopilot.globalRolloutEnabled
      || autopilot.autoPromoteEnabled
      || goNoGo.decision === 'no-go',
    );
    const status = this.resolveStatus({
      blocked,
      releaseAdoptionReady,
      evidencePackReady: evidencePack.evidencePackReady,
      ecosystemPublishingReady: ecosystem.ecosystemPublishingReady,
      autopilotReleaseCandidateReady,
      goNoGoReady: goNoGo.ready,
      canOpenPreCanary,
    });
    const readiness = {
      releaseAdoptionReady,
      evidencePackReady: evidencePack.evidencePackReady,
      ecosystemPublishingReady: ecosystem.ecosystemPublishingReady,
      autopilotReleaseCandidateReady,
      goNoGoReady: goNoGo.ready,
      governanceReady,
      rollbackReady,
      canOpenPreCanary,
      canStartCanary: false as const,
      rolloutStarted: false as const,
    };

    return {
      contractVersion: RELEASE_CANDIDATE_PRE_CANARY_GATE_CONTRACT_VERSION,
      source: 'ReleaseCandidatePreCanaryGateService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
      },
      status,
      releaseAdoption: {
        linked: Boolean(releaseAdoption),
        status: releaseAdoption?.status || 'unknown',
        ready: releaseAdoptionReady,
        canOpenPublicAdoption: releaseAdoption?.readiness?.canOpenPublicAdoption === true,
        canStartCanary: false,
      },
      evidencePack,
      ecosystem,
      autopilot,
      goNoGo: {
        ...goNoGo,
        canaryStarted: false,
        rolloutStarted: false,
      },
      readiness,
      gates: this.buildGates({
        releaseAdoptionReady,
        releaseAdoptionLinked: Boolean(releaseAdoption),
        evidencePack,
        ecosystem,
        autopilot,
        autopilotReleaseCandidateReady,
        goNoGoReady: goNoGo.ready,
        goNoGoLinked: goNoGo.linked,
        blocked,
      }),
      surfaces: this.buildSurfaces({
        evidencePack,
        ecosystem,
        autopilotReleaseCandidateReady,
        goNoGoReady: goNoGo.ready,
        canOpenPreCanary,
      }),
      receipts: this.buildReceipts({
        releaseAdoptionReady,
        evidencePackReady: evidencePack.evidencePackReady,
        ecosystemPublishingReady: ecosystem.ecosystemPublishingReady,
        autopilotReleaseCandidateReady,
        goNoGoReady: goNoGo.ready,
        governanceReady,
      }),
      policy: {
        noCanaryStarted: true,
        noRolloutStarted: true,
        noDeployExecuted: true,
        noGlobalRolloutEnabled: true,
        noAutoPromoteEnabled: true,
        noTelemetryEnabled: true,
        noExternalMutation: true,
        noSecretsSerialized: true,
        goNoGoRequiresExplicitApproval: true,
        rollbackPreviewRequired: true,
        ecosystemClaimsRequireEvidence: true,
        naturalLanguageDoesNotBypassPolicy: true,
      },
      surface: {
        cliCommand: `zavorth release-candidate-pre-canary run ${run.id} --json`,
        zavorthControlPath: `/zavorthControl?runId=${encodeURIComponent(run.id)}&sector=config`,
        evidencePackCommand: 'npm run qa:release-train',
        integrationCommand: 'npm run qa:integration-showcase',
        autopilotCommand: 'npm run qa:capability-autopilot-release-candidate',
        phaseGateCommand: 'npm run qa:phase:59',
        rollbackPreviewCommand: 'npm run release:rollback-preview',
      },
      nextSafeAction: resolveReleaseCandidateNextSafeAction(status),
    };
  }

  private readReleaseAdoption(run: UniversalAgentRun): ReleaseAdoptionReadinessSnapshot | null {
    const metadata = recordOrNull(run.metadata.releaseAdoptionReadiness)
      || recordOrNull(run.metadata.releaseAdoption)
      || recordOrNull(run.metadata.publicAdoptionReleaseReadiness);
    return metadata as unknown as ReleaseAdoptionReadinessSnapshot | null;
  }

  private readEvidencePack(run: UniversalAgentRun): ReleaseCandidatePreCanaryEvidencePack {
    const raw = recordOrNull(run.metadata.releaseCandidateEvidencePack)
      || recordOrNull(run.metadata.releaseCandidateEvidence)
      || recordOrNull(run.metadata.rcEvidencePack)
      || recordOrNull(run.metadata.releaseTrain);
    const checks = arrayOrEmpty(raw?.checks);
    const artifacts = arrayOrEmpty(raw?.artifacts) || [];
    const artifactRecord = recordOrNull(raw?.artifacts);
    const releaseNotes = recordOrNull(raw?.releaseNotes);
    const changelog = recordOrNull(raw?.changelog);
    const rollback = recordOrNull(raw?.rollback)
      || recordOrNull(raw?.rollbackPreview)
      || recordOrNull(raw?.rollbackPlan);
    const knownIssues = recordOrNull(raw?.knownIssues);
    const checkCount = Math.max(
      checks.length,
      numberOrZero(raw?.checkCount),
      numberOrZero(recordOrNull(raw?.summary)?.passed) + numberOrZero(recordOrNull(raw?.summary)?.failed),
    );
    const passCount = Math.max(
      checks.filter((check) => recordOrNull(check)?.status === 'pass' || recordOrNull(check)?.passed === true).length,
      numberOrZero(raw?.passCount),
      numberOrZero(recordOrNull(raw?.summary)?.passed),
    );
    const artifactCount = Math.max(
      artifacts.length,
      numberOrZero(raw?.artifactCount),
      artifactRecord ? Object.keys(artifactRecord).length : 0,
    );
    const releaseNotesReady = raw?.releaseNotesReady === true
      || releaseNotes?.ready === true
      || normalizeText(releaseNotes?.status) === 'ready';
    const changelogReady = raw?.changelogReady === true
      || changelog?.ready === true
      || normalizeText(changelog?.status) === 'ready';
    const rollbackPreviewReady = raw?.rollbackPreviewReady === true
      || rollback?.ready === true
      || normalizeText(rollback?.status) === 'ready'
      || arrayOrEmpty(raw?.hotfixPlaybook).length >= 4;
    const knownIssuesReady = raw?.knownIssuesReady === true
      || knownIssues?.ready === true
      || normalizeText(knownIssues?.status) === 'ready'
      || arrayOrEmpty(raw?.releaseCandidateChecklist).length >= 5;
    const evidencePackReady = Boolean(
      raw
      && (normalizeText(raw.status) === 'ready' || normalizeText(raw.status) === 'evidence-ready' || normalizeText(raw.status) === 'release-candidate-ready')
      && checkCount >= 4
      && passCount >= checkCount
      && artifactCount >= 4
      && releaseNotesReady
      && changelogReady
      && rollbackPreviewReady
      && knownIssuesReady,
    );

    return {
      linked: Boolean(raw),
      status: normalizeText(raw?.status, raw ? 'unknown' : 'missing'),
      checkCount,
      passCount,
      artifactCount,
      releaseNotesReady,
      changelogReady,
      rollbackPreviewReady,
      knownIssuesReady,
      evidencePackReady,
    };
  }

  private readEcosystem(run: UniversalAgentRun): ReleaseCandidatePreCanaryEcosystem {
    const raw = recordOrNull(run.metadata.ecosystemPublishing)
      || recordOrNull(run.metadata.integrationEcosystem)
      || recordOrNull(run.metadata.publicEcosystem);
    const showcase = recordOrNull(run.metadata.integrationShowcasePartnerSurface) as IntegrationShowcasePartnerSurfaceSnapshot | null;
    const showcaseBody = recordOrNull(showcase?.showcase);
    const integrations = arrayOrEmpty(raw?.integrations);
    const fixtures = arrayOrEmpty(raw?.fixtures);
    const docs = recordOrNull(raw?.docs);
    const matrix = recordOrNull(raw?.matrix);
    const partnerSurface = recordOrNull(raw?.partnerSurface);
    const integrationCount = Math.max(
      integrations.length,
      numberOrZero(raw?.integrationCount),
      numberOrZero(showcaseBody?.vendorCount),
    );
    const fixtureReadyCount = Math.max(
      fixtures.filter((fixture) => recordOrNull(fixture)?.ready === true || normalizeText(recordOrNull(fixture)?.status) === 'ready').length,
      numberOrZero(raw?.fixtureReadyCount),
      numberOrZero(showcaseBody?.fixtureReadyCount),
    );
    const docsReady = raw?.docsReady === true
      || docs?.ready === true
      || normalizeText(docs?.status) === 'ready';
    const matrixReady = raw?.matrixReady === true
      || matrix?.ready === true
      || normalizeText(matrix?.status) === 'ready';
    const partnerSurfaceReady = raw?.partnerSurfaceReady === true
      || partnerSurface?.ready === true
      || normalizeText(partnerSurface?.status) === 'ready'
      || showcase?.status === 'showcase-ready';
    const noFormalPartnerClaim = raw?.noFormalPartnerClaim === true
      || raw?.partnerClaimBlocked === false
      || showcase?.status === 'showcase-ready';
    const status = normalizeText(raw?.status, showcase?.status || 'missing');
    const ecosystemPublishingReady = Boolean(
      (raw || showcase)
      && (status === 'ready' || status === 'publishable' || status === 'showcase-ready')
      && integrationCount >= 4
      && fixtureReadyCount >= 4
      && docsReady
      && matrixReady
      && partnerSurfaceReady
      && noFormalPartnerClaim,
    );

    return {
      linked: Boolean(raw || showcase),
      status,
      integrationCount,
      fixtureReadyCount,
      docsReady,
      matrixReady,
      partnerSurfaceReady,
      noFormalPartnerClaim,
      ecosystemPublishingReady,
    };
  }

  private readAutopilot(run: UniversalAgentRun): ReleaseCandidatePreCanaryAutopilot {
    const raw = recordOrNull(run.metadata.capabilityAutopilotReleaseCandidate)
      || recordOrNull(run.metadata.autopilotReleaseCandidate)
      || recordOrNull(run.metadata.capabilityAutopilotReleaseCandidateGate);
    const readinessControls = recordOrNull(raw?.readinessControls);
    const governance = recordOrNull(raw?.governance);
    const metadata = recordOrNull(raw?.metadata);
    const blockers = arrayOrEmpty(raw?.blockers);
    const status = normalizeText(raw?.status, 'unknown') as CapabilityAutopilotReleaseCandidateSnapshot['status'] | 'unknown';
    const recommendation = normalizeText(raw?.recommendation, 'unknown') as CapabilityAutopilotReleaseCandidateSnapshot['recommendation'] | 'unknown';
    const releaseCandidateReady = raw?.releaseCandidateReady === true
      || metadata?.releaseCandidateReady === true
      || (status === 'release_candidate_ready' && recordOrNull(raw?.summary)?.ok === true);

    return {
      linked: Boolean(raw),
      status,
      recommendation,
      releaseCandidateReady,
      killSwitchReady: booleanFromRecord(readinessControls, 'killSwitchReady'),
      stagedRolloutPlanReady: booleanFromRecord(readinessControls, 'stagedRolloutPlanReady'),
      rollbackRehearsalFresh: booleanFromRecord(readinessControls, 'rollbackRehearsalFresh'),
      telemetryReviewPassed: booleanFromRecord(governance, 'telemetryReviewPassed'),
      privacyReviewPassed: booleanFromRecord(governance, 'privacyReviewPassed'),
      rcFlagDefaultOff: booleanFromRecord(governance, 'rcFlagDefaultOff'),
      globalRolloutEnabled: booleanFromRecord(governance, 'globalRolloutEnabled'),
      autoPromoteEnabled: booleanFromRecord(governance, 'autoPromoteEnabled'),
      blockerCount: Math.max(blockers.length, numberOrZero(raw?.blockerCount)),
    };
  }

  private readGoNoGo(run: UniversalAgentRun): {
    linked: boolean;
    decision: 'go' | 'no-go' | 'unknown';
    ready: boolean;
    explicitApproval: boolean;
    approverId: string | null;
    approvalReceiptId: string | null;
    rollbackOwner: string | null;
    incidentOwner: string | null;
    reasonCount: number;
  } {
    const raw = recordOrNull(run.metadata.goNoGoDecision)
      || recordOrNull(run.metadata.preCanaryGoNoGo)
      || recordOrNull(run.metadata.releaseCandidateDecision);
    const decisionText = normalizeText(raw?.decision || raw?.status).toLowerCase();
    const decision = decisionText === 'go'
      ? 'go'
      : decisionText === 'no-go' || decisionText === 'nogo' || decisionText === 'blocked'
        ? 'no-go'
        : 'unknown';
    const explicitApproval = raw?.explicitApproval === true || raw?.approved === true;
    const approverId = normalizeText(raw?.approverId || raw?.approver) || null;
    const approvalReceiptId = normalizeText(raw?.approvalReceiptId || raw?.receiptId) || null;
    const rollbackOwner = normalizeText(raw?.rollbackOwner || raw?.rollbackOwnerId) || null;
    const incidentOwner = normalizeText(raw?.incidentOwner || raw?.incidentOwnerId) || null;
    const ready = Boolean(
      raw
      && decision === 'go'
      && explicitApproval
      && approverId
      && approvalReceiptId
      && rollbackOwner
      && incidentOwner,
    );

    return {
      linked: Boolean(raw),
      decision,
      ready,
      explicitApproval,
      approverId,
      approvalReceiptId,
      rollbackOwner,
      incidentOwner,
      reasonCount: arrayOrEmpty(raw?.reasons).length,
    };
  }

  private resolveStatus(input: {
    blocked: boolean;
    releaseAdoptionReady: boolean;
    evidencePackReady: boolean;
    ecosystemPublishingReady: boolean;
    autopilotReleaseCandidateReady: boolean;
    goNoGoReady: boolean;
    canOpenPreCanary: boolean;
  }): ReleaseCandidatePreCanaryGateStatus {
    if (input.blocked) {
      return 'blocked';
    }
    if (!input.releaseAdoptionReady) {
      return 'needs-release-adoption-readiness';
    }
    if (!input.evidencePackReady) {
      return 'needs-evidence-pack';
    }
    if (!input.ecosystemPublishingReady) {
      return 'needs-ecosystem-publishing';
    }
    if (!input.autopilotReleaseCandidateReady) {
      return 'needs-autopilot-readiness';
    }
    if (!input.goNoGoReady) {
      return 'needs-go-no-go';
    }
    return input.canOpenPreCanary ? 'pre-canary-ready' : 'needs-go-no-go';
  }

  private buildGates(input: {
    releaseAdoptionReady: boolean;
    releaseAdoptionLinked: boolean;
    evidencePack: ReleaseCandidatePreCanaryEvidencePack;
    ecosystem: ReleaseCandidatePreCanaryEcosystem;
    autopilot: ReleaseCandidatePreCanaryAutopilot;
    autopilotReleaseCandidateReady: boolean;
    goNoGoReady: boolean;
    goNoGoLinked: boolean;
    blocked: boolean;
  }): ReleaseCandidatePreCanaryGate[] {
    return [
      {
        id: 'release-adoption-readiness',
        label: 'Release/adoption readiness fechado',
        status: statusLevel(input.releaseAdoptionReady, input.releaseAdoptionLinked),
        source: 'ReleaseAdoptionReadinessService',
        command: 'zavorth release-adoption-readiness --json',
        detail: input.releaseAdoptionReady
          ? 'Release Adoption Readiness permite adocao publica controlada e ainda impede canary.'
          : 'Pre-canary depende de release/adoption ready com canStartCanary false.',
        critical: true,
      },
      {
        id: 'evidence-pack',
        label: 'Evidence pack de release candidate',
        status: statusLevel(input.evidencePack.evidencePackReady, input.evidencePack.linked, input.evidencePack.status === 'blocked'),
        source: 'ReleaseCandidateEvidencePack',
        command: 'npm run qa:release-train',
        detail: input.evidencePack.evidencePackReady
          ? 'Checks, artifacts, release notes, changelog, rollback e known issues estao completos.'
          : 'Gerar evidence pack com pelo menos 4 checks, 4 artifacts e rollback preview.',
        critical: true,
      },
      {
        id: 'ecosystem-publishing',
        label: 'Ecossistema publicavel',
        status: statusLevel(input.ecosystem.ecosystemPublishingReady, input.ecosystem.linked, input.ecosystem.status === 'blocked'),
        source: 'IntegrationShowcasePartnerSurfaceService',
        command: 'npm run qa:integration-showcase',
        detail: input.ecosystem.ecosystemPublishingReady
          ? 'Integracoes, fixtures, docs, matriz e surface de parceiros estao publicaveis sem claim formal indevido.'
          : 'Consolidar matriz, docs e fixtures antes de qualquer pre-canary.',
        critical: true,
      },
      {
        id: 'autopilot-release-candidate',
        label: 'Autopilot release candidate ready',
        status: statusLevel(input.autopilotReleaseCandidateReady, input.autopilot.linked, input.autopilot.status === 'blocked'),
        source: 'CapabilityAutopilotReleaseCandidateGateService',
        command: 'npm run qa:capability-autopilot-release-candidate',
        detail: input.autopilotReleaseCandidateReady
          ? 'Autopilot tem RC aprovado, kill switch, rollback rehearsal e governance default-off.'
          : 'Autopilot precisa RC ready, sem blockers, sem global rollout e sem auto-promote.',
        critical: true,
      },
      {
        id: 'go-no-go',
        label: 'Go/no-go explicito',
        status: statusLevel(input.goNoGoReady, input.goNoGoLinked),
        source: 'ReleaseCandidatePreCanaryGateService',
        command: 'zavorth release-candidate-pre-canary --json',
        detail: input.goNoGoReady
          ? 'Aprovacao explicita vinculada a dono de rollback e incidente.'
          : 'Registrar decisao go com approver, receipt, rollback owner e incident owner.',
        critical: true,
      },
      {
        id: 'no-canary-no-rollout',
        label: 'Canary e rollout continuam desligados',
        status: statusLevel(!input.autopilot.globalRolloutEnabled && !input.autopilot.autoPromoteEnabled, true, input.blocked),
        source: 'ReleaseCandidatePreCanaryGateService',
        command: 'npm run qa:phase:59',
        detail: 'Pre-Canary Gate so abre pre-canary gate; nao executa canary, deploy, global rollout ou promocao automatica.',
        critical: true,
      },
    ];
  }

  private buildSurfaces(input: {
    evidencePack: ReleaseCandidatePreCanaryEvidencePack;
    ecosystem: ReleaseCandidatePreCanaryEcosystem;
    autopilotReleaseCandidateReady: boolean;
    goNoGoReady: boolean;
    canOpenPreCanary: boolean;
  }): ReleaseCandidatePreCanarySurface[] {
    return [
      {
        id: 'cli',
        label: 'CLI pre-canary gate',
        routeOrCommand: 'zavorth release-candidate-pre-canary --json',
        status: 'ready',
        detail: 'Snapshot read-only do gate RC/pre-canary.',
      },
      {
        id: 'control',
        label: 'ZavorthControl',
        routeOrCommand: '/zavorthControl?sector=config',
        status: 'ready',
        detail: 'Config mostra evidence pack, ecossistema, Autopilot e go/no-go.',
      },
      {
        id: 'evidence',
        label: 'Evidence pack',
        routeOrCommand: 'npm run qa:release-train',
        status: statusLevel(input.evidencePack.evidencePackReady, input.evidencePack.linked),
        detail: 'Evidence pack consolida checks e artifacts auditaveis.',
      },
      {
        id: 'ecosystem',
        label: 'Integration ecosystem',
        routeOrCommand: 'npm run qa:integration-showcase',
        status: statusLevel(input.ecosystem.ecosystemPublishingReady, input.ecosystem.linked),
        detail: 'Ecossistema fica publicavel somente com fixtures e docs.',
      },
      {
        id: 'autopilot',
        label: 'Capability Autopilot RC',
        routeOrCommand: 'npm run qa:capability-autopilot-release-candidate',
        status: input.autopilotReleaseCandidateReady ? 'ready' : 'needs-action',
        detail: 'Autopilot precisa RC ready e default-off governance.',
      },
      {
        id: 'go-no-go',
        label: 'Go/no-go',
        routeOrCommand: 'approval-ledger.json',
        status: input.goNoGoReady ? 'ready' : 'needs-action',
        detail: 'Decisao go/no-go exige aprovador e receipt.',
      },
      {
        id: 'rollback',
        label: 'Rollback preview',
        routeOrCommand: 'npm run release:rollback-preview',
        status: input.evidencePack.rollbackPreviewReady ? 'ready' : 'needs-action',
        detail: 'Rollback precisa estar ensaiado antes de qualquer canary futuro.',
      },
      {
        id: 'next-cycle',
        label: 'Pre-canary fechado',
        routeOrCommand: 'v1.1.0 pre-canary planning',
        status: input.canOpenPreCanary ? 'ready' : 'needs-action',
        detail: 'Quando pronto, o proximo ciclo pode planejar canary real em entrega separada.',
      },
    ];
  }

  private buildReceipts(input: {
    releaseAdoptionReady: boolean;
    evidencePackReady: boolean;
    ecosystemPublishingReady: boolean;
    autopilotReleaseCandidateReady: boolean;
    goNoGoReady: boolean;
    governanceReady: boolean;
  }): ReleaseCandidatePreCanaryReceipt[] {
    return [
      {
        id: 'pre-canary:release-adoption',
        kind: 'release-adoption',
        source: 'ReleaseAdoptionReadinessService',
        detail: input.releaseAdoptionReady ? 'Release/adoption ready.' : 'Release/adoption pendente.',
        status: input.releaseAdoptionReady ? 'ready' : 'needs-action',
      },
      {
        id: 'pre-canary:evidence-pack',
        kind: 'evidence',
        source: 'ReleaseCandidateEvidencePack',
        detail: input.evidencePackReady ? 'Evidence pack completo.' : 'Evidence pack pendente.',
        status: input.evidencePackReady ? 'ready' : 'needs-action',
      },
      {
        id: 'pre-canary:ecosystem',
        kind: 'ecosystem',
        source: 'IntegrationShowcasePartnerSurfaceService',
        detail: input.ecosystemPublishingReady ? 'Ecossistema publicavel.' : 'Ecossistema pendente.',
        status: input.ecosystemPublishingReady ? 'ready' : 'needs-action',
      },
      {
        id: 'pre-canary:autopilot',
        kind: 'autopilot',
        source: 'CapabilityAutopilotReleaseCandidateGateService',
        detail: input.autopilotReleaseCandidateReady ? 'Autopilot RC pronto.' : 'Autopilot RC pendente.',
        status: input.autopilotReleaseCandidateReady ? 'ready' : 'needs-action',
      },
      {
        id: 'pre-canary:go-no-go',
        kind: 'go-no-go',
        source: 'ReleaseCandidatePreCanaryGateService',
        detail: input.goNoGoReady ? 'Go/no-go aprovado.' : 'Go/no-go pendente.',
        status: input.goNoGoReady ? 'ready' : 'needs-action',
      },
      {
        id: 'pre-canary:policy',
        kind: 'policy',
        source: 'ReleaseCandidatePreCanaryGateService',
        detail: input.governanceReady
          ? 'Default-off governance confirma sem canary, rollout, deploy ou auto-promote.'
          : 'Governance precisa ficar default-off antes do pre-canary.',
        status: input.governanceReady ? 'ready' : 'needs-action',
      },
    ];
  }
}
