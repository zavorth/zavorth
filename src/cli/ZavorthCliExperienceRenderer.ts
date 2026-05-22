import type {
  ExperienceActionCard,
  ExperienceCommandResult,
  ExperienceDiffReview,
  ExperienceLearningCandidate,
  ExperienceSnapshot,
  ExperienceTimelineItem,
} from '../services/experience/index.js';
import { renderCliScreen, type CliVisualPanel } from './ZavorthCliVisualSystem.js';
import { formatCliValue, formatCount, sanitizeHumanCliText } from './ZavorthCliText.js';

function formatBudgetNumber(value: number | null | undefined): string {
  return formatCliValue(typeof value === 'number' && Number.isFinite(value) ? String(value) : 'n/a');
}

function renderTimeline(items: ExperienceTimelineItem[]): string[] {
  if (!items.length) {
    return ['Sem timeline ativa. Envie um pedido natural para iniciar uma jornada.'];
  }
  return items.slice(-5).map((item) =>
    `${item.status} | ${sanitizeHumanCliText(item.title)} - ${sanitizeHumanCliText(item.detail)}`);
}

function renderLearning(candidates: ExperienceLearningCandidate[]): string[] {
  if (!candidates.length) {
    return ['Nenhum aprendizado pendente. O Zavorth vai propor candidatos apos runs confiaveis.'];
  }
  return candidates.slice(0, 5).map((candidate) =>
    `${candidate.state} | ${candidate.id} | ${sanitizeHumanCliText(candidate.title)} (${Math.round(candidate.confidence * 100)}%)`);
}

function renderActionCards(cards: ExperienceActionCard[] = []): string[] {
  if (!cards.length) {
    return ['Nenhuma acao pendente. Quando algo importar, aparece aqui com risco, escopo e comando.'];
  }
  return cards.slice(0, 6).flatMap((card, index) => {
    const actions = card.actions.filter((item) => item.command).slice(0, 3);
    return [
      `[${index + 1}] ${card.status} | ${card.risk} | ${sanitizeHumanCliText(card.title)}`,
      `    escopo: ${sanitizeHumanCliText(card.scope || 'workspace')} | sandbox: ${sanitizeHumanCliText(card.sandbox || 'governed')}`,
      ...actions.map((action) => `    ${sanitizeHumanCliText(action.label)} -> ${action.command}`),
    ];
  });
}

function renderDiffReviews(reviews: ExperienceDiffReview[] = []): string[] {
  if (!reviews.length) {
    return ['Nenhum diff de sandbox disponivel para revisao.'];
  }
  return reviews.slice(0, 4).flatMap((review) => [
    `${review.status} | ${review.risk} | ${sanitizeHumanCliText(review.summary)} (${review.id})`,
    review.recomposition?.summary ? `  recomposicao: ${sanitizeHumanCliText(review.recomposition.summary)}` : '',
    ...review.files.slice(0, 5).map((file) =>
      `  ${file.path} | +${file.addedLines}/-${file.removedLines} | ${formatCount(file.hunks.length, 'hunk')}`),
    ...review.files.slice(0, 2).flatMap((file) =>
      file.hunks.slice(0, 3).map((hunk) =>
        `    ${hunk.id} | ${hunk.risk} | ${sanitizeHumanCliText(hunk.header)} -> approve-hunk/reject-hunk`)),
  ]);
}

function renderReasoning(snapshot: ExperienceSnapshot): string[] {
  const summary = snapshot.reasoningSummary;
  if (!summary) return ['Resumo seguro indisponivel nesta versao do snapshot.'];
  return [
    `Entendi: ${sanitizeHumanCliText(summary.understood)}`,
    `Risco: ${summary.risk}`,
    `Ferramentas: ${summary.tools.length ? summary.tools.join(', ') : 'nenhuma ferramenta anunciada'}`,
    summary.approvalReason ? `Approval: ${sanitizeHumanCliText(summary.approvalReason)}` : 'Approval: nao necessario agora',
    `Proximo: ${sanitizeHumanCliText(summary.nextAction)}`,
  ];
}

