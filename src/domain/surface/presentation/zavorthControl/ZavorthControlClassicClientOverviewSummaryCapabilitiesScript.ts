import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';
import type { ClassicCapabilityCatalogDto as ZavorthCapabilityCatalogSnapshot } from './ZavorthControlClassicClientContracts.js';

declare function escapeHtml(value: unknown): string;

type CapabilityCatalogErrorPayload = { error: unknown };

function zavorthControlClassicClientOverviewSummaryCapabilities() {
  // Consumed at runtime via extractFunctionBody(); renders the capabilities card.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function renderOperationsCapabilities(
    capabilities: ZavorthCapabilityCatalogSnapshot | CapabilityCatalogErrorPayload | null | undefined,
  ) {
    const node = document.getElementById('operations-capabilities');
    if (!node) return;
    if (!capabilities || 'error' in (capabilities as CapabilityCatalogErrorPayload)) {
      node.innerHTML = '<div class="muted">Could not load capability catalog.</div>';
      return;
    }

    const snapshot = capabilities as ZavorthCapabilityCatalogSnapshot;
    const summary = snapshot.summary || ({} as ZavorthCapabilityCatalogSnapshot['summary']);
    const categories = Array.isArray(snapshot.categories) ? snapshot.categories : [];
    const featuredCommands = Array.isArray(snapshot.featuredCommands) ? snapshot.featuredCommands : [];
    const featuredRoutes = Array.isArray(snapshot.featuredImplicitRoutes) ? snapshot.featuredImplicitRoutes : [];
    const platformSummary = snapshot.platforms?.summary || { ready: 0, partial: 0, planned: 0, disabled: 0 };
    const integrationSummary = snapshot.integrations || ({} as ZavorthCapabilityCatalogSnapshot['integrations']);
    const capabilityActions =
      snapshot.capabilityActions || ({} as ZavorthCapabilityCatalogSnapshot['capabilityActions']);
    const capabilityActionSummary = capabilityActions.summary || ({} as { exposed?: number });
    const capabilityActionItems = Array.isArray(capabilityActions.items) ? capabilityActions.items : [];
    const categoryItems = categories.length
      ? categories
          .map(
            (category) =>
              '<li><strong>' +
              escapeHtml(category.label || category.type || 'Categoria') +
              '</strong> · ' +
              escapeHtml(String(category.total || 0)) +
              ' total · ' +
              escapeHtml(String(category.commands || 0)) +
              ' commands · ' +
              escapeHtml(String(category.implicitRoutes || 0)) +
              ' rotas</li>',
          )
          .join('')
      : '<li>No categories registered.</li>';
    const commandItems = featuredCommands.length
      ? featuredCommands
          .slice(0, 5)
          .map(
            (entry) =>
              '<div class="cockpit-action-card">' +
              '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">' +
              '<strong>' +
              escapeHtml(entry.command || entry.label || '/task') +
              '</strong>' +
              '<span class="badge ' +
              (entry.source === 'plugin' ? 'badge-info' : 'badge-allowed') +
              '">' +
              escapeHtml(entry.source === 'plugin' ? 'plugin' : 'core') +
              '</span>' +
              '</div>' +
              '<small>' +
              escapeHtml(entry.description || 'No additional description.') +
              '</small>' +
              '<small>Section: ' +
              escapeHtml(entry.section || 'execution') +
              (entry.executorPreference ? ' | Executor: ' + escapeHtml(entry.executorPreference) : '') +
              '</small>' +
              (entry.usage ? '<div class="cockpit-command">' + escapeHtml(entry.command + ' ' + entry.usage) + '</div>'
                : '') +
              '</div>',
          )
          .join('')
      : '<div class="muted">No visible commands to highlight.</div>';
    const routeItems = featuredRoutes.length
      ? featuredRoutes
          .slice(0, 4)
          .map(
            (entry) =>
              '<div class="cockpit-action-card">' +
              '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">' +
              '<strong>' +
              escapeHtml(entry.label || 'Automatic route') +
              '</strong>' +
              '<span class="badge badge-warning">' +
              escapeHtml(entry.executorPreference || 'auto') +
              '</span>' +
              '</div>' +
              '<small>' +
              escapeHtml(entry.routingReason || entry.description || 'No additional rationale.') +
              '</small>' +
              '<small>Confianca: ' +
              escapeHtml(entry.confidence != null ? String(entry.confidence) : 'n/a') +
              '</small>' +
              '</div>',
          )
          .join('')
      : '<div class="muted">No automatic route highlighted.</div>';
    const governedCapabilityItems = capabilityActionItems.length
      ? capabilityActionItems
          .slice(0, 4)
          .map(
            (entry) =>
              '<div class="cockpit-action-card">' +
              '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">' +
              '<strong>' +
              escapeHtml(entry.title || entry.actionId || 'Capability action') +
              '</strong>' +
              '<span class="badge badge-allowed">' +
              escapeHtml(entry.status || 'available') +
              '</span>' +
              '</div>' +
              '<small>' +
              escapeHtml(entry.detail || 'Verified adapter available through the Action Harness.') +
              '</small>' +
              '<div class="cockpit-command">' +
              escapeHtml(entry.previewCommand || 'zavorth actions preview <action-id>') +
              '</div>' +
              '</div>',
          )
          .join('')
      : '<div class="muted">No verified capability has been exposed yet.</div>';

    node.innerHTML =
      '<div class="cockpit-status">' +
      '<div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
      '<strong>Capability catalog</strong>' +
      '<span class="badge ' +
      (summary.plugin ? 'badge-info' : 'badge-allowed') +
      '">' +
      escapeHtml(String(summary.total || 0)) +
      ' loaded</span>' +
      '</div>' +
      '<div class="cockpit-headline">' +
      escapeHtml(
        snapshot.narrative?.operatorSummary || 'Commands, automatic routes, platforms, and integrations in one view.',
      ) +
      '</div>' +
      '</div>' +
      '<a class="sidecar-link" href="/api/operations/capabilities" target="_blank">/api/operations/capabilities</a>' +
      '</div>' +
      '<div class="cockpit-grid">' +
      '<div class="cockpit-stack">' +
      '<div class="cockpit-mini-grid">' +
      '<div class="cockpit-mini-card"><strong>Total</strong><div>' +
      escapeHtml(String(summary.total || 0)) +
      '</div><small>Known capabilities</small></div>' +
      '<div class="cockpit-mini-card"><strong>Commands</strong><div>' +
      escapeHtml(String(summary.commands || 0)) +
      '</div><small>Direct shortcuts</small></div>' +
      '<div class="cockpit-mini-card"><strong>Routes</strong><div>' +
      escapeHtml(String(summary.implicitRoutes || 0)) +
      '</div><small>Automatic routing</small></div>' +
      '<div class="cockpit-mini-card"><strong>Plugins</strong><div>' +
      escapeHtml(String(summary.plugin || 0)) +
      '</div><small>External capabilities</small></div>' +
      '<div class="cockpit-mini-card"><strong>Platforms ready</strong><div>' +
      escapeHtml(String(platformSummary.ready || 0)) +
      '</div><small>Telegram, Discord, WhatsApp</small></div>' +
      '<div class="cockpit-mini-card"><strong>Integrations ready</strong><div>' +
      escapeHtml(String(integrationSummary.ready || 0)) +
      '</div><small>Bindings usable now</small></div>' +
      '<div class="cockpit-mini-card"><strong>New capabilities</strong><div>' +
      escapeHtml(String(capabilityActionSummary.exposed || 0)) +
      '</div><small>Verified and governed</small></div>' +
      '</div>' +
      '<div class="sidecar-card"><strong>Categories</strong><ul class="cockpit-list">' +
      categoryItems +
      '</ul></div>' +
      '</div>' +
      '<div class="cockpit-stack">' +
      '<div class="sidecar-card"><strong>Featured commands</strong><div class="cockpit-action-list">' +
      commandItems +
      '</div></div>' +
      '<div class="sidecar-card"><strong>Featured automatic routes</strong><div class="cockpit-action-list">' +
      routeItems +
      '</div></div>' +
      '<div class="sidecar-card"><strong>Capability actions</strong><small>Live activation still requires preview and approval.</small><div class="cockpit-action-list">' +
      governedCapabilityItems +
      '</div></div>' +
      '<div class="sidecar-card"><strong>Surface panorama</strong><small>Ready: ' +
      escapeHtml(String(platformSummary.ready || 0)) +
      ' | Partial: ' +
      escapeHtml(String(platformSummary.partial || 0)) +
      ' | Planned: ' +
      escapeHtml(String(platformSummary.planned || 0)) +
      ' | Disabled: ' +
      escapeHtml(String(platformSummary.disabled || 0)) +
      '</small><small>Integration Hub: ' +
      escapeHtml(String(integrationSummary.total || 0)) +
      ' catalogadas | ' +
      escapeHtml(String(integrationSummary.templates || 0)) +
      ' templates | ' +
      escapeHtml(String(integrationSummary.installed || 0)) +
      ' instaladas</small></div>' +
      '</div>' +
      '</div>';
  }
}

export function getZavorthControlClassicClientOverviewSummaryCapabilitiesScript(): string {
  return extractFunctionBody(zavorthControlClassicClientOverviewSummaryCapabilities);
}
