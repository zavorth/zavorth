import { logger } from '../../logger.js';
import {
  type ExperienceAction,
  type ExperienceCommand,
  type ExperienceCommandResult,
  type ExperienceSnapshot,
} from './ExperienceContracts.js';
import { ZavorthFirstRunHumanOnboardingService } from '../ZavorthFirstRunHumanOnboardingService.js';
import { ZavorthLearningRuntimeHubService } from '../ZavorthLearningRuntimeHubService.js';

import type { ExperienceCoreService } from './ExperienceCoreService.js';

function action(input: {
  id: string;
  label: string;
  kind: ExperienceAction['kind'];
  reason: string;
  command?: string | null;
  route?: string | null;
  risk?: ExperienceAction['risk'];
  requiresApproval?: boolean;
}): ExperienceAction {
  return {
    id: input.id,
    label: input.label,
    kind: input.kind,
    command: input.command ?? null,
    route: input.route ?? null,
    risk: input.risk || 'safe',
    requiresApproval: input.requiresApproval === true,
    reason: input.reason,
  };
}

export class ExperienceContinuitySupport {
  public constructor(private readonly owner: ExperienceCoreService) {}

  public getFirstRunService(
    userId?: string | null,
  ): import('../ZavorthFirstRunHumanOnboardingService.js').ZavorthFirstRunHumanOnboardingService {
    return new ZavorthFirstRunHumanOnboardingService({
      projectRoot: process.cwd(),
      now: () => this.owner.now(),
      userId: userId || null,
    });
  }

  public buildFirstRunSnapshot(userId?: string | null): import('./ExperienceContracts.js').ExperienceFirstRunSnapshot {
    const snap = this.owner.getFirstRunService(userId).buildSnapshot();
    return {
      contractVersion: 'zavorth-first-run-human/1',
      required: snap.required,
      completed: snap.completed,
      currentStep: snap.currentStep,
      headline: snap.headline,
      summary: snap.summary,
      nextPrompt: snap.nextPrompt,
      welcomeLines: snap.welcomeLines,
      steps: snap.steps,
    };
  }

  public buildFirstRunActionCards(
    firstRun: import('./ExperienceContracts.js').ExperienceFirstRunSnapshot,
  ): import('./ExperienceContracts.js').ExperienceActionCard[] {
    if (!firstRun.required) return [];
    const step = firstRun.steps.find((entry) => !entry.done);
    if (!step) return [];
    const now = this.owner.now().toISOString();
    return [
      {
        contractVersion: 'ExperienceActionCard/v1',
        id: `card:first-run:${step.key}`,
        source: 'learning',
        title: `Setup · ${step.title}`,
        summary: step.prompt,
        risk: 'safe',
        status: 'pending',
        scope: 'first-run',
        sandbox: 'not-applicable',
        affectedFiles: [],
        affectedCommands: [],
        ttlSeconds: null,
        receiptHint: `first-run step ${step.id}`,
        createdAt: now,
        actions: step.examples.slice(0, 4).map((example) => ({
          id: `first-run:${step.key}:${example}`,
          label: example,
          kind: 'learning' as const,
          command: example,
          route: null,
          risk: 'safe' as const,
          requiresApproval: false,
          reason: step.prompt,
        })),
      },
    ];
  }

  public buildFirstRunNextActions(
    firstRun: import('./ExperienceContracts.js').ExperienceFirstRunSnapshot,
  ): import('./ExperienceContracts.js').ExperienceAction[] {
    const step = firstRun.steps.find((entry) => !entry.done);
    if (!step) return [];
    return step.examples.slice(0, 3).map((example) => ({
      id: `first-run:${step.key}:${example}`,
      label: example,
      kind: 'learning' as const,
      command: example,
      route: null,
      risk: 'safe' as const,
      requiresApproval: false,
      reason: step.prompt,
    }));
  }

