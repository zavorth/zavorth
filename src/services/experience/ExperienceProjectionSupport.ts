import { ActionCardService } from './ActionCardService.js';
import { defaultZavorthSpeculativeAutonomyCancellationRegistry } from '../../autonomy/ZavorthSpeculativeAutonomyService.js';
import { ZavorthRuntimeStateBusService } from '../ZavorthRuntimeStateBusService.js';
import {
  ZavorthRuntimeCapabilitiesService,
  type ZavorthRuntimeCapabilitiesSnapshot,
} from '../ZavorthRuntimeCapabilitiesService.js';
import {
  ZavorthRuntimeOperationalSpineService,
  type ZavorthRuntimeOperationalSpineSyncInput,
  type ZavorthRuntimeOperationalSpineSyncResult,
} from '../ZavorthRuntimeOperationalSpineService.js';
import { ZavorthRuntimeSecureIntegrationService } from '../ZavorthRuntimeSecureIntegrationService.js';

import { logger } from '../../logger.js';
import { tService } from '../../i18n/services.js';
import {
  EXPERIENCE_COMMAND_CONTRACT_VERSION,
  EXPERIENCE_ACTION_CARD_CONTRACT_VERSION,
  EXPERIENCE_SNAPSHOT_CONTRACT_VERSION,
  LEARNING_CANDIDATE_CONTRACT_VERSION,
  type ExperienceAction,
  type ExperienceActionCard,
  type ExperienceApproval,
  type ExperienceApprovalSurfaceProjection,
  type ExperienceCommand,
  type ExperienceCommandResult,
  type ExperienceHealthStatus,
  type ExperienceLearningCandidate,
  type ExperienceMemorySignal,
  type ExperienceReceipt,
  type ExperienceResponseProfileId,
  type ExperienceSnapshot,
  type ExperienceSurface,
  type ExperienceTimelineItem,
} from './ExperienceContracts.js';
import { projectResponseForChannel } from '../../domain/surface/application/surface-projection/projectors/SurfaceProjectorRegistry.js';
import { buildAgentPermissionApprovalResponse } from '../permission/AgentPermissionApprovalPresentation.js';

import { AutoHealingProjectionService } from './AutoHealingProjectionService.js';
import { ContextRecoveryService } from './ContextRecoveryService.js';
import { PulseBriefService } from './PulseBriefService.js';
import { DiffReviewService } from './DiffReviewService.js';
import { ExecutionGraphService } from './ExecutionGraphService.js';
import { JourneyEngineService } from './JourneyEngineService.js';
import { LearningOSService } from './LearningOSService.js';
import { NaturalCommandRouterService } from './NaturalCommandRouterService.js';
import { ReasoningSummaryService } from './ReasoningSummaryService.js';
import { ResponseProfilePreferenceService } from './ResponseProfilePreferenceService.js';
import { TrustLensService } from './TrustLensService.js';
import type {
  UniversalAgentModelProfile,
  UniversalAgentRun,
  UniversalAgentRunResult,
  UniversalApprovalRequest,
} from '../../runtime/agent/UniversalAgentRuntimeTypes.js';
import type {
  ZavorthAgentGateway,
  ZavorthAgentGatewaySnapshot,
  ZavorthAgentGatewaySnapshotOptions,
} from '../../runtime/agent/ZavorthAgentGateway.js';

import { ZavorthProviderReadinessMatrixService } from '../ZavorthProviderReadinessMatrixService.js';
import { ZavorthSelfHealingUxService } from '../ZavorthSelfHealingUxService.js';
import {
  ZavorthSelfHealingReceiptService,
  type ZavorthSelfHealingReceipt,
} from '../ZavorthSelfHealingReceiptService.js';
import type { ZavorthMemoryPlaneService } from '../ZavorthMemoryPlaneService.js';
import type { ZavorthLearningPlaneService } from '../ZavorthLearningPlaneService.js';
import type { RuntimeAccessReadinessService } from '../../runtime/access/RuntimeAccessReadinessService.js';
import type {
  ZavorthSelfHealingAction,
  ZavorthSelfHealingProjection,
} from '../../contracts/ZavorthSelfHealingUxContract.js';
import type { ZavorthLlmBrainSnapshot } from '../../contracts/ZavorthLlmBrainContract.js';
import type { UniversalAgentRequest } from '../../runtime/agent/UniversalAgentRuntimeTypes.js';
import { ZavorthAgentMaturityService, type ZavorthAgentMaturitySnapshot } from '../ZavorthAgentMaturityService.js';

