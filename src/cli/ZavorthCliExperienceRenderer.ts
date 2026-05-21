import type {
  ExperienceCommandResult,
  ExperienceLearningCandidate,
  ExperienceSnapshot,
  ExperienceTimelineItem,
} from '../services/experience/index.js';
import { renderCliScreen, type CliVisualPanel } from './ZavorthCliVisualSystem.js';
import { formatCliValue, formatCount, sanitizeHumanCliText } from './ZavorthCliText.js';

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
      title: 'Agora',
      tone: 'brand',
      lines: [
        sanitizeHumanCliText(snapshot.journey.title),
        sanitizeHumanCliText(snapshot.journey.summary),
        `Approvals: ${formatCount(snapshot.approvals.filter((approval) => approval.status === 'pending').length, 'approval')}`,
        `Learning pendente: ${formatCount(snapshot.learning.pending, 'candidato')}`,
      ],
    },
    {
      title: 'Proximas acoes',
      tone: 'neutral',
      lines: snapshot.nextActions.slice(0, 5).map((action) =>
        `${sanitizeHumanCliText(action.label)}${action.command ? ` -> ${action.command}` : ''}`),
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
      title: 'Receipts',
      tone: 'muted',
      lines: result.receipts.length
        ? result.receipts.slice(0, 5).map((receipt) => `${receipt.status} | ${sanitizeHumanCliText(receipt.title)}`)
        : ['Nenhum receipt emitido ainda.'],
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
