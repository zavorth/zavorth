import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';

declare function escapeHtml(value: unknown): string;
declare function formatRelativeTime(value: unknown): string;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ambient declaration for the runtime concatenated script
declare function runCockpitAction(actionId: string): void;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ambient declaration for the runtime concatenated script
declare function copyTextToClipboard(value: string, successMessage?: string): void;

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- consumed at runtime via fn.toString() → extractFunctionBody()
  function renderOperatorBrief(brief: OperatorBrief | null): void {
    const node = document.getElementById('operations-brief');
    if (!node) return;
    if (!brief || brief.error) {
      node.innerHTML = '<div class="muted">Could not load operator briefing.</div>';
      return;
    }

    const highlights = Array.isArray(brief.highlights) ? brief.highlights : [];
    const zavorthBridge = brief.zavorthBridge || {};
    const nextAction = brief.nextAction || {};
    const posture = brief.posture || 'watch';
    const postureClass =
      posture === 'stable' ? 'badge-allowed' : posture === 'action-needed' ? 'badge-blocked' : 'badge-warning';
    const postureLabel = posture === 'stable' ? 'stable' : posture === 'action-needed' ? 'act now' : 'monitor';
    const highlightItems = highlights.length
      ? highlights.map((item) => '<li>' + escapeHtml(item) + '</li>').join('')
      : '<li>No highlights registered.</li>';
    const zavorthBridgeSummary = zavorthBridge.available ? 'Incident: ' +
        escapeHtml(zavorthBridge.latestIncident || 'n/a') +
        ' (' +
        escapeHtml(zavorthBridge.latestSeverity || 'n/a') +
        ') | flapping: ' +
        escapeHtml(zavorthBridge.flappingLikely ? 'yes' : 'no')
      : 'No remote ZavorthBridge history yet.';
    const hasActionId = Boolean(nextAction.actionId);
    const hasCliCommand = typeof nextAction.command === 'string' && nextAction.command.startsWith('npm run ');
    const actionButtons = [
      hasActionId ? '<button class="btn btn-ghost" onclick="runCockpitAction(' +
          "'" +
          escapeHtml(nextAction.actionId) +
          "'" +
          ')">run now</button>'
        : '<span class="badge badge-warning">manual action</span>',
      hasCliCommand ? '<button class="btn btn-ghost" onclick="copyTextToClipboard(' +
          "'" +
          escapeHtml(nextAction.command) +
          "'" +
          ', ' +
          "'" +
          'Command copied.' +
          "'" +
          ')">Copy command</button>'
        : '',
    ]
      .filter(Boolean)
      .join('');

    node.innerHTML =
      '<div class="cockpit-status">' +
      '<div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
      '<strong>Briefing do operador</strong>' +
      '<span class="badge ' +
      postureClass +
      '">' +
      escapeHtml(postureLabel) +
      '</span>' +
      '</div>' +
      '<div class="cockpit-headline">' +
      escapeHtml(brief.headline || 'No operator summary.') +
      '</div>' +
      '</div>' +
      '<a class="sidecar-link" href="/api/operations/brief" target="_blank">/api/operations/brief</a>' +
      '</div>' +
      '<div class="cockpit-grid">' +
      '<div class="cockpit-stack">' +
      '<div class="sidecar-card">' +
      '<strong>Destaques do operador</strong>' +
      '<ul class="cockpit-list">' +
      highlightItems +
      '</ul>' +
      '</div>' +
      '</div>' +
      '<div class="cockpit-stack">' +
      '<div class="sidecar-card">' +
      '<strong>Next action</strong>' +
      '<div class="cockpit-action-card">' +
      '<strong>' +
      escapeHtml(nextAction.label || 'No suggested action') +
      '</strong>' +
      '<small>' +
      escapeHtml(nextAction.reason || 'No additional context.') +
      '</small>' +
      '<div class="cockpit-command">' +
      escapeHtml(nextAction.command || '') +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
      actionButtons +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="sidecar-card">' +
      '<strong>ZavorthBridge remote</strong>' +
      '<small>' +
      zavorthBridgeSummary +
      '</small>' +
      '</div>' +
      '</div>' +
      '</div>';
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- consumed at runtime via fn.toString() → extractFunctionBody()
  function renderOperationsMemoryPlane(memoryPlane: MemoryPlane | null): void {
    const node = document.getElementById('operations-memory-plane');
    if (!node) return;
    if (!memoryPlane || memoryPlane.error || memoryPlane.available === false) {
      const reason =
        memoryPlane && memoryPlane.reason
          ? escapeHtml(memoryPlane.reason)
          : 'Resume plan and deliverables unavailable.';
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
      ? recentMemories
          .slice(0, 4)
          .map(
            (entry) =>
              '<li><strong>' +
              escapeHtml(entry.key || 'memory') +
              '</strong> - ' +
              escapeHtml(entry.value || 'No additional value.') +
              '</li>',
          )
          .join('')
      : '<li>No recent persistent memory.</li>';
    const artifactItems = artifacts.length
      ? artifacts
          .slice(0, 4)
          .map(
            (artifact) =>
              '<li><strong>' +
              escapeHtml(artifact.label || 'Entrega') +
              '</strong> - ' +
              escapeHtml(artifact.summary || artifact.path || 'No additional summary.') +
              '</li>',
          )
          .join('')
      : '<li>No entrega recente consolidada.</li>';
    const actionItems = suggestedActions.length
      ? suggestedActions
          .slice(0, 3)
          .map(
            (action) =>
              '<div class="cockpit-action-card">' +
              '<strong>' +
              escapeHtml(action.label || 'Suggested action') +
              '</strong>' +
              '<small>' +
              escapeHtml(action.reason || 'No additional reason.') +
              '</small>' +
              '<div class="cockpit-command">' +
              escapeHtml(action.command || '') +
              '</div>' +
              '</div>',
          )
          .join('')
      : '<div class="muted">No action suggested right now.</div>';

    node.innerHTML =
      '<div class="cockpit-status">' +
      '<div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
      '<strong>Resume and deliverables</strong>' +
      '<span class="badge badge-info">' +
      escapeHtml(String(memoryPlane.summary?.artifacts || 0)) +
      ' artifact(s)</span>' +
      '</div>' +
      '<div class="cockpit-headline">' +
      escapeHtml(memoryPlane.narrative?.headline || 'Shared context ready.') +
      '</div>' +
      '</div>' +
      '<a class="sidecar-link" href="/api/operations/memory-plane" target="_blank">/api/operations/memory-plane</a>' +
      '</div>' +
      '<div class="cockpit-grid">' +
      '<div class="cockpit-stack">' +
      '<div class="cockpit-mini-grid">' +
      '<div class="cockpit-mini-card"><strong>Memories</strong><div>' +
      escapeHtml(String(memoryPlane.summary?.persistedMemories || 0)) +
      '</div><small>Recent persistent</small></div>' +
      '<div class="cockpit-mini-card"><strong>Relevantes</strong><div>' +
      escapeHtml(String(memoryPlane.summary?.relevantMemories || 0)) +
      '</div><small>Contexto current</small></div>' +
      '<div class="cockpit-mini-card"><strong>Replay</strong><div>' +
      escapeHtml(String(memoryPlane.summary?.replayTasks || 0)) +
      '</div><small>Visible tasks</small></div>' +
      '<div class="cockpit-mini-card"><strong>Workspace</strong><div>' +
      escapeHtml(String(memoryPlane.summary?.workspaceSignals || 0)) +
      '</div><small>Sinais operacionais</small></div>' +
      '</div>' +
      '<div class="sidecar-card"><strong>Operator summary</strong><small>' +
      escapeHtml(memoryPlane.narrative?.operatorSummary || 'No additional summary.') +
      '</small></div>' +
      '<div class="sidecar-card"><strong>Persistent memory</strong><ul class="cockpit-list">' +
      memoryItems +
      '</ul></div>' +
      '</div>' +
      '<div class="cockpit-stack">' +
      '<div class="sidecar-card"><strong>Entregas recentes</strong><ul class="cockpit-list">' +
      artifactItems +
      '</ul></div>' +
      '<div class="sidecar-card"><strong>Resume</strong><small>' +
      escapeHtml(replay?.recommendedEntry?.reason || 'No additional consolidated replay.') +
      '</small>' +
      (workspace ? '<small>Workspace: ' +
          escapeHtml(workspace.workspace || 'n/a') +
          ' - ' +
          escapeHtml(workspace.summary || 'No additional summary.') +
          '</small>'
        : '') +
      (relevantMemories[0] ? '<small>Focused memory: ' + escapeHtml(relevantMemories[0].key || 'memory') + '</small>'
        : '') +
      '</div>' +
      '<div class="sidecar-card"><strong>Actions sugeridas</strong><div class="cockpit-action-list">' +
      actionItems +
      '</div></div>' +
      '</div>' +
      '</div>';
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- consumed at runtime via fn.toString() → extractFunctionBody()
  function renderOperationsContinuity(continuity: Continuity | null): void {
    const node = document.getElementById('operations-continuity');
    if (!node) return;
    if (!continuity || continuity.error || continuity.available === false) {
      const reason =
        continuity && continuity.reason ? escapeHtml(continuity.reason) : 'Cross-surface continuity unavailable.';
      node.innerHTML = '<div class="muted">' + reason + '</div>';
      return;
    }

    const suggestedAction = continuity.suggestedAction || {};
    const focusTask =
      continuity.focusTask ||
      continuity.activeTask ||
      continuity.latestTelegramTask ||
      continuity.latestWebTask ||
      null;
    const surfaces = continuity.surfaces || {};
    const recentTasks = Array.isArray(continuity.recentTasks) ? continuity.recentTasks : [];
    const badgeClass =
      suggestedAction.kind === 'review-latest'
        ? 'badge-allowed'
        : suggestedAction.kind === 'resume-active'
          ? 'badge-warning'
          : 'badge-blocked';
    const badgeLabel =
      suggestedAction.kind === 'review-latest'
        ? 'resume contexto'
        : suggestedAction.kind === 'resume-active'
          ? 'atividade em curso'
          : 'without continuidade';
    const focusTitle = focusTask
      ? escapeHtml((focusTask.shortId || 'task') + ' - ' + (focusTask.commandType || 'free-flow'))
      : 'No task in focus';
    const focusSummary = focusTask
      ? escapeHtml(focusTask.summary || 'No summary available.')
      : 'No recent task suitable for resume.';
    const focusMeta = focusTask ? 'Source: ' +
        escapeHtml(focusTask.source || 'n/a') +
        ' | Status: ' +
        escapeHtml(focusTask.status || 'n/a') +
        ' | Updated ' +
        escapeHtml(formatRelativeTime(focusTask.updatedAt))
      : 'Use Telegram or /app to create a new continuity thread.';
    const recentItems = recentTasks.length
      ? recentTasks
          .slice(0, 4)
          .map(
            (task) =>
              '<li><strong>' +
              escapeHtml(task.shortId || 'task') +
              '</strong> - ' +
              escapeHtml(task.source || 'n/a') +
              ' - ' +
              escapeHtml(task.status || 'n/a') +
              ' - ' +
              escapeHtml(formatRelativeTime(task.updatedAt)) +
              '</li>',
          )
          .join('')
      : '<li>No recent tasks to correlate.</li>';

    node.innerHTML =
      '<div class="cockpit-status">' +
      '<div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
      '<strong>Cross-surface continuity</strong>' +
      '<span class="badge ' +
      badgeClass +
      '">' +
      escapeHtml(badgeLabel) +
      '</span>' +
      '</div>' +
      '<div class="cockpit-headline">' +
      escapeHtml(suggestedAction.reason || 'No recommendation registered.') +
      '</div>' +
      '</div>' +
      '<a class="sidecar-link" href="/api/operations/continuity" target="_blank">/api/operations/continuity</a>' +
      '</div>' +
      '<div class="cockpit-grid">' +
      '<div class="cockpit-stack">' +
      '<div class="sidecar-card">' +
      '<strong>Suggested focus</strong>' +
      '<div style="margin-top:8px;">' +
      focusTitle +
      '</div>' +
      '<small>' +
      focusSummary +
      '</small>' +
      '<small>' +
      focusMeta +
      '</small>' +
      '</div>' +
      '<div class="sidecar-card">' +
      '<strong>Recent surfaces</strong>' +
      '<small>Telegram: ' +
      escapeHtml(String(surfaces.telegram || 0)) +
      ' | Web: ' +
      escapeHtml(String(surfaces.web || 0)) +
      ' | Other: ' +
      escapeHtml(String(surfaces.other || 0)) +
      '</small>' +
      '<small>Suggested action: ' +
      escapeHtml(suggestedAction.label || 'Resume context') +
      '</small>' +
      '</div>' +
      '</div>' +
      '<div class="sidecar-card">' +
      '<strong>Historico resumido</strong>' +
      '<ul class="cockpit-list">' +
      recentItems +
      '</ul>' +
      '</div>' +
      '</div>';
  }
}

export function getZavorthControlClassicClientOverviewSummaryContextScript(): string {
  return extractFunctionBody(zavorthControlClassicClientOverviewSummaryContext);
}
