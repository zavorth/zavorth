import type {
  ArtifactDTO,
  GatewayDomainListDTO,
  GatewayStatusDTO,
  LearningActionResultDTO,
  LearningCandidatesDTO,
  LearningMetricsDTO,
  LearningStatusDTO,
  MemoryMetricsDTO,
  MemoryProceduresDTO,
  MemorySearchResultsDTO,
  MemoryStatusDTO,
  NodeListDTO,
  SessionListDTO,
  TransportDTO,
} from '../../contracts/public/rest/dto.js';
import type {
  OpsQualityDTO,
  OpsHealthDTO,
  PlatformCatalogDTO,
  PlatformStatusDTO,
} from '../../contracts/public/rest/platform-ops-dto.js';
import type {
  CanonicalApprovalsDTO,
  CanonicalApprovalDecisionResultDTO,
  CanonicalChannelActionResultDTO,
  CanonicalChannelMeshDTO,
  CanonicalChatPreviewDTO,
  CanonicalGovernedActionReceiptDTO,
  CanonicalGovernedActionResultDTO,
  CanonicalGovernedActionStatus,
  CanonicalMissionsDTO,
  CanonicalMissionCancelResultDTO,
  CanonicalProviderMeshDTO,
  CanonicalProviderTestResultDTO,
  CanonicalReceiptsDTO,
  CanonicalRuntimeHealthDTO,
  CanonicalRuntimeStatusDTO,
} from '../../contracts/public/rest/runtime-api-v1-dto.js';
import type { PermissionRequest, PermissionStatus } from '../../contracts/PermissionRequest.js';
import type { SecurityPolicyBrokerRequest } from '../../security/SecurityPolicyBroker.js';
import { decideSecurityPolicy } from '../../security/SecurityPolicyBroker.js';
import { readGatewayDomains, readGatewayStatus, readOpsHealth } from './canonical-public-api/gateway-ops.js';
import { readPlatformCatalog, readPlatformStatus, readNodes, readTransports, readArtifacts } from './canonical-public-api/platform-topology.js';
import { readOpsQuality } from './canonical-public-api/quality.js';
import { CanonicalPublicApiSharedSupport } from './canonical-public-api/shared.js';
import {
  executeLearningAction,
  readLearningCandidates,
  readLearningMetrics,
  readLearningStatus,
  readMemoryMetrics,
  readMemoryProcedures,
  readMemoryStatus,
  readSessions,
  searchMemory,
} from './canonical-public-api/session-learning-memory.js';
import type { ArtifactQuery, CanonicalPublicApiRuntime } from './canonical-public-api/types.js';
import { ProviderControlPlaneService } from '../../services/ProviderControlPlaneService.js';
import { ZavorthChannelMeshService } from '../../services/ZavorthChannelMeshService.js';
import { ZavorthChannelActionService } from '../../services/ZavorthChannelActionService.js';
import { PermissionService } from '../../services/PermissionService.js';
import { ZavorthProviderReadinessMatrixService } from '../../services/ZavorthProviderReadinessMatrixService.js';
import type { ZavorthProviderReadinessMatrixSnapshot } from '../../contracts/ZavorthProviderReadinessMatrixContract.js';
import { ZavorthProductizationProtectedRuntimeService } from '../../services/ZavorthProductizationProtectedRuntimeService.js';
import { ZavorthVisualReceiptUxService } from '../../services/ZavorthVisualReceiptUxService.js';
import { ZavorthApprovalActionCardsUxService } from '../../services/ZavorthApprovalActionCardsUxService.js';
import { ZavorthApprovalReceiptTrustUxService } from '../../services/ZavorthApprovalReceiptTrustUxService.js';
import { ZavorthSubagentSkillLiveCompletionService } from '../../services/ZavorthSubagentSkillLiveCompletionService.js';
import { PublicRuntimeEventService } from '../../services/PublicRuntimeEventService.js';
import type { PublicRuntimeEvent } from '../../contracts/public/events/sse.js';
import { RuntimeMetricsRegistryService } from '../../services/RuntimeMetricsRegistryService.js';
import { MnemosMemoryLifecycleService } from '../../services/MnemosMemoryLifecycleService.js';
import { PersonalizationConfigSchemaService } from '../../services/PersonalizationConfigSchemaService.js';

export class CanonicalPublicApiService {
  private readonly version: string;
  private readonly support: CanonicalPublicApiSharedSupport;
  private readonly fallbackProviderControlPlane = new ProviderControlPlaneService();
  private readonly fallbackChannelMesh = new ZavorthChannelMeshService();
  private readonly fallbackChannelActions = new ZavorthChannelActionService();
  private readonly fallbackPermissionService = new PermissionService();
  private readonly fallbackProviderReadiness = new ZavorthProviderReadinessMatrixService({
    providerControlPlane: this.fallbackProviderControlPlane,
  });
  private readonly productization = new ZavorthProductizationProtectedRuntimeService();
  private readonly visualReceipts = new ZavorthVisualReceiptUxService({
    productization: this.productization,
  });
  private readonly approvalActionCards = new ZavorthApprovalActionCardsUxService();
  private readonly approvalReceiptTrustUx = new ZavorthApprovalReceiptTrustUxService();
  private readonly subagentSkillCompletion = new ZavorthSubagentSkillLiveCompletionService();
  private readonly publicEvents = new PublicRuntimeEventService();
  private readonly runtimeMetrics = new RuntimeMetricsRegistryService();
  private readonly mnemosLifecycle = new MnemosMemoryLifecycleService();
  private readonly personalizationSchema = new PersonalizationConfigSchemaService();

