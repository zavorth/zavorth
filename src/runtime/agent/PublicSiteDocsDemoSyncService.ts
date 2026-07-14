import type { PublicDemoContractSnapshot } from '../../contracts/PublicDemoContract.js';
import type { PublicDocsRecipesSnapshot } from '../../contracts/PublicDocsRecipesContract.js';
import type { PublicReleaseBundleContractSnapshot } from '../../contracts/PublicReleaseBundleContract.js';
import type { WebsitePublicContractSnapshot } from '../../contracts/WebsitePublicContract.js';
import type { ReleaseInstallerRollbackPathSnapshot } from './ReleaseInstallerRollbackPathService.js';
import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';
export const PUBLIC_SITE_DOCS_DEMO_SYNC_CONTRACT_VERSION = '2026-05-04.docs-demo' as const;
export const PUBLIC_SITE_DOCS_DEMO_SYNC_METADATA_KEY = 'publicSiteDocsDemoSync' as const;

export type PublicSiteDocsDemoSyncStatus =
  | 'synced-preview'
  | 'needs-release-path'
  | 'needs-public-site'
  | 'needs-docs'
  | 'needs-demo'
  | 'blocked'
  | 'stable-claim-blocked';

export type PublicSiteDocsDemoSyncGateStatus = 'ready' | 'needs-action' | 'blocked' | 'unknown';

export type PublicSiteDocsDemoSyncGate = {
  id: string;
  label: string;
  status: PublicSiteDocsDemoSyncGateStatus;
  source:
    | 'ReleaseInstallerRollbackPathService'
    | 'WebsitePublicContractService'
    | 'PublicDemoContractService'
    | 'PublicDocsRecipesService'
    | 'PublicReleaseBundleContractService'
    | 'PublicSiteDocsDemoSyncService';
  command: string;
  detail: string;
  critical: boolean;
};

export type PublicSiteDocsDemoSyncSurface = {
  id: 'cli' | 'control' | 'website' | 'docs' | 'examples' | 'demo' | 'release';
  label: string;
  routeOrCommand: string;
  status: PublicSiteDocsDemoSyncGateStatus;
  detail: string;
};

export type PublicSiteDocsDemoSyncReceipt = {
  id: string;
  kind: 'release-path' | 'website' | 'docs' | 'demo' | 'release-bundle' | 'policy';
  source: string;
  detail: string;
  status: PublicSiteDocsDemoSyncGateStatus;
};

export type PublicSiteDocsDemoSyncSnapshot = {
  contractVersion: typeof PUBLIC_SITE_DOCS_DEMO_SYNC_CONTRACT_VERSION;
  source: 'PublicSiteDocsDemoSyncService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: PublicSiteDocsDemoSyncStatus;
  sync: {
    releasePathLinked: boolean;
    releasePathStatus: string | null;
    websiteLinked: boolean;
    docsLinked: boolean;
    demoLinked: boolean;
    releaseBundleLinked: boolean;
    publicRoutes: string[];
  };
  publicSite: {
    status: 'ready' | 'attention' | 'blocked' | 'unknown';
    routeCount: number;
    requiredRoutes: string[];
    forbiddenClaimCount: number;
    buildExecuted: false;
    deployExecuted: false;
  };
  docs: {
    status: 'ready' | 'attention' | 'blocked' | 'unknown';
    routes: string[];
    recipeCount: number;
    noSecretsMatrixReady: boolean;
    releasePathMentionRequired: true;
  };
  demo: {
    status: 'ready' | 'attention' | 'blocked' | 'unknown';
    route: '/demo';
    fixtureFirst: boolean;
    requiredStateCount: number;
    requiredArtifactCount: number;
    replayExpected: boolean;
    approvalStoryPresent: boolean;
  };
  releaseNarrative: {
    channel: 'preview' | 'stable' | 'lts' | 'dev' | 'unknown';
    stableClaimAllowed: false;
    previewOnly: true;
    installerDryRun: boolean;
    rollbackDryRun: boolean;
    canaryDormant: true;
  };
  readiness: {
    releaseInstallerRollbackPathLinked: boolean;
    websitePublicLinked: boolean;
    publicDemoLinked: boolean;
    publicDocsRecipesLinked: boolean;
    publicReleaseBundleLinked: boolean;
    docsDemoAligned: boolean;
    noStableClaim: true;
    canPublishSitePreview: boolean;
    canAnnounceStable: false;
    canStartCanary: false;
  };
  gates: PublicSiteDocsDemoSyncGate[];
  surfaces: PublicSiteDocsDemoSyncSurface[];
  receipts: PublicSiteDocsDemoSyncReceipt[];
  policy: {
    noWebsiteBuildExecuted: true;
    noPublicDeployExecuted: true;
    noDemoLiveExecution: true;
    noExternalTelemetryEnabled: true;
    noReleasePublished: true;
    noInstallerExecuted: true;
    noStableClaimPublished: true;
    noCanaryStarted: true;
    docsMustDescribePreview: true;
    naturalLanguageDoesNotBypassPolicy: true;
    secretsSerialized: false;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
    websiteRoute: '/';
    docsRoute: '/docs';
    examplesRoute: '/examples';
    demoRoute: '/demo';
    releaseRoute: '/release';
  };
  nextSafeAction: string;
};

export type PublicSiteDocsDemoSyncInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
};

type PublicSiteDocsDemoSyncDependencies = {
  now?: () => Date;
  websitePublicService?: { buildSnapshot(): WebsitePublicContractSnapshot } | null;
  publicDemoService?: { buildSnapshot(): PublicDemoContractSnapshot } | null;
  publicDocsRecipesService?: { buildSnapshot(): PublicDocsRecipesSnapshot } | null;
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

function arrayOrEmpty<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function safeCall<T>(factory: () => T): T | null {
  try {
    return factory();
  } catch (error: unknown) {return null;
  }
}

function normalizePublicStatus(value: unknown): 'ready' | 'attention' | 'blocked' | 'unknown' {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'ready' || raw === 'attention' || raw === 'blocked') {
    return raw;
  }
  return 'unknown';
}

function normalizeReleaseChannel(value: unknown): PublicSiteDocsDemoSyncSnapshot['releaseNarrative']['channel'] {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'preview' || raw === 'stable' || raw === 'lts' || raw === 'dev') {
    return raw;
  }
  return 'unknown';
}

function gateStatusFromPublicStatus(status: 'ready' | 'attention' | 'blocked' | 'unknown'): PublicSiteDocsDemoSyncGateStatus {
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

export class PublicSiteDocsDemoSyncService {
  private readonly now: () => Date;
  private readonly websitePublicService: { buildSnapshot(): WebsitePublicContractSnapshot } | null;
  private readonly publicDemoService: { buildSnapshot(): PublicDemoContractSnapshot } | null;
  private readonly publicDocsRecipesService: { buildSnapshot(): PublicDocsRecipesSnapshot } | null;
  private readonly publicReleaseBundleService: { buildSnapshot(): PublicReleaseBundleContractSnapshot } | null;

  constructor(runtime: PublicSiteDocsDemoSyncDependencies = {}) {
    this.now = runtime.now || (() => new Date());
    this.websitePublicService = runtime.websitePublicService || null;
    this.publicDemoService = runtime.publicDemoService || null;
    this.publicDocsRecipesService = runtime.publicDocsRecipesService || null;
    this.publicReleaseBundleService = runtime.publicReleaseBundleService || null;
  }

  public buildSnapshot(input: PublicSiteDocsDemoSyncInput): PublicSiteDocsDemoSyncSnapshot {
    const { run } = input;
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const releasePath = recordOrNull(run.metadata.releaseInstallerRollbackPath) as ReleaseInstallerRollbackPathSnapshot | null;
    const website = this.readWebsitePublic(run);
    const docs = this.readPublicDocs(run);
    const demo = this.readPublicDemo(run);
    const releaseBundle = this.readReleaseBundle(run);
    const websiteStatus = normalizePublicStatus(website?.status);
    const docsStatus = normalizePublicStatus(docs?.status);
    const demoStatus = normalizePublicStatus(demo?.status);
    const releaseBundleStatus = normalizePublicStatus(releaseBundle?.status);
    const publicRoutes = this.resolvePublicRoutes(website, docs, demo, releaseBundle);
    const releaseChannel = normalizeReleaseChannel(releasePath?.release.channel);
    const installerDryRun = Boolean(releasePath?.installer.dryRunCommand);
    const rollbackDryRun = Boolean(releasePath?.rollback.rollbackCommand);
    const docsDemoAligned = Boolean(
      releasePath
      && website
      && docs
      && demo
      && releaseBundle
      && websiteStatus !== 'blocked'
      && docsStatus !== 'blocked'
      && demoStatus !== 'blocked'
      && releaseBundleStatus !== 'blocked',
    );
    const canPublishSitePreview = docsDemoAligned && releasePath?.status !== 'blocked';
    const status = this.resolveStatus({
      releasePath,
      website,
      docs,
      demo,
      websiteStatus,
      docsStatus,
      demoStatus,
      releaseBundleStatus,
      releaseChannel,
    });
    const gates = this.buildGates({
      releasePath,
      websiteStatus,
      docsStatus,
      demoStatus,
      releaseBundleStatus,
      docsDemoAligned,
      canPublishSitePreview,
    });
    const surfaces = this.buildSurfaces({
      websiteStatus,
      docsStatus,
      demoStatus,
      releaseBundleStatus,
      canPublishSitePreview,
    });
    const receipts = this.buildReceipts({
      releasePathLinked: Boolean(releasePath),
      websiteLinked: Boolean(website),
      docsLinked: Boolean(docs),
      demoLinked: Boolean(demo),
      releaseBundleLinked: Boolean(releaseBundle),
      docsDemoAligned,
    });

    return {
      contractVersion: PUBLIC_SITE_DOCS_DEMO_SYNC_CONTRACT_VERSION,
      source: 'PublicSiteDocsDemoSyncService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
      },
      status,
      sync: {
        releasePathLinked: Boolean(releasePath),
        releasePathStatus: releasePath?.status || null,
        websiteLinked: Boolean(website),
        docsLinked: Boolean(docs),
        demoLinked: Boolean(demo),
        releaseBundleLinked: Boolean(releaseBundle),
        publicRoutes,
      },
      publicSite: {
        status: websiteStatus,
        routeCount: arrayOrEmpty(website?.requiredRoutes).length,
        requiredRoutes: arrayOrEmpty<{ route?: string }>(website?.requiredRoutes).map((route) => normalizeText(route.route)).filter(Boolean),
        forbiddenClaimCount: arrayOrEmpty(website?.forbiddenClaims).length,
        buildExecuted: false,
        deployExecuted: false,
      },
      docs: {
        status: docsStatus,
        routes: arrayOrEmpty(docs?.routes).map((route) => normalizeText(route)).filter(Boolean),
        recipeCount: arrayOrEmpty(docs?.recipes).length,
        noSecretsMatrixReady: arrayOrEmpty(docs?.noSecretsMatrix).every((entry) => recordOrNull(entry)?.runsWithoutSecrets !== false),
        releasePathMentionRequired: true,
      },
      demo: {
        status: demoStatus,
        route: '/demo',
        fixtureFirst: Boolean(demo?.fixturePath),
        requiredStateCount: arrayOrEmpty(demo?.requiredStates).length,
        requiredArtifactCount: arrayOrEmpty(demo?.requiredArtifacts).length,
        replayExpected: arrayOrEmpty(demo?.requiredStates).some((state) => normalizeText(state).toLowerCase() === 'replay'),
        approvalStoryPresent: arrayOrEmpty(demo?.requiredStates).some((state) => normalizeText(state).toLowerCase() === 'approval'),
      },
      releaseNarrative: {
        channel: releaseChannel,
        stableClaimAllowed: false,
        previewOnly: true,
        installerDryRun,
        rollbackDryRun,
        canaryDormant: true,
      },
      readiness: {
        releaseInstallerRollbackPathLinked: Boolean(releasePath),
        websitePublicLinked: Boolean(website),
        publicDemoLinked: Boolean(demo),
        publicDocsRecipesLinked: Boolean(docs),
        publicReleaseBundleLinked: Boolean(releaseBundle),
        docsDemoAligned,
        noStableClaim: true,
        canPublishSitePreview,
        canAnnounceStable: false,
        canStartCanary: false,
      },
      gates,
      surfaces,
      receipts,
      policy: {
        noWebsiteBuildExecuted: true,
        noPublicDeployExecuted: true,
        noDemoLiveExecution: true,
        noExternalTelemetryEnabled: true,
        noReleasePublished: true,
        noInstallerExecuted: true,
        noStableClaimPublished: true,
        noCanaryStarted: true,
        docsMustDescribePreview: true,
        naturalLanguageDoesNotBypassPolicy: true,
        secretsSerialized: false,
      },
      surface: {
        cliCommand: `zavorth public-sync run ${run.id} --json`,
        zavorthControlPath: `/zavorthControl?runId=${encodeURIComponent(run.id)}&sector=config`,
        websiteRoute: '/',
        docsRoute: '/docs',
        examplesRoute: '/examples',
        demoRoute: '/demo',
        releaseRoute: '/release',
      },
      nextSafeAction: this.resolveNextSafeAction(status),
    };
  }

  private readWebsitePublic(run: UniversalAgentRun): WebsitePublicContractSnapshot | null {
    const metadata = recordOrNull(run.metadata.websitePublic)
      || recordOrNull(run.metadata.websitePublicContract)
      || recordOrNull(run.metadata.publicWebsite);
    if (metadata) {
      return metadata as unknown as WebsitePublicContractSnapshot;
    }
    return this.websitePublicService ? safeCall(() => this.websitePublicService!.buildSnapshot()) : null;
  }

  private readPublicDocs(run: UniversalAgentRun): PublicDocsRecipesSnapshot | null {
    const metadata = recordOrNull(run.metadata.publicDocsRecipes)
      || recordOrNull(run.metadata.externalDocs)
      || recordOrNull(run.metadata.publicDocs);
    if (metadata) {
      return metadata as unknown as PublicDocsRecipesSnapshot;
    }
    return this.publicDocsRecipesService ? safeCall(() => this.publicDocsRecipesService!.buildSnapshot()) : null;
  }

  private readPublicDemo(run: UniversalAgentRun): PublicDemoContractSnapshot | null {
    const metadata = recordOrNull(run.metadata.publicDemo)
      || recordOrNull(run.metadata.publicDemoContract);
    if (metadata) {
      return metadata as unknown as PublicDemoContractSnapshot;
    }
    return this.publicDemoService ? safeCall(() => this.publicDemoService!.buildSnapshot()) : null;
  }

  private readReleaseBundle(run: UniversalAgentRun): PublicReleaseBundleContractSnapshot | null {
    const metadata = recordOrNull(run.metadata.publicReleaseBundle)
      || recordOrNull(run.metadata.releaseBundle);
    if (metadata) {
      return metadata as unknown as PublicReleaseBundleContractSnapshot;
    }
    return this.publicReleaseBundleService ? safeCall(() => this.publicReleaseBundleService!.buildSnapshot()) : null;
  }

  private resolvePublicRoutes(
    website: WebsitePublicContractSnapshot | null,
    docs: PublicDocsRecipesSnapshot | null,
    demo: PublicDemoContractSnapshot | null,
    releaseBundle: PublicReleaseBundleContractSnapshot | null,
  ): string[] {
    return Array.from(new Set([
      ...arrayOrEmpty<{ route?: string }>(website?.requiredRoutes).map((route) => normalizeText(route.route)),
      ...arrayOrEmpty<string>(docs?.routes),
      normalizeText(demo?.route),
      normalizeText(releaseBundle?.route),
    ].filter(Boolean)));
  }

  private resolveStatus(input: {
    releasePath: ReleaseInstallerRollbackPathSnapshot | null;
    website: WebsitePublicContractSnapshot | null;
    docs: PublicDocsRecipesSnapshot | null;
    demo: PublicDemoContractSnapshot | null;
    websiteStatus: 'ready' | 'attention' | 'blocked' | 'unknown';
    docsStatus: 'ready' | 'attention' | 'blocked' | 'unknown';
    demoStatus: 'ready' | 'attention' | 'blocked' | 'unknown';
    releaseBundleStatus: 'ready' | 'attention' | 'blocked' | 'unknown';
    releaseChannel: PublicSiteDocsDemoSyncSnapshot['releaseNarrative']['channel'];
  }): PublicSiteDocsDemoSyncStatus {
    if (!input.releasePath) {
      return 'needs-release-path';
    }
    if (input.releasePath.status === 'blocked' || input.websiteStatus === 'blocked' || input.docsStatus === 'blocked' || input.demoStatus === 'blocked' || input.releaseBundleStatus === 'blocked') {
      return 'blocked';
    }
    if (input.releaseChannel === 'stable' && !input.releasePath.readiness.canPublishStable) {
      return 'stable-claim-blocked';
    }
    if (!input.website || input.websiteStatus === 'unknown') {
      return 'needs-public-site';
    }
    if (!input.docs || input.docsStatus === 'unknown') {
      return 'needs-docs';
    }
    if (!input.demo || input.demoStatus === 'unknown') {
      return 'needs-demo';
    }
    return 'synced-preview';
  }

  private buildGates(input: {
    releasePath: ReleaseInstallerRollbackPathSnapshot | null;
    websiteStatus: 'ready' | 'attention' | 'blocked' | 'unknown';
    docsStatus: 'ready' | 'attention' | 'blocked' | 'unknown';
    demoStatus: 'ready' | 'attention' | 'blocked' | 'unknown';
    releaseBundleStatus: 'ready' | 'attention' | 'blocked' | 'unknown';
    docsDemoAligned: boolean;
    canPublishSitePreview: boolean;
  }): PublicSiteDocsDemoSyncGate[] {
    return [
      {
        id: 'release-installer-rollback-path',
        label: 'Release path canonico',
        status: input.releasePath && input.releasePath.status !== 'blocked' ? 'ready' : input.releasePath ? 'blocked' : 'needs-action',
        source: 'ReleaseInstallerRollbackPathService',
        command: 'zavorth release-path --json',
        detail: input.releasePath
          ? `Release path esta ${input.releasePath.status}.`
          : 'Public sync needs Channel mesh8 publicada no run.',
        critical: true,
      },
      {
        id: 'website-public',
        label: 'Website publico',
        status: gateStatusFromPublicStatus(input.websiteStatus),
        source: 'WebsitePublicContractService',
        command: 'npm run qa:website-public',
        detail: input.websiteStatus === 'ready'
          ? 'Landing e rotas publicas estao sincronizadas em modo preview.'
          : 'Validar site publico antes de divulgar a jornada.',
        critical: true,
      },
      {
        id: 'public-docs-recipes',
        label: 'Docs e recipes publicas',
        status: gateStatusFromPublicStatus(input.docsStatus),
        source: 'PublicDocsRecipesService',
        command: 'npm run qa:public-docs-recipes',
        detail: input.docsStatus === 'ready'
          ? 'Docs e recipes cobrem quickstart, release, replay e exemplos sem secrets.'
          : 'Sincronizar docs/examples com release path e preview-only.',
        critical: true,
      },
      {
        id: 'public-demo',
        label: 'Demo publica fixture-first',
        status: gateStatusFromPublicStatus(input.demoStatus),
        source: 'PublicDemoContractService',
        command: 'npm run qa:public-demo',
        detail: input.demoStatus === 'ready'
          ? 'Demo mostra request, approval, artifact e replay sem execucao live.'
          : 'Atualizar /demo para refletir o runtime sem dependencias externas.',
        critical: true,
      },
      {
        id: 'release-bundle-route',
        label: 'Rota /release',
        status: gateStatusFromPublicStatus(input.releaseBundleStatus),
        source: 'PublicReleaseBundleContractService',
        command: 'npm run qa:release-bundle',
        detail: input.releaseBundleStatus === 'ready'
          ? '/release aponta para bundle, installer dry-run e rollback preview.'
          : 'Corrigir /release antes de sincronizar site/docs/demo.',
        critical: true,
      },
      {
        id: 'preview-only-narrative',
        label: 'Narrativa preview-only',
        status: input.canPublishSitePreview ? 'ready' : 'needs-action',
        source: 'PublicSiteDocsDemoSyncService',
        command: 'zavorth public-sync --json',
        detail: input.docsDemoAligned
          ? 'Site, docs e demo podem falar em preview; stable continua bloqueado.'
          : 'Alinhar todas as superficies antes de divulgar preview publico.',
        critical: true,
      },
    ];
  }

  private buildSurfaces(input: {
    websiteStatus: 'ready' | 'attention' | 'blocked' | 'unknown';
    docsStatus: 'ready' | 'attention' | 'blocked' | 'unknown';
    demoStatus: 'ready' | 'attention' | 'blocked' | 'unknown';
    releaseBundleStatus: 'ready' | 'attention' | 'blocked' | 'unknown';
    canPublishSitePreview: boolean;
  }): PublicSiteDocsDemoSyncSurface[] {
    return [
      {
        id: 'cli',
        label: 'CLI public sync',
        routeOrCommand: 'zavorth public-sync --json',
        status: 'ready',
        detail: 'Snapshot read-only para auditoria de narrativa publica.',
      },
      {
        id: 'control',
        label: 'ZavorthControl',
        routeOrCommand: '/zavorthControl?sector=config',
        status: 'ready',
        detail: 'Config mostra site/docs/demo/release sync.',
      },
      {
        id: 'website',
        label: 'Website',
        routeOrCommand: '/',
        status: gateStatusFromPublicStatus(input.websiteStatus),
        detail: input.canPublishSitePreview ? 'Landing alinhada ao preview.' : 'Landing precisa de sync.',
      },
      {
        id: 'docs',
        label: 'Docs',
        routeOrCommand: '/docs',
        status: gateStatusFromPublicStatus(input.docsStatus),
        detail: 'Docs devem explicar preview, installer dry-run e rollback preview.',
      },
      {
        id: 'examples',
        label: 'Examples',
        routeOrCommand: '/examples',
        status: gateStatusFromPublicStatus(input.docsStatus),
        detail: 'Examples usam recipes fixture-safe.',
      },
      {
        id: 'demo',
        label: 'Demo',
        routeOrCommand: '/demo',
        status: gateStatusFromPublicStatus(input.demoStatus),
        detail: 'Demo publica continua fixture-first.',
      },
      {
        id: 'release',
        label: 'Release',
        routeOrCommand: '/release',
        status: gateStatusFromPublicStatus(input.releaseBundleStatus),
        detail: 'Release publico nao anuncia stable sem gates reais.',
      },
    ];
  }

  private buildReceipts(input: {
    releasePathLinked: boolean;
    websiteLinked: boolean;
    docsLinked: boolean;
    demoLinked: boolean;
    releaseBundleLinked: boolean;
    docsDemoAligned: boolean;
  }): PublicSiteDocsDemoSyncReceipt[] {
    return [
      {
        id: 'public-sync:release-path',
        kind: 'release-path',
        source: 'ReleaseInstallerRollbackPathService',
        detail: input.releasePathLinked ? 'Release path anexado.' : 'Release path ausente.',
        status: input.releasePathLinked ? 'ready' : 'needs-action',
      },
      {
        id: 'public-sync:website',
        kind: 'website',
        source: 'WebsitePublicContractService',
        detail: input.websiteLinked ? 'Website publico anexado.' : 'Website publico ausente.',
        status: input.websiteLinked ? 'ready' : 'needs-action',
      },
      {
        id: 'public-sync:docs',
        kind: 'docs',
        source: 'PublicDocsRecipesService',
        detail: input.docsLinked ? 'Docs/recipes anexados.' : 'Docs/recipes ausentes.',
        status: input.docsLinked ? 'ready' : 'needs-action',
      },
      {
        id: 'public-sync:demo',
        kind: 'demo',
        source: 'PublicDemoContractService',
        detail: input.demoLinked ? 'Demo publica anexada.' : 'Demo publica ausente.',
        status: input.demoLinked ? 'ready' : 'needs-action',
      },
      {
        id: 'public-sync:release-bundle',
        kind: 'release-bundle',
        source: 'PublicReleaseBundleContractService',
        detail: input.releaseBundleLinked ? 'Release bundle anexado.' : 'Release bundle ausente.',
        status: input.releaseBundleLinked ? 'ready' : 'needs-action',
      },
      {
        id: 'public-sync:policy',
        kind: 'policy',
        source: 'PublicSiteDocsDemoSyncService',
        detail: input.docsDemoAligned
          ? 'Narrativa publica sincronizada em preview-only.'
          : 'Narrativa publica ainda precisa de sync.',
        status: input.docsDemoAligned ? 'ready' : 'needs-action',
      },
    ];
  }

  private resolveNextSafeAction(status: PublicSiteDocsDemoSyncStatus): string {
    if (status === 'needs-release-path') {
      return 'Executar Channel mesh8 e publicar releaseInstallerRollbackPath antes de sincronizar site/docs/demo.';
    }
    if (status === 'needs-public-site') {
      return 'Anexar WebsitePublicContract e validar npm run qa:website-public.';
    }
    if (status === 'needs-docs') {
      return 'Anexar PublicDocsRecipes e validar npm run qa:public-docs-recipes.';
    }
    if (status === 'needs-demo') {
      return 'Anexar PublicDemo e validar npm run qa:public-demo.';
    }
    if (status === 'stable-claim-blocked') {
      return 'Remover claim de stable e manter narrativa preview-only ate release real.';
    }
    if (status === 'blocked') {
      return 'Corrigir superficies bloqueadas antes de divulgar qualquer pagina publica.';
    }
    return 'Publicar apenas narrativa preview; manter stable, deploy e canary dependentes de aprovacao futura.';
  }
}
