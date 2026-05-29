// @ts-nocheck
import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';

function zavorthControlClassicClientOverviewMeshIntegrations() {
    function renderOperationsIntegrations(hub) {
      const node = document.getElementById('operations-integrations');
      if (!node) return;
      if (!hub || hub.error) {
        node.innerHTML = '<div class="muted">Nao foi possivel carregar o Integration Hub.</div>';
        return;
      }

      const entries = Array.isArray(hub.entries) ? hub.entries : [];
      const readyEntries = entries.filter((entry) => entry.readiness === 'ready');
      const templateEntries = entries.filter((entry) => entry.manifest?.category === 'template');
      const selected = hub.selected || readyEntries[0] || entries[0] || null;
      const selectedDoctor = selected?.doctor || {};
      const selectedManifest = selected?.manifest || {};
      const selectedInstalled = selected?.installed || null;
      const selectedSecrets = Array.isArray(selected?.storedSecretKeys) ? selected.storedSecretKeys : [];
      const selectedActionPlan = selected?.actionPlan || { actions: [] };
      const selectedActionMonitor = selected?.actionMonitor || { latestAction: null, recentActions: [], logExcerpt: { lines: [] } };
      const selectedProbe = selectedDoctor.probe || null;
      const selectedPlaybook = selectedDoctor.playbook || { headline: '', summary: '', steps: [] };
      const nextAction = selectedDoctor.nextAction || {};
      const featuredItems = entries.slice(0, 6).map((entry) =>
        '<div class="cockpit-action-card">'
        + '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">'
        + '<strong>' + escapeHtml(entry.manifest?.label || 'Integracao') + '</strong>'
        + '<span class="badge ' + (entry.readiness === 'ready' ? 'badge-allowed' : (entry.manifest?.category === 'template' ? 'badge-warning' : 'badge-blocked')) + '">'
        + escapeHtml(entry.readiness === 'ready' ? 'pronto' : (entry.manifest?.category === 'template' ? 'template' : 'configurar'))
        + '</span>'
        + '</div>'
        + '<small>' + escapeHtml(entry.manifest?.summary || 'Sem resumo.') + '</small>'
        + '<small>' + escapeHtml(entry.doctor?.nextAction?.reason || 'Sem proximo passo sugerido.') + '</small>'
        + '</div>'
      ).join('');
      const selectedChecklist = [
        'Binding: ' + escapeHtml(selectedManifest.binding?.summary || 'Sem binding selecionado.'),
        'Modo: ' + escapeHtml(selectedInstalled?.selectedMode || selectedDoctor.selectedMode || selectedManifest.defaultMode || 'n/d'),
        'Capacidades: ' + escapeHtml((selectedDoctor.enabledCapabilities || selectedManifest.capabilities || []).join(', ') || 'n/d'),
        'Segredos guardados: ' + escapeHtml(selectedSecrets.length ? selectedSecrets.join(', ') : 'nenhum ainda'),
        'Ultimo health check: ' + escapeHtml(formatRelativeTime(selectedInstalled?.lastHealthCheckAt) || 'sem registro'),
        'Ultimo health status: ' + escapeHtml(selectedInstalled?.lastHealthStatus || 'unknown'),
        'Ultimo probe real: ' + escapeHtml(selectedProbe ? (selectedProbe.status + ' Â· ' + selectedProbe.summary) : 'ainda nao executado'),
      ].map((item) => '<li>' + item + '</li>').join('');
      const guidedItems = Array.isArray(selectedActionPlan.actions) && selectedActionPlan.actions.length
        ? selectedActionPlan.actions.slice(0, 4).map((action) =>
            '<div class="cockpit-action-card">'
            + '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">'
            + '<strong>' + escapeHtml(action.label || 'Acao guiada') + '</strong>'
            + '<span class="badge ' + (action.executable ? 'badge-allowed' : 'badge-warning') + '">'
            + escapeHtml(action.executable ? 'executavel' : 'manual')
            + '</span>'
            + '</div>'
            + '<small>' + escapeHtml(action.description || 'Sem descricao adicional.') + '</small>'
            + (action.impact
              ? '<div class="cockpit-command"><strong>Impacto:</strong> ' + escapeHtml(action.impact.summary || '') + (Array.isArray(action.impact.details) && action.impact.details.length ? '\n' + escapeHtml(action.impact.details.join(' | ')) : '') + '</div>'
              : '')
            + '<div class="cockpit-command">' + escapeHtml(action.command || '') + '</div>'
            + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
            + (action.executable
              ? '<button class="btn btn-ghost" onclick="runIntegrationHubAction(' + "'" + escapeHtml(selectedManifest.id || '') + "','" + escapeHtml(action.id || '') + "'" + ')">Executar agora</button>'
              : '')
            + (action.command
              ? '<button class="btn btn-ghost" onclick="copyTextToClipboard(' + "'" + escapeHtml(action.command || '') + "','" + 'Comando do Integration Hub copiado.' + "'" + ')">Copiar comando</button>'
              : '')
            + '</div>'
            + '</div>'
          ).join('')
        : '<div class="muted">Nenhum passo guiado disponivel.</div>';
      const recentActionItems = Array.isArray(selectedActionMonitor.recentActions) && selectedActionMonitor.recentActions.length
        ? selectedActionMonitor.recentActions.slice(0, 4).map((entry) =>
            '<div class="cockpit-action-card">'
            + '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">'
            + '<strong>' + escapeHtml(entry.label || 'Acao recente') + '</strong>'
            + '<span class="badge ' + (entry.status === 'completed' ? 'badge-allowed' : (entry.status === 'started' ? 'badge-info' : (entry.status === 'partial' || entry.status === 'manual_only' ? 'badge-warning' : 'badge-blocked'))) + '">'
            + escapeHtml(entry.status || 'n/d')
            + '</span>'
            + '</div>'
            + '<small>' + escapeHtml(entry.note || entry.command || 'Sem detalhe adicional.') + '</small>'
            + '<small>' + escapeHtml(formatRelativeTime(entry.finishedAt || entry.startedAt)) + '</small>'
            + '</div>'
          ).join('')
        : '<div class="muted">Nenhuma acao guiada executada ainda.</div>';
      const logPreview = Array.isArray(selectedActionMonitor.logExcerpt?.lines) && selectedActionMonitor.logExcerpt.lines.length
        ? '<div class="cockpit-command">' + escapeHtml(selectedActionMonitor.logExcerpt.lines.join('\n')) + '</div>'
        : '<div class="muted">Nenhum log curto disponivel.</div>';
      const playbookItems = Array.isArray(selectedPlaybook.steps) && selectedPlaybook.steps.length
        ? selectedPlaybook.steps.map((step) => {
            const linkedAction = Array.isArray(selectedActionPlan.actions)
              ? selectedActionPlan.actions.find((entry) => entry.id === step.actionId)
              : null;
            return '<div class="cockpit-action-card">'
              + '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">'
              + '<strong>' + escapeHtml(step.label || 'Passo') + '</strong>'
              + '<span class="badge ' + (step.status === 'done' ? 'badge-allowed' : (step.status === 'next' ? 'badge-warning' : 'badge-info')) + '">'
              + escapeHtml(step.status || 'n/d')
              + '</span>'
              + '</div>'
              + '<small>' + escapeHtml(step.detail || 'Sem detalhe adicional.') + '</small>'
              + (linkedAction ? '<small>Atalho assistido: ' + escapeHtml(linkedAction.label || linkedAction.id || 'acao guiada') + '</small>' : '')
              + (!linkedAction && step.command ? '<small>' + escapeHtml(step.command) + '</small>' : '')
              + '</div>';
          }).join('')
        : '<div class="muted">Sem roteiro estruturado para esta integracao.</div>';

      node.innerHTML =
        '<div class="cockpit-status">'
        + '<div>'
        + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
        + '<strong>Integration Hub</strong>'
        + '<span class="badge ' + (readyEntries.length ? 'badge-allowed' : 'badge-warning') + '">'
        + escapeHtml(readyEntries.length ? (String(readyEntries.length) + ' pronto(s)') : 'em configuracao')
        + '</span>'
        + '</div>'
        + '<div class="cockpit-headline">' + escapeHtml(selectedManifest.label ? (selectedManifest.label + ': ' + (selectedDoctor.nextAction?.reason || selectedManifest.summary || '')) : 'Catalogo de conectores e templates guiados do Zavorth.') + '</div>'
        + '</div>'
        + '<a class="sidecar-link" href="/api/operations/integrations" target="_blank">/api/operations/integrations</a>'
        + '</div>'
        + '<div class="cockpit-grid">'
        + '<div class="cockpit-stack">'
        + '<div class="cockpit-mini-grid">'
        + '<div class="cockpit-mini-card"><strong>Catalogo</strong><div>' + escapeHtml(String(entries.length)) + '</div><small>Total de integracoes conhecidas</small></div>'
        + '<div class="cockpit-mini-card"><strong>Prontas</strong><div>' + escapeHtml(String(readyEntries.length)) + '</div><small>Bindings prontos para uso</small></div>'
        + '<div class="cockpit-mini-card"><strong>Templates</strong><div>' + escapeHtml(String(templateEntries.length)) + '</div><small>Receitas para novos conectores</small></div>'
        + '<div class="cockpit-mini-card"><strong>Status</strong><div>' + escapeHtml(selectedDoctor.status || 'n/d') + '</div><small>Doctor da integracao em foco</small></div>'
        + '<div class="cockpit-mini-card"><strong>Probe real</strong><div>' + escapeHtml(selectedProbe?.status || 'pendente') + '</div><small>' + escapeHtml(selectedProbe?.summary || 'Ainda nao executado') + '</small></div>'
        + '</div>'
        + '<div class="sidecar-card"><strong>Destaques do catalogo</strong><div class="cockpit-action-list">' + (featuredItems || '<div class="muted">Nenhum conector catalogado.</div>') + '</div></div>'
        + '</div>'
        + '<div class="cockpit-stack">'
        + '<div class="sidecar-card"><strong>Integracao em foco</strong><ul class="cockpit-list">' + selectedChecklist + '</ul></div>'
        + '<div class="sidecar-card"><strong>Proximo passo</strong><div class="cockpit-action-card"><strong>' + escapeHtml(nextAction.label || 'Abrir onboarding') + '</strong><small>' + escapeHtml(nextAction.reason || 'Sem recomendacao adicional.') + '</small><div class="cockpit-command">' + escapeHtml(nextAction.command || '') + '</div></div></div>'
        + '<div class="sidecar-card"><strong>Roteiro seguro</strong><small>' + escapeHtml(selectedPlaybook.headline || 'Sem roteiro estruturado.') + '</small><small>' + escapeHtml(selectedPlaybook.summary || 'Use o doctor e o fluxo assistido para avancar.') + '</small><div class="cockpit-action-list">' + playbookItems + '</div></div>'
        + '<div class="sidecar-card"><strong>Fluxo assistido</strong><div class="cockpit-action-list">' + guidedItems + '</div></div>'
        + '<div class="sidecar-card"><strong>Monitor de acoes</strong><div class="cockpit-action-list">' + recentActionItems + '</div>' + logPreview + '</div>'
        + '</div>'
        + '</div>';
    }
}

export function getZavorthControlClassicClientOverviewMeshIntegrationsScript(): string {
  return extractFunctionBody(zavorthControlClassicClientOverviewMeshIntegrations);
}