  constructor(private readonly runtime: CanonicalPublicApiRuntime) {
    this.support = new CanonicalPublicApiSharedSupport(runtime);
    this.version = this.support.readPackageVersion();
  }

  public readGatewayStatus(): GatewayStatusDTO {
    return readGatewayStatus({
      runtime: this.runtime,
      support: this.support,
      version: this.version,
    });
  }

  public readRuntimeStatus(): CanonicalRuntimeStatusDTO {
    const gateway = this.readGatewayStatus();
    const health = this.readOpsHealth('fast');
    return {
      schemaVersion: 1,
      surface: 'runtime-api-v1',
      version: this.version,
      generatedAt: new Date().toISOString(),
      status: gateway.status === 'error'
        ? 'error'
        : this.runtime.getRuntime()
          ? gateway.status
          : 'unavailable',
      runtime: {
        attached: Boolean(this.runtime.getRuntime()),
        localFirst: true,
        zavorthControlRoute: '/zavorthControl',
        executionAuthority: false,
      },
      gateway,
      health,
      subagentSkillCompletion: null,
    };
  }

  public async readSubagentSkillCompletion() {
    return this.subagentSkillCompletion.buildSnapshot();
  }

  public readRuntimeHealth(mode: 'fast' | 'live' = 'fast'): CanonicalRuntimeHealthDTO {
    const health = this.readOpsHealth(mode);
    return {
      schemaVersion: 1,
      surface: 'runtime-health-v1',
      generatedAt: new Date().toISOString(),
      mode,
      healthy: health.healthy,
      health,
      safety: {
        policyBrokerRequired: true,
        zavorthControlCanExecute: false,
        publicApiCanBypassPolicy: false,
      },
    };
  }

  public async readPrometheusMetrics(): Promise<string> {
    const approvals = await this.getPermissionService().listRequests('all', 500);
    return this.runtimeMetrics.renderPrometheus({
      runs: {
        success: 0,
        failure: 0,
        denied: approvals.filter((entry) => entry.status === 'rejected').length,
      },
      approvals: approvals.reduce<Record<string, number>>((acc, entry) => {
        acc[entry.status] = (acc[entry.status] || 0) + 1;
        return acc;
      }, {}),
      sessions: {
        active: this.runtime.getRuntime() ? 1 : 0,
        durationSeconds: [],
      },
    });
  }

  public readMemoryLifecycle(input: { apply?: boolean } = {}) {
    return this.mnemosLifecycle.buildSnapshot({ apply: input.apply === true });
  }

  public readPersonalizationValidation(input: { migrate?: boolean } = {}) {
    return input.migrate ? this.personalizationSchema.migrate() : this.personalizationSchema.validate();
  }

  public readProviders(input: {
    includeAdvanced?: boolean;
    selectedTarget?: string | null;
    profileId?: string | null;
  } = {}): CanonicalProviderMeshDTO {
    const generatedAt = new Date().toISOString();
    const service = this.getProviderControlPlane();
    const providers = service.listProviders({ includeAdvanced: input.includeAdvanced === true });
    const allProviders = service.listProviders({ includeAdvanced: true });
    const profiles = service.listProfiles();
    const picker = service.buildModelPickerContract({
      includeAdvanced: input.includeAdvanced === true,
      selectedTarget: input.selectedTarget,
      profileId: input.profileId,
      generatedAt,
    });
    const selected = service.resolveSelectedModelProfile({
      includeAdvanced: input.includeAdvanced === true,
      selectedTarget: input.selectedTarget,
      profileId: input.profileId,
      requireReady: false,
    }).primary || null;
    const readinessMatrix = this.readProviderReadinessMatrix({
      includeAdvanced: input.includeAdvanced === true,
      providerId: input.selectedTarget,
    });

    return {
      schemaVersion: 1,
      surface: 'provider-mesh-v1',
      generatedAt,
      summary: {
        total: providers.length,
        ready: providers.filter((entry) => entry.readiness === 'ready').length,
        needsConfig: providers.filter((entry) => entry.readiness === 'needs_config').length,
        needsProbe: providers.filter((entry) => entry.readiness === 'needs_probe').length,
        advancedHidden: input.includeAdvanced === true
          ? 0
          : Math.max(0, allProviders.length - providers.length),
      },
      providers,
      profiles,
      selected,
      picker,
      readinessMatrix,
      liveCompletion: readinessMatrix?.liveCompletion || null,
      readinessStates: ['ready', 'needs_config', 'needs_probe'],
      safety: {
        secretRefsOnly: true,
        rawSecretsSerialized: false,
        selectionRequiresGovernedApply: true,
        catalogSupportIsNotLiveProof: true,
        defaultRoutingRequiresLiveProof: true,
      },
    };
  }

