import {
  getDefaultCapabilityRegistry,
  type CapabilityRegistry,
} from '../capabilities/CapabilityRegistry.js';
import type {
  CapabilityDefinition,
  CapabilityType,
} from '../contracts/CapabilityContract.js';
import type {
  CapabilityCheckedTarget,
  CapabilityEvidence,
  CapabilityExecutorBinding,
  CapabilityIntegrationBinding,
  CapabilityLifecycleBinding,
  CapabilityOperationalDescriptor,
  CapabilityOperationalHook,
  CapabilityPermissionScope,
  CapabilityReadinessSeverity,
  CapabilityReadinessSnapshot,
  CapabilityReadinessStatus,
} from '../contracts/CapabilityAutopilotContract.js';
import type {
  InstalledIntegrationState,
  IntegrationManifest,
  IntegrationProbeSnapshot,
  IntegrationRequirement,
  IntegrationRequirementType,
} from '../contracts/IntegrationHubContract.js';
import {
  CapabilityLifecycleService,
  type CapabilityManifest,
  type CapabilityStateSnapshot,
} from './CapabilityLifecycleService.js';
import { IntegrationInstallerService } from './IntegrationInstallerService.js';


import { IntegrationProbeService } from './IntegrationProbeService.js';
import { IntegrationRegistryService } from './IntegrationRegistryService.js';

type CapabilityRegistryLike = Pick<CapabilityRegistry, 'getAll'>;
type CapabilityLifecycleLike = Pick<
  CapabilityLifecycleService,
  'getManifests' | 'getManifest' | 'describeCapability'
>;
type IntegrationRegistryLike = Pick<
  IntegrationRegistryService,
  'listManifests' | 'getManifestById' | 'resolveRequestedIntegration'
>;
type IntegrationInstallerLike = Pick<
  IntegrationInstallerService,
  'getInstalled' | 'getMissingRequirements'
>;
type IntegrationProbeLike = Pick<IntegrationProbeService, 'getLatestProbe'>;

export type CapabilityExecutorAvailabilityResolver = (
  executorName: string,
  descriptor: CapabilityOperationalDescriptor,
) => boolean | null | Promise<boolean | null>;

export type CapabilityAutopilotReadinessRuntime = {
  now?: () => Date;
  capabilityRegistry?: CapabilityRegistryLike;
  lifecycleService?: CapabilityLifecycleLike;
  integrationRegistryService?: IntegrationRegistryLike;
  integrationInstallerService?: IntegrationInstallerLike;
  integrationProbeService?: IntegrationProbeLike;
  executorAvailabilityResolver?: CapabilityExecutorAvailabilityResolver;
  integrationIdByCapabilityId?: Record<string, string>;
};

type DescriptorParts = {
  capability: CapabilityDefinition | null;
  lifecycleManifest: CapabilityManifest | null;
  lifecycleState: CapabilityStateSnapshot | null;
  integrationManifest: IntegrationManifest | null;
};

type ReadinessEvaluationInput = {
  descriptor: CapabilityOperationalDescriptor;
  lifecycleState: CapabilityStateSnapshot | null;
  integrationManifest: IntegrationManifest | null;
  installedIntegration: InstalledIntegrationState | null;
  missingRequirements: IntegrationRequirement[];
  probe: IntegrationProbeSnapshot | null;
  executor: CapabilityExecutorBinding | null;
  checkedTargets: CapabilityCheckedTarget[];
};

type ReadinessEvaluation = {
  status: CapabilityReadinessStatus;
  severity: CapabilityReadinessSeverity;
  ready: boolean;
  safeToRun: boolean;
  summary: string;
  detail: string;
  blockingReason: string | null;
};

const DEFAULT_INTEGRATION_ID_BY_CAPABILITY_ID: Record<string, string> = {
  'executor-gemini-cli': 'gemini',
  'executor-external-executor': 'external-executor',
  'executor-aistudio': 'gemini',
};

