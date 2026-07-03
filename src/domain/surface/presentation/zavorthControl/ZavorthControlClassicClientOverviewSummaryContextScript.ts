import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';

declare function escapeHtml(value: unknown): string;
declare function formatRelativeTime(value: unknown): string;
declare function runCockpitAction(actionId: string): void;
declare function copyTextToClipboard(value: string, successMessage?: string): void;

interface OperatorBriefHighlight {
  key?: string;
  value?: string;
}

interface ZavorthBridgeInfo {
  available?: boolean;
  latestIncident?: string;
  latestSeverity?: string;
  flappingLikely?: boolean;
}

interface NextAction {
  actionId?: string;
  label?: string;
  reason?: string;
  command?: string;
}

interface OperatorBrief {
  error?: boolean;
  headline?: string;
  highlights?: string[];
  zavorthBridge?: ZavorthBridgeInfo;
  nextAction?: NextAction;
  posture?: string;
}

interface MemoryRecentEntry {
  key?: string;
  value?: string;
}

interface MemoryRelevantEntry {
  key?: string;
  value?: string;
}

interface MemoryPlaneMemory {
  recent?: MemoryRecentEntry[];
  relevant?: MemoryRelevantEntry[];
}

interface MemoryArtifact {
  label?: string;
  summary?: string;
  path?: string;
}

interface MemoryPlaneArtifacts {
  recent?: MemoryArtifact[];
}

interface MemoryPlaneReplay {
  recommendedEntry?: {
    reason?: string;
  };
}

interface MemoryPlaneWorkspace {
  workspace?: string;
  summary?: string;
}

interface MemoryPlaneSummary {
  artifacts?: number;
  persistedMemories?: number;
  relevantMemories?: number;
  replayTasks?: number;
  workspaceSignals?: number;
}

interface MemoryPlaneNarrative {
  headline?: string;
  operatorSummary?: string;
}

interface SuggestedAction {
  label?: string;
  reason?: string;
  command?: string;
}

interface MemoryPlane {
  error?: boolean;
  available?: boolean;
  reason?: string;
  replay?: MemoryPlaneReplay;
  workspace?: MemoryPlaneWorkspace;
  memory?: MemoryPlaneMemory;
  artifacts?: MemoryPlaneArtifacts;
  suggestedActions?: SuggestedAction[];
  summary?: MemoryPlaneSummary;
  narrative?: MemoryPlaneNarrative;
}

interface ContinuityTask {
  shortId?: string;
  commandType?: string;
  summary?: string;
  source?: string;
  status?: string;
  updatedAt?: string;
}

interface ContinuitySuggestedAction {
  kind?: string;
  label?: string;
  reason?: string;
}

interface ContinuitySurfaces {
  telegram?: number;
  web?: number;
  other?: number;
}

interface Continuity {
  error?: boolean;
  available?: boolean;
  reason?: string;
  suggestedAction?: ContinuitySuggestedAction;
  focusTask?: ContinuityTask;
  activeTask?: ContinuityTask;
  latestTelegramTask?: ContinuityTask;
  latestWebTask?: ContinuityTask;
  surfaces?: ContinuitySurfaces;
  recentTasks?: ContinuityTask[];
}

