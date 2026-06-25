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
import { ZAVORTH_NATIVE_AUTONOMY_SPINE_VERSION } from '../contracts/native/ZavorthNativeAutonomySpineContract.js';
import { redactSensitiveText } from './ZavorthNativeAutonomyShared.js';
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

type LearningPlaneRuntime = {
  now?: () => Date;
  workflowRunService?: Pick<WorkflowRunService, 'listRuns'>;
  nativeRunStore?: Pick<AgentRunStore, 'loadRuns'> | null;
  stateFile?: string;
  maxCandidates?: number;
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
          ? `Learning plane com ${summary.total} candidato(s) derivado(s) do runtime.`
          : 'Learning plane sem candidatos suficientes por enquanto.',
        operatorSummary: `${summary.pending} pendente(s), ${summary.approved} aprovado(s), `
          + `${summary.promoted} promovido(s) e ${summary.quarantined} em quarentena.`,
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

  public executeAction(input: {
    candidateId: string;
    actionId: LearningPlaneActionId;
  }): LearningPlaneActionExecution {
    const candidateId = this.normalizeValue(input.candidateId);
    const actionId = input.actionId;
    const state = this.readState();
    const candidate = this.buildSnapshot().candidates.find((entry) => this.normalizeValue(entry.id) === candidateId) || null;

    if (!candidate) {
      throw new Error(`Candidato de learning nao encontrado: ${input.candidateId}.`);
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

    if (actionId === 'approve') {
      if (current.reviewState === 'approved' && current.lifecycle !== 'quarantined') {
        status = 'noop';
        summary = `${candidate.title} ja esta aprovado no learning plane.`;
        details.push('Nenhuma mudanca foi necessaria.');
      } else {
        next = {
          ...current,
          reviewState: 'approved',
          lifecycle: current.lifecycle === 'quarantined' ? 'learned_draft' : current.lifecycle,
          updatedAt: now,
          rejectedAt: current.lifecycle === 'quarantined' ? null : current.rejectedAt || null,
        };
        summary = `${candidate.title} aprovado como draft revisavel.`;
        details.push('O item continua como learned_draft ate uma promocao explicita.');
      }
    } else if (actionId === 'reject' || actionId === 'forget') {
      if (current.lifecycle === 'quarantined' && current.reviewState === 'rejected') {
        status = 'noop';
        summary = actionId === 'forget'
          ? `${candidate.title} ja estava esquecido/quarentenado.`
          : `${candidate.title} ja esta em quarentena.`;
        details.push('Nenhuma mudanca foi necessaria.');
      } else {
        next = {
          ...current,
          reviewState: 'rejected',
          lifecycle: 'quarantined',
          updatedAt: now,
          rejectedAt: now,
        };
        summary = actionId === 'forget'
          ? `${candidate.title} foi esquecido e revogado do learning plane.`
          : `${candidate.title} foi colocado em quarentena.`;
        details.push(actionId === 'forget'
          ? 'O candidato permanece rastreavel como revogado, sem comportamento persistido no runtime trusted.'
          : 'Candidatos rejeitados nao entram no runtime trusted.');
      }
    } else if (actionId === 'promote' || actionId === 'promoteProcedure' || actionId === 'promoteSkill') {
      if (current.lifecycle === 'trusted_local' || current.lifecycle === 'published') {
        status = 'noop';
        summary = `${candidate.title} ja foi promovido.`;
        details.push('Nenhuma mudanca foi necessaria.');
      } else if (current.reviewState === 'rejected' || current.lifecycle === 'quarantined') {
        status = 'blocked';
        summary = `${candidate.title} esta em quarentena e precisa de aprovacao antes da promocao.`;
        details.push('Use approve para tirar o candidato da quarentena antes de promover.');
      } else {
        next = {
          ...current,
          reviewState: 'approved',
          lifecycle: 'trusted_local',
          updatedAt: now,
          promotedAt: now,
          rejectedAt: null,
        };
        summary = `${candidate.title} promovido para trusted local.`;
        if (actionId === 'promoteProcedure') {
          details.push('O candidato agora pode aparecer como procedimento local aprendido no platform plane.');
        } else if (actionId === 'promoteSkill') {
          details.push('O candidato agora pode aparecer como habilidade local aprendida no platform plane.');
        } else {
          details.push('O candidato agora pode aparecer como habilidade aprendida no platform plane.');
        }
      }
    } else {
      status = 'blocked';
      summary = `Acao de learning nao suportada: ${String(actionId)}`;
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
    };
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
    } catch {
      return [];
    }
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
        candidate.approvalRequired ? 'Revisar antes de alterar comportamento.' : 'Aplicado como preferencia reversivel com receipt.',
      ],
      details: [
        `Origem: native-autonomy-spine`,
        `Tipo: ${candidate.kind}`,
        `Risco: ${candidate.risk}`,
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
      summary: `Skill Forge criou um draft preview-only (${draft.risk}) que exige scanner e smoke antes de instalar.`,
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
        'Draft gerado sem materializacao.',
        'Rodar scanner estatico.',
        'Rodar smoke nao destrutivo.',
        draft.approvalRequired ? 'Pedir aprovacao antes de instalar.' : 'Promover somente depois de validacao.',
      ],
      details: [
        `Origem: skill-forge-runtime`,
        `Risco: ${draft.risk}`,
        `Materializado: ${draft.materialized ? 'sim' : 'nao'}`,
        `Smoke obrigatorio: ${draft.smokeRequired ? 'sim' : 'nao'}`,
        `Rollback disponivel: ${draft.rollbackAvailable ? 'sim' : 'nao'}`,
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
    if (candidate.kind === 'policy-change') return 'Mudanca de seguranca bloqueada';
    if (candidate.kind === 'sensitive-user-model') return 'Memoria sensivel bloqueada';
    if (candidate.kind === 'skill-signal') return 'Draft de skill sugerido pelo uso';
    if (candidate.kind === 'procedure') return 'Procedimento sugerido pelo uso';
    return 'Preferencia reversivel aprendida';
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
    return `${this.capitalize(run.workflow_name)} em ${run.workspace} com ${completedStages} etapa(s) concluida(s)`
      + ` e ${artifactCount} artefato(s) reutilizavel(is).`;
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
    } catch {
      return fallback;
    }
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
