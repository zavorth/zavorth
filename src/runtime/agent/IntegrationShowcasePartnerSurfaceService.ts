import type { IntegrationShowcaseSnapshot } from '../../contracts/IntegrationShowcaseContract.js';
import type { PublicAdoptionPilotLoopSnapshot } from './PublicAdoptionPilotLoopService.js';
import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';export const INTEGRATION_SHOWCASE_PARTNER_SURFACE_CONTRACT_VERSION = '2026-05-04.integration-showcase' as const;
export const INTEGRATION_SHOWCASE_PARTNER_SURFACE_METADATA_KEY = 'integrationShowcasePartnerSurface' as const;

export type IntegrationShowcasePartnerSurfaceStatus =
  | 'showcase-ready'
  | 'needs-public-adoption-pilot-loop'
  | 'needs-integration-showcase'
  | 'needs-smoke'
  | 'needs-matrix'
  | 'needs-partner-surface'
  | 'blocked'
  | 'partner-claim-blocked';

export type IntegrationShowcasePartnerSurfaceGateStatus = 'ready' | 'needs-action' | 'blocked' | 'unknown';

export type IntegrationShowcasePartnerSurfaceGate = {
  id: string;
  label: string;
  status: IntegrationShowcasePartnerSurfaceGateStatus;
  source:
    | 'PublicAdoptionPilotLoopService'
    | 'IntegrationShowcaseService'
    | 'IntegrationShowcasePartnerSurfaceService';
  command: string;
  detail: string;
  critical: boolean;
};

export type IntegrationShowcasePartnerSurfaceSurface = {
  id: 'cli' | 'control' | 'integrations' | 'docs' | 'smoke' | 'matrix' | 'partner-surface' | 'next-phase';
  label: string;
  routeOrCommand: string;
  status: IntegrationShowcasePartnerSurfaceGateStatus;
  detail: string;
};

export type IntegrationShowcasePartnerSurfaceReceipt = {
  id: string;
  kind: 'pilot-loop' | 'showcase' | 'smoke' | 'matrix' | 'partner-surface' | 'policy';
  source: string;
  detail: string;
  status: IntegrationShowcasePartnerSurfaceGateStatus;
};

export type IntegrationShowcasePartnerSurfaceSnapshot = {
  contractVersion: typeof INTEGRATION_SHOWCASE_PARTNER_SURFACE_CONTRACT_VERSION;
  source: 'IntegrationShowcasePartnerSurfaceService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: IntegrationShowcasePartnerSurfaceStatus;
  publicAdoptionPilotLoop: {
    linked: boolean;
    status: PublicAdoptionPilotLoopSnapshot['status'] | 'unknown';
    pilotReady: boolean;
    qaCommand: string | null;
  };
  showcase: {
    contractLinked: boolean;
    contractStatus: 'ready' | 'attention' | 'blocked' | 'unknown';
    gate: 'integration-showcase' | null;
    routeCount: number;
    integrationCount: number;
    vendorCount: number;
    fixtureReadyCount: number;
    credentialModeCount: number;
    formalPartnersRegistered: number;
    nextStage: string | null;
  };
  artifacts: {
    smokePath: string | null;
    matrixPath: string | null;
    partnerSurfacePath: string | null;
    smokeReady: boolean;
    matrixReady: boolean;
    partnerSurfaceReady: boolean;
  };
  partnerSurface: {
    registryRequiredForFormalClaim: boolean;
    allowedClaimCount: number;
    prohibitedClaimCount: number;
    auditArtifactCount: number;
    unsafeFormalClaims: string[];
    canClaimFormalPartner: false;
  };
  readiness: {
    publicAdoptionPilotLoopReady: boolean;
    integrationShowcaseLinked: boolean;
    routesReady: boolean;
    fixtureModesReady: boolean;
    capabilityMatrixReady: boolean;
    trustPlaneReady: boolean;
    partnerSurfacePolicyReady: boolean;
    artifactsReady: boolean;
    canPublishShowcasePreview: boolean;
    canClaimFormalPartner: false;
  };
  gates: IntegrationShowcasePartnerSurfaceGate[];
  surfaces: IntegrationShowcasePartnerSurfaceSurface[];
  receipts: IntegrationShowcasePartnerSurfaceReceipt[];
  policy: {
    noFormalPartnerClaimWithoutRegistry: true;
    noCredentialRequiredForFixture: true;
    noNetworkRequiredForFixture: true;
    noExternalMutation: true;
    noSecretsSerialized: true;
    fixtureFirst: true;
    safeDegradationRequired: true;
    trustPlaneRequired: true;
    partnerSurfaceAuditable: true;
    naturalLanguageDoesNotBypassPolicy: true;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
    integrationsRoute: '/integrations';
    docsAnchor: '/docs#integration-showcase';
    integrationShowcaseCommand: 'npm run integration-showcase';
    qaCommand: 'npm run qa:integration-showcase';
    gateCommand: 'npm run qa:integration-showcase';
    smokeArtifact: 'integration-smoke.json';
    matrixArtifact: 'capability-matrix.json';
    partnerSurfaceArtifact: 'partner-surface.json';
  };
  nextSafeAction: string;
};

export type IntegrationShowcasePartnerSurfaceInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
};

type IntegrationShowcasePartnerSurfaceDependencies = {
  now?: () => Date;
  integrationShowcaseService?: { buildSnapshot(): IntegrationShowcaseSnapshot } | null;
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

function normalizeShowcaseStatus(value: unknown): IntegrationShowcasePartnerSurfaceSnapshot['showcase']['contractStatus'] {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'ready' || raw === 'attention' || raw === 'blocked') {
    return raw;
  }
  return 'unknown';
}

function gateStatusFromShowcaseStatus(status: IntegrationShowcasePartnerSurfaceSnapshot['showcase']['contractStatus']): IntegrationShowcasePartnerSurfaceGateStatus {
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

function hasPassingCheck(showcase: IntegrationShowcaseSnapshot | null, checkId: string): boolean {
  return Boolean(showcase?.checks?.some((check) => check.id === checkId && check.status === 'pass'));
}

export class IntegrationShowcasePartnerSurfaceService {
  private readonly now: () => Date;
  private readonly integrationShowcaseService: { buildSnapshot(): IntegrationShowcaseSnapshot } | null;

  constructor(runtime: IntegrationShowcasePartnerSurfaceDependencies = {}) {
    this.now = runtime.now || (() => new Date());
    this.integrationShowcaseService = runtime.integrationShowcaseService || null;
  }

  public buildSnapshot(input: IntegrationShowcasePartnerSurfaceInput): IntegrationShowcasePartnerSurfaceSnapshot {
    const { run } = input;
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const pilotLoop = recordOrNull(run.metadata.publicAdoptionPilotLoop) as PublicAdoptionPilotLoopSnapshot | null;
    const showcase = this.readIntegrationShowcase(run);
    const pilotSurface = recordOrNull(pilotLoop?.surface);
    const showcaseArtifacts = recordOrNull(showcase?.artifacts);
    const showcaseStatus = normalizeShowcaseStatus(showcase?.status);
    const integrations = arrayOrEmpty<{
      id?: string;
      vendor?: string;
      modes?: string[];
      fixtureAvailable?: boolean;
      trustPlaneControls?: string[];
      partnerStatus?: string;
      formalPartnerRegistered?: boolean;
    }>(showcase?.integrations);
    const matrix = arrayOrEmpty<{ id?: string; modes?: string[]; fixtureAvailable?: boolean; capabilities?: string[] }>(showcase?.matrix);
    const partnerPolicy = recordOrNull(showcase?.partnerPolicy);
    const pilotReady = pilotLoop?.status === 'pilot-ready';
    const smokeReady = hasPassingCheck(showcase, 'integration-showcase:smoke-artifact');
    const matrixReady = hasPassingCheck(showcase, 'integration-showcase:matrix-artifact') && matrix.length >= integrations.length && matrix.length >= 4;
    const partnerSurfaceReady = hasPassingCheck(showcase, 'integration-showcase:partner-artifact');
    const routesReady = Boolean(showcase?.routes?.includes('/integrations') && showcase?.routes?.includes('/docs#integration-showcase'));
    const fixtureModesReady = integrations.length >= 4 && integrations.every((item) => item.fixtureAvailable === true && arrayOrEmpty<string>(item.modes).includes('fixture'));
    const trustPlaneText = integrations.flatMap((item) => arrayOrEmpty<string>(item.trustPlaneControls)).join('\n').toLowerCase();
    const trustPlaneReady = ['approval', 'policy', 'audit'].every((term) => trustPlaneText.includes(term));
    const unsafeFormalClaims = integrations
      .filter((item) => item.partnerStatus === 'registered-partner' && item.formalPartnerRegistered !== true)
      .map((item) => normalizeText(item.id, 'integration'));
    const partnerSurfacePolicyReady = Boolean(
      partnerPolicy?.registryRequiredForFormalClaim === true
      && arrayOrEmpty(partnerPolicy?.allowedClaims).length >= 3
      && arrayOrEmpty(partnerPolicy?.prohibitedClaims).length >= 3
      && arrayOrEmpty(partnerPolicy?.auditArtifacts).length >= 3
      && unsafeFormalClaims.length === 0,
    );
    const artifactsReady = smokeReady && matrixReady && partnerSurfaceReady;
    const canPublishShowcasePreview = Boolean(
      pilotReady
      && showcaseStatus === 'ready'
      && routesReady
      && fixtureModesReady
      && matrixReady
      && trustPlaneReady
      && partnerSurfacePolicyReady
      && artifactsReady,
    );
    const status = this.resolveStatus({
      pilotLoop,
      pilotReady,
      showcase,
      showcaseStatus,
      smokeReady,
      matrixReady,
      partnerSurfaceReady,
      unsafeFormalClaims,
      canPublishShowcasePreview,
    });
    const readiness = {
      publicAdoptionPilotLoopReady: pilotReady,
      integrationShowcaseLinked: Boolean(showcase),
      routesReady,
      fixtureModesReady,
      capabilityMatrixReady: matrixReady,
      trustPlaneReady,
      partnerSurfacePolicyReady,
      artifactsReady,
      canPublishShowcasePreview,
      canClaimFormalPartner: false as const,
    };

    return {
      contractVersion: INTEGRATION_SHOWCASE_PARTNER_SURFACE_CONTRACT_VERSION,
      source: 'IntegrationShowcasePartnerSurfaceService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
      },
      status,
      publicAdoptionPilotLoop: {
        linked: Boolean(pilotLoop),
        status: pilotLoop?.status || 'unknown',
        pilotReady,
        qaCommand: normalizeText(pilotSurface?.qaCommand) || null,
      },
      showcase: {
        contractLinked: Boolean(showcase),
        contractStatus: showcaseStatus,
        gate: showcase?.gate === 'integration-showcase' ? 'integration-showcase' : null,
        routeCount: arrayOrEmpty(showcase?.routes).length,
        integrationCount: integrations.length,
        vendorCount: new Set(integrations.map((item) => normalizeText(item.vendor))).size,
        fixtureReadyCount: integrations.filter((item) => item.fixtureAvailable === true && arrayOrEmpty<string>(item.modes).includes('fixture')).length,
        credentialModeCount: integrations.filter((item) => arrayOrEmpty<string>(item.modes).includes('credential')).length,
        formalPartnersRegistered: integrations.filter((item) => item.formalPartnerRegistered === true).length,
        nextStage: normalizeText(showcase?.nextRecommendedGate?.gate) || null,
      },
      artifacts: {
        smokePath: normalizeText(showcaseArtifacts?.smokePath) || null,
        matrixPath: normalizeText(showcaseArtifacts?.matrixPath) || null,
        partnerSurfacePath: normalizeText(showcaseArtifacts?.partnerSurfacePath) || null,
        smokeReady,
        matrixReady,
        partnerSurfaceReady,
      },
      partnerSurface: {
        registryRequiredForFormalClaim: partnerPolicy?.registryRequiredForFormalClaim === true,
        allowedClaimCount: arrayOrEmpty(partnerPolicy?.allowedClaims).length,
        prohibitedClaimCount: arrayOrEmpty(partnerPolicy?.prohibitedClaims).length,
        auditArtifactCount: arrayOrEmpty(partnerPolicy?.auditArtifacts).length,
        unsafeFormalClaims,
        canClaimFormalPartner: false,
      },
      readiness,
      gates: this.buildGates({
        pilotReady,
        showcaseStatus,
        routesReady,
        fixtureModesReady,
        smokeReady,
        matrixReady,
        trustPlaneReady,
        partnerSurfacePolicyReady,
        partnerSurfaceReady,
        unsafeFormalClaims,
      }),
      surfaces: this.buildSurfaces({
        canPublishShowcasePreview,
        pilotReady,
        showcaseStatus,
        smokeReady,
        matrixReady,
        partnerSurfaceReady,
      }),
      receipts: this.buildReceipts({
        pilotReady,
        showcaseLinked: Boolean(showcase),
        smokeReady,
        matrixReady,
        partnerSurfaceReady,
        partnerSurfacePolicyReady,
        unsafeFormalClaims,
      }),
      policy: {
        noFormalPartnerClaimWithoutRegistry: true,
        noCredentialRequiredForFixture: true,
        noNetworkRequiredForFixture: true,
        noExternalMutation: true,
        noSecretsSerialized: true,
        fixtureFirst: true,
        safeDegradationRequired: true,
        trustPlaneRequired: true,
        partnerSurfaceAuditable: true,
        naturalLanguageDoesNotBypassPolicy: true,
      },
      surface: {
        cliCommand: `zavorth integration-showcase-partner-surface run ${run.id} --json`,
        zavorthControlPath: `/zavorthControl?runId=${encodeURIComponent(run.id)}&sector=config`,
        integrationsRoute: '/integrations',
        docsAnchor: '/docs#integration-showcase',
        integrationShowcaseCommand: 'npm run integration-showcase',
        qaCommand: 'npm run qa:integration-showcase',
        gateCommand: 'npm run qa:integration-showcase',
        smokeArtifact: 'integration-smoke.json',
        matrixArtifact: 'capability-matrix.json',
        partnerSurfaceArtifact: 'partner-surface.json',
      },
      nextSafeAction: this.resolveNextSafeAction(status),
    };
  }

  private readIntegrationShowcase(run: UniversalAgentRun): IntegrationShowcaseSnapshot | null {
    const metadata = recordOrNull(run.metadata.integrationShowcase)
      || recordOrNull(run.metadata.integrationShowcaseSnapshot)
      || recordOrNull(run.metadata.partnerSurfaceIntegration);
    if (metadata) {
      return metadata as unknown as IntegrationShowcaseSnapshot;
    }
    return this.integrationShowcaseService ? safeCall(() => this.integrationShowcaseService!.buildSnapshot()) : null;
  }

  private resolveStatus(input: {
    pilotLoop: PublicAdoptionPilotLoopSnapshot | null;
    pilotReady: boolean;
    showcase: IntegrationShowcaseSnapshot | null;
    showcaseStatus: IntegrationShowcasePartnerSurfaceSnapshot['showcase']['contractStatus'];
    smokeReady: boolean;
    matrixReady: boolean;
    partnerSurfaceReady: boolean;
    unsafeFormalClaims: string[];
    canPublishShowcasePreview: boolean;
  }): IntegrationShowcasePartnerSurfaceStatus {
    if (!input.pilotLoop) {
      return 'needs-public-adoption-pilot-loop';
    }
    if (input.pilotLoop.status === 'blocked' || input.showcaseStatus === 'blocked') {
      return 'blocked';
    }
    if (!input.pilotReady) {
      return 'needs-public-adoption-pilot-loop';
    }
    if (!input.showcase) {
      return 'needs-integration-showcase';
    }
    if (input.unsafeFormalClaims.length > 0) {
      return 'partner-claim-blocked';
    }
    if (!input.smokeReady) {
      return 'needs-smoke';
    }
    if (!input.matrixReady) {
      return 'needs-matrix';
    }
    if (!input.partnerSurfaceReady) {
      return 'needs-partner-surface';
    }
    return input.canPublishShowcasePreview ? 'showcase-ready' : 'needs-integration-showcase';
  }

  private buildGates(input: {
    pilotReady: boolean;
    showcaseStatus: IntegrationShowcasePartnerSurfaceSnapshot['showcase']['contractStatus'];
    routesReady: boolean;
    fixtureModesReady: boolean;
    smokeReady: boolean;
    matrixReady: boolean;
    trustPlaneReady: boolean;
    partnerSurfacePolicyReady: boolean;
    partnerSurfaceReady: boolean;
    unsafeFormalClaims: string[];
  }): IntegrationShowcasePartnerSurfaceGate[] {
    return [
      {
        id: 'public-adoption-pilot-loop',
        label: 'Public adoption pilot loop',
        status: input.pilotReady ? 'ready' : 'needs-action',
        source: 'PublicAdoptionPilotLoopService',
        command: 'zavorth public-adoption-pilot-loop --json',
        detail: input.pilotReady
          ? 'Piloto controlado esta pronto para alimentar showcase.'
          : 'Integration showcase depende da Public Adoption Pilot pilot-ready.',
        critical: true,
      },
      {
        id: 'integration-showcase-contract',
        label: 'Integration showcase contract',
        status: gateStatusFromShowcaseStatus(input.showcaseStatus),
        source: 'IntegrationShowcaseService',
        command: 'npm run qa:integration-showcase',
        detail: input.showcaseStatus === 'ready'
          ? 'Showcase validou vendors, fixtures, Trust Plane e partner surface.'
          : 'Rodar gate de integration showcase antes de publicar.',
        critical: true,
      },
      {
        id: 'fixture-smoke',
        label: 'Fixture smoke sem rede/secrets',
        status: input.smokeReady && input.fixtureModesReady ? 'ready' : 'needs-action',
        source: 'IntegrationShowcaseService',
        command: 'npm run integration-showcase -- --smoke',
        detail: input.smokeReady && input.fixtureModesReady
          ? 'Smoke fixture cobre vendors sem rede, secrets ou mutacao externa.'
          : 'Gerar smoke fixture e garantir modo fixture por vendor.',
        critical: true,
      },
      {
        id: 'capability-matrix',
        label: 'Capability matrix',
        status: input.matrixReady ? 'ready' : 'needs-action',
        source: 'IntegrationShowcaseService',
        command: 'npm run integration-showcase -- --matrix',
        detail: input.matrixReady
          ? 'Matriz diferencia fixture, local, credencial e degradacao.'
          : 'Matriz de capabilities precisa cobrir todas as integracoes.',
        critical: true,
      },
      {
        id: 'trust-plane-visible',
        label: 'Trust Plane visivel',
        status: input.trustPlaneReady ? 'ready' : 'needs-action',
        source: 'IntegrationShowcasePartnerSurfaceService',
        command: 'npm run qa:integration-showcase',
        detail: input.trustPlaneReady
          ? 'Approval, policy e audit trail aparecem como controles publicos.'
          : 'Showcase precisa evidenciar approval, policy e audit trail.',
        critical: true,
      },
      {
        id: 'partner-surface-auditable',
        label: 'Partner surface auditavel',
        status: input.partnerSurfaceReady && input.partnerSurfacePolicyReady && input.unsafeFormalClaims.length === 0 ? 'ready' : input.unsafeFormalClaims.length > 0 ? 'blocked' : 'needs-action',
        source: 'IntegrationShowcaseService',
        command: 'npm run integration-showcase -- --partner',
        detail: input.partnerSurfaceReady && input.partnerSurfacePolicyReady && input.unsafeFormalClaims.length === 0
          ? 'Compatibilidade tecnica nao vira claim formal sem registro.'
          : 'Partner surface precisa bloquear claim formal sem registro.',
        critical: true,
      },
    ];
  }

  private buildSurfaces(input: {
    canPublishShowcasePreview: boolean;
    pilotReady: boolean;
    showcaseStatus: IntegrationShowcasePartnerSurfaceSnapshot['showcase']['contractStatus'];
    smokeReady: boolean;
    matrixReady: boolean;
    partnerSurfaceReady: boolean;
  }): IntegrationShowcasePartnerSurfaceSurface[] {
    return [
      {
        id: 'cli',
        label: 'CLI integration showcase',
        routeOrCommand: 'zavorth integration-showcase-partner-surface --json',
        status: 'ready',
        detail: 'Snapshot read-only para showcase e partner surface.',
      },
      {
        id: 'control',
        label: 'ZavorthControl',
        routeOrCommand: '/zavorthControl?sector=config',
        status: 'ready',
        detail: 'Config mostra vendors, matrix, smoke e partner policy.',
      },
      {
        id: 'integrations',
        label: 'Integrations route',
        routeOrCommand: '/integrations',
        status: input.showcaseStatus === 'ready' ? 'ready' : 'needs-action',
        detail: 'Rota publica mostra fixture, live credential e degradacao segura.',
      },
      {
        id: 'docs',
        label: 'Docs integration showcase',
        routeOrCommand: '/docs#integration-showcase',
        status: input.pilotReady ? 'ready' : 'needs-action',
        detail: 'Docs devem explicar Trust Plane e partner surface.',
      },
      {
        id: 'smoke',
        label: 'Integration smoke',
        routeOrCommand: 'integration-smoke.json',
        status: input.smokeReady ? 'ready' : 'needs-action',
        detail: 'Smoke fixture sem rede, secrets ou mutacao externa.',
      },
      {
        id: 'matrix',
        label: 'Capability matrix',
        routeOrCommand: 'capability-matrix.json',
        status: input.matrixReady ? 'ready' : 'needs-action',
        detail: 'Matriz audita modos e degradacao por vendor.',
      },
      {
        id: 'partner-surface',
        label: 'Partner surface',
        routeOrCommand: 'partner-surface.json',
        status: input.partnerSurfaceReady ? 'ready' : 'needs-action',
        detail: 'Partner surface separa compatibilidade de parceria formal.',
      },
      {
        id: 'next-phase',
        label: 'Release train',
        routeOrCommand: 'npm run qa:release-train',
        status: input.canPublishShowcasePreview ? 'ready' : 'needs-action',
        detail: 'Readiness checkpoint 9 abre apenas depois da showcase ficar auditavel.',
      },
    ];
  }

  private buildReceipts(input: {
    pilotReady: boolean;
    showcaseLinked: boolean;
    smokeReady: boolean;
    matrixReady: boolean;
    partnerSurfaceReady: boolean;
    partnerSurfacePolicyReady: boolean;
    unsafeFormalClaims: string[];
  }): IntegrationShowcasePartnerSurfaceReceipt[] {
    return [
      {
        id: 'integration-showcase:pilot-loop',
        kind: 'pilot-loop',
        source: 'PublicAdoptionPilotLoopService',
        detail: input.pilotReady ? 'Pilot loop pronto.' : 'Pilot loop pendente.',
        status: input.pilotReady ? 'ready' : 'needs-action',
      },
      {
        id: 'integration-showcase:contract',
        kind: 'showcase',
        source: 'IntegrationShowcaseService',
        detail: input.showcaseLinked ? 'IntegrationShowcaseSnapshot anexado.' : 'IntegrationShowcaseSnapshot ausente.',
        status: input.showcaseLinked ? 'ready' : 'needs-action',
      },
      {
        id: 'integration-showcase:smoke',
        kind: 'smoke',
        source: 'IntegrationShowcaseService',
        detail: input.smokeReady ? 'Smoke fixture disponivel.' : 'Smoke fixture pendente.',
        status: input.smokeReady ? 'ready' : 'needs-action',
      },
      {
        id: 'integration-showcase:matrix',
        kind: 'matrix',
        source: 'IntegrationShowcaseService',
        detail: input.matrixReady ? 'Capability matrix disponivel.' : 'Capability matrix pendente.',
        status: input.matrixReady ? 'ready' : 'needs-action',
      },
      {
        id: 'integration-showcase:partner-surface',
        kind: 'partner-surface',
        source: 'IntegrationShowcaseService',
        detail: input.partnerSurfaceReady && input.partnerSurfacePolicyReady && input.unsafeFormalClaims.length === 0
          ? 'Partner surface auditavel e sem claim formal indevido.'
          : 'Partner surface precisa revisar policy/claims.',
        status: input.unsafeFormalClaims.length > 0 ? 'blocked' : input.partnerSurfaceReady && input.partnerSurfacePolicyReady ? 'ready' : 'needs-action',
      },
      {
        id: 'integration-showcase:policy',
        kind: 'policy',
        source: 'IntegrationShowcasePartnerSurfaceService',
        detail: 'Fixture-first, sem credencial obrigatoria e sem claim formal sem registro.',
        status: 'ready',
      },
    ];
  }

  private resolveNextSafeAction(status: IntegrationShowcasePartnerSurfaceStatus): string {
    if (status === 'needs-public-adoption-pilot-loop') {
      return 'Publicar Public Adoption Pilot como pilot-ready antes de abrir integration showcase.';
    }
    if (status === 'needs-integration-showcase') {
      return 'Rodar npm run qa:integration-showcase e anexar IntegrationShowcaseSnapshot ao run.';
    }
    if (status === 'needs-smoke') {
      return 'Gerar smoke fixture com npm run integration-showcase -- --smoke.';
    }
    if (status === 'needs-matrix') {
      return 'Gerar capability matrix com npm run integration-showcase -- --matrix.';
    }
    if (status === 'needs-partner-surface') {
      return 'Gerar partner-surface auditavel com npm run integration-showcase -- --partner.';
    }
    if (status === 'partner-claim-blocked') {
      return 'Remover claim formal de parceiro sem registro antes de publicar.';
    }
    if (status === 'blocked') {
      return 'Corrigir bloqueios de piloto/showcase antes de publicar integracoes.';
    }
    return 'Publicar apenas showcase fixture-first, com Trust Plane visivel e sem claim formal indevido.';
  }
}