function zavorthControlClassicClientOverviewSummaryContext() {
    function renderOperatorBrief(brief: OperatorBrief | null): void {
      const node = document.getElementById('operations-brief');
      if (!node) return;
      if (!brief || brief.error) {
        node.innerHTML = '<div class="muted">Nao foi possivel carregar o briefing do operador.</div>';
        return;
      }

      const highlights = Array.isArray(brief.highlights) ? brief.highlights : [];
      const zavorthBridge = brief.zavorthBridge || {};
      const nextAction = brief.nextAction || {};
      const posture = brief.posture || 'watch';
      const postureClass = posture === 'stable' ? 'badge-allowed' : (posture === 'action-needed' ? 'badge-blocked' : 'badge-warning');
      const postureLabel = posture === 'stable' ? 'estavel' : (posture === 'action-needed' ? 'agir agora' : 'acompanhar');
      const highlightItems = highlights.length
        ? highlights.map((item) => '<li>' + escapeHtml(item) + '</li>').join('')
        : '<li>Sem destaques registrados.</li>';
      const zavorthBridgeSummary = zavorthBridge.available
        ? 'Incidente: ' + escapeHtml(zavorthBridge.latestIncident || 'n/d') + ' (' + escapeHtml(zavorthBridge.latestSeverity || 'n/d') + ') | flapping: ' + escapeHtml(zavorthBridge.flappingLikely ? 'sim' : 'nao')
        : 'Sem historico do remoto do ZavorthBridge ainda.';
      const hasActionId = Boolean(nextAction.actionId);
      const hasCliCommand = typeof nextAction.command === 'string' && nextAction.command.startsWith('npm run ');
      const actionButtons = [
        hasActionId
          ? '<button class="btn btn-ghost" onclick="runCockpitAction(' + "'" + escapeHtml(nextAction.actionId) + "'" + ')">Executar agora</button>'
          : '<span class="badge badge-warning">acao manual</span>',
        hasCliCommand
          ? '<button class="btn btn-ghost" onclick="copyTextToClipboard(' + "'" + escapeHtml(nextAction.command) + "'" + ', ' + "'" + 'Comando copiado.' + "'" + ')">Copiar comando</button>'
          : '',
      ].filter(Boolean).join('');

      node.innerHTML =
        '<div class="cockpit-status">'
        + '<div>'
        + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
        + '<strong>Briefing do operador</strong>'
        + '<span class="badge ' + postureClass + '">' + escapeHtml(postureLabel) + '</span>'
        + '</div>'
        + '<div class="cockpit-headline">' + escapeHtml(brief.headline || 'Sem resumo do operador.') + '</div>'
        + '</div>'
        + '<a class="sidecar-link" href="/api/operations/brief" target="_blank">/api/operations/brief</a>'
        + '</div>'
        + '<div class="cockpit-grid">'
        + '<div class="cockpit-stack">'
        + '<div class="sidecar-card">'
        + '<strong>Destaques do operador</strong>'
        + '<ul class="cockpit-list">' + highlightItems + '</ul>'
        + '</div>'
        + '</div>'
        + '<div class="cockpit-stack">'
        + '<div class="sidecar-card">'
        + '<strong>Proxima acao</strong>'
        + '<div class="cockpit-action-card">'
        + '<strong>' + escapeHtml(nextAction.label || 'Sem acao sugerida') + '</strong>'
        + '<small>' + escapeHtml(nextAction.reason || 'Sem contexto adicional.') + '</small>'
        + '<div class="cockpit-command">' + escapeHtml(nextAction.command || '') + '</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + actionButtons + '</div>'
        + '</div>'
        + '</div>'
        + '<div class="sidecar-card">'
        + '<strong>ZavorthBridge remoto</strong>'
        + '<small>' + zavorthBridgeSummary + '</small>'
        + '</div>'
        + '</div>'
        + '</div>';
    }

    function renderOperationsMemoryPlane(memoryPlane: MemoryPlane | null): void {
      const node = document.getElementById('operations-memory-plane');
      if (!node) return;
      if (!memoryPlane || memoryPlane.error || memoryPlane.available === false) {
        const reason = memoryPlane && memoryPlane.reason
          ? escapeHtml(memoryPlane.reason)
          : 'Plano de retomada e entregas indisponivel.';
        node.innerHTML = '<div class="muted">' + reason + '</div>';
        return;
      }

      const replay = memoryPlane.replay || null;
      const workspace = memoryPlane.workspace || null;
      const recentMemories = Array.isArray(memoryPlane.memory?.recent) ? memoryPlane.memory.recent : [];
      const relevantMemories = Array.isArray(memoryPlane.memory?.relevant) ? memoryPlane.memory.relevant : [];
      const artifacts = Array.isArray(memoryPlane.artifacts?.recent) ? memoryPlane.artifacts.recent : [];
      const suggestedActions = Array.isArray(memoryPlane.suggestedActions) ? memoryPlane.suggestedActions : [];
      const memoryItems = recentMemories.length
        ? recentMemories.slice(0, 4).map((entry) =>
            '<li><strong>' + escapeHtml(entry.key || 'memoria') + '</strong> · '
            + escapeHtml(entry.value || 'Sem valor adicional.')
            + '</li>'
          ).join('')
        : '<li>Nenhuma memoria persistente recente.</li>';
      const artifactItems = artifacts.length
        ? artifacts.slice(0, 4).map((artifact) =>
            '<li><strong>' + escapeHtml(artifact.label || 'Entrega') + '</strong> · '
            + escapeHtml(artifact.summary || artifact.path || 'Sem resumo adicional.')
            + '</li>'
          ).join('')
        : '<li>Nenhuma entrega recente consolidada.</li>';
      const actionItems = suggestedActions.length
        ? suggestedActions.slice(0, 3).map((action) =>
            '<div class="cockpit-action-card">'
            + '<strong>' + escapeHtml(action.label || 'Acao sugerida') + '</strong>'
            + '<small>' + escapeHtml(action.reason || 'Sem motivo adicional.') + '</small>'
            + '<div class="cockpit-command">' + escapeHtml(action.command || '') + '</div>'
            + '</div>'
          ).join('')
        : '<div class="muted">Nenhuma acao sugerida agora.</div>';

      node.innerHTML =
        '<div class="cockpit-status">'
        + '<div>'
        + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
        + '<strong>Retomada e entregas</strong>'
        + '<span class="badge badge-info">' + escapeHtml(String(memoryPlane.summary?.artifacts || 0)) + ' artefato(s)</span>'
        + '</div>'
        + '<div class="cockpit-headline">' + escapeHtml(memoryPlane.narrative?.headline || 'Contexto compartilhado pronto.') + '</div>'
        + '</div>'
        + '<a class="sidecar-link" href="/api/operations/memory-plane" target="_blank">/api/operations/memory-plane</a>'
        + '</div>'
        + '<div class="cockpit-grid">'
        + '<div class="cockpit-stack">'
        + '<div class="cockpit-mini-grid">'
        + '<div class="cockpit-mini-card"><strong>Memorias</strong><div>' + escapeHtml(String(memoryPlane.summary?.persistedMemories || 0)) + '</div><small>Persistentes recentes</small></div>'
        + '<div class="cockpit-mini-card"><strong>Relevantes</strong><div>' + escapeHtml(String(memoryPlane.summary?.relevantMemories || 0)) + '</div><small>Contexto atual</small></div>'
        + '<div class="cockpit-mini-card"><strong>Replay</strong><div>' + escapeHtml(String(memoryPlane.summary?.replayTasks || 0)) + '</div><small>Tarefas visiveis</small></div>'
        + '<div class="cockpit-mini-card"><strong>Workspace</strong><div>' + escapeHtml(String(memoryPlane.summary?.workspaceSignals || 0)) + '</div><small>Sinais operacionais</small></div>'
        + '</div>'
        + '<div class="sidecar-card"><strong>Resumo do operador</strong><small>' + escapeHtml(memoryPlane.narrative?.operatorSummary || 'Sem resumo adicional.') + '</small></div>'
        + '<div class="sidecar-card"><strong>Memoria persistente</strong><ul class="cockpit-list">' + memoryItems + '</ul></div>'
        + '</div>'
        + '<div class="cockpit-stack">'
        + '<div class="sidecar-card"><strong>Entregas recentes</strong><ul class="cockpit-list">' + artifactItems + '</ul></div>'
        + '<div class="sidecar-card"><strong>Retomada</strong><small>' + escapeHtml(replay?.recommendedEntry?.reason || 'Sem replay consolidado adicional.') + '</small>'
        + (workspace ? '<small>Workspace: ' + escapeHtml(workspace.workspace || 'n/d') + ' · ' + escapeHtml(workspace.summary || 'Sem resumo adicional.') + '</small>' : '')
        + (relevantMemories[0] ? '<small>Memoria em foco: ' + escapeHtml(relevantMemories[0].key || 'memoria') + '</small>' : '')
        + '</div>'
        + '<div class="sidecar-card"><strong>Acoes sugeridas</strong><div class="cockpit-action-list">' + actionItems + '</div></div>'
        + '</div>'
        + '</div>';
    }

    function renderOperationsContinuity(continuity: Continuity | null): void {
      const node = document.getElementById('operations-continuity');
      if (!node) return;
      if (!continuity || continuity.error || continuity.available === false) {
        const reason = continuity && continuity.reason
          ? escapeHtml(continuity.reason)
          : 'Continuidade entre superficies indisponivel.';
        node.innerHTML = '<div class="muted">' + reason + '</div>';
        return;
      }

      const suggestedAction = continuity.suggestedAction || {};
      const focusTask = continuity.focusTask || continuity.activeTask || continuity.latestTelegramTask || continuity.latestWebTask || null;
      const surfaces = continuity.surfaces || {};
      const recentTasks = Array.isArray(continuity.recentTasks) ? continuity.recentTasks : [];
      const badgeClass = suggestedAction.kind === 'review-latest'
        ? 'badge-allowed'
        : (suggestedAction.kind === 'resume-active' ? 'badge-warning' : 'badge-blocked');
      const badgeLabel = suggestedAction.kind === 'review-latest'
        ? 'retomar contexto'
        : (suggestedAction.kind === 'resume-active' ? 'atividade em curso' : 'sem continuidade');
      const focusTitle = focusTask
        ? escapeHtml((focusTask.shortId || 'task') + ' · ' + (focusTask.commandType || 'fluxo livre'))
        : 'Nenhuma task em foco';
      const focusSummary = focusTask
        ? escapeHtml(focusTask.summary || 'Sem resumo disponivel.')
        : 'Nenhuma tarefa recente o suficiente para retomada.';
      const focusMeta = focusTask
        ? 'Origem: ' + escapeHtml(focusTask.source || 'n/d')
          + ' | Status: ' + escapeHtml(focusTask.status || 'n/d')
          + ' | Atualizada ' + escapeHtml(formatRelativeTime(focusTask.updatedAt))
        : 'Use Telegram ou /app para criar um novo fio de continuidade.';
      const recentItems = recentTasks.length
        ? recentTasks.slice(0, 4).map((task) =>
            '<li><strong>' + escapeHtml(task.shortId || 'task') + '</strong> · '
            + escapeHtml(task.source || 'n/d') + ' · '
            + escapeHtml(task.status || 'n/d') + ' · '
            + escapeHtml(formatRelativeTime(task.updatedAt))
            + '</li>'
          ).join('')
        : '<li>Sem tarefas recentes para correlacionar.</li>';

      node.innerHTML =
        '<div class="cockpit-status">'
        + '<div>'
        + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
        + '<strong>Continuidade entre superficies</strong>'
        + '<span class="badge ' + badgeClass + '">' + escapeHtml(badgeLabel) + '</span>'
        + '</div>'
        + '<div class="cockpit-headline">' + escapeHtml(suggestedAction.reason || 'Sem recomendacao registrada.') + '</div>'
        + '</div>'
        + '<a class="sidecar-link" href="/api/operations/continuity" target="_blank">/api/operations/continuity</a>'
        + '</div>'
        + '<div class="cockpit-grid">'
        + '<div class="cockpit-stack">'
        + '<div class="sidecar-card">'
        + '<strong>Foco sugerido</strong>'
        + '<div style="margin-top:8px;">' + focusTitle + '</div>'
        + '<small>' + focusSummary + '</small>'
        + '<small>' + focusMeta + '</small>'
        + '</div>'
        + '<div class="sidecar-card">'
        + '<strong>Superficies recentes</strong>'
        + '<small>Telegram: ' + escapeHtml(String(surfaces.telegram || 0)) + ' | Web: ' + escapeHtml(String(surfaces.web || 0)) + ' | Outras: ' + escapeHtml(String(surfaces.other || 0)) + '</small>'
        + '<small>Acao sugerida: ' + escapeHtml(suggestedAction.label || 'Retomar contexto') + '</small>'
        + '</div>'
        + '</div>'
        + '<div class="sidecar-card">'
        + '<strong>Historico resumido</strong>'
        + '<ul class="cockpit-list">' + recentItems + '</ul>'
        + '</div>'
        + '</div>';
    }
}

export function getZavorthControlClassicClientOverviewSummaryContextScript(): string {
  return extractFunctionBody(zavorthControlClassicClientOverviewSummaryContext);
}