  public tryHandleFirstRunCommand(command: ExperienceCommand): ExperienceCommandResult | null {
    const service = this.owner.getFirstRunService(command.userId);
    const text = String(command.text || '').trim();
    const normalized = text.toLowerCase();
    const explicitSetup =
      normalized === '/start' ||
      normalized === '/setup' ||
      normalized === '/onboarding' ||
      normalized === '/setup reset' ||
      normalized === '/setup skip';

    if (!explicitSetup) {
      // Free text belongs to the agent path; do not steal for wizard answers.
      return null;
    }

    if (normalized === '/setup reset') {
      const snapshotState = service.reset();
      const snapshot = this.owner.buildHome(command);
      return {
        ok: true,
        handled: true,
        plan: {
          kind: 'status',
          title: 'First run',
          summary: snapshotState.headline,
          nextSafeAction: 'Use buttons or /start lang=en surface=telegram learn=yes',
        } as any,
        snapshot,
        replies: [
          this.owner.replyFromText(
            [
              ...snapshotState.welcomeLines,
              '',
              'Use /start buttons (or structured /start args). Free text goes to the agent.',
            ].join('\n'),
            command,
            snapshot.agent.activeRunId,
          ),
        ],
        receipts: snapshot.receipts,
        error: null,
      };
    }

    if (normalized === '/setup skip') {
      const done = service.complete({
        language: service.buildSnapshot().state.language || 'en',
        surface: service.buildSnapshot().state.surface || 'desktop',
        allowLearning: service.buildSnapshot().state.allowLearning ?? true,
      });
      const snapshot = this.owner.buildHome(command);
      return {
        ok: true,
        handled: true,
        plan: {
          kind: 'status',
          title: 'First run',
          summary: done.summary,
          nextSafeAction: null,
        } as any,
        snapshot,
        replies: [this.owner.replyFromText(done.summary, command, snapshot.agent.activeRunId)],
        receipts: snapshot.receipts,
        error: null,
      };
    }

    // Status / open setup card only — never answer() free-text wizard steps here.
    const snap = service.buildSnapshot();
    const snapshot = this.owner.buildHome(command);
    const lines = [
      ...snap.welcomeLines,
      '',
      'agent-first: finish setup with /start buttons or structured args.',
      'Examples: /start setup · /start skip · /start lang=en surface=telegram learn=yes',
      'Free text is handled by the agent.',
    ];
    return {
      ok: true,
      handled: true,
      plan: {
        kind: 'status',
        title: 'First run',
        summary: snap.headline,
        nextSafeAction: snap.nextPrompt || 'Use /start buttons',
      } as any,
      snapshot,
      replies: [this.owner.replyFromText(lines.join('\n'), command, snapshot.agent.activeRunId)],
      receipts: snapshot.receipts,
      error: null,
    };
  }

  public listLearnedRuntimeItems(
    userId?: string | null,
  ): Array<{ id: string; title: string; summary: string; kind: string }> {
    try {
      return new ZavorthLearningRuntimeHubService({ projectRoot: process.cwd(), userId: userId || null })
        .listLearned()
        .slice(0, 8)
        .map((item) => ({
          id: item.id,
          title: item.title,
          summary: item.summary,
          kind: item.kind,
        }));
    } catch (error: unknown) {
      logger.warn('[ExperienceCore] listLearnedRuntimeItems failed:', error);
      return [];
    }
  }

  public undoLearnedRuntimeItem(id: string, userId?: string | null): { ok: boolean; summary: string } {
    try {
      return new ZavorthLearningRuntimeHubService({ projectRoot: process.cwd(), userId: userId || null }).undo(id);
    } catch (error: unknown) {
      logger.warn('[ExperienceCore] undoLearnedRuntimeItem failed:', error);
      return { ok: false, summary: 'Could not undo learning right now.' };
    }
  }