  public readChannels(input: { selectedId?: string | null } = {}): CanonicalChannelMeshDTO {
    const snapshot = this.getChannelMesh().buildSnapshot({
      selectedId: input.selectedId,
    });
    return {
      ...snapshot,
      schemaVersion: 1,
      surface: 'channel-mesh-v1',
      safety: {
        zavorthControlCanExecute: false,
        liveBridgeRequiresPolicyBroker: true,
        telegramPrivileged: false,
        catalogSupportIsNotLiveProof: true,
        defaultRoutingRequiresLiveProof: true,
      },
    };
  }

  public async readApprovals(input: {
    status?: PermissionStatus | 'all';
    limit?: number;
  } = {}): Promise<CanonicalApprovalsDTO> {
    const status = input.status || 'pending';
    const limit = input.limit || 20;
    const requests = status === 'all'
      ? (await Promise.all([
          this.getPermissionService().listRequests('pending', limit),
          this.getPermissionService().listRequests('approved', limit),
          this.getPermissionService().listRequests('rejected', limit),
          this.getPermissionService().listRequests('expired', limit),
        ])).flat().slice(0, limit)
      : await this.getPermissionService().listRequests(status, limit);
    const receiptProjection = this.visualReceipts.buildSnapshot({ includeAdvanced: false });
    const approvalCards = this.approvalActionCards.buildSnapshot({
      approvals: requests.map((request) => this.mapPermissionToApprovalCardInput(request)),
      visualReceipts: receiptProjection,
    });
    const trustUx = this.approvalReceiptTrustUx.buildSnapshot({
      approvalCards,
      visualReceipts: receiptProjection,
    });

    return {
      schemaVersion: 1,
      surface: 'approvals-v1',
      generatedAt: new Date().toISOString(),
      status,
      total: requests.length,
      data: requests,
      actions: ['allow_once', 'deny', 'view_preview', 'view_rollback'],
      approvalCards,
      trustUx,
      safety: {
        approvalScopedToExactAction: true,
        zavorthControlCanExecute: false,
        approvalDoesNotExecuteTargetAction: true,
        receiptsRequiredForTrustDecisions: true,
      },
    };
  }

  public readReceipts(input: { includeAdvanced?: boolean } = {}): CanonicalReceiptsDTO {
    const visualReceipts = this.visualReceipts.buildSnapshot({
      includeAdvanced: input.includeAdvanced === true,
    });
    const approvalCards = this.approvalActionCards.buildSnapshot({
      approvals: [],
      visualReceipts,
    });
    return {
      ...visualReceipts,
      apiSurface: 'receipts-v1',
      trustUx: this.approvalReceiptTrustUx.buildSnapshot({
        approvalCards,
        visualReceipts,
      }),
    };
  }

  public readMissions(input: {
    request?: string | null;
    selectedTemplateId?: string | null;
    source?: 'cli' | 'web' | 'channel' | 'scheduler' | 'internal';
  } = {}): CanonicalMissionsDTO {
    const snapshot = this.productization.buildSnapshot({
      request: input.request,
      selectedTemplateId: input.selectedTemplateId,
      source: input.source || 'web',
    });

    return {
      schemaVersion: 1,
      surface: 'missions-v1',
      generatedAt: snapshot.generatedAt,
      total: 1,
      data: [snapshot.mission],
      projection: {
        zavorthControlCanExecute: false,
        approvalsRequiredForMutableActions: true,
        sourceOfTruth: 'runtime-api',
      },
    };
  }

  public async submitChat(input: {
    message?: string | null;
    sessionId?: string | null;
    live?: boolean;
    approved?: boolean;
    selectedTemplateId?: string | null;
  } = {}): Promise<CanonicalChatPreviewDTO> {
    const generatedAt = new Date().toISOString();
    const message = String(input.message || '').trim();
    const snapshot = this.productization.buildSnapshot({
      request: message || 'Start a governed Zavorth mission.',
      source: 'web',
      selectedTemplateId: input.selectedTemplateId,
    });

    if (!message) {
      return this.buildChatProjection({
        generatedAt,
        accepted: false,
        live: false,
        sessionId: input.sessionId || null,
        taskId: null,
        snapshot,
        mode: 'preview',
        nextAction: 'Send a non-empty message to create a mission preview.',
      });
    }

    if (!input.live) {
      return this.buildChatProjection({
        generatedAt,
        accepted: true,
        live: false,
        sessionId: input.sessionId || null,
        taskId: null,
        snapshot,
        mode: 'preview',
        nextAction: 'Preview created. Set live=true only when the runtime surface should submit the chat request.',
      });
    }

    if (snapshot.mission.status === 'blocked') {
      return this.buildChatProjection({
        generatedAt,
        accepted: false,
        live: true,
        sessionId: input.sessionId || null,
        taskId: null,
        snapshot,
        mode: 'blocked',
        nextAction: snapshot.mission.nextAction,
      });
    }

    if (snapshot.mission.status === 'dry_run') {
      return this.buildChatProjection({
        generatedAt,
        accepted: false,
        live: true,
        sessionId: input.sessionId || null,
        taskId: null,
        snapshot,
        mode: 'dry_run_only',
        nextAction: snapshot.mission.nextAction,
      });
    }

    if (snapshot.mission.approvals.some((approval) => approval.status === 'pending') && input.approved !== true) {
      return this.buildChatProjection({
        generatedAt,
        accepted: false,
        live: true,
        sessionId: input.sessionId || null,
        taskId: null,
        snapshot,
        mode: 'approval_required',
        nextAction: 'Review the mission preview, rollback evidence and receipt, then retry with approved=true if the scope is correct.',
      });
    }

    const conversation = this.runtime.getConversationService?.() || null;
    if (!conversation) {
      return this.buildChatProjection({
        generatedAt,
        accepted: false,
        live: true,
        sessionId: input.sessionId || null,
        taskId: null,
        snapshot,
        mode: 'runtime_unavailable',
        nextAction: 'Attach the web runtime before submitting live chat through the public API.',
      });
    }

    const result = await conversation.processChatSend({
      message,
      sessionId: input.sessionId || undefined,
      source: 'api-v1',
    });
    return this.buildChatProjection({
      generatedAt,
      accepted: true,
      live: true,
      sessionId: result.sessionId,
      taskId: result.taskId,
      snapshot,
      runtimeSnapshot: result.snapshot,
      mode: 'submitted',
      nextAction: 'Follow mission progress through events, receipts and approvals.',
    });
  }

