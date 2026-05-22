import {
  LEARNING_CANDIDATE_CONTRACT_VERSION,
  type ExperienceLearningCandidate,
  type ExperienceLearningCandidateState,
  type ExperienceLearningDecision,
} from './ExperienceContracts.js';
import type {
  LearningPlaneActionExecution,
  LearningPlaneSnapshot,
  ZavorthLearningPlaneService,
} from '../ZavorthLearningPlaneService.js';

export type LearningOSExport = {
  generatedAt: string;
  candidates: ExperienceLearningCandidate[];
  summary: string;
};

export type LearningOSDecisionResult = {
  ok: boolean;
  status: 'applied' | 'blocked' | 'noop' | 'exported' | 'reset';
  summary: string;
  candidates: ExperienceLearningCandidate[];
  raw?: LearningPlaneActionExecution | LearningOSExport | null;
};

export type LearningOSRuntime = {
  now?: () => Date;
  learningPlane?: Pick<ZavorthLearningPlaneService, 'buildSnapshot' | 'executeAction'>
    & Partial<Pick<ZavorthLearningPlaneService, 'resetState' | 'exportState'>> | null;
};

export class LearningOSService {
  private readonly now: () => Date;
  private readonly learningPlane: LearningOSRuntime['learningPlane'];

  constructor(runtime: LearningOSRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.learningPlane = runtime.learningPlane || null;
  }

  public buildCandidates(input: { workspace?: string | null } = {}): ExperienceLearningCandidate[] {
    const snapshot = this.safeSnapshot(input);
    return snapshot.candidates.map((candidate) => {
      const securityBlocked = this.isSecurityPolicyCandidate(candidate);
      const state = securityBlocked ? 'quarantined' : this.resolveState(candidate.reviewState, candidate.lifecycle);
      return {
        contractVersion: LEARNING_CANDIDATE_CONTRACT_VERSION,
        id: candidate.id,
        title: candidate.title,
        origin: candidate.source.sourceSurface || candidate.source.workflow || 'runtime',
        observedPattern: candidate.summary,
        recommendation: securityBlocked
          ? 'Bloqueado: o Learning OS nao pode alterar policy, sandbox, firewall, allowlists ou aprovacoes fundamentais.'
          : candidate.steps[0] || candidate.summary,
        confidence: candidate.score,
        impact: this.impactFor(state),
        dataUsed: candidate.details.slice(0, 6),
        suggestedAction: securityBlocked
          ? 'Rejeitar ou manter em quarentena. Ajustes de seguranca exigem mudanca de codigo revisada.'
          : this.suggestedActionFor(state, candidate.score),
        state,
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
      };
    });
  }

  public buildSummary(input: { workspace?: string | null } = {}): { summary: string; pending: number } {
    const snapshot = this.safeSnapshot(input);
    return {
      summary: snapshot.narrative.operatorSummary,
      pending: snapshot.summary.pending,
    };
  }

  public decide(input: {
    candidateId?: string | null;
    decision: ExperienceLearningDecision;
    workspace?: string | null;
  }): LearningOSDecisionResult {
    const decision = input.decision;
    if (decision === 'export') {
      const exported = this.export(input);
      return {
        ok: true,
        status: 'exported',
        summary: exported.summary,
        candidates: exported.candidates,
        raw: exported,
      };
    }

    if (decision === 'reset') {
      if (this.learningPlane?.resetState) {
        this.learningPlane.resetState();
        const candidates = this.buildCandidates(input);
        return {
          ok: true,
          status: 'reset',
          summary: 'Learning OS resetado. Candidatos futuros precisarao de nova revisao.',
          candidates,
        };
      }
      return {
        ok: false,
        status: 'blocked',
        summary: 'Learning plane atual nao expoe resetState.',
        candidates: this.buildCandidates(input),
      };
    }

    const candidateId = String(input.candidateId || '').trim();
    if (!candidateId) {
      return {
        ok: false,
        status: 'blocked',
        summary: 'Informe o id do candidato de learning.',
        candidates: this.buildCandidates(input),
      };
    }

    if (!this.learningPlane?.executeAction) {
      return {
        ok: false,
        status: 'blocked',
        summary: 'Learning plane indisponivel neste runtime.',
        candidates: this.buildCandidates(input),
      };
    }

    const snapshot = this.safeSnapshot(input);
    const candidate = snapshot.candidates.find((entry) => entry.id === candidateId) || null;
    if ((decision === 'approve' || decision === 'promote') && candidate && this.isSecurityPolicyCandidate(candidate)) {
      const candidates = this.buildCandidates(input);
      return {
        ok: false,
        status: 'blocked',
        summary: 'Learning bloqueado: candidatos que alteram policy de seguranca, sandbox, egress, filesystem, shell ou approvals fundamentais nao podem ser aprovados/promovidos.',
        candidates,
      };
    }

    const actionId = decision === 'revoke'
      ? 'reject'
      : decision === 'promote'
        ? 'promote'
        : decision === 'approve'
          ? 'approve'
          : 'reject';
    const raw = this.learningPlane.executeAction({ candidateId, actionId });
    return {
      ok: raw.ok,
      status: raw.status,
      summary: raw.summary,
      candidates: this.buildCandidates(input),
      raw,
    };
  }

