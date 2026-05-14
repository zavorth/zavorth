import type {
  ZavorthFollowUpResolution,
  ZavorthMemoryReviewActionResult,
  ZavorthWorkspaceMemoryOsSnapshot,
  ZavorthWorkspaceMemoryReviewEntry,
} from '../services/ZavorthWorkspaceMemoryOsService.js';
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

function entryLine(entry: ZavorthWorkspaceMemoryReviewEntry): string {
  const ttl = entry.retention.ttlDays === null ? 'ate apagar' : `${entry.retention.ttlDays}d`;
  return `- ${entry.key}: ${compact(entry.valuePreview, 76)} | ${entry.layer}/${ttl}`;
}

export function formatWorkspaceMemoryReview(snapshot: ZavorthWorkspaceMemoryOsSnapshot): string {
  const entries = snapshot.review.entries.slice(0, 8);
  const panels: CliVisualPanel[] = [
    {
      title: 'Workspace',
      tone: snapshot.workspaceProfile.workspace ? 'success' : 'neutral',
      lines: [
        `- pasta: ${snapshot.workspaceProfile.workspace || 'nao informada'}`,
        `- stack: ${snapshot.workspaceProfile.stack.join(', ') || 'nao inferida'}`,
        `- build: ${snapshot.workspaceProfile.buildCommands.join(' | ') || 'nao inferido'}`,
        `- test: ${snapshot.workspaceProfile.testCommands.join(' | ') || 'nao inferido'}`,
      ],
    },
    {
      title: 'Follow-up',
      tone: snapshot.contracts.followUpsResolveReferences ? 'success' : 'warning',
      lines: [
        `- task: ${snapshot.recentTaskResolver.taskId || 'nenhuma'}`,
        `- estado: ${snapshot.recentTaskResolver.state || 'nao informado'}`,
        `- workspace: ${snapshot.recentTaskResolver.workspace || snapshot.workspaceProfile.workspace || 'nao informado'}`,
        `- comando: ${snapshot.recentTaskResolver.command || 'nao informado'}`,
      ],
    },
    {
      title: 'Preferencias',
      tone: snapshot.preferenceLedger.total > 0 ? 'info' : 'neutral',
      lines: [
        `- total: ${snapshot.preferenceLedger.total}`,
        `- apagar: ${snapshot.preferenceLedger.commands.forget}`,
        `- corrigir: ${snapshot.preferenceLedger.commands.correct}`,
      ],
    },
    {
      title: 'Review',
      tone: snapshot.contracts.secretsRedactedByDefault ? 'success' : 'warning',
      lines: entries.length > 0 ? entries.map(entryLine) : ['- nenhuma memoria revisavel encontrada'],
    },
    {
      title: 'Contratos',
      tone: Object.values(snapshot.contracts).every(Boolean) ? 'success' : 'warning',
      lines: [
        `- review: ${snapshot.contracts.reviewShowsLearnedMemory ? 'sim' : 'nao'}`,
        `- apagar/corrigir: ${snapshot.contracts.userCanForgetOrCorrect ? 'sim' : 'parcial'}`,
        `- comandos reutilizaveis: ${snapshot.contracts.workspaceCommandsReusable ? 'sim' : 'nao'}`,
        `- secrets redigidos: ${snapshot.contracts.secretsRedactedByDefault ? 'sim' : 'nao'}`,
      ],
    },
    {
      title: 'Faca agora',
      tone: 'brand',
      lines: [
        '- zavorth memory resolve "continua"',
        '- zavorth memory forget <key>',
        '- zavorth memory correct <key> <novo valor>',
      ],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Memory',
    eyebrowTone: snapshot.contracts.secretsRedactedByDefault ? 'success' : 'warning',
    title: 'Memoria operacional do workspace',
    summary: formatCliValue(snapshot.narrative.headline, 'Memoria operacional revisavel.'),
    mode: 'compact',
    showWordmark: false,
    panels,
  });
}

export function formatWorkspaceMemoryResolution(resolution: ZavorthFollowUpResolution): string {
  const panels: CliVisualPanel[] = [
    {
      title: 'Resolucao',
      tone: resolution.resolved ? 'success' : 'warning',
      lines: [
        `- entrada: ${compact(resolution.input, 88)}`,
        `- intent: ${resolution.intent}`,
        `- resolvido: ${resolution.resolved ? 'sim' : 'parcial'}`,
        `- motivo: ${compact(resolution.reason, 100)}`,
      ],
    },
    {
      title: 'Alvo',
      tone: 'info',
      lines: [
        `- task: ${resolution.target.taskId || 'nao informado'}`,
        `- workspace: ${resolution.target.workspace || 'nao informado'}`,
        `- artefato: ${resolution.target.artifactCommand || 'nao aplicavel'}`,
        `- proximo: ${resolution.target.nextCommand || 'nao informado'}`,
      ],
    },
    {
      title: 'Evidencia',
      tone: 'neutral',
      lines: resolution.evidence.length > 0 ? resolution.evidence.map((entry) => `- ${entry}`) : ['- nenhuma evidencia forte'],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Resolve',
    eyebrowTone: resolution.resolved ? 'success' : 'warning',
    title: 'Follow-up resolvido',
    summary: compact(resolution.reason, 120),
    mode: 'compact',
    showWordmark: false,
    panels,
  });
}

export function formatWorkspaceMemoryAction(result: ZavorthMemoryReviewActionResult): string {
  const panels: CliVisualPanel[] = [
    {
      title: 'Acao',
      tone: result.ok ? 'success' : result.status === 'noop' ? 'neutral' : 'warning',
      lines: [
        `- acao: ${result.action}`,
        `- chave: ${result.key}`,
        `- status: ${result.status}`,
        `- resumo: ${compact(result.summary, 100)}`,
      ],
    },
    {
      title: 'Review atualizado',
      tone: 'info',
      lines: [
        `- memorias: ${result.review.review.total}`,
        `- preferencias: ${result.review.preferenceLedger.total}`,
        `- workspace: ${result.review.workspaceProfile.slug}`,
      ],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Memory',
    eyebrowTone: result.ok ? 'success' : 'warning',
    title: 'Memoria revisada',
    summary: compact(result.summary, 120),
    mode: 'compact',
    showWordmark: false,
    panels,
  });
}
