import { ZAVORTH_NATIVE_AUTONOMY_SPINE_VERSION } from '../contracts/native/ZavorthNativeAutonomySpineContract.js';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type { AgentRunStore } from '../runtime/agent/AgentRunStore.js';
import type { UniversalAgentRun } from '../runtime/agent/UniversalAgentRuntimeTypes.js';
import type {
  ZavorthExperienceLearningCandidate,
  ZavorthNativeAutonomySpineSnapshot,
  ZavorthSkillForgeDraft,
} from '../contracts/native/ZavorthNativeAutonomySpineContract.js';

import { redactSensitiveText } from './ZavorthNativeAutonomyShared.js';
import { logger } from '../logger.js';
import {
WorkflowRunService,
  type WorkflowRunSnapshot,
  type WorkflowRunStageSnapshot,
} from './WorkflowRunService.js';

export type LearningCandidateKind = 'skill' | 'recipe' | 'playbook';
export type LearningCandidateLifecycle = 'learned_draft' | 'trusted_local' | 'published' | 'quarantined';
export type LearningCandidateReviewState = 'pending' | 'approved' | 'rejected';
export type LearningPlaneActionId =
  | 'approve'
  | 'reject'
  | 'promote'
  | 'forget'
  | 'promoteProcedure'
  | 'promoteSkill';

export type LearningCandidateSnapshot = {
  id: string;
  platformEntryId: string;
  title: string;
  kind: LearningCandidateKind;
  summary: string;
  score: number;
  reviewState: LearningCandidateReviewState;
  lifecycle: LearningCandidateLifecycle;
  createdAt: string;
  updatedAt: string;
  lastValidatedAt: string;
  source: {
    workflowRunId: string;
    workflow: string;
    workspace: string;
    objective: string;
    artifactCount: number;
    completedStages: number;
    totalStages: number;
    originTaskId: string | null;
    sourceSurface: string | null;
  };
  steps: string[];
  details: string[];
};

export type LearningPlaneSnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    promoted: number;
    published: number;
    quarantined: number;
    highConfidence: number;
  };
  candidates: LearningCandidateSnapshot[];
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type LearningPlaneMetricsSnapshot = {
  generatedAt: string;
  summary: {
    totalCandidates: number;
    acceptedRate: number;
    rejectedRate: number;
    promotedRate: number;
    averageScore: number;
  };
  counts: {
    pending: number;
    approved: number;
    rejected: number;
    promoted: number;
    published: number;
    quarantined: number;
    highConfidence: number;
  };
};

export type LearningPlaneActionExecution = {
  generatedAt: string;
  candidateId: string;
  actionId: LearningPlaneActionId;
  status: 'applied' | 'blocked' | 'noop';
  ok: boolean;
  summary: string;
  details: string[];
  snapshot: LearningPlaneSnapshot;
  approvalId?: string | null;
  skillCandidateId?: string | null;
  silentInstallBlocked?: boolean;
  skillInstalled?: boolean;
};

export type LearningPlaneStateExport = {
  generatedAt: string;
  state: LearningStateFile;
  snapshot: LearningPlaneSnapshot;
};

type LearningStateEntry = {
  reviewState: LearningCandidateReviewState;
  lifecycle: LearningCandidateLifecycle;
  updatedAt: string;
  promotedAt?: string | null;
  rejectedAt?: string | null;
  publishedAt?: string | null;
};

type LearningStateFile = {
  version: number;
  updatedAt: string;
  entries: Record<string, LearningStateEntry>;
};

type SkillPromotionGateAdapter = {
  materializeCandidate: (input: {
    intentText: string;
    candidateKind?: string | null;
    requestedBy?: string | null;
    sourceSurface?: string | null;
    approvalRequired?: boolean;
  }) => Promise<{
    ok: boolean;
    summary: string;
    candidateId: string | null;
    installed: boolean;
    status?: string;
    silentInstallBlocked?: boolean;
    mutationPlanId?: string | null;
  }> | {
    ok: boolean;
    summary: string;
    candidateId: string | null;
    installed: boolean;
    status?: string;
    silentInstallBlocked?: boolean;
    mutationPlanId?: string | null;
  };
  preview?: (
    candidateId: string,
    options?: { requestedBy?: string | null; sourceSurface?: string | null; retest?: boolean },
  ) => Promise<{
    ok: boolean;
    summary: string;
    candidateId: string | null;
    installed: boolean;
    status?: string;
    silentInstallBlocked?: boolean;
    mutationPlanId?: string | null;
    approvalId?: string | null;
    details?: string[];
  }>;
  apply: (input: {
    candidateId: string;
    approvalId: string;
    requestedBy?: string | null;
    sourceSurface?: string | null;
  }) => Promise<{
    ok: boolean;
    summary: string;
    installed: boolean;
    status: string;
    candidateId?: string | null;
    silentInstallBlocked?: boolean;
    details?: string[];
  }>;
};

