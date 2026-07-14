import type { AIGatewayCompatibilityDoctorReport } from '../services/GatewayCompatibilityDoctorService.js';
import type { AIGatewayProxyStatus } from '../services/AIGatewayProxyService.js';
import type { AIGatewayUpstreamSyncReport } from '../services/GatewayUpstreamSyncService.js';
import type { ZavorthPlatformActionExecution } from '../services/ZavorthPlatformActionService.js';
import type { PublishResult as ZavorthPlatformPublishResult } from '../platform/publish/ZavorthPackagePublisher.js';
import type { GatewaySessionSendResult } from '../runtime/sessions/GatewaySessionToolsService.js';
import type { GatewaySessionSpawnSnapshot } from '../runtime/sessions/GatewaySessionStoreService.js';
import type { ZavorthToolSurfaceSnapshot } from '../services/ZavorthToolSurfaceService.js';
import type { ZavorthHookPlaneSnapshot } from '../services/ZavorthHookPlaneService.js';
import { formatCliValue, formatCount, sanitizeHumanCliText } from './ZavorthCliText.js';
import { renderCliScreen } from './ZavorthCliVisualSystem.js';

function compactPlatformLine(value: string | null | undefined, maxLength = 150): string {
  const sanitized = sanitizeHumanCliText(value || '')
    .replace(/^Zavorth exp?e (\d+) familias de tools no plano atual\.?$/i, 'Zavorth exposes $1 available tool families.')
    .replace(/^Zavorth exposes (\d+) familias de ferramentas no plano atual\.?$/i, 'Zavorth exposes $1 available tool families.')
    .replace(/\btask,\s*workflow\b/gi, 'tasks and workflows')
    .replace(/\bexp?e\b/gi, 'exposes')
    .replace(/\bexp?em\b/gi, 'expose')
    .replace(/familias de tools/gi, 'tool families')
    .replace(/\s+/g, ' ')
    .trim();
  if (!sanitized || sanitized.length <= maxLength) {
    return sanitized;
  }

  const sentenceMatch = sanitized.match(/^(.+?[.!?])\s+/);
  const firstSentence = sentenceMatch?.[1]?.trim();
  if (firstSentence && firstSentence.length >= 32 && firstSentence.length <= maxLength) {
    return firstSentence;
  }

  const clipped = sanitized.slice(0, Math.max(0, maxLength - 3)).trimEnd();
  const lastSpace = clipped.lastIndexOf(' ');
  const safeClip = lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped;
  return `${safeClip.trimEnd()}...`;
}

function formatToolFamilyLabel(label: string | null | undefined): string {
  const normalized = String(label || '').trim();
  const lower = normalized.toLowerCase();
  if (lower === 'session tools') {
    return 'Sessoes';
  }
  if (lower === 'tasks e workflows') {
    return 'Tarefas e workflows';
  }
  if (lower === 'teams e subagentes') {
    return 'Times e subagentes';
  }
  return normalized || 'Familia';
}

function normalizeAIGatewayStatusLabel(status: AIGatewayProxyStatus): string {
  if (status.ready) {
    return 'ready';
  }
  if (status.enabled) {
    return 'needs attention';
  }
  return 'desligado';
}

function formatPlatformActionExecution(result: ZavorthPlatformActionExecution): string {
  const selectedLabel = result.selectedCollection?.label
    || result.selectedRecipe?.label
    || result.selected?.label
    || result.entryId;
  const executionTone = result.status === 'applied' ? 'success' : result.status === 'blocked' ? 'danger' : result.status === 'manual' ? 'warning' : 'muted';
  return renderCliScreen({
    eyebrow: 'Plugins',
    eyebrowTone: executionTone,
    title: 'Acao de platform aplicada',
    summary: sanitizeHumanCliText(result.summary),
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Summary',
        lines: [
          `- target: ${selectedLabel}`,
          `- acao: ${result.actionId}`,
          `- status: ${result.status}`,
        ],
        tone: executionTone,
      },
      {
        title: 'Details',
        lines: result.details.slice(0, 4).map((detail) => `- ${detail}`),
        tone: 'neutral',
      },
      {
        title: 'Faca agora',
        lines: [`- zavorth plugins list ${result.entryId}`],
        tone: 'brand',
      },
    ],
  });
}

function formatPlatformPublishResult(result: ZavorthPlatformPublishResult): string {
  const publishTone = result.uploadStatus === 'published' ? 'success' : result.uploadStatus === 'prepared' ? 'info' : 'warning';
  return renderCliScreen({
    eyebrow: 'Plugins',
    eyebrowTone: publishTone,
    title: 'Platform publish ready',
    summary: `${result.packageId}@${result.version} is prepared for release.`,
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Em resumo',
        lines: [
          `- release: ${result.releaseId}`,
          `- status: ${result.uploadStatus}`,
          `- files: ${result.fileCount}`,
          `- signature: ${result.signature.slice(0, 20)}...`,
        ],
        tone: publishTone,
      },
      {
        title: 'Files',
        lines: [`- bundle: ${result.outputFile}`],
        tone: 'neutral',
      },
      {
        title: 'Faca agora',
        lines: ['- zavorth plugins list'],
        tone: 'brand',
      },
    ],
  });
}

