import { getZavorthControlClassicClientScript } from './ZavorthControlClassicClientScript.js';
import { ZAVORTH_CONTROL_CLASSIC_STYLES } from './ZavorthControlClassicStyles.js';

export type ZavorthControlClassicAssetInput = {
  host: string;
  port: number;
  publicBaseUrl: string | null;
  auditReplaySummary?: string | null;
  auditTrailSummary?: string | null;
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class ZavorthControlClassicAssetService {
  public render(input: ZavorthControlClassicAssetInput): string {
    const { host, port, publicBaseUrl, auditReplaySummary, auditTrailSummary } = input;
    const publicUrlBlock = publicBaseUrl ? `<p class="muted" style="margin-top:0;">Public URL configured: <a href="${escapeHtml(publicBaseUrl)}" target="_blank">${escapeHtml(publicBaseUrl)}</a></p>`
      : '<p class="muted" style="margin-top:0;">Local panel. No Public URL configured.</p>';
    const webAppBlock =
      '<p class="muted" style="margin-top:0;">Primary web entry: <a href="/zavorthControl">/zavorthControl</a>. Legacy /app and /classic routes were removed.</p>';
    const sidecarIntroBlock =
      '<div id="sidecar-links" class="card" style="margin-bottom:24px;">Loading sidecars...</div>';
    const operationsBriefBlock =
      '<div id="operations-brief" class="card" style="margin-bottom:24px;">Loading operator briefing...</div>';
    const operationsOverviewBlock =
      '<div id="operations-overview" class="card" style="margin-bottom:24px;">Loading operational overview...</div>';
    const operationsTrustOverviewBlock =
      '<div id="operations-trust-overview" class="card" style="margin-bottom:24px;">Loading trust overview...</div>';
    const operationsProductOverviewBlock =
      '<div id="operations-product-overview" class="card" style="margin-bottom:24px;">Loading product overview...</div>';
    const operationsControlPlaneCatalogBlock =
      '<div id="operations-control-plane-catalog" class="card" style="margin-bottom:24px;">Loading control plane catalog...</div>';
    const operationsMemoryPlaneBlock =
      '<div id="operations-memory-plane" class="card" style="margin-bottom:24px;">Loading resume and deliveries...</div>';
    const operationsContinuityBlock =
      '<div id="operations-continuity" class="card" style="margin-bottom:24px;">Loading cross-surface continuity...</div>';
    const operationsReplayBlock =
      '<div id="operations-replay" class="card" style="margin-bottom:24px;">Loading operational replay...</div>';
    const operationsLifecycleBlock =
      '<div id="operations-lifecycle" class="card" style="margin-bottom:24px;">Loading execution lifecycle...</div>';
    const operationsHandoffBlock =
      '<div id="operations-handoff" class="card" style="margin-bottom:24px;">Loading session handoff...</div>';
    const operationsCapabilitiesBlock =
      '<div id="operations-capabilities" class="card" style="margin-bottom:24px;">Loading capability catalog...</div>';
    const operationsPluginsBlock =
      '<div id="operations-plugins" class="card" style="margin-bottom:24px;">Loading plugin plane...</div>';
    const operationsChannelsBlock =
      '<div id="operations-channels" class="card" style="margin-bottom:24px;">Loading Channel Mesh...</div>';
    const operationsSecurityMeshBlock =
      '<div id="operations-security-mesh" class="card" style="margin-bottom:24px;">Loading Runtime & Security Mesh...</div>';
    const operationsRuntimeModesBlock =
      '<div id="operations-runtime-modes" class="card" style="margin-bottom:24px;">Loading runtime modes...</div>';
    const operationsNodesBlock =
      '<div id="operations-nodes" class="card" style="margin-bottom:24px;">Loading Node Mesh...</div>';
    const operationsTeamsBlock =
      '<div id="operations-teams" class="card" style="margin-bottom:24px;">Loading composed teams...</div>';
    const operationsIntegrationsBlock =
      '<div id="operations-integrations" class="card" style="margin-bottom:24px;">Loading Integration Hub...</div>';
    const operationsCockpitBlock =
      '<div id="operations-cockpit" class="card" style="margin-bottom:24px;">Loading operational cockpit...</div>';
    const operationsReportBlock =
      '<div id="operations-report" class="card" style="margin-bottom:24px;">Loading consolidated report...</div>';
    const operationsHealthBlock =
      '<div id="operations-health" class="card" style="margin-bottom:24px;">Loading operational health...</div>';
    const initialAuditSummaryBlock = [auditTrailSummary, auditReplaySummary]
      .filter((value): value is string => Boolean(value && String(value).trim()))
      .map((value) => `<span class="muted" style="font-size:13px;">${escapeHtml(value)}</span>`)
      .join('');

    return `
<!DOCTYPE html>
<html lang="en-US">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zavorth Classic ZavorthControl</title>
  <style>
${ZAVORTH_CONTROL_CLASSIC_STYLES}
  </style>
</head>
<body>
  <header class="header">
    <h1><span>Legacy</span> Zavorth Classic ZavorthControl</h1>
    <div style="font-size: 14px; color: var(--muted)">Host: ${escapeHtml(host)}:${escapeHtml(port)}</div>
  </header>

  <main class="shell">
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('overview')">Overview</button>
      <button class="tab-btn" onclick="switchTab('logs')">System Logs</button>
      <button class="tab-btn" onclick="switchTab('audit')">Audit Trail</button>
      <button class="tab-btn" onclick="switchTab('snippets')">Snippets</button>
    </div>

    <!-- OVERVIEW TAB -->
    <div id="view-overview" class="view active">
      ${publicUrlBlock}
      ${webAppBlock}
      <div id="classic-legacy-banner" class="card" style="margin-bottom:24px;">
        <div style="display:grid; gap:8px;">
          <strong>This panel must not be served as a public route.</strong>
          <span class="muted">Use <a href="/zavorthControl">/zavorthControl</a> as the primary Zavorth entry. Legacy <code>/app</code> and <code>/classic</code> routes were removed.</span>
          ${initialAuditSummaryBlock}
        </div>
      </div>
${operationsBriefBlock}
        ${operationsOverviewBlock}
        ${operationsTrustOverviewBlock}
        ${operationsProductOverviewBlock}
        ${operationsControlPlaneCatalogBlock}
        ${operationsMemoryPlaneBlock}
        ${operationsContinuityBlock}
        ${operationsReplayBlock}
        ${operationsLifecycleBlock}
        ${operationsHandoffBlock}
        ${operationsCapabilitiesBlock}
        ${operationsPluginsBlock}
        ${operationsChannelsBlock}
        ${operationsSecurityMeshBlock}
        ${operationsRuntimeModesBlock}
        ${operationsNodesBlock}
        ${operationsTeamsBlock}
${operationsIntegrationsBlock}
${operationsCockpitBlock}
${operationsReportBlock}
      ${sidecarIntroBlock}
      ${operationsHealthBlock}
      <div class="grid-metrics" id="metrics-container">
        <!-- Rendered via JS -->
      </div>
    </div>

    <!-- LOGS TAB -->
    <div id="view-logs" class="view card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
         <h2 style="margin: 0">System Logs</h2>
         <button class="btn btn-primary" onclick="loadLogs()">Refresh Logs</button>
      </div>
      <div class="log-list" id="log-container">
        Loading logs...
      </div>
    </div>

    <!-- AUDIT TRAIL TAB -->
    <div id="view-audit" class="view">
      <div class="grid-metrics" id="audit-stats-container"></div>
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
           <h2 style="margin: 0">Audit Trail</h2>
           <button class="btn btn-primary" onclick="loadAudit()">Refresh</button>
        </div>
        <div class="audit-filters">
          <select id="audit-filter-type" onchange="loadAudit()">
            <option value="">All types</option>
          </select>
          <select id="audit-filter-policy" onchange="loadAudit()">
            <option value="">All decisions</option>
            <option value="ALLOWED">ALLOWED</option>
            <option value="BLOCKED">BLOCKED</option>
            <option value="DENIED">DENIED</option>
          </select>
        </div>
        <div style="overflow-x:auto;">
          <table class="audit-table">
            <thead><tr>
              <th>Timestamp</th><th>Event</th><th>Task ID</th>
              <th>Decision</th><th>Risk</th><th>Executor</th><th>Result</th>
            </tr></thead>
            <tbody id="audit-table-body">Loading...</tbody>
          </table>
        </div>
        <div class="audit-pagetion">
          <button onclick="auditPrev()" id="audit-prev-btn" disabled>&larr; Previous</button>
          <span id="audit-page-info" style="color:var(--muted);font-size:13px;"></span>
          <button onclick="auditNext()" id="audit-next-btn">Next &rarr;</button>
        </div>
      </div>
    </div>

    <!-- SNIPPETS TAB -->
    <div id="view-snippets" class="view">
      <div class="snippet-grid">
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0">Library</h3>
            <button class="btn btn-primary" style="padding: 6px 12px;" onclick="newSnippet()">+ New</button>
          </div>
          <div class="snippet-list" id="snippet-list-container">
             Loading snippets...
          </div>
        </div>
        <div class="card snippet-editor">
          <input type="text" id="snippet-name" class="form-input" placeholder="Snippet name (e.g. setup-win)">
          <textarea id="snippet-content" class="form-input" placeholder="Paste raw code/text here?"></textarea>
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button class="btn btn-danger" id="snippet-btn-del" style="display: none;" onclick="deleteSnippet()">Delete</button>
            <button class="btn btn-primary" onclick="saveSnippet()">Save Snippet</button>
          </div>
        </div>
      </div>
    </div>
  </main>

  <div id="toast" class="toast">Saved successfully!</div>
  <script>
${getZavorthControlClassicClientScript()}
  </script>
</body>
</html>
    `.trim();
  }
}
