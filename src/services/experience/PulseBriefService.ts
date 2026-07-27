import {
  EXPERIENCE_PULSE_BRIEF_CONTRACT_VERSION,
  EXPERIENCE_RESPONSE_PROFILE_CONTRACT_VERSION,
  type ExperienceAction,
  type ExperienceActionCard,
  type ExperiencePulseBrief,
  type ExperienceHealthStatus,
  type ExperienceLearningCandidate,
  type ExperienceReceipt,
  type ExperienceResponseProfile,
  type ExperienceResponseProfileId,
  type ExperienceSurface,
  type ExperienceTrustLens,
} from './ExperienceContracts.js';
import type { UniversalAgentRun, UniversalApprovalRequest } from '../../runtime/agent/UniversalAgentRuntimeTypes.js';
import { tService } from '../../i18n/services.js';

export type PulseBriefBuildInput = {
  surface: ExperienceSurface;
  generatedAt: string;
  workspace: string | null;
  activeRun: UniversalAgentRun | null;
  runs: UniversalAgentRun[];
  approvals: UniversalApprovalRequest[];
  learningCandidates: ExperienceLearningCandidate[];
  learningPending: number;
  learningSummary: string;
  receipts: ExperienceReceipt[];
  nextActions: ExperienceAction[];
  actionCards: ExperienceActionCard[];
  health: {
    status: ExperienceHealthStatus;
    summary: string;
    warnings: string[];
  };
  trust: ExperienceTrustLens;
  requestedProfile?: ExperienceResponseProfileId | null;
};

function clean(value: unknown, fallback = ''): string {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  return text || fallback;
}

function compactList(items: string[], limit: number): string[] {
  return items
    .map((item) => clean(item))
    .filter(Boolean)
    .slice(0, limit);
}

export class PulseBriefService {
  public build(input: PulseBriefBuildInput): ExperiencePulseBrief {
    const profile = this.resolveProfile({
      surface: input.surface,
      activeRun: input.activeRun,
      requestedProfile: input.requestedProfile || null,
    });
    const pendingApprovals = input.approvals.filter((approval) => approval.status === 'pending').length;
    const lastRun = input.activeRun || input.runs[0] || null;
    const activeTask = input.activeRun?.title || input.activeRun?.input || null;
    const bestNextAction = this.pickBestNextAction(input, pendingApprovals);
    const highlights = compactList(
      [
        activeTask ? tService('pulse.active_task', { task: activeTask }) : '',
        lastRun?.summary ? tService('pulse.last_activity', { activity: lastRun.summary }) : '',
        input.workspace ? tService('pulse.workspace', { workspace: input.workspace }) : '',
        input.trust.sandbox.mode ? tService('pulse.sandbox', { mode: input.trust.sandbox.mode }) : '',
        profile.summary,
      ],
      5,
    );
    const risks = compactList(
      [
        ...input.health.warnings,
        pendingApprovals > 0 ? tService('pulse.approvals_pending', { count: String(pendingApprovals) }) : '',
        input.trust.risk !== 'safe' ? tService('pulse.trust_risk', { risk: input.trust.risk }) : '',
        input.actionCards.some((card) => card.risk === 'danger') ? tService('pulse.high_risk_action_card') : '',
      ],
      5,
    );

    return {
      contractVersion: EXPERIENCE_PULSE_BRIEF_CONTRACT_VERSION,
      headline: this.headline(input.health.status, pendingApprovals, input.learningPending, activeTask),
      summary: this.summary(input, pendingApprovals, profile),
      lastActivity: lastRun?.updatedAt || lastRun?.createdAt || null,
      activeTask,
      bestNextAction,
      pending: {
        approvals: pendingApprovals,
        learning: input.learningPending,
        receipts: input.receipts.length,
      },
      highlights,
      risks,
      learning: {
        summary: input.learningSummary,
        pending: input.learningPending,
      },
      receipts: input.receipts.slice(0, 5).map((receipt) => `${receipt.status}: ${receipt.title}`),
      profile,
      generatedAt: input.generatedAt,
    };
  }

