import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';
import type {
  IntegrationCatalogSnapshot,
  IntegrationDetailSnapshot,
  IntegrationDoctorSnapshot,
} from '../../../../contracts/core/IntegrationHubContract.js';

declare function escapeHtml(value: unknown): string;
declare function formatRelativeTime(value: unknown): string;

type IntegrationHubErrorPayload = { error: unknown };

function zavorthControlClassicClientOverviewMeshIntegrations() {
  function renderOperationsIntegrations(
    hub: IntegrationCatalogSnapshot | IntegrationHubErrorPayload | null | undefined,
  ) {
    const node = document.getElementById('operations-integrations');
    if (!node) return;
    if (!hub || 'error' in (hub as IntegrationHubErrorPayload)) {
      node.innerHTML = '<div class="muted">Could not load Integration Hub.</div>';
      return;
    }

    const snapshot = hub as IntegrationCatalogSnapshot;
    const entries = Array.isArray(snapshot.entries) ? snapshot.entries : [];
    const readyEntries = entries.filter((entry) => entry.readiness === 'ready');
    const templateEntries = entries.filter((entry) => entry.manifest?.category === 'template');
    const selected = snapshot.selected || readyEntries[0] || entries[0] || null;
    const selectedDetail = snapshot.selected || null;
    const selectedDoctor = selectedDetail?.doctor || ({} as IntegrationDetailSnapshot['doctor']);
    const selectedManifest =
      selectedDetail?.manifest || selected?.manifest || ({} as IntegrationDetailSnapshot['manifest']);
    const selectedInstalled = selectedDetail?.installed || selected?.installed || null;
    const selectedSecrets = Array.isArray(selectedDetail?.storedSecretKeys) ? selectedDetail.storedSecretKeys : [];
    const selectedActionPlan =
      selectedDetail?.actionPlan || ({ actions: [] } as unknown as IntegrationDetailSnapshot['actionPlan']);
    const selectedActionMonitor =
      selectedDetail?.actionMonitor ||
      ({
        latestAction: null,
        recentActions: [],
        logExcerpt: { lines: [] },
      } as unknown as IntegrationDetailSnapshot['actionMonitor']);
    const selectedProbe = selectedDoctor.probe || null;
    const selectedPlaybook = selectedDoctor.playbook || { headline: '', summary: '', steps: [] };
    const nextAction = selectedDoctor.nextAction || ({} as IntegrationDoctorSnapshot['nextAction']);
    const featuredItems = entries
      .slice(0, 6)
      .map(
        (entry) =>
          '<div class="cockpit-action-card">' +
          '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">' +
          '<strong>' +
          escapeHtml(entry.manifest?.label || 'Integration') +
          '</strong>' +
          '<span class="badge ' +
          (entry.readiness === 'ready'
            ? 'badge-allowed'
            : entry.manifest?.category === 'template'
              ? 'badge-warning'
              : 'badge-blocked') +
          '">' +
          escapeHtml(
            entry.readiness === 'ready' ? 'ready' : entry.manifest?.category === 'template' ? 'template' : 'configure',
          ) +
          '</span>' +
          '</div>' +
          '<small>' +
          escapeHtml(entry.manifest?.summary || 'No summary.') +
          '</small>' +
          '<small>' +
          escapeHtml(entry.doctor?.nextAction?.reason || 'No suggested next step.') +
          '</small>' +
          '</div>',
      )
      .join('');
    const selectedChecklist = [
      'Binding: ' + escapeHtml(selectedManifest.binding?.summary || 'No binding selected.'),
      'Mode: ' +
        escapeHtml(
          selectedInstalled?.selectedMode || selectedDoctor.selectedMode || selectedManifest.defaultMode || 'n/a',
        ),
      'Capabilities: ' +
        escapeHtml((selectedDoctor.enabledCapabilities || selectedManifest.capabilities || []).join(', ') || 'n/a'),
      'secrets guardados: ' + escapeHtml(selectedSecrets.length ? selectedSecrets.join(', ') : 'no ainda'),
      'Latest health check: ' + escapeHtml(formatRelativeTime(selectedInstalled?.lastHealthCheckAt) || 'without registro'),
      'Latest health status: ' + escapeHtml(selectedInstalled?.lastHealthStatus || 'unknown'),
      'Last real probe: ' +
        escapeHtml(selectedProbe ? selectedProbe.status + ' · ' + selectedProbe.summary : 'not run yet'),
    ]
      .map((item) => '<li>' + item + '</li>')
      .join('');
    const guidedItems =
      Array.isArray(selectedActionPlan.actions) && selectedActionPlan.actions.length
        ? selectedActionPlan.actions
            .slice(0, 4)
            .map(
              (action) =>
                '<div class="cockpit-action-card">' +
                '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">' +
                '<strong>' +
                escapeHtml(action.label || 'Guided action') +
                '</strong>' +
                '<span class="badge ' +
                (action.executable ? 'badge-allowed' : 'badge-warning') +
                '">' +
                escapeHtml(action.executable ? 'executable' : 'manual') +
                '</span>' +
                '</div>' +
                '<small>' +
                escapeHtml(action.description || 'No additional description.') +
                '</small>' +
                (action.impact ? '<div class="cockpit-command"><strong>Impacto:</strong> ' +
                    escapeHtml(action.impact.summary || '') +
                    (Array.isArray(action.impact.details) && action.impact.details.length ? '\n' + escapeHtml(action.impact.details.join(' | '))
                      : '') +
                    '</div>'
                  : '') +
                '<div class="cockpit-command">' +
                escapeHtml(action.command || '') +
                '</div>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
                (action.executable ? '<button class="btn btn-ghost" onclick="runIntegrationHubAction(' +
                    "'" +
                    escapeHtml(selectedManifest.id || '') +
                    "','" +
                    escapeHtml(action.id || '') +
                    "'" +
                    ')">run agora</button>'
                  : '') +
                (action.command ? '<button class="btn btn-ghost" onclick="copyTextToClipboard(' +
                    "'" +
                    escapeHtml(action.command || '') +
                    "','" +
                    'Integration Hub command copied.' +
                    "'" +
                    ')">Copy command</button>'
                  : '') +
                '</div>' +
                '</div>',
            )
            .join('')
        : '<div class="muted">No guided step available.</div>';
    const recentActionItems =
      Array.isArray(selectedActionMonitor.recentActions) && selectedActionMonitor.recentActions.length
        ? selectedActionMonitor.recentActions
            .slice(0, 4)
            .map(
              (entry) =>
                '<div class="cockpit-action-card">' +
                '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">' +
                '<strong>' +
                escapeHtml(entry.label || 'Recent action') +
                '</strong>' +
                '<span class="badge ' +
                (entry.status === 'completed'
                  ? 'badge-allowed'
                  : entry.status === 'started'
                    ? 'badge-info'
                    : entry.status === 'partial' || entry.status === 'manual_only'
                      ? 'badge-warning'
                      : 'badge-blocked') +
                '">' +
                escapeHtml(entry.status || 'n/a') +
                '</span>' +
                '</div>' +
                '<small>' +
                escapeHtml(entry.note || entry.command || 'No additional detail.') +
                '</small>' +
                '<small>' +
                escapeHtml(formatRelativeTime(entry.finishedAt || entry.startedAt)) +
                '</small>' +
                '</div>',
            )
            .join('')
        : '<div class="muted">No action guiada executada ainda.</div>';
    const logPreview =
      Array.isArray(selectedActionMonitor.logExcerpt?.lines) && selectedActionMonitor.logExcerpt.lines.length ? '<div class="cockpit-command">' + escapeHtml(selectedActionMonitor.logExcerpt.lines.join('\n')) + '</div>'
        : '<div class="muted">No short log available.</div>';
    const playbookItems =
      Array.isArray(selectedPlaybook.steps) && selectedPlaybook.steps.length
        ? selectedPlaybook.steps
            .map((step) => {
              const linkedAction = Array.isArray(selectedActionPlan.actions)
                ? selectedActionPlan.actions.find((entry) => entry.id === step.actionId)
                : null;
              return (
                '<div class="cockpit-action-card">' +
                '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">' +
                '<strong>' +
                escapeHtml(step.label || 'Passo') +
                '</strong>' +
                '<span class="badge ' +
                (step.status === 'done' ? 'badge-allowed' : step.status === 'next' ? 'badge-warning' : 'badge-info') +
                '">' +
                escapeHtml(step.status || 'n/a') +
                '</span>' +
                '</div>' +
                '<small>' +
                escapeHtml(step.detail || 'No additional detail.') +
                '</small>' +
                (linkedAction ? '<small>shortcut assistido: ' +
                    escapeHtml(linkedAction.label || linkedAction.id || 'action guiada') +
                    '</small>'
                  : '') +
                (!linkedAction && step.command ? '<small>' + escapeHtml(step.command) + '</small>' : '') +
                '</div>'
              );
            })
            .join('')
        : '<div class="muted">No structured playbook for this integration.</div>';

    node.innerHTML =
      '<div class="cockpit-status">' +
      '<div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
      '<strong>Integration Hub</strong>' +
      '<span class="badge ' +
      (readyEntries.length ? 'badge-allowed' : 'badge-warning') +
      '">' +
      escapeHtml(readyEntries.length ? String(readyEntries.length) + ' ready(s)' : 'configuring') +
      '</span>' +
      '</div>' +
      '<div class="cockpit-headline">' +
      escapeHtml(
        selectedManifest.label
          ? selectedManifest.label + ': ' + (selectedDoctor.nextAction?.reason || selectedManifest.summary || '')
          : 'Catalog of Zavorth connectors and guided templates.',
      ) +
      '</div>' +
      '</div>' +
      '<a class="sidecar-link" href="/api/operations/integrations" target="_blank">/api/operations/integrations</a>' +
      '</div>' +
      '<div class="cockpit-grid">' +
      '<div class="cockpit-stack">' +
      '<div class="cockpit-mini-grid">' +
      '<div class="cockpit-mini-card"><strong>Catalog</strong><div>' +
      escapeHtml(String(entries.length)) +
      '</div><small>Total de integrations conhecidas</small></div>' +
      '<div class="cockpit-mini-card"><strong>Readys</strong><div>' +
      escapeHtml(String(readyEntries.length)) +
      '</div><small>Bindings ready for use</small></div>' +
      '<div class="cockpit-mini-card"><strong>Templates</strong><div>' +
      escapeHtml(String(templateEntries.length)) +
      '</div><small>Receitas para novos conectores</small></div>' +
      '<div class="cockpit-mini-card"><strong>Status</strong><div>' +
      escapeHtml(selectedDoctor.status || 'n/a') +
      '</div><small>Focused integration doctor</small></div>' +
      '<div class="cockpit-mini-card"><strong>Probe real</strong><div>' +
      escapeHtml(selectedProbe?.status || 'pending') +
      '</div><small>' +
      escapeHtml(selectedProbe?.summary || 'Not run yet') +
      '</small></div>' +
      '</div>' +
      '<div class="sidecar-card"><strong>Catalog highlights</strong><div class="cockpit-action-list">' +
      (featuredItems || '<div class="muted">No connector cataloged.</div>') +
      '</div></div>' +
      '</div>' +
      '<div class="cockpit-stack">' +
      '<div class="sidecar-card"><strong>Integration em foco</strong><ul class="cockpit-list">' +
      selectedChecklist +
      '</ul></div>' +
      '<div class="sidecar-card"><strong>Next step</strong><div class="cockpit-action-card"><strong>' +
      escapeHtml(nextAction.label || 'Open onboarding') +
      '</strong><small>' +
      escapeHtml(nextAction.reason || 'No additional recommendation.') +
      '</small><div class="cockpit-command">' +
      escapeHtml(nextAction.command || '') +
      '</div></div></div>' +
      '<div class="sidecar-card"><strong>Safe playbook</strong><small>' +
      escapeHtml(selectedPlaybook.headline || 'No structured playbook.') +
      '</small><small>' +
      escapeHtml(selectedPlaybook.summary || 'Use the doctor and assisted flow to proceed.') +
      '</small><div class="cockpit-action-list">' +
      playbookItems +
      '</div></div>' +
      '<div class="sidecar-card"><strong>Assisted flow</strong><div class="cockpit-action-list">' +
      guidedItems +
      '</div></div>' +
      '<div class="sidecar-card"><strong>Monitor de actions</strong><div class="cockpit-action-list">' +
      recentActionItems +
      '</div>' +
      logPreview +
      '</div>' +
      '</div>' +
      '</div>';
  }
}

export function getZavorthControlClassicClientOverviewMeshIntegrationsScript(): string {
  return extractFunctionBody(zavorthControlClassicClientOverviewMeshIntegrations);
}
