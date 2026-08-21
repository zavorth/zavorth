import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';

export const PRODUCTIZATION_EVIDENCE_CONTRACT_VERSION = '2026-05-04.product-evidence' as const;

export type ProductizationEvidenceStatus = 'ready' | 'partial' | 'blocked';
export type ProductizationEvidenceGateStatus = 'ready' | 'partial' | 'missing' | 'blocked';

export type ProductizationEvidenceGate = {
  id: string;
  label: string;
  status: ProductizationEvidenceGateStatus;
  source:
    | 'ZavorthProductizationContractService'
    | 'RunArtifactReceiptReplayService'
    | 'ZavorthControl'
    | 'GatewayControlApi'
    | 'ReleaseReadiness'
    | 'ProductizationEvidenceService';
  command: string;
  detail: string;
  critical: boolean;
};

export type ProductizationEvidenceSurface = {
  id: string;
  label: string;
  status: ProductizationEvidenceGateStatus;
  path: string;
  evidence: string;
};

export type ProductizationEvidenceReceipt = {
  id: string;
  kind:
    | 'productization-c9'
    | 'release-readiness'
    | 'runtime-evidence'
    | 'surface'
    | 'gate'
    | 'policy';
  source: string;
  detail: string;
  status: ProductizationEvidenceGateStatus;
};

export type ProductizationEvidenceSnapshot = {
  contractVersion: typeof PRODUCTIZATION_EVIDENCE_CONTRACT_VERSION;
  source: 'ProductizationEvidenceService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: ProductizationEvidenceStatus;
  summary: {
    readyGateCount: number;
    partialGateCount: number;
    missingGateCount: number;
    blockedGateCount: number;
    surfaceCount: number;
    linkedRuntimeEvidenceCount: number;
    productizationContractLinked: boolean;
    releasePreviewReady: boolean;
    stableReleaseAllowed: boolean;
    replayLinked: boolean;
    zavorthControlLinked: boolean;
    docsLinked: boolean;
    websiteLinked: boolean;
  };
  productization: {
    contractService: 'ZavorthProductizationContractService';
    c9Linked: boolean;
    stage: string | null;
    phase: string | null;
    status: string | null;
    controlReady: boolean;
    cliReady: boolean;
    sdkReady: boolean;
    docsReady: boolean;
    websiteReady: boolean;
    sourceMetadataKey: string | null;
  };
  releaseReadiness: {
    status: 'preview-ready' | 'stable-ready' | 'partial' | 'blocked' | 'unknown';
    channel: 'preview' | 'stable' | 'lts' | 'dev' | 'unknown';
    version: string | null;
    rollbackAvailable: boolean;
    stableRequiresRealRelease: true;
    noReleasePublished: boolean;
    noInstallerExecuted: boolean;
    noCanaryStarted: boolean;
    nextReleaseTrack: 'Channel mesh7 - Product Entry Runtime / First Run';
  };
  runtimeEvidence: {
    runArtifactReceiptReplay: boolean;
    runObservatory: boolean;
    providerMeshConsolidation: boolean;
    universalIntentTrustEnforcement: boolean;
    safetyNarrative: boolean;
    zavorthControlProjection: boolean;
    gatewayControlApi: boolean;
  };
  gates: ProductizationEvidenceGate[];
  surfaces: ProductizationEvidenceSurface[];
  receipts: ProductizationEvidenceReceipt[];
  policy: {
    noReleasePublished: boolean;
    noInstallerExecuted: boolean;
    noCanaryStarted: boolean;
    previewOnlyUntilReleaseGatesPass: true;
    stableRequiresRealRelease: true;
    productizationClaimsNeedReceipts: true;
    naturalLanguageDoesNotBypassPolicy: true;
    replayEvidenceMustRemainReceiptsOnly: true;
    secretsSerialized: false;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
    releaseHint: string;
    docsHint: string;
  };
  nextSafeAction: string;
};

export type ProductizationEvidenceInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
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

function booleanFlag(...values: unknown[]): boolean {
  return values.some((value) => value === true || value === 'true' || value === 1 || value === '1');
}