function formatAIGatewayGatewayStatus(
  status: AIGatewayProxyStatus,
  mode: 'status' | 'route' = 'status',
): string {
  return renderCliScreen({
    eyebrow: 'AIGateway',
    eyebrowTone: status.ready ? 'success' : status.enabled ? 'warning' : 'muted',
    title: mode === 'route' ? 'AIGateway route' : 'Zavorth AIGateway',
    summary: status.message,
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Em resumo',
        lines: [
          `- state: ${normalizeAIGatewayStatusLabel(status)}`,
          `- local route: ${status.baseUrl}`,
          `- upstream: ${status.upstreamBaseUrl}`,
          `- processo: ${status.running ? `ativo (pid ${formatCliValue(status.pid ? String(status.pid) : null)})` : 'inativo'}`,
        ],
        tone: status.ready ? 'success' : status.enabled ? 'warning' : 'muted',
      },
      {
        title: 'Mesh',
        lines: [
          `- host: ${status.host}:${status.port}`,
          `- exposicao: ${status.localOnly ? 'local apenas' : 'acessivel externamente'}`,
          `- overlay: ${formatCliValue(status.overlayFile)}`,
        ],
        tone: 'neutral',
      },
      {
        title: 'Faca agora',
        lines: ['- zavorth AIGateway doctor', '- zavorth AIGateway sync'],
        tone: 'brand',
      },
    ],
  });
}

function formatAIGatewayDoctorReport(report: AIGatewayCompatibilityDoctorReport): string {
  return renderCliScreen({
    eyebrow: 'AIGateway',
    eyebrowTone: report.status === 'passed' ? 'success' : 'warning',
    title: 'AIGateway doctor',
    summary: report.summary,
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Em resumo',
        lines: [
          `- status: ${report.status}`,
          `- target: ${report.checkedTarget}`,
          `- gateway: ${report.baseUrl}`,
          `- upstream: ${report.upstreamBaseUrl}`,
        ],
        tone: report.status === 'passed' ? 'success' : 'warning',
      },
      {
        title: 'Diagnostico tecnico',
        lines: [
          `- http: ${report.httpStatus ?? 'not provided'}`,
          `- overlay: ${formatCliValue(report.overlayFile)}`,
          report.error ? `- error: ${report.error}` : null,
        ].filter(Boolean) as string[],
        tone: report.error ? 'danger' : 'neutral',
      },
      {
        title: 'Faca agora',
        lines: [
          report.status === 'passed' ? '- zavorth AIGateway promote' : '- zavorth AIGateway route',
          '- zavorth AIGateway sync',
        ],
        tone: 'brand',
      },
    ],
  });
}

function formatAIGatewaySyncReport(report: AIGatewayUpstreamSyncReport): string {
  const syncTone = report.status === 'failed' ? 'danger' : report.status === 'promoted' ? 'success' : 'warning';
  return renderCliScreen({
    eyebrow: 'AIGateway',
    eyebrowTone: syncTone,
    title: 'AIGateway sync',
    summary: report.summary,
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Em resumo',
        lines: [
          `- acao: ${report.action}`,
          `- status: ${report.status}`,
          `- automatic rollback: ${report.rollbackApplied ? 'yes' : 'no'}`,
          report.error ? `- error: ${report.error}` : null,
        ].filter(Boolean) as string[],
        tone: syncTone,
      },
      {
        title: 'Compatibility',
        lines: [`- ${report.compat ? `${report.compat.status} :: ${sanitizeHumanCliText(report.compat.summary)}` : 'not provided'}`],
        tone: 'neutral',
      },
      {
        title: 'Files',
        lines: [
          `- status file: ${report.statusFile}`,
          `- compat file: ${report.compatFile}`,
          `- command: ${report.command}`,
        ],
        tone: 'muted',
      },
      {
        title: 'Faca agora',
        lines: ['- zavorth AIGateway doctor', '- zavorth AIGateway route'],
        tone: 'brand',
      },
    ],
  });
}

function formatSessionSendResult(result: GatewaySessionSendResult): string {
  return renderCliScreen({
    eyebrow: 'Sessions',
    eyebrowTone: result.ok ? 'success' : 'danger',
    title: 'Message Sent To Another Session',
    summary: result.ok ? 'The message was forwarded.' : 'Could not forward the message.',
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Em resumo',
        lines: [
          `- status: ${result.ok ? 'enviado' : 'falhou'}`,
          `- destino: ${result.platform}:${result.sessionId || result.chatId}`,
          `- task: ${formatCliValue(result.taskId)}`,
        ],
        tone: result.ok ? 'success' : 'danger',
      },
      {
        title: 'Faca agora',
        lines: [`- acompanhe em history ${result.sessionId || '<sessionId>'}`],
        tone: 'brand',
      },
    ],
  });
}