export class CapabilityAutopilotReadinessService {
  private readonly now: () => Date;
  private readonly capabilityRegistry: CapabilityRegistryLike;
  private readonly lifecycleService: CapabilityLifecycleLike;
  private readonly integrationRegistryService: IntegrationRegistryLike;
  private readonly integrationInstallerService: IntegrationInstallerLike;
  private readonly integrationProbeService: IntegrationProbeLike;
  private readonly executorAvailabilityResolver: CapabilityExecutorAvailabilityResolver | null;
  private readonly integrationIdByCapabilityId: Record<string, string>;

  constructor(runtime: CapabilityAutopilotReadinessRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.capabilityRegistry = runtime.capabilityRegistry || getDefaultCapabilityRegistry();
    this.lifecycleService = runtime.lifecycleService || new CapabilityLifecycleService();
    this.integrationRegistryService = runtime.integrationRegistryService || new IntegrationRegistryService();
    this.integrationInstallerService = runtime.integrationInstallerService || new IntegrationInstallerService();
    this.integrationProbeService = runtime.integrationProbeService || new IntegrationProbeService();
    this.executorAvailabilityResolver = runtime.executorAvailabilityResolver || null;
    this.integrationIdByCapabilityId = {
      ...DEFAULT_INTEGRATION_ID_BY_CAPABILITY_ID,
      ...(runtime.integrationIdByCapabilityId || {}),
    };
  }

  public listOperationalDescriptors(): CapabilityOperationalDescriptor[] {
    const capabilities = this.capabilityRegistry.getAll();
    const lifecycleManifests = this.lifecycleService.getManifests();
    const integrationManifests = this.integrationRegistryService.listManifests();
    const ids = new Set<string>();

    for (const capability of capabilities) {
      ids.add(capability.id);
    }
    for (const manifest of lifecycleManifests) {
      ids.add(manifest.id);
    }
    for (const manifest of integrationManifests) {
      ids.add(manifest.id);
    }

    return Array.from(ids)
      .sort((left, right) => left.localeCompare(right, 'en-US'))
      .map((capabilityId) => this.getOperationalDescriptor(capabilityId))
      .filter((descriptor): descriptor is CapabilityOperationalDescriptor => Boolean(descriptor));
  }

  public getOperationalDescriptor(capabilityId: string): CapabilityOperationalDescriptor | null {
    const normalizedId = this.normalizeId(capabilityId);
    if (!normalizedId) {
      return null;
    }

    return this.buildDescriptor(this.resolveDescriptorParts(normalizedId));
  }

  public async buildReadinessSnapshot(capabilityId: string): Promise<CapabilityReadinessSnapshot> {
    const descriptor = this.getOperationalDescriptor(capabilityId);
    if (!descriptor) {
      return this.buildUnknownCapabilitySnapshot(capabilityId);
    }

    const parts = this.resolveDescriptorParts(descriptor.capabilityId);
    const integrationManifest = parts.integrationManifest;
    const installedIntegration = integrationManifest
      ? this.integrationInstallerService.getInstalled(integrationManifest.id)
      : null;
    const missingRequirements = integrationManifest
      ? this.integrationInstallerService.getMissingRequirements(integrationManifest, installedIntegration)
      : [];
    const probe = integrationManifest
      ? this.integrationProbeService.getLatestProbe(integrationManifest.id)
      : null;
    const executor = await this.resolveExecutorAvailability(descriptor);
    const checkedTargets = this.buildCheckedTargets({
      descriptor,
      integrationManifest,
      missingRequirements,
      probe,
      executor,
    });
    const evidence = this.buildEvidence({
      descriptor,
      lifecycleState: parts.lifecycleState,
      integrationManifest,
      installedIntegration,
      missingRequirements,
      probe,
      executor,
    });
    const evaluation = this.evaluateReadiness({
      descriptor,
      lifecycleState: parts.lifecycleState,
      integrationManifest,
      installedIntegration,
      missingRequirements,
      probe,
      executor,
      checkedTargets,
    });

    return {
      capabilityId: descriptor.capabilityId,
      generatedAt: this.now().toISOString(),
      status: evaluation.status,
      severity: evaluation.severity,
      ready: evaluation.ready,
      safeToRun: evaluation.safeToRun,
      summary: evaluation.summary,
      detail: evaluation.detail,
      checkedTargets,
      missingRequirements,
      blockingReason: evaluation.blockingReason,
      probe,
      executor,
      evidence,
      suggestedNextAction: this.buildSuggestedNextAction(evaluation, missingRequirements, probe, executor),
      metadata: {
        gate: 'capability-autopilot-readiness',
        readOnly: true,
        installedIntegrationStatus: installedIntegration?.status || null,
      },
    };
  }