  public export(input: { workspace?: string | null } = {}): LearningOSExport {
    const candidates = this.buildCandidates(input);
    return {
      generatedAt: this.now().toISOString(),
      candidates,
      summary: `${candidates.length} candidato(s) exportado(s) sem segredos brutos.`,
    };
  }

  private safeSnapshot(input: { workspace?: string | null }): LearningPlaneSnapshot {
    if (!this.learningPlane?.buildSnapshot) {
      return {
        generatedAt: this.now().toISOString(),
        summary: {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          promoted: 0,
          published: 0,
          quarantined: 0,
          highConfidence: 0,
        },
        candidates: [],
        narrative: {
          headline: 'Learning OS aguardando runtime.',
          operatorSummary: 'Nenhum learning plane foi conectado a esta superficie.',
        },
      };
    }
    try {
      return this.learningPlane.buildSnapshot({ workspace: input.workspace || null });
    } catch (error: any) {
      return {
        generatedAt: this.now().toISOString(),
        summary: {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          promoted: 0,
          published: 0,
          quarantined: 0,
          highConfidence: 0,
        },
        candidates: [],
        narrative: {
          headline: 'Learning OS indisponivel.',
          operatorSummary: `Falha ao ler learning plane: ${error?.message || 'erro desconhecido'}.`,
        },
      };
    }
  }

  private resolveState(reviewState: string, lifecycle: string): ExperienceLearningCandidateState {
    if (lifecycle === 'trusted_local' || lifecycle === 'published') return 'promoted';
    if (lifecycle === 'quarantined') return 'quarantined';
    if (reviewState === 'rejected') return 'rejected';
    return 'pending';
  }

  private impactFor(state: ExperienceLearningCandidateState): string {
    if (state === 'promoted') return 'Pode influenciar rotas futuras, preferencias e procedimentos locais.';
    if (state === 'quarantined' || state === 'rejected') return 'Nao altera comportamento futuro.';
    return 'Aguardando revisao antes de alterar comportamento.';
  }

  private suggestedActionFor(state: ExperienceLearningCandidateState, confidence: number): string {
    if (state === 'promoted') return 'Manter, revogar ou exportar quando quiser auditar.';
    if (state === 'quarantined' || state === 'rejected') return 'Revisar somente se o padrao voltar a ser util.';
    if (confidence >= 0.8) return 'Aprovar e promover se esse padrao representa seu fluxo real.';
    return 'Aprovar como draft ou rejeitar para manter o runtime limpo.';
  }

  private isSecurityPolicyCandidate(candidate: LearningPlaneSnapshot['candidates'][number]): boolean {
    const haystack = [
      candidate.id,
      candidate.platformEntryId,
      candidate.title,
      candidate.kind,
      candidate.summary,
      candidate.source.workflow,
      candidate.source.objective,
      ...candidate.steps,
      ...candidate.details,
    ].join('\n').toLowerCase();

    const protectedSignals = [
      'workspacefspolicy',
      'intent safety',
      'intentsafetyclassifier',
      'policy broker',
      'securitypolicybroker',
      'sandboxpolicy',
      'shell policy',
      'egress',
      'allowlist',
      'blocklist',
      'approval',
      'permissions',
      'permissoes',
      'seguranca',
      'security',
      'bypass',
      'disable safety',
      'desativar seguranca',
      'sempre permitir shell',
      'never ask approval',
      'sem approval',
    ];
    return protectedSignals.some((signal) => haystack.includes(signal));
  }
}
