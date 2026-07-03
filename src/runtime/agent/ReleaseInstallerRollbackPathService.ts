import type { PublicReleaseBundleContractSnapshot } from '../../contracts/PublicReleaseBundleContract.js';
import type { ProductEntryRuntimeSnapshot } from './ProductEntryRuntimeService.js';
import type { ProductizationEvidenceSnapshot } from './ProductizationEvidenceService.js';
import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';

export const RELEASE_INSTALLER_ROLLBACK_PATH_CONTRACT_VERSION = '2026-05-04.release-rollback' as const;
export const RELEASE_INSTALLER_ROLLBACK_PATH_METADATA_KEY = 'releaseInstallerRollbackPath' as const;

export type ReleaseInstallerRollbackPathStatus =
  | 'preview-ready'
  | 'needs-product-entry'
  | 'needs-release-bundle'
  | 'needs-installer-preview'
  | 'rollback-ready'
  | 'blocked'
  | 'dormant-canary';

export type ReleaseInstallerRollbackPathGateStatus = 'ready' | 'needs-action' | 'blocked' | 'unknown';

export type ReleaseInstallerRollbackPathGate = {
  id: string;
  label: string;
  status: ReleaseInstallerRollbackPathGateStatus;
  source:
    | 'ProductEntryRuntimeService'
    | 'ProductizationEvidenceService'
    | 'PublicReleaseBundleContractService'
    | 'ReleaseInstallerRollbackPathService';
  command: string;
  detail: string;
  critical: boolean;
};

export type ReleaseInstallerRollbackPathReceipt = {
  id: string;
  kind: 'product-entry' | 'productization' | 'release-bundle' | 'installer' | 'rollback' | 'policy';
  source: string;
  detail: string;
  status: ReleaseInstallerRollbackPathGateStatus;
};

export type ReleaseInstallerRollbackPathSurface = {
  id: 'cli' | 'control' | 'public-release' | 'installer-preview' | 'rollback-preview';
  label: string;
  commandOrPath: string;
  status: ReleaseInstallerRollbackPathGateStatus;
  detail: string;
};

export type ReleaseInstallerRollbackPathSnapshot = {
  contractVersion: typeof RELEASE_INSTALLER_ROLLBACK_PATH_CONTRACT_VERSION;
  source: 'ReleaseInstallerRollbackPathService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: ReleaseInstallerRollbackPathStatus;
  release: {
    channel: 'preview' | 'stable' | 'lts' | 'dev' | 'unknown';
    version: string | null;
    stableAllowed: boolean;
    releaseBundleLinked: boolean;
    releaseBundleStatus: 'ready' | 'attention' | 'blocked' | 'unknown';
    route: '/release' | null;
  };
  installer: {
    previewAvailable: boolean;
    installerExecuted: false;
    requiredCommands: string[];
    dryRunCommand: 'zavorth release install --dry-run';
    hostedInstallerAllowed: boolean;
    checksumRequired: true;
  };
  rollback: {
    rollbackAvailable: boolean;
    rollbackExecuted: false;
    rollbackCommand: 'zavorth release rollback --dry-run';
    cleanupPreviewRequired: true;
    scope: 'local-artifacts-only';
  };
  readiness: {
    productEntryRuntimeLinked: boolean;
    productizationEvidenceLinked: boolean;
    releasePreviewReady: boolean;
    releaseBundleReady: boolean;
    firstRunReady: boolean;
    canPublishStable: boolean;
    canStartCanary: false;
  };
  gates: ReleaseInstallerRollbackPathGate[];
  surfaces: ReleaseInstallerRollbackPathSurface[];
  receipts: ReleaseInstallerRollbackPathReceipt[];
  policy: {
    noReleasePublished: true;
    noInstallerExecuted: true;
    noRollbackExecuted: true;
    noCanaryStarted: true;
    noStableTagMoved: true;
    noLatestTagMoved: true;
    hostedInstallerRequiresChecksums: true;
    rollbackRequiresExplicitCommand: true;
    naturalLanguageDoesNotBypassPolicy: true;
    secretsSerialized: false;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
    publicReleaseRoute: '/release';
    dryRunCommand: 'zavorth release install --dry-run';
    rollbackCommand: 'zavorth release rollback --dry-run';
  };
  nextSafeAction: string;
};

export type ReleaseInstallerRollbackPathInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
};