  public workboardProjectionFromRuntimeState(
    runtimeState: ZavorthRuntimeStateBusSnapshot | null,
  ): Record<string, unknown> | null {
    if (!runtimeState) return null;
    const fromProjection = runtimeState.projections?.workboard || null;
    const fromState = runtimeState.state?.workboard || null;
    const workboard = fromProjection || fromState;
    if (!workboard) return null;
    // Only surface when there is something useful to render (tasks, sessions, or boards).
    const hasContent = Boolean(
      (Array.isArray(workboard.tasks) && workboard.tasks.length > 0) ||
        (Array.isArray(workboard.sessions) && workboard.sessions.length > 0) ||
        (Array.isArray(workboard.boards) && workboard.boards.length > 0),
    );
    return hasContent ? (workboard as unknown as Record<string, unknown>) : null;
  }

  public safeRuntimeStateSync(command: ExperienceCommand): ZavorthRuntimeStateBusSnapshot | null {
    try {
      return (
        this.owner.runtimeStateBus?.syncExperienceCommand({
          surface: command.surface,
          userId: command.userId,
          sessionId: command.sessionId || null,
          workspace: command.workspace || null,
          text: command.text,
          responseProfile: command.responseProfile || null,
          metadata: command.metadata || {},
        }) || null
      );
    } catch (error: unknown) {
      logger.warn('[ExperienceCore] safeRuntimeStateSync failed, falling back to snapshot:', error);
      return this.owner.safeRuntimeStateSnapshot();
    }
  }

  public workspacePathFromRuntimeState(runtimeState: ZavorthRuntimeStateBusSnapshot | null): string | null {
    const workspace = runtimeState?.state.workspace || null;
    if (!workspace?.path) {
      return null;
    }
    if (workspace.kind === 'folder' || workspace.kind === 'project' || workspace.kind === 'zavorth') {
      return workspace.path;
    }
    return null;
  }

  public modelProfileFromRuntimeState(
    runtimeState: ZavorthRuntimeStateBusSnapshot | null,
  ): Partial<UniversalAgentModelProfile> | undefined {
    const model = runtimeState?.state.model || null;
    if (!model?.id || model.connected !== true) {
      return undefined;
    }
    return {
      providerLabel: model.provider,
      modelLabel: model.label,
      routingPolicy: 'gateway',
      routeId: model.id,
      familyId: model.provider,
      ready: true,
      selectionExplanation: [`Runtime state selected ${model.label} from ${model.source || 'runtime'}.`],
    };
  }

  public buildNativeAutonomySpineProjection(spine: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!spine) {
      return null;
    }
    const learning = recordOrNull(spine.learning);
    const skillForge = recordOrNull(spine.skillForge);
    const dynamicMission = recordOrNull(spine.dynamicMission);
    const dynamicMissionWorkflow = recordOrNull(dynamicMission?.workflow);
    const dynamicMissionApproval = recordOrNull(dynamicMission?.approval);
    const dreamCycle = recordOrNull(spine.dreamCycle);
    const dreamCandidateStore = recordOrNull(dreamCycle?.candidateStore);
    const channel = recordOrNull(spine.channel);
    const backend = recordOrNull(spine.backend);
    const reviewCenter = recordOrNull(spine.reviewCenter);
    const safety = recordOrNull(spine.safety);
    const summary = recordOrNull(spine.summary);
    const channelReadiness = recordOrNull(channel?.readiness);
    const backendReadiness = recordOrNull(backend?.readiness);