  public async readRuntimeEvents(input: {
    sessionId: string;
  }): Promise<{
    schemaVersion: 1;
    surface: 'runtime-events-v1';
    generatedAt: string;
    sessionId: string;
    data: PublicRuntimeEvent[];
    streaming: {
      ssePath: string;
      canonicalEventTypes: PublicRuntimeEvent['type'][];
    };
    safety: {
      zavorthControlCanExecute: false;
      policyBrokerRequiredForMutableActions: true;
      rawSecretsSerialized: false;
    };
  }> {
    const sessionId = String(input.sessionId || '').trim() || 'default';
    const realtime = this.runtime.getRealtime?.() || null;
    if (!realtime) {
      return {
        schemaVersion: 1,
        surface: 'runtime-events-v1',
        generatedAt: new Date().toISOString(),
        sessionId,
        data: [],
        streaming: {
          ssePath: `/api/v1/events?sessionId=${encodeURIComponent(sessionId)}`,
          canonicalEventTypes: this.getCanonicalEventTypes(),
        },
        safety: this.buildEventSafety(),
      };
    }
    realtime.ensureSession(sessionId);
    const snapshot = await realtime.getResolvedSnapshot(sessionId);
    return {
      schemaVersion: 1,
      surface: 'runtime-events-v1',
      generatedAt: new Date().toISOString(),
      sessionId,
      data: [this.publicEvents.buildRuntimeStatusSnapshot({ sessionId, snapshot })],
      streaming: {
        ssePath: `/api/v1/events?sessionId=${encodeURIComponent(sessionId)}`,
        canonicalEventTypes: this.getCanonicalEventTypes(),
      },
      safety: this.buildEventSafety(),
    };
  }

  public async approveApproval(input: {
    approvalId: string;
    decidedBy?: string | null;
    note?: string | null;
  }): Promise<CanonicalApprovalDecisionResultDTO> {
    const approvalId = normalizeActionId(input.approvalId);
    const policy = this.evaluateActionPolicy({
      surface: 'tool',
      operation: 'approval.approve',
      target: approvalId || 'unknown-approval',
      risk: 'safe',
      rule: 'GOVERNED_APPROVAL_DECISION',
      reasons: ['Operator requested an approval decision through the governed public API.'],
    });
    if (!approvalId) {
      return this.buildGovernedActionResult({
        action: 'approval.approve',
        target: 'unknown-approval',
        status: 'not_found',
        ok: false,
        result: null,
        policyReceipt: policy.receipt,
        summary: 'Approval id is required.',
        nextAction: 'Retry with a concrete approval id.',
      });
    }
    if (!policy.allowed) {
      return this.resultFromDeniedPolicy('approval.approve', approvalId, policy.receipt);
    }
    const service = this.getPermissionService();
    const existing = await service.getRequest(approvalId);
    if (!existing) {
      return this.buildGovernedActionResult({
        action: 'approval.approve',
        target: approvalId,
        status: 'not_found',
        ok: false,
        result: null,
        policyReceipt: policy.receipt,
        summary: 'Approval request was not found.',
        nextAction: 'Refresh approvals and choose a pending approval.',
      });
    }
    const result = await service.approveRequest(approvalId, normalizeActor(input.decidedBy), {
      decision_note: input.note || 'Approved through public API v1.',
    });
    return this.buildGovernedActionResult({
      action: 'approval.approve',
      target: approvalId,
      status: 'applied',
      ok: true,
      result,
      policyReceipt: policy.receipt,
      summary: 'Approval was applied through the governed public API.',
      nextAction: 'Follow execution through events and receipts.',
    });
  }

