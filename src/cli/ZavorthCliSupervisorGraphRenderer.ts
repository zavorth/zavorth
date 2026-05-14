import type {
  ZavorthSupervisorGraphNode,
  ZavorthSupervisorGraphSnapshot,
} from '../services/ZavorthSupervisorGraphService.js';
import { formatCliValue, sanitizeHumanCliText } from './ZavorthCliText.js';
import { renderCliScreen, type CliVisualPanel } from './ZavorthCliVisualSystem.js';

function compact(value: string | null | undefined, maxLength = 96): string {
  const normalized = sanitizeHumanCliText(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'nao informado';
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function nodeLine(node: ZavorthSupervisorGraphNode): string {
  const capability = node.capability ? ` | cap ${node.capability}` : '';
  const approval = node.requiresApproval ? ' | aprova' : '';
  return `- ${node.id}: ${node.status}${capability}${approval}`;
}

export function formatSupervisorGraphSnapshot(snapshot: ZavorthSupervisorGraphSnapshot): string {
  const activeNodes = snapshot.nodes.filter((node) => node.status !== 'skipped');
  const ledgerLines = snapshot.ledger.slice(0, 7).map((entry) =>
    `- ${entry.step}. ${entry.from} -> ${entry.to}: ${compact(entry.decision, 72)}`);
  const correctionLines = snapshot.reflexion.correctionLoop.length > 0
    ? snapshot.reflexion.correctionLoop.map((attempt) =>
        `- tentativa ${attempt.attempt}: ${attempt.from} -> ${attempt.to} | retries restantes ${attempt.retryBudgetRemaining}`)
    : ['- nenhuma correcao acionada nesta previa'];

  const panels: CliVisualPanel[] = [
    {
      title: 'Modo',
      tone: snapshot.status === 'paused' ? 'warning' : snapshot.mode === 'graph' ? 'brand' : 'success',
      lines: [
        `- modo: ${snapshot.mode}`,
        `- status: ${snapshot.status}`,
        `- score: ${snapshot.complexity.score}/${snapshot.complexity.threshold}`,
        `- objetivo: ${compact(snapshot.objective.preview, 88)}`,
      ],
    },
    {
      title: 'Budget',
      tone: snapshot.budget.exceeded ? 'warning' : 'success',
      lines: [
        `- max retries: ${snapshot.budget.maxRetries}`,
        `- max cost: ${snapshot.budget.maxCost} | estimado: ${snapshot.budget.estimatedCost}`,
        `- restante: ${snapshot.budget.remainingCost}`,
        `- pausa: ${snapshot.budget.pauseReason || 'nao'}`,
      ],
    },
    {
      title: 'DAG',
      tone: snapshot.mode === 'graph' ? 'info' : 'neutral',
      lines: activeNodes.length > 0 ? activeNodes.map(nodeLine) : ['- nenhum nodo ativo'],
    },
    {
      title: 'Reflexion',
      tone: snapshot.reflexion.attemptsUsed > 0 ? 'warning' : 'neutral',
      lines: [
        `- ativo: ${snapshot.reflexion.enabled ? 'sim' : 'nao'}`,
        `- tentativas usadas: ${snapshot.reflexion.attemptsUsed}`,
        ...correctionLines,
      ],
    },
    {
      title: 'Ledger',
      tone: snapshot.contracts.everyTransitionHasEvidence ? 'success' : 'warning',
      lines: ledgerLines.length > 0 ? ledgerLines : ['- nenhum evento registrado'],
    },
    {
      title: 'Contratos',
      tone: Object.values(snapshot.contracts).every(Boolean) ? 'success' : 'warning',
      lines: [
        `- supervisor muta: ${snapshot.contracts.supervisorDoesNotMutate ? 'nao' : 'sim'}`,
        `- critic antes delivery: ${snapshot.contracts.criticBeforeDelivery ? 'sim' : 'nao'}`,
        `- sandbox antes risco: ${snapshot.contracts.sandboxBeforeRiskyDelivery ? 'sim' : 'nao'}`,
        `- evidencias redigidas: ${snapshot.contracts.sensitiveDataRedacted ? 'sim' : 'nao'}`,
      ],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Supervisor',
    eyebrowTone: snapshot.status === 'paused' ? 'warning' : 'success',
    title: 'Supervisor Graph do Zavorth',
    summary: formatCliValue(snapshot.narrative.headline, 'Grafo supervisor pronto.'),
    mode: 'compact',
    showWordmark: false,
    panels,
  });
}
