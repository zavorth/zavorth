import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';

function zavorthControlClassicClientDataAudit() {
  let auditOffset = 0;
  const auditLimit = 50;
  type AuditTypeSummary = { event_type: string; c: number };
  type AuditRow = {
    event_type?: string;
    task_id?: string;
    policy_decision?: string;
    execution_success?: number;
    timestamp?: string;
    risk_level?: string;
    executor?: string;
    execution_summary?: string;
  };

  async function loadAuditStats() {
    try {
      const res = await fetch('/api/audit/stats');
      const s = await res.json();
      const cnt = document.getElementById('audit-stats-container')!;
      cnt.innerHTML = `
          <div class="metric-card"><strong>Total events</strong><div>${s.total}</div><small>All records</small></div>
          <div class="metric-card"><strong>Allowed</strong><div style="color:var(--success)">${s.allowed}</div><small>policy = ALLOWED</small></div>
          <div class="metric-card"><strong>Blocked</strong><div style="color:var(--danger)">${s.blocked}</div><small>policy != ALLOWED</small></div>
          <div class="metric-card"><strong>Latest 24h</strong><div style="color:var(--accent)">${s.recent24h}</div><small>Recent events</small></div>
        `;
      if (s.byType && s.byType.length > 0) {
        const sel = document.getElementById('audit-filter-type') as HTMLSelectElement;
        const current = sel.value;
        sel.innerHTML =
          '<option value="">All types</option>' +
          s.byType
            .map(
              (t: AuditTypeSummary) =>
                `<option value="${t.event_type}" ${t.event_type === current ? 'selected' : ''}>${t.event_type} (${t.c})</option>`,
            )
            .join('');
      }
    } catch (error: unknown) {
      console.warn('Failed to load audit stats', error);
    }
  }

  async function loadAudit() {
    await loadAuditStats();
    const eventType = (document.getElementById('audit-filter-type') as HTMLSelectElement).value;
    const policy = (document.getElementById('audit-filter-policy') as HTMLSelectElement).value;
    let url = `/api/audit...limit=${auditLimit}&offset=${auditOffset}`;
    if (eventType) url += `&event_type=${encodeURIComponent(eventType)}`;
    if (policy) url += `&policy=${encodeURIComponent(policy)}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const tbody = document.getElementById('audit-table-body')!;
      if (!data.logs || data.logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted)">No audit events.</td></tr>';
      } else {
        tbody.innerHTML = data.logs
          .map((r: AuditRow) => {
            const policyClass =
              r.policy_decision === 'ALLOWED'
                ? 'badge-allowed'
                : r.policy_decision === 'BLOCKED'
                  ? 'badge-blocked'
                  : 'badge-warning';
            const successIcon = r.execution_success === 1 ? 'ok' : r.execution_success === 0 ? 'failed' : 'unknown';
            const ts = r.timestamp ? new Date(r.timestamp).toLocaleString() : '';
            return `<tr>
              <td style="white-space:nowrap;color:var(--muted);font-size:12px">${ts}</td>
              <td><span class="badge">${r.event_type || 'unknown'}</span></td>
              <td style="font-family:monospace;font-size:12px">${(r.task_id || '').substring(0, 12)}</td>
              <td><span class="badge ${policyClass}">${r.policy_decision || 'unknown'}</span></td>
              <td style="text-align:center">${r.risk_level ?? 'unknown'}</td>
              <td>${r.executor || 'unknown'}</td>
              <td>${successIcon} <span style="color:var(--muted);font-size:12px">${(r.execution_summary || '').substring(0, 60)}</span></td>
            </tr>`;
          })
          .join('');
      }
      const page = Math.floor(auditOffset / auditLimit) + 1;
      const totalPages = Math.ceil((data.total || 0) / auditLimit);
      document.getElementById('audit-page-info')!.textContent = `Page ${page} of ${totalPages || 1}`;
      (document.getElementById('audit-prev-btn') as HTMLButtonElement).disabled = auditOffset <= 0;
      (document.getElementById('audit-next-btn') as HTMLButtonElement).disabled =
        auditOffset + auditLimit >= (data.total || 0);
    } catch (error: unknown) {
      document.getElementById('audit-table-body')!.innerHTML =
        '<tr><td colspan="7" style="color:var(--danger)">Failed to load audit log.</td></tr>';
    }
  }

  // Consumed at runtime via extractFunctionBody(); bound by the audit log toolbar.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function auditPrev() {
    auditOffset = Math.max(0, auditOffset - auditLimit);
    loadAudit();
  }
  // Consumed at runtime via extractFunctionBody(); bound by the audit log toolbar.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function auditNext() {
    auditOffset += auditLimit;
    loadAudit();
  }
}

export function getZavorthControlClassicClientDataAuditScript(): string {
  return extractFunctionBody(zavorthControlClassicClientDataAudit);
}