  public async denyApproval(input: {
    approvalId: string;
    decidedBy?: string | null;
    reason?: string | null;
  }): Promise<CanonicalApprovalDecisionResultDTO> {
    const approvalId = normalizeActionId(input.approvalId);
    const policy = this.evaluateActionPolicy({
      surface: 'tool',
      operation: 'approval.deny',
      target: approvalId || 'unknown-approval',
      risk: 'safe',
      rule: 'GOVERNED_APPROVAL_DECISION',
      reasons: ['Operator requested an approval denial through the governed public API.'],
    });
    if (!approvalId) {
      return this.buildGovernedActionResult({
        action: 'approval.deny',
        target: 'unknown-approval',
        status: 'not_found',
        ok: false,
        result: null,
        policyReceipt: policy.receipt,
        summary: 'Approval id is required.',
        nextAction: 'Retry with a concrete approval id.',
      });
    }
    if (!policy.allowed) {
      return this.resultFromDeniedPolicy('approval.deny', approvalId, policy.receipt);
    }
    const service = this.getPermissionService();
    const existing = await service.getRequest(approvalId);
    if (!existing) {
      return this.buildGovernedActionResult({
        action: 'approval.deny',
        target: approvalId,
        status: 'not_found',
        ok: false,
        result: null,
        policyReceipt: policy.receipt,
        summary: 'Approval request was not found.',
        nextAction: 'Refresh approvals and choose a pending approval.',
      });
    }
    const result = await service.rejectRequest(
      approvalId,
      normalizeActor(input.decidedBy),
      input.reason || 'Denied through public API v1.',
    );
    return this.buildGovernedActionResult({
      action: 'approval.deny',
      target: approvalId,
      status: 'denied',
      ok: true,
      result,
      policyReceipt: policy.receipt,
      summary: 'Approval was denied through the governed public API.',
      nextAction: 'No execution will be released for this approval.',
    });
  }

  public async cancelMission(input: {
    missionId: string;
    requestedBy?: string | null;
    reason?: string | null;
  }): Promise<CanonicalMissionCancelResultDTO> {
    const missionId = normalizeActionId(input.missionId);
    const policy = this.evaluateActionPolicy({
      surface: 'tool',
      operation: 'mission.cancel',
      target: missionId || 'unknown-mission',
      risk: 'safe',
      rule: 'GOVERNED_MISSION_CANCEL',
      reasons: ['Operator requested cancellation through the governed public API.'],
    });
    if (!missionId) {
      return this.buildGovernedActionResult({
        action: 'mission.cancel',
        target: 'unknown-mission',
        status: 'not_found',
        ok: false,
        result: null,
        policyReceipt: policy.receipt,
        summary: 'Mission id is required.',
        nextAction: 'Retry with a concrete mission/action id.',
      });
    }
    if (!policy.allowed) {
      return this.resultFromDeniedPolicy('mission.cancel', missionId, policy.receipt);
    }
    const gateway = this.runtime.getSupervisedExecutionGateway?.() || null;
    if (!gateway) {
      return this.buildGovernedActionResult({
        action: 'mission.cancel',
        target: missionId,
        status: 'runtime_unavailable',
        ok: false,
        result: null,
        policyReceipt: policy.receipt,
        summary: 'No canonical cancellation runtime is attached to this API surface.',
        nextAction: 'Attach the supervised execution gateway before cancelling live missions through /api/v1.',
      });
    }
    try {
      const result = await gateway.cancelAction({
        actionId: missionId,
        requestedBy: normalizeActor(input.requestedBy),
        reason: input.reason || 'Cancelled through public API v1.',
      });
      return this.buildGovernedActionResult({
        action: 'mission.cancel',
        target: missionId,
        status: 'applied',
        ok: true,
        result,
        policyReceipt: policy.receipt,
        summary: 'Mission cancellation was applied by the supervised runtime.',
        nextAction: 'Review the cancellation receipt and runtime events.',
      });
    } catch (error: any) { const err = error; const e = error;
      return this.buildGovernedActionResult({
        action: 'mission.cancel',
        target: missionId,
        status: 'blocked',
        ok: false,
        result: {
          error: error instanceof Error ? error.message : String(error),
        },
        policyReceipt: policy.receipt,
        summary: 'Mission cancellation was refused by the supervised runtime.',
        nextAction: 'Refresh mission state; only pending, dry-run or cancellable running actions can be cancelled.',
      });
    }
  }

