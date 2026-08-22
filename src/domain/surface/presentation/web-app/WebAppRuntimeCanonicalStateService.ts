import type {
  GatewayCanonicalSessionBundle,
  GatewayCanonicalSessionContext,
  GatewayCanonicalStatePayload,
} from '../../../../contracts/GatewayContract.js';
import type { ModeEscalationSnapshot } from '../../../../contracts/ModeEscalationContract.js';
import { WebAppGatewayControlService } from './WebAppGatewayControlService.js';
import { WebAppRuntimeOperationsRouteService } from './WebAppRuntimeOperationsRouteService.js';
import type { WebAppRuntimeRouteDeps } from './WebAppRuntimeRouteService.js';
import type {
  UniversalAgentRunStatus,
  ZavorthAgentGatewaySnapshotOptions,
} from '../../../../runtime/agent/index.js';
import {
  buildWebAppRuntimeEmptyMemoryRecall,
  buildWebAppRuntimeProductMode,
  buildWebAppRuntimeRecallQueryFromSnapshot,
  buildWebAppRuntimeUiSurfaceHints,
  readWebAppRuntimeChannelReadiness,
} from './web-app-runtime-route/WebAppRuntimeRouteHelpers.js';

interface AgentRunQuery {
  activeRunId?: string | null;
  activeTraceId?: string | null;
  runStatus?: string | null;
  [key: string]: unknown;
}


const AGENT_RUN_STATUSES = new Set<UniversalAgentRunStatus>([
  'queued',
  'thinking',
  'running',
  'waiting_approval',
  'completed',
  'failed',
  'cancelled',
]);

interface ApprovalPlaneEntry {
  status?: string;
  [key: string]: unknown;
}

interface CapabilityPlan {
  status?: string;
  [key: string]: unknown;
}

interface CapabilityPlane {
  pendingPlans?: CapabilityPlane[];
  commands?: Record<string, unknown>;
  [key: string]: unknown;
}

interface SelfmodPlan {
  status?: string;
  [key: string]: unknown;
}

interface SelfmodPlane {
  recentPlans?: SelfmodPlan[];
  [key: string]: unknown;
}

interface ResourceRecommendedAction {
  label?: string;
  actionId?: string;
  description?: string;
  controlId?: string;
  command?: string;
  safety?: string;
  requiresApproval?: boolean;
  [key: string]: unknown;
}

interface ResourcePlane {
  generatedAt?: string;
  status?: string;
  host?: Record<string, unknown> | null;
  signals?: unknown;
  totals?: unknown;
  groups?: unknown[];
  topConsumers?: unknown[];
  recommendedActions?: ResourceRecommendedAction[];
  warnings?: unknown[];
  recommendations?: unknown[];
  commands?: Record<string, string>;
  [key: string]: unknown;
}

interface CompanionAction {
  available?: boolean;
  label?: string;
  actionId?: string;
  description?: string;
  command?: string;
  safety?: string;
  requiresApproval?: boolean;
  [key: string]: unknown;
}

interface CompanionEntry {
  id?: string;
  label?: string;
  status?: string;
  summary?: string;
  actions?: CompanionAction[];
  [key: string]: unknown;
}

interface CompanionPlane {
  generatedAt?: string;
  status?: string;
  companions?: CompanionEntry[];
  warnings?: unknown[];
  recommendations?: unknown[];
  commands?: Record<string, string>;
  [key: string]: unknown;
}

interface ArtifactPlane {
  commands?: Record<string, string>;
  [key: string]: unknown;
}

interface ActionRecommendation {
  plane?: string;
  label?: string;
  summary?: string;
  actionId?: string | null;
  controlId?: string | null;
  command?: string | null;
  safety?: string;
  requiresApproval?: boolean;
  [key: string]: unknown;
}

type CanonicalSessionBundleOptions = {
  includeSessionsList?: boolean;
  historyMode?: 'none' | 'fast' | 'full';
  includeGateway?: boolean;
};

type CanonicalStatePayloadOptions = CanonicalSessionBundleOptions & {
  sessionPlaneMode?: 'none' | 'summary' | 'full';
  snapshotMode?: 'cached' | 'resolved';
  agentRunQuery?: AgentRunQuery | null;
  includeMemoryRecall?: boolean;
  includeApprovalPlane?: boolean;
  includeCapabilityPlane?: boolean;
  includeArtifactPlane?: boolean;
  includeSelfmodPlane?: boolean;
  includeResourcePlane?: boolean;
  includeCompanionPlane?: boolean;
  includeModeEscalation?: boolean;
};

