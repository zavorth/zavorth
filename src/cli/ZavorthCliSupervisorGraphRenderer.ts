import type {
  ZavorthSupervisorGraphNode,
  ZavorthSupervisorGraphSnapshot,
} from '../services/ZavorthSupervisorGraphService.js';
import { formatCliValue, sanitizeHumanCliText } from './ZavorthCliText.js';

import { renderCliScreen, type CliVisualPanel } from './ZavorthCliVisualSystem.js';

function compact(value: string | null | undefined, maxLength = 96): string {
  const normalized = sanitizeHumanCliText(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'not provided';
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
    : ['- no correction triggered in this preview'];

  const panels: CliVisualPanel[] = [
    {
      title: 'Modo',
      tone: snapshot.status === 'paused' ? 'warning' : snapshot.mode === 'graph' ? 'brand' : 'success',
      lines: [
        `- modo: ${snapshot.mode}`,
        `- status: ${snapshot.status}`,
        `- score: ${snapshot.complexity.score}/${snapshot.complexity.threshold}`,
        `- objective: ${compact(snapshot.objective.preview, 88)}`,
      ],
    },
    {
      title: 'Budget',
      tone: snapshot.budget.exceeded ? 'warning' : 'success',
      lines: [
        `- max retries: ${snapshot.budget.maxRetries}`,
        `- max cost: ${snapshot.budget.maxCost} | estimado: ${snapshot.budget.estimatedCost}`,
        `- restante: ${snapshot.budget.remainingCost}`,
        `- pause: ${snapshot.budget.pauseReason || 'no'}`,
      ],
    },
    {
      title: 'DAG',
      tone: snapshot.mode === 'graph' ? 'info' : 'neutral',
      lines: activeNodes.length > 0 ? activeNodes.map(nodeLine) : ['- no active node'],
    },
    {
      title: 'Reflexion',
      tone: snapshot.reflexion.attemptsUsed > 0 ? 'warning' : 'neutral',
      lines: [
        `- active: ${snapshot.reflexion.enabled ? 'yes' : 'no'}`,
        `- tentativas usadas: ${snapshot.reflexion.attemptsUsed}`,
        ...correctionLines,
      ],
    },
    {
      title: 'Ledger',
      tone: snapshot.contracts.everyTransitionHasEvidence ? 'success' : 'warning',
      lines: ledgerLines.length > 0 ? ledgerLines : ['- no event recorded'],
    },
    {
      title: 'Contratos',
      tone: Object.values(snapshot.contracts).every(Boolean) ? 'success' : 'warning',
      lines: [
        `- supervisor mutates: ${snapshot.contracts.supervisorDoesNotMutate ? 'no' : 'yes'}`,
        `- critic before delivery: ${snapshot.contracts.criticBeforeDelivery ? 'yes' : 'no'}`,
        `- sandbox before risk: ${snapshot.contracts.sandboxBeforeRiskyDelivery ? 'yes' : 'no'}`,
        `- redacted evidence: ${snapshot.contracts.sensitiveDataRedacted ? 'yes' : 'no'}`,
      ],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Supervisor',
    eyebrowTone: snapshot.status === 'paused' ? 'warning' : 'success',
    title: 'Supervisor Graph do Zavorth',
    summary: formatCliValue(snapshot.narrative.headline, 'Grafo supervisor ready.'),
    mode: 'compact',
    showWordmark: false,
    panels,
  });
}
