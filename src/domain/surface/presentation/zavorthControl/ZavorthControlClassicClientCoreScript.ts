// @ts-nocheck
import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';

function zavorthControlClassicClientCore() {
    // Tab Navigation
    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      event.target.classList.add('active');
      document.getElementById('view-' + tabId).classList.add('active');
      
      if(tabId === 'logs') loadLogs();
      if(tabId === 'audit') loadAudit();
      if(tabId === 'snippets') loadSnippets();
    }

    // Toast Notification
    function showToast(msg, isError) {
      const t = document.getElementById('toast');
      t.innerText = msg;
      t.style.background = isError ? '#ff4757' : '#2ed573';
      t.style.color = isError ? '#fff' : '#000';
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 3000);
    }

    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // Metrics Loader
    async function loadMetrics() {
      try {
        const [statsRes, opsRes, briefRes, overviewRes, trustOverviewRes, productOverviewRes, controlPlaneCatalogRes, memoryPlaneRes, continuityRes, replayRes, lifecycleRes, handoffRes, capabilitiesRes, pluginsRes, channelsRes, securityMeshRes, runtimeModesRes, nodesRes, teamsRes, integrationsRes, cockpitRes, reportRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/operations/health'),
          fetch('/api/operations/brief'),
          fetch('/api/operations/overview'),
          fetch('/api/operations/trust-overview'),
          fetch('/api/operations/product-overview'),
          fetch('/api/operations/control-plane-catalog'),
          fetch('/api/operations/memory-plane'),
          fetch('/api/operations/continuity'),
          fetch('/api/operations/replay'),
          fetch('/api/operations/lifecycle'),
          fetch('/api/operations/handoff'),
          fetch('/api/operations/capabilities'),
          fetch('/api/operations/plugins'),
          fetch('/api/operations/channels'),
          fetch('/api/operations/security-mesh'),
          fetch('/api/operations/runtime-modes'),
          fetch('/api/operations/nodes'),
          fetch('/api/operations/teams'),
          fetch('/api/operations/integrations'),
          fetch('/api/operations/cockpit'),
          fetch('/api/operations/report'),
        ]);
        const stats = await statsRes.json();
        const operations = await opsRes.json();
        const brief = await briefRes.json();
        const overview = await overviewRes.json();
        const trustOverview = await trustOverviewRes.json();
        const productOverview = await productOverviewRes.json();
        const controlPlaneCatalog = await controlPlaneCatalogRes.json();
        const memoryPlane = await memoryPlaneRes.json();
        const continuity = await continuityRes.json();
        const replay = await replayRes.json();
        const lifecycle = await lifecycleRes.json();
        const handoff = await handoffRes.json();
        const capabilities = await capabilitiesRes.json();
        const plugins = await pluginsRes.json();
        const channels = await channelsRes.json();
        const securityMesh = await securityMeshRes.json();
        const runtimeModes = await runtimeModesRes.json();
        const nodes = await nodesRes.json();
        const teams = await teamsRes.json();
        const integrations = await integrationsRes.json();
        const cockpit = await cockpitRes.json();
        const report = await reportRes.json();
        const cnt = document.getElementById('metrics-container');
        const sidecarNode = document.getElementById('sidecar-links');
        if (stats.error) {
           cnt.innerHTML = `<div class="metric-card" style="grid-column: 1/-1"><strong>Erro</strong><div>${stats.error}</div></div>`;
           if (sidecarNode) {
             sidecarNode.innerHTML = '<div class="muted">Nao foi possivel carregar sidecars.</div>';
           }
           return;
        }
        renderOperatorBrief(brief);
        renderOperationsOverview(overview);
        renderOperationsTrustOverview(trustOverview);
        renderOperationsProductOverview(productOverview);
        renderOperationsControlPlaneCatalog(controlPlaneCatalog);
        renderOperationsMemoryPlane(memoryPlane);
        renderOperationsContinuity(continuity);
        renderOperationsReplay(replay);
        renderOperationsLifecycle(lifecycle);
        renderOperationsHandoff(handoff);
        renderOperationsCapabilities(capabilities);
        renderOperationsPlugins(plugins);
        renderOperationsChannels(channels);
        renderOperationsSecurityMesh(securityMesh);
        renderOperationsRuntimeModes(runtimeModes);
        renderOperationsNodes(nodes);
        renderOperationsTeams(teams);
        renderOperationsIntegrations(integrations);
        renderOperationsCockpit(cockpit);
        renderOperationsReport(report);
        renderSidecars((operations && operations.sidecars) || stats.sidecars || {});
        renderOperationsHealth(operations);
        cnt.innerHTML = `
          <div class="metric-card">
            <strong>Arquitetura</strong>
            <div>${stats.cpuUsage}</div>
            <small>Plataforma: ${stats.platform}</small>
          </div>
          <div class="metric-card">
            <strong>Memoria RSS</strong>
            <div>${stats.memoryUsage}</div>
            <small>${stats.heapUsage}</small>
          </div>
          <div class="metric-card">
            <strong>Uptime</strong>
            <div>${stats.uptime}</div>
            <small>Heartbeat ON</small>
          </div>
        `;
      } catch(e) {}
    }

    function formatBytes(bytes) {
      const value = Number(bytes || 0);
      if (!Number.isFinite(value) || value <= 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let current = value;
      let unitIndex = 0;
      while (current >= 1024 && unitIndex < units.length - 1) {
        current /= 1024;
        unitIndex += 1;
      }
      const decimals = current >= 10 || unitIndex === 0 ? 0 : 2;
      return current.toFixed(decimals) + ' ' + units[unitIndex];
    }

    function formatRelativeTime(value) {
      if (!value) return 'Nunca';
      const target = new Date(value);
      const diffMs = Date.now() - target.getTime();
      if (!Number.isFinite(diffMs)) return value;
      const minutes = Math.round(diffMs / 60000);
      if (minutes < 1) return 'agora';
      if (minutes < 60) return 'ha ' + minutes + ' min';
      const hours = Math.round(minutes / 60);
      if (hours < 24) return 'ha ' + hours + ' h';
      const days = Math.round(hours / 24);
      return 'ha ' + days + ' d';
    }
}

export function getZavorthControlClassicClientCoreScript(): string {
  return extractFunctionBody(zavorthControlClassicClientCore);
}