  private resolveDescriptorParts(capabilityId: string): DescriptorParts {
    const capability = this.capabilityRegistry
      .getAll()
      .find((entry) => this.normalizeId(entry.id) === capabilityId) || null;
    const lifecycleManifest = this.lifecycleService.getManifest(capabilityId);
    const lifecycleState = this.lifecycleService.describeCapability(capabilityId);
    const integrationManifest =
      this.resolveIntegrationManifest(capability) ||
      this.integrationRegistryService.getManifestById(capabilityId);

    return {
      capability,
      lifecycleManifest,
      lifecycleState,
      integrationManifest,
    };
  }

  private buildDescriptor(parts: DescriptorParts): CapabilityOperationalDescriptor | null {
    const capabilityId =
      parts.capability?.id ||
      parts.lifecycleManifest?.id ||
      parts.integrationManifest?.id ||
      null;

    if (!capabilityId) {
      return null;
    }

    const label =
      parts.capability?.label ||
      parts.lifecycleManifest?.label ||
      parts.integrationManifest?.label ||
      capabilityId;
    const type = this.resolveCapabilityType(parts);
    const executor = this.buildExecutorBinding(parts.capability);
    const lifecycle = this.buildLifecycleBinding(parts.lifecycleManifest, parts.lifecycleState);
    const integration = this.buildIntegrationBinding(parts.integrationManifest);

    return {
      capabilityId,
      label,
      type,
      intent: parts.capability?.intent || parts.integrationManifest?.capabilities?.[0] || 'runtime_capability',
      summary:
        parts.capability?.description ||
        parts.lifecycleManifest?.description ||
        parts.integrationManifest?.summary ||
        'Capability operacional descoberta pelo Autopilot.',
      source: parts.capability?.source || (parts.integrationManifest ? 'integration' : 'runtime'),
      command: parts.capability?.command?.command || null,
      tags: this.buildTags(parts),
      capability: parts.capability
        ? {
            id: parts.capability.id,
            label: parts.capability.label,
            type: parts.capability.type,
            intent: parts.capability.intent,
            description: parts.capability.description,
            dispatch_mode: parts.capability.dispatch_mode,
            executor_preference: parts.capability.executor_preference,
            requires_planning: parts.capability.requires_planning,
          }
        : null,
      lifecycle,
      integration,
      executor,
      policy: parts.capability?.policy || null,
      hooks: this.buildHooks(parts, executor),
      fallbackMode: 'ask_before_switch',
      metadata: {
        readOnly: true,
        gate: 'capability-autopilot-readiness',
      },
    };
  }

  private buildLifecycleBinding(
    manifest: CapabilityManifest | null,
    state: CapabilityStateSnapshot | null,
  ): CapabilityLifecycleBinding | null {
    if (!manifest || !state) {
      return null;
    }

    return {
      manifestId: manifest.id,
      label: manifest.label,
      state: state.state,
      activationMode: manifest.activationMode,
      approvalRequired: manifest.approvalRequired,
      approvalScope: this.mapApprovalScope(state.approvalScope),
      fallbackBehavior: manifest.fallbackBehavior,
      provisioningRecipe: manifest.provisioningRecipe
        ? {
            dependencies: manifest.provisioningRecipe.dependencies,
            commands: manifest.provisioningRecipe.commands,
            notes: manifest.provisioningRecipe.notes,
          }
        : null,
    };
  }