  public async testProvider(input: {
    providerId: string;
    live?: boolean;
    approved?: boolean;
  }): Promise<CanonicalProviderTestResultDTO> {
    const providerId = normalizeActionId(input.providerId);
    const live = input.live === true;
    const policy = this.evaluateActionPolicy({
      surface: 'provider',
      operation: live ? 'provider.test.live' : 'provider.test.preview',
      target: providerId || 'unknown-provider',
      risk: live && input.approved !== true ? 'review' : 'safe',
      rule: live ? 'GOVERNED_PROVIDER_LIVE_PROBE' : 'GOVERNED_PROVIDER_PREVIEW_PROBE',
      userConfirmationRequired: live && input.approved !== true,
      reasons: [
        live
          ? 'Provider live probe can use outbound network and must be explicitly confirmed.'
          : 'Provider preview probe is offline and does not use secrets or network.',
      ],
    });
    if (!providerId) {
      return this.buildGovernedActionResult({
        action: 'provider.test',
        target: 'unknown-provider',
        status: 'not_found',
        ok: false,
        result: null,
        policyReceipt: policy.receipt,
        summary: 'Provider id is required.',
        nextAction: 'Retry with a concrete provider id.',
      });
    }
    if (!policy.allowed) {
      return this.resultFromDeniedPolicy('provider.test', providerId, policy.receipt);
    }
    const result = await this.getProviderReadiness().buildLiveSnapshot({
      providerId,
      probe: true,
      live,
    });
    return this.buildGovernedActionResult({
      action: 'provider.test',
      target: providerId,
      status: 'applied',
      ok: true,
      result,
      policyReceipt: policy.receipt,
      summary: live ? 'Provider live probe completed with sanitized evidence.' : 'Provider preview probe completed without live network.',
      nextAction: 'Use readiness status before selecting this provider for live work.',
    });
  }

  public async executeChannelAction(input: {
    channelId: string;
    actionId: string;
    requestedBy?: string | null;
    approved?: boolean;
  }): Promise<CanonicalChannelActionResultDTO> {
    const channelId = normalizeActionId(input.channelId);
    const actionId = normalizeActionId(input.actionId);
    const sensitive = isSensitiveChannelAction(actionId);
    const policy = this.evaluateActionPolicy({
      surface: 'plugin',
      operation: 'channel.action',
      target: `${channelId || 'unknown-channel'}:${actionId || 'unknown-action'}`,
      risk: sensitive && input.approved !== true ? 'review' : 'safe',
      rule: sensitive ? 'GOVERNED_CHANNEL_ACTION_REQUIRES_CONFIRMATION' : 'GOVERNED_CHANNEL_ACTION',
      userConfirmationRequired: sensitive && input.approved !== true,
      reasons: [
        sensitive
          ? 'Channel action may touch live bridges, policy reloads or outbound delivery.'
          : 'Channel action is inspect/status/doctor class and can run as a governed read action.',
      ],
    });
    if (!channelId || !actionId) {
      return this.buildGovernedActionResult({
        action: 'channel.action',
        target: `${channelId || 'unknown-channel'}:${actionId || 'unknown-action'}`,
        status: 'not_found',
        ok: false,
        result: null,
        policyReceipt: policy.receipt,
        summary: 'Channel id and action id are required.',
        nextAction: 'Retry with channelId and actionId.',
      });
    }
    if (!policy.allowed) {
      return this.resultFromDeniedPolicy('channel.action', `${channelId}:${actionId}`, policy.receipt);
    }
    const result = await this.getChannelActions().execute({
      channelId,
      actionId,
      requestedBy: normalizeActor(input.requestedBy),
    });
    return this.buildGovernedActionResult({
      action: 'channel.action',
      target: `${channelId}:${actionId}`,
      status: result.ok ? 'applied' : 'blocked',
      ok: result.ok,
      result,
      policyReceipt: policy.receipt,
      summary: `Channel action ${actionId} finished with status ${result.status}.`,
      nextAction: result.ok
        ? 'Review the channel action receipt and refreshed Channel Mesh state.'
        : 'Read channel action error and run doctor/status before retrying.',
    });
  }

  public getPublicRuntimeEventService(): PublicRuntimeEventService {
    return this.publicEvents;
  }

  public getRealtimeForEvents() {
    return this.runtime.getRealtime?.() || null;
  }

  public async readGatewayDomains(input: {
    userId?: string | null;
    sessionId?: string | null;
    chatId?: string | null;
    detail?: 'summary' | 'full';
  } = {}): Promise<GatewayDomainListDTO> {
    return readGatewayDomains(this.runtime, this.support, input);
  }

  public readOpsHealth(mode: 'fast' | 'live' = 'fast'): OpsHealthDTO {
    return readOpsHealth(this.runtime, this.support, mode);
  }

  public async readSessions(input: {
    userId?: string | null;
    sessionId?: string | null;
    chatId?: string | null;
    sourceUserId?: string | null;
    limit?: number;
  } = {}): Promise<SessionListDTO> {
    return readSessions(this.runtime, this.support, input);
  }

  public readLearningStatus(input: { workspace?: string | null } = {}): LearningStatusDTO {
    return readLearningStatus(this.runtime, this.support, input);
  }

  public readLearningCandidates(input: { workspace?: string | null } = {}): LearningCandidatesDTO {
    return readLearningCandidates(this.runtime, this.support, input);
  }

  public executeLearningAction(input: {
    candidateId?: string | null;
    actionId?: string | null;
  }): LearningActionResultDTO {
    return executeLearningAction(this.runtime, this.support, input);
  }

  public readLearningMetrics(input: { workspace?: string | null } = {}): LearningMetricsDTO {
    return readLearningMetrics(this.runtime, this.support, input);
  }

  public async readMemoryStatus(input: {
    userId?: string | null;
    sessionId?: string | null;
    chatId?: string | null;
    workspaceHint?: string | null;
  } = {}): Promise<MemoryStatusDTO> {
    return readMemoryStatus(this.runtime, this.support, input);
  }