function formatSessionSpawnResult(result: GatewaySessionSpawnSnapshot): string {
  return renderCliScreen({
    eyebrow: 'Sessoes',
    eyebrowTone: result.ok ? 'success' : 'warning',
    title: 'New Session Ready',
    summary: result.ok ? 'The derived session can now be used.' : 'The session was partially opened and may need review.',
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Em resumo',
        lines: [
          `- status: ${result.ok ? 'open' : 'partial'}`,
          `- platform: ${result.platform}`,
          `- session: ${formatCliValue(result.sessionId)}`,
          `- chat: ${formatCliValue(result.chatId)}`,
        ],
        tone: result.ok ? 'success' : 'warning',
      },
      {
        title: 'Faca agora',
        lines: [
          `- abrir agora: ${result.handoffCommand}`,
          '- open the new session or use the handoff above',
        ],
        tone: 'brand',
      },
    ],
  });
}

function formatToolSurfaceSnapshot(snapshot: ZavorthToolSurfaceSnapshot): string {
  const highlighted = snapshot.families.slice(0, 2);
  const selected = snapshot.catalog?.selected || null;
  return renderCliScreen({
    eyebrow: 'Tools',
    eyebrowTone: snapshot.summary.ready > 0 ? 'info' : 'muted',
    title: 'Zavorth tools',
    summary: compactPlatformLine(snapshot.narrative.headline),
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Agora',
        lines: [
          `- families: ${formatCount(snapshot.summary.families, 'total', 'total')} | ${formatCount(snapshot.summary.ready, 'ready', 'ready')} | ${formatCount(snapshot.summary.partial, 'partial', 'partial')}`,
          `- resumo: ${compactPlatformLine(snapshot.narrative.operatorSummary)}`,
        ],
        tone: snapshot.summary.ready > 0 ? 'info' : 'muted',
      },
      {
        title: selected ? 'Item em foco' : 'Familias em foco',
        lines: selected
          ? [
            `- ${selected.label}`,
            `- family: ${formatToolFamilyLabel(selected.familyLabel)}`,
            `- state: ${selected.readiness}`,
            `- resumo: ${compactPlatformLine(selected.summary)}`,
            selected.command ? `- command: ${selected.command}` : null,
          ].filter(Boolean) as string[]
          : highlighted.map((family) => `- ${formatToolFamilyLabel(family.label)}: ${compactPlatformLine(family.summary, 96)}`),
        tone: 'neutral',
      },
      {
        title: 'Faca agora',
        lines: [selected?.id ? `- zavorth tools ${selected.id}` : '- use zavorth tools <filtro> para procurar uma ferramenta especifica'],
        tone: 'brand',
      },
    ],
  });
}

function formatHookPlaneSnapshot(snapshot: ZavorthHookPlaneSnapshot): string {
  const events = snapshot.events.filter((event) => event.registeredHooks > 0).slice(0, 4);
  return renderCliScreen({
    eyebrow: 'Hooks',
    eyebrowTone: snapshot.summary.registeredHooks > 0 ? 'info' : 'muted',
    title: 'Zavorth hooks',
    summary: sanitizeHumanCliText(snapshot.narrative.headline),
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Em resumo',
        lines: [
          `- events: ${snapshot.summary.supportedEvents} total | ${snapshot.summary.coveredEvents} covered`,
          `- registered hooks: ${snapshot.summary.registeredHooks} | workspaces: ${snapshot.summary.workspaces}`,
          `- resumo: ${sanitizeHumanCliText(snapshot.narrative.operatorSummary)}`,
        ],
        tone: snapshot.summary.registeredHooks > 0 ? 'info' : 'muted',
      },
      {
        title: 'Eventos em foco',
        lines: events.length > 0
          ? events.map((event) => `- ${event.label}: ${formatCount(event.registeredHooks, 'hook', 'hooks')}`)
          : ['- no hook registered yet'],
        tone: 'neutral',
      },
      {
        title: 'Faca agora',
        lines: ['- zavorth hooks'],
        tone: 'brand',
      },
    ],
  });
}

export {
  formatAIGatewayDoctorReport,
  formatAIGatewayGatewayStatus,
  formatAIGatewaySyncReport,
  formatHookPlaneSnapshot,
  formatPlatformActionExecution,
  formatPlatformPublishResult,
  formatSessionSendResult,
  formatSessionSpawnResult,
  formatToolSurfaceSnapshot,
};