function statusText(value: unknown): string | null {
  const text = normalizeText(value);
  return text || null;
}

function countByStatus(gates: ProductizationEvidenceGate[], status: ProductizationEvidenceGateStatus): number {
  return gates.filter((gate) => gate.status === status).length;
}

function normalizeReleaseChannel(value: unknown): ProductizationEvidenceSnapshot['releaseReadiness']['channel'] {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'preview' || raw === 'stable' || raw === 'lts' || raw === 'dev') {
    return raw;
  }
  return 'unknown';
}

function normalizeReleaseStatus(
  value: unknown,
  channel: ProductizationEvidenceSnapshot['releaseReadiness']['channel'],
  stableAllowed: boolean,
): ProductizationEvidenceSnapshot['releaseReadiness']['status'] {
  const raw = normalizeText(value).toLowerCase();
  if (raw.includes('blocked')) {
    return 'blocked';
  }
  if (channel === 'stable' || raw.includes('stable')) {
    return stableAllowed ? 'stable-ready' : 'blocked';
  }
  if (channel === 'preview' || raw.includes('preview')) {
    return 'preview-ready';
  }
  if (raw.includes('ready')) {
    return 'preview-ready';
  }
  if (raw.includes('partial')) {
    return 'partial';
  }
  return 'unknown';
}

function hasRecord(run: UniversalAgentRun, key: string): boolean {
  return Boolean(recordOrNull(run.metadata[key]));
}

export class ProductizationEvidenceService {
  private readonly now: () => Date;

