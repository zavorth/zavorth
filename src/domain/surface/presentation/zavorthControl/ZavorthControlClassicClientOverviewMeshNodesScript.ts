import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';
import type { NodeInvocationRecord, NodeMeshSnapshot } from '../../../../contracts/core/NodeMeshContract.js';

declare function escapeHtml(value: unknown): string;
declare function formatRelativeTime(value: unknown): string;

type NodeMeshErrorPayload = { error: unknown };

function zavorthControlClassicClientOverviewMeshNodes() {
    function renderOperationsNodes(nodeMesh: NodeMeshSnapshot | NodeMeshErrorPayload | null | undefined) {
      const node = document.getElementById('operations-nodes');
      if (!node) return;
      if (!nodeMesh || 'error' in (nodeMesh as NodeMeshErrorPayload)) {
        node.innerHTML = '<div class="muted">Could not carregar o Node Mesh.</div>';
        return;
      }

      const snapshot = nodeMesh as NodeMeshSnapshot;
      const summary = snapshot.summary || ({} as NodeMeshSnapshot['summary']);
      const entries = Array.isArray(snapshot.entries) ? snapshot.entries : [];
      const selected = snapshot.selected || entries[0] || null;
      const selectedActivity = snapshot.selectedActivity || null;
      const selectedMaintenance = (selected && selected.maintenance) || (selectedActivity && selectedActivity.maintenance) || null;
      const approvedCapabilityIds = Array.isArray(selected?.approvedCapabilityIds) ? selected.approvedCapabilityIds : [];
      const declaredCapabilityIds = Array.isArray(selected?.capabilityIds) ? selected.capabilityIds : [];
      const deviceProfiles = Array.isArray(snapshot.deviceProfiles) ? snapshot.deviceProfiles : [];
      const recommendedProfiles = Array.isArray(snapshot.recommendedProfiles) ? snapshot.recommendedProfiles : [];
      const resolveProfile = (profileId: string | null | undefined) => {
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
            + ' · Capabilities: ' + escapeHtml(String((entry.capabilities || []).length || 0)) + '</small>'
            + '<ul class="cockpit-list">' + ((entry.capabilities || []).length
              ? entry.capabilities.slice(0, 3).map((capability) => '<li>' + escapeHtml(capability.label || capability.id) + '</li>').join('')
              : '<li>Sem capabilities declaradas.</li>') + '</ul>'
            + '</div>';
          }).join('')
        : '<div class="muted">No node registered yet.</div>';
      const recommendedProfileItems = recommendedProfiles.length
        ? recommendedProfiles.map((profile) => '<li>' + escapeHtml(profile.label + ': ' + (profile.operatorSummary || profile.summary || 'Sem resumo adicional.')) + '</li>').join('')
        : '<li>Sem perfis sugeridos carregados.</li>';
      const activityInvocations: NodeInvocationRecord[] = selectedActivity
        ? [
          ...(Array.isArray(selectedActivity.activeInvocations) ? selectedActivity.activeInvocations : []),
          ...(Array.isArray(selectedActivity.recentInvocations) ? selectedActivity.recentInvocations : []),
        ]
        : [];
      const activityItems = activityInvocations.length
        ? activityInvocations
          .slice(0, 6)
          .map((entry) => '<li>' + escapeHtml((entry.capabilityId || 'capability') + ' (' + (entry.status || 'n/d') + ')')
            + (entry.resultSummary ? ' - ' + escapeHtml(entry.resultSummary) : '')
            + '</li>').join('')
        : '';

      node.innerHTML = ''
        + '<h3 style="margin-top:0;">Node Mesh</h3>'
        + '<p class="muted">' + escapeHtml((snapshot.narrative && snapshot.narrative.operatorSummary) || 'Registry e pairing de nodes headless, desktop e bridges remotos.') + '</p>'
        + '<div class="metrics-grid">'
        + '<div class="metric-card"><strong>Nodes</strong><div>' + escapeHtml(String(summary.total || 0)) + '</div><small>Total visible</small></div>'
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
                + (selectedMaintenance.recoverKind ? ' - recover ready' : '')
                + '</small>'
              : '')
            + '<small>Host: ' + escapeHtml(selected.hostHints?.hostname || selected.hostHints?.platform || 'n/d')
            + ' · Last heartbeat: ' + escapeHtml(selected.lastSeenAt || 'not published yet') + '</small></div>'
          : '')
        + (selectedActivity
          ? '<div class="sidecar-card" style="margin-bottom:16px;"><strong>Fila e historico</strong>'
            + '<small>' + escapeHtml(selectedActivity.narrative?.headline || 'Sem activity recente.') + '</small>'
            + '<small>' + escapeHtml(selectedActivity.narrative?.operatorSummary || 'Sem resumo adicional.') + '</small>'
            + (selectedMaintenance?.supported
              ? '<small>Maintenance recente: '
                + escapeHtml(selectedMaintenance.latestResultSummary || (selectedMaintenance.recoverKind ? 'recover operacional available' : 'sem resumo adicional'))
                + '</small>'
              : '')
            + '<small>Pendentes: ' + escapeHtml(String(selectedActivity.summary?.pending || 0))
            + ' · Claimed: ' + escapeHtml(String(selectedActivity.summary?.claimed || 0))
            + ' · Recent: ' + escapeHtml(String(selectedActivity.summary?.recent || 0)) + '</small>'
            + '<ul class="cockpit-list">' + (activityItems || '<li>No activity recente para este node.</li>') + '</ul></div>'
          : '')
        + '<div class="sidecar-card" style="margin-bottom:16px;"><strong>Perfis recomendados</strong><ul class="cockpit-list">' + recommendedProfileItems + '</ul></div>'
        + '<div class="sidecar-card"><strong>Panorama operacional</strong><div class="cockpit-action-list">' + entryItems + '</div></div>';
    }

}

export function getZavorthControlClassicClientOverviewMeshNodesScript(): string {
  return extractFunctionBody(zavorthControlClassicClientOverviewMeshNodes);
}