  public async searchMemory(input: {
    userId?: string | null;
    sessionId?: string | null;
    chatId?: string | null;
    workspaceHint?: string | null;
    query?: string | null;
    limit?: number;
  } = {}): Promise<MemorySearchResultsDTO> {
    return searchMemory(this.runtime, this.support, input);
  }

  public async readMemoryProcedures(input: {
    workspaceHint?: string | null;
  } = {}): Promise<MemoryProceduresDTO> {
    return readMemoryProcedures(this.runtime, this.support, input);
  }

  public async readMemoryMetrics(input: {
    userId?: string | null;
    sessionId?: string | null;
    chatId?: string | null;
    workspaceHint?: string | null;
  } = {}): Promise<MemoryMetricsDTO> {
    return readMemoryMetrics(this.runtime, this.support, input);
  }

  public async readOpsQuality(input: {
    mode?: 'fast' | 'live';
    userId?: string | null;
    sessionId?: string | null;
    chatId?: string | null;
    workspaceHint?: string | null;
  } = {}): Promise<OpsQualityDTO> {
    return readOpsQuality(input, {
      readLearningMetrics: (query) => this.readLearningMetrics(query),
      readMemoryMetrics: (query) => this.readMemoryMetrics(query),
      readOpsHealth: (mode) => this.readOpsHealth(mode),
      readPlatformStatus: () => this.readPlatformStatus(),
      normalizeValue: (value) => this.support.normalizeValue(value),
    });
  }

  public readPlatformStatus(): PlatformStatusDTO {
    return readPlatformStatus(this.runtime, this.support);
  }

  public readPlatformCatalog(input: {
    selectedId?: string | null;
    query?: string | null;
  } = {}): PlatformCatalogDTO {
    return readPlatformCatalog(this.runtime, this.support, input);
  }

  public readNodes(input: { selectedNodeId?: string | null } = {}): NodeListDTO {
    return readNodes(this.runtime, this.support, input);
  }

  public readTransports(input: { selectedId?: string | null } = {}): { data: TransportDTO[] } {
    return readTransports(this.runtime, this.support, input);
  }

  public async readArtifacts(input: ArtifactQuery = {}): Promise<{ data: ArtifactDTO[] }> {
    return readArtifacts(this.runtime, this.support, input);
  }

  private mapPermissionToApprovalCardInput(request: PermissionRequest): Record<string, unknown> {
    const risk = String(request.metadata?.risk || request.metadata?.riskLevel || '').toLowerCase()
      || (/write|delete|shell|command|network|send/i.test(`${request.kind} ${request.reason} ${request.requested_value}`) ? 'medium' : 'low');
    return {
      id: request.permission_id,
      title: request.metadata?.title || request.kind || 'Approval needed',
      reason: request.reason || 'Policy requires an operator decision.',
      status: request.status === 'rejected' ? 'denied' : request.status,
      risk,
      scope: request.scope || 'once',
      summary: request.requested_value || request.resolved_value || request.kind,
    };
  }

  private getProviderControlPlane(): Pick<
    ProviderControlPlaneService,
    'listProviders' | 'listProfiles' | 'buildModelPickerContract' | 'resolveSelectedModelProfile'
  > {
    return this.runtime.getProviderControlPlane?.() || this.fallbackProviderControlPlane;
  }

  private buildChatProjection(input: {
    generatedAt: string;
    accepted: boolean;
    live: boolean;
    sessionId: string | null;
    taskId: string | null;
    snapshot: ReturnType<ZavorthProductizationProtectedRuntimeService['buildSnapshot']>;
    runtimeSnapshot?: unknown;
    mode: CanonicalChatPreviewDTO['mode'];
    nextAction: string;
  }): CanonicalChatPreviewDTO {
    return {
      schemaVersion: 1,
      surface: 'chat-v1',
      generatedAt: input.generatedAt,
      accepted: input.accepted,
      live: input.live,
      sessionId: input.sessionId,
      taskId: input.taskId,
      mission: input.snapshot.mission,
      receipt: input.snapshot.receipt,
      snapshot: input.runtimeSnapshot,
      mode: input.mode,
      nextAction: input.nextAction,
      flow: this.buildChatFlow(input.snapshot, input.mode),
      safety: this.buildChatSafety(),
    };
  }

  private buildChatFlow(
    snapshot: ReturnType<ZavorthProductizationProtectedRuntimeService['buildSnapshot']>,
    stage: CanonicalChatPreviewDTO['mode'],
  ): CanonicalChatPreviewDTO['flow'] {
    const primaryApproval = snapshot.mission.approvals.find((approval) => approval.status === 'pending')
      || snapshot.mission.approvals[0]
      || null;
    const approvalStatus = snapshot.mission.status === 'blocked'
      ? 'blocked'
      : primaryApproval?.status || 'not_required';

    return {
      stage,
      previewFirst: true,
      sourceOfTruth: 'runtime-api',
      approvalGate: {
        required: snapshot.mission.approvals.some((approval) => approval.status === 'pending'),
        id: primaryApproval?.status === 'pending' ? primaryApproval.id : null,
        status: approvalStatus,
        risk: snapshot.mission.risk,
        options: primaryApproval?.options || ['view_preview'],
      },
      receiptReady: true,
      artifactCount: snapshot.mission.artifacts.length,
      eventTypes: ['mission.updated', 'approval.request', 'receipt.ready'],
    };
  }