  private buildIntegrationBinding(manifest: IntegrationManifest | null): CapabilityIntegrationBinding | null {
    if (!manifest) {
      return null;
    }

    return {
      integrationId: manifest.id,
      label: manifest.label,
      binding: manifest.binding,
      manifest: {
        id: manifest.id,
        label: manifest.label,
        supportLevel: manifest.supportLevel,
        category: manifest.category,
        defaultMode: manifest.defaultMode,
        capabilities: manifest.capabilities,
        requirements: manifest.requirements,
        installSteps: manifest.installSteps,
        safetyNotes: manifest.safetyNotes,
      },
    };
  }

  private buildExecutorBinding(capability: CapabilityDefinition | null): CapabilityExecutorBinding | null {
    const executorName =
      capability?.command?.explicit_executor ||
      capability?.executor_preference ||
      capability?.policy?.executor ||
      null;
    if (!executorName || executorName.startsWith('workflow:')) {
      return null;
    }

    return {
      executorName,
      requestedExecutorName: executorName,
      available: null,
      source: capability?.policy?.executor ? 'capability_policy' : 'registry',
      notes: ['Disponibilidade real sera preenchida por resolver opcional ou pelo ExecutionGateway.'],
    };
  }

  private buildHooks(
    parts: DescriptorParts,
    executor: CapabilityExecutorBinding | null,
  ): CapabilityOperationalHook[] {
    const hooks: CapabilityOperationalHook[] = [];

    hooks.push({
      id: `${parts.capability?.id || parts.lifecycleManifest?.id || parts.integrationManifest?.id}:detect`,
      kind: 'detect',
      owner: 'capability_registry',
      summary: 'Detectar intencao/comando usando o CapabilityRegistry atual.',
      optional: false,
    });

    if (parts.lifecycleManifest) {
      hooks.push({
        id: `${parts.lifecycleManifest.id}:lifecycle`,
        kind: 'detect',
        owner: 'capability_lifecycle',
        summary: 'Ler estado, approval scope, provisioning recipe e fallback behavior.',
        optional: false,
      });
    }

    if (parts.integrationManifest) {
      hooks.push({
        id: `${parts.integrationManifest.id}:probe`,
        kind: 'validate',
        owner: 'integration_probe',
        summary: 'Reusar ultimo probe conhecido da integracao sem disparar side effects.',
        optional: false,
      });
    }

    if (executor) {
      hooks.push({
        id: `${executor.executorName}:executor-readiness`,
        kind: 'validate',
        owner: 'execution_gateway',
        summary: 'Ler disponibilidade de executor via resolver injetado ou deixar como unknown.',
        optional: true,
      });
    }

    return hooks;
  }

  private buildTags(parts: DescriptorParts): string[] {
    return Array.from(new Set([
      ...(parts.capability?.tags || []),
      ...(parts.integrationManifest?.tags || []),
      parts.lifecycleManifest?.activationMode || null,
      parts.integrationManifest?.category || null,
    ].filter((entry): entry is string => Boolean(entry))));
  }

  private async resolveExecutorAvailability(
    descriptor: CapabilityOperationalDescriptor,
  ): Promise<CapabilityExecutorBinding | null> {
    if (!descriptor.executor) {
      return null;
    }

    if (!this.executorAvailabilityResolver) {
      return descriptor.executor;
    }

    const available = await this.executorAvailabilityResolver(
      descriptor.executor.executorName,
      descriptor,
    );

    return {
      ...descriptor.executor,
      available,
      notes: [
        ...(descriptor.executor.notes || []),
        available === null
          ? 'Resolver nao conseguiu determinar disponibilidade.'
          : `Resolver retornou disponibilidade: ${available ? 'ready' : 'unavailable'}.`,
      ],
    };
  }

