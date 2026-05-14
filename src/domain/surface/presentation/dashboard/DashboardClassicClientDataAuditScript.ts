// @ts-nocheck
import { extractFunctionBody } from './DashboardClassicScriptUtils.js';

function dashboardClassicClientDataAudit() {
    let auditOffset = 0;
    const auditLimit = 50;

    async function loadAuditStats() {
      try {
        const res = await fetch('/api/audit/stats');
        const s = await res.json();
        const cnt = document.getElementById('audit-stats-container');
        cnt.innerHTML = `
          <div class="metric-card"><strong>Total de Eventos</strong><div>${s.total}</div><small>Todos os registros</small></div>
          <div class="metric-card"><strong>Permitidos</strong><div style="color:var(--success)">${s.allowed}</div><small>policy = ALLOWED</small></div>
          <div class="metric-card"><strong>Bloqueados</strong><div style="color:var(--danger)">${s.blocked}</div><small>policy != ALLOWED</small></div>
          <div class="metric-card"><strong>Ultimas 24h</strong><div style="color:var(--accent)">${s.recent24h}</div><small>Eventos recentes</small></div>
        `;
        if (s.byType && s.byType.length > 0) {
          const sel = document.getElementById('audit-filter-type');
          const current = sel.value;
          sel.innerHTML = '<option value="">Todos os tipos</option>' +
            s.byType.map(t => `<option value="${t.event_type}" ${t.event_type === current ? 'selected' : ''}>${t.event_type} (${t.c})</option>`).join('');
        }
      } catch(e) {}
    }

    async function loadAudit() {
      await loadAuditStats();
      const eventType = document.getElementById('audit-filter-type').value;
      const policy = document.getElementById('audit-filter-policy').value;
      let url = `/api/audit?limit=${auditLimit}&offset=${auditOffset}`;
      if (eventType) url += `&event_type=${encodeURIComponent(eventType)}`;
      if (policy) url += `&policy=${encodeURIComponent(policy)}`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        const tbody = document.getElementById('audit-table-body');
        if (!data.logs || data.logs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted)">Nenhum evento de audit.</td></tr>';
        } else {
          tbody.innerHTML = data.logs.map(r => {
            const policyClass = r.policy_decision === 'ALLOWED' ? 'badge-allowed' : (r.policy_decision === 'BLOCKED' ? 'badge-blocked' : 'badge-warning');
            const successIcon = r.execution_success === 1 ? 'Ã¢Å“â€¦' : (r.execution_success === 0 ? 'Ã¢ÂÅ’' : 'Ã¢â‚¬â€');
            const ts = r.timestamp ? new Date(r.timestamp).toLocaleString() : '';
            return `<tr>
              <td style="white-space:nowrap;color:var(--muted);font-size:12px">${ts}</td>
              <td><span class="badge">${r.event_type || 'Ã¢â‚¬â€'}</span></td>
              <td style="font-family:monospace;font-size:12px">${(r.task_id||'').substring(0,12)}</td>
              <td><span class="badge ${policyClass}">${r.policy_decision || 'Ã¢â‚¬â€'}</span></td>
              <td style="text-align:center">${r.risk_level ?? 'Ã¢â‚¬â€'}</td>
              <td>${r.executor || 'Ã¢â‚¬â€'}</td>
              <td>${successIcon} <span style="color:var(--muted);font-size:12px">${(r.execution_summary||'').substring(0,60)}</span></td>
            </tr>`;
          }).join('');
        }
        const page = Math.floor(auditOffset / auditLimit) + 1;
        const totalPages = Math.ceil((data.total || 0) / auditLimit);
        document.getElementById('audit-page-info').textContent = `Pagina ${page} de ${totalPages || 1}`;
        document.getElementById('audit-prev-btn').disabled = auditOffset <= 0;
        document.getElementById('audit-next-btn').disabled = auditOffset + auditLimit >= (data.total || 0);
      } catch(e) {
        document.getElementById('audit-table-body').innerHTML = '<tr><td colspan="7" style="color:var(--danger)">Falha ao carregar audit log.</td></tr>';
      }
    }

    function auditPrev() { auditOffset = Math.max(0, auditOffset - auditLimit); loadAudit(); }
    function auditNext() { auditOffset += auditLimit; loadAudit(); }
}

export function getDashboardClassicClientDataAuditScript(): string {
  return extractFunctionBody(dashboardClassicClientDataAudit);
}

