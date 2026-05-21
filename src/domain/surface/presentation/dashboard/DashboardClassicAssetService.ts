import { getDashboardClassicClientScript } from './DashboardClassicClientScript.js';
import { DASHBOARD_CLASSIC_STYLES } from './DashboardClassicStyles.js';

export type DashboardClassicAssetInput = {
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

export class DashboardClassicAssetService {
  public render(input: DashboardClassicAssetInput): string {
    const { host, port, publicBaseUrl, auditReplaySummary, auditTrailSummary } = input;
    const publicUrlBlock = publicBaseUrl
      ? `<p class="muted" style="margin-top:0;">URL publica configurada: <a href="${escapeHtml(publicBaseUrl)}" target="_blank">${escapeHtml(publicBaseUrl)}</a></p>`
      : '<p class="muted" style="margin-top:0;">Painel local. Nenhuma URL publica configurada.</p>';
    const webAppBlock = '<p class="muted" style="margin-top:0;">Entrada web principal: <a href="/control">/control</a>. <a href="/dashboard">/dashboard</a> segue como compatibilidade e <a href="/classic">/classic</a> e apenas fallback de manutencao.</p>';
    const sidecarIntroBlock = '<div id="sidecar-links" class="card" style="margin-bottom:24px;">Carregando sidecars...</div>';
    const operationsBriefBlock = '<div id="operations-brief" class="card" style="margin-bottom:24px;">Carregando briefing do operador...</div>';
    const operationsOverviewBlock = '<div id="operations-overview" class="card" style="margin-bottom:24px;">Carregando overview operacional...</div>';
    const operationsTrustOverviewBlock = '<div id="operations-trust-overview" class="card" style="margin-bottom:24px;">Carregando trust overview...</div>';
    const operationsProductOverviewBlock = '<div id="operations-product-overview" class="card" style="margin-bottom:24px;">Carregando product overview...</div>';
    const operationsControlPlaneCatalogBlock = '<div id="operations-control-plane-catalog" class="card" style="margin-bottom:24px;">Carregando catalogo de control planes...</div>';
    const operationsMemoryPlaneBlock = '<div id="operations-memory-plane" class="card" style="margin-bottom:24px;">Carregando retomada e entregas...</div>';
    const operationsContinuityBlock = '<div id="operations-continuity" class="card" style="margin-bottom:24px;">Carregando continuidade entre superficies...</div>';
    const operationsReplayBlock = '<div id="operations-replay" class="card" style="margin-bottom:24px;">Carregando replay operacional...</div>';
    const operationsLifecycleBlock = '<div id="operations-lifecycle" class="card" style="margin-bottom:24px;">Carregando lifecycle de execucao...</div>';
    const operationsHandoffBlock = '<div id="operations-handoff" class="card" style="margin-bottom:24px;">Carregando handoff de sessao...</div>';
    const operationsCapabilitiesBlock = '<div id="operations-capabilities" class="card" style="margin-bottom:24px;">Carregando catalogo de capacidades...</div>';
    const operationsPluginsBlock = '<div id="operations-plugins" class="card" style="margin-bottom:24px;">Carregando plugin plane...</div>';
    const operationsChannelsBlock = '<div id="operations-channels" class="card" style="margin-bottom:24px;">Carregando Channel Mesh...</div>';
    const operationsSecurityMeshBlock = '<div id="operations-security-mesh" class="card" style="margin-bottom:24px;">Carregando Runtime & Security Mesh...</div>';
    const operationsRuntimeModesBlock = '<div id="operations-runtime-modes" class="card" style="margin-bottom:24px;">Carregando modos de runtime...</div>';
    const operationsNodesBlock = '<div id="operations-nodes" class="card" style="margin-bottom:24px;">Carregando Node Mesh...</div>';
    const operationsTeamsBlock = '<div id="operations-teams" class="card" style="margin-bottom:24px;">Carregando teams compostos...</div>';
    const operationsIntegrationsBlock = '<div id="operations-integrations" class="card" style="margin-bottom:24px;">Carregando Integration Hub...</div>';
    const operationsCockpitBlock = '<div id="operations-cockpit" class="card" style="margin-bottom:24px;">Carregando cockpit operacional...</div>';
    const operationsReportBlock = '<div id="operations-report" class="card" style="margin-bottom:24px;">Carregando relatorio consolidado...</div>';
    const operationsHealthBlock = '<div id="operations-health" class="card" style="margin-bottom:24px;">Carregando saude operacional...</div>';
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
  <title>Zavorth Classic Dashboard</title>
  <style>
${DASHBOARD_CLASSIC_STYLES}
  </style>
</head>
<body>
  <header class="header">
    <h1><span>Legado</span> Zavorth Classic Dashboard</h1>
    <div style="font-size: 14px; color: var(--muted)">Host: ${escapeHtml(host)}:${escapeHtml(port)}</div>
  </header>

  <main class="shell">
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('overview')">Visao geral</button>
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
          <strong>Este painel e legado e esta funcionalmente congelado.</strong>
          <span class="muted">Use <a href="/control">/control</a> como entrada principal do Zavorth. <a href="/dashboard">/dashboard</a> segue compativel, enquanto <code>/app</code> e <a href="/classic">/classic</a> ficam escondidos do usuario normal e existem apenas como fallback interno de manutencao.</span>
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
        <!-- Renderizado via JS -->
      </div>
    </div>

    <!-- LOGS TAB -->
    <div id="view-logs" class="view card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
         <h2 style="margin: 0">System Logs</h2>
         <button class="btn btn-primary" onclick="loadLogs()">Atualizar Logs</button>
      </div>
      <div class="log-list" id="log-container">
        Carregando logs...
      </div>
    </div>

    <!-- AUDIT TRAIL TAB -->
    <div id="view-audit" class="view">
      <div class="grid-metrics" id="audit-stats-container"></div>
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
           <h2 style="margin: 0">Audit Trail</h2>
           <button class="btn btn-primary" onclick="loadAudit()">Atualizar</button>
        </div>
        <div class="audit-filters">
          <select id="audit-filter-type" onchange="loadAudit()">
            <option value="">Todos os tipos</option>
          </select>
          <select id="audit-filter-policy" onchange="loadAudit()">
            <option value="">Todas as decisoes</option>
            <option value="ALLOWED">ALLOWED</option>
            <option value="BLOCKED">BLOCKED</option>
            <option value="DENIED">DENIED</option>
          </select>
        </div>
        <div style="overflow-x:auto;">
          <table class="audit-table">
            <thead><tr>
              <th>Timestamp</th><th>Evento</th><th>Task ID</th>
              <th>Decisao</th><th>Risco</th><th>Executor</th><th>Resultado</th>
            </tr></thead>
            <tbody id="audit-table-body">Carregando...</tbody>
          </table>
        </div>
        <div class="audit-pagination">
          <button onclick="auditPrev()" id="audit-prev-btn" disabled>&larr; Anterior</button>
          <span id="audit-page-info" style="color:var(--muted);font-size:13px;"></span>
          <button onclick="auditNext()" id="audit-next-btn">Proximo &rarr;</button>
        </div>
      </div>
    </div>

    <!-- SNIPPETS TAB -->
    <div id="view-snippets" class="view">
      <div class="snippet-grid">
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0">Biblioteca</h3>
            <button class="btn btn-primary" style="padding: 6px 12px;" onclick="newSnippet()">+ Novo</button>
          </div>
          <div class="snippet-list" id="snippet-list-container">
             Carregando snippets...
          </div>
        </div>
        <div class="card snippet-editor">
          <input type="text" id="snippet-name" class="form-input" placeholder="Nome do Snippet (ex: setup-win)">
          <textarea id="snippet-content" class="form-input" placeholder="Cole o cÃƒÂ³digo/texto bruto aqui..."></textarea>
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button class="btn btn-danger" id="snippet-btn-del" style="display: none;" onclick="deleteSnippet()">Excluir</button>
            <button class="btn btn-primary" onclick="saveSnippet()">Salvar Snippet</button>
          </div>
        </div>
      </div>
    </div>
  </main>

  <div id="toast" class="toast">Salvo com sucesso!</div>
  <script>
${getDashboardClassicClientScript()}
  </script>
</body>
</html>
    `.trim();
  }
}