  private buildCheckedTargets(input: {
    descriptor: CapabilityOperationalDescriptor;
    integrationManifest: IntegrationManifest | null;
    missingRequirements: IntegrationRequirement[];
    probe: IntegrationProbeSnapshot | null;
    executor: CapabilityExecutorBinding | null;
  }): CapabilityCheckedTarget[] {
    const missingIds = new Set(input.missingRequirements.map((entry) => entry.id));
    const targets: CapabilityCheckedTarget[] = [];

    for (const requirement of input.integrationManifest?.requirements || []) {
      targets.push({
        kind: this.mapRequirementKind(requirement.type),
        label: requirement.label,
        value: requirement.envKey || requirement.id,
        required: requirement.required,
        status: missingIds.has(requirement.id) ? 'missing' : 'ready',
        detail: requirement.description,
      });
    }

    if (input.probe?.checkedTarget) {
      targets.push({
        kind: this.mapProbeTransportKind(input.probe.transport),
        label: `${input.probe.label} probe`,
        value: input.probe.checkedTarget,
        required: true,
        status: this.mapProbeStatus(input.probe.status),
        detail: input.probe.summary,
      });
    }

    if (input.executor) {
      targets.push({
        kind: 'executor',
        label: `${input.executor.executorName} executor`,
        value: input.executor.executorName,
        required: input.descriptor.type === 'executor',
        status: input.executor.available === null
          ? 'unknown'
          : (input.executor.available ? 'ready' : 'missing'),
        detail: input.executor.notes?.join(' ') || null,
      });
    }

    return targets;
  }

  private buildEvidence(input: {
    descriptor: CapabilityOperationalDescriptor;
    lifecycleState: CapabilityStateSnapshot | null;
    integrationManifest: IntegrationManifest | null;
    installedIntegration: InstalledIntegrationState | null;
    missingRequirements: IntegrationRequirement[];
    probe: IntegrationProbeSnapshot | null;
    executor: CapabilityExecutorBinding | null;
  }): CapabilityEvidence[] {
    const evidence: CapabilityEvidence[] = [
      {
        kind: 'capability_registry',
        source: 'CapabilityRegistry',
        summary: `Capability ${input.descriptor.capabilityId} declarada para ${input.descriptor.intent}.`,
        status: input.descriptor.source,
        timestamp: this.now().toISOString(),
      },
    ];

    if (input.lifecycleState) {
      evidence.push({
        kind: 'lifecycle_manifest',
        source: 'CapabilityLifecycleService',
        summary: `Lifecycle em estado ${input.lifecycleState.state}.`,
        status: input.lifecycleState.state,
        timestamp: input.lifecycleState.lastUpdatedAt || this.now().toISOString(),
      });
    }

    if (input.integrationManifest) {
      evidence.push({
        kind: 'integration_registry',
        source: 'IntegrationRegistryService',
        summary: `Integracao ${input.integrationManifest.id} vinculada em modo ${input.integrationManifest.defaultMode}.`,
        status: input.installedIntegration?.status || 'not_installed',
        timestamp: input.installedIntegration?.updatedAt || this.now().toISOString(),
        metadata: {
          missingRequirementIds: input.missingRequirements.map((entry) => entry.id),
        },
      });
    }

    if (input.probe) {
      evidence.push({
        kind: 'integration_probe',
        source: 'IntegrationProbeService.getLatestProbe',
        summary: input.probe.summary,
        detail: input.probe.detail,
        checkedTarget: input.probe.checkedTarget,
        status: input.probe.status,
        timestamp: input.probe.generatedAt,
      });
    }

    if (input.executor) {
      evidence.push({
        kind: 'executor',
        source: 'CapabilityAutopilotReadinessService.executorAvailabilityResolver',
        summary: `Executor ${input.executor.executorName}: ${input.executor.available === null ? 'unknown' : (input.executor.available ? 'ready' : 'unavailable')}.`,
        status: input.executor.available === null ? 'unknown' : (input.executor.available ? 'ready' : 'missing'),
        timestamp: this.now().toISOString(),
      });
    }

    return evidence;
  }

