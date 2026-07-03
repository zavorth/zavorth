import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';
import type { ZavorthTeamCatalogSnapshot } from '../../../../services/ZavorthTeamCatalogService.js';

declare function escapeHtml(value: unknown): string;

type TeamCatalogErrorPayload = { error: unknown };

function zavorthControlClassicClientOverviewMeshTeams() {
    function renderOperationsTeams(teamCatalog: ZavorthTeamCatalogSnapshot | TeamCatalogErrorPayload | null | undefined) {
      const node = document.getElementById('operations-teams');
      if (!node) return;
      if (!teamCatalog || 'error' in teamCatalog) {
        node.innerHTML = '<div class="muted">Nao foi possivel carregar o catalogo de teams.</div>';
        return;
      }

      const summary: ZavorthTeamCatalogSnapshot['summary'] = teamCatalog.summary || {} as ZavorthTeamCatalogSnapshot['summary'];
      const teams = Array.isArray(teamCatalog.teams) ? teamCatalog.teams : [];
      const teamItems = teams.length
        ? teams.map((team) => {
            const latestRun = team.latestRun || null;
            const memberList = Array.isArray(team.members) && team.members.length
              ? team.members.map((member) =>
                  '<li><strong>' + escapeHtml(member.label || member.role || 'Membro') + '</strong> Ã‚Â· '
                  + escapeHtml(member.responsibility || member.executor || 'Sem resumo adicional.')
                  + '</li>'
                ).join('')
              : '<li>Sem composicao registrada.</li>';
            const runSummary = latestRun
              ? 'Ultimo run: ' + escapeHtml(latestRun.workflowRunId || 'workflow')
                + ' Ã‚Â· ' + escapeHtml(latestRun.status || 'n/d')
                + (latestRun.resumeAvailable ? ' Ã‚Â· retomada pronta' : '')
              : 'Sem runs recentes.';
            return ''
              + '<div class="cockpit-action-card">'
              + '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">'
              + '<strong>' + escapeHtml(team.label || team.id || 'Team') + '</strong>'
              + '<span class="badge ' + (team.status === 'resumable' ? 'badge-warning' : (team.status === 'active' ? 'badge-info' : 'badge-allowed')) + '">'
              + escapeHtml(team.status || 'idle')
              + '</span>'
              + '</div>'
              + '<small>' + escapeHtml(team.summary || 'Sem resumo adicional.') + '</small>'
              + '<small>' + escapeHtml(team.operatorSummary || runSummary) + '</small>'
              + '<div class="cockpit-command">' + escapeHtml(team.entryCommand || '') + '</div>'
              + '<ul class="cockpit-list">' + memberList + '</ul>'
              + '<small>' + escapeHtml(runSummary) + '</small>'
              + '</div>';
          }).join('')
        : '<div class="muted">Nenhum team composto registrado.</div>';

      node.innerHTML =
        '<div class="cockpit-status">'
        + '<div>'
        + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
        + '<strong>Teams compostos</strong>'
        + '<span class="badge ' + (summary.resumable ? 'badge-warning' : 'badge-allowed') + '">' + escapeHtml(String(summary.total || 0)) + ' team(s)</span>'
        + '</div>'
        + '<div class="cockpit-headline">' + escapeHtml(teamCatalog.narrative?.operatorSummary || 'Teams compostos prontos para review, entrega e pesquisa.') + '</div>'
        + '</div>'
        + '<a class="sidecar-link" href="/api/operations/teams" target="_blank">/api/operations/teams</a>'
        + '</div>'
        + '<div class="cockpit-grid">'
        + '<div class="cockpit-stack">'
        + '<div class="cockpit-mini-grid">'
        + '<div class="cockpit-mini-card"><strong>Total</strong><div>' + escapeHtml(String(summary.total || 0)) + '</div><small>Times compostos disponiveis</small></div>'
        + '<div class="cockpit-mini-card"><strong>Retomadas</strong><div>' + escapeHtml(String(summary.resumable || 0)) + '</div><small>Runs com volta imediata</small></div>'
        + '<div class="cockpit-mini-card"><strong>Ativos</strong><div>' + escapeHtml(String(summary.active || 0)) + '</div><small>Fluxos em andamento</small></div>'
        + '<div class="cockpit-mini-card"><strong>Fechamentos</strong><div>' + escapeHtml(String(summary.completedRecently || 0)) + '</div><small>Runs concluindo recentemente</small></div>'
        + '</div>'
        + '<div class="sidecar-card"><strong>Executores do time</strong><small>' + escapeHtml(Array.isArray(summary.executors) ? summary.executors.join(', ') : 'n/d') + '</small></div>'
        + '</div>'
        + '<div class="cockpit-stack">'
        + '<div class="sidecar-card"><strong>Teams em destaque</strong><div class="cockpit-action-list">' + teamItems + '</div></div>'
        + '</div>'
        + '</div>';
    }

}

export function getZavorthControlClassicClientOverviewMeshTeamsScript(): string {
  return extractFunctionBody(zavorthControlClassicClientOverviewMeshTeams);
}