  public resolveProfile(input: {
    surface: ExperienceSurface;
    activeRun?: UniversalAgentRun | null;
    requestedProfile?: ExperienceResponseProfileId | null;
  }): ExperienceResponseProfile {
    const requested =
      input.requestedProfile || this.profileFromMetadata(input.activeRun?.metadata) || this.defaultProfile(input);
    return this.profile(requested);
  }

  private profile(id: ExperienceResponseProfileId): ExperienceResponseProfile {
    const profiles: Record<ExperienceResponseProfileId, ExperienceResponseProfile> = {
      short: {
        contractVersion: EXPERIENCE_RESPONSE_PROFILE_CONTRACT_VERSION,
        id: 'short',
        label: tService('pulse.profile_short_label'),
        summary: tService('pulse.profile_short_summary'),
        tone: tService('pulse.profile_short_tone'),
        structure: [
          tService('pulse.profile_short_struct_result'),
          tService('pulse.profile_short_struct_next'),
          tService('pulse.profile_short_struct_risk'),
        ],
        defaultDetail: 'compact',
        appliesTo: ['cli', 'web', 'telegram', 'discord', 'api'],
        commands: ['zavorth pulse --profile short', 'zavorth ask --profile short'],
        canChange: true,
      },
      dev: {
        contractVersion: EXPERIENCE_RESPONSE_PROFILE_CONTRACT_VERSION,
        id: 'dev',
        label: tService('pulse.profile_dev_label'),
        summary: tService('pulse.profile_dev_summary'),
        tone: tService('pulse.profile_dev_tone'),
        structure: [
          tService('pulse.profile_dev_struct_plan'),
          tService('pulse.profile_dev_struct_changes'),
          tService('pulse.profile_dev_struct_validation'),
          tService('pulse.profile_dev_struct_risks'),
        ],
        defaultDetail: 'balanced',
        appliesTo: ['cli', 'web', 'api'],
        commands: ['zavorth pulse --profile dev', 'zavorth ask --profile dev'],
        canChange: true,
      },
      executive: {
        contractVersion: EXPERIENCE_RESPONSE_PROFILE_CONTRACT_VERSION,
        id: 'executive',
        label: tService('pulse.profile_executive_label'),
        summary: tService('pulse.profile_executive_summary'),
        tone: tService('pulse.profile_executive_tone'),
        structure: [
          tService('pulse.profile_executive_struct_impact'),
          tService('pulse.profile_executive_struct_decision'),
          tService('pulse.profile_executive_struct_risk'),
          tService('pulse.profile_executive_struct_evidence'),
        ],
        defaultDetail: 'compact',
        appliesTo: ['web', 'telegram', 'discord', 'api'],
        commands: ['zavorth pulse --profile executive', 'zavorth ask --profile executive'],
        canChange: true,
      },
      mentor: {
        contractVersion: EXPERIENCE_RESPONSE_PROFILE_CONTRACT_VERSION,
        id: 'mentor',
        label: tService('pulse.profile_mentor_label'),
        summary: tService('pulse.profile_mentor_summary'),
        tone: tService('pulse.profile_mentor_tone'),
        structure: [
          tService('pulse.profile_mentor_struct_understood'),
          tService('pulse.profile_mentor_struct_why'),
          tService('pulse.profile_mentor_struct_action'),
          tService('pulse.profile_mentor_struct_validate'),
        ],
        defaultDetail: 'deep',
        appliesTo: ['cli', 'web', 'api'],
        commands: ['zavorth pulse --profile mentor', 'zavorth ask --profile mentor'],
        canChange: true,
      },
    };
    return profiles[id] || profiles.dev;
  }