import type {
  ZavorthRuntimeStateBusActionInput,
  ZavorthRuntimeStateBusDispatchResult,
  ZavorthRuntimeStateBusSnapshot,
} from '../../contracts/ZavorthRuntimeStateBusContract.js';
import { asErrorLike, errorMessage } from '../../utils/errorLike.js';
type AgentGatewayLike = Pick<ZavorthAgentGateway, 'handle' | 'buildSnapshot' | 'approve' | 'reject'>;

import type { ExperienceCoreService } from './ExperienceCoreService.js';

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function isLiveRunStatus(status: unknown): boolean {
  return status === 'queued' || status === 'thinking' || status === 'running' || status === 'waiting_approval';
}

function isLiveWorkflowJobStatus(status: unknown): boolean {
  return status === 'waiting_approval' || status === 'queued' || status === 'running';
}

function inferRequestedTimeZone(_text: string): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function isSimpleDateTimeQuestion(_text: string): boolean {
  return false;
}

function buildLocalDateTimeAnswer(text: string, now: Date): string | null {
  if (!isSimpleDateTimeQuestion(text)) return null;
  const timeZone = inferRequestedTimeZone(text);
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    }).format(now);
    return `It is now ${formatted} in ${timeZone}.`;
  } catch (error: unknown) {
    logger.warn(`[ExperienceCore] Intl.DateTimeFormat failed for timezone ${timeZone}:`, error);
    return `It is now ${now.toLocaleString('en-US')} in the system local timezone.`;
  }
}

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

export class ExperienceProjectionSupport {
  public constructor(private readonly owner: ExperienceCoreService) {}

  public collectApprovals(runs: UniversalAgentRun[]): UniversalApprovalRequest[] {
    return runs.flatMap((run) => run.approvals).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  public buildTimeline(activeRun: UniversalAgentRun | null, runs: UniversalAgentRun[]): ExperienceTimelineItem[] {
    const sourceRuns = activeRun ? [activeRun] : runs.slice(0, 3);
    const items: ExperienceTimelineItem[] = sourceRuns.flatMap((run) =>
      run.events.map((event) => ({
        id: event.id,
        runId: run.id,
        title: event.title,
        detail: event.detail || run.summary || event.kind,
        status: event.status === 'failed' ? ('failed' as const) : event.status,
        kind: this.owner.timelineKind(event.kind),
        createdAt: event.createdAt,
      })),
    );
    return items.sort((left, right) => left.createdAt.localeCompare(right.createdAt)).slice(-20);
  }

  public timelineKind(kind: string): ExperienceTimelineItem['kind'] {
    if (kind === 'input') return 'intent';
    if (kind === 'planning') return 'planning';
    if (kind === 'tool') return 'tool';
    if (kind === 'approval') return 'approval';
    if (kind === 'memory') return 'memory';
    if (kind === 'reply') return 'reply';
    if (kind === 'artifact') return 'receipt';
    return 'status';
  }

  public buildReceipts(
    activeRun: UniversalAgentRun | null,
    runs: UniversalAgentRun[],
    approvals: UniversalApprovalRequest[],
  ): ExperienceReceipt[] {
    const sourceRuns = activeRun ? [activeRun] : runs.slice(0, 4);
    const runReceipts = sourceRuns.map((run) => ({
      id: `run:${run.id}`,
      title: run.title,
      detail: run.summary || `Status: ${run.status}`,
      status:
        run.status === 'failed'
          ? ('failed' as const)
          : run.status === 'waiting_approval'
            ? ('pending' as const)
            : run.status === 'completed'
              ? ('ready' as const)
              : ('pending' as const),
      source: 'run' as const,
      createdAt: run.updatedAt,
    }));
    const approvalReceipts = approvals.slice(0, 6).map((approval) => ({
      id: `approval:${approval.id}`,
      title: approval.title,
      detail: approval.reason,
      status: approval.status === 'pending' ? ('pending' as const) : ('ready' as const),
      source: 'approval' as const,
      createdAt: approval.createdAt,
    }));
    return [...runReceipts, ...approvalReceipts]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 12);
  }