type ReleaseInstallerRollbackPathDependencies = {
  now?: () => Date;
  publicReleaseBundleService?: { buildSnapshot(): PublicReleaseBundleContractSnapshot } | null;
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

function normalizeChannel(value: unknown): ReleaseInstallerRollbackPathSnapshot['release']['channel'] {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'preview' || raw === 'stable' || raw === 'lts' || raw === 'dev') {
    return raw;
  }
  return 'unknown';
}

function normalizeReleaseBundleStatus(value: unknown): ReleaseInstallerRollbackPathSnapshot['release']['releaseBundleStatus'] {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'ready' || raw === 'attention' || raw === 'blocked') {
    return raw;
  }
  return 'unknown';
}

function safeCall<T>(factory: () => T): T | null {
  try {
    return factory();
  } catch {
    return null;
  }
}

export class ReleaseInstallerRollbackPathService {
  private readonly now: () => Date;
  private readonly publicReleaseBundleService: { buildSnapshot(): PublicReleaseBundleContractSnapshot } | null;

  constructor(runtime: ReleaseInstallerRollbackPathDependencies = {}) {
    this.now = runtime.now || (() => new Date());
    this.publicReleaseBundleService = runtime.publicReleaseBundleService || null;
  }

  public buildSnapshot(input: ReleaseInstallerRollbackPathInput): ReleaseInstallerRollbackPathSnapshot {
    const { run } = input;
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const productEntryRuntime = recordOrNull(run.metadata.productEntryRuntime) as ProductEntryRuntimeSnapshot | null;
    const productizationEvidence = recordOrNull(run.metadata.productizationEvidence) as ProductizationEvidenceSnapshot | null;
    const releaseBundle = this.readReleaseBundle(run);
    const releaseEvidence = this.readReleaseEvidence(run, productizationEvidence, releaseBundle);
    const channel = normalizeChannel(releaseEvidence?.channel || releaseEvidence?.releaseChannel || productizationEvidence?.releaseReadiness.channel);
    const version = normalizeText(releaseEvidence?.version || productizationEvidence?.releaseReadiness.version) || null;
    const releaseBundleStatus = normalizeReleaseBundleStatus(releaseBundle?.status);
    const releaseBundleLinked = Boolean(releaseBundle);
    const releaseBundleReady = releaseBundleStatus === 'ready' || releaseBundleStatus === 'attention';
    const firstRunReady = Boolean(productEntryRuntime?.readiness.handoffToAgentRuntime);
    const releasePreviewReady = Boolean(
      productizationEvidence?.summary.releasePreviewReady
      || productizationEvidence?.releaseReadiness.status === 'preview-ready'
      || channel === 'preview',
    );
    const stableAllowed = Boolean(productizationEvidence?.summary.stableReleaseAllowed);
    const rollbackAvailable = booleanFlag(
      releaseEvidence?.rollbackAvailable,
      releaseEvidence?.rollbackReady,
      productizationEvidence?.releaseReadiness.rollbackAvailable,
      productEntryRuntime?.workspace.rollbackAvailable,
    );
    const installerPreviewAvailable = releaseBundleReady && releasePreviewReady;
    const hostedInstallerAllowed = installerPreviewAvailable && releaseBundleStatus === 'ready';
    const canPublishStable = stableAllowed && releaseBundleReady && rollbackAvailable;
    const status = this.resolveStatus({
      channel,
      releaseBundleLinked,
      releaseBundleReady,
      firstRunReady,
      productizationEvidenceLinked: Boolean(productizationEvidence),
      installerPreviewAvailable,
      rollbackAvailable,
      canPublishStable,
    });
    const gates = this.buildGates({
      productEntryRuntime,
      productizationEvidence,
      releaseBundleStatus,
      releaseBundleLinked,
      releaseBundleReady,
      releasePreviewReady,
      installerPreviewAvailable,
      rollbackAvailable,
      canPublishStable,
    });
    const surfaces = this.buildSurfaces(run.id, releaseBundleLinked, installerPreviewAvailable, rollbackAvailable);
    const receipts = this.buildReceipts({
      productEntryRuntimeLinked: Boolean(productEntryRuntime),
      productizationEvidenceLinked: Boolean(productizationEvidence),
      releaseBundleLinked,
      installerPreviewAvailable,
      rollbackAvailable,
    });

    return {
      contractVersion: RELEASE_INSTALLER_ROLLBACK_PATH_CONTRACT_VERSION,
      source: 'ReleaseInstallerRollbackPathService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
      },
      status,
      release: {
        channel,
        version,
        stableAllowed,
        releaseBundleLinked,
        releaseBundleStatus,
        route: releaseBundleLinked ? '/release' : null,
      },
      installer: {
        previewAvailable: installerPreviewAvailable,
        installerExecuted: false,
        requiredCommands: this.resolveRequiredCommands(releaseBundle),
        dryRunCommand: 'zavorth release install --dry-run',
        hostedInstallerAllowed,
        checksumRequired: true,
      },
      rollback: {
        rollbackAvailable,
        rollbackExecuted: false,
        rollbackCommand: 'zavorth release rollback --dry-run',
        cleanupPreviewRequired: true,
        scope: 'local-artifacts-only',
      },
      readiness: {
        productEntryRuntimeLinked: Boolean(productEntryRuntime),
        productizationEvidenceLinked: Boolean(productizationEvidence),
        releasePreviewReady,
        releaseBundleReady,
        firstRunReady,
        canPublishStable,
        canStartCanary: false,
      },
      gates,
      surfaces,
      receipts,
      policy: {
        noReleasePublished: true,
        noInstallerExecuted: true,
        noRollbackExecuted: true,
        noCanaryStarted: true,
        noStableTagMoved: true,
        noLatestTagMoved: true,
        hostedInstallerRequiresChecksums: true,
        rollbackRequiresExplicitCommand: true,
        naturalLanguageDoesNotBypassPolicy: true,
        secretsSerialized: false,
      },
      surface: {
        cliCommand: `zavorth release-path run ${run.id} --json`,
        zavorthControlPath: `/zavorthControl?runId=${encodeURIComponent(run.id)}&sector=config`,
        publicReleaseRoute: '/release',
        dryRunCommand: 'zavorth release install --dry-run',
        rollbackCommand: 'zavorth release rollback --dry-run',
      },
      nextSafeAction: this.resolveNextSafeAction(status),
    };
  }

  private readReleaseBundle(run: UniversalAgentRun): PublicReleaseBundleContractSnapshot | null {
    const fromMetadata = recordOrNull(run.metadata.publicReleaseBundle)
      || recordOrNull(run.metadata.releaseBundle);
    if (fromMetadata) {
      return fromMetadata as unknown as PublicReleaseBundleContractSnapshot;
    }
    return this.publicReleaseBundleService
      ? safeCall(() => this.publicReleaseBundleService!.buildSnapshot())
      : null;
  }

  private readReleaseEvidence(
    run: UniversalAgentRun,
    productizationEvidence: ProductizationEvidenceSnapshot | null,
    releaseBundle: PublicReleaseBundleContractSnapshot | null,
  ): LooseRecord | null {
    return recordOrNull(run.metadata.releaseInstallerRollbackInput)
      || recordOrNull(run.metadata.releaseEvidence)
      || recordOrNull(run.metadata.releaseStatus)
      || recordOrNull(productizationEvidence?.releaseReadiness)
      || recordOrNull(releaseBundle)
      || null;
  }

  private resolveRequiredCommands(releaseBundle: PublicReleaseBundleContractSnapshot | null): string[] {
    const commands = Array.isArray(releaseBundle?.requiredCommands)
      ? releaseBundle.requiredCommands
      : ['release:status:fast', 'doctor:fast', 'release:changelog', 'release:rollback-preview'];
    return Array.from(new Set(commands.map((command) => normalizeText(command)).filter(Boolean)));
  }

  private resolveStatus(input: {
    channel: ReleaseInstallerRollbackPathSnapshot['release']['channel'];
    releaseBundleLinked: boolean;
    releaseBundleReady: boolean;
    firstRunReady: boolean;
    productizationEvidenceLinked: boolean;
    installerPreviewAvailable: boolean;
    rollbackAvailable: boolean;
    canPublishStable: boolean;
  }): ReleaseInstallerRollbackPathStatus {
    if (input.channel === 'stable' && !input.canPublishStable) {
      return 'blocked';
    }
    if (!input.firstRunReady) {
      return 'needs-product-entry';
    }
    if (!input.productizationEvidenceLinked || !input.releaseBundleLinked || !input.releaseBundleReady) {
      return 'needs-release-bundle';
    }
    if (!input.installerPreviewAvailable) {
      return 'needs-installer-preview';
    }
    if (input.rollbackAvailable && input.canPublishStable) {
      return 'rollback-ready';
    }
    return 'preview-ready';
  }

  private buildGates(input: {
    productEntryRuntime: ProductEntryRuntimeSnapshot | null;
    productizationEvidence: ProductizationEvidenceSnapshot | null;
    releaseBundleStatus: ReleaseInstallerRollbackPathSnapshot['release']['releaseBundleStatus'];
    releaseBundleLinked: boolean;
    releaseBundleReady: boolean;
    releasePreviewReady: boolean;
    installerPreviewAvailable: boolean;
    rollbackAvailable: boolean;
    canPublishStable: boolean;
  }): ReleaseInstallerRollbackPathGate[] {
    return [
      {
        id: 'product-entry-runtime',
        label: 'Product Entry Runtime handoff',
        status: input.productEntryRuntime?.readiness.handoffToAgentRuntime ? 'ready' : 'needs-action',
        source: 'ProductEntryRuntimeService',
        command: 'zavorth product-entry --json',
        detail: input.productEntryRuntime?.readiness.handoffToAgentRuntime
          ? 'First-run e handoff para o AgentGateway estao compartilhados.'
          : 'Concluir first-run/handoff antes de anunciar installer.',
        critical: true,
      },
      {
        id: 'productization-evidence',
        label: 'Productization Evidence',
        status: !input.productizationEvidence
          ? 'needs-action'
          : input.productizationEvidence.status === 'blocked'
            ? 'blocked'
            : input.releasePreviewReady
              ? 'ready'
              : 'needs-action',
        source: 'ProductizationEvidenceService',
        command: 'zavorth productization-evidence --json',
        detail: input.releasePreviewReady
          ? 'Preview de release esta ligado a evidencias do runtime.'
          : 'Publicar readiness de produto antes de gerar installer.',
        critical: true,
      },
      {
        id: 'public-release-bundle',
        label: 'Public Release Bundle',
        status: input.releaseBundleReady ? 'ready' : input.releaseBundleStatus === 'blocked' ? 'blocked' : 'needs-action',
        source: 'PublicReleaseBundleContractService',
        command: 'npm run qa:release-bundle',
        detail: input.releaseBundleLinked
          ? `Bundle publico esta ${input.releaseBundleStatus}.`
          : 'Snapshot publicReleaseBundle ainda nao foi anexado ao run.',
        critical: true,
      },
      {
        id: 'installer-preview',
        label: 'Installer preview',
        status: input.installerPreviewAvailable ? 'ready' : 'needs-action',
        source: 'ReleaseInstallerRollbackPathService',
        command: 'zavorth release install --dry-run',
        detail: input.installerPreviewAvailable
          ? 'Installer so aparece como dry-run com checksum obrigatorio.'
          : 'Gerar/validar preview do installer depois do bundle publico.',
        critical: true,
      },
      {
        id: 'rollback-preview',
        label: 'Rollback preview',
        status: input.rollbackAvailable ? 'ready' : 'needs-action',
        source: 'ReleaseInstallerRollbackPathService',
        command: 'zavorth release rollback --dry-run',
        detail: input.rollbackAvailable
          ? 'Rollback esta anunciado como comando explicito e local.'
          : 'Anexar evidencia de rollback antes de promover para stable.',
        critical: true,
      },
      {
        id: 'canary-dormant',
        label: 'Etapa 84 / canary dormente',
        status: 'ready',
        source: 'ReleaseInstallerRollbackPathService',
        command: 'zavorth release canary --dry-run',
        detail: input.canPublishStable
          ? 'Mesmo com stable potencial, canary real permanece dormente na Channel mesh8.'
          : 'Canary real fica bloqueado ate produto operavel e usuarios reais.',
        critical: false,
      },
    ];
  }

  private buildSurfaces(
    runId: string,
    releaseBundleLinked: boolean,
    installerPreviewAvailable: boolean,
    rollbackAvailable: boolean,
  ): ReleaseInstallerRollbackPathSurface[] {
    return [
      {
        id: 'cli',
        label: 'CLI release path',
        commandOrPath: `zavorth release-path run ${runId} --json`,
        status: 'ready',
        detail: 'Snapshot consumivel por CLI sem publicar release.',
      },
      {
        id: 'control',
        label: 'ZavorthControl',
        commandOrPath: `/zavorthControl?runId=${encodeURIComponent(runId)}&sector=config`,
        status: 'ready',
        detail: 'Config sector renderiza release, installer e rollback.',
      },
      {
        id: 'public-release',
        label: 'Public /release',
        commandOrPath: '/release',
        status: releaseBundleLinked ? 'ready' : 'needs-action',
        detail: 'Rota publica precisa expor bundle, comandos e policy.',
      },
      {
        id: 'installer-preview',
        label: 'Installer dry-run',
        commandOrPath: 'zavorth release install --dry-run',
        status: installerPreviewAvailable ? 'ready' : 'needs-action',
        detail: 'Installer nao e executado pela Channel mesh8.',
      },
      {
        id: 'rollback-preview',
        label: 'Rollback dry-run',
        commandOrPath: 'zavorth release rollback --dry-run',
        status: rollbackAvailable ? 'ready' : 'needs-action',
        detail: 'Rollback exige comando explicito do operador.',
      },
    ];
  }

  private buildReceipts(input: {
    productEntryRuntimeLinked: boolean;
    productizationEvidenceLinked: boolean;
    releaseBundleLinked: boolean;
    installerPreviewAvailable: boolean;
    rollbackAvailable: boolean;
  }): ReleaseInstallerRollbackPathReceipt[] {
    return [
      {
        id: 'release-path:product-entry',
        kind: 'product-entry',
        source: 'ProductEntryRuntimeService',
        detail: input.productEntryRuntimeLinked ? 'Product Entry Runtime anexado.' : 'Product Entry Runtime ausente.',
        status: input.productEntryRuntimeLinked ? 'ready' : 'needs-action',
      },
      {
        id: 'release-path:productization',
        kind: 'productization',
        source: 'ProductizationEvidenceService',
        detail: input.productizationEvidenceLinked ? 'Productization Evidence anexado.' : 'Productization Evidence ausente.',
        status: input.productizationEvidenceLinked ? 'ready' : 'needs-action',
      },
      {
        id: 'release-path:bundle',
        kind: 'release-bundle',
        source: 'PublicReleaseBundleContractService',
        detail: input.releaseBundleLinked ? 'Public Release Bundle anexado.' : 'Bundle publico pendente.',
        status: input.releaseBundleLinked ? 'ready' : 'needs-action',
      },
      {
        id: 'release-path:installer',
        kind: 'installer',
        source: 'ReleaseInstallerRollbackPathService',
        detail: input.installerPreviewAvailable ? 'Installer limitado a dry-run.' : 'Installer preview pendente.',
        status: input.installerPreviewAvailable ? 'ready' : 'needs-action',
      },
      {
        id: 'release-path:rollback',
        kind: 'rollback',
        source: 'ReleaseInstallerRollbackPathService',
        detail: input.rollbackAvailable ? 'Rollback explicitamente disponivel.' : 'Rollback preview pendente.',
        status: input.rollbackAvailable ? 'ready' : 'needs-action',
      },
      {
        id: 'release-path:policy',
        kind: 'policy',
        source: 'ReleaseInstallerRollbackPathService',
        detail: 'Channel mesh8 nao publica release, nao executa installer e nao inicia canary.',
        status: 'ready',
      },
    ];
  }

  private resolveNextSafeAction(status: ReleaseInstallerRollbackPathStatus): string {
    if (status === 'needs-product-entry') {
      return 'Concluir Product Entry Runtime e first-run antes de preparar installer.';
    }
    if (status === 'needs-release-bundle') {
      return 'Anexar Public Release Bundle e rodar npm run qa:release-bundle.';
    }
    if (status === 'needs-installer-preview') {
      return 'Gerar apenas preview do installer com checksum e sem executar instalacao.';
    }
    if (status === 'rollback-ready') {
      return 'Manter stable/canary dormentes ate haver aprovacao explicita de release real.';
    }
    if (status === 'blocked') {
      return 'Rebaixar para preview e corrigir stable, bundle ou rollback antes de qualquer publicacao.';
    }
    if (status === 'dormant-canary') {
      return 'Manter Etapa 84 dormente ate produto operavel e usuarios reais.';
    }
    return 'Manter release em preview; use dry-run de installer e rollback antes da Channel mesh9.';
  }
}