    return {
      version: normalizeText(spine.version, 'native-autonomy-spine/v1'),
      generatedAt: normalizeText(spine.generatedAt),
      status: normalizeText(spine.status, 'attention'),
      stages: Array.isArray(spine.stages)
        ? spine.stages
            .map((stage) => {
              const record = recordOrNull(stage);
              return {
                id: normalizeText(record?.id),
                status: normalizeText(record?.status, 'attention'),
                summary: normalizeText(record?.summary),
              };
            })
            .filter((stage) => stage.id)
        : [],
      learningCandidates: Array.isArray(learning?.candidates) ? learning.candidates.length : 0,
      skillDrafts: Array.isArray(skillForge?.drafts) ? skillForge.drafts.length : 0,
      dynamicMissionTasks: Array.isArray(dynamicMissionWorkflow?.tasks) ? dynamicMissionWorkflow.tasks.length : 0,
      dynamicMissionApprovalRequired: dynamicMissionApproval?.required === true,
      dreamCandidateMemories: Array.isArray(dreamCandidateStore?.memories) ? dreamCandidateStore.memories.length : 0,
      dreamQuarantineItems: Array.isArray(dreamCycle?.quarantine) ? dreamCycle.quarantine.length : 0,
      channel: channel
        ? {
            liveReady: channelReadiness?.liveReady === true,
            defaultRouteAllowed: channelReadiness?.defaultRouteAllowed === true,
          }
        : null,
      backend: backend
        ? {
            liveReady: backendReadiness?.liveReady === true,
            liveMutationAllowed: backendReadiness?.liveMutationAllowed === true,
          }
        : null,
      summary: summary
        ? {
            organicLearningReady: summary.organicLearningReady === true,
            skillForgeReady: summary.skillForgeReady === true,
            dynamicMissionReady: summary.dynamicMissionReady === true,
            dreamCycleReady: summary.dreamCycleReady === true,
            liveChannelReady: summary.liveChannelReady === true,
            backendProviderReady: summary.backendProviderReady === true,
          }
        : null,
      reviewActions: Array.isArray(reviewCenter?.actions)
        ? reviewCenter.actions
            .map((entry) => normalizeText(entry))
            .filter(Boolean)
            .slice(0, 8)
        : [],
      receiptCount: Array.isArray(reviewCenter?.receipts) ? reviewCenter.receipts.length : 0,
      quietLanes: reviewCenter?.quietLanes === true,
      rawSecretsSerialized: safety?.rawSecretsSerialized === false ? false : null,
    };
  }

  public mergeLearningCandidates(
    primary: ExperienceLearningCandidate[],
    secondary: ExperienceLearningCandidate[],
  ): ExperienceLearningCandidate[] {
    const seen = new Set<string>();
    return [...secondary, ...primary].filter((candidate) => {
      if (seen.has(candidate.id)) return false;
      seen.add(candidate.id);
      return true;
    });
  }

  public buildChat(activeRun: UniversalAgentRun | null, runs: UniversalAgentRun[]) {
    const sourceRuns = activeRun ? [activeRun] : runs.slice(0, 4);
    return sourceRuns
      .flatMap((run) => {
        const user = {
          id: `input:${run.id}`,
          role: 'user' as const,
          text: run.input,
          createdAt: run.createdAt,
          runId: run.id,
        };
        const assistant = {
          id: `summary:${run.id}`,
          role: 'assistant' as const,
          text: run.summary || run.title,
          createdAt: run.updatedAt,
          runId: run.id,
        };
        return [user, assistant];
      })
      .slice(-12);
  }

  public toExperienceApproval(approval: UniversalApprovalRequest): ExperienceApproval {
    return {
      id: approval.id,
      runId: approval.runId,
      title: approval.title,
      reason: approval.reason,
      summary: approval.reason,
      risk: approval.risk,
      status: approval.status,
      createdAt: approval.createdAt,
      actions: [
        action({
          id: `approve:${approval.id}`,
          label: 'Approve',
          kind: 'approval',
          command: `zavorth approve ${approval.id}`,
          risk: approval.risk,
          reason: 'Allows the governed action to continue.',
        }),
        action({
          id: `reject:${approval.id}`,
          label: 'Reject',
          kind: 'approval',
          command: `zavorth reject ${approval.id}`,
          risk: approval.risk,
          reason: 'Keeps the action blocked.',
        }),
      ],
      surfaceProjection: this.owner.buildDesktopApprovalSurfaceProjection(approval),
    };
  }

  public buildDesktopApprovalSurfaceProjection(
    approval: UniversalApprovalRequest,
  ): ExperienceApprovalSurfaceProjection {
    try {
      const response = buildAgentPermissionApprovalResponse({
        approvalId: approval.id,
        title: approval.title,
        summary: approval.reason,
        riskLabel: String(approval.risk || ''),
      });
      const projected = projectResponseForChannel('desktop', response);
      const opts = (projected.replyOptions || {}) as Record<string, unknown>;
      const shortcuts = Array.isArray(opts.shortcuts) ? opts.shortcuts : undefined;
      const copyTargets = Array.isArray(opts.copyTargets) ? opts.copyTargets : undefined;
      const openReceipt =
        opts.openReceipt && typeof opts.openReceipt === 'object'
          ? (opts.openReceipt as ExperienceApprovalSurfaceProjection['openReceipt'])
          : null;
      if (shortcuts && shortcuts.length > 0) {
        return {
          shortcuts: shortcuts as ExperienceApprovalSurfaceProjection['shortcuts'],
          copyTargets: copyTargets as ExperienceApprovalSurfaceProjection['copyTargets'],
          openReceipt,
          surfaceActions: Array.isArray(opts.surfaceActions) ? opts.surfaceActions : undefined,
          keyboardShortcuts: opts.keyboardShortcuts !== false,
        };
      }
    } catch (error: unknown) {
      logger.debug('experience.approval.surface_projection_failed', {
        approvalId: approval.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      shortcuts: [
        { key: '1', choice: 'once', label: 'Run once' },
        { key: '2', choice: 'session', label: 'Session' },
        { key: '3', choice: 'always', label: 'Always' },
        { key: '4', choice: 'deny', label: 'Deny' },
      ],
      copyTargets: [{ id: 'approvalId', label: 'Copy approval id', value: approval.id }],
      keyboardShortcuts: true,
    };
  }

  public buildHealth(
    agentSnapshot: ZavorthAgentGatewaySnapshot | null,
    pendingLearning: number,
    approvals: UniversalApprovalRequest[],
  ): ExperienceSnapshot['health'] {
    const pendingApprovals = approvals.filter((approval) => approval.status === 'pending').length;
    const warnings: string[] = [];
    if (!agentSnapshot) warnings.push('Agent Gateway is not connected to this surface.');
    if (pendingApprovals > 0) warnings.push(`${pendingApprovals} pending approval(s).`);
    if (pendingLearning > 0) warnings.push(`${pendingLearning} learning item(s) waiting for review.`);
    const status: ExperienceHealthStatus = !agentSnapshot ? 'attention' : pendingApprovals > 0 ? 'attention' : 'ready';
    return {
      status,
      summary:
        warnings.length > 0
          ? warnings[0]
          : 'Zavorth is ready for natural language, approvals, receipts, and governed learning.',
      warnings,
    };
  }

  public buildNextActions(
    status: ExperienceHealthStatus,
    pendingApprovals: number,
    pendingLearning: number,
  ): ExperienceAction[] {
    const actions: ExperienceAction[] = [
      action({
        id: 'natural.ask',
        label: 'Ask Zavorth something',
        kind: 'natural',
        command: 'zavorth ask "<request>"',
        reason: 'Primary natural-first entry.',
      }),
      action({
        id: 'zavorthControl.open',
        label: 'Open ZavorthControl',
        kind: 'navigation',
        command: 'zavorth open',
        route: '/zavorthControl',
        reason: 'Official visual surface.',
      }),
    ];
    if (pendingApprovals > 0 || status === 'attention') {
      actions.push(
        action({
          id: 'approvals.review',
          label: 'Review approvals',
          kind: 'approval',
          command: 'zavorth approve',
          risk: 'attention',
          reason: 'Resolves governed blocks.',
        }),
      );
    }
    if (pendingLearning > 0) {
      actions.push(
        action({
          id: 'learning.review',
          label: 'Review learning',
          kind: 'learning',
          command: 'zavorth learn',
          reason: 'Promotes only approved patterns.',
        }),
      );
    }
    return actions;
  }
}
