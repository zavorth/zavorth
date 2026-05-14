// @ts-nocheck
import { extractFunctionBody } from './DashboardClassicScriptUtils.js';

function dashboardClassicClientOverviewMeshNodes() {
    function renderOperationsNodes(nodeMesh) {
      const node = document.getElementById('operations-nodes');
      if (!node) return;
      if (!nodeMesh || nodeMesh.error) {
        node.innerHTML = '<div class="muted">Nao foi possivel carregar o Node Mesh.</div>';
        return;
      }

      const summary = nodeMesh.summary || {};
      const entries = Array.isArray(nodeMesh.entries) ? nodeMesh.entries : [];
      const selected = nodeMesh.selected || entries[0] || null;
      const selectedActivity = nodeMesh.selectedActivity || null;
      const selectedMaintenance = (selected && selected.maintenance) || (selectedActivity && selectedActivity.maintenance) || null;
      const approvedCapabilityIds = Array.isArray(selected?.approvedCapabilityIds) ? selected.approvedCapabilityIds : [];
      const declaredCapabilityIds = Array.isArray(selected?.capabilityIds) ? selected.capabilityIds : [];
      const deviceProfiles = Array.isArray(nodeMesh.deviceProfiles) ? nodeMesh.deviceProfiles : [];
      const recommendedProfiles = Array.isArray(nodeMesh.recommendedProfiles) ? nodeMesh.recommendedProfiles : [];
      const resolveProfile = (profileId) => {
        const normalized = String(profileId || '').trim().toLowerCase();
        if (!normalized) {
          return null;
        }
        return deviceProfiles.find((entry) => String(entry?.id || '').trim().toLowerCase() === normalized) || null;
      };
      const selectedProfile = resolveProfile(selected?.profileId);
      const entryItems = entries.length
        ? entries.slice(0, 6).map((entry) => {
            const profile = resolveProfile(entry.profileId);
            return '<div class="cockpit-action-card">'
            + '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">'
            + '<strong>' + escapeHtml(entry.label || entry.id || 'Node') + '</strong>'
            + '<span class="badge ' + (entry.pairingStatus === 'paired'
              ? (entry.status === 'online' ? 'badge-allowed' : 'badge-warning')
              : (entry.pairingStatus === 'pending' ? 'badge-info' : 'badge-blocked')) + '">'
            + escapeHtml(entry.trustLabel || entry.pairingStatus || 'n/d')
            + '</span>'
            + '</div>'
            + '<small>' + escapeHtml(entry.operatorSummary || entry.nextAction || 'Sem resumo adicional.') + '</small>'
            + '<small>Perfil: ' + escapeHtml(profile?.label || entry.kind || 'n/d') + '</small>'
            + '<small>Transport: ' + escapeHtml(entry.transport || 'n/d')
            + ' Ã‚Â· Capabilities: ' + escapeHtml(String((entry.capabilities || []).length || 0)) + '</small>'
            + '<ul class="cockpit-list">' + ((entry.capabilities || []).length
              ? entry.capabilities.slice(0, 3).map((capability) => '<li>' + escapeHtml(capability.label || capability.id) + '</li>').join('')
              : '<li>Sem capabilities declaradas.</li>') + '</ul>'
            + '</div>';
          }).join('')
        : '<div class="muted">Nenhum node registrado ainda.</div>';
      const recommendedProfileItems = recommendedProfiles.length
        ? recommendedProfiles.map((profile) => '<li>' + escapeHtml(profile.label + ': ' + (profile.operatorSummary || profile.summary || 'Sem resumo adicional.')) + '</li>').join('')
        : '<li>Sem perfis sugeridos carregados.</li>';
      const activityItems = selectedActivity
        ? []
          .concat(Array.isArray(selectedActivity.activeInvocations) ? selectedActivity.activeInvocations : [])
          .concat(Array.isArray(selectedActivity.recentInvocations) ? selectedActivity.recentInvocations : [])
          .slice(0, 6)
          .map((entry) => '<li>' + escapeHtml((entry.capabilityId || 'capability') + ' (' + (entry.status || 'n/d') + ')')
            + (entry.resultSummary ? ' - ' + escapeHtml(entry.resultSummary) : '')
            + '</li>').join('')
        : '';

      node.innerHTML = ''
        + '<h3 style="margin-top:0;">Node Mesh</h3>'
        + '<p class="muted">' + escapeHtml((nodeMesh.narrative && nodeMesh.narrative.operatorSummary) || 'Registry e pairing de nodes headless, desktop e bridges remotos.') + '</p>'
        + '<div class="metrics-grid">'
        + '<div class="metric-card"><strong>Nodes</strong><div>' + escapeHtml(String(summary.total || 0)) + '</div><small>Total visivel</small></div>'
        + '<div class="metric-card"><strong>Pareados</strong><div>' + escapeHtml(String(summary.paired || 0)) + '</div><small>Confianca pronta</small></div>'
        + '<div class="metric-card"><strong>Pendentes</strong><div>' + escapeHtml(String(summary.pending || 0)) + '</div><small>Pairing em aberto</small></div>'
        + '<div class="metric-card"><strong>Online</strong><div>' + escapeHtml(String(summary.online || 0)) + '</div><small>Heartbeat recente</small></div>'
        + '<div class="metric-card"><strong>Perfis</strong><div>' + escapeHtml(String(recommendedProfiles.length || 0)) + '</div><small>Sugestoes ativas</small></div>'
        + '</div>'
        + (selected
          ? '<div class="sidecar-card" style="margin-bottom:16px;"><strong>Node em foco: ' + escapeHtml(selected.label || selected.id) + '</strong>'
            + '<small>' + escapeHtml(selected.nextAction || 'Sem proximo passo adicional.') + '</small>'
            + '<small>Perfil: ' + escapeHtml(selectedProfile?.label || selected.kind || 'n/d') + '</small>'
            + '<small>Allowlist: ' + escapeHtml(approvedCapabilityIds.length > 0
              ? (String(approvedCapabilityIds.length) + '/' + String(declaredCapabilityIds.length || 0))
              : 'sem restricao explicita')
            + ' - <a href="/app" target="_blank" rel="noreferrer">Abrir no /app</a></small>'
            + (selectedMaintenance?.supported
              ? '<small>Maintenance: '
                + escapeHtml((selectedMaintenance.latestAction || 'doctor') + ' / ' + (selectedMaintenance.latestStatus || 'n/d'))
                + (selectedMaintenance.recoverKind ? ' - recover pronto' : '')
                + '</small>'
              : '')
            + '<small>Host: ' + escapeHtml(selected.hostHints?.hostname || selected.hostHints?.platform || 'n/d')
            + ' Ã‚Â· Ultimo heartbeat: ' + escapeHtml(selected.lastSeenAt || 'ainda nao publicado') + '</small></div>'
          : '')
        + (selectedActivity
          ? '<div class="sidecar-card" style="margin-bottom:16px;"><strong>Fila e historico</strong>'
            + '<small>' + escapeHtml(selectedActivity.narrative?.headline || 'Sem activity recente.') + '</small>'
            + '<small>' + escapeHtml(selectedActivity.narrative?.operatorSummary || 'Sem resumo adicional.') + '</small>'
            + (selectedMaintenance?.supported
              ? '<small>Maintenance recente: '
                + escapeHtml(selectedMaintenance.latestResultSummary || (selectedMaintenance.recoverKind ? 'recover operacional disponivel' : 'sem resumo adicional'))
                + '</small>'
              : '')
            + '<small>Pendentes: ' + escapeHtml(String(selectedActivity.summary?.pending || 0))
            + ' Ãƒâ€šÃ‚Â· Claimed: ' + escapeHtml(String(selectedActivity.summary?.claimed || 0))
            + ' Ãƒâ€šÃ‚Â· Recentes: ' + escapeHtml(String(selectedActivity.summary?.recent || 0)) + '</small>'
            + '<ul class="cockpit-list">' + (activityItems || '<li>Nenhuma activity recente para este node.</li>') + '</ul></div>'
          : '')
        + '<div class="sidecar-card" style="margin-bottom:16px;"><strong>Perfis recomendados</strong><ul class="cockpit-list">' + recommendedProfileItems + '</ul></div>'
        + '<div class="sidecar-card"><strong>Panorama operacional</strong><div class="cockpit-action-list">' + entryItems + '</div></div>';
    }

}

export function getDashboardClassicClientOverviewMeshNodesScript(): string {
  return extractFunctionBody(dashboardClassicClientOverviewMeshNodes);
}

