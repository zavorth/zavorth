// @ts-nocheck
import { extractFunctionBody } from './DashboardClassicScriptUtils.js';

function dashboardClassicClientOverviewMeshPlugins() {
    function renderOperationsPlugins(plugins) {
      const node = document.getElementById('operations-plugins');
      if (!node) return;
      if (!plugins || plugins.error) {
        node.innerHTML = '<div class="muted">Nao foi possivel carregar o plugin plane.</div>';
        return;
      }

      const summary = plugins.summary || {};
      const selected = plugins.selected || null;
      const entries = Array.isArray(plugins.entries) ? plugins.entries : [];
      const actionItems = selected && Array.isArray(selected.actions) && selected.actions.length
        ? selected.actions.slice(0, 3).map((action) =>
            '<button class="btn" type="button" onclick="runPluginAction('
            + '\'' + escapeHtml(selected.id || '') + '\','
            + '\'' + escapeHtml(String((action.id || '').split(':').pop() || 'inspect')) + '\''
            + ')">'
            + escapeHtml(action.label || 'Acao')
            + '</button>'
          ).join('')
        : '';
      const entryItems = entries.length
        ? entries.slice(0, 6).map((entry) =>
            '<li><strong>' + escapeHtml(entry.label || entry.id || 'Plugin') + '</strong> Â· '
            + escapeHtml(entry.kind || 'item') + ' Â· '
            + escapeHtml(entry.installState || 'available') + ' Â· '
            + escapeHtml(entry.trust || 'review')
            + '</li>'
          ).join('')
        : '<li>Nenhum plugin ou extensao visivel agora.</li>';
      const selectedDetails = selected
        ? '<div class="sidecar-card"><strong>Item em foco</strong>'
          + '<small>' + escapeHtml(selected.summary || 'Sem resumo adicional.') + '</small>'
          + '<small>Kind: ' + escapeHtml(selected.kind || 'item') + ' | Source: ' + escapeHtml(selected.source || 'n/d') + '</small>'
          + '<div class="cockpit-command">' + escapeHtml(selected.actionHint || 'Sem acao sugerida.') + '</div>'
          + (actionItems ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">' + actionItems + '</div>' : '')
          + '</div>'
        : '<div class="sidecar-card"><strong>Item em foco</strong><small>Use /plugins &lt;id|filtro&gt; para aprofundar um item do plane.</small></div>';

      node.innerHTML =
        '<div class="cockpit-status">'
        + '<div>'
        + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
        + '<strong>Plugin plane</strong>'
        + '<span class="badge ' + (summary.trusted ? 'badge-info' : 'badge-warning') + '">' + escapeHtml(String(summary.total || 0)) + ' item(ns)</span>'
        + '</div>'
        + '<div class="cockpit-headline">' + escapeHtml(plugins.narrative?.operatorSummary || 'Plugins, skills e extensoes visiveis com acoes guiadas.') + '</div>'
        + '</div>'
        + '<a class="sidecar-link" href="/api/operations/plugins" target="_blank">/api/operations/plugins</a>'
        + '</div>'
        + '<div class="cockpit-grid">'
        + '<div class="cockpit-stack">'
        + '<div class="cockpit-mini-grid">'
        + '<div class="cockpit-mini-card"><strong>Total</strong><div>' + escapeHtml(String(summary.total || 0)) + '</div><small>Itens no plane</small></div>'
        + '<div class="cockpit-mini-card"><strong>Registrados</strong><div>' + escapeHtml(String(summary.installed || 0)) + '</div><small>Adotados no plane ou locais</small></div>'
        + '<div class="cockpit-mini-card"><strong>Trusted</strong><div>' + escapeHtml(String(summary.trusted || 0)) + '</div><small>Itens confiaveis agora</small></div>'
        + '<div class="cockpit-mini-card"><strong>Workspace</strong><div>' + escapeHtml(String(summary.workspaceExtensions || 0)) + '</div><small>Extensoes do ZAVORTH.md</small></div>'
        + '</div>'
        + selectedDetails
        + '</div>'
        + '<div class="cockpit-stack">'
        + '<div class="sidecar-card"><strong>Catalogo resumido</strong><ul class="cockpit-list">' + entryItems + '</ul></div>'
        + '<div class="sidecar-card"><strong>Proximo passo</strong><small>Use /plugins, /integrations e os packs de workspace para navegar o ecossistema sem adivinhar onde cada extensao mora.</small></div>'
        + '</div>'
        + '</div>';
    }

    async function runPluginAction(pluginId, actionId) {
      try {
        const response = await fetch('/api/operations/plugins/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pluginId, actionId }),
        });
        const payload = await response.json();
        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error || 'Falha ao executar a acao do plugin plane.');
        }
        renderOperationsPlugins(payload.plugins || null);
        showToast(payload.result?.summary || ('Acao executada: ' + actionId + '.'));
      } catch (error) {
        showToast(error.message || 'Falha ao executar a acao do plugin plane.');
      }
    }

}

export function getDashboardClassicClientOverviewMeshPluginsScript(): string {
  return extractFunctionBody(dashboardClassicClientOverviewMeshPlugins);
}