export class WebAppRuntimeCanonicalStateService {
  private readonly gatewayControl: WebAppGatewayControlService;
  private readonly runtimeOperationsRoutes = new WebAppRuntimeOperationsRouteService();

  constructor(gatewayControl?: WebAppGatewayControlService) {
    this.gatewayControl = gatewayControl || new WebAppGatewayControlService();
  }

  public buildSessionContext(
    sessionId: string,
    deps: WebAppRuntimeRouteDeps,
  ): GatewayCanonicalSessionContext {
    return {
      sessionId,
      chatId: deps.realtime.getChatId(sessionId),
      userId: deps.runtime.webUserId,
      sourceUserId: sessionId,
      platform: 'web',
    };
  }

  public async buildCanonicalSessionBundle(
    sessionId: string,
    deps: WebAppRuntimeRouteDeps,
    options: CanonicalSessionBundleOptions = {},
  ): Promise<GatewayCanonicalSessionBundle> {
    const sessionContext = this.buildSessionContext(sessionId, deps);
    const gateway = options.includeGateway !== false && deps.runtimeGateway
      ? deps.runtimeGateway.buildSnapshot(sessionContext)
      : null;
    const includeSessionsList = options.includeSessionsList === true;
    const gatewaySessionTools = deps.runtimeGatewaySessionTools
      ? {
          tools: deps.runtimeGatewaySessionTools.buildDescriptors(),
          sessions: includeSessionsList
            ? await deps.runtimeGatewaySessionTools.listSessions({
                userId: sessionContext.userId,
                limit: 8,
              })
            : null,
          sessionsSummary:
            typeof deps.runtimeGatewaySessionTools.listSessionsSummary === 'function'
              ? deps.runtimeGatewaySessionTools.listSessionsSummary({
                  userId: sessionContext.userId,
                  limit: 8,
                })
              : null,
          history:
            options.historyMode === 'none'
              ? null
              : options.historyMode === 'fast'
                ? deps.runtimeGatewaySessionTools.readHistoryFast({
                    userId: sessionContext.userId,
                    sessionId: sessionContext.sessionId,
                    chatId: sessionContext.chatId,
                  })
                : await deps.runtimeGatewaySessionTools.readHistory({
                    userId: sessionContext.userId,
                    sessionId: sessionContext.sessionId,
                    chatId: sessionContext.chatId,
                  }),
        }
      : null;

    return {
      gateway,
      session: gatewaySessionTools?.history || null,
      sessions: gatewaySessionTools?.sessions || null,
      sessionsSummary: gatewaySessionTools?.sessionsSummary || null,
      gatewaySessionTools,
    };
  }

