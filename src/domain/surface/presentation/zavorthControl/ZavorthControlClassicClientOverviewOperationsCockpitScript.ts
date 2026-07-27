import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';
import { asErrorLike } from '../../../../utils/errorLike.js';

declare function escapeHtml(value: unknown): string;
declare function formatRelativeTime(value: unknown): string;
declare function showToast(msg: string, isError?: boolean): void;
declare function loadMetrics(): void;

interface CockpitAction {
  id?: string;
  label?: string;
  priority?: string;
  reason?: string;
  command?: string;
}

interface CockpitAlert {
  title?: string;
  level?: string;
  detail?: string;
  source?: string;
  timestamp?: string;
}

interface CockpitSummary {
  readySidecars?: number;
  enabledSidecars?: number;
  freeDiskPercent?: number;
  publishAgeLabel?: string;
}

interface CockpitRuntime {
  uptimeLabel?: string;
  platformLabel?: string;
  memoryLabel?: string;
  heapLabel?: string;
}

interface OperationsCockpit {
  error?: string;
  headline?: string;
  status?: string;
  summary?: CockpitSummary;
  runtime?: CockpitRuntime;
  actions?: CockpitAction[];
  alerts?: CockpitAlert[];
  highlights?: string[];
}

interface ReportOverviewAction {
  label?: string;
  command?: string;
  reason?: string;
  source?: string;
}

interface ReportOverview {
  posture?: string;
  headline?: string;
  operatorSummary?: string;
  nextAction?: string;
  actions?: ReportOverviewAction[];
}

interface ReportOperatorBrief {
  posture?: string;
  headline?: string;
  nextAction?: {
    label?: string;
    command?: string;
  };
}

interface ReportContinuityAction {
  label?: string;
  reason?: string;
}

interface ReportContinuityTask {
  shortId?: string;
  source?: string;
  status?: string;
}

interface ReportContinuitySurfaces {
  telegram?: number;
  web?: number;
  other?: number;
}

interface ReportContinuity {
  suggestedAction?: ReportContinuityAction;
  focusTask?: ReportContinuityTask | null;
  surfaces?: ReportContinuitySurfaces;
}

interface ReportTasks {
  activeCount?: number;
  completedLast24h?: number;
  failedLast24h?: number;
  waitingApprovalLast24h?: number;
  topExecutors?: string[];
}

interface ReportPermission {
  executor?: string;
  kind?: string;
  reason?: string;
}

interface ReportAlert {
  source?: string;
  title?: string;
  detail?: string;
}

interface ReportAction {
  label?: string;
  command?: string;
  reason?: string;
}

interface OperationsReport {
  error?: string;
  text?: string;
  executiveSummary?: string[];
  operatorBrief?: ReportOperatorBrief | null;
  continuity?: ReportContinuity | null;
  overviews?: {
    operational?: ReportOverview;
    trust?: ReportOverview;
    product?: ReportOverview;
  };
  tasks?: ReportTasks;
  pendingPermissions?: ReportPermission[];
  alerts?: ReportAlert[];
  actions?: ReportAction[];
}

