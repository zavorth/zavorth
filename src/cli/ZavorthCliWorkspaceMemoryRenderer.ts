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
    return 'not provided';
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
        `- folder: ${snapshot.workspaceProfile.workspace || 'not provided'}`,
        `- stack: ${snapshot.workspaceProfile.stack.join(', ') || 'not inferred'}`,
        `- build: ${snapshot.workspaceProfile.buildCommands.join(' | ') || 'not inferred'}`,
        `- test: ${snapshot.workspaceProfile.testCommands.join(' | ') || 'not inferred'}`,
      ],
    },
    {
      title: 'Follow-up',
      tone: snapshot.contracts.followUpsResolveReferences ? 'success' : 'warning',
      lines: [
        `- task: ${snapshot.recentTaskResolver.taskId || 'none'}`,
        `- state: ${snapshot.recentTaskResolver.state || 'not provided'}`,
        `- workspace: ${snapshot.recentTaskResolver.workspace || snapshot.workspaceProfile.workspace || 'not provided'}`,
        `- command: ${snapshot.recentTaskResolver.command || 'not provided'}`,
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
      lines: entries.length > 0 ? entries.map(entryLine) : ['- no reviewable memory found'],
    },
    {
      title: 'Contratos',
      tone: Object.values(snapshot.contracts).every(Boolean) ? 'success' : 'warning',
      lines: [
        `- review: ${snapshot.contracts.reviewShowsLearnedMemory ? 'yes' : 'no'}`,
        `- forget/correct: ${snapshot.contracts.userCanForgetOrCorrect ? 'yes' : 'partial'}`,
        `- reusable commands: ${snapshot.contracts.workspaceCommandsReusable ? 'yes' : 'no'}`,
        `- redacted secrets: ${snapshot.contracts.secretsRedactedByDefault ? 'yes' : 'no'}`,
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
        `- resolved: ${resolution.resolved ? 'yes' : 'partial'}`,
        `- motivo: ${compact(resolution.reason, 100)}`,
      ],
    },
    {
      title: 'Alvo',
      tone: 'info',
      lines: [
        `- task: ${resolution.target.taskId || 'not provided'}`,
        `- workspace: ${resolution.target.workspace || 'not provided'}`,
        `- artifact: ${resolution.target.artifactCommand || 'not applicable'}`,
        `- next: ${resolution.target.nextCommand || 'not provided'}`,
      ],
    },
    {
      title: 'Evidencia',
      tone: 'neutral',
      lines: resolution.evidence.length > 0 ? resolution.evidence.map((entry) => `- ${entry}`) : ['- no strong evidence'],
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
        `- memorys: ${result.review.review.total}`,
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