type LearningPlaneRuntime = {
  now?: () => Date;
  workflowRunService?: Pick<WorkflowRunService, 'listRuns'>;
  nativeRunStore?: Pick<AgentRunStore, 'loadRuns'> | null;
  stateFile?: string;
  maxCandidates?: number;
  skillPromotionGate?: SkillPromotionGateAdapter | null;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

export class ZavorthLearningPlaneService {
  private readonly now: () => Date;
  private readonly workflowRuns: Pick<WorkflowRunService, 'listRuns'>;
  private readonly nativeRunStore: Pick<AgentRunStore, 'loadRuns'> | null;
  private readonly stateFile: string;
  private readonly maxCandidates: number;
  private readonly skillPromotionGate: SkillPromotionGateAdapter | null;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;

  constructor(runtime: LearningPlaneRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.workflowRuns = runtime.workflowRunService || new WorkflowRunService();
    this.nativeRunStore = runtime.nativeRunStore || null;
    this.stateFile = runtime.stateFile || config.learningPlaneStateFile;
    this.maxCandidates = Math.max(1, runtime.maxCandidates || config.learningPlaneMaxCandidates || 40);
    this.skillPromotionGate = runtime.skillPromotionGate === undefined
      ? createDefaultSkillPromotionGateAdapter()
      : runtime.skillPromotionGate;
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public buildSnapshot(input: { workspace?: string | null } = {}): LearningPlaneSnapshot {
    const workspace = this.normalizeValue(input.workspace);
    const state = this.readState();
    const workflowCandidates = this.workflowRuns
      .listRuns({
        workspace: workspace || null,
        limit: this.maxCandidates,
        statuses: ['completed', 'approval_pending', 'blocked'],
      })
      .map((run) => this.toCandidate(run, state.entries))
      .filter((candidate): candidate is LearningCandidateSnapshot => Boolean(candidate))
    const nativeCandidates = this.listNativeRunCandidates(workspace, state.entries);
    const candidates = [
      ...workflowCandidates,
      ...nativeCandidates,
    ]
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
      })
      .slice(0, this.maxCandidates);
    const summary = {
      total: candidates.length,
      pending: candidates.filter((candidate) => candidate.reviewState === 'pending').length,
      approved: candidates.filter((candidate) => candidate.reviewState === 'approved').length,
      rejected: candidates.filter((candidate) => candidate.reviewState === 'rejected').length,
      promoted: candidates.filter((candidate) => candidate.lifecycle === 'trusted_local').length,
      published: candidates.filter((candidate) => candidate.lifecycle === 'published').length,
      quarantined: candidates.filter((candidate) => candidate.lifecycle === 'quarantined').length,
      highConfidence: candidates.filter((candidate) => candidate.score >= 0.8).length,
    };

    return {
      generatedAt: this.now().toISOString(),
      summary,
      candidates,
      narrative: {
        headline: summary.total > 0
          ? `Learning plane com ${summary.total} candidate(s) derivado(s) do runtime.`
          : 'Learning plane without enough candidates for now.',
        operatorSummary: `${summary.pending} pending(s), ${summary.approved} approved(s), `
          + `${summary.promoted} promovido(s) e ${summary.quarantined} quarantined.`,
      },
    };
  }

  public readMetrics(input: { workspace?: string | null } = {}): LearningPlaneMetricsSnapshot {
    const snapshot = this.buildSnapshot(input);
    const total = snapshot.summary.total || 1;
    const averageScore = snapshot.candidates.length
      ? Number((snapshot.candidates.reduce((acc, candidate) => acc + candidate.score, 0) / snapshot.candidates.length).toFixed(3))
      : 0;

    return {
      generatedAt: snapshot.generatedAt,
      summary: {
        totalCandidates: snapshot.summary.total,
        acceptedRate: Number((snapshot.summary.approved / total).toFixed(3)),
        rejectedRate: Number((snapshot.summary.rejected / total).toFixed(3)),
        promotedRate: Number((snapshot.summary.promoted / total).toFixed(3)),
        averageScore,
      },
      counts: {
        pending: snapshot.summary.pending,
        approved: snapshot.summary.approved,
        rejected: snapshot.summary.rejected,
        promoted: snapshot.summary.promoted,
        published: snapshot.summary.published,
        quarantined: snapshot.summary.quarantined,
        highConfidence: snapshot.summary.highConfidence,
      },
    };
  }

  public async executeAction(input: {
    candidateId: string;
    actionId: LearningPlaneActionId;
    approvalId?: string | null;
    requestedBy?: string | null;
    sourceSurface?: string | null;
  }): Promise<LearningPlaneActionExecution> {
    const candidateId = this.normalizeValue(input.candidateId);
    const actionId = input.actionId;
    const approvalId = String(input.approvalId || '').trim() || null;
    const requestedBy = String(input.requestedBy || 'learning-plane').trim() || 'learning-plane';
    const sourceSurface = String(input.sourceSurface || 'learning-plane').trim() || 'learning-plane';
    const state = this.readState();
    const candidate = this.buildSnapshot().candidates.find((entry) => this.normalizeValue(entry.id) === candidateId) || null;

    if (!candidate) {
      throw new Error(`Learning candidate not found: ${input.candidateId}.`);
    }

    const now = this.now().toISOString();
    const current = state.entries[candidateId] || {
      reviewState: candidate.reviewState,
      lifecycle: candidate.lifecycle,
      updatedAt: candidate.updatedAt,
      promotedAt: null,
      rejectedAt: null,
      publishedAt: null,
    };

    let next: LearningStateEntry | null = null;
    let status: LearningPlaneActionExecution['status'] = 'applied';
    let summary = '';
    const details: string[] = [];
    let skillCandidateId: string | null = null;
    let skillInstalled = false;
    let silentInstallBlocked: boolean | undefined;

    if (actionId === 'approve') {
      if (current.reviewState === 'approved' && current.lifecycle !== 'quarantined') {
        status = 'noop';
        summary = `${candidate.title} already is approved no learning plane.`;
        details.push('No change was needed.');
      } else {
        next = {
          ...current,
          reviewState: 'approved',
          lifecycle: current.lifecycle === 'quarantined' ? 'learned_draft' : current.lifecycle,
          updatedAt: now,
          rejectedAt: current.lifecycle === 'quarantined' ? null : current.rejectedAt || null,
        };
        summary = `${candidate.title} approved as a reviewable draft.`;
        details.push('The item remains a learned_draft until explicit promotion.');
      }
    } else if (actionId === 'reject' || actionId === 'forget') {
      if (current.lifecycle === 'quarantined' && current.reviewState === 'rejected') {
        status = 'noop';
        summary = actionId === 'forget'
          ? `${candidate.title} already is quarantined.`
          : `${candidate.title} already is quarantined.`;
        details.push('No change was needed.');
      } else {
        next = {
          ...current,
          reviewState: 'rejected',
          lifecycle: 'quarantined',
          updatedAt: now,
          rejectedAt: now,
        };
        summary = actionId === 'forget'
          ? `${candidate.title} was forgotten and revoked from the learning plane.`
          : `${candidate.title} was quarantined.`;
        details.push(actionId === 'forget'
          ? 'The candidate remains traceable as revoked, without persisted behavior in the trusted runtime.'
          : 'Rejected candidates do not enter trusted runtime.');
      }
    } else if (actionId === 'promote' || actionId === 'promoteProcedure' || actionId === 'promoteSkill') {
      if (current.lifecycle === 'trusted_local' || current.lifecycle === 'published') {
        status = 'noop';
        summary = `${candidate.title} already foi promovido.`;
        details.push('No change was needed.');
      } else if (current.reviewState === 'rejected' || current.lifecycle === 'quarantined') {
        status = 'blocked';
        summary = `${candidate.title} is quarantined and needs approval before promotion.`;
        details.push('Use approve to remove the candidate from quarantine before promoting.');
      } else {
        const wantsSkillInstall = actionId === 'promoteSkill';
        const gateResult = await this.runSkillPromotionGate({
          candidate,
          actionId,
          approvalId,
          requestedBy,
          sourceSurface,
        });
        skillCandidateId = gateResult.skillCandidateId;
        skillInstalled = gateResult.installed;
        silentInstallBlocked = gateResult.silentInstallBlocked;
        details.push(...gateResult.details);

        if (wantsSkillInstall && this.skillPromotionGate) {
          if (gateResult.installed) {
            next = {
              ...current,
              reviewState: 'approved',
              lifecycle: 'trusted_local',
              updatedAt: now,
              promotedAt: now,
              rejectedAt: null,
            };
            status = 'applied';
            summary = `${candidate.title} promoted and skill installed via SkillPromotionGate.`;
            details.push('silentInstallBlocked=true was honored; install required explicit approvalId.');
          } else if (approvalId) {
            status = 'blocked';
            summary = `${candidate.title} skill install blocked by SkillPromotionGate.`;
            details.push(gateResult.summary || 'Apply did not install skill files.');
          } else {
            next = {
              ...current,
              reviewState: 'approved',
              lifecycle: 'learned_draft',
              updatedAt: now,
              rejectedAt: null,
            };
            status = 'blocked';
            summary = `${candidate.title} skill install waits for approvalId (silent install blocked).`;
            details.push('Provide approvalId to apply the SkillPromotionGate mutation plan.');
            details.push('Learning lifecycle stays learned_draft until approved install.');
          }
        } else {
          next = {
            ...current,
            reviewState: 'approved',
            lifecycle: 'trusted_local',
            updatedAt: now,
            promotedAt: now,
            rejectedAt: null,
          };
          status = 'applied';
          summary = `${candidate.title} promovido para trusted local.`;
          if (actionId === 'promoteProcedure') {
            details.push('O candidato agora pode appearsr como procedimento local aprendido in the platform plane.');
          } else {
            details.push('O candidato agora pode appearsr como habilidade aprendida in the platform plane.');
          }
        }
      }
    } else {
      status = 'blocked';
      summary = `Unsupported learning action: ${String(actionId)}`;
    }

    if (next) {
      state.entries[candidateId] = next;
      state.updatedAt = now;
      this.writeState(state);
    }

    return {
      generatedAt: now,
      candidateId,
      actionId,
      status,
      ok: status !== 'blocked',
      summary,
      details,
      snapshot: this.buildSnapshot(),
      approvalId,
      skillCandidateId,
      silentInstallBlocked,
      skillInstalled,
    };
  }

  private async runSkillPromotionGate(input: {
    candidate: LearningCandidateSnapshot;
    actionId: LearningPlaneActionId;
    approvalId: string | null;
    requestedBy: string;
    sourceSurface: string;
  }): Promise<{
    skillCandidateId: string | null;
    installed: boolean;
    silentInstallBlocked: boolean;
    summary: string;
    details: string[];
  }> {
    const gate = this.skillPromotionGate;
    if (!gate) {
      return {
        skillCandidateId: null,
        installed: false,
        silentInstallBlocked: true,
        summary: 'SkillPromotionGate unavailable.',
        details: [
          'SkillPromotionGate unavailable; promote stayed learning-plane lifecycle only.',
          'Install skill via: zavorth skills evolve promote <candidateId> --approval-id <id>',
        ],
      };
    }

    const details: string[] = [];
    const intentText = [
      input.candidate.title,
      input.candidate.summary,
      ...input.candidate.steps.slice(0, 8),
    ].filter(Boolean).join('\n');
    const candidateKind = input.actionId === 'promoteProcedure'
      ? 'procedure'
      : input.candidate.kind === 'skill' || input.actionId === 'promoteSkill'
        ? 'auto-skill'
        : input.candidate.kind;

    try {
      const materialized = await Promise.resolve(gate.materializeCandidate({
        intentText,
        candidateKind,
        requestedBy: input.requestedBy,
        sourceSurface: input.sourceSurface,
        approvalRequired: true,
      }));
      const skillCandidateId = materialized.candidateId || null;
      details.push(materialized.summary || 'Skill promotion candidate materialized.');
      details.push('silentInstallBlocked=true');
      if (skillCandidateId) {
        details.push(`skillCandidateId=${skillCandidateId}`);
      }

      if (!skillCandidateId) {
        return {
          skillCandidateId: null,
          installed: false,
          silentInstallBlocked: true,
          summary: materialized.summary || 'Skill promotion materialize failed.',
          details,
        };
      }

      if (input.approvalId) {
        const applied = await gate.apply({
          candidateId: skillCandidateId,
          approvalId: input.approvalId,
          requestedBy: input.requestedBy,
          sourceSurface: input.sourceSurface,
        });
        details.push(applied.summary);
        if (Array.isArray(applied.details)) {
          details.push(...applied.details.slice(0, 6));
        }
        details.push(`skillInstalled=${applied.installed ? 'yes' : 'no'}`);
        return {
          skillCandidateId,
          installed: Boolean(applied.installed),
          silentInstallBlocked: true,
          summary: applied.summary,
          details,
        };
      }

      if (typeof gate.preview === 'function') {
        const previewed = await gate.preview(skillCandidateId, {
          requestedBy: input.requestedBy,
          sourceSurface: input.sourceSurface,
        });
        details.push(previewed.summary);
        if (previewed.mutationPlanId) {
          details.push(`mutationPlanId=${previewed.mutationPlanId}`);
        }
        if (Array.isArray(previewed.details)) {
          details.push(...previewed.details.slice(0, 4));
        }
        details.push('Install requires explicit approvalId (preview/apply path).');
        return {
          skillCandidateId,
          installed: false,
          silentInstallBlocked: true,
          summary: previewed.summary,
          details,
        };
      }

      details.push('Skill candidate drafted; install requires approvalId.');
      return {
        skillCandidateId,
        installed: false,
        silentInstallBlocked: true,
        summary: materialized.summary,
        details,
      };
    } catch (error: unknown) {
      logger.warn('[LearningPlane] skill promotion gate failed', error);
      return {
        skillCandidateId: null,
        installed: false,
        silentInstallBlocked: true,
        summary: 'SkillPromotionGate failed during promote.',
        details: [
          error instanceof Error ? error.message : String(error),
          'silentInstallBlocked=true',
        ],
      };
    }
  }

  public exportState(): LearningPlaneStateExport {
    return {
      generatedAt: this.now().toISOString(),
      state: this.readState(),
      snapshot: this.buildSnapshot(),
    };
  }

  public resetState(): LearningPlaneSnapshot {
    const now = this.now().toISOString();
    this.writeState({
      version: 1,
      updatedAt: now,
      entries: {},
    });
    return this.buildSnapshot();
  }

  private toCandidate(
    run: WorkflowRunSnapshot,
    stateEntries: Record<string, LearningStateEntry>,
  ): LearningCandidateSnapshot | null {
    const completedStages = run.phases.filter((phase) => phase.status === 'completed').length;
    const totalStages = run.phases.length;
    const artifactCount = Array.isArray(run.artifacts) ? run.artifacts.length : 0;
    if (!completedStages && artifactCount === 0) {
      return null;
    }

    const score = this.scoreRun(run, completedStages, artifactCount);
    if (score < 0.55) {
      return null;
    }

    const candidateId = this.normalizeValue(`candidate:${run.workflow_run_id}`);
    const platformEntryId = this.normalizeValue(
      `skill:learned:${run.workflow_name}:${path.basename(run.workspace || 'workspace')}:${run.workflow_run_id}`,
    );
    const state = stateEntries[candidateId] || null;
    const kind = this.resolveKind(run, totalStages, artifactCount);
    const steps = run.phases
      .filter((phase) => Boolean(phase.label))
      .map((phase) => this.renderStageStep(phase))
      .slice(0, 6);
    const lifecycle = state?.lifecycle
      || (state?.reviewState === 'rejected' ? 'quarantined' : 'learned_draft');
    const reviewState = state?.reviewState || 'pending';
    const createdAt = run.created_at || this.now().toISOString();
    const updatedAt = state?.updatedAt || run.updated_at || createdAt;

    return {
      id: candidateId,
      platformEntryId,
      title: this.buildTitle(run, kind),
      kind,
      summary: this.buildSummary(run, completedStages, artifactCount),
      score,
      reviewState,
      lifecycle,
      createdAt,
      updatedAt,
      lastValidatedAt: run.updated_at || updatedAt,
      source: {
        workflowRunId: run.workflow_run_id,
        workflow: run.workflow_name,
        workspace: run.workspace,
        objective: run.objective,
        artifactCount,
        completedStages,
        totalStages,
        originTaskId: run.origin.origin_task_id,
        sourceSurface: run.origin.source_surface,
      },
      steps,
      details: [
        `Workflow: ${run.workflow_name}`,
        `Workspace: ${run.workspace}`,
        `Objective: ${run.objective}`,
        `phases completed: ${completedStages}/${totalStages}`,
        `Artifacts: ${artifactCount}`,
        ...(run.resume_prompt ? [`Resume prompt: ${run.resume_prompt}`] : []),
      ],
    };
  }

  private listNativeRunCandidates(
    workspace: string,
    stateEntries: Record<string, LearningStateEntry>,
  ): LearningCandidateSnapshot[] {
    if (!this.nativeRunStore) {
      return [];
    }
    try {
      return this.nativeRunStore.loadRuns()
        .filter((run) => !workspace || this.normalizeValue(run.workspace || '') === workspace)
        .flatMap((run) => this.toNativeRunCandidates(run, stateEntries));
    } catch (error: unknown) {logger.warn('[Zavorth Learning Plane] load operation failed', error); return []; }
  }

  private toNativeRunCandidates(
    run: UniversalAgentRun,
    stateEntries: Record<string, LearningStateEntry>,
  ): LearningCandidateSnapshot[] {
    const spine = this.readNativeAutonomySpine(run);
    if (!spine || run.status !== 'completed') {
      return [];
    }

    const learningCandidates = Array.isArray(spine.learning?.candidates)
      ? spine.learning.candidates.map((candidate) => this.toNativeLearningCandidate(run, candidate, stateEntries))
      : [];
    const draftCandidates = Array.isArray(spine.skillForge?.drafts)
      ? spine.skillForge.drafts.map((draft) => this.toNativeSkillDraftCandidate(run, draft, stateEntries))
      : [];

    return [...learningCandidates, ...draftCandidates].filter((candidate): candidate is LearningCandidateSnapshot => Boolean(candidate));
  }

  private toNativeLearningCandidate(
    run: UniversalAgentRun,
    candidate: ZavorthExperienceLearningCandidate,
    stateEntries: Record<string, LearningStateEntry>,
  ): LearningCandidateSnapshot {
    const candidateId = this.normalizeValue(`candidate:native:${run.id}:${candidate.candidateId}`);
    const generatedAt = this.now().toISOString();
    const createdAt = run.updatedAt || run.createdAt || generatedAt;
    const state = stateEntries[candidateId] || this.defaultNativeLearningState(candidate, createdAt);
    const workspace = run.workspace || '';
    const title = this.nativeLearningTitle(candidate);

    return {
      id: candidateId,
      platformEntryId: this.normalizeValue(
        `skill:learned:native-turn:${path.basename(workspace || 'workspace')}:${candidate.candidateId}`,
      ),
      title,
      kind: this.nativeLearningKind(candidate),
      summary: redactSensitiveText(candidate.summary),
      score: this.normalizeScore(candidate.confidence),
      reviewState: state.reviewState,
      lifecycle: state.lifecycle,
      createdAt,
      updatedAt: state.updatedAt || createdAt,
      lastValidatedAt: createdAt,
      source: {
        workflowRunId: run.id,
        workflow: 'native-autonomy-spine',
        workspace,
        objective: redactSensitiveText(run.input || run.title || ''),
        artifactCount: Array.isArray(run.artifacts) ? run.artifacts.length : 0,
        completedStages: 1,
        totalStages: 1,
        originTaskId: run.requestId || null,
        sourceSurface: run.channel || null,
      },
      steps: [
        `${candidate.lane} lane`,
        candidate.approvalRequired ? 'review before changing behavior.' : 'Applied as a reversible preference with receipt.',
      ],
      details: [
        `Origem: native-autonomy-spine`,
        `Tipo: ${candidate.kind}`,
        `Risk: ${candidate.risk}`,
        `Receipt: ${candidate.receiptId}`,
        `Expira em: ${candidate.expiry}`,
        ...candidate.evidenceRefs.map((ref) => `Evidencia: ${redactSensitiveText(ref)}`),
      ],
    };
  }

  private toNativeSkillDraftCandidate(
    run: UniversalAgentRun,
    draft: ZavorthSkillForgeDraft,
    stateEntries: Record<string, LearningStateEntry>,
  ): LearningCandidateSnapshot {
    const candidateId = this.normalizeValue(`candidate:native-skill:${run.id}:${draft.draftId}`);
    const generatedAt = this.now().toISOString();
    const createdAt = run.updatedAt || run.createdAt || generatedAt;
    const state = stateEntries[candidateId] || {
      reviewState: 'pending',
      lifecycle: 'learned_draft',
      updatedAt: createdAt,
    } satisfies LearningStateEntry;
    const workspace = run.workspace || '';

    return {
      id: candidateId,
      platformEntryId: this.normalizeValue(
        `skill:learned:skill-forge:${path.basename(workspace || 'workspace')}:${draft.draftId}`,
      ),
      title: redactSensitiveText(draft.title),
      kind: 'skill',
      summary: `Skill Forge created a preview-only draft (${draft.risk}) that requires scanner and smoke before installation.`,
      score: this.scoreDraft(draft),
      reviewState: state.reviewState,
      lifecycle: state.lifecycle,
      createdAt,
      updatedAt: state.updatedAt || createdAt,
      lastValidatedAt: createdAt,
      source: {
        workflowRunId: run.id,
        workflow: 'skill-forge',
        workspace,
        objective: redactSensitiveText(run.input || run.title || ''),
        artifactCount: 0,
        completedStages: 1,
        totalStages: 3,
        originTaskId: run.requestId || null,
        sourceSurface: run.channel || null,
      },
      steps: [
        'Draft generated without materialization.',
        'run scanner estatico.',
        'Run non-destructive smoke.',
        draft.approvalRequired ? 'Ask approval before installation.' : 'Promote only after validation.',
      ],
      details: [
        `Origem: skill-forge-runtime`,
        `Risk: ${draft.risk}`,
        `Materialized: ${draft.materialized ? 'yes' : 'no'}`,
        `Smoke required: ${draft.smokeRequired ? 'yes' : 'no'}`,
        `Rollback available: ${draft.rollbackAvailable ? 'yes' : 'no'}`,
        ...draft.preview.tests.map((test) => `Teste: ${redactSensitiveText(test)}`),
        ...draft.evidenceRefs.map((ref) => `Evidencia: ${redactSensitiveText(ref)}`),
      ],
    };
  }

  private readNativeAutonomySpine(run: UniversalAgentRun): ZavorthNativeAutonomySpineSnapshot | null {
    const raw = run.metadata?.nativeAutonomySpine;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }
    const candidate = raw as Partial<ZavorthNativeAutonomySpineSnapshot>;
    return candidate.version === ZAVORTH_NATIVE_AUTONOMY_SPINE_VERSION
      ? candidate as ZavorthNativeAutonomySpineSnapshot
      : null;
  }

  private defaultNativeLearningState(
    candidate: ZavorthExperienceLearningCandidate,
    createdAt: string,
  ): LearningStateEntry {
    if (candidate.lane === 'red' || candidate.status === 'blocked') {
      return {
        reviewState: 'rejected',
        lifecycle: 'quarantined',
        updatedAt: createdAt,
        rejectedAt: createdAt,
      };
    }
    if (candidate.lane === 'green' && candidate.status === 'auto-applied') {
      return {
        reviewState: 'approved',
        lifecycle: 'trusted_local',
        updatedAt: createdAt,
        promotedAt: createdAt,
      };
    }
    return {
      reviewState: 'pending',
      lifecycle: 'learned_draft',
      updatedAt: createdAt,
    };
  }

  private nativeLearningKind(candidate: ZavorthExperienceLearningCandidate): LearningCandidateKind {
    if (candidate.kind === 'skill-signal') {
      return 'skill';
    }
    if (candidate.kind === 'procedure') {
      return 'playbook';
    }
    return 'recipe';
  }

  private nativeLearningTitle(candidate: ZavorthExperienceLearningCandidate): string {
    if (candidate.kind === 'policy-change') return 'Security change blocked';
    if (candidate.kind === 'sensitive-user-model') return 'Memory sensitive blocked';
    if (candidate.kind === 'skill-signal') return 'Skill draft suggested by usage';
    if (candidate.kind === 'procedure') return 'Procedure suggested by usage';
    return 'Reversible preference learned';
  }

  private normalizeScore(value: unknown): number {
    const score = Number(value || 0);
    if (!Number.isFinite(score)) {
      return 0.55;
    }
    return Math.max(0.55, Math.min(1, Number(score.toFixed(3))));
  }

  private scoreDraft(draft: ZavorthSkillForgeDraft): number {
    if (draft.risk === 'high') return 0.58;
    if (draft.risk === 'medium') return 0.68;
    return 0.78;
  }

  private buildTitle(run: WorkflowRunSnapshot, kind: LearningCandidateKind): string {
    const workspaceLabel = path.basename(String(run.workspace || 'workspace').replace(/[\\/]+$/, '')).trim() || 'workspace';
    const workflowLabel = this.capitalize(run.workflow_name);
    if (kind === 'playbook') {
      return `${workflowLabel} playbook para ${workspaceLabel}`;
    }
    if (kind === 'recipe') {
      return `${workflowLabel} recipe para ${workspaceLabel}`;
    }
    return `${workflowLabel} skill para ${workspaceLabel}`;
  }

  private buildSummary(run: WorkflowRunSnapshot, completedStages: number, artifactCount: number): string {
    return `${this.capitalize(run.workflow_name)} em ${run.workspace} com ${completedStages} stage(s) completed(s)`
      + ` e ${artifactCount} artifact(s) reutilizavel(is).`;
  }

  private resolveKind(
    run: WorkflowRunSnapshot,
    totalStages: number,
    artifactCount: number,
  ): LearningCandidateKind {
    if (run.workflow_name === 'ship' || run.workflow_name === 'sdd' || totalStages >= 4) {
      return 'playbook';
    }
    if (artifactCount > 0 || totalStages >= 2) {
      return 'recipe';
    }
    return 'skill';
  }

  private renderStageStep(phase: WorkflowRunStageSnapshot): string {
    const label = String(phase.label || phase.id || 'phase').trim();
    const executor = String(phase.executor || '').trim();
    return executor ? `${label} (${executor})` : label;
  }

  private scoreRun(
    run: WorkflowRunSnapshot,
    completedStages: number,
    artifactCount: number,
  ): number {
    let score = run.status === 'completed' ? 0.5 : 0.28;
    score += Math.min(0.24, completedStages * 0.06);
    if (artifactCount > 0) {
      score += 0.1;
    }
    if (run.workspace_context) {
      score += 0.05;
    }
    if (run.origin.source_surface) {
      score += 0.03;
    }
    if (run.resume_prompt) {
      score += 0.04;
    }
    return Math.max(0, Math.min(1, Number(score.toFixed(3))));
  }

  private readState(): LearningStateFile {
    return this.readJsonFile<LearningStateFile>({
      version: 1,
      updatedAt: this.now().toISOString(),
      entries: {},
    });
  }

  private writeState(state: LearningStateFile): void {
    this.mkdirSyncImpl(path.dirname(this.stateFile), { recursive: true });
    this.writeFileSyncImpl(this.stateFile, JSON.stringify(state, null, 2), 'utf8');
  }

  private readJsonFile<T>(fallback: T): T {
    try {
      if (!this.existsSyncImpl(this.stateFile)) {
        return fallback;
      }
      return JSON.parse(this.readFileSyncImpl(this.stateFile, 'utf8')) as T;
    } catch (error: unknown) {logger.warn('[Zavorth Learning Plane] JSON parse failed', error); return fallback; }
  }

  private normalizeValue(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_\-:/]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private capitalize(value: string): string {
    const normalized = String(value || '').trim();
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Learning';
  }
}