  private evaluateReadiness(input: ReadinessEvaluationInput): ReadinessEvaluation {
    const lifecycleState = input.lifecycleState?.state || null;
    const hasMissingRequirements = input.missingRequirements.length > 0;
    const hasExecutorUnavailable = input.executor?.available === false;
    const hasUnknownExecutor = input.executor?.available === null && input.descriptor.type === 'executor';
    const probeStatus = input.probe?.status || null;

    if (hasMissingRequirements || probeStatus === 'not_configured' || hasExecutorUnavailable) {
      const missingLabels = input.missingRequirements.map((entry) => entry.label).join(', ');
      return {
        status: 'missing',
        severity: 'error',
        ready: false,
        safeToRun: false,
        summary: `${input.descriptor.label} ainda nao esta pronto.`,
        detail: missingLabels
          ? `Faltam requisitos obrigatorios: ${missingLabels}.`
          : (hasExecutorUnavailable
              ? `Executor ${input.executor?.executorName} indisponivel neste host.`
              : String(input.probe?.detail || 'A integracao ainda nao esta configurada.')),
        blockingReason: missingLabels || input.probe?.summary || input.executor?.executorName || 'missing_requirement',
      };
    }

    if (lifecycleState && !['ready', 'active'].includes(lifecycleState)) {
      return {
        status: input.lifecycleState?.approvalRequired ? 'blocked' : 'degraded',
        severity: input.lifecycleState?.approvalRequired ? 'warning' : 'error',
        ready: false,
        safeToRun: false,
        summary: `${input.descriptor.label} precisa de preparacao antes de rodar.`,
        detail: `Lifecycle atual: ${lifecycleState}. ${input.lifecycleState?.notes || ''}`.trim(),
        blockingReason: `lifecycle:${lifecycleState}`,
      };
    }

    if (probeStatus === 'failed') {
      return {
        status: 'degraded',
        severity: 'error',
        ready: false,
        safeToRun: false,
        summary: `${input.descriptor.label} respondeu com falha no ultimo probe.`,
        detail: input.probe?.detail || 'Probe falhou sem detalhe adicional.',
        blockingReason: 'probe_failed',
      };
    }

    if (probeStatus === 'unsupported' || hasUnknownExecutor) {
      return {
        status: 'unknown',
        severity: 'warning',
        ready: false,
        safeToRun: false,
        summary: `${input.descriptor.label} precisa de uma checagem concreta antes de executar.`,
        detail: hasUnknownExecutor
          ? `A disponibilidade do executor ${input.executor?.executorName} ainda nao foi medida.`
          : 'O probe atual ainda nao possui implementacao real.',
        blockingReason: hasUnknownExecutor ? 'executor_unknown' : 'probe_unsupported',
      };
    }

    if (input.integrationManifest && !input.probe) {
      return {
        status: 'unknown',
        severity: 'warning',
        ready: false,
        safeToRun: false,
        summary: `${input.descriptor.label} foi encontrado, mas ainda nao tem probe recente.`,
        detail: 'Este gate e read-only: ele nao dispara probes automaticamente.',
        blockingReason: 'probe_not_run',
      };
    }

    return {
      status: 'ready',
      severity: 'info',
      ready: true,
      safeToRun: true,
      summary: `${input.descriptor.label} esta pronto para uso.`,
      detail: 'Nenhum bloqueio foi encontrado pelos adapters read-only atuais.',
      blockingReason: null,
    };
  }

  private buildSuggestedNextAction(
    evaluation: ReadinessEvaluation,
    missingRequirements: IntegrationRequirement[],
    probe: IntegrationProbeSnapshot | null,
    executor: CapabilityExecutorBinding | null,
  ): CapabilityReadinessSnapshot['suggestedNextAction'] {
    if (evaluation.ready) {
      return {
        label: 'Continuar execucao',
        reason: 'Capability pronta nos checks atuais.',
        repairable: false,
      };
    }

    if (missingRequirements.length > 0) {
      return {
        label: 'Planejar reparo de requisitos',
        reason: `Faltam ${missingRequirements.length} requisito(s) obrigatorio(s).`,
        repairable: true,
      };
    }

    if (executor?.available === false) {
      return {
        label: 'Planejar reparo do executor',
        reason: `Executor ${executor.executorName} indisponivel.`,
        repairable: true,
      };
    }

    if (probe?.status === 'failed' || probe?.status === 'not_configured') {
      return {
        label: 'Planejar reparo da integracao',
        reason: probe.summary,
        repairable: true,
      };
    }

    return {
      label: 'Executar probe/doctor antes de reparar',
      reason: evaluation.blockingReason || 'Readiness desconhecido.',
      repairable: false,
    };
  }

