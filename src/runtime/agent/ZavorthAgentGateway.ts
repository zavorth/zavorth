import {
  AgentRunService,
  type AgentRunExecutionOptions,
  type AgentRunServiceRuntime,
  type AgentRunSteeringInput,
} from './AgentRunService.js';
import { MemoryAgentRunStore, type AgentRunStore } from './AgentRunStore.js';
import {
  queryUniversalAgentRuns,
  type UniversalAgentRunObservatoryQuery,
  type UniversalAgentRunObservatorySnapshot,
} from './RunObservatory.js';
import {
  UniversalApprovalIntentResolver,
  type UniversalApprovalIntentChannel,
  type UniversalApprovalIntentDecisionResult,
  type UniversalApprovalIntentResolveInput,
} from './UniversalApprovalIntentResolver.js';
import {
  MemoryAgentWorkflowQueueStore,
  type AgentWorkflowQueueStore,
  type AgentWorkflowQueueStoreDescriptor,
} from './AgentWorkflowQueueStore.js';

import { resolveAgentGatewayTraceId, withAgentGatewayTraceMetadata } from './AgentGatewayTelemetry.js';

import { ChannelFormattingService, type ChannelMessagePlatform } from '../../channels/formatting/ChannelFormattingService.js';
import {
  buildOutboundReplyEvent,
  buildOutboundTypingEvent,
  type CanonicalChannelPlatform,
} from '../../channels/contracts/ChannelMessageContract.js';
import { ChannelMeshOnboardingGate } from '../../channels/onboarding/ChannelMeshOnboardingGate.js';
import { TypingHeartbeat } from '../../channels/presence/TypingHeartbeat.js';
import {
  renderApprovalPromptForSurface,
  resolveSurfaceCapabilityPresentation,
} from '../../channels/capabilities/SurfaceCapabilityGate.js';
import { config } from '../../config/index.js';

import type { StrongCapabilityLoopSnapshot } from './CapabilityLoopGovernanceService.js';
import {
  RuntimePromotionGovernanceService,
  type RuntimePromotionGovernanceSnapshot,
} from './RuntimePromotionGovernanceService.js';
import { AgentLLMRuntime } from './AgentLLMRuntime.js';

import type {
  UniversalAgentApprovalDecisionResult,
  UniversalAgentRequest,
  UniversalAgentRun,
  UniversalAgentRunResult,
  UniversalAgentSteeringEntry,
  UniversalAgentWorkflowJob,
  UniversalApprovalRequest,
  UniversalReplyPacket,
} from './UniversalAgentRuntimeTypes.js';
import { errorMessage } from '../../utils/errorLike.js';
import { normalizeAgentPermissionChoice } from '../../contracts/permission/AgentPermissionContract.js';
import { getAgentPermissionService } from '../../services/permission/AgentPermissionService.js';
import { assertSurfaceApproveGate } from '../../services/surface/SurfaceApprovalGate.js';
import { ApprovalCoordinator } from '../../services/approvals/ApprovalCoordinator.js';
export type ZavorthAgentGatewayRuntime = AgentRunServiceRuntime & {
  runStore?: AgentRunStore | null;
  workflowQueueStore?: AgentWorkflowQueueStore | null;
  workflowWorkerId?: string;
  workflowLeaseMs?: number;
  workflowBackoffMs?: number;
  workflowMaxBackoffMs?: number;
  workflowMaxAttempts?: number;
  runtimePromotionGovernance?: RuntimePromotionGovernanceService | null;
  agentLLMRuntime?: AgentLLMRuntime | null;
};

export type ZavorthAgentGatewaySnapshot = {
  generatedAt: string;
  source: {
    kind: 'universal-agent-runtime';
    label: 'Zavorth Agent Gateway';
  };
  activeRun: UniversalAgentRun | null;
  runs: UniversalAgentRun[];
  runObservatory: UniversalAgentRunObservatorySnapshot;
  capabilityLoopGovernance: StrongCapabilityLoopSnapshot | null;
  runtimePromotionGovernance: RuntimePromotionGovernanceSnapshot;
  workflowJobs: UniversalAgentWorkflowJob[];
  workflowQueue: AgentWorkflowQueueStoreDescriptor;
};

export type ZavorthAgentGatewaySnapshotOptions = {
  activeRunId?: string | null;
  activeTraceId?: string | null;
  activeSessionId?: string | null;
  runStatus?: UniversalAgentRunObservatoryQuery['status'];
  runLimit?: number | null;
};

export type ZavorthAgentGatewayProcessQueueOptions = AgentRunExecutionOptions & {
  limit?: number;
};

export type ZavorthAgentGatewayApprovalIntentInput = Omit<UniversalApprovalIntentResolveInput, 'runs'>;

export type ZavorthAgentGatewaySteerAction = 'add' | 'cancel' | 'replace';

export type ZavorthAgentGatewaySteerInput = AgentRunSteeringInput & {
  action?: ZavorthAgentGatewaySteerAction;
  runId?: string | null;
  steeringId?: string | null;
};

export type ZavorthAgentGatewaySteerResult = {
  ok: boolean;
  action: ZavorthAgentGatewaySteerAction;
  run: UniversalAgentRun | null;
  steering: UniversalAgentSteeringEntry | null;
  ack: {
    id: string;
    runId: string;
    steeringId: string;
    status: UniversalAgentSteeringEntry['status'];
    createdAt: string;
  } | null;
  error?: string | null;
};

export type ChannelMeshGatewayEventHandler = (event: unknown) => void | Promise<void>;

export type ChannelMeshEventBusLike = {
  subscribe(eventType: string, handler: ChannelMeshGatewayEventHandler): void;
  unsubscribe?(eventType: string, handler: ChannelMeshGatewayEventHandler): void;
  emit?(event: unknown): void;
};

export type ChannelMeshBridgeSubscription = {
  detach(): void;
};