  private getChannelMesh(): Pick<ZavorthChannelMeshService, 'buildSnapshot'> {
    return this.runtime.getChannelMesh?.() || this.fallbackChannelMesh;
  }

  private getPermissionService(): Pick<PermissionService, 'listRequests' | 'getRequest' | 'approveRequest' | 'rejectRequest'> {
    return this.runtime.getPermissionService?.() || this.fallbackPermissionService;
  }

  private getChannelActions(): Pick<ZavorthChannelActionService, 'execute'> {
    return this.runtime.getChannelActions?.() || this.fallbackChannelActions;
  }

  private getProviderReadiness(): Pick<ZavorthProviderReadinessMatrixService, 'buildLiveSnapshot'> {
    return this.runtime.getProviderReadiness?.() || this.fallbackProviderReadiness;
  }

  private readProviderReadinessMatrix(input: {
    includeAdvanced?: boolean;
    providerId?: string | null;
  }): ZavorthProviderReadinessMatrixSnapshot | null {
    const runtimeReadiness = this.runtime.getProviderReadiness?.() as Partial<ZavorthProviderReadinessMatrixService> | null | undefined;
    if (runtimeReadiness && typeof runtimeReadiness.buildSnapshot === 'function') {
      return runtimeReadiness.buildSnapshot({
        includeAdvanced: input.includeAdvanced === true,
        providerId: input.providerId,
      });
    }
    return this.fallbackProviderReadiness.buildSnapshot({
      includeAdvanced: input.includeAdvanced === true,
      providerId: input.providerId,
    });
  }

  private evaluateActionPolicy(input: SecurityPolicyBrokerRequest) {
    return decideSecurityPolicy({
      profile: 'standard',
      sourceTrust: 'trusted',
      ...input,
    });
  }

  private resultFromDeniedPolicy<T>(
    action: string,
    target: string,
    policyReceipt: CanonicalGovernedActionReceiptDTO['policyReceipt'],
  ): CanonicalGovernedActionResultDTO<T> {
    const status: CanonicalGovernedActionStatus = policyReceipt.action === 'require_user_confirmation'
      ? 'needs_approval'
      : 'blocked';
    return this.buildGovernedActionResult<T>({
      action,
      target,
      status,
      ok: false,
      result: null,
      policyReceipt,
      summary: policyReceipt.reasons.join(' ') || `Policy returned ${policyReceipt.action}.`,
      nextAction: status === 'needs_approval'
        ? 'Create or approve a scoped permission before retrying this action.'
        : 'Adjust policy or request a safer preview action.',
    });
  }

  private buildGovernedActionResult<T>(input: {
    action: string;
    target: string;
    status: CanonicalGovernedActionStatus;
    ok: boolean;
    result: T | null;
    policyReceipt: CanonicalGovernedActionReceiptDTO['policyReceipt'];
    summary: string;
    nextAction: string;
  }): CanonicalGovernedActionResultDTO<T> {
    const generatedAt = new Date().toISOString();
    return {
      schemaVersion: 1,
      surface: 'governed-action-v1',
      generatedAt,
      action: input.action,
      target: input.target,
      ok: input.ok,
      status: input.status,
      result: input.result,
      receipt: {
        id: `gar_${input.policyReceipt.receiptId}`,
        generatedAt,
        operation: input.action,
        target: input.target,
        status: input.status,
        summary: input.summary,
        policyReceipt: input.policyReceipt,
        rawSecretsSerialized: false,
        zavorthControlCanExecute: false,
      },
      nextAction: input.nextAction,
      safety: {
        controllerMutatedDirectly: false,
        policyBrokerEvaluated: true,
        rawSecretsSerialized: false,
      },
    };
  }

  private buildChatSafety(): CanonicalChatPreviewDTO['safety'] {
    return {
      dryRunByDefault: true,
      liveRequiresExplicitFlag: true,
      zavorthControlCanExecute: false,
      policyBrokerRequiredForTools: true,
    };
  }

  private buildEventSafety() {
    return {
      zavorthControlCanExecute: false,
      policyBrokerRequiredForMutableActions: true,
      rawSecretsSerialized: false,
    } as const;
  }

  private getCanonicalEventTypes(): PublicRuntimeEvent['type'][] {
    return [
      'runtime.status',
      'message.created',
      'mission.updated',
      'approval.request',
      'tool.updated',
      'receipt.ready',
      'snapshot.updated',
      'heartbeat',
      'error',
    ];
  }
}

function normalizeActionId(value: unknown): string {
  return String(value || '').trim();
}

function normalizeActor(value: unknown): string {
  return String(value || '').trim() || 'api-v1-operator';
}

function isSensitiveChannelAction(actionId: string): boolean {
  return [
    'broadcast-test',
    'send-test',
    'policy-reload',
    'login-qr',
    'relink',
    'logout',
  ].includes(String(actionId || '').trim().toLowerCase());
}
