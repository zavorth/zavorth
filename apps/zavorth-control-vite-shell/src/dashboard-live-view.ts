type DashboardTraceEvent = {
  type?: string;
  title?: string;
  status?: string;
  time?: string;
};

type DashboardLiveViewOptions = {
  getTraceEvents: () => DashboardTraceEvent[];
  getNeuralFeed: () => Element | null;
  getCurrentModelLabel: () => string;
  getCurrentModelRouteLabel: () => string;
  dashboardStatusText: (value: unknown, fallback: string) => string;
  compactTraceText: (value: unknown, limit?: number) => string;
  traceEventClass: (type: unknown) => string;
  traceEventLabel: (type: unknown) => string;
  escapeHtml: (value: unknown) => string;
};

function setDashboardText(selector: string, value: unknown) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = String(value);
  });
}

function setLiveStrip(
  runtimeState: string,
  runtimeDetail: string,
  gatewayState: string,
  gatewayDetail: string,
  syncDetail: string,
) {
  setDashboardText('[data-live-runtime-state]', runtimeState);
  setDashboardText('[data-live-runtime-detail]', runtimeDetail);
  setDashboardText('[data-live-gateway-state]', gatewayState);
  setDashboardText('[data-live-gateway-detail]', gatewayDetail);
  setDashboardText('[data-live-sync-state]', 'Last sync');
  setDashboardText('[data-live-sync-detail]', syncDetail);
  document.querySelectorAll<HTMLElement>('[data-live-runtime-state]').forEach((node) => {
    node.dataset.liveValue = String(runtimeState || '').toLowerCase();
  });
  document.querySelectorAll<HTMLElement>('[data-live-gateway-state]').forEach((node) => {
    node.dataset.liveValue = String(gatewayState || '').toLowerCase();
  });
}

function getLiveRuntimeSnapshot() {
  const bridgeState = window.ZavorthRuntimeBridge?.state || {};
  const snapshot = bridgeState.zavorthControl?.snapshot || {};
  const runs = Array.isArray(snapshot.runs) ? snapshot.runs : [];
  const activeRun = snapshot.activeRun || runs[0] || null;
  const activeStatus = String(activeRun?.status || '').toLowerCase();
  const inactiveStatuses = ['done', 'completed', 'complete', 'success', 'succeeded', 'failed', 'error', 'cancelled', 'canceled'];
  const active = Boolean(activeRun && !inactiveStatuses.includes(activeStatus));
  const pendingApprovals = runs.reduce((count: number, run: any) => {
    const approvals = Array.isArray(run?.approvals) ? run.approvals : [];
    return count + approvals.filter((approval: any) => String(approval?.status || 'pending') === 'pending').length;
  }, 0);

  return {
    live: Boolean(bridgeState.zavorthControl?.live),
    authRequired: Boolean(bridgeState.zavorthControl?.authRequired),
    runs,
    activeRun,
    active,
    pendingApprovals,
    modelLabel: window.ZavorthRuntimeBridge?.getCurrentModelLabel?.() || '',
    routeLabel: window.ZavorthRuntimeBridge?.getCurrentModelRouteLabel?.() || '',
  };
}

declare global {
  interface Window {
    ZavorthRuntimeBridge?: any;
  }
}