  constructor(runtime: { now?: () => Date } = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: ProductizationEvidenceInput): ProductizationEvidenceSnapshot {
    const { run } = input;
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const productizationRecord = this.resolveProductizationRecord(run);
    const productization = this.buildProductization(productizationRecord);
    const releaseEvidence = recordOrNull(run.metadata.releaseEvidence)
      || recordOrNull(run.metadata.publicReleaseBundle)
      || recordOrNull(productizationRecord.record?.releaseReadiness)
      || recordOrNull(productizationRecord.record?.releaseStatus)
      || recordOrNull(run.metadata.releaseStatus);
    const realReleasePublished = booleanFlag(
      releaseEvidence?.realReleasePublished,
      releaseEvidence?.releasePublished,
      releaseEvidence?.published,
    );
    const installerExecuted = booleanFlag(
      releaseEvidence?.installerExecuted,
      releaseEvidence?.installerBuilt,
      releaseEvidence?.installerReady,
    );
    const canaryStarted = booleanFlag(releaseEvidence?.canaryStarted, releaseEvidence?.rolloutStarted);
    const channel = normalizeReleaseChannel(releaseEvidence?.channel || releaseEvidence?.releaseChannel);
    const rollbackAvailable = booleanFlag(
      releaseEvidence?.rollbackAvailable,
      releaseEvidence?.rollbackReady,
      recordOrNull(run.metadata.releaseStatus)?.rollbackAvailable,
    );
    const replayLinked = hasRecord(run, 'runArtifactReceiptReplay');
    const stableAllowed = productization.c9Linked && replayLinked && realReleasePublished && rollbackAvailable;
    const releaseStatus = normalizeReleaseStatus(
      releaseEvidence?.status || releaseEvidence?.state,
      channel,
      stableAllowed,
    );
    const runtimeEvidence = {
      runArtifactReceiptReplay: replayLinked,
      runObservatory: this.hasReplayObservatory(run),
      providerMeshConsolidation: hasRecord(run, 'providerMeshConsolidation'),
      universalIntentTrustEnforcement: hasRecord(run, 'universalIntentTrustEnforcement'),
      safetyNarrative: hasRecord(run, 'safetyNarrative'),
      zavorthControlProjection: true,
      gatewayControlApi: productization.controlReady || hasRecord(run, 'gatewayControlApi'),
    };
    const linkedRuntimeEvidenceCount = Object.values(runtimeEvidence).filter(Boolean).length;
    const surfaces = this.buildSurfaces(productization, runtimeEvidence);
    const gates = this.buildGates(productization, releaseStatus, stableAllowed, runtimeEvidence, surfaces);
    const receipts = this.buildReceipts(productization, releaseStatus, runtimeEvidence, gates, surfaces);
    const status = this.resolveStatus(gates);
    const readyGateCount = countByStatus(gates, 'ready');
    const partialGateCount = countByStatus(gates, 'partial');
    const missingGateCount = countByStatus(gates, 'missing');
    const blockedGateCount = countByStatus(gates, 'blocked');

    return {
      contractVersion: PRODUCTIZATION_EVIDENCE_CONTRACT_VERSION,
      source: 'ProductizationEvidenceService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
      },
      status,
      summary: {
        readyGateCount,
        partialGateCount,
        missingGateCount,
        blockedGateCount,
        surfaceCount: surfaces.length,
        linkedRuntimeEvidenceCount,
        productizationContractLinked: productization.c9Linked,
        releasePreviewReady: releaseStatus === 'preview-ready',
        stableReleaseAllowed: stableAllowed,
        replayLinked,
        zavorthControlLinked: runtimeEvidence.zavorthControlProjection,
        docsLinked: surfaces.some((surface) => surface.id === 'docs' && surface.status === 'ready'),
        websiteLinked: productization.websiteReady,
      },
      productization,
      releaseReadiness: {
        status: releaseStatus,
        channel,
        version: normalizeText(releaseEvidence?.version) || null,
        rollbackAvailable,
        stableRequiresRealRelease: true,
        noReleasePublished: !realReleasePublished,
        noInstallerExecuted: !installerExecuted,
        noCanaryStarted: !canaryStarted,
        nextReleaseTrack: 'Channel mesh7 - Product Entry Runtime / First Run',
      },
      runtimeEvidence,
      gates,
      surfaces,
      receipts,
      policy: {
        noReleasePublished: !realReleasePublished,
        noInstallerExecuted: !installerExecuted,
        noCanaryStarted: !canaryStarted,
        previewOnlyUntilReleaseGatesPass: true,
        stableRequiresRealRelease: true,
        productizationClaimsNeedReceipts: true,
        naturalLanguageDoesNotBypassPolicy: true,
        replayEvidenceMustRemainReceiptsOnly: true,
        secretsSerialized: false,
      },
      surface: {
        cliCommand: `zavorth productization-evidence run ${run.id} --json`,
        zavorthControlPath: `/zavorthControl...runId=${encodeURIComponent(run.id)}&sector=config`,
        releaseHint: 'Release readiness is preview-only until there is a real release with verified installer and rollback.',
        docsHint: 'Docs must cite gates, receipts, and the C9 contract before announcing the product as stable.',
      },
      nextSafeAction: this.resolveNextSafeAction(status, productization.c9Linked, releaseStatus, stableAllowed),
    };
  }

  private resolveProductizationRecord(run: UniversalAgentRun): { key: string | null; record: LooseRecord | null } {
    const candidates = [
      'productizationEvidenceInput',
      'productizationContract',
      'productization',
      'zavorthProductization',
      'c9Productization',
    ];
    for (const key of candidates) {
      const record = recordOrNull(run.metadata[key]);
      if (record) {
        return { key, record };
      }
    }
    return { key: null, record: null };
  }

  private buildProductization(input: { key: string | null; record: LooseRecord | null }): ProductizationEvidenceSnapshot['productization'] {
    const record = input.record;
    const control = recordOrNull(record?.control) || {};
    const cli = recordOrNull(record?.cli) || {};
    const docs = recordOrNull(record?.docs) || {};
    const website = recordOrNull(record?.website) || {};
    const sdk = recordOrNull(record?.sdk) || recordOrNull(record?.contracts) || {};
    const status = statusText(record?.status);
    const phase = statusText(record?.phase || record?.stage);
    return {
      contractService: 'ZavorthProductizationContractService',
      c9Linked: Boolean(record),
      stage: phase,
      phase,
      status,
      controlReady: booleanFlag(control.ready, control.ok, control.available, record?.controlReady),
      cliReady: booleanFlag(cli.ready, cli.ok, cli.available, record?.cliReady),
      sdkReady: booleanFlag(sdk.ready, sdk.ok, sdk.available, record?.sdkReady),
      docsReady: booleanFlag(docs.ready, docs.ok, docs.available, record?.docsReady),
      websiteReady: booleanFlag(website.ready, website.ok, website.available, record?.websiteReady),
      sourceMetadataKey: input.key,
    };
  }

  private hasReplayObservatory(run: UniversalAgentRun): boolean {
    const replay = recordOrNull(run.metadata.runArtifactReceiptReplay);
    const summary = recordOrNull(replay?.summary);
    return booleanFlag(summary?.runObservatoryLinked) || run.events.length > 0;
  }

  private buildSurfaces(
    productization: ProductizationEvidenceSnapshot['productization'],
    runtimeEvidence: ProductizationEvidenceSnapshot['runtimeEvidence'],
  ): ProductizationEvidenceSurface[] {
    return [
      {
        id: 'control',
        label: '/zavorthControl',
        status: runtimeEvidence.zavorthControlProjection ? 'ready' : 'missing',
        path: '/zavorthControl...sector=config',
        evidence: 'ZavorthControl projeta Productization Evidence junto de release/replay.',
      },
      {
        id: 'cli',
        label: 'CLI',
        status: productization.cliReady || productization.c9Linked ? 'ready' : 'partial',
        path: 'zavorth productization-evidence --json',
        evidence: 'CLI read-only renderiza gates e policy de release readiness.',
      },
      {
        id: 'docs',
        label: 'Docs',
        status: 'ready',
        path: 'docs/product-direction.md',
        evidence: 'Channel mesh6 documenta preview-only, gates e next entrega.',
      },
      {
        id: 'website',
        label: 'Website',
        status: productization.websiteReady ? 'ready' : 'partial',
        path: '/release',
        evidence: 'Public site must remain preview-only until real release.',
      },
    ];
  }

  private buildGates(
    productization: ProductizationEvidenceSnapshot['productization'],
    releaseStatus: ProductizationEvidenceSnapshot['releaseReadiness']['status'],
    stableAllowed: boolean,
    runtimeEvidence: ProductizationEvidenceSnapshot['runtimeEvidence'],
    surfaces: ProductizationEvidenceSurface[],
  ): ProductizationEvidenceGate[] {
    const criticalSurfaceMissing = surfaces.some((surface) => surface.id === 'control' && surface.status !== 'ready');
    return [
      {
        id: 'productization-c9-contract',
        label: 'C9 productization contract',
        status: productization.c9Linked ? 'ready' : 'partial',
        source: 'ZavorthProductizationContractService',
        command: 'zavorth productization --json',
        detail: productization.c9Linked ? `C9 linkado via ${productization.sourceMetadataKey || 'metadata'}.`
          : 'Contract C9 exists in core, but this run has not attached snapshot C9 yet.',
        critical: true,
      },
      {
        id: 'replay-hardening',
        label: 'Replay hardening',
        status: runtimeEvidence.runArtifactReceiptReplay ? 'ready' : 'missing',
        source: 'RunArtifactReceiptReplayService',
        command: 'npm run replay-hardening:check -- --json',
        detail: runtimeEvidence.runArtifactReceiptReplay ? 'Run possui evidence de replay/receipts.'
          : 'Publicar runArtifactReceiptReplay before claim de produto.',
        critical: true,
      },
      {
        id: 'zavorthControl-projection',
        label: 'ZavorthControl projection',
        status: criticalSurfaceMissing ? 'missing' : 'ready',
        source: 'ZavorthControl',
        command: 'npm run ai-gateway:check -- --pretty false',
        detail: 'Productization Evidence aparece no /zavorthControl junto de release status.',
        critical: true,
      },
      {
        id: 'runtime-typecheck',
        label: 'Runtime typecheck',
        status: 'partial',
        source: 'ProductizationEvidenceService',
        command: 'npm run runtime:check -- --pretty false',
        detail: 'Gate declares the command; execution stays in local QA, not in the snapshot.',
        critical: true,
      },
      {
        id: 'release-honesty',
        label: 'Release honesty',
        status: releaseStatus === 'blocked' && !stableAllowed ? 'blocked' : 'ready',
        source: 'ReleaseReadiness',
        command: 'npm run productization-evidence:check -- --json',
        detail: stableAllowed ? 'Stable possui release real e rollback.'
          : 'Snapshot remains preview-only and blocks stable without a real release.',
        critical: true,
      },
      {
        id: 'surfaces-syntax',
        label: 'Surface syntax',
        status: 'partial',
        source: 'GatewayControlApi',
        command: 'npm run surfaces:check -- --pretty false',
        detail: 'ZavorthControl and CLI must remain compilable.',
        critical: false,
      },
    ];
  }

  private buildReceipts(
    productization: ProductizationEvidenceSnapshot['productization'],
    releaseStatus: ProductizationEvidenceSnapshot['releaseReadiness']['status'],
    runtimeEvidence: ProductizationEvidenceSnapshot['runtimeEvidence'],
    gates: ProductizationEvidenceGate[],
    surfaces: ProductizationEvidenceSurface[],
  ): ProductizationEvidenceReceipt[] {
    return [
      {
        id: 'productization:c9',
        kind: 'productization-c9',
        source: 'ZavorthProductizationContractService',
        detail: productization.c9Linked ? 'C9 productization was attached to the run as evidence.'
          : 'C9 exists as a separate contract; attach its snapshot to the run before promoting readiness.',
        status: productization.c9Linked ? 'ready' : 'partial',
      },
      {
        id: 'release:honesty',
        kind: 'release-readiness',
        source: 'ReleaseReadiness',
        detail: `Release status ${releaseStatus}; stable requer release real, installer e rollback.`,
        status: releaseStatus === 'blocked' ? 'blocked' : releaseStatus === 'preview-ready' ? 'ready' : 'partial',
      },
      {
        id: 'runtime:replay',
        kind: 'runtime-evidence',
        source: 'RunArtifactReceiptReplayService',
        detail: runtimeEvidence.runArtifactReceiptReplay ? 'Replay hardening linkado por metadata.'
          : 'Replay hardening missing neste run.',
        status: runtimeEvidence.runArtifactReceiptReplay ? 'ready' : 'missing',
      },
      ...gates.map((gate): ProductizationEvidenceReceipt => ({
        id: `gate:${gate.id}`,
        kind: 'gate',
        source: gate.source,
        detail: `${gate.label}: ${gate.detail}`,
        status: gate.status,
      })),
      ...surfaces.map((surface): ProductizationEvidenceReceipt => ({
        id: `surface:${surface.id}`,
        kind: 'surface',
        source: surface.label,
        detail: `${surface.path}: ${surface.evidence}`,
        status: surface.status,
      })),
      {
        id: 'policy:preview-only',
        kind: 'policy',
        source: 'ProductizationEvidenceService',
        detail: 'Preview-only until real release; natural language does not promote stable or execute rollout.',
        status: 'ready',
      },
    ];
  }

  private resolveStatus(gates: ProductizationEvidenceGate[]): ProductizationEvidenceStatus {
    if (gates.some((gate) => gate.critical && gate.status === 'blocked')) {
      return 'blocked';
    }
    if (gates.some((gate) => gate.critical && (gate.status === 'missing' || gate.status === 'partial'))) {
      return 'partial';
    }
    return 'ready';
  }

  private resolveNextSafeAction(
    status: ProductizationEvidenceStatus,
    c9Linked: boolean,
    releaseStatus: ProductizationEvidenceSnapshot['releaseReadiness']['status'],
    stableAllowed: boolean,
  ): string {
    if (!c9Linked) {
      return 'Attach the ZavorthProductizationContractService snapshot to the run before promoting readiness.';
    }
    if (status === 'blocked') {
      return 'Remove stable claims or publish real release, installer, and rollback evidence before continuing.';
    }
    if (stableAllowed) {
      return 'Prepare Channel mesh7 com Product Entry Runtime e First Run without quebrar gates.';
    }
    if (releaseStatus === 'preview-ready') {
      return 'Seguir para Channel mesh7 mantendo channel preview e receipts de produto.';
    }
    return 'run gates locais e manter release em preview-only.';
  }
}
