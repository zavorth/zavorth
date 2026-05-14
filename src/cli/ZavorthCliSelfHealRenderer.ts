import type {
  ZavorthSelfHealPlanSnapshot,
  ZavorthSelfHealProbe,
  ZavorthSelfHealRecoveryAction,
} from '../services/ZavorthSelfHealControlPlaneService.js';
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

function probeLine(probe: ZavorthSelfHealProbe): string {
  const evidence = probe.evidence[0] || probe.recommendedAction;
  return `- ${probe.label}: ${probe.status} | ${probe.severity} | ${compact(evidence, 72)}`;
}

function actionLine(action: ZavorthSelfHealRecoveryAction): string {
  const approval = action.requiresApproval || action.previewOnly ? 'approval' : 'auto';
  return `- ${action.label}: ${action.status} | ${action.risk}/${approval} | ${action.command}`;
}

export function formatSelfHealPlan(snapshot: ZavorthSelfHealPlanSnapshot): string {
  const issueProbes = snapshot.probes
    .filter((probe) => probe.status === 'failed' || probe.status === 'attention')
    .slice(0, 8);
  const actionLines = snapshot.plan.slice(0, 8).map(actionLine);
  const outboxLines = snapshot.outbox.slice(0, 6).map((item) =>
    `- ${item.actionId}: ${compact(item.reason, 84)} | ${item.command}`);
  const budgetLines = snapshot.automationBudgets.map((budget) =>
    `- ${budget.label}: ${budget.estimatedCost}/${budget.maxCost} (${budget.reset})`);

  const panels: CliVisualPanel[] = [
    {
      title: 'Resumo',
      tone: snapshot.status === 'applied'
        ? 'success'
        : snapshot.status === 'blocked' || snapshot.status === 'paused'
          ? 'warning'
          : 'info',
      lines: [
        `- modo: ${snapshot.mode}`,
        `- status: ${snapshot.status}`,
        `- probes: ${snapshot.summary.probes}`,
        `- issues: ${snapshot.summary.issues}`,
        `- budget: ${snapshot.summary.budgetCost}/${snapshot.summary.budgetLimit}`,
      ],
    },
    {
      title: 'Probes',
      tone: issueProbes.length > 0 ? 'warning' : 'success',
      lines: issueProbes.length > 0
        ? issueProbes.map(probeLine)
        : ['- todos os fluxos cobertos estao saudaveis ou dormentes por configuracao'],
    },
    {
      title: 'Plano',
      tone: snapshot.plan.length > 0 ? 'brand' : 'neutral',
      lines: actionLines.length > 0 ? actionLines : ['- nenhuma recuperacao necessaria agora'],
    },
    {
      title: 'Outbox',
      tone: snapshot.outbox.length > 0 ? 'warning' : 'success',
      lines: outboxLines.length > 0 ? outboxLines : ['- sem acao sensivel pendente'],
    },
    {
      title: 'Budgets',
      tone: snapshot.automationBudgets.some((budget) => budget.exceeded) ? 'warning' : 'success',
      lines: budgetLines,
    },
    {
      title: 'Relatorio diario',
      tone: snapshot.dailyReport.pendingItems.some((item) => !/Nenhuma/i.test(item)) ? 'info' : 'neutral',
      lines: [
        `- falhas: ${compact(snapshot.dailyReport.topFailures.join(' | '), 100)}`,
        `- pendencias: ${compact(snapshot.dailyReport.pendingItems.join(' | '), 100)}`,
        `- acoes: ${compact(snapshot.dailyReport.proposedActions.join(' | '), 100)}`,
      ],
    },
    {
      title: 'Contratos',
      tone: Object.values(snapshot.contracts).every(Boolean) ? 'success' : 'warning',
      lines: [
        `- preview read-only: ${snapshot.contracts.previewDoesNotExecute ? 'sim' : 'nao'}`,
        `- policy/trust: ${snapshot.contracts.applyRespectsTrustPolicy ? 'sim' : 'revisar'}`,
        `- watchdog lazy: ${snapshot.contracts.nothingAlwaysOnWithoutExplicitConfig ? 'sim' : 'nao'}`,
        `- budget obrigatorio: ${snapshot.contracts.everyAutomationHasBudget ? 'sim' : 'nao'}`,
        `- pausa repeticao: ${snapshot.contracts.repeatedFailuresPause ? 'sim' : 'nao'}`,
      ],
    },
    {
      title: 'Comandos',
      tone: 'brand',
      lines: [
        `- preview: ${snapshot.commands.preview}`,
        `- apply: ${snapshot.commands.apply}`,
        `- report: ${snapshot.commands.report}`,
      ],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Self-Heal',
    eyebrowTone: snapshot.status === 'applied'
      ? 'success'
      : snapshot.status === 'blocked' || snapshot.status === 'paused'
        ? 'warning'
        : 'brand',
    title: 'Operacao continua supervisionada',
    summary: formatCliValue(snapshot.narrative.headline, 'Self-Heal pronto.'),
    mode: 'compact',
    showWordmark: false,
    panels,
  });
}