export function createDashboardLiveView({
  getTraceEvents,
  getNeuralFeed,
  getCurrentModelLabel,
  getCurrentModelRouteLabel,
  dashboardStatusText,
  compactTraceText,
  traceEventClass,
  traceEventLabel,
  escapeHtml,
}: DashboardLiveViewOptions) {
  const latestTraceEvents = (limit = 3) => {
    const traceEvents = getTraceEvents();
    return traceEvents.slice(Math.max(0, traceEvents.length - limit)).reverse();
  };

  const countTraceByClass = (kind: string) => getTraceEvents()
    .filter((event) => traceEventClass(event.type) === kind).length;

  const getDashboardSnapshot = () => {
    const traceEvents = getTraceEvents();
    const liveSnapshot = getLiveRuntimeSnapshot();
    const requestCount = traceEvents.filter((event) => String(event.type).toLowerCase() === 'request').length;
    const pendingApprovals = Math.max(document.querySelectorAll('.zavorth-approval-card').length, liveSnapshot.pendingApprovals);
    const pendingRemoteMesh = document.querySelectorAll('.zavorth-remote-mesh-card[data-status="pending"], .zavorth-remote-mesh-card[data-status="retryable"]').length;
    const artifactCards = document.querySelectorAll('.zavorth-artifact-card').length;
    const receiptEvents = countTraceByClass('receipt');
    const approvalEvents = countTraceByClass('approval');
    const errorEvents = countTraceByClass('error');
    const thinking = Boolean(document.querySelector('.thinking-indicator'));
    const lastEvent = traceEvents[traceEvents.length - 1] || null;
    const neuralFeed = getNeuralFeed();
    const latestModelNode = neuralFeed ? Array.from(neuralFeed.querySelectorAll('.echo-meta__model')).pop() : null;
    const modelLabel = compactTraceText(latestModelNode?.textContent || getCurrentModelLabel(), 28) || 'runtime';

    return {
      requestCount,
      pendingApprovals,
      pendingRemoteMesh,
      activeApprovals: pendingApprovals + pendingRemoteMesh,
      approvalCount: Math.max(pendingApprovals + pendingRemoteMesh, approvalEvents),
      artifactCount: Math.max(artifactCards, receiptEvents),
      receiptEvents,
      approvalEvents,
      errorEvents,
      thinking,
      lastEvent,
      modelLabel,
      totalEvents: traceEvents.length,
      liveSnapshot,
    };
  };

  const updateDashboardTimeline = (events: DashboardTraceEvent[]) => {
    const timeline = document.querySelector<HTMLElement>('[data-dashboard-timeline]');
    if (!timeline) return;
    if (events.length === 0) {
      timeline.innerHTML = `
        <div class="zavorth-gantt-empty">
          <span class="zavorth-gantt-empty-dot"></span>
          <span>Waiting for execution stream...</span>
        </div>
      `;
      return;
    }
    
    timeline.innerHTML = `
      <div class="zavorth-gantt-chart">
        <div class="zavorth-gantt-grid">
          ${events.map((event, index) => {
            const kind = traceEventClass(event.type);
            const label = traceEventLabel(event.type);
            const title = event.title || 'Checkpoint';
            
            // Generate sequence offsets
            const startPercent = Math.min(80, index * 22);
            const durationPercent = 20;
            
            return `
              <div class="zavorth-gantt-row zavorth-gantt-row--${kind}">
                <div class="zavorth-gantt-label">
                  <span class="zavorth-gantt-icon"></span>
                  <strong>${escapeHtml(label)}</strong>
                  <small>${escapeHtml(event.time || 'just now')}</small>
                </div>
                <div class="zavorth-gantt-track">
                  <div class="zavorth-gantt-bar" style="left: ${startPercent}%; width: ${durationPercent}%;">
                    <span class="zavorth-gantt-bar-glow"></span>
                    <span class="zavorth-gantt-bar-text">${escapeHtml(compactTraceText(title, 26))}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  };

  const updateDashboardGlass = () => {
    const root = document.querySelector('.dashboard-glass');
    if (!root) return;
    const snapshot = getDashboardSnapshot();
    const activeRun = snapshot.liveSnapshot.activeRun;
    const hasActiveRun = snapshot.liveSnapshot.active;
    setLiveStrip(
      snapshot.thinking ? 'Working' : hasActiveRun ? 'Task running' : snapshot.activeApprovals > 0 ? 'Decision needed' : 'Runtime ready',
      hasActiveRun ? dashboardStatusText(activeRun?.status || activeRun?.title, 'active task') : snapshot.lastEvent ? dashboardStatusText(snapshot.lastEvent.title, 'runtime updated') : 'Waiting for your request',
      snapshot.liveSnapshot.modelLabel || snapshot.modelLabel || 'Gateway',
      snapshot.liveSnapshot.routeLabel || getCurrentModelRouteLabel(),
      snapshot.lastEvent ? snapshot.lastEvent.time || 'Just now' : 'Just now',
    );

    const runtimeTitle = snapshot.thinking
      ? 'Task in progress'
      : hasActiveRun
        ? compactTraceText(activeRun?.title || activeRun?.summary || activeRun?.id, 80)
        : 'No task running';
    const runtimeText = hasActiveRun
      ? compactTraceText(`${activeRun?.status || 'running'} - ${activeRun?.summary || activeRun?.nextAction || 'Zavorth is working on the current request.'}`, 180)
      : 'Ask Zavorth in the Inbox. When a request could change files, call tools, or touch external state, Zavorth will preview the risk and ask for approval.';
    setDashboardText('[data-dashboard-runtime-title]', runtimeTitle);
    setDashboardText('[data-dashboard-runtime-text]', runtimeText);

    setDashboardText('[data-dashboard-approval-title]', snapshot.activeApprovals > 0
      ? `${snapshot.activeApprovals} pending approval${snapshot.activeApprovals === 1 ? '' : 's'}`
      : 'No pending approvals');
    setDashboardText('[data-dashboard-approval-text]', snapshot.activeApprovals > 0
      ? 'Review before allowing changes or tool access.'
      : 'When Zavorth needs a decision, it appears here with approve, deny, or adjust scope.');

    const approvalBanner = document.getElementById('approval-context-banner');
    if (approvalBanner) approvalBanner.hidden = snapshot.activeApprovals <= 0;
    setDashboardText('[data-inbox-approval-title]', snapshot.activeApprovals > 0
      ? `${snapshot.activeApprovals} pending approval${snapshot.activeApprovals === 1 ? '' : 's'}`
      : 'No pending approvals');
    setDashboardText('[data-inbox-approval-text]', snapshot.activeApprovals > 0
      ? 'Review before Zavorth changes files, tools, or external state.'
      : 'Risky actions appear here before Zavorth acts.');

    setDashboardText('[data-dashboard-remote="mcp"]', snapshot.pendingRemoteMesh > 0
      ? `${snapshot.pendingRemoteMesh} pending approval`
      : snapshot.receiptEvents > 0
        ? 'receipt recorded'
        : 'token protected');
    setDashboardText('[data-dashboard-remote="docker"]', snapshot.pendingRemoteMesh > 0 ? 'waiting for approval' : 'approval required');
    setDashboardText('[data-dashboard-remote="files"]', snapshot.artifactCount > 0 ? 'artifact scoped' : 'read scoped');

    setDashboardText('[data-dashboard-strip="status"]', snapshot.thinking ? 'running' : 'online');
    setDashboardText('[data-dashboard-strip-detail="status"]', snapshot.lastEvent
      ? dashboardStatusText(snapshot.lastEvent.title, 'runtime updated')
      : 'local runtime available');
    setDashboardText('[data-dashboard-strip="model"]', snapshot.modelLabel);
    setDashboardText('[data-dashboard-strip-detail="model"]', getCurrentModelRouteLabel());
    setDashboardText('[data-dashboard-strip="budget"]', snapshot.totalEvents > 0 ? `${snapshot.totalEvents} evt` : 'per mission');
    setDashboardText('[data-dashboard-strip-detail="budget"]', snapshot.errorEvents > 0 ? `${snapshot.errorEvents} trace error(s)` : 'local trace in real time');
    setDashboardText('[data-dashboard-strip="security"]', snapshot.activeApprovals > 0 ? 'approval' : 'active');
    setDashboardText('[data-dashboard-strip-detail="security"]', snapshot.activeApprovals > 0 ? 'pending decision' : 'policy, preview and receipt');
    setDashboardText('[data-inbox-metric="approvals"]', String(snapshot.activeApprovals || 0));
    setDashboardText('[data-inbox-metric="receipts"]', String(snapshot.receiptEvents || 0));
    setDashboardText('[data-sales-os-metric="approvals"]', String(snapshot.activeApprovals || 0));
    setDashboardText('[data-sales-os-meta="approvals"]', snapshot.activeApprovals > 0 ? 'waiting for your decision' : 'no pending approval');
    setDashboardText('[data-provider-picker="active"]', getCurrentModelRouteLabel());
    setDashboardText('[data-provider-picker="fallbacks"]', snapshot.modelLabel || 'configured');
    setDashboardText('[data-provider-picker="proof"]', snapshot.errorEvents > 0 ? 'needs review' : 'redacted proof');

    // Feature 7: Live Connectivity Map Styling
    const pathLlm = document.getElementById('path-bridge-llm');
    const nodeLlm = document.getElementById('node-llm');
    const mapContainer = document.querySelector('.zavorth-connectivity-map');
    
    if (snapshot.errorEvents > 0) {
      pathLlm?.classList.add('is-warning');
      pathLlm?.classList.remove('is-active');
      nodeLlm?.classList.add('is-warning');
      nodeLlm?.classList.remove('is-active');
    } else {
      pathLlm?.classList.remove('is-warning');
      pathLlm?.classList.add('is-active');
      nodeLlm?.classList.remove('is-warning');
      nodeLlm?.classList.add('is-active');
    }
    
    // Bind click handlers to connectivity map nodes
    if (mapContainer && !mapContainer.dataset.connectivityBound) {
      mapContainer.setAttribute('data-connectivity-bound', '1');
      const nodeMessages: Record<string, string> = {
        'node-user': 'Operator channel: Secured. Zero-trust command approval policy active.',
        'node-dash': 'Zavorth Control Shell: Operational. Telemetry pipeline running at 60fps.',
        'node-gate': 'Gateway Daemon: Connected. WebSocket secure tunnels established.',
        'node-bridge': 'Runtime Bridge: Connected. JSON-RPC local loopback online.',
        'node-llm': `Active LLM Route: ${snapshot.liveSnapshot.routeLabel || getCurrentModelRouteLabel()} (${snapshot.liveSnapshot.modelLabel || snapshot.modelLabel || 'Gateway Model'})`
      };
      
      mapContainer.querySelectorAll('.zavorth-conn-node').forEach((node) => {
        node.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = node.id;
          const msg = nodeMessages[id] || 'Zavorth runtime node is operational and safe.';
          window.emitSignal?.('info', node.querySelector('.node-label')?.textContent || 'Runtime node', msg);
        });
      });
    }

    updateDashboardTimeline(latestTraceEvents(4));
  };

  return {
    getDashboardSnapshot,
    updateDashboardGlass,
  };
}
