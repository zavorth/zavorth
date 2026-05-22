import {
  EXPERIENCE_ACTION_CARD_CONTRACT_VERSION,
  type ExperienceAction,
  type ExperienceActionCard,
  type ExperienceAutoHealing,
  type ExperienceContextRecovery,
  type ExperienceDiffReview,
  type ExperienceLearningCandidate,
} from './ExperienceContracts.js';
import type {
  UniversalAgentRun,
  UniversalApprovalRequest,
  UniversalToolRiskLevel,
} from '../../runtime/agent/UniversalAgentRuntimeTypes.js';

export type ActionCardBuildInput = {
  activeRun?: UniversalAgentRun | null;
  approvals?: UniversalApprovalRequest[];
  learningCandidates?: ExperienceLearningCandidate[];
  diffReviews?: ExperienceDiffReview[];
  contextRecovery?: ExperienceContextRecovery | null;
  autoHealing?: ExperienceAutoHealing | null;
  now?: Date;
};

function makeAction(input: {
  id: string;
  label: string;
  kind: ExperienceAction['kind'];
  reason: string;
  command?: string | null;
  route?: string | null;
  risk?: UniversalToolRiskLevel;
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

function safeList(values: string[], limit = 8): string[] {
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .slice(0, limit);
}

export class ActionCardService {
  public build(input: ActionCardBuildInput = {}): ExperienceActionCard[] {
    const now = (input.now || new Date()).toISOString();
    const cards: ExperienceActionCard[] = [
      ...this.approvalCards(input.approvals || [], input.activeRun, now),
      ...this.diffCards(input.diffReviews || [], input.activeRun, now),
      ...this.learningCards(input.learningCandidates || [], now),
      ...this.contextCards(input.contextRecovery, now),
      ...this.autoHealingCards(input.autoHealing, input.activeRun, now),
    ];

    return cards
      .sort((left, right) => this.statusWeight(left.status) - this.statusWeight(right.status))
      .slice(0, 12);
  }

  private approvalCards(
    approvals: UniversalApprovalRequest[],
    activeRun: UniversalAgentRun | null | undefined,
    now: string,
  ): ExperienceActionCard[] {
    return approvals
      .filter((approval) => approval.status === 'pending')
      .slice(0, 6)
      .map((approval) => ({
        contractVersion: EXPERIENCE_ACTION_CARD_CONTRACT_VERSION,
        id: `card:approval:${approval.id}`,
        source: 'approval',
        title: approval.title || 'Aprovacao pendente',
        summary: approval.reason || 'Acao sensivel aguardando decisao.',
        risk: approval.risk,
        status: 'pending',
        scope: activeRun?.workspace || 'workspace atual',
        sandbox: String(activeRun?.metadata?.sandboxIsolation || 'governed-local'),
        affectedFiles: this.metadataStrings(activeRun, ['affectedFiles', 'files', 'paths']),
        affectedCommands: this.metadataStrings(activeRun, ['affectedCommands', 'commands', 'validationCommands']),
        ttlSeconds: this.ttlSeconds(approval.createdAt, 24 * 60 * 60),
        receiptHint: `Receipt de decisao para ${approval.id}.`,
        createdAt: approval.createdAt || now,
        actions: [
          makeAction({
            id: `approve:${approval.id}`,
            label: 'Aprovar',
            kind: 'approval',
            command: `zavorth approve ${approval.id}`,
            risk: approval.risk,
            requiresApproval: false,
            reason: 'Autoriza a acao governada e registra receipt.',
          }),
          makeAction({
            id: `reject:${approval.id}`,
            label: 'Rejeitar',
            kind: 'approval',
            command: `zavorth reject ${approval.id}`,
            risk: approval.risk,
            reason: 'Mantem o bloqueio e registra a decisao.',
          }),
          makeAction({
            id: `view-diff:${approval.runId}`,
            label: 'Ver diff',
            kind: 'diff',
            command: `zavorth diff ${approval.runId}`,
            risk: 'safe',
            reason: 'Mostra resumo seguro antes da aprovacao.',
          }),
        ],
      }));
  }

  private diffCards(
    reviews: ExperienceDiffReview[],
    activeRun: UniversalAgentRun | null | undefined,
    now: string,
  ): ExperienceActionCard[] {
    return reviews
      .filter((review) => review.status !== 'empty')
      .slice(0, 3)
      .map((review) => ({
        contractVersion: EXPERIENCE_ACTION_CARD_CONTRACT_VERSION,
        id: `card:diff:${review.id}`,
        source: 'mutation',
        title: review.title,
        summary: review.summary,
        risk: review.risk,
        status: review.status === 'approved' ? 'approved' : review.status === 'rejected' ? 'rejected' : 'pending',
        scope: activeRun?.workspace || 'sandbox governado',
        sandbox: String(activeRun?.metadata?.sandboxIsolation || 'governed-local'),
        affectedFiles: safeList(review.files.map((file) => file.path), 10),
        affectedCommands: this.metadataStrings(activeRun, ['validationCommands', 'commands']),
        ttlSeconds: null,
        receiptHint: `Receipt de diff parcial para ${review.id}.`,
        createdAt: activeRun?.updatedAt || now,
        actions: [
          makeAction({
            id: `diff:approve-plan:${review.id}`,
            label: 'Aprovar plano',
            kind: 'diff',
            command: `zavorth diff approve ${review.id}`,
            risk: review.risk,
            requiresApproval: true,
            reason: 'Recompoe o mutation plan e passa por policy antes do host.',
          }),
          makeAction({
            id: `diff:review:${review.id}`,
            label: 'Revisar hunks',
            kind: 'diff',
            command: `zavorth diff ${review.id}`,
            risk: 'safe',
            reason: 'Permite aprovar ou rejeitar partes sem aplicar direto no host.',
          }),
        ],
      }));
  }

  private learningCards(candidates: ExperienceLearningCandidate[], now: string): ExperienceActionCard[] {
    return candidates
      .filter((candidate) => candidate.state === 'pending')
      .slice(0, 4)
      .map((candidate) => ({
        contractVersion: EXPERIENCE_ACTION_CARD_CONTRACT_VERSION,
        id: `card:learning:${candidate.id}`,
        source: 'learning',
        title: candidate.title,
        summary: candidate.recommendation,
        risk: candidate.confidence >= 0.85 ? 'safe' : 'attention',
        status: 'pending',
        scope: candidate.origin || 'learning local',
        sandbox: 'not-applicable',
        affectedFiles: [],
        affectedCommands: [],
        ttlSeconds: null,
        receiptHint: `Receipt de aprendizado para ${candidate.id}.`,
        createdAt: candidate.createdAt || now,
        actions: [
          makeAction({
            id: `learn:approve:${candidate.id}`,
            label: 'Aprovar aprendizado',
            kind: 'learning',
            command: `zavorth learn approve ${candidate.id}`,
            reason: 'Promove apenas com consentimento explicito.',
          }),
          makeAction({
            id: `learn:reject:${candidate.id}`,
            label: 'Rejeitar',
            kind: 'learning',
            command: `zavorth learn reject ${candidate.id}`,
            reason: 'Mantem o comportamento futuro inalterado.',
          }),
        ],
      }));
  }

  private contextCards(recovery: ExperienceContextRecovery | null | undefined, now: string): ExperienceActionCard[] {
    if (!recovery || recovery.status !== 'needs-selection') return [];
    return [{
      contractVersion: EXPERIENCE_ACTION_CARD_CONTRACT_VERSION,
      id: `card:context:${recovery.id}`,
      source: 'context-recovery',
      title: 'Escolha o contexto correto',
      summary: recovery.question,
      risk: 'safe',
      status: 'pending',
      scope: 'desambiguacao',
      sandbox: 'not-applicable',
      affectedFiles: [],
      affectedCommands: [],
      ttlSeconds: 30 * 60,
      receiptHint: `Receipt de contexto para ${recovery.id}.`,
      createdAt: now,
      actions: recovery.options.slice(0, 4).map((option) => makeAction({
        id: `context:${recovery.id}:${option.id}`,
        label: option.label,
        kind: 'context',
        command: option.command,
        risk: 'safe',
        reason: option.detail,
      })),
    }];
  }

  private autoHealingCards(
    healing: ExperienceAutoHealing | null | undefined,
    activeRun: UniversalAgentRun | null | undefined,
    now: string,
  ): ExperienceActionCard[] {
    if (!healing || healing.status === 'idle') return [];
    return [{
      contractVersion: EXPERIENCE_ACTION_CARD_CONTRACT_VERSION,
      id: `card:healing:${activeRun?.id || 'current'}`,
      source: 'sandbox',
      title: healing.status === 'running' ? 'Auto-healing em andamento' : 'Resultado do auto-healing',
      summary: healing.lastErrorSummary || healing.proposedCorrection || 'Validacao especulativa registrada.',
      risk: healing.status === 'blocked' || healing.status === 'failed' ? 'attention' : 'safe',
      status: healing.status === 'passed' ? 'ready' : healing.status === 'failed' ? 'blocked' : 'pending',
      scope: activeRun?.workspace || 'sandbox governado',
      sandbox: String(activeRun?.metadata?.sandboxIsolation || 'governed-local'),
      affectedFiles: this.metadataStrings(activeRun, ['affectedFiles', 'files', 'paths']),
      affectedCommands: safeList([healing.validationCommand || '', ...this.metadataStrings(activeRun, ['validationCommands'])]),
      ttlSeconds: null,
      receiptHint: `Receipt de auto-healing para ${activeRun?.id || 'run atual'}.`,
      createdAt: activeRun?.updatedAt || now,
      actions: [
        makeAction({
          id: `healing:validate:${activeRun?.id || 'current'}`,
          label: 'Rodar validacao',
          kind: 'healing',
          command: 'zavorth run "rode validacao em sandbox"',
          risk: 'attention',
          requiresApproval: true,
          reason: 'Validacoes com comandos locais continuam governadas por policy.',
        }),
      ],
    }];
  }

  private metadataStrings(run: UniversalAgentRun | null | undefined, keys: string[]): string[] {
    const metadata = run?.metadata || {};
    const values = keys.flatMap((key) => {
      const value = metadata[key];
      if (Array.isArray(value)) return value.map((item) => String(item));
      if (typeof value === 'string') return value.split(/\r?\n|,/g);
      return [];
    });
    return safeList(values);
  }

  private ttlSeconds(createdAt: string, ttlSeconds: number): number | null {
    const created = Date.parse(createdAt);
    if (!Number.isFinite(created)) return ttlSeconds;
    const remaining = Math.ceil((created + ttlSeconds * 1000 - Date.now()) / 1000);
    return Math.max(0, remaining);
  }

  private statusWeight(status: ExperienceActionCard['status']): number {
    if (status === 'pending') return 0;
    if (status === 'blocked') return 1;
    if (status === 'ready') return 2;
    return 3;
  }
}