  public async buildCanonicalStatePayload(
    sessionId: string,
    deps: WebAppRuntimeRouteDeps,
    options: CanonicalStatePayloadOptions = {},
  ): Promise<GatewayCanonicalStatePayload> {
    const bundle = await this.buildCanonicalSessionBundle(sessionId, deps, options);
    const [approvalPlane, capabilityPlane, artifactPlane, selfmodPlane, resourcePlane, companionPlane, modeEscalation] = await Promise.all([
      options.includeApprovalPlane === false ? Promise.resolve(null) : this.buildApprovalPlane(sessionId, deps),
      options.includeCapabilityPlane === false ? Promise.resolve(null) : this.buildCapabilityPlane(sessionId, deps),
      options.includeArtifactPlane === false ? Promise.resolve(null) : this.buildArtifactPlane(sessionId, deps),
      options.includeSelfmodPlane === false ? Promise.resolve(null) : this.buildSelfmodPlane(sessionId, deps),
      options.includeResourcePlane === false ? Promise.resolve(null) : this.buildResourcePlane(deps),
      options.includeCompanionPlane === false ? Promise.resolve(null) : this.buildCompanionPlane(deps),
      options.includeModeEscalation === false ? Promise.resolve(null) : this.buildModeEscalationPlane(sessionId, deps),
    ]);
    const runtimeWarnings = this.buildRuntimeWarnings({
      approvalPlane,
      capabilityPlane,
      resourcePlane,
      companionPlane,
      selfmodPlane,
      modeEscalation,
    });
    const actionRecommendations = this.buildActionRecommendations({
      approvalPlane,
      capabilityPlane,
      resourcePlane,
      companionPlane,
      selfmodPlane,
      modeEscalation,
    });
    const productMode = buildWebAppRuntimeProductMode(deps);
    const uiSurfaceHints = buildWebAppRuntimeUiSurfaceHints(productMode, {
      localControlEntry: '/zavorthControl',
      localControlReady: true,
      telegramReady: readWebAppRuntimeChannelReadiness(companionPlane, resourcePlane, 'telegram'),
      discordReady: readWebAppRuntimeChannelReadiness(companionPlane, resourcePlane, 'discord'),
      cliReady: true,
    });
    const snapshot =
      options.snapshotMode === 'cached'
        ? deps.realtime.getSnapshot(sessionId)
        : await deps.realtime.getResolvedSnapshot(sessionId);
    const memoryRecall =
      options.includeMemoryRecall === false
        ? buildWebAppRuntimeEmptyMemoryRecall(sessionId, '', ['Memory recall omitted in this flow to prioritize latency.'])
        : await this.gatewayControl.previewGatewayMemoryRecall({
            sessionId,
            query: buildWebAppRuntimeRecallQueryFromSnapshot(snapshot),
            limit: 5,
          }, deps);
    const agentRuntimeSnapshotOptions = this.buildAgentRuntimeSnapshotOptions(
      sessionId,
      options.agentRunQuery,
    );
    return {
      ...bundle,
      snapshot,
      agentRuntime: deps.agentGateway?.buildSnapshot(agentRuntimeSnapshotOptions) || null,
      productMode,
      modeEscalation,
      uiSurfaceHints,
      memoryPlane: (bundle.gateway?.memoryPlane || await deps.buildMemoryPlaneSnapshot(sessionId)) as GatewayCanonicalStatePayload['memoryPlane'],
      memoryRecall,
      controlPlane: bundle.gateway?.controlPlane || null,
      sessionPlane:
        options.sessionPlaneMode === 'none'
          ? null
          : options.sessionPlaneMode === 'summary'
            ? await deps.buildSessionPlaneStatusSummary(sessionId) as GatewayCanonicalStatePayload['sessionPlane']
            : await deps.buildSessionPlaneSnapshot(sessionId) as GatewayCanonicalStatePayload['sessionPlane'],
      approvalPlane,
      capabilityPlane,
      artifactPlane,
      selfmodPlane,
      resourcePlane,
      companionPlane,
      runtimeWarnings,
      actionRecommendations,
    };
  }

  private buildAgentRuntimeSnapshotOptions(
    sessionId: string,
    agentRunQuery: AgentRunQuery | null | undefined,
  ): ZavorthAgentGatewaySnapshotOptions {
    const query = agentRunQuery || {};
    const hasDirectRunQuery = Boolean(
      query.activeRunId
        || query.activeTraceId
        || query.runStatus,
    );

    return {
      activeRunId: stringOrNull(query.activeRunId),
      activeTraceId: stringOrNull(query.activeTraceId),
      runStatus: normalizeAgentRunStatus(query.runStatus),
      runLimit: numberOrNull(query.runLimit),
      activeSessionId: hasDirectRunQuery ? null : sessionId,
    };
  }