function createDefaultSkillPromotionGateAdapter(): SkillPromotionGateAdapter | null {
  try {
    // Lazy require keeps learning plane usable when skill evolution graph is unavailable.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./SkillPromotionGate.js') as {
      SkillPromotionGate?: new (runtime?: Record<string, unknown>) => {
        materializeCandidate: (input: Record<string, unknown>) => {
          ok: boolean;
          summary: string;
          candidateId: string | null;
          installed: boolean;
          status?: string;
          silentInstallBlocked?: boolean;
          mutationPlanId?: string | null;
        };
        preview: (
          candidateId: string,
          options?: { requestedBy?: string | null; sourceSurface?: string | null; retest?: boolean },
        ) => Promise<{
          ok: boolean;
          summary: string;
          candidateId: string | null;
          installed: boolean;
          status?: string;
          silentInstallBlocked?: boolean;
          mutationPlanId?: string | null;
          approvalId?: string | null;
          details?: string[];
        }>;
        apply: (input: {
          candidateId: string;
          approvalId?: string | null;
          requestedBy?: string | null;
          sourceSurface?: string | null;
        }) => Promise<{
          ok: boolean;
          summary: string;
          installed: boolean;
          status: string;
          candidateId?: string | null;
          silentInstallBlocked?: boolean;
          details?: string[];
        }>;
      };
    };
    if (typeof mod.SkillPromotionGate !== 'function') {
      return null;
    }
    const gate = new mod.SkillPromotionGate();
    return {
      materializeCandidate: async (input) => {
        const result = gate.materializeCandidate(input as Record<string, unknown>);
        return {
          ok: result.ok,
          summary: result.summary,
          candidateId: result.candidateId,
          installed: result.installed,
          status: result.status,
          silentInstallBlocked: result.silentInstallBlocked || true,
          mutationPlanId: result.mutationPlanId || null,
        };
      },
      preview: async (candidateId, options) => gate.preview(candidateId, options),
      apply: async (input) => gate.apply(input),
    };
  } catch {
    return null;
  }
}