function renderZavorthPulse(snapshot: ExperienceSnapshot): string[] {
  const pulse = snapshot.daily?.pulse;
  if (!pulse) {
    return [sanitizeHumanCliText(snapshot.daily?.summary || snapshot.health.summary)];
  }
  return [
    sanitizeHumanCliText(pulse.headline),
    sanitizeHumanCliText(pulse.summary),
    `Melhor proxima acao: ${sanitizeHumanCliText(pulse.bestNextAction.label)}${pulse.bestNextAction.command ? ` -> ${pulse.bestNextAction.command}` : ''}`,
    `Pendencias: approvals ${pulse.pending.approvals} | learning ${pulse.pending.learning} | receipts ${pulse.pending.receipts}`,
    ...pulse.highlights.slice(0, 3).map((item) => `+ ${sanitizeHumanCliText(item)}`),
    ...pulse.risks.slice(0, 3).map((item) => `! ${sanitizeHumanCliText(item)}`),
  ];
}

function renderResponseProfile(snapshot: ExperienceSnapshot): string[] {
  const profile = snapshot.responseProfile || snapshot.daily?.responseProfile || snapshot.daily?.pulse?.profile;
  if (!profile) {
    return ['Perfil padrao: Dev. Use zavorth ask "use estilo curto/dev/executivo/mentor" para ajustar.'];
  }
  return [
    `${profile.label} (${profile.id}) | detalhe ${profile.defaultDetail}`,
    sanitizeHumanCliText(profile.summary),
    `Estrutura: ${profile.structure.join(' -> ')}`,
    ...profile.commands.slice(0, 2).map((command) => `Comando: ${command}`),
  ];
}

function renderHudShortcuts(snapshot: ExperienceSnapshot): string[] {
  const firstCard = (snapshot.actionCards || [])[0];
  const approveAction = firstCard?.actions.find((action) => /approve|aprovar/i.test(action.id) && action.command);
  const rejectAction = firstCard?.actions.find((action) => /reject|rejeitar/i.test(action.id) && action.command);
  const firstReview = (snapshot.diffReviews || [])[0];
  return [
    approveAction ? `Y aprovar primeiro card -> ${approveAction.command}` : 'Y aprovar primeiro card -> sem action card pendente',
    rejectAction ? `N rejeitar primeiro card -> ${rejectAction.command}` : 'N rejeitar primeiro card -> sem action card pendente',
    firstReview ? `D abrir diff -> zavorth diff ${firstReview.id}` : 'D abrir diff -> nenhum diff pendente',
    'L revisar learning -> zavorth learn',
    'O abrir dashboard -> zavorth open',
  ];
}

export function formatExperienceHome(snapshot: ExperienceSnapshot): string {
  const panels: CliVisualPanel[] = [
    {
      title: 'Agente',
      tone: snapshot.agent.status === 'ready' ? 'success' : snapshot.agent.status === 'blocked' ? 'danger' : 'warning',
      lines: [
        `Status: ${snapshot.agent.status}`,
        `Sessao: ${formatCliValue(snapshot.sessionId || 'nova')}`,
        `Modelo: ${formatCliValue(snapshot.agent.modelLabel || 'modelo atual')}`,
        sanitizeHumanCliText(snapshot.agent.summary),
      ],
    },
    {
      title: 'Zavorth Pulse',
      tone: 'brand',
      lines: renderZavorthPulse(snapshot),
    },
    {
      title: 'Estilo de resposta',
      tone: 'neutral',
      lines: renderResponseProfile(snapshot),
    },
    {
      title: 'Proximas acoes',
      tone: 'neutral',
      lines: snapshot.nextActions.slice(0, 5).map((action) =>
        `${sanitizeHumanCliText(action.label)}${action.command ? ` -> ${action.command}` : ''}`),
    },
    {
      title: 'Action cards',
      tone: (snapshot.actionCards || []).length > 0 ? 'warning' : 'success',
      lines: renderActionCards(snapshot.actionCards),
    },
    {
      title: 'Timeline',
      tone: 'muted',
      lines: renderTimeline(snapshot.timeline),
    },
    {
      title: 'Aprendizado',
      tone: snapshot.learning.pending > 0 ? 'warning' : 'success',
      lines: renderLearning(snapshot.learning.candidates),
    },
  ];

  return renderCliScreen({
    eyebrow: 'Experience Core',
    title: 'Zavorth Natural-First',
    summary: 'Fale normalmente. O Zavorth planeja, executa com governanca, mostra receipts e aprende com consentimento.',
    panels,
  });
}