  private async buildApprovalPlane(
    sessionId: string,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<ApprovalPlaneEntry> {
    return this.gatewayControl.listGatewayApprovals(sessionId, deps, 20);
  }

  private async buildCapabilityPlane(
    sessionId: string,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<CapabilityPlane> {
    const payload = await this.gatewayControl.listGatewayCapabilities(deps);
    return {
      ...payload,
      sessionId,
      commands: {
        ...(payload.commands || {}),
        enable: 'capability.enable',
        disable: 'capability.disable',
      },
    };
  }

  private async buildArtifactPlane(
    sessionId: string,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<ArtifactPlane> {
    const payload = await this.gatewayControl.listGatewayArtifacts(sessionId, deps);
    return {
      ...payload,
      commands: {
        list: 'artifact.list',
        diff: 'artifact.diff',
      },
    };
  }

  private async buildSelfmodPlane(
    sessionId: string,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<SelfmodPlane> {
    return this.gatewayControl.buildSelfmodPlane(sessionId, deps);
  }

  private async buildResourcePlane(
    deps: WebAppRuntimeRouteDeps,
  ): Promise<ResourcePlane | null> {
    const snapshot = await this.runtimeOperationsRoutes.readDesktopResources(deps, { preferCachedWithinMs: 15_000 });
    if (!snapshot) {
      return null;
    }
    return {
      generatedAt: stringOrUndefined(snapshot.generatedAt),
      status: String(asRecord(snapshot.host)?.pressure || 'unknown'),
      host: asRecord(snapshot.host),
      signals: snapshot.signals || null,
      totals: snapshot.totals || null,
      groups: Array.isArray(snapshot.groups) ? snapshot.groups : [],
      topConsumers: Array.isArray(snapshot.topConsumers) ? snapshot.topConsumers : [],
      recommendedActions: Array.isArray(snapshot.recommendedActions) ? snapshot.recommendedActions : [],
      warnings: Array.isArray(snapshot.warnings) ? snapshot.warnings : [],
      recommendations: Array.isArray(snapshot.recommendations) ? snapshot.recommendations : [],
      commands: {
        inspect: '/api/web/runtime/resources',
        doctor: 'ops:doctor:desktop',
      },
    };
  }

  private async buildCompanionPlane(
    deps: WebAppRuntimeRouteDeps,
  ): Promise<CompanionPlane | null> {
    if (!deps.companions) {
      return null;
    }
    const snapshot = await deps.companions.buildSnapshot({ preferCachedWithinMs: 15_000 });
    return {
      generatedAt: snapshot.generatedAt,
      status: Array.isArray(snapshot.companions) && snapshot.companions.some((entry) => entry.status === 'running') ? 'active'
        : 'idle',
      companions: Array.isArray(snapshot.companions)
        ? snapshot.companions.map(asCompanionEntry).filter((entry): entry is CompanionEntry => Boolean(entry))
        : [],
      warnings: Array.isArray(snapshot.warnings) ? snapshot.warnings : [],
      recommendations: Array.isArray(snapshot.recommendations) ? snapshot.recommendations : [],
      commands: {
        list: '/api/web/runtime/companions',
        inspect: '/api/web/runtime/companions/:id',
        action: '/api/web/runtime/companions/:id/actions',
      },
    };
  }

  private async buildModeEscalationPlane(
    sessionId: string,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<ModeEscalationSnapshot | null> {
    if (!deps.modeEscalation) {
      return null;
    }
    return deps.modeEscalation.buildSnapshot(sessionId);
  }

  private buildRuntimeWarnings(input: {
    approvalPlane: ApprovalPlaneEntry | null;
    capabilityPlane: CapabilityPlane | null;
    resourcePlane: ResourcePlane | null;
    companionPlane: CompanionPlane | null;
    selfmodPlane: SelfmodPlane | null;
    modeEscalation: ModeEscalationSnapshot | null;
  }): string[] {
    const warnings = new Set<string>();
    const pendingApprovals = Array.isArray(input.approvalPlane?.pending) ? input.approvalPlane.pending.length : 0;
    const pendingCapabilityPlans = Array.isArray(input.capabilityPlane?.pendingPlans)
      ? input.capabilityPlane.pendingPlans.filter((plan: CapabilityPlan) => String(plan?.status || '').trim() === 'waiting_approval').length
      : 0;
    const pendingSelfmods = Array.isArray(input.selfmodPlane?.recentPlans)
      ? input.selfmodPlane.recentPlans.filter((plan: SelfmodPlan) => ['draft', 'waiting_approval', 'approved'].includes(String(plan?.status || '').trim())).length
      : 0;

    for (const warning of Array.isArray(input.resourcePlane?.warnings) ? input.resourcePlane.warnings : []) {
      warnings.add(String(warning || '').trim());
    }
    for (const warning of Array.isArray(input.companionPlane?.warnings) ? input.companionPlane.warnings : []) {
      warnings.add(String(warning || '').trim());
    }
    if (pendingApprovals > 0) {
      warnings.add(`${pendingApprovals} approval(s) ainda are pending nesta session.`);
    }
    if (pendingCapabilityPlans > 0) {
      warnings.add(`${pendingCapabilityPlans} capability plan(s) ainda aguardam decision.`);
    }
    if (pendingSelfmods > 0) {
      warnings.add(`${pendingSelfmods} selfmod plan(s) ainda exigunder review do operador.`);
    }
    if (input.modeEscalation?.pendingRequest) {
      warnings.add(
        `Existe um mode escalation pending para subir de ${input.modeEscalation.pendingRequest.effectiveMode.id} para ${input.modeEscalation.pendingRequest.requiredMode.id}.`,
      );
    }

    return Array.from(warnings).filter(Boolean).slice(0, 10);
  }

  private buildActionRecommendations(input: {
    approvalPlane: ApprovalPlaneEntry | null;
    capabilityPlane: CapabilityPlane | null;
    resourcePlane: ResourcePlane | null;
    companionPlane: CompanionPlane | null;
    selfmodPlane: SelfmodPlane | null;
    modeEscalation: ModeEscalationSnapshot | null;
  }): ActionRecommendation[] {
    const recommendations: ActionRecommendation[] = [];
    const pushUnique = (entry: ActionRecommendation | null) => {
      if (!entry) {
        return;
      }
      const key = JSON.stringify([
        entry.plane || '',
        entry.controlId || '',
        entry.actionId || '',
        entry.command || '',
        entry.label || '',
      ]);
      if (!recommendations.some((existing) => JSON.stringify([
        existing.plane || '',
        existing.controlId || '',
        existing.actionId || '',
        existing.command || '',
        existing.label || '',
      ]) === key)) {
        recommendations.push(entry);
      }
    };

    for (const action of Array.isArray(input.resourcePlane?.recommendedActions) ? input.resourcePlane.recommendedActions : []) {
      pushUnique({
        plane: 'resources',
        label: action.label || action.actionId || 'Action sugerida',
        summary: action.description || 'Adjustment suggested by Desktop Resource Plane.',
        actionId: action.actionId || null,
        controlId: action.controlId || null,
        command: action.command || null,
        safety: action.safety || 'cautious',
        requiresApproval: action.requiresApproval === true,
      });
    }

    for (const companion of Array.isArray(input.companionPlane?.companions) ? input.companionPlane.companions : []) {
      for (const action of Array.isArray(companion?.actions) ? companion.actions : []) {
        if (!action?.available) {
          continue;
        }
        pushUnique({
          plane: 'companions',
          label: action.label || action.actionId || `Action para ${companion?.label || companion?.id || 'companion'}`,
          summary: action.description || companion?.summary || 'Action supervised de companion.',
          actionId: action.actionId || null,
          controlId: companion?.id || null,
          command: action.command || null,
          safety: action.safety || 'cautious',
          requiresApproval: action.requiresApproval === true,
        });
      }
    }

    if (input.modeEscalation?.pendingRequest) {
      pushUnique({
        plane: 'mode-escalation',
        label: `Elevar para ${input.modeEscalation.pendingRequest.requiredMode.label}`,
        summary: input.modeEscalation.pendingRequest.summary,
        actionId: 'mode-escalation.resolve',
        controlId: input.modeEscalation.pendingRequest.id,
        command: `${input.modeEscalation.commands.approve.replace('<requestId>', input.modeEscalation.pendingRequest.id)}`,
        safety: 'cautious',
        requiresApproval: true,
      });
    }

    if (Array.isArray(input.approvalPlane?.pending) && input.approvalPlane.pending.length > 0) {
      pushUnique({
        plane: 'approvals',
        label: 'Resolver pending approvals',
        summary: `${input.approvalPlane.pending.length} approval(s) are waiting for decision nesta session.`,
        actionId: 'approval.resolve',
        controlId: null,
        command: null,
        safety: 'cautious',
        requiresApproval: false,
      });
    }

    if (Array.isArray(input.capabilityPlane?.pendingPlans) && input.capabilityPlane.pendingPlans.length > 0) {
      pushUnique({
        plane: 'capabilities',
        label: 'review capability plans',
        summary: `${input.capabilityPlane.pendingPlans.length} capability plan(s) still need review or approval.`,
        actionId: 'capability.enable',
        controlId: null,
        command: null,
        safety: 'cautious',
        requiresApproval: false,
      });
    }

    if (Array.isArray(input.selfmodPlane?.recentPlans) && input.selfmodPlane.recentPlans.length > 0) {
      pushUnique({
        plane: 'selfmod',
        label: 'review selfmod recente',
        summary: `${input.selfmodPlane.recentPlans.length} preview(s) ou rollback(s) de selfmod seguem ligados a is session.`,
        actionId: 'selfmod.preview',
        controlId: null,
        command: null,
        safety: 'cautious',
        requiresApproval: false,
      });
    }

    return recommendations.slice(0, 12);
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberOrNull(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function normalizeAgentRunStatus(value: unknown): UniversalAgentRunStatus | undefined {
  const status = stringOrNull(value);
  return status && AGENT_RUN_STATUSES.has(status as UniversalAgentRunStatus)
    ? status as UniversalAgentRunStatus
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asCompanionEntry(value: unknown): CompanionEntry | null {
  const record = asRecord(value);
  return record ? record as CompanionEntry : null;
}
