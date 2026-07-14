import type {
  FirstRunOnboardingContractSnapshot,
} from '../../contracts/FirstRunOnboardingContract.js';
import type {
  ZavorthFirstRunBootstrapPlan,
  ZavorthWorkspaceIdentityProfileSnapshot,
} from '../../contracts/FirstRunWorkspaceBootstrapContract.js';
import {
  FirstRunWorkspaceBootstrapProfileService,
} from '../../services/FirstRunWorkspaceBootstrapProfileService.js';
import {
  FirstRunPersonalizationService,
  type FirstRunPersonalizationStatus,
} from '../../services/FirstRunPersonalizationService.js';


import type { ProductizationEvidenceSnapshot } from './ProductizationEvidenceService.js';
import type {
  UniversalAgentChannel,
  UniversalAgentRun,
} from './UniversalAgentRuntimeTypes.js';
export const PRODUCT_ENTRY_RUNTIME_CONTRACT_VERSION = '2026-05-04.product-entry' as const;

export type ProductEntryRuntimeStatus =
  | 'ready'
  | 'needs_first_run'
  | 'needs_doctor'
  | 'needs_install_preview'
  | 'blocked_by_policy'
  | 'rollback_available'
  | 'handoff_to_agent_runtime';

export type ProductEntryRuntimeGateStatus = 'ready' | 'needs-action' | 'blocked' | 'unknown';

export type ProductEntryRuntimeSurfaceId =
  | 'cli'
  | 'go'
  | 'chat'
  | 'control'
  | 'zavorthControl-onboarding'
  | 'public-start'
  | 'api';

export type ProductEntryRuntimeGate = {
  id: string;
  label: string;
  status: ProductEntryRuntimeGateStatus;
  source:
    | 'FirstRunWorkspaceBootstrapProfileService'
    | 'FirstRunPersonalizationService'
    | 'FirstRunOnboardingContractService'
    | 'ProductizationEvidenceService'
    | 'ProductEntryRuntimeService';
  command: string;
  detail: string;
  critical: boolean;
};

export type ProductEntryRuntimeSurface = {
  id: ProductEntryRuntimeSurfaceId;
  label: string;
  commandOrPath: string;
  status: ProductEntryRuntimeGateStatus;
  entryState: ProductEntryRuntimeStatus;
};

export type ProductEntryRuntimeReceipt = {
  id: string;
  kind: 'first-run' | 'personalization' | 'onboarding' | 'productization' | 'handoff' | 'policy' | 'surface';
  source: string;
  detail: string;
  status: ProductEntryRuntimeGateStatus;
};

export type ProductEntryRuntimeSnapshot = {
  contractVersion: typeof PRODUCT_ENTRY_RUNTIME_CONTRACT_VERSION;
  source: 'ProductEntryRuntimeService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: ProductEntryRuntimeStatus;
  entry: {
    channel: UniversalAgentChannel;
    requestedSurface: ProductEntryRuntimeSurfaceId;
    handoffTarget: 'ZavorthAgentGateway' | null;
    handoffAllowed: boolean;
    sharedStateSource: 'ProductEntryRuntimeService';
  };
  firstRun: {
    profileConfigured: boolean;
    profilePath: string;
    bootstrapPlanStatus: ZavorthFirstRunBootstrapPlan['status'] | 'unknown';
    dryRunAvailable: boolean;
    nonInteractiveSafe: boolean;
    questionCount: number;
    safeDefaultsAvailable: boolean;
    personalizationPending: boolean;
    personalizationReasons: string[];
    onboardingStatus: FirstRunOnboardingContractSnapshot['status'] | 'unknown';
    onboardingRoute: string | null;
  };
  workspace: {
    workspaceRoot: string | null;
    storageRoot: string | null;
    identityConfigured: boolean;
    memoryMode: string | null;
    safetyPosture: string | null;
    providerStatus: string | null;
    rollbackAvailable: boolean;
  };
  readiness: {
    productizationEvidenceLinked: boolean;
    releasePreviewReady: boolean;
    doctorRequired: boolean;
    installPreviewRequired: boolean;
    firstRunRequired: boolean;
    canStartAgentRuntime: boolean;
    handoffToAgentRuntime: boolean;
  };
  gates: ProductEntryRuntimeGate[];
  surfaces: ProductEntryRuntimeSurface[];
  receipts: ProductEntryRuntimeReceipt[];
  policy: {
    noProfileWritePerformed: true;
    noRuntimePersistentStart: true;
    noProviderExecutionPerformed: true;
    noToolExecutionPerformed: true;
    noMessageSendPerformed: true;
    noRawImportPerformed: true;
    firstRunStateSharedAcrossSurfaces: true;
    naturalLanguageDoesNotBypassPolicy: true;
    secretsSerialized: false;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
    publicStartRoute: '/start';
    zavorthControlOnboardingPath: '/zavorthControl?sector=config';
    goCommand: 'zavorth go --dry-run';
  };
  nextSafeAction: string;
};

