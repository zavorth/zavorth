import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';
declare function loadLogs(): void;
declare function loadAudit(): void;
declare function loadSnippets(): void;
declare function renderOperatorBrief(brief: Record<string, unknown>): void;
declare function renderOperationsOverview(overview: Record<string, unknown>): void;
declare function renderOperationsTrustOverview(overview: Record<string, unknown>): void;
declare function renderOperationsProductOverview(overview: Record<string, unknown>): void;
declare function renderOperationsControlPlaneCatalog(catalog: Record<string, unknown>): void;
declare function renderOperationsMemoryPlane(memoryPlane: Record<string, unknown>): void;
declare function renderOperationsContinuity(continuity: Record<string, unknown>): void;
declare function renderOperationsReplay(replay: Record<string, unknown>): void;
declare function renderOperationsLifecycle(lifecycle: Record<string, unknown>): void;
declare function renderOperationsHandoff(handoff: Record<string, unknown>): void;
declare function renderOperationsCapabilities(capabilities: Record<string, unknown>): void;
declare function renderOperationsPlugins(plugins: Record<string, unknown>): void;
declare function renderOperationsChannels(channels: Record<string, unknown>): void;
declare function renderOperationsSecurityMesh(securityMesh: Record<string, unknown>): void;
declare function renderOperationsRuntimeModes(runtimeModes: Record<string, unknown>): void;
declare function renderOperationsNodes(nodes: Record<string, unknown>): void;
declare function renderOperationsTeams(teams: Record<string, unknown>): void;
declare function renderOperationsIntegrations(integrations: Record<string, unknown>): void;
declare function renderOperationsCockpit(cockpit: Record<string, unknown>): void;
declare function renderOperationsReport(report: Record<string, unknown>): void;
declare function renderSidecars(sidecars: Record<string, unknown>): void;
declare function renderOperationsHealth(operations: Record<string, unknown>): void;

function zavorthControlClassicClientCore() {
    // Tab Navigation
    function switchTab(tabId: string) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      (window.event as MouseEvent).target && ((window.event as MouseEvent).target as HTMLElement).classList.add('active');
      document.getElementById('view-' + tabId)!.classList.add('active');

      if(tabId === 'logs') loadLogs();
      if(tabId === 'audit') loadAudit();
      if(tabId === 'snippets') loadSnippets();
    }

    // Toast Notification
    function showToast(msg: string, isError?: boolean) {
      const t = document.getElementById('toast')!;
      t.innerText = msg;
      t.style.background = isError ? '#ff4757' : '#2ed573';
      t.style.color = isError ? '#fff' : '#000';
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 3000);
    }

    function escapeHtml(value: unknown) {
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
        const stats = await statsRes.json() as Record<string, unknown>;
        const operations = await opsRes.json() as Record<string, unknown>;
        const brief = await briefRes.json() as Record<string, unknown>;
        const overview = await overviewRes.json() as Record<string, unknown>;
        const trustOverview = await trustOverviewRes.json() as Record<string, unknown>;
        const productOverview = await productOverviewRes.json() as Record<string, unknown>;
        const controlPlaneCatalog = await controlPlaneCatalogRes.json() as Record<string, unknown>;
        const memoryPlane = await memoryPlaneRes.json() as Record<string, unknown>;
        const continuity = await continuityRes.json() as Record<string, unknown>;
        const replay = await replayRes.json() as Record<string, unknown>;
        const lifecycle = await lifecycleRes.json() as Record<string, unknown>;
        const handoff = await handoffRes.json() as Record<string, unknown>;
        const capabilities = await capabilitiesRes.json() as Record<string, unknown>;
        const plugins = await pluginsRes.json() as Record<string, unknown>;
        const channels = await channelsRes.json() as Record<string, unknown>;
        const securityMesh = await securityMeshRes.json() as Record<string, unknown>;
        const runtimeModes = await runtimeModesRes.json() as Record<string, unknown>;
        const nodes = await nodesRes.json() as Record<string, unknown>;
        const teams = await teamsRes.json() as Record<string, unknown>;
        const integrations = await integrationsRes.json() as Record<string, unknown>;
        const cockpit = await cockpitRes.json() as Record<string, unknown>;
        const report = await reportRes.json() as Record<string, unknown>;
        const cnt = document.getElementById('metrics-container')!;
        const sidecarNode = document.getElementById('sidecar-links');
        if (stats.error) {
           cnt.innerHTML = `<div class="metric-card" style="grid-column: 1/-1"><strong>Erro</strong><div>${stats.error}</div></div>`;
           if (sidecarNode) {
             sidecarNode.innerHTML = '<div class="muted">No foi possivel carregar sidecars.</div>';
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
        renderSidecars(((operations && operations.sidecars) || stats.sidecars || {}) as Record<string, unknown>);
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
      } catch (_e: unknown) {console.warn("[auto-fix] Empty catch block", _e); }
    }

    function formatBytes(bytes: unknown) {
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

    function formatRelativeTime(value: unknown) {
      if (!value) return 'Nunca';
      const target = new Date(String(value));
      const diffMs = Date.now() - target.getTime();
      if (!Number.isFinite(diffMs)) return String(value);
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
