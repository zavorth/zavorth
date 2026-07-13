import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';
import type { ClassicPluginRegistryDto as ZavorthPluginRegistrySnapshot } from './ZavorthControlClassicClientContracts.js';
import { asErrorLike } from '../../../../utils/errorLike.js';

declare function escapeHtml(value: unknown): string;
declare function showToast(msg: string, isError?: boolean): void;

type PluginPlaneErrorPayload = { error: unknown };

function zavorthControlClassicClientOverviewMeshPlugins() {
  function renderOperationsPlugins(
    plugins: ZavorthPluginRegistrySnapshot | PluginPlaneErrorPayload | null | undefined,
  ) {
    const node = document.getElementById('operations-plugins');
    if (!node) return;
    if (!plugins || 'error' in (plugins as PluginPlaneErrorPayload)) {
      node.innerHTML = '<div class="muted">No foi possivel carregar o plugin plane.</div>';
      return;
    }

    const snapshot = plugins as ZavorthPluginRegistrySnapshot;
    const summary = snapshot.summary || ({} as ZavorthPluginRegistrySnapshot['summary']);
    const selected = snapshot.selected || null;
    const entries = Array.isArray(snapshot.entries) ? snapshot.entries : [];
    const actionItems =
      selected && Array.isArray(selected.actions) && selected.actions.length
        ? selected.actions
            .slice(0, 3)
            .map(
              (action) =>
                '<button class="btn" type="button" onclick="runPluginAction(' +
                "'" +
                escapeHtml(selected.id || '') +
                "'," +
                "'" +
                escapeHtml(String((action.id || '').split(':').pop() || 'inspect')) +
                "'" +
                ')">' +
                escapeHtml(action.label || 'Acao') +
                '</button>',
            )
            .join('')
        : '';
    const entryItems = entries.length
      ? entries
          .slice(0, 6)
          .map(
            (entry) =>
              '<li><strong>' +
              escapeHtml(entry.label || entry.id || 'Plugin') +
              '</strong> · ' +
              escapeHtml(entry.kind || 'item') +
              ' · ' +
              escapeHtml(entry.installState || 'available') +
              ' · ' +
              escapeHtml(entry.trust || 'review') +
              '</li>',
          )
          .join('')
      : '<li>No plugin or extension visible right now.</li>';
    const selectedDetails = selected
      ? '<div class="sidecar-card"><strong>Item em foco</strong>' +
        '<small>' +
        escapeHtml(selected.summary || 'Sem resumo adicional.') +
        '</small>' +
        '<small>Kind: ' +
        escapeHtml(selected.kind || 'item') +
        ' | Source: ' +
        escapeHtml(selected.source || 'n/d') +
        '</small>' +
        '<div class="cockpit-command">' +
        escapeHtml(selected.actionHint || 'No suggested action.') +
        '</div>' +
        (actionItems
          ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">' + actionItems + '</div>'
          : '') +
        '</div>'
      : '<div class="sidecar-card"><strong>Item em foco</strong><small>Use /plugins &lt;id|filtro&gt; para aprofundar um item do plane.</small></div>';

    node.innerHTML =
      '<div class="cockpit-status">' +
      '<div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
      '<strong>Plugin plane</strong>' +
      '<span class="badge ' +
      (summary.trusted ? 'badge-info' : 'badge-warning') +
      '">' +
      escapeHtml(String(summary.total || 0)) +
      ' item(ns)</span>' +
      '</div>' +
      '<div class="cockpit-headline">' +
      escapeHtml(snapshot.narrative?.operatorSummary || 'Plugins, skills e extensions visiveis com acoes guiadas.') +
      '</div>' +
      '</div>' +
      '<a class="sidecar-link" href="/api/operations/plugins" target="_blank">/api/operations/plugins</a>' +
      '</div>' +
      '<div class="cockpit-grid">' +
      '<div class="cockpit-stack">' +
      '<div class="cockpit-mini-grid">' +
      '<div class="cockpit-mini-card"><strong>Total</strong><div>' +
      escapeHtml(String(summary.total || 0)) +
      '</div><small>Itens no plane</small></div>' +
      '<div class="cockpit-mini-card"><strong>Registrados</strong><div>' +
      escapeHtml(String(summary.installed || 0)) +
      '</div><small>Adotados no plane ou locais</small></div>' +
      '<div class="cockpit-mini-card"><strong>Trusted</strong><div>' +
      escapeHtml(String(summary.trusted || 0)) +
      '</div><small>Itens confiaveis agora</small></div>' +
      '<div class="cockpit-mini-card"><strong>Workspace</strong><div>' +
      escapeHtml(String(summary.workspaceExtensions || 0)) +
      '</div><small>Extensoes do ZAVORTH.md</small></div>' +
      '</div>' +
      selectedDetails +
      '</div>' +
      '<div class="cockpit-stack">' +
      '<div class="sidecar-card"><strong>Catalog resumido</strong><ul class="cockpit-list">' +
      entryItems +
      '</ul></div>' +
      '<div class="sidecar-card"><strong>Next step</strong><small>Use /plugins, /integrations and workspace packs to navigate the ecosystem without guessing where each extension lives.</small></div>' +
      '</div>' +
      '</div>';
  }

  async function runPluginAction(pluginId: string, actionId: string) {
    try {
      const response = await fetch('/api/operations/plugins/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId, actionId }),
      });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || 'Failed to executar a acao do plugin plane.');
      }
      renderOperationsPlugins(payload.plugins || null);
      showToast(payload.result?.summary || 'Acao executada: ' + actionId + '.');
    } catch (error: unknown) {
      const err = asErrorLike(error);
      showToast(error instanceof Error ? err.message : 'Failed to executar a acao do plugin plane.');
    }
  }
}

export function getZavorthControlClassicClientOverviewMeshPluginsScript(): string {
  return extractFunctionBody(zavorthControlClassicClientOverviewMeshPlugins);
}