export type ProductEntryRuntimeInput = {
  run: UniversalAgentRun;
  requestedSurface?: ProductEntryRuntimeSurfaceId | null;
  generatedAt?: string | null;
};

type ProductEntryRuntimeDependencies = {
  now?: () => Date;
  firstRunProfileService?: Pick<FirstRunWorkspaceBootstrapProfileService, 'buildPlan' | 'buildWorkspaceIdentitySnapshot' | 'resolvePaths'> | null;
  personalizationService?: Pick<FirstRunPersonalizationService, 'getStatus'> | null;
  firstRunOnboardingService?: { buildSnapshot(): FirstRunOnboardingContractSnapshot } | null;
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

function safeCall<T>(factory: () => T): T | null {
  try {
    return factory();
  } catch (error: unknown) {return null;
  }
}

function booleanFlag(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export class ProductEntryRuntimeService {
  private readonly now: () => Date;
  private readonly firstRunProfileService: Pick<FirstRunWorkspaceBootstrapProfileService, 'buildPlan' | 'buildWorkspaceIdentitySnapshot' | 'resolvePaths'>;
  private readonly personalizationService: Pick<FirstRunPersonalizationService, 'getStatus'>;
  private readonly firstRunOnboardingService: { buildSnapshot(): FirstRunOnboardingContractSnapshot } | null;

  constructor(runtime: ProductEntryRuntimeDependencies = {}) {
    this.now = runtime.now || (() => new Date());
    this.firstRunProfileService = runtime.firstRunProfileService || new FirstRunWorkspaceBootstrapProfileService({
      now: this.now,
    });
    this.personalizationService = runtime.personalizationService || new FirstRunPersonalizationService();
    this.firstRunOnboardingService = runtime.firstRunOnboardingService || null;
  }

  public buildSnapshot(input: ProductEntryRuntimeInput): ProductEntryRuntimeSnapshot {
    const { run } = input;
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const requestedSurface = input.requestedSurface || this.surfaceFromRun(run);
    const bootstrapPlan = this.readBootstrapPlan(run);
    const workspaceIdentity = this.readWorkspaceIdentity(run);
    const personalization = this.readPersonalizationStatus(run);
    const onboarding = this.readFirstRunOnboarding(run);
    const productizationEvidence = this.readProductizationEvidence(run);
    const releasePreviewReady = Boolean(productizationEvidence?.summary.releasePreviewReady);
    const firstRunRequired = !workspaceIdentity.configured || personalization.pending;
    const doctorRequired = this.doctorRequired(bootstrapPlan, onboarding, productizationEvidence);
    const installPreviewRequired = !bootstrapPlan || bootstrapPlan.status === 'blocked';
    const rollbackAvailable = Boolean(workspaceIdentity.configured && bootstrapPlan?.writes?.some((write) => write.action === 'update' || write.action === 'skip'));
    const canStartAgentRuntime = !firstRunRequired && !doctorRequired && !installPreviewRequired;
    const gates = this.buildGates(bootstrapPlan, workspaceIdentity, personalization, onboarding, productizationEvidence);
    const status = this.resolveStatus({
      firstRunRequired,
      doctorRequired,
      installPreviewRequired,
      canStartAgentRuntime,
      rollbackAvailable,
      productizationEvidence,
      gates,
    });
    const surfaces = this.buildSurfaces(status);
    const receipts = this.buildReceipts(bootstrapPlan, workspaceIdentity, personalization, onboarding, productizationEvidence, status);

    return {
      contractVersion: PRODUCT_ENTRY_RUNTIME_CONTRACT_VERSION,
      source: 'ProductEntryRuntimeService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
      },
      status,
      entry: {
        channel: run.channel,
        requestedSurface,
        handoffTarget: canStartAgentRuntime ? 'ZavorthAgentGateway' : null,
        handoffAllowed: canStartAgentRuntime,
        sharedStateSource: 'ProductEntryRuntimeService',
      },
      firstRun: {
        profileConfigured: workspaceIdentity.configured,
        profilePath: workspaceIdentity.profilePath,
        bootstrapPlanStatus: bootstrapPlan?.status || 'unknown',
        dryRunAvailable: Boolean(bootstrapPlan?.dryRun),
        nonInteractiveSafe: bootstrapPlan?.nonInteractiveSafe !== false,
        questionCount: bootstrapPlan?.questions.length || 0,
        safeDefaultsAvailable: Boolean(bootstrapPlan?.questions.every((question) => question.defaultValue !== null || !question.required)),
        personalizationPending: personalization.pending,
        personalizationReasons: personalization.reasons,
        onboardingStatus: onboarding?.status || 'unknown',
        onboardingRoute: onboarding?.route || null,
      },
      workspace: {
        workspaceRoot: workspaceIdentity.workspaceRoot,
        storageRoot: bootstrapPlan?.paths.storageRoot || null,
        identityConfigured: workspaceIdentity.configured,
        memoryMode: workspaceIdentity.memoryMode,
        safetyPosture: workspaceIdentity.safetyPosture,
        providerStatus: workspaceIdentity.providerStatus,
        rollbackAvailable,
      },
      readiness: {
        productizationEvidenceLinked: Boolean(productizationEvidence),
        releasePreviewReady,
        doctorRequired,
        installPreviewRequired,
        firstRunRequired,
        canStartAgentRuntime,
        handoffToAgentRuntime: canStartAgentRuntime,
      },
      gates,
      surfaces,
      receipts,
      policy: {
        noProfileWritePerformed: true,
        noRuntimePersistentStart: true,
        noProviderExecutionPerformed: true,
        noToolExecutionPerformed: true,
        noMessageSendPerformed: true,
        noRawImportPerformed: true,
        firstRunStateSharedAcrossSurfaces: true,
        naturalLanguageDoesNotBypassPolicy: true,
        secretsSerialized: false,
      },
      surface: {
        cliCommand: `zavorth product-entry run ${run.id} --json`,
        zavorthControlPath: `/zavorthControl?runId=${encodeURIComponent(run.id)}&sector=config`,
        publicStartRoute: '/start',
        zavorthControlOnboardingPath: '/zavorthControl?sector=config',
        goCommand: 'zavorth go --dry-run',
      },
      nextSafeAction: this.resolveNextSafeAction(status, workspaceIdentity, personalization),
    };
  }

  private surfaceFromRun(run: UniversalAgentRun): ProductEntryRuntimeSurfaceId {
    if (run.channel === 'web') {
      return 'control';
    }
    if (run.channel === 'cli') {
      const text = run.input.toLowerCase();
      if (text.includes('go')) {
        return 'go';
      }
      if (text.includes('chat')) {
        return 'chat';
      }
      return 'cli';
    }
    return 'api';
  }

  private readBootstrapPlan(run: UniversalAgentRun): ZavorthFirstRunBootstrapPlan | null {
    const raw = recordOrNull(run.metadata.productEntryFirstRunPlan)
      || recordOrNull(run.metadata.firstRunBootstrapPlan);
    if (raw) {
      return raw as unknown as ZavorthFirstRunBootstrapPlan;
    }
    return safeCall(() => this.firstRunProfileService.buildPlan({}, {
      dryRun: true,
      nonInteractive: true,
    }));
  }

  private readWorkspaceIdentity(run: UniversalAgentRun): ZavorthWorkspaceIdentityProfileSnapshot {
    const raw = recordOrNull(run.metadata.workspaceIdentityProfile)
      || recordOrNull(run.metadata.firstRunWorkspaceIdentity);
    if (raw) {
      return raw as unknown as ZavorthWorkspaceIdentityProfileSnapshot;
    }
    return safeCall(() => this.firstRunProfileService.buildWorkspaceIdentitySnapshot()) || {
      nativeContract: 'ZavorthWorkspaceIdentityProfileSnapshot/v1',
      configured: false,
      profilePath: safeCall(() => this.firstRunProfileService.resolvePaths().profilePath) || 'data/runtime/first-run/profile.json',
      userDisplayName: null,
      agentDisplayName: null,
      tonePreference: null,
      workspaceRoot: null,
      memoryMode: null,
      safetyPosture: null,
      providerStatus: null,
    };
  }

  private readPersonalizationStatus(run: UniversalAgentRun): FirstRunPersonalizationStatus {
    const raw = recordOrNull(run.metadata.firstRunPersonalizationStatus);
    if (raw) {
      return raw as unknown as FirstRunPersonalizationStatus;
    }
    return safeCall(() => this.personalizationService.getStatus()) || {
      pending: true,
      reasons: ['Status de personalizacao indisponivel.'],
      files: {
        identity: 'IDENTITY.md',
        soul: 'SOUL.md',
        user: 'USER.md',
        bootstrap: 'BOOTSTRAP.md',
        domain: 'DOMAIN.md',
        learningStyle: 'LEARNING-STYLE.md',
        errorHandling: 'ERROR-HANDLING.md',
        outputFormat: 'OUTPUT-FORMAT.md',
        timeAutomation: 'TIME-AUTOMATION.md',
      },
      bootstrapExists: false,
      missingUserFields: [],
      identityName: null,
    };
  }

  private readFirstRunOnboarding(run: UniversalAgentRun): FirstRunOnboardingContractSnapshot | null {
    const raw = recordOrNull(run.metadata.firstRunOnboarding)
      || recordOrNull(run.metadata.firstRunOnboardingContract);
    if (raw) {
      return raw as unknown as FirstRunOnboardingContractSnapshot;
    }
    return this.firstRunOnboardingService
      ? safeCall(() => this.firstRunOnboardingService!.buildSnapshot())
      : null;
  }

  private readProductizationEvidence(run: UniversalAgentRun): ProductizationEvidenceSnapshot | null {
    const raw = recordOrNull(run.metadata.productizationEvidence);
    return raw ? raw as unknown as ProductizationEvidenceSnapshot : null;
  }

  private doctorRequired(
    bootstrapPlan: ZavorthFirstRunBootstrapPlan | null,
    onboarding: FirstRunOnboardingContractSnapshot | null,
    productizationEvidence: ProductizationEvidenceSnapshot | null,
  ): boolean {
    return bootstrapPlan?.status === 'blocked'
      || onboarding?.status === 'blocked'
      || productizationEvidence?.status === 'blocked';
  }

  private buildGates(
    bootstrapPlan: ZavorthFirstRunBootstrapPlan | null,
    workspaceIdentity: ZavorthWorkspaceIdentityProfileSnapshot,
    personalization: FirstRunPersonalizationStatus,
    onboarding: FirstRunOnboardingContractSnapshot | null,
    productizationEvidence: ProductizationEvidenceSnapshot | null,
  ): ProductEntryRuntimeGate[] {
    return [
      {
        id: 'first-run-profile',
        label: 'First-run profile',
        status: workspaceIdentity.configured ? 'ready' : 'needs-action',
        source: 'FirstRunWorkspaceBootstrapProfileService',
        command: 'zavorth setup --dry-run',
        detail: workspaceIdentity.configured
          ? `Profile configurado em ${workspaceIdentity.profilePath}.`
          : 'Profile canonico ainda nao foi configurado.',
        critical: true,
      },
      {
        id: 'bootstrap-preview',
        label: 'Bootstrap preview',
        status: bootstrapPlan?.status === 'blocked' ? 'blocked' : bootstrapPlan ? 'ready' : 'unknown',
        source: 'FirstRunWorkspaceBootstrapProfileService',
        command: 'zavorth setup --json --dry-run',
        detail: bootstrapPlan
          ? `${bootstrapPlan.status}; ${bootstrapPlan.summary.join(' | ')}`
          : 'Plano de bootstrap indisponivel.',
        critical: true,
      },
      {
        id: 'personalization',
        label: 'Identity/Soul/User personalization',
        status: personalization.pending ? 'needs-action' : 'ready',
        source: 'FirstRunPersonalizationService',
        command: 'zavorth onboard',
        detail: personalization.pending
          ? personalization.reasons.join(' | ') || 'Personalizacao pendente.'
          : 'Personalizacao minima esta completa.',
        critical: true,
      },
      {
        id: 'public-first-run',
        label: 'Public first-run route',
        status: onboarding?.status === 'blocked' ? 'blocked' : onboarding ? 'ready' : 'unknown',
        source: 'FirstRunOnboardingContractService',
        command: 'npm run first-run -- --json',
        detail: onboarding
          ? `${onboarding.status}; rota ${onboarding.route}; checks ${onboarding.summary.passed}/${onboarding.checks.length}`
          : 'Contrato publico /start nao foi anexado a este snapshot.',
        critical: false,
      },
      {
        id: 'productization-evidence',
        label: 'Productization Evidence',
        status: productizationEvidence?.status === 'blocked'
          ? 'blocked'
          : productizationEvidence
            ? 'ready'
            : 'needs-action',
        source: 'ProductizationEvidenceService',
        command: 'zavorth productization-evidence --json',
        detail: productizationEvidence
          ? `${productizationEvidence.status}; release ${productizationEvidence.releaseReadiness.status}.`
          : 'Channel mesh6 evidence precisa estar linkada antes do handoff final.',
        critical: true,
      },
    ];
  }

  private buildSurfaces(status: ProductEntryRuntimeStatus): ProductEntryRuntimeSurface[] {
    return [
      ['cli', 'CLI', 'zavorth product-entry --json'],
      ['go', 'Go', 'zavorth go --dry-run'],
      ['chat', 'Chat', 'zavorth chat'],
      ['control', 'ZavorthControl', '/zavorthControl?sector=config'],
      ['zavorthControl-onboarding', 'ZavorthControl onboarding', '/zavorthControl?sector=config'],
      ['public-start', 'Public /start', '/start'],
      ['api', 'API', '/api/web/gateway/sessions/send'],
    ].map(([id, label, commandOrPath]) => ({
      id: id as ProductEntryRuntimeSurfaceId,
      label,
      commandOrPath,
      status: status === 'blocked_by_policy' ? 'blocked' : status === 'handoff_to_agent_runtime' ? 'ready' : 'needs-action',
      entryState: status,
    }));
  }

  private buildReceipts(
    bootstrapPlan: ZavorthFirstRunBootstrapPlan | null,
    workspaceIdentity: ZavorthWorkspaceIdentityProfileSnapshot,
    personalization: FirstRunPersonalizationStatus,
    onboarding: FirstRunOnboardingContractSnapshot | null,
    productizationEvidence: ProductizationEvidenceSnapshot | null,
    status: ProductEntryRuntimeStatus,
  ): ProductEntryRuntimeReceipt[] {
    return [
      {
        id: 'first-run:profile',
        kind: 'first-run',
        source: 'FirstRunWorkspaceBootstrapProfileService',
        detail: workspaceIdentity.configured
          ? `Workspace profile configurado em ${workspaceIdentity.profilePath}.`
          : 'Workspace profile ausente; primeiro uso compartilhado deve rodar antes do agente.',
        status: workspaceIdentity.configured ? 'ready' : 'needs-action',
      },
      {
        id: 'first-run:bootstrap-preview',
        kind: 'first-run',
        source: 'FirstRunWorkspaceBootstrapProfileService',
        detail: bootstrapPlan
          ? `Plano ${bootstrapPlan.mode}/${bootstrapPlan.status}; sem escrita no Product Entry snapshot.`
          : 'Plano de bootstrap indisponivel.',
        status: bootstrapPlan?.status === 'blocked' ? 'blocked' : bootstrapPlan ? 'ready' : 'unknown',
      },
      {
        id: 'first-run:personalization',
        kind: 'personalization',
        source: 'FirstRunPersonalizationService',
        detail: personalization.pending
          ? personalization.reasons.join(' | ') || 'Personalizacao pendente.'
          : 'Personalizacao minima completa.',
        status: personalization.pending ? 'needs-action' : 'ready',
      },
      {
        id: 'first-run:onboarding',
        kind: 'onboarding',
        source: 'FirstRunOnboardingContractService',
        detail: onboarding
          ? `/start ${onboarding.status}; fixture ${onboarding.fixturePath}.`
          : 'Contrato /start nao anexado.',
        status: onboarding?.status === 'blocked' ? 'blocked' : onboarding ? 'ready' : 'unknown',
      },
      {
        id: 'productization:evidence',
        kind: 'productization',
        source: 'ProductizationEvidenceService',
        detail: productizationEvidence
          ? `Productization Evidence ${productizationEvidence.status}; stable allowed ${String(productizationEvidence.summary.stableReleaseAllowed)}.`
          : 'Productization Evidence ausente.',
        status: productizationEvidence?.status === 'blocked' ? 'blocked' : productizationEvidence ? 'ready' : 'needs-action',
      },
      {
        id: 'handoff:agent-runtime',
        kind: 'handoff',
        source: 'ProductEntryRuntimeService',
        detail: status === 'handoff_to_agent_runtime'
          ? 'Entrada de produto pode entregar UniversalAgentRequest ao ZavorthAgentGateway.'
          : 'Handoff ao AgentGateway aguardando first-run/readiness.',
        status: status === 'handoff_to_agent_runtime' ? 'ready' : 'needs-action',
      },
      {
        id: 'policy:no-side-effects',
        kind: 'policy',
        source: 'ProductEntryRuntimeService',
        detail: 'Snapshot nao grava profile, nao inicia runtime persistente, nao executa provider/tool e nao envia mensagens.',
        status: 'ready',
      },
    ];
  }

  private resolveStatus(input: {
    firstRunRequired: boolean;
    doctorRequired: boolean;
    installPreviewRequired: boolean;
    canStartAgentRuntime: boolean;
    rollbackAvailable: boolean;
    productizationEvidence: ProductizationEvidenceSnapshot | null;
    gates: ProductEntryRuntimeGate[];
  }): ProductEntryRuntimeStatus {
    if (input.gates.some((gate) => gate.critical && gate.status === 'blocked')) {
      return 'blocked_by_policy';
    }
    if (input.firstRunRequired) {
      return 'needs_first_run';
    }
    if (input.doctorRequired) {
      return 'needs_doctor';
    }
    if (input.installPreviewRequired) {
      return 'needs_install_preview';
    }
    if (booleanFlag(input.productizationEvidence?.summary.stableReleaseAllowed) && input.rollbackAvailable) {
      return 'rollback_available';
    }
    if (input.canStartAgentRuntime) {
      return 'handoff_to_agent_runtime';
    }
    return 'ready';
  }

  private resolveNextSafeAction(
    status: ProductEntryRuntimeStatus,
    workspaceIdentity: ZavorthWorkspaceIdentityProfileSnapshot,
    personalization: FirstRunPersonalizationStatus,
  ): string {
    if (status === 'blocked_by_policy') {
      return 'Rodar doctor/readiness e corrigir bloqueios antes de continuar.';
    }
    if (!workspaceIdentity.configured) {
      return 'Rodar `zavorth setup --dry-run` e confirmar o profile de primeiro uso.';
    }
    if (personalization.pending) {
      return 'Completar identidade, USER/SOUL e bootstrap antes de liberar handoff.';
    }
    if (status === 'needs_doctor') {
      return 'Rodar `zavorth doctor` para explicar blockers de entrada.';
    }
    if (status === 'needs_install_preview') {
      return 'Rodar `zavorth go --dry-run` para preparar install/setup preview.';
    }
    if (status === 'handoff_to_agent_runtime') {
      return 'Entregar o pedido ao ZavorthAgentGateway com o estado de primeiro uso anexado.';
    }
    return 'Manter Product Entry Runtime como fonte unica de estado de primeiro uso.';
  }
}
