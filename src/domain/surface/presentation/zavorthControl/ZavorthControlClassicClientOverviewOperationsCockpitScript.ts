import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';

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
        node.innerHTML = '<div class="muted">Nao foi possivel carregar o cockpit operacional.</div>';
        return;
      }

      const summary = cockpit.summary || {};
      const runtime = cockpit.runtime || {};
      const actions = cockpit.actions || [];
      const alerts = cockpit.alerts || [];
      const highlights = cockpit.highlights || [];
      const status = cockpit.status || 'attention';
      const statusClass = status === 'healthy' ? 'badge-allowed' : (status === 'degraded' ? 'badge-blocked' : 'badge-warning');
      const statusLabel = status === 'healthy' ? 'estavel' : (status === 'degraded' ? 'degradado' : 'atencao');
      const actionItems = actions.length
        ? actions.map((action: CockpitAction) =>
            '<div class="cockpit-action-card">'
            + '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">'
            + '<strong>' + escapeHtml(action.label || 'Acao operacional') + '</strong>'
            + '<span class="badge ' + (action.priority === 'high' ? 'badge-blocked' : 'badge-warning') + '">' + escapeHtml(action.priority === 'high' ? 'agora' : 'rotina') + '</span>'
            + '</div>'
            + '<small>' + escapeHtml(action.reason || 'Sem detalhe.') + '</small>'
            + '<div class="cockpit-command">' + escapeHtml(action.command || '') + '</div>'
            + '<div><button class="btn btn-ghost" onclick="runCockpitAction(' + "'" + escapeHtml(action.id || '') + "'" + ')">Executar agora</button></div>'
            + '</div>'
          ).join('')
        : '<div class="muted">Nenhuma acao recomendada no momento.</div>';
      const alertItems = alerts.length
        ? alerts.map((alert: CockpitAlert) =>
            '<div class="cockpit-alert-card">'
            + '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">'
            + '<strong>' + escapeHtml(alert.title || 'Sinal operacional') + '</strong>'
            + '<span class="badge ' + (alert.level === 'error' ? 'badge-blocked' : (alert.level === 'warn' ? 'badge-warning' : 'badge-allowed')) + '">' + escapeHtml(alert.level || 'info') + '</span>'
            + '</div>'
            + '<small>' + escapeHtml(alert.detail || 'Sem detalhe.') + '</small>'
            + '<small>Fonte: ' + escapeHtml(alert.source || 'runtime') + ' | ' + escapeHtml(formatRelativeTime(alert.timestamp)) + '</small>'
            + '</div>'
          ).join('')
        : '<div class="muted">Sem alertas operacionais relevantes.</div>';

      node.innerHTML =
        '<div class="cockpit-status">'
        + '<div>'
        + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
        + '<strong>Cockpit operacional</strong>'
        + '<span class="badge ' + statusClass + '">' + escapeHtml(statusLabel) + '</span>'
        + '</div>'
        + '<div class="cockpit-headline">' + escapeHtml(cockpit.headline || 'Sem resumo consolidado.') + '</div>'
        + '</div>'
        + '<a class="sidecar-link" href="/api/operations/cockpit" target="_blank">/api/operations/cockpit</a>'
        + '</div>'
        + '<div class="cockpit-grid">'
        + '<div class="cockpit-stack">'
        + '<div class="cockpit-mini-grid">'
        + '<div class="cockpit-mini-card"><strong>Status do runtime</strong><div>' + escapeHtml(runtime.uptimeLabel || 'n/d') + '</div><small>' + escapeHtml(runtime.platformLabel || 'n/d') + '</small></div>'
        + '<div class="cockpit-mini-card"><strong>Memoria</strong><div>' + escapeHtml(runtime.memoryLabel || 'n/d') + '</div><small>' + escapeHtml(runtime.heapLabel || 'n/d') + '</small></div>'
        + '<div class="cockpit-mini-card"><strong>Sidecars</strong><div>' + escapeHtml(String(summary.readySidecars || 0)) + '/' + escapeHtml(String(summary.enabledSidecars || 0)) + '</div><small>Prontos / habilitados</small></div>'
        + '<div class="cockpit-mini-card"><strong>Disco livre</strong><div>' + escapeHtml(String(summary.freeDiskPercent || 0)) + '%</div><small>Publish: ' + escapeHtml(summary.publishAgeLabel || 'n/d') + '</small></div>'
        + '</div>'
        + '<div class="sidecar-card">'
        + '<strong>Destaques</strong>'
        + '<ul class="cockpit-list">' + highlights.map((item: string) => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul>'
        + '</div>'
        + '<div class="sidecar-card">'
        + '<strong>Proximas acoes</strong>'
        + '<div class="cockpit-action-list">' + actionItems + '</div>'
        + '</div>'
        + '</div>'
        + '<div class="cockpit-stack">'
        + '<div class="sidecar-card">'
        + '<strong>Alertas recentes</strong>'
        + '<div class="cockpit-alert-list">' + alertItems + '</div>'
        + '</div>'
        + '</div>'
        + '</div>';
    }

    function renderOperationsReport(report: OperationsReport) {
      const node = document.getElementById('operations-report');
      if (!node) return;
      if (!report || report.error) {
        node.innerHTML = '<div class="muted">Nao foi possivel carregar o relatorio consolidado.</div>';
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
          ? (overview.actions || []).map((action: ReportOverviewAction) =>
              '<li><strong>' + escapeHtml(action.label || 'Acao recomendada') + '</strong>: '
              + escapeHtml(action.command || 'n/d') + ' | ' + escapeHtml(action.reason || 'Sem detalhe.')
              + ' <span class="muted">(' + escapeHtml(action.source || 'overview') + ')</span></li>'
            ).join('')
          : '<li>Nenhuma acao canonica adicional.</li>';
        return '<div class="report-card report-section">'
          + '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">'
          + '<strong>' + escapeHtml(title) + '</strong>'
          + '<a class="sidecar-link" href="' + escapeHtml(href) + '" target="_blank">' + escapeHtml(href) + '</a>'
          + '</div>'
          + '<ul class="report-list">'
          + '<li><strong>Postura</strong>: ' + escapeHtml(overview.posture || 'attention') + '</li>'
          + '<li><strong>Headline</strong>: ' + escapeHtml(overview.headline || 'Sem headline.') + '</li>'
          + '<li><strong>Resumo</strong>: ' + escapeHtml(overview.operatorSummary || 'Sem resumo.') + '</li>'
          + '<li><strong>Proxima acao</strong>: ' + escapeHtml(overview.nextAction || 'Sem acao canonica.') + '</li>'
          + overviewActions
          + '</ul></div>';
      };
      const summaryItems = executiveSummary.length
        ? executiveSummary.map((item: string) => '<li>' + escapeHtml(item) + '</li>').join('')
        : '<li>Sem resumo executivo.</li>';
      const permissionItems = pendingPermissions.length
        ? pendingPermissions.map((permission: ReportPermission) =>
            '<li><strong>' + escapeHtml(permission.executor || 'n/d') + '</strong> / '
            + escapeHtml(permission.kind || 'n/d') + ': ' + escapeHtml(permission.reason || 'Sem detalhe.') + '</li>'
          ).join('')
        : '<li>Nenhuma permissao pendente agora.</li>';
      const alertItems = alerts.length
        ? alerts.map((alert: ReportAlert) =>
            '<li><strong>' + escapeHtml(alert.source || 'runtime') + '</strong>: '
            + escapeHtml(alert.title || 'Alerta') + ' | ' + escapeHtml(alert.detail || 'Sem detalhe.') + '</li>'
          ).join('')
        : '<li>Nenhum alerta recente.</li>';
      const actionItems = actions.length
        ? actions.map((action: ReportAction) =>
            '<li><strong>' + escapeHtml(action.label || 'Acao') + '</strong>: '
            + escapeHtml(action.command || 'n/d') + ' | ' + escapeHtml(action.reason || 'Sem detalhe.') + '</li>'
          ).join('')
        : '<li>Nenhuma acao recomendada.</li>';
      const operatorBriefSection = operatorBrief
        ? '<div class="report-card report-section"><strong>Briefing do operador</strong><ul class="report-list">'
          + '<li><strong>Postura</strong>: ' + escapeHtml(operatorBrief.posture || 'watch') + '</li>'
          + '<li><strong>Headline</strong>: ' + escapeHtml(operatorBrief.headline || 'Sem resumo.') + '</li>'
          + '<li><strong>Proxima acao</strong>: ' + escapeHtml(operatorBrief.nextAction?.label || 'Sem acao sugerida') + '</li>'
          + '<li><strong>Comando</strong>: ' + escapeHtml(operatorBrief.nextAction?.command || 'n/d') + '</li>'
          + '</ul></div>'
        : '';
      const continuitySection = continuity
        ? '<div class="report-card report-section"><strong>Continuidade entre superficies</strong><ul class="report-list">'
          + '<li><strong>Acao sugerida</strong>: ' + escapeHtml(continuity.suggestedAction?.label || 'Retomar contexto') + '</li>'
          + '<li><strong>Motivo</strong>: ' + escapeHtml(continuity.suggestedAction?.reason || 'Sem justificativa.') + '</li>'
          + '<li><strong>Foco</strong>: ' + escapeHtml(continuity.focusTask ? ((continuity.focusTask.shortId || 'task') + ' | ' + (continuity.focusTask.source || 'n/d') + ' | ' + (continuity.focusTask.status || 'n/d')) : 'sem task dominante') + '</li>'
          + '<li><strong>Superficies</strong>: Telegram ' + escapeHtml(String(continuity.surfaces?.telegram || 0)) + ' | Web ' + escapeHtml(String(continuity.surfaces?.web || 0)) + ' | Outras ' + escapeHtml(String(continuity.surfaces?.other || 0)) + '</li>'
          + '</ul></div>'
        : '';
      const canonicalOverviewSections = [
        renderOverviewSection('Overview operacional canonico', overviews.operational, '/api/operations/overview'),
        renderOverviewSection('Overview de trust canonico', overviews.trust, '/api/operations/trust-overview'),
        renderOverviewSection('Overview de produto canonico', overviews.product, '/api/operations/product-overview'),
      ].join('');

      node.innerHTML =
        '<div style="display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:16px; flex-wrap:wrap;">'
        + '<div><strong>Relatorio consolidado</strong><div class="muted" style="margin-top:6px;">Panorama executivo, tasks, aprovacoes e proximos passos do host.</div></div>'
        + '<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">'
        + '<button class="btn btn-ghost" onclick="copyOperationsReport()">Copiar texto</button>'
        + '<a class="sidecar-link" href="/api/operations/report" target="_blank">/api/operations/report</a>'
        + '</div>'
        + '</div>'
        + '<div class="report-layout">'
        + '<div class="report-text" id="operations-report-text">' + escapeHtml(report.text || 'Sem texto consolidado.') + '</div>'
        + '<div class="cockpit-stack">'
        + operatorBriefSection
        + continuitySection
        + canonicalOverviewSections
        + '<div class="report-card report-section"><strong>Resumo executivo</strong><ul class="report-list">' + summaryItems + '</ul></div>'
        + '<div class="report-card report-section"><strong>Tasks recentes</strong><ul class="report-list">'
        + '<li>Ativas agora: ' + escapeHtml(String(tasks.activeCount || 0)) + '</li>'
        + '<li>Concluidas nas ultimas 24h: ' + escapeHtml(String(tasks.completedLast24h || 0)) + '</li>'
        + '<li>Falharam nas ultimas 24h: ' + escapeHtml(String(tasks.failedLast24h || 0)) + '</li>'
        + '<li>Aguardando aprovacao: ' + escapeHtml(String(tasks.waitingApprovalLast24h || 0)) + '</li>'
        + '<li>Executores mais usados: ' + escapeHtml((tasks.topExecutors || []).join(' | ') || 'sem volume relevante') + '</li>'
        + '</ul></div>'
        + '<div class="report-card report-section"><strong>Permissoes pendentes</strong><ul class="report-list">' + permissionItems + '</ul></div>'
        + '<div class="report-card report-section"><strong>Alertas e acoes</strong><ul class="report-list">' + alertItems + actionItems + '</ul></div>'
        + '</div>'
        + '</div>';
    }

    async function copyOperationsReport() {
      const node = document.getElementById('operations-report-text');
      if (!node) {
        showToast('Relatorio consolidado indisponivel para copia.', true);
        return;
      }

      try {
        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
          throw new Error('clipboard indisponivel');
        }
        await navigator.clipboard.writeText(node.textContent || '');
        showToast('Relatorio consolidado copiado.', false);
      } catch (error) {
        showToast('Nao foi possivel copiar o relatorio consolidado.', true);
      }
    }

    async function copyTextToClipboard(value: string | number | boolean, successMessage?: string) {
      try {
        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
          throw new Error('clipboard indisponivel');
        }
        await navigator.clipboard.writeText(String(value || ''));
        showToast(successMessage || 'Conteudo copiado.', false);
      } catch (error) {
        showToast('Nao foi possivel copiar o conteudo.', true);
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
        const payload = await response.json() as { ok?: boolean; error?: string; action?: { label?: string } };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || 'Falha ao iniciar acao operacional.');
        }
        const action = payload.action || {};
        showToast('Acao iniciada: ' + (action.label || actionId) + '. Consulte o log se ela reiniciar o host.', false);
        setTimeout(() => {
          loadMetrics();
        }, 1500);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Falha ao iniciar acao operacional.', true);
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
        const payload = await response.json() as { ok?: boolean; error?: string; action?: { label?: string; note?: string; status?: string } };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || 'Falha ao executar a acao do Integration Hub.');
        }
        const action = payload.action || {};
        const summary = action.note || ('Acao executada: ' + (action.label || actionId) + '.');
        showToast(summary, action.status === 'failed_to_start' ? true : false);
        setTimeout(() => {
          loadMetrics();
        }, 1200);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Falha ao executar a acao do Integration Hub.', true);
      }
    }
}

export function getZavorthControlClassicClientOverviewOperationsCockpitScript(): string {
  return extractFunctionBody(zavorthControlClassicClientOverviewOperationsCockpit);
}