export function formatExperienceHud(snapshot: ExperienceSnapshot): string {
  const panels: CliVisualPanel[] = [
    {
      title: 'Daily HUD',
      tone: snapshot.daily?.health === 'ready' ? 'success' : 'warning',
      lines: [
        ...renderZavorthPulse(snapshot),
        `Workspace: ${formatCliValue(snapshot.workspace || 'padrao')}`,
        `Autonomia: ${snapshot.trust.sandbox.mode}`,
      ],
    },
    {
      title: 'Perfil',
      tone: 'neutral',
      lines: renderResponseProfile(snapshot),
    },
    {
      title: 'Cards',
      tone: (snapshot.actionCards || []).length > 0 ? 'warning' : 'success',
      lines: renderActionCards(snapshot.actionCards),
    },
    {
      title: 'Atalhos de uso diario',
      tone: 'brand',
      lines: renderHudShortcuts(snapshot),
    },
    {
      title: 'Diff review',
      tone: (snapshot.diffReviews || []).some((review) => review.status !== 'empty') ? 'brand' : 'muted',
      lines: renderDiffReviews(snapshot.diffReviews),
    },
    {
      title: 'Auto-healing',
      tone: snapshot.autoHealing?.status === 'failed' || snapshot.autoHealing?.status === 'blocked'
        ? 'danger'
        : snapshot.autoHealing?.status === 'running'
          ? 'warning'
          : 'success',
      lines: [
        `Status: ${snapshot.autoHealing?.status || 'idle'}`,
        `Tentativa: ${snapshot.autoHealing?.attempt || 0}/${snapshot.autoHealing?.maxAttempts || 3}`,
        `Validacao: ${formatCliValue(snapshot.autoHealing?.validationCommand || 'nao detectada')}`,
        `Budget: ${Math.round((snapshot.autoHealing?.budget?.elapsedMs || 0) / 1000)}s/${Math.round((snapshot.autoHealing?.budget?.maxElapsedMs || 120000) / 1000)}s | tokens ${formatBudgetNumber(snapshot.autoHealing?.budget?.tokensUsed)}/${formatBudgetNumber(snapshot.autoHealing?.budget?.tokenBudget)}`,
        snapshot.autoHealing?.budget?.cancellable
          ? `Cancelar: ${snapshot.autoHealing.budget.cancelCommand || 'acao indisponivel'}`
          : 'Cancelar: indisponivel',
        sanitizeHumanCliText(snapshot.autoHealing?.lastErrorSummary || snapshot.autoHealing?.proposedCorrection || 'Sem autocorrecao ativa.'),
      ],
    },
    {
      title: 'Contexto',
      tone: snapshot.contextRecovery?.status === 'needs-selection' ? 'warning' : 'muted',
      lines: snapshot.contextRecovery?.status === 'needs-selection'
        ? [
            sanitizeHumanCliText(snapshot.contextRecovery.question),
            ...snapshot.contextRecovery.options.slice(0, 5).map((option, index) =>
              `${index + 1}. ${sanitizeHumanCliText(option.label)} -> ${option.command}`),
          ]
        : ['Sem ambiguidade pendente.'],
    },
    {
      title: 'Raciocinio seguro',
      tone: 'neutral',
      lines: [
        ...renderReasoning(snapshot),
        'Obs: o raciocinio bruto do modelo permanece privado; este resumo mostra decisoes, riscos e evidencias operacionais.',
      ],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Daily Experience Control Plane',
    title: 'Zavorth HUD',
    summary: 'Mesmo estado do /control e dos canais: timeline, approvals, diff, sandbox, receipts e learning.',
    panels,
  });
}

