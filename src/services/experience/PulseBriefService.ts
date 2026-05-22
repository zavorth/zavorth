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
import type {
  UniversalAgentRun,
  UniversalApprovalRequest,
} from '../../runtime/agent/UniversalAgentRuntimeTypes.js';

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
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function compactList(items: string[], limit: number): string[] {
  return items.map((item) => clean(item)).filter(Boolean).slice(0, limit);
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
    const highlights = compactList([
      activeTask ? `Tarefa ativa: ${activeTask}` : '',
      lastRun?.summary ? `Ultima atividade: ${lastRun.summary}` : '',
      input.workspace ? `Workspace: ${input.workspace}` : '',
      input.trust.sandbox.mode ? `Sandbox: ${input.trust.sandbox.mode}` : '',
      profile.summary,
    ], 5);
    const risks = compactList([
      ...input.health.warnings,
      pendingApprovals > 0 ? `${pendingApprovals} aprovacao(oes) aguardando decisao.` : '',
      input.trust.risk !== 'safe' ? `Trust Lens marcou risco ${input.trust.risk}.` : '',
      input.actionCards.some((card) => card.risk === 'danger') ? 'Ha action card com risco alto.' : '',
    ], 5);

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
    const requested = input.requestedProfile || this.profileFromMetadata(input.activeRun?.metadata) || this.defaultProfile(input);
    return this.profile(requested);
  }

  private profile(id: ExperienceResponseProfileId): ExperienceResponseProfile {
    const profiles: Record<ExperienceResponseProfileId, ExperienceResponseProfile> = {
      short: {
        contractVersion: EXPERIENCE_RESPONSE_PROFILE_CONTRACT_VERSION,
        id: 'short',
        label: 'Curto',
        summary: 'Respostas diretas, com foco no proximo passo e sem excesso de detalhe.',
        tone: 'objetivo',
        structure: ['resultado', 'proxima acao', 'risco se existir'],
        defaultDetail: 'compact',
        appliesTo: ['cli', 'web', 'telegram', 'discord', 'api'],
        commands: ['zavorth ask "use estilo curto"', 'zavorth ask "responda de forma objetiva"'],
        canChange: true,
      },
      dev: {
        contractVersion: EXPERIENCE_RESPONSE_PROFILE_CONTRACT_VERSION,
        id: 'dev',
        label: 'Dev',
        summary: 'Respostas tecnicas com arquivos, comandos, testes e evidencias.',
        tone: 'engenharia clara',
        structure: ['plano', 'mudancas', 'validacao', 'riscos'],
        defaultDetail: 'balanced',
        appliesTo: ['cli', 'web', 'api'],
        commands: ['zavorth ask "use estilo dev"', 'zavorth ask "inclua arquivos e testes"'],
        canChange: true,
      },
      executive: {
        contractVersion: EXPERIENCE_RESPONSE_PROFILE_CONTRACT_VERSION,
        id: 'executive',
        label: 'Executivo',
        summary: 'Resumo de impacto, decisao necessaria, risco e evidencia curta.',
        tone: 'executivo',
        structure: ['impacto', 'decisao', 'risco', 'evidencia'],
        defaultDetail: 'compact',
        appliesTo: ['web', 'telegram', 'discord', 'api'],
        commands: ['zavorth ask "use estilo executivo"', 'zavorth ask "resuma impacto e decisao"'],
        canChange: true,
      },
      mentor: {
        contractVersion: EXPERIENCE_RESPONSE_PROFILE_CONTRACT_VERSION,
        id: 'mentor',
        label: 'Mentor',
        summary: 'Explica o caminho enquanto executa, sem expor raciocinio bruto.',
        tone: 'didatico',
        structure: ['o que entendi', 'por que importa', 'como vou agir', 'como validar'],
        defaultDetail: 'deep',
        appliesTo: ['cli', 'web', 'api'],
        commands: ['zavorth ask "use estilo mentor"', 'zavorth ask "explique enquanto trabalha"'],
        canChange: true,
      },
    };
    return profiles[id] || profiles.dev;
  }

  private defaultProfile(input: { surface: ExperienceSurface; activeRun?: UniversalAgentRun | null }): ExperienceResponseProfileId {
    if (input.surface === 'telegram' || input.surface === 'discord') return 'short';
    const kind = clean(input.activeRun?.metadata?.experiencePlan && typeof input.activeRun.metadata.experiencePlan === 'object'
      ? (input.activeRun.metadata.experiencePlan as Record<string, unknown>).kind
      : '');
    if (/security|audit|code|workspace|release/.test(kind)) return 'dev';
    return input.surface === 'web' ? 'executive' : 'dev';
  }

  private profileFromMetadata(metadata: Record<string, unknown> | undefined): ExperienceResponseProfileId | null {
    const raw = clean(metadata?.responseProfile || metadata?.answerStyle || metadata?.style || metadata?.replyStyle).toLowerCase();
    if (raw === 'short' || raw === 'curto' || raw === 'objetivo') return 'short';
    if (raw === 'dev' || raw === 'developer' || raw === 'tecnico' || raw === 'technical') return 'dev';
    if (raw === 'executive' || raw === 'executivo' || raw === 'manager') return 'executive';
    if (raw === 'mentor' || raw === 'didatico' || raw === 'teacher') return 'mentor';
    return null;
  }

  private pickBestNextAction(input: PulseBriefBuildInput, pendingApprovals: number): ExperienceAction {
    const pendingCard = input.actionCards.find((card) => card.status === 'pending');
    const cardAction = pendingCard?.actions.find((action) => action.command);
    if (cardAction) return cardAction;
    if (pendingApprovals > 0) {
      const approval = input.approvals.find((item) => item.status === 'pending');
      return {
        id: 'daily.approval.review',
        label: approval ? `Revisar aprovacao ${approval.id}` : 'Revisar aprovacoes',
        kind: 'approval',
        command: approval ? `zavorth approve ${approval.id}` : 'zavorth approve',
        route: '/control',
        risk: approval?.risk || 'attention',
        requiresApproval: false,
        reason: 'Ha uma acao governada aguardando sua decisao.',
      };
    }
    if (input.learningPending > 0) {
      return {
        id: 'daily.learning.review',
        label: 'Revisar aprendizados pendentes',
        kind: 'learning',
        command: 'zavorth learn',
        route: '/control',
        risk: 'safe',
        requiresApproval: false,
        reason: 'Promove apenas preferencias aprovadas pelo usuario.',
      };
    }
    return input.nextActions[0] || {
      id: 'daily.ask',
      label: 'Pedir algo ao Zavorth',
      kind: 'natural',
      command: 'zavorth ask "<pedido>"',
      route: null,
      risk: 'safe',
      requiresApproval: false,
      reason: 'Entrada natural-first principal.',
    };
  }

  private headline(
    status: ExperienceHealthStatus,
    pendingApprovals: number,
    pendingLearning: number,
    activeTask: string | null,
  ): string {
    if (pendingApprovals > 0) return `${pendingApprovals} decisao(oes) aguardando sua aprovacao.`;
    if (activeTask) return `Trabalhando em: ${clean(activeTask, 'tarefa ativa')}.`;
    if (pendingLearning > 0) return `${pendingLearning} aprendizado(s) aguardando revisao.`;
    if (status === 'ready') return 'Zavorth pronto para o proximo pedido.';
    return 'Zavorth precisa de atencao antes do proximo fluxo.';
  }

  private summary(input: PulseBriefBuildInput, pendingApprovals: number, profile: ExperienceResponseProfile): string {
    const parts = [
      input.health.summary,
      pendingApprovals > 0 ? 'ha aprovacoes pendentes' : 'sem aprovacoes pendentes',
      input.learningPending > 0 ? `${input.learningPending} learning pendente` : 'learning em dia',
      `perfil ${profile.label}`,
    ];
    return parts.map((part) => clean(part)).filter(Boolean).join(' | ');
  }
}