function zavorthControlClassicClientOverviewOperationsCockpit() {
  function renderOperationsCockpit(cockpit: OperationsCockpit) {
    const node = document.getElementById('operations-cockpit');
    if (!node) return;
    if (!cockpit || cockpit.error) {
      node.innerHTML = '<div class="muted">Could not load operational cockpit.</div>';
      return;
    }

    const summary = cockpit.summary || {};
    const runtime = cockpit.runtime || {};
    const actions = cockpit.actions || [];
    const alerts = cockpit.alerts || [];
    const highlights = cockpit.highlights || [];
    const status = cockpit.status || 'attention';
    const statusClass =
      status === 'healthy' ? 'badge-allowed' : status === 'degraded' ? 'badge-blocked' : 'badge-warning';
    const statusLabel = status === 'healthy' ? 'stable' : status === 'degraded' ? 'degradado' : 'attention';
    const actionItems = actions.length
      ? actions
          .map(
            (action: CockpitAction) =>
              '<div class="cockpit-action-card">' +
              '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">' +
              '<strong>' +
              escapeHtml(action.label || 'Operational action') +
              '</strong>' +
              '<span class="badge ' +
              (action.priority === 'high' ? 'badge-blocked' : 'badge-warning') +
              '">' +
              escapeHtml(action.priority === 'high' ? 'agora' : 'rotina') +
              '</span>' +
              '</div>' +
              '<small>' +
              escapeHtml(action.reason || 'No detail.') +
              '</small>' +
              '<div class="cockpit-command">' +
              escapeHtml(action.command || '') +
              '</div>' +
              '<div><button class="btn btn-ghost" onclick="runCockpitAction(' +
              "'" +
              escapeHtml(action.id || '') +
              "'" +
              ')">run agora</button></div>' +
              '</div>',
          )
          .join('')
      : '<div class="muted">No recommended action right now.</div>';
    const alertItems = alerts.length
      ? alerts
          .map(
            (alert: CockpitAlert) =>
              '<div class="cockpit-alert-card">' +
              '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">' +
              '<strong>' +
              escapeHtml(alert.title || 'Sinal operational') +
              '</strong>' +
              '<span class="badge ' +
              (alert.level === 'error' ? 'badge-blocked' : alert.level === 'warn' ? 'badge-warning' : 'badge-allowed') +
              '">' +
              escapeHtml(alert.level || 'info') +
              '</span>' +
              '</div>' +
              '<small>' +
              escapeHtml(alert.detail || 'No detail.') +
              '</small>' +
              '<small>source: ' +
              escapeHtml(alert.source || 'runtime') +
              ' | ' +
              escapeHtml(formatRelativeTime(alert.timestamp)) +
              '</small>' +
              '</div>',
          )
          .join('')
      : '<div class="muted">No relevant operational alerts.</div>';

    node.innerHTML =
      '<div class="cockpit-status">' +
      '<div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
      '<strong>Cockpit operational</strong>' +
      '<span class="badge ' +
      statusClass +
      '">' +
      escapeHtml(statusLabel) +
      '</span>' +
      '</div>' +
      '<div class="cockpit-headline">' +
      escapeHtml(cockpit.headline || 'No consolidated summary.') +
      '</div>' +
      '</div>' +
      '<a class="sidecar-link" href="/api/operations/cockpit" target="_blank">/api/operations/cockpit</a>' +
      '</div>' +
      '<div class="cockpit-grid">' +
      '<div class="cockpit-stack">' +
      '<div class="cockpit-mini-grid">' +
      '<div class="cockpit-mini-card"><strong>Runtime status</strong><div>' +
      escapeHtml(runtime.uptimeLabel || 'n/a') +
      '</div><small>' +
      escapeHtml(runtime.platformLabel || 'n/a') +
      '</small></div>' +
      '<div class="cockpit-mini-card"><strong>Memory</strong><div>' +
      escapeHtml(runtime.memoryLabel || 'n/a') +
      '</div><small>' +
      escapeHtml(runtime.heapLabel || 'n/a') +
      '</small></div>' +
      '<div class="cockpit-mini-card"><strong>Sidecars</strong><div>' +
      escapeHtml(String(summary.readySidecars || 0)) +
      '/' +
      escapeHtml(String(summary.enabledSidecars || 0)) +
      '</div><small>Ready / enabled</small></div>' +
      '<div class="cockpit-mini-card"><strong>Free disk</strong><div>' +
      escapeHtml(String(summary.freeDiskPercent || 0)) +
      '%</div><small>Publish: ' +
      escapeHtml(summary.publishAgeLabel || 'n/a') +
      '</small></div>' +
      '</div>' +
      '<div class="sidecar-card">' +
      '<strong>Highlights</strong>' +
      '<ul class="cockpit-list">' +
      highlights.map((item: string) => '<li>' + escapeHtml(item) + '</li>').join('') +
      '</ul>' +
      '</div>' +
      '<div class="sidecar-card">' +
      '<strong>Next actions</strong>' +
      '<div class="cockpit-action-list">' +
      actionItems +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="cockpit-stack">' +
      '<div class="sidecar-card">' +
      '<strong>Recent alerts</strong>' +
      '<div class="cockpit-alert-list">' +
      alertItems +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>';
  }

  function renderOperationsReport(report: OperationsReport) {
    const node = document.getElementById('operations-report');
    if (!node) return;
    if (!report || report.error) {
      node.innerHTML = '<div class="muted">Could not load consolidated report.</div>';
      return;
    }

    const executiveSummary = report.executiveSummary || [];
    const operatorBrief = report.operatorBrief || null;
    const continuity = report.continuity || null;
    const overviews = report.overviews || {};
    const tasks = report.tasks || {};
    const pendingPermissions = report.pendingPermissions || [];
    const alerts = report.alerts || [];
    const actions = report.actions || [];
    const renderOverviewSection = (title: string, overview: ReportOverview | undefined, href: string) => {
      if (!overview) {
        return '';
      }
      const overviewActions = (overview.actions || []).length
        ? (overview.actions || [])
            .map(
              (action: ReportOverviewAction) =>
                '<li><strong>' +
                escapeHtml(action.label || 'Recommended action') +
                '</strong>: ' +
                escapeHtml(action.command || 'n/a') +
                ' | ' +
                escapeHtml(action.reason || 'No detail.') +
                ' <span class="muted">(' +
                escapeHtml(action.source || 'overview') +
                ')</span></li>',
            )
            .join('')
        : '<li>No additional canonical action.</li>';
      return (
        '<div class="report-card report-section">' +
        '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">' +
        '<strong>' +
        escapeHtml(title) +
        '</strong>' +
        '<a class="sidecar-link" href="' +
        escapeHtml(href) +
        '" target="_blank">' +
        escapeHtml(href) +
        '</a>' +
        '</div>' +
        '<ul class="report-list">' +
        '<li><strong>Postura</strong>: ' +
        escapeHtml(overview.posture || 'attention') +
        '</li>' +
        '<li><strong>Headline</strong>: ' +
        escapeHtml(overview.headline || 'No headline.') +
        '</li>' +
        '<li><strong>Summary</strong>: ' +
        escapeHtml(overview.operatorSummary || 'No summary.') +
        '</li>' +
        '<li><strong>Next action</strong>: ' +
        escapeHtml(overview.nextAction || 'No canonical action.') +
        '</li>' +
        overviewActions +
        '</ul></div>'
      );
    };
    const summaryItems = executiveSummary.length
      ? executiveSummary.map((item: string) => '<li>' + escapeHtml(item) + '</li>').join('')
      : '<li>No executive summary.</li>';
    const permissionItems = pendingPermissions.length
      ? pendingPermissions
          .map(
            (permission: ReportPermission) =>
              '<li><strong>' +
              escapeHtml(permission.executor || 'n/a') +
              '</strong> / ' +
              escapeHtml(permission.kind || 'n/a') +
              ': ' +
              escapeHtml(permission.reason || 'No detail.') +
              '</li>',
          )
          .join('')
      : '<li>No pending permission right now.</li>';
    const alertItems = alerts.length
      ? alerts
          .map(
            (alert: ReportAlert) =>
              '<li><strong>' +
              escapeHtml(alert.source || 'runtime') +
              '</strong>: ' +
              escapeHtml(alert.title || 'Alert') +
              ' | ' +
              escapeHtml(alert.detail || 'No detail.') +
              '</li>',
          )
          .join('')
      : '<li>No recent alerts.</li>';
    const actionItems = actions.length
      ? actions
          .map(
            (action: ReportAction) =>
              '<li><strong>' +
              escapeHtml(action.label || 'Action') +
              '</strong>: ' +
              escapeHtml(action.command || 'n/a') +
              ' | ' +
              escapeHtml(action.reason || 'No detail.') +
              '</li>',
          )
          .join('')
      : '<li>No recommended action.</li>';
    const operatorBriefSection = operatorBrief ? '<div class="report-card report-section"><strong>Operator briefing</strong><ul class="report-list">' +
        '<li><strong>Posture</strong>: ' +
        escapeHtml(operatorBrief.posture || 'watch') +
        '</li>' +
        '<li><strong>Headline</strong>: ' +
        escapeHtml(operatorBrief.headline || 'No summary.') +
        '</li>' +
        '<li><strong>Next action</strong>: ' +
        escapeHtml(operatorBrief.nextAction?.label || 'No suggested action') +
        '</li>' +
        '<li><strong>Command</strong>: ' +
        escapeHtml(operatorBrief.nextAction?.command || 'n/a') +
        '</li>' +
        '</ul></div>'
      : '';
    const continuitySection = continuity ? '<div class="report-card report-section"><strong>Cross-surface continuity</strong><ul class="report-list">' +
        '<li><strong>Suggested action</strong>: ' +
        escapeHtml(continuity.suggestedAction?.label || 'Resume context') +
        '</li>' +
        '<li><strong>Reason</strong>: ' +
        escapeHtml(continuity.suggestedAction?.reason || 'No justification.') +
        '</li>' +
        '<li><strong>Focus</strong>: ' +
        escapeHtml(
          continuity.focusTask
            ? (continuity.focusTask.shortId || 'task') +
                ' | ' +
                (continuity.focusTask.source || 'n/a') +
                ' | ' +
                (continuity.focusTask.status || 'n/a')
            : 'no dominant task',
        ) +
        '</li>' +
        '<li><strong>surfaces</strong>: Telegram ' +
        escapeHtml(String(continuity.surfaces?.telegram || 0)) +
        ' | Web ' +
        escapeHtml(String(continuity.surfaces?.web || 0)) +
        ' | Outras ' +
        escapeHtml(String(continuity.surfaces?.other || 0)) +
        '</li>' +
        '</ul></div>'
      : '';
    const canonicalOverviewSections = [
      renderOverviewSection('Canonical operational overview', overviews.operational, '/api/operations/overview'),
      renderOverviewSection('Canonical trust overview', overviews.trust, '/api/operations/trust-overview'),
      renderOverviewSection('Canonical product overview', overviews.product, '/api/operations/product-overview'),
    ].join('');

    node.innerHTML =
      '<div style="display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:16px; flex-wrap:wrap;">' +
      '<div><strong>Consolidated report</strong><div class="muted" style="margin-top:6px;">Executive panorama, tasks, approvals, and host next steps.</div></div>' +
      '<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">' +
      '<button class="btn btn-ghost" onclick="copyOperationsReport()">Copy text</button>' +
      '<a class="sidecar-link" href="/api/operations/report" target="_blank">/api/operations/report</a>' +
      '</div>' +
      '</div>' +
      '<div class="report-layout">' +
      '<div class="report-text" id="operations-report-text">' +
      escapeHtml(report.text || 'No consolidated text.') +
      '</div>' +
      '<div class="cockpit-stack">' +
      operatorBriefSection +
      continuitySection +
      canonicalOverviewSections +
      '<div class="report-card report-section"><strong>Executive summary</strong><ul class="report-list">' +
      summaryItems +
      '</ul></div>' +
      '<div class="report-card report-section"><strong>Tasks recentes</strong><ul class="report-list">' +
      '<li>Ativas agora: ' +
      escapeHtml(String(tasks.activeCount || 0)) +
      '</li>' +
      '<li>Completed in last 24h: ' +
      escapeHtml(String(tasks.completedLast24h || 0)) +
      '</li>' +
      '<li>Failed in last 24h: ' +
      escapeHtml(String(tasks.failedLast24h || 0)) +
      '</li>' +
      '<li>Waiting for approval: ' +
      escapeHtml(String(tasks.waitingApprovalLast24h || 0)) +
      '</li>' +
      '<li>Executores mais usados: ' +
      escapeHtml((tasks.topExecutors || []).join(' | ') || 'without volume relevante') +
      '</li>' +
      '</ul></div>' +
      '<div class="report-card report-section"><strong>Permissions pending</strong><ul class="report-list">' +
      permissionItems +
      '</ul></div>' +
      '<div class="report-card report-section"><strong>Alerts and actions</strong><ul class="report-list">' +
      alertItems +
      actionItems +
      '</ul></div>' +
      '</div>' +
      '</div>';
  }

  async function copyOperationsReport() {
    const node = document.getElementById('operations-report-text');
    if (!node) {
      showToast('Consolidated report unavailable for copy.', true);
      return;
    }

    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        throw new Error('clipboard unavailable');
      }
      await navigator.clipboard.writeText(node.textContent || '');
      showToast('Report consolidado copiado.', false);
    } catch (error: unknown) {
      showToast('Could not copy consolidated report.', true);
    }
  }

  async function copyTextToClipboard(value: string | number | boolean, successMessage?: string) {
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        throw new Error('clipboard unavailable');
      }
      await navigator.clipboard.writeText(String(value || ''));
      showToast(successMessage || 'Content copied.', false);
    } catch (error: unknown) {
      showToast('Could not copy content.', true);
    }
  }

  async function runCockpitAction(actionId: string) {
    try {
      const response = await fetch('/api/operations/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ actionId }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; action?: { label?: string } };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Failed to start operational action.');
      }
      const action = payload.action || {};
      showToast('Action started: ' + (action.label || actionId) + '. Check the log if it restarts the host.', false);
      setTimeout(() => {
        loadMetrics();
      }, 1500);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      showToast(error instanceof Error ? err.message : 'Failed to start operational action.', true);
    }
  }

  async function runIntegrationHubAction(integrationId: string, actionId: string) {
    try {
      const response = await fetch('/api/operations/integrations/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ integrationId, actionId }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        action?: { label?: string; note?: string; status?: string };
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Failed to run Integration Hub action.');
      }
      const action = payload.action || {};
      const summary = action.note || 'Action completed: ' + (action.label || actionId) + '.';
      showToast(summary, action.status === 'failed_to_start' ? true : false);
      setTimeout(() => {
        loadMetrics();
      }, 1200);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      showToast(error instanceof Error ? err.message : 'Failed to run Integration Hub action.', true);
    }
  }
}

export function getZavorthControlClassicClientOverviewOperationsCockpitScript(): string {
  return extractFunctionBody(zavorthControlClassicClientOverviewOperationsCockpit);
}