  private defaultProfile(input: {
    surface: ExperienceSurface;
    activeRun?: UniversalAgentRun | null;
  }): ExperienceResponseProfileId {
    if (input.surface === 'telegram' || input.surface === 'discord') return 'short';
    const kind = clean(
      input.activeRun?.metadata?.experiencePlan && typeof input.activeRun.metadata.experiencePlan === 'object'
        ? (input.activeRun.metadata.experiencePlan as Record<string, unknown>).kind
        : '',
    );
    if (/security|audit|code|workspace|release/.test(kind)) return 'dev';
    return input.surface === 'web' ? 'executive' : 'dev';
  }

  private profileFromMetadata(metadata: Record<string, unknown> | undefined): ExperienceResponseProfileId | null {
    const raw = clean(
      metadata?.responseProfile || metadata?.answerStyle || metadata?.style || metadata?.replyStyle,
    ).toLowerCase();
    if (raw === 'short' || raw === 'curto' || raw === 'objetivo') return 'short';
    if (raw === 'dev' || raw === 'developer' || raw === 'technical') return 'dev';
    if (raw === 'executive' || raw === 'executivo' || raw === 'manager') return 'executive';
    if (raw === 'mentor' || raw === 'didatico' || raw === 'teacher') return 'mentor';
    return null;
  }

  private pickBestNextAction(input: PulseBriefBuildInput, pendingApprovals: number): ExperienceAction {
    if (pendingApprovals > 0) {
      const approval = input.approvals.find((item) => item.status === 'pending');
      return {
        id: 'daily.approval.review',
        label: approval ? tService('pulse.review_approval', { id: approval.id }) : tService('pulse.review_approvals'),
        kind: 'approval',
        command: approval ? `zavorth approve ${approval.id}` : 'zavorth approve',
        route: '/zavorthControl',
        risk: approval?.risk || 'attention',
        requiresApproval: false,
        reason: tService('pulse.approval_reason'),
      };
    }
    const pendingCard = input.actionCards.find((card) => card.status === 'pending');
    const cardAction = pendingCard?.actions.find((action) => action.command);
    if (cardAction) return cardAction;
    if (input.learningPending > 0) {
      return {
        id: 'daily.learning.review',
        label: tService('pulse.review_learning'),
        kind: 'learning',
        command: 'zavorth learn',
        route: '/zavorthControl',
        risk: 'safe',
        requiresApproval: false,
        reason: tService('pulse.learning_reason'),
      };
    }
    return (
      input.nextActions[0] || {
        id: 'daily.ask',
        label: tService('pulse.ask_zavorth'),
        kind: 'natural',
        command: 'zavorth ask "<request>"',
        route: null,
        risk: 'safe',
        requiresApproval: false,
        reason: tService('pulse.natural_input_reason'),
      }
    );
  }

  private headline(
    status: ExperienceHealthStatus,
    pendingApprovals: number,
    pendingLearning: number,
    activeTask: string | null,
  ): string {
    if (pendingApprovals > 0) return tService('pulse.headline_approvals', { count: String(pendingApprovals) });
    if (activeTask)
      return tService('pulse.headline_active_task', {
        task: clean(activeTask, tService('pulse.active_task_fallback')),
      });
    if (pendingLearning > 0) return tService('pulse.headline_learning', { count: String(pendingLearning) });
    if (status === 'ready') return tService('pulse.headline_ready');
    return tService('pulse.headline_needs_attention');
  }

  private summary(input: PulseBriefBuildInput, pendingApprovals: number, profile: ExperienceResponseProfile): string {
    const parts = [
      input.health.summary,
      pendingApprovals > 0 ? tService('pulse.has_pending_approvals') : tService('pulse.no_pending_approvals'),
      input.learningPending > 0
        ? tService('pulse.learning_pending', { count: String(input.learningPending) })
        : tService('pulse.learning_up_to_date'),
      `${tService('pulse.profile_label')}: ${profile.label}`,
    ];
    return parts
      .map((part) => clean(part))
      .filter(Boolean)
      .join(' | ');
  }
}