  public buildMemorySignals(activeRun: UniversalAgentRun | null, workspace: string | null): ExperienceMemorySignal[] {
    const runSignals = (activeRun?.memorySignals || []).map((signal) => ({
      id: signal.id,
      title: signal.title,
      summary: signal.summary,
      layer: signal.layer,
      confidence: signal.confidence ?? null,
    }));
    if (runSignals.length > 0) return runSignals.slice(0, 8);

    try {
      const snapshot = this.owner.memoryPlane?.buildSnapshot({ workspaceHint: workspace || undefined });
      const record = recordOrNull(snapshot);
      const summary = recordOrNull(record?.summary);
      const artifacts = Number(summary?.artifacts || summary?.memoryArtifacts || 0);
      if (artifacts > 0) {
        return [
          {
            id: 'memory-plane:artifacts',
            title: 'Memory Plane',
            summary: `${artifacts} memory artifact(s) available for governed recall.`,
            layer: 'semantic',
            confidence: 0.7,
          },
        ];
      }
    } catch (error: unknown) {
      logger.warn('[ExperienceCore] buildMemorySignals memoryPlane fallback failed:', error);
    }
    return [];
  }

  public buildLlmBrainLearningCandidates(
    activeRun: UniversalAgentRun | null,
    llmBrain: ZavorthLlmBrainSnapshot | null,
  ): ExperienceLearningCandidate[] {
    if (!activeRun || !llmBrain) return [];
    const signal = llmBrain.skillEvolution;
    if (signal.status === 'needs-more-signal') return [];
    const quarantined = signal.status === 'quarantined';
    return [
      {
        contractVersion: LEARNING_CANDIDATE_CONTRACT_VERSION,
        id: `llm-brain:${activeRun.id}`,
        title:
          signal.candidateKind === 'skill-improvement'
            ? 'Skill improvement signal'
            : signal.candidateKind === 'auto-skill'
              ? 'Reusable skill signal'
              : 'Procedure learning signal',
        origin: 'llm-brain',
        observedPattern: signal.summary,
        recommendation: quarantined ? 'Keep quarantined. Learning cannot alter security policy, approvals, sandbox, effect boundary or allowlists.'
          : 'Review this run as a possible reusable skill, Mnemos procedure or nudge before promoting behavior.',
        confidence: quarantined ? 0.2 : 0.82,
        impact: quarantined ? 'Does not alter behavior.'
          : 'Can improve future routing, procedures or skill suggestions only after approval.',
        dataUsed: [
          llmBrain.summary,
          `tools requested=${llmBrain.toolAgency.requested} executed=${llmBrain.toolAgency.executed}`,
          `session=${llmBrain.session.sessionId}`,
        ],
        suggestedAction: signal.suggestedCommand || 'zavorth learn',
        state: quarantined ? 'quarantined' : 'pending',
        createdAt: llmBrain.generatedAt,
        updatedAt: llmBrain.generatedAt,
      },
    ];
  }

  public safeRuntimeStateSnapshot(): ZavorthRuntimeStateBusSnapshot | null {
    try {
      return this.owner.runtimeStateBus?.buildSnapshot() || null;
    } catch (error: unknown) {
      logger.warn('[ExperienceCore] safeRuntimeStateSnapshot failed:', error);
      return null;
    }
  }

  public buildReachSnapshot(): import('./ExperienceContracts.js').ExperienceReachSnapshot {
    try {
      const { ZavorthHumanReachService } =
        require('../ZavorthHumanReachService.js') as typeof import('../ZavorthHumanReachService.js');
      const snap = new ZavorthHumanReachService({ projectRoot: process.cwd() }).buildSnapshot();
      return {
        contractVersion: 'zavorth-human-reach/1',
        headline: snap.headline,
        summary: snap.summary,
        preferredPathId: snap.preferredPathId,
        stableReadyCount: snap.stableReadyCount,
        paths: snap.paths.map((pathItem) => ({
          id: pathItem.id,
          title: pathItem.title,
          summary: pathItem.summary,
          statusLabel: pathItem.statusLabel,
          ready: pathItem.ready,
          stable: pathItem.stable,
          recommended: pathItem.recommended,
          howToStart: pathItem.howToStart,
          nextStep: pathItem.nextStep,
          productTier: pathItem.productTier,
        })),
      };
    } catch (error: unknown) {
      logger.warn('[ExperienceCore] buildReachSnapshot failed:', error);
      return {
        contractVersion: 'zavorth-human-reach/1',
        headline: 'Where you can reach me',
        summary: 'Channel catalog unavailable right now.',
        preferredPathId: null,
        stableReadyCount: 0,
        paths: [],
      };
    }
  }