  private buildUnknownCapabilitySnapshot(capabilityId: string): CapabilityReadinessSnapshot {
    const generatedAt = this.now().toISOString();
    return {
      capabilityId: String(capabilityId || '').trim() || 'unknown',
      generatedAt,
      status: 'unknown',
      severity: 'warning',
      ready: false,
      safeToRun: false,
      summary: 'Capability desconhecida.',
      detail: 'Nao encontrei esta capability no registry, lifecycle ou integration registry.',
      checkedTargets: [],
      missingRequirements: [],
      blockingReason: 'capability_not_found',
      probe: null,
      executor: null,
      evidence: [{
        kind: 'capability_registry',
        source: 'CapabilityAutopilotReadinessService',
        summary: 'Busca de capability nao retornou descriptor operacional.',
        status: 'unknown',
        timestamp: generatedAt,
      }],
      suggestedNextAction: {
        label: 'Revisar ID ou comando da capability',
        reason: 'A capability nao foi encontrada.',
        repairable: false,
      },
      metadata: {
        gate: 'capability-autopilot-readiness',
        readOnly: true,
      },
    };
  }

  private resolveIntegrationManifest(capability: CapabilityDefinition | null): IntegrationManifest | null {
    if (!capability) {
      return null;
    }

    const explicitIntegrationId = this.integrationIdByCapabilityId[capability.id];
    if (explicitIntegrationId) {
      return this.integrationRegistryService.getManifestById(explicitIntegrationId);
    }

    const candidates = this.buildIntegrationCandidates(capability);
    for (const candidate of candidates) {
      const resolution = this.integrationRegistryService.resolveRequestedIntegration(candidate);
      if (resolution.manifest) {
        return resolution.manifest;
      }
    }

    return null;
  }

  private buildIntegrationCandidates(capability: CapabilityDefinition): string[] {
    const command = capability.command?.command?.replace(/^\//, '') || null;
    const aliases = (capability.command?.aliases || []).map((entry) => entry.replace(/^\//, ''));
    const executorPreference = capability.executor_preference || null;
    const strippedCapabilityId = capability.id.replace(/^executor-/, '').replace(/^command-/, '');
    const candidates = [
      capability.id,
      strippedCapabilityId,
      command,
      executorPreference,
      executorPreference?.replace(/_/g, '-'),
      executorPreference?.replace(/_cli$/g, ''),
      capability.label,
      ...aliases,
    ];

    return Array.from(new Set(
      candidates
        .map((entry) => String(entry || '').trim())
        .filter(Boolean),
    ));
  }

  private resolveCapabilityType(parts: DescriptorParts): CapabilityType {
    if (parts.capability) {
      return parts.capability.type;
    }
    if (parts.integrationManifest) {
      return 'integration';
    }
    return 'automation';
  }

  private mapApprovalScope(value: string | null): CapabilityPermissionScope | null {
    if (!value) {
      return null;
    }
    if (value === 'host') {
      return 'host';
    }
    if (value === 'session') {
      return 'session';
    }
    return 'once';
  }

  private mapRequirementKind(type: IntegrationRequirementType): CapabilityCheckedTarget['kind'] {
    switch (type) {
      case 'binary':
        return 'binary';
      case 'docker':
        return 'docker';
      case 'env':
      case 'account':
        return 'env';
      case 'browser':
        return 'service';
      case 'manual':
      default:
        return 'manual';
    }
  }

  private mapProbeStatus(status: IntegrationProbeSnapshot['status']): CapabilityReadinessStatus {
    switch (status) {
      case 'ok':
        return 'ready';
      case 'failed':
        return 'degraded';
      case 'not_configured':
        return 'missing';
      case 'unsupported':
      default:
        return 'unknown';
    }
  }

  private mapProbeTransportKind(
    transport: IntegrationProbeSnapshot['transport'],
  ): CapabilityCheckedTarget['kind'] {
    switch (transport) {
      case 'cli':
        return 'binary';
      case 'api':
        return 'api';
      case 'docker':
        return 'docker';
      case 'runtime':
        return 'service';
      case 'unsupported':
      default:
        return 'manual';
    }
  }

  private normalizeId(value: string): string {
    return String(value || '').trim();
  }
}