export function formatExperienceDiffs(snapshot: ExperienceSnapshot): string {
  const reviews = snapshot.diffReviews || [];
  const panels: CliVisualPanel[] = reviews.length
    ? reviews.map((review) => ({
        title: review.title,
        tone: review.risk === 'danger' ? 'danger' : review.risk === 'attention' ? 'warning' : 'brand',
        lines: [
          `${review.id} | ${review.status} | ${review.summary}`,
          ...review.files.flatMap((file) => [
            `${file.path} | +${file.addedLines}/-${file.removedLines} | ${formatCount(file.hunks.length, 'hunk')}`,
            ...file.hunks.slice(0, 4).flatMap((hunk) => [
              `  ${hunk.id} | ${hunk.risk} | ${hunk.header}`,
              ...hunk.preview.slice(0, 5).map((line) => `    ${line}`),
            ]),
          ]),
          'Acoes: zavorth diff approve <reviewId> | zavorth diff reject-hunk <hunkId> | zavorth diff retry <reviewId>',
        ],
      }))
    : [{
        title: 'Diff review',
        tone: 'muted',
        lines: ['Nenhum diff governado foi encontrado no snapshot atual.'],
      }];

  return renderCliScreen({
    eyebrow: 'Diff Review',
    title: 'Revisao parcial governada',
    summary: 'Nenhum hunk e aplicado direto no host: selecoes recompoem um mutation plan e passam por policy.',
    panels,
    showWordmark: false,
  });
}

export function formatExperienceCommandResult(result: ExperienceCommandResult): string {
  const replyText = result.replies.map((reply) => sanitizeHumanCliText(reply.text)).filter(Boolean).join('\n\n');
  const panels: CliVisualPanel[] = [
    {
      title: 'Plano',
      tone: result.plan.risk === 'danger' ? 'danger' : result.plan.requiresApproval ? 'warning' : 'brand',
      lines: [
        sanitizeHumanCliText(result.plan.title),
        sanitizeHumanCliText(result.plan.summary),
        `Risco: ${result.plan.risk}`,
        `Approval: ${result.plan.requiresApproval ? 'necessario' : 'nao necessario'}`,
        `Proximo: ${sanitizeHumanCliText(result.plan.nextSafeAction)}`,
      ],
    },
    {
      title: 'Resposta',
      tone: result.ok ? 'success' : 'danger',
      lines: [replyText || (result.ok ? 'Pedido processado.' : result.error || 'Falha no Experience Core.')],
    },
    {
      title: 'Estilo aplicado',
      tone: 'neutral',
      lines: renderResponseProfile(result.snapshot),
    },
    {
      title: 'Receipts',
      tone: 'muted',
      lines: result.receipts.length
        ? result.receipts.slice(0, 5).map((receipt) => `${receipt.status} | ${sanitizeHumanCliText(receipt.title)}`)
        : ['Nenhum receipt emitido ainda.'],
    },
    {
      title: 'Cards',
      tone: (result.snapshot.actionCards || []).length > 0 ? 'warning' : 'success',
      lines: renderActionCards(result.snapshot.actionCards),
    },
    {
      title: 'Raciocinio seguro',
      tone: 'neutral',
      lines: [
        ...renderReasoning(result.snapshot),
        'O raciocinio bruto permanece privado; este resumo e a trilha segura para auditoria e confianca.',
      ],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Natural Command Router',
    title: result.ok ? 'Pedido roteado' : 'Pedido bloqueado',
    summary: result.error || result.snapshot.health.summary,
    panels,
    mode: 'compact',
    showWordmark: false,
  });
}

export function formatExperienceLearning(snapshot: ExperienceSnapshot): string {
  return renderCliScreen({
    eyebrow: 'Learning OS',
    title: 'Aprendizados governados',
    summary: snapshot.learning.summary,
    panels: [
      {
        title: 'Candidatos',
        tone: snapshot.learning.pending > 0 ? 'warning' : 'success',
        lines: renderLearning(snapshot.learning.candidates),
      },
      {
        title: 'Comandos',
        lines: [
          'zavorth learn approve <id>',
          'zavorth learn reject <id>',
          'zavorth learn promote <id>',
          'zavorth learn export --json',
          'zavorth learn reset',
        ],
      },
    ],
  });
}