export type ChannelMeshBridgeOptions = {
  onboardingGate?: ChannelMeshOnboardingGate | null;
  /**
   * Declared per-platform outbound message limit override. When provided and
   * finite, it wins over the built-in platform limit table.
   */
  getCharLimitOverride?(platform: string): number | undefined;
};

type ChannelMeshReplyTarget = {
  platform: CanonicalChannelPlatform;
  chatId: string;
  userId: string;
};

type PendingExecution = {
  request: UniversalAgentRequest;
  options: AgentRunExecutionOptions;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function toSerializableRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  try {
    const parsed = JSON.parse(JSON.stringify(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error: unknown) {
    return {};
  }
}

function isTerminalWorkflowStatus(job: UniversalAgentWorkflowJob): boolean {
  return job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled';
}

function isTerminalRunStatus(run: UniversalAgentRun | null | undefined): boolean {
  return run?.status === 'completed' || run?.status === 'failed' || run?.status === 'cancelled';
}

export class ZavorthAgentGateway {
  private readonly runService: AgentRunService;
  private readonly runStore: AgentRunStore;
  private readonly workflowQueueStore: AgentWorkflowQueueStore;
  private readonly now: () => Date;
  private readonly workflowWorkerId: string;
  private readonly workflowLeaseMs: number;
  private readonly workflowBackoffMs: number;
  private readonly workflowMaxBackoffMs: number;
  private readonly workflowMaxAttempts: number;
  private readonly runtimePromotionGovernance: RuntimePromotionGovernanceService;
  private readonly agentLLMRuntime: AgentLLMRuntime;
  private readonly approvalCoordinator: ApprovalCoordinator;
  private readonly runs = new Map<string, UniversalAgentRun>();
  private readonly inFlightRuns = new Map<string, UniversalAgentRun>();
  private readonly workflowJobs = new Map<string, UniversalAgentWorkflowJob>();
  private readonly pendingExecutions = new Map<string, PendingExecution>();

  constructor(runtime: ZavorthAgentGatewayRuntime = {}) {
    const upstreamOnRunCreated = runtime.onRunCreated;
    const upstreamOnRunCompleted = runtime.onRunCompleted;
    // Surface entrypoints inherit Fabric defaults through this canonical gateway.
    // Equivalent entrypoint contract: new AgentRunService(runtime), with onRunCreated persistence added below.
    this.runService = new AgentRunService({
      ...runtime,
      onRunCreated: (run, request) => {
        upstreamOnRunCreated?.(run, request);
        this.inFlightRuns.set(run.id, run);
        this.runs.set(run.id, run);
        this.persistRuns();
      },
      onRunCompleted: (run, request, replyText) => {
        upstreamOnRunCompleted?.(run, request, replyText);
        this.inFlightRuns.delete(run.id);
        this.persistRuns();
      },
    });
    this.runStore = runtime.runStore || new MemoryAgentRunStore();
    this.workflowQueueStore = runtime.workflowQueueStore || new MemoryAgentWorkflowQueueStore();
    this.now = runtime.now || (() => new Date());
    this.workflowWorkerId = normalizeText(
      runtime.workflowWorkerId,
      `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`,
    );
    this.workflowLeaseMs = Math.max(1000, runtime.workflowLeaseMs || 30_000);
    this.workflowBackoffMs = Math.max(100, runtime.workflowBackoffMs || 1000);
    this.workflowMaxBackoffMs = Math.max(this.workflowBackoffMs, runtime.workflowMaxBackoffMs || 60_000);
    this.workflowMaxAttempts = Math.max(1, runtime.workflowMaxAttempts || 3);
    this.runtimePromotionGovernance =
      runtime.runtimePromotionGovernance ||
      new RuntimePromotionGovernanceService({
        now: this.now,
      });
    this.agentLLMRuntime = runtime.agentLLMRuntime || new AgentLLMRuntime();
    this.approvalCoordinator = new ApprovalCoordinator(this);
    this.hydrateRuns();
    this.hydrateWorkflowJobs();
  }

  public getAgentLLMRuntime(): AgentLLMRuntime {
    return this.agentLLMRuntime;
  }

  public attachSelfModificationService(service: ZavorthAgentGatewayRuntime['selfModificationService']): void {
    this.runService.attachSelfModificationService(service);
  }

  public attachWatchModeService(service: ZavorthAgentGatewayRuntime['watchModeService']): void {
    this.runService.attachWatchModeService(service);
  }

  public attachRuntimeEventBus(service: ZavorthAgentGatewayRuntime['runtimeEventBus']): void {
    this.runService.attachRuntimeEventBus(service);
  }

  public addRuntimeEventBus(service: ZavorthAgentGatewayRuntime['runtimeEventBus']): void {
    this.runService.addRuntimeEventBus(service);
  }

  public removeRuntimeEventBus(service: ZavorthAgentGatewayRuntime['runtimeEventBus']): void {
    this.runService.removeRuntimeEventBus(service);
  }

  public attachChannelMeshEventBus(
    eventBus: ChannelMeshEventBusLike | null | undefined,
    options: AgentRunExecutionOptions = {},
    bridgeOptions: ChannelMeshBridgeOptions = {},
  ): ChannelMeshBridgeSubscription {
    if (!eventBus) {
      return { detach: () => undefined };
    }

    const onboardingGate =
      bridgeOptions.onboardingGate === undefined
        ? new ChannelMeshOnboardingGate({ projectRoot: config.projectRoot })
        : bridgeOptions.onboardingGate;

    const handler: ChannelMeshGatewayEventHandler = async (event) => {
      const request = this.extractChannelMeshNormalizedInboundMessage(event);
      if (!request) return;

      const target = this.extractChannelMeshReplyTarget(request);
      if (!target) return;

      const menuKey = `${target.platform}:${target.chatId}`;
      const interaction = this.approvalCoordinator.resolveApprovalInteraction(menuKey, request.text);
      if (interaction.kind === 'explicit-command' || interaction.kind === 'fast-path-command') {
        const receipt = await this.approvalCoordinator.executeApprovalDecision({
          command: interaction.command,
          surface: target.platform,
          sessionId: menuKey,
        });
        this.emitChannelMeshReplies(eventBus, target, [receipt || ''].filter((text) => text.trim().length > 0), bridgeOptions);
        return;
      }
      if (interaction.kind === 'other-armed') {
        this.emitChannelMeshReplies(
          eventBus,
          target,
          [this.approvalCoordinator.buildOtherModePrompt(interaction.refList.length)],
          bridgeOptions,
        );
        return;
      }
      if (interaction.kind === 'other-context') {
        await this.routeChannelMeshOtherContext(eventBus, target, interaction, bridgeOptions);
        return;
      }

      if (onboardingGate) {
        const interception = await onboardingGate.intercept(
          { platform: target.platform, userId: target.userId, chatId: target.chatId },
          request.text,
        );
        if (interception.handled) {
          this.emitChannelMeshReplies(eventBus, target, interception.replies, bridgeOptions);
          return;
        }
      }

      const typingHeartbeat = new TypingHeartbeat({
        sendAction: () =>
          Promise.resolve(
            eventBus.emit?.(
              buildOutboundTypingEvent({
                platform: target.platform,
                chatId: target.chatId,
                userId: target.userId,
              }),
            ),
          ),
      });
      typingHeartbeat.start();
      try {
        const result = await this.handle(this.decorateChannelMeshRequest(request), options);
        const replyTexts = (result.replies ?? [])
          .map((reply) => reply.text)
          .filter((text) => text.trim().length > 0);
        const fallbackTexts =
          replyTexts.length > 0 ? replyTexts : [result.run.summary].filter((text) => text.trim());
        const finalTexts = this.appendPendingApprovalGuidance(result.run, fallbackTexts, target.platform, menuKey);
        this.emitChannelMeshReplies(eventBus, target, finalTexts, bridgeOptions);
      } finally {
        typingHeartbeat.stop();
      }
    };

    eventBus.subscribe('public_ws', handler);
    return {
      detach: () => eventBus.unsubscribe?.('public_ws', handler),
    };
  }

  /**
   * Presenter-facing registration entry point of the approval spine: thin
   * presenters publish the pending-approval listing they rendered for a chat
   * so fast-path tokens and the "other" escape resolve against that state.
   */
  public registerChannelMeshApprovalMenu(platform: string, chatId: string, approvalRefs: string[]): void {
    this.approvalCoordinator.registerPendingMenu(`${platform}:${chatId}`, approvalRefs);
  }

  private appendPendingApprovalGuidance(
    run: UniversalAgentRun,
    texts: string[],
    surface?: string,
    menuKey?: string,
  ): string[] {
    if (run.status !== 'waiting_approval') {
      return texts;
    }
    const pendingApprovals = run.approvals.filter((approval) => approval.status === 'pending');
    if (pendingApprovals.length === 0) {
      return texts;
    }
    if (menuKey) {
      this.approvalCoordinator.registerPendingMenu(
        menuKey,
        pendingApprovals.map((approval) => approval.id),
      );
    }
    const presentation = surface
      ? resolveSurfaceCapabilityPresentation({ platform: surface })
      : null;
    const prompt = renderApprovalPromptForSurface(
      presentation,
      pendingApprovals.map((approval) => ({
        label: approval.title || approval.reason || 'action',
        risk: approval.risk,
        ref: approval.id,
      })),
    );
    if (!prompt) {
      // Capability enforcement: this surface declared approvals disabled (or
      // has no text fallback), so it never receives approval prompts.
      return texts;
    }
    return [...texts, prompt];
  }

  /**
   * Routes the captured free-text answer of the "other" escape option: the
   * universal intent resolver decides when the text is a structured decision;
   * everything else is denied fail-closed with the operator's answer relayed
   * back to the agent as rejection context.
   */
  private async routeChannelMeshOtherContext(
    eventBus: ChannelMeshEventBusLike,
    target: ChannelMeshReplyTarget,
    packet: { userText: string; refList: string[] },
    bridgeOptions: ChannelMeshBridgeOptions,
  ): Promise<void> {
    const sessionId = `${target.platform}:${target.chatId}`;
    let receipts: Array<string | null> = [];
    if (packet.userText.length > 0) {
      const resolution = new UniversalApprovalIntentResolver().resolve({
        text: packet.userText,
        source: 'text',
        userId: target.userId,
        sessionId,
        channel: target.platform as UniversalApprovalIntentChannel,
        runs: this.listRuns(200),
      });
      if (resolution.status === 'resolved' && resolution.decision && resolution.target) {
        const ref = resolution.ref || resolution.target.approval.id;
        receipts = [
          await this.approvalCoordinator.executeApprovalDecision({
            command:
              resolution.decision === 'approved'
                ? { action: 'approve', ref, choice: 'once' }
                : { action: 'deny', ref, choice: 'once' },
            surface: target.platform,
            sessionId,
          }),
        ];
      } else {
        receipts = [
          await this.approvalCoordinator.executeDenyWithReason({
            refList: packet.refList,
            reason: packet.userText,
            surface: target.platform,
            sessionId,
          }),
        ];
      }
    }
    this.emitChannelMeshReplies(
      eventBus,
      target,
      receipts.filter((text): text is string => Boolean(text && text.trim().length > 0)),
      bridgeOptions,
    );
  }

  private extractChannelMeshReplyTarget(request: UniversalAgentRequest): ChannelMeshReplyTarget | null {
    const metadata = toSerializableRecord(request.metadata);
    const platform = normalizeText(metadata.channelPlatform);
    const chatId = normalizeText(metadata.chatId);
    const userId = normalizeText(metadata.channelUserId) || normalizeText(request.userId);
    if (!platform || !chatId || !userId) {
      return null;
    }
    return { platform: platform as CanonicalChannelPlatform, chatId, userId };
  }

  private emitChannelMeshReplies(
    eventBus: ChannelMeshEventBusLike,
    target: ChannelMeshReplyTarget,
    texts: string[],
    bridgeOptions: ChannelMeshBridgeOptions = {},
  ): void {
    if (typeof eventBus.emit !== 'function') {
      return;
    }
    const charLimitOverride = bridgeOptions.getCharLimitOverride?.(target.platform);
    const chunkOptions =
      typeof charLimitOverride === 'number' && Number.isFinite(charLimitOverride) && charLimitOverride > 0
        ? { charLimitOverride }
        : {};
    for (const text of texts) {
      for (const chunk of ChannelFormattingService.chunkMessageForPlatform(
        target.platform as ChannelMessagePlatform,
        text,
        chunkOptions,
      )) {
        eventBus.emit(
          buildOutboundReplyEvent({
            platform: target.platform,
            chatId: target.chatId,
            userId: target.userId,
            text: chunk,
          }),
        );
      }
    }
  }

  public async handle(
    input: UniversalAgentRequest,
    options: AgentRunExecutionOptions = {},
  ): Promise<UniversalAgentRunResult> {
    const result = await this.runService.run(input, options);
    this.inFlightRuns.delete(result.run.id);
    this.runs.set(result.run.id, result.run);
    if (result.run.status === 'waiting_approval') {
      this.pendingExecutions.set(result.run.id, {
        request: input,
        options,
      });
      this.ensureWorkflowJobForWaitingApproval(result.run, input);
    }
    this.persistAll();
    return result;
  }

  public async approve(
    ref: string,
    options: AgentRunExecutionOptions & {
      totp?: string | null;
      surface?: string | null;
      /** standard style: once | session | always | deny */
      choice?: string | null;
      workspaceId?: string | null;
      sessionId?: string | null;
    } = {},
  ): Promise<UniversalAgentApprovalDecisionResult | null> {
    const target = this.findPendingApproval(ref);
    if (!target) {
      return null;
    }

    const { run, approval } = target;

    const choice = normalizeAgentPermissionChoice(options.choice) || 'once';

    if (choice === 'deny') {
      return this.reject(ref);
    }

    // Standard permission memory (session / always) then explicit approve.
    const permissions = getAgentPermissionService({ projectRoot: process.cwd() });
    const remembered = permissions.respond({
      choice,
      toolName: String((approval as { toolName?: string }).toolName || approval.title || 'tool'),
      pattern: String(approval.reason || approval.id),
      risk: approval.risk,
      workspaceId: options.workspaceId || run.sessionId || null,
      sessionId: options.sessionId || run.sessionId || null,
      actorId: 'operator',
      surface: options.surface || 'agent-gateway',
    });

    assertSurfaceApproveGate({
      surface: options.surface || 'agent-gateway',
      riskLevel: approval.risk,
      approvalGranted: remembered.allowed,
    });

    const now = this.nowIso();
    approval.status = 'approved';
    run.updatedAt = now;
    run.events.push({
      id: `${approval.id}:approved`,
      runId: run.id,
      kind: 'approval',
      title: 'Approval received',
      detail: `${approval.title} (${choice})`,
      status: 'done',
      createdAt: now,
      metadata: {
        approvalId: approval.id,
        choice,
        permissionScope: remembered.scope,
        permissionMessage: remembered.message,
      },
    });

    const pending = this.pendingExecutions.get(run.id);
    const job = this.ensureWorkflowJobForApproval(
      run,
      pending?.request || this.buildRequestFromRun(run),
      approval,
      'queued',
    );
    const resumeRequest = pending?.request || job.request || this.buildRequestFromRun(run);
    job.request = this.serializeRequestForWorkflow(resumeRequest, run);
    job.status = 'queued';
    job.updatedAt = now;
    job.lastError = null;
    job.nextRunAt = now;
    job.leaseOwner = null;
    job.leaseExpiresAt = null;
    job.lockedAt = null;
    job.heartbeatAt = null;
    job.failedAt = null;
    job.metadata = {
      ...(job.metadata || {}),
      approvedAt: now,
    };

    const executionOptions = this.mergeExecutionOptions(pending?.options, options);
    if (!this.runService.canExecute(executionOptions, resumeRequest)) {
      run.status = 'queued';
      run.summary = 'Approval recorded. Durable execution is waiting for an available executor.';
      run.updatedAt = now;
      run.events.push({
        id: `${job.id}:queued`,
        runId: run.id,
        kind: 'status',
        title: 'Execution duravel na queue',
        detail: 'O request sobreviveu ao restart e aguardara um worker/executor available.',
        status: 'pending',
        createdAt: now,
        metadata: {
          workflowJobId: job.id,
        },
      });
      this.runs.set(run.id, run);
      this.workflowJobs.set(job.id, job);
      this.persistRuns();
      this.persistWorkflowJob(job);
      return {
        ok: true,
        run,
        replies: this.buildReplies(run, run.summary, now),
        approval,
        decision: 'approved',
        resumed: false,
        queued: true,
        workflowJob: job,
        error: null,
      };
    }

    const result = await this.executeWorkflowJob(job, run, resumeRequest, executionOptions);
    this.pendingExecutions.delete(run.id);
    this.runs.set(result.run.id, result.run);
    this.workflowJobs.set(job.id, job);
    this.persistRuns();
    this.persistWorkflowJob(job);
    return {
      ...result,
      approval,
      decision: 'approved',
      resumed: result.ok,
      queued: false,
      workflowJob: job,
      error: result.ok ? null : result.run.summary,
    };
  }

  public async reject(
    ref: string,
    options: { reason?: string | null } = {},
  ): Promise<UniversalAgentApprovalDecisionResult | null> {
    const target = this.findPendingApproval(ref);
    if (!target) {
      return null;
    }

    const { run, approval } = target;
    const now = this.nowIso();
    const operatorReason = normalizeText(options.reason);
    approval.status = 'rejected';
    run.status = 'cancelled';
    run.summary = 'Execution canceled by the operator before touching sensitive tools.';
    run.updatedAt = now;
    run.events.push({
      id: `${approval.id}:rejected`,
      runId: run.id,
      kind: 'approval',
      title: 'Approval rejected',
      detail: approval.title,
      status: 'done',
      createdAt: now,
      metadata: {
        approvalId: approval.id,
        ...(operatorReason ? { operatorReason } : {}),
      },
    });
    this.runService.recordLifecycleDefenseReview(run, 'cancelled', now);
    const job = this.findWorkflowJob(run.id, approval.id);
    if (job) {
      job.status = 'cancelled';
      job.updatedAt = now;
      job.cancelledAt = now;
      job.leaseOwner = null;
      job.leaseExpiresAt = null;
      job.lockedAt = null;
      job.heartbeatAt = null;
      job.resultRunStatus = run.status;
      job.metadata = {
        ...(job.metadata || {}),
        rejectedAt: now,
        ...(operatorReason ? { operatorReason } : {}),
      };
      this.workflowJobs.set(job.id, job);
    }
    this.pendingExecutions.delete(run.id);
    this.runs.set(run.id, run);
    this.persistRuns();
    if (job) {
      this.persistWorkflowJob(job);
    } else {
      this.persistWorkflowJobs();
    }
    return {
      ok: true,
      run,
      replies: this.buildReplies(run, run.summary, now),
      approval,
      decision: 'rejected',
      resumed: false,
      queued: false,
      workflowJob: job || null,
      error: null,
    };
  }

  public async resolveApprovalIntent(
    input: ZavorthAgentGatewayApprovalIntentInput,
    options: AgentRunExecutionOptions = {},
  ): Promise<UniversalApprovalIntentDecisionResult> {
    const resolver = new UniversalApprovalIntentResolver();
    const resolution = resolver.resolve({
      ...input,
      runs: Array.from(this.runs.values()),
    });
    if (resolution.status !== 'resolved' || !resolution.decision || !resolution.target) {
      return {
        ok: false,
        resolution,
        result: null,
        error: resolution.reason,
      };
    }

    const ref = resolution.ref || resolution.target.approval.id;
    const result = resolution.decision === 'approved' ? await this.approve(ref, options) : await this.reject(ref);

    return {
      ok: Boolean(result),
      resolution,
      result,
      error: result ? null : 'Universal approval not found or already resolved.',
    };
  }

  public async processQueuedWorkflows(
    options: ZavorthAgentGatewayProcessQueueOptions = {},
  ): Promise<UniversalAgentRunResult[]> {
    if (!this.runService.canExecute(options)) {
      return [];
    }

    const limit = Math.max(1, options.limit || 20);
    this.refreshRuns();
    this.refreshWorkflowJobs();
    this.releaseExpiredWorkflowLeases();
    const jobs = this.claimQueuedWorkflowJobs(limit);
    const results: UniversalAgentRunResult[] = [];

    for (const job of jobs) {
      const run = this.runs.get(job.runId);
      if (!run) {
        job.status = 'failed';
        job.lastError = 'Original run not found to process the durable queue.';
        job.updatedAt = this.nowIso();
        job.failedAt = job.updatedAt;
        job.leaseOwner = null;
        job.leaseExpiresAt = null;
        job.lockedAt = null;
        job.heartbeatAt = null;
        this.workflowJobs.set(job.id, job);
        this.persistWorkflowJob(job);
        continue;
      }

      const result = await this.executeWorkflowJob(job, run, job.request || this.buildRequestFromRun(run), options);
      this.runs.set(result.run.id, result.run);
      this.workflowJobs.set(job.id, job);
      results.push(result);
    }

    this.persistRuns();
    return results;
  }

  public heartbeatWorkflowJob(jobId: string): UniversalAgentWorkflowJob | null {
    const now = this.nowIso();
    const heartbeat = this.workflowQueueStore.heartbeatJob({
      jobId,
      workerId: this.workflowWorkerId,
      now,
      leaseMs: this.workflowLeaseMs,
    });

    if (heartbeat) {
      this.workflowJobs.set(heartbeat.id, heartbeat);
      return heartbeat;
    }
    return null;
  }

  public getRun(runId: string): UniversalAgentRun | null {
    return this.runs.get(runId) || null;
  }

  public listRuns(limit = 20): UniversalAgentRun[] {
    return Array.from(this.runs.values())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  public steer(input: ZavorthAgentGatewaySteerInput): ZavorthAgentGatewaySteerResult {
    this.refreshRuns();
    const action = input.action || 'add';
    const run = this.resolveSteeringRun(input);
    if (!run) {
      return {
        ok: false,
        action,
        run: null,
        steering: null,
        ack: null,
        error: 'active_run_not_found',
      };
    }
    if (isTerminalRunStatus(run)) {
      return {
        ok: false,
        action,
        run,
        steering: null,
        ack: null,
        error: 'run_not_active',
      };
    }

    let steering: UniversalAgentSteeringEntry | null = null;
    if (action === 'cancel') {
      steering = this.runService.cancelSteering(
        run,
        normalizeText(input.steeringId || input.queueItemId),
        normalizeText(input.text, 'Cancelled by operator.'),
        toSerializableRecord(input.metadata),
      );
    } else if (action === 'replace') {
      steering = this.runService.replaceSteering(
        run,
        normalizeText(input.steeringId || input.replaceTargetId || input.queueItemId),
        input,
      );
    } else {
      steering = this.runService.recordSteering(run, input);
    }

    if (!steering) {
      return {
        ok: false,
        action,
        run,
        steering: null,
        ack: null,
        error: action === 'cancel' ? 'steering_not_found' : 'steering_replace_target_not_found',
      };
    }

    this.runs.set(run.id, run);
    this.persistRuns();
    return {
      ok: true,
      action,
      run,
      steering,
      ack: {
        id: steering.ackId,
        runId: run.id,
        steeringId: steering.id,
        status: steering.status,
        createdAt: steering.updatedAt,
      },
      error: null,
    };
  }

  public queryRuns(query: UniversalAgentRunObservatoryQuery = {}): UniversalAgentRunObservatorySnapshot {
    return queryUniversalAgentRuns({
      runs: this.listRuns(200),
      query,
      generatedAt: this.nowIso(),
    });
  }

  private resolveSteeringRun(
    input: Pick<ZavorthAgentGatewaySteerInput, 'runId' | 'sessionId'>,
  ): UniversalAgentRun | null {
    const runId = normalizeText(input.runId);
    if (runId) {
      return this.runs.get(runId) || null;
    }
    const sessionId = normalizeText(input.sessionId);
    const runs = this.listRuns(200);
    if (sessionId) {
      return (
        runs.find((run) => run.sessionId === sessionId && !isTerminalRunStatus(run)) ||
        runs.find((run) => run.sessionId === sessionId) ||
        null
      );
    }
    return runs.find((run) => !isTerminalRunStatus(run)) || runs[0] || null;
  }

  public listWorkflowJobs(limit = 20): UniversalAgentWorkflowJob[] {
    return Array.from(this.workflowJobs.values())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  public buildSnapshot(input: ZavorthAgentGatewaySnapshotOptions = {}): ZavorthAgentGatewaySnapshot {
    const runs = this.listRuns();
    const runObservatory = this.queryRuns({
      runId: input.activeRunId,
      traceId: input.activeTraceId,
      sessionId: input.activeSessionId,
      status: input.runStatus,
      limit: input.runLimit ?? 50,
    });
    const activeRun = input.activeRunId
      ? this.getRun(input.activeRunId)
      : input.activeTraceId || input.runStatus
        ? runObservatory.runs[0]?.run || null
        : input.activeSessionId
          ? runs.find((run) => run.sessionId === input.activeSessionId) || null
          : runs[0] || null;

    const capabilityLoopGovernance = this.resolveCapabilityLoopSnapshot(activeRun);
    return {
      generatedAt: this.nowIso(),
      source: {
        kind: 'universal-agent-runtime',
        label: 'Zavorth Agent Gateway',
      },
      activeRun,
      runs,
      runObservatory,
      capabilityLoopGovernance,
      runtimePromotionGovernance: this.runtimePromotionGovernance.buildSnapshot({
        generatedAt: this.nowIso(),
        activeRun,
        capabilityLoopGovernance,
      }),
      workflowJobs: this.listWorkflowJobs(50),
      workflowQueue: this.workflowQueueStore.describe(),
    };
  }

  private resolveCapabilityLoopSnapshot(run: UniversalAgentRun | null): StrongCapabilityLoopSnapshot | null {
    const candidate = toSerializableRecord(run?.metadata?.capabilityLoopGovernance);
    return candidate.schemaVersion === 1 && candidate.source === 'CapabilityLoopGovernanceService'
      ? (candidate as StrongCapabilityLoopSnapshot)
      : null;
  }

  public findPendingApproval(ref: string): { run: UniversalAgentRun; approval: UniversalApprovalRequest } | null {
    const normalizedRef = String(ref || '').trim();
    if (!normalizedRef) {
      return null;
    }

    for (const run of this.runs.values()) {
      const approval = run.approvals.find(
        (candidate) =>
          candidate.status === 'pending' &&
          (candidate.id === normalizedRef || candidate.runId === normalizedRef || run.id === normalizedRef),
      );
      if (approval) {
        return { run, approval };
      }
    }

    return null;
  }

  private async executeWorkflowJob(
    job: UniversalAgentWorkflowJob,
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    options: AgentRunExecutionOptions,
  ): Promise<UniversalAgentRunResult> {
    const startedAt = this.nowIso();
    if (job.status !== 'running' || job.leaseOwner !== this.workflowWorkerId) {
      job.status = 'running';
      job.attempts += 1;
      job.leaseOwner = this.workflowWorkerId;
      job.leaseExpiresAt = this.addMs(startedAt, this.workflowLeaseMs);
      job.lockedAt = startedAt;
      job.heartbeatAt = startedAt;
    }
    job.updatedAt = startedAt;
    job.lastError = null;
    job.metadata = {
      ...(job.metadata || {}),
      startedAt,
      startedBy: this.workflowWorkerId,
    };
    this.workflowJobs.set(job.id, job);
    this.persistWorkflowJob(job);

    try {
      this.heartbeatWorkflowJob(job.id);
      const result = await this.runService.resumeApprovedRun(run, request, options);
      const completed = result.ok && result.run.status !== 'failed' && result.run.status !== 'cancelled';
      const failureMessage = completed ? null : this.resolveWorkflowFailureMessage(result.run);
      const finishedAt = this.nowIso();
      if (completed) {
        job.status = 'completed';
        job.completedAt = finishedAt;
      } else {
        this.applyWorkflowFailure(job, result.run, failureMessage || 'Executor duravel failed.', finishedAt);
      }
      job.resultRunStatus = result.run.status;
      job.updatedAt = finishedAt;
      job.lastError = failureMessage;
      if (completed) {
        this.clearWorkflowLease(job);
        job.nextRunAt = null;
        job.failedAt = null;
      }
      job.metadata = {
        ...(job.metadata || {}),
        finishedAt: job.updatedAt,
      };
      this.workflowJobs.set(job.id, job);
      this.persistWorkflowJob(job);
      return result;
    } catch (error: unknown) {
      const failedAt = this.nowIso();
      const message = normalizeText(errorMessage(error), 'Durable executor failed to resume execution.');
      this.applyWorkflowFailure(job, run, message, failedAt);
      const retryScheduled = String(job.status) === 'queued';
      run.updatedAt = failedAt;
      this.runService.recordLifecycleDefenseReview(run, 'interrupted', failedAt);
      run.events.push({
        id: `${job.id}:failed`,
        runId: run.id,
        kind: 'error',
        title: retryScheduled ? 'Workflow duravel reagendado' : 'Workflow duravel failed',
        detail: message,
        status: retryScheduled ? 'pending' : 'failed',
        createdAt: failedAt,
        metadata: {
          workflowJobId: job.id,
          nextRunAt: job.nextRunAt || null,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
        },
      });
      this.workflowJobs.set(job.id, job);
      this.persistWorkflowJob(job);
      return {
        ok: false,
        run,
        replies: this.buildReplies(run, message, failedAt),
      };
    }
  }

  private ensureWorkflowJobForWaitingApproval(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): UniversalAgentWorkflowJob | null {
    const approval = run.approvals.find((candidate) => candidate.status === 'pending');
    if (!approval) {
      return null;
    }
    return this.ensureWorkflowJobForApproval(run, request, approval, 'waiting_approval');
  }

  private ensureWorkflowJobForApproval(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    approval: UniversalApprovalRequest,
    status: UniversalAgentWorkflowJob['status'],
  ): UniversalAgentWorkflowJob {
    const existing = this.findWorkflowJob(run.id, approval.id);
    const now = this.nowIso();
    if (existing && !isTerminalWorkflowStatus(existing)) {
      existing.request = this.serializeRequestForWorkflow(request, run);
      existing.status = status;
      existing.updatedAt = now;
      existing.maxAttempts = Math.max(1, existing.maxAttempts || this.workflowMaxAttempts);
      if (status === 'queued') {
        existing.nextRunAt = existing.nextRunAt || now;
      }
      this.workflowJobs.set(existing.id, existing);
      return existing;
    }

    const job: UniversalAgentWorkflowJob = {
      id: `${run.id}:resume:${approval.id}`,
      kind: 'resume_after_approval',
      runId: run.id,
      approvalId: approval.id,
      request: this.serializeRequestForWorkflow(request, run),
      status,
      createdAt: now,
      updatedAt: now,
      attempts: 0,
      maxAttempts: this.workflowMaxAttempts,
      leaseOwner: null,
      leaseExpiresAt: null,
      lockedAt: null,
      heartbeatAt: null,
      nextRunAt: status === 'queued' ? now : null,
      backoffMs: this.workflowBackoffMs,
      completedAt: null,
      failedAt: null,
      cancelledAt: null,
      lastError: null,
      resultRunStatus: run.status,
      metadata: {
        approvalRisk: approval.risk,
        channel: run.channel,
      },
    };
    this.workflowJobs.set(job.id, job);
    return job;
  }

  private findWorkflowJob(runId: string, approvalId: string): UniversalAgentWorkflowJob | null {
    for (const job of this.workflowJobs.values()) {
      if (job.runId === runId && job.approvalId === approvalId) {
        return job;
      }
    }
    return null;
  }

  private extractChannelMeshNormalizedInboundMessage(event: unknown): UniversalAgentRequest | null {
    const gatewayEvent = toSerializableRecord(event);
    if (gatewayEvent.type !== 'public_ws') {
      return null;
    }

    const payload = toSerializableRecord(gatewayEvent.payload);
    const message = toSerializableRecord(payload.payload);
    if (normalizeText(message.topic) !== 'im_message') {
      return null;
    }

    const data = toSerializableRecord(message.data);
    const normalized = toSerializableRecord(data.normalizedInboundMessage);
    return this.isChannelMeshUniversalAgentRequest(normalized) ? normalized : null;
  }

  private isChannelMeshUniversalAgentRequest(input: Record<string, unknown>): input is UniversalAgentRequest {
    const channel = normalizeText(input.channel);
    return (
      normalizeText(input.userId) !== '' &&
      normalizeText(input.sessionId) !== '' &&
      normalizeText(input.text) !== '' &&
      ['web', 'cli', 'telegram', 'api', 'unknown'].includes(channel)
    );
  }

  private decorateChannelMeshRequest(input: UniversalAgentRequest): UniversalAgentRequest {
    return {
      ...input,
      metadata: {
        ...toSerializableRecord(input.metadata),
        channelMeshBridge: {
          source: 'ZavorthAgentGateway.attachChannelMeshEventBus',
          receivedAt: this.nowIso(),
        },
      },
    };
  }

  private serializeRequestForWorkflow(input: UniversalAgentRequest, run: UniversalAgentRun): UniversalAgentRequest {
    return {
      traceId: input.traceId ?? run.traceId,
      requestId: normalizeText(input.requestId, run.requestId),
      userId: normalizeText(input.userId, run.userId),
      sessionId: input.sessionId ?? run.sessionId,
      channel: input.channel || run.channel,
      text: normalizeText(input.text, run.input),
      workspace: input.workspace ?? run.workspace ?? null,
      replyPort: input.replyPort || run.replyPorts[0],
      requestedTools: Array.isArray(input.requestedTools)
        ? [...input.requestedTools]
        : run.toolExposure.tools.map((tool) => tool.id),
      modelProfile: input.modelProfile || run.modelProfile,
      metadata: {
        ...toSerializableRecord(run.metadata),
        ...toSerializableRecord(input.metadata),
      },
    };
  }

  private buildRequestFromRun(run: UniversalAgentRun): UniversalAgentRequest {
    return {
      traceId: run.traceId,
      requestId: run.requestId,
      userId: run.userId,
      sessionId: run.sessionId,
      channel: run.channel,
      text: run.input,
      workspace: run.workspace ?? null,
      replyPort: run.replyPorts[0],
      requestedTools: run.toolExposure.tools.map((tool) => tool.id),
      modelProfile: run.modelProfile,
      metadata: toSerializableRecord(run.metadata),
    };
  }

  private mergeExecutionOptions(
    base: AgentRunExecutionOptions | undefined,
    override: AgentRunExecutionOptions,
  ): AgentRunExecutionOptions {
    const merged: AgentRunExecutionOptions = { ...(base || {}) };
    if ('executor' in override) {
      merged.executor = override.executor;
    }
    return merged;
  }

  private resolveWorkflowFailureMessage(run: UniversalAgentRun): string {
    const failureSemantics = toSerializableRecord(run.metadata?.failureSemantics);
    return normalizeText(failureSemantics.message, normalizeText(run.summary, 'Executor duravel failed.'));
  }

  private buildReplies(run: UniversalAgentRun, text: string, createdAt: string): UniversalReplyPacket[] {
    const port = run.replyPorts[0];
    if (!port) {
      return [];
    }
    return [
      {
        id: `${run.id}:reply:${createdAt}`,
        runId: run.id,
        port,
        text,
        createdAt,
        metadata: {
          channel: port.kind,
          sessionId: run.sessionId,
        },
      },
    ];
  }

  private claimQueuedWorkflowJobs(limit: number): UniversalAgentWorkflowJob[] {
    const now = this.nowIso();
    const claimed = this.workflowQueueStore.claimQueuedJobs({
      workerId: this.workflowWorkerId,
      now,
      leaseMs: this.workflowLeaseMs,
      limit,
    });

    claimed.forEach((job) => this.workflowJobs.set(job.id, job));
    return claimed;
  }

  private releaseExpiredWorkflowLeases(): void {
    const now = this.nowIso();
    const recovered = this.workflowQueueStore.releaseExpiredLeases({ now });
    if (recovered.length > 0) {
      recovered.forEach((job) => this.workflowJobs.set(job.id, job));
    }
  }

  private applyWorkflowFailure(
    job: UniversalAgentWorkflowJob,
    run: UniversalAgentRun,
    message: string,
    failedAt: string,
  ): void {
    const shouldRetry = job.attempts < job.maxAttempts;
    job.updatedAt = failedAt;
    job.lastError = message;
    job.resultRunStatus = shouldRetry ? 'queued' : 'failed';
    job.failedAt = failedAt;
    job.completedAt = null;

    if (shouldRetry) {
      const backoffMs = this.computeBackoffMs(job);
      job.status = 'queued';
      job.backoffMs = backoffMs;
      job.nextRunAt = this.addMs(failedAt, backoffMs);
      this.clearWorkflowLease(job);
      run.status = 'queued';
      run.summary = `Durable workflow failed and was rescheduled: ${message}`;
      return;
    }

    job.status = 'failed';
    job.nextRunAt = null;
    this.clearWorkflowLease(job);
    run.status = 'failed';
    run.summary = message;
  }

  private clearWorkflowLease(job: UniversalAgentWorkflowJob): void {
    job.leaseOwner = null;
    job.leaseExpiresAt = null;
    job.lockedAt = null;
    job.heartbeatAt = null;
  }

  private computeBackoffMs(job: UniversalAgentWorkflowJob): number {
    const exponent = Math.max(0, job.attempts - 1);
    const backoff = this.workflowBackoffMs * 2 ** exponent;
    return Math.min(this.workflowMaxBackoffMs, Math.max(this.workflowBackoffMs, backoff));
  }

  private hydrateRuns(): void {
    for (const run of this.runStore.loadRuns()) {
      this.runs.set(run.id, this.ensureRunTraceId(run));
    }
  }

  private refreshRuns(): void {
    this.runs.clear();
    this.hydrateRuns();
    for (const run of this.inFlightRuns.values()) {
      this.runs.set(run.id, run);
    }
  }

  private hydrateWorkflowJobs(): void {
    for (const job of this.workflowQueueStore.listJobs({ limit: 200 })) {
      this.workflowJobs.set(job.id, job);
    }
  }

  private refreshWorkflowJobs(): void {
    this.workflowJobs.clear();
    this.hydrateWorkflowJobs();
  }

  private persistAll(): void {
    this.persistRuns();
    this.persistWorkflowJobs();
  }

  private persistRuns(): void {
    this.runStore.saveRuns(this.listRuns(200));
  }

  private persistWorkflowJobs(): void {
    if (this.workflowQueueStore.replaceJobs) {
      this.workflowQueueStore.replaceJobs(this.listWorkflowJobs(200));
      return;
    }
    for (const job of this.listWorkflowJobs(200)) {
      this.workflowQueueStore.upsertJob(job);
    }
  }

  private persistWorkflowJob(job: UniversalAgentWorkflowJob): void {
    const persisted = this.workflowQueueStore.upsertJob(job, {
      expectedLeaseOwner: job.leaseOwner || undefined,
    });
    if (persisted) {
      this.workflowJobs.set(persisted.id, persisted);
      return;
    }
    this.persistWorkflowJobs();
  }

  private nowIso(): string {
    return this.now().toISOString();
  }

  private ensureRunTraceId(run: UniversalAgentRun): UniversalAgentRun {
    const existingTraceId = normalizeText(run.traceId);
    if (existingTraceId) {
      return {
        ...run,
        traceId: existingTraceId,
        metadata: withAgentGatewayTraceMetadata(run.metadata, existingTraceId),
      };
    }

    const traceId = resolveAgentGatewayTraceId({
      channel: run.channel || 'unknown',
      requestId: run.requestId || run.id,
      sessionId: run.sessionId || run.id,
      metadata: run.metadata,
    });

    return {
      ...run,
      traceId,
      metadata: withAgentGatewayTraceMetadata(run.metadata, traceId),
    };
  }

  private addMs(value: string, ms: number): string {
    return new Date(this.parseTime(value) + Math.max(1, ms)).toISOString();
  }

  private parseTime(value: unknown): number {
    const time = new Date(String(value || '')).getTime();
    return Number.isFinite(time) ? time : 0;
  }
}