  public tryHandleReachCommand(command: ExperienceCommand): ExperienceCommandResult | null {
    try {
      const { ZavorthHumanReachService } =
        require('../ZavorthHumanReachService.js') as typeof import('../ZavorthHumanReachService.js');
      const service = new ZavorthHumanReachService({ projectRoot: process.cwd() });
      const matched = service.matchNaturalCommand(command.text);
      if (!matched) return null;
      const snapshot = this.owner.buildHome(command);
      const text =
        matched.kind === 'list'
          ? service.formatDigestLines().join('\n')
          : service.formatPathGuide(matched.pathId || 'telegram').join('\n');
      return {
        ok: true,
        handled: true,
        plan: {
          kind: 'status',
          title: 'Where to find me',
          summary: snapshot.reach?.summary || 'Reach paths',
          nextSafeAction: matched.kind === 'list' ? 'Ask for a telegram guide if you want to set up the phone.' : null,
        } as any,
        snapshot,
        replies: [this.owner.replyFromText(text, command, snapshot.agent.activeRunId)],
        receipts: snapshot.receipts,
        error: null,
      };
    } catch (error: unknown) {
      logger.warn('[ExperienceCore] tryHandleReachCommand failed:', error);
      return null;
    }
  }

  public buildSuperpowersSnapshot(
    userId?: string | null,
  ): import('./ExperienceContracts.js').ExperienceSuperpowersSnapshot {
    try {
      const { ZavorthHumanSuperpowersService } =
        require('../ZavorthHumanSuperpowersService.js') as typeof import('../ZavorthHumanSuperpowersService.js');
      const snap = new ZavorthHumanSuperpowersService({
        projectRoot: process.cwd(),
        userId: userId || null,
      }).buildSnapshot();
      return {
        contractVersion: 'zavorth-human-superpowers/1',
        headline: snap.headline,
        summary: snap.summary,
        readyCount: snap.readyCount,
        learnedCount: snap.learnedCount,
        powers: snap.powers.slice(0, 16).map((power) => ({
          id: power.id,
          title: power.title,
          summary: power.summary,
          howToAsk: power.howToAsk,
          examples: power.examples,
          trustLabel: power.trustLabel,
          ready: power.ready,
          nextStep: power.nextStep,
        })),
      };
    } catch (error: unknown) {
      logger.warn('[ExperienceCore] buildSuperpowersSnapshot failed:', error);
      return {
        contractVersion: 'zavorth-human-superpowers/1',
        headline: 'What I can do for you',
        summary: 'Catalog unavailable right now.',
        readyCount: 0,
        learnedCount: 0,
        powers: [],
      };
    }
  }

  public tryHandleSuperpowersCommand(command: ExperienceCommand): ExperienceCommandResult | null {
    try {
      const { ZavorthHumanSuperpowersService } =
        require('../ZavorthHumanSuperpowersService.js') as typeof import('../ZavorthHumanSuperpowersService.js');
      const service = new ZavorthHumanSuperpowersService({ projectRoot: process.cwd() });
      const matched = service.matchNaturalCommand(command.text);
      if (!matched) return null;
      const snapshot = this.owner.buildHome(command);
      if (matched.kind === 'list') {
        const text = service.formatDigestLines().join('\n');
        return {
          ok: true,
          handled: true,
          plan: {
            kind: 'status',
            title: 'Superpowers',
            summary: snapshot.superpowers?.summary || 'Human capability catalog.',
            nextSafeAction: 'Ask for a capability in plain language.',
          } as any,
          snapshot,
          replies: [this.owner.replyFromText(text, command, snapshot.agent.activeRunId)],
          receipts: snapshot.receipts,
          error: null,
        };
      }
      const found = service.findByNeed(matched.query || command.text);
      const lines = found.length
        ? [
            `For "${matched.query}", this helps:`,
            ...found
              .slice(0, 5)
              .map(
                (power) =>
                  `• ${power.title} — ${power.howToAsk}${power.ready ? '' : ` (${power.nextStep || 'needs setup'})`}`,
              ),
            'You can ask directly, without a technical command.',
          ]
        : ['I could not match a clear superpower. Ask "what can you do..." (or "o que you sabe fazer...") for the list.'];
      return {
        ok: true,
        handled: true,
        plan: {
          kind: 'status',
          title: 'Superpowers',
          summary: `Suggestions for: ${matched.query}`,
          nextSafeAction: found[0]?.howToAsk || null,
        } as any,
        snapshot,
        replies: [this.owner.replyFromText(lines.join('\n'), command, snapshot.agent.activeRunId)],
        receipts: snapshot.receipts,
        error: null,
      };
    } catch (error: unknown) {
      logger.warn('[ExperienceCore] tryHandleSuperpowersCommand failed:', error);
      return null;
    }
  }
}
