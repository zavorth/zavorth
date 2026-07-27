import { translate, translateCount } from './locale';
import { computeNextAction, renderNextActionBar } from './next-action-ui';
import {
  buildControlReadinessItems,
  classifyControlReadiness,
  composeTrustLoopPanelModel,
  readHonestBoolean,
} from './trust-loop-model';
import { refreshTrustLoopUi } from './trust-loop-ui';
import { renderSessionTrustScore } from './session-trust-score';
import { updateWorkboardLite } from './workboard-lite';

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
  setDashboardText('[data-live-sync-state]', translate('Last sync'));
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
    emitSignal?: (type: string, title: string, message?: string) => void;
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
          <span>No trace yet.</span>
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

  const collectPendingApprovals = (snapshot: ReturnType<typeof getDashboardSnapshot>) => {
    const pending: Array<{ id: string; title: string; detail: string }> = [];
    const runs = Array.isArray(snapshot.liveSnapshot.runs) ? snapshot.liveSnapshot.runs : [];
    runs.forEach((run: any) => {
      const approvals = Array.isArray(run?.approvals) ? run.approvals : [];
      approvals.forEach((approval: any) => {
        if (String(approval?.status || 'pending') !== 'pending') return;
        pending.push({
          id: String(approval?.id || run?.id || 'approval'),
          title: String(approval?.title || approval?.action || run?.title || translate('Approval needed')),
          detail: String(approval?.summary || approval?.risk || run?.summary || translate('Decision required')),
        });
      });
    });
    return pending;
  };

  const updateAttentionList = (snapshot: ReturnType<typeof getDashboardSnapshot>) => {
    const nodes = document.querySelectorAll<HTMLElement>('[data-attention-list]');
    if (!nodes.length) return;

    const items: string[] = [];
    const authRequired = Boolean(snapshot.liveSnapshot.authRequired);
    const live = Boolean(snapshot.liveSnapshot.live);

    if (authRequired) {
      items.push(`
        <article class="daily-attention-item daily-attention-item--warn">
          <div>
            <strong>${escapeHtml(translate('Unlock runtime'))}</strong>
            <small>${escapeHtml(translate('Auth required'))}</small>
          </div>
          <button class="daily-button daily-button--primary" type="button" data-dashboard-doctor>${escapeHtml(translate('Doctor'))}</button>
        </article>
      `);
    }

    if (snapshot.activeApprovals > 0) {
      const pending = collectPendingApprovals(snapshot);
      const first = pending[0];
      items.push(`
        <article class="daily-attention-item daily-attention-item--warn">
          <div>
            <strong>${escapeHtml(translateCount('1 approval waiting', '{n} approvals waiting', snapshot.activeApprovals))}</strong>
            <small>${escapeHtml(compactTraceText(first?.title || translate('Pending decision'), 48))}</small>
          </div>
          <button class="daily-button daily-button--primary" type="button" data-dashboard-sector="sales-os">${escapeHtml(translate('Review'))}</button>
        </article>
      `);
    }

    if (snapshot.errorEvents > 0) {
      items.push(`
        <article class="daily-attention-item daily-attention-item--danger">
          <div>
            <strong>${escapeHtml(translateCount('1 error in trail', '{n} errors in trail', snapshot.errorEvents))}</strong>
            <small>${escapeHtml(translate('In recent trail'))}</small>
          </div>
          <button class="daily-button" type="button" data-dashboard-sector="instances">${escapeHtml(translate('Proof'))}</button>
        </article>
      `);
    }

    if (!live && !authRequired) {
      items.push(`
        <article class="daily-attention-item daily-attention-item--warn">
          <div>
            <strong>${escapeHtml(translate('Runtime offline'))}</strong>
            <small>${escapeHtml(translate('Run doctor'))}</small>
          </div>
          <button class="daily-button daily-button--primary" type="button" data-dashboard-doctor>${escapeHtml(translate('Doctor'))}</button>
        </article>
      `);
    }

    if (snapshot.thinking || snapshot.liveSnapshot.active) {
      const title = compactTraceText(
        snapshot.liveSnapshot.activeRun?.title
          || snapshot.liveSnapshot.activeRun?.summary
          || snapshot.lastEvent?.title
          || translate('Task running'),
        48,
      );
      items.push(`
        <article class="daily-attention-item">
          <div>
            <strong>${escapeHtml(title || translate('Task running'))}</strong>
            <small>${escapeHtml(snapshot.thinking ? translate('Working…') : translate('Active run'))}</small>
          </div>
          <button class="daily-button" type="button" data-dashboard-sector="terminal">${escapeHtml(translate('Open chat'))}</button>
        </article>
      `);
    }

    const html = items.length
      ? items.join('')
      : `<p class="daily-muted">${escapeHtml(translate('Nothing needs you'))}</p>`;
    nodes.forEach((node) => {
      node.innerHTML = html;
      node.dataset.attentionCount = String(items.length);
    });

    // Inbox banner when the user must act
    const approvalBanner = document.getElementById('approval-context-banner');
    if (approvalBanner) {
      const needsBanner = snapshot.activeApprovals > 0 || authRequired || (!live && !authRequired);
      approvalBanner.hidden = !needsBanner;
      if (snapshot.activeApprovals > 0) {
        setDashboardText('[data-inbox-approval-title]', translateCount('1 approval waiting', '{n} approvals waiting', snapshot.activeApprovals));
        setDashboardText('[data-inbox-approval-text]', translate('Review before risky work continues.'));
      } else if (authRequired) {
        setDashboardText('[data-inbox-approval-title]', translate('Unlock runtime'));
        setDashboardText('[data-inbox-approval-text]', translate('Auth required'));
      } else if (!live) {
        setDashboardText('[data-inbox-approval-title]', translate('Runtime offline'));
        setDashboardText('[data-inbox-approval-text]', translate('Run doctor'));
      }
    }
  };

  const buildTrustLoopModel = (snapshot: ReturnType<typeof getDashboardSnapshot>) => {
    const bridgeState = window.ZavorthRuntimeBridge?.state || {};
    const control = bridgeState.zavorthControl || {};
    const gatewaySnapshot = control.snapshot || {};
    const providerCatalog = bridgeState.providerModelCatalog || control.providerModelCatalog || null;
    const providerSummary = providerCatalog?.summary || providerCatalog || null;
    // Numeric live route counts only — never treat truthy catalog strings as live.
    const liveReadyRoutesRaw = Number(providerSummary?.liveReadyRoutes);
    const liveReadyRoutes = Number.isFinite(liveReadyRoutesRaw) ? Math.max(0, liveReadyRoutesRaw) : 0;
    const providerLiveFlag = providerSummary?.liveReady === true;
    const catalogOnlyRaw = Number(
      providerSummary?.catalogReadyButNotLive
      ?? providerSummary?.needsLiveProof
      ?? 0,
    );
    const catalogOnly = Number.isFinite(catalogOnlyRaw) ? Math.max(0, catalogOnlyRaw) : 0;
    const providerIsLive = liveReadyRoutes > 0 || providerLiveFlag;

    const readinessItems = buildControlReadinessItems({
      live: readHonestBoolean(snapshot.liveSnapshot.live, false),
      authRequired: readHonestBoolean(snapshot.liveSnapshot.authRequired, false),
    });

    if (providerSummary) {
      const providerBadge = classifyControlReadiness({
        liveReady: providerIsLive,
        catalogReady: !providerIsLive && catalogOnly > 0,
        configured: providerIsLive || catalogOnly > 0 ? true : false,
      });
      readinessItems.push({
        ...providerBadge,
        detail: providerBadge.state === 'live'
          ? 'Provider proven live.'
          : providerBadge.state === 'catalog'
            ? 'Provider catalog ≠ live.'
            : providerBadge.detail,
      });
    }

    const riskBudgetState =
      bridgeState.riskBudget
      || gatewaySnapshot.riskBudget
      || control.riskBudget
      || null;

    const proofs = Array.isArray(gatewaySnapshot.proofEvents)
      ? gatewaySnapshot.proofEvents
      : Array.isArray(control.proofEvents)
        ? control.proofEvents
        : [];

    const runs = Array.isArray(snapshot.liveSnapshot.runs)
      ? snapshot.liveSnapshot.runs
      : Array.isArray(gatewaySnapshot.runs)
        ? gatewaySnapshot.runs
        : [];

    return composeTrustLoopPanelModel({
      proofs,
      runs,
      riskBudgetState,
      readinessItems,
      latest: 8,
      useCacheFallback: true,
    });
  };

  const updateTrustLoop = (snapshot: ReturnType<typeof getDashboardSnapshot>) => {
    const trustLoopModel = buildTrustLoopModel(snapshot);
    refreshTrustLoopUi(trustLoopModel);
    return trustLoopModel;
  };

  const updateNextAction = (snapshot: ReturnType<typeof getDashboardSnapshot>) => {
    const trustLoopModel = updateTrustLoop(snapshot);
    const model = computeNextAction({
      pendingApprovals: snapshot.pendingApprovals,
      activeApprovals: snapshot.activeApprovals,
      errorEvents: snapshot.errorEvents,
      thinking: snapshot.thinking,
      runActive: snapshot.liveSnapshot.active,
      runTitle: compactTraceText(
        snapshot.liveSnapshot.activeRun?.title
          || snapshot.liveSnapshot.activeRun?.summary
          || snapshot.liveSnapshot.activeRun?.id
          || '',
        64,
      ),
      authRequired: Boolean(snapshot.liveSnapshot.authRequired),
      live: Boolean(snapshot.liveSnapshot.live),
      providerReady: null,
    });
    renderNextActionBar(model, {
      riskBudget: trustLoopModel.riskBudget,
      readinessItems: trustLoopModel.readinessItems,
    });

    // Highlight Review dock when pending approvals
    document.querySelectorAll<HTMLElement>('.dock-node[data-sector="sales-os"]').forEach((node) => {
      node.classList.toggle('has-badge', snapshot.activeApprovals > 0);
      let badge = node.querySelector<HTMLElement>('.dock-node__badge');
      if (snapshot.activeApprovals > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'dock-node__badge';
          node.appendChild(badge);
        }
        badge.textContent = String(snapshot.activeApprovals);
        badge.hidden = false;
      } else if (badge) {
        badge.hidden = true;
      }
    });
  };

  const updateApprovalsQueue = (snapshot: ReturnType<typeof getDashboardSnapshot>) => {
    const queue = document.querySelector<HTMLElement>('[data-approvals-queue]');
    if (!queue) return;
    if (queue.querySelector('.zavorth-approval-card')) return;

    const pending = collectPendingApprovals(snapshot);
    if (pending.length === 0 && snapshot.activeApprovals <= 0) {
      queue.innerHTML = `
        <p class="daily-muted" data-dashboard-approval-text>${escapeHtml(translate('Nothing pending.'))}</p>
        <button class="daily-button" type="button" data-dashboard-sector="terminal">${escapeHtml(translate('Open chat'))}</button>
      `;
      return;
    }

    if (pending.length === 0) {
      queue.innerHTML = `
        <article class="daily-attention-item daily-attention-item--warn">
          <div>
            <strong>${escapeHtml(translateCount('1 pending', '{n} pending', snapshot.activeApprovals))}</strong>
            <small>${escapeHtml(translate('Open chat to decide'))}</small>
          </div>
          <button class="daily-button daily-button--primary" type="button" data-dashboard-sector="terminal">${escapeHtml(translate('Open chat'))}</button>
        </article>
      `;
      return;
    }

    queue.innerHTML = pending.slice(0, 8).map((item) => `
      <article class="daily-attention-item daily-attention-item--warn" data-approval-id="${escapeHtml(item.id)}">
        <div>
          <strong>${escapeHtml(compactTraceText(item.title, 64))}</strong>
          <small>${escapeHtml(compactTraceText(item.detail, 80))}</small>
        </div>
        <button class="daily-button daily-button--primary" type="button" data-dashboard-sector="terminal">${escapeHtml(translate('Open chat'))}</button>
      </article>
    `).join('');
  };

  const updateTrustRail = (snapshot: ReturnType<typeof getDashboardSnapshot>) => {
    const pendingHost = document.getElementById('trust-pending-rail');
    if (pendingHost) {
      const pending = collectPendingApprovals(snapshot);
      if (pending.length === 0 && snapshot.activeApprovals <= 0) {
        pendingHost.innerHTML = `<p class="trust-rail__empty">${escapeHtml(translate('None'))}</p>`;
      } else if (pending.length === 0) {
        pendingHost.innerHTML = `<p class="trust-rail__empty">${escapeHtml(translateCount('1 approval waiting', '{n} approvals waiting', snapshot.activeApprovals))}</p>`;
      } else {
        pendingHost.innerHTML = pending.slice(0, 4).map((item) => `
          <article class="trust-rail__item">
            <strong>${escapeHtml(compactTraceText(item.title, 42))}</strong>
            <small>${escapeHtml(compactTraceText(item.detail, 56))}</small>
          </article>
        `).join('');
      }
    }

    const receiptHost = document.getElementById('trust-receipt-rail');
    if (receiptHost) {
      const lastReceipt = getTraceEvents()
        .slice()
        .reverse()
        .find((event) => traceEventClass(event.type) === 'receipt');
      if (!lastReceipt) {
        receiptHost.innerHTML = '<p class="trust-rail__empty">—</p>';
      } else {
        receiptHost.innerHTML = `
          <article class="trust-rail__item">
            <strong>${escapeHtml(compactTraceText(lastReceipt.title || translate('Proof'), 48))}</strong>
            <small>${escapeHtml(compactTraceText(lastReceipt.status || lastReceipt.time || translate('recorded'), 40))}</small>
          </article>
        `;
      }
    }
  };

  const applySessionSearchFilter = () => {
    const section = document.getElementById('sector-sessions');
    if (!section) return;
    const input = section.querySelector<HTMLInputElement>('[data-session-search]');
    if (!input) return;
    const query = String(input.value || '').trim().toLowerCase();
    section.querySelectorAll('tbody tr').forEach((row) => {
      if (!(row instanceof HTMLElement)) return;
      const haystack = String(row.textContent || '').toLowerCase();
      row.hidden = Boolean(query) && !haystack.includes(query);
    });
  };

  const bindSessionSearch = () => {
    if (document.documentElement.dataset.zavorthSessionSearchBound === '1') return;
    document.documentElement.dataset.zavorthSessionSearchBound = '1';
    document.addEventListener('input', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.matches?.('[data-session-search]')) return;
      applySessionSearchFilter();
    });
  };

  const shortRuntimeText = (
    snapshot: ReturnType<typeof getDashboardSnapshot>,
    hasActiveRun: boolean,
    activeRun: any,
  ) => {
    if (snapshot.thinking) return translate('Working…');
    if (hasActiveRun) {
      const status = dashboardStatusText(activeRun?.status || activeRun?.nextAction || activeRun?.summary, 'running');
      return compactTraceText(status, 72) || translate('Running.');
    }
    if (snapshot.activeApprovals > 0) {
      return translateCount('1 approval waiting', '{n} approvals waiting', snapshot.activeApprovals);
    }
    if (snapshot.errorEvents > 0) {
      return translateCount('1 error in trail', '{n} errors in trail', snapshot.errorEvents);
    }
    return translate('Ready.');
  };

  const updateDashboardGlass = () => {
    const hasHooks = document.querySelector(
      '.dashboard-glass, [data-zavorth-premium-dashboard-v2], [data-dashboard-runtime-text], [data-live-runtime-state], [data-attention-list]',
    );
    if (!hasHooks) return;

    bindSessionSearch();

    const snapshot = getDashboardSnapshot();
    const activeRun = snapshot.liveSnapshot.activeRun;
    const hasActiveRun = snapshot.liveSnapshot.active;
    setLiveStrip(
      snapshot.thinking
        ? translate('Working')
        : hasActiveRun
          ? translate('Task running')
          : snapshot.activeApprovals > 0
            ? translate('Decision needed')
            : translate('Ready'),
      hasActiveRun
        ? dashboardStatusText(activeRun?.status || activeRun?.title, 'active')
        : snapshot.lastEvent
          ? dashboardStatusText(snapshot.lastEvent.title, 'updated')
          : translate('Idle'),
      snapshot.liveSnapshot.modelLabel || snapshot.modelLabel || translate('Gateway'),
      snapshot.liveSnapshot.routeLabel || getCurrentModelRouteLabel(),
      snapshot.lastEvent ? snapshot.lastEvent.time || translate('Just now') : translate('Just now'),
    );

    const runtimeTitle = snapshot.thinking
      ? translate('Task in progress')
      : hasActiveRun
        ? compactTraceText(activeRun?.title || activeRun?.summary || activeRun?.id, 80)
        : translate('No task running');
    const runtimeText = shortRuntimeText(snapshot, hasActiveRun, activeRun);
    setDashboardText('[data-dashboard-runtime-title]', runtimeTitle);
    setDashboardText('[data-dashboard-runtime-text]', runtimeText);

    setDashboardText('[data-dashboard-approval-title]', snapshot.activeApprovals > 0
      ? translateCount('1 pending', '{n} pending', snapshot.activeApprovals)
      : translate('Nothing needs you'));
    setDashboardText('[data-dashboard-approval-text]', snapshot.activeApprovals > 0
      ? translate('Review pending decisions.')
      : translate('Nothing pending.'));

    const approvalBanner = document.getElementById('approval-context-banner');
    if (approvalBanner) approvalBanner.hidden = snapshot.activeApprovals <= 0;
    setDashboardText('[data-inbox-approval-title]', snapshot.activeApprovals > 0
      ? translateCount('1 pending', '{n} pending', snapshot.activeApprovals)
      : translate('No pending approvals'));
    setDashboardText('[data-inbox-approval-text]', snapshot.activeApprovals > 0
      ? translate('Review pending decisions.')
      : translate('Nothing pending.'));

    setDashboardText('[data-dashboard-remote="mcp"]', snapshot.pendingRemoteMesh > 0
      ? translateCount('1 pending', '{n} pending', snapshot.pendingRemoteMesh)
      : snapshot.receiptEvents > 0
        ? translate('receipt ok')
        : translate('protected'));
    setDashboardText(
      '[data-dashboard-remote="docker"]',
      snapshot.pendingRemoteMesh > 0 ? translate('waiting') : translate('gated'),
    );
    setDashboardText(
      '[data-dashboard-remote="files"]',
      snapshot.artifactCount > 0 ? translate('scoped') : translate('read'),
    );

    setDashboardText('[data-dashboard-strip="status"]', snapshot.thinking ? translate('running') : translate('online'));
    setDashboardText('[data-dashboard-strip-detail="status"]', snapshot.lastEvent
      ? dashboardStatusText(snapshot.lastEvent.title, 'updated')
      : translate('local'));
    setDashboardText('[data-dashboard-strip="model"]', snapshot.modelLabel);
    setDashboardText('[data-dashboard-strip-detail="model"]', getCurrentModelRouteLabel());
    setDashboardText(
      '[data-dashboard-strip="budget"]',
      snapshot.totalEvents > 0
        ? translate('{n} evt').replace('{n}', String(snapshot.totalEvents))
        : translate('0 evt'),
    );
    setDashboardText(
      '[data-dashboard-strip-detail="budget"]',
      snapshot.errorEvents > 0
        ? translateCount('1 error', '{n} errors', snapshot.errorEvents)
        : translate('ok'),
    );
    setDashboardText(
      '[data-dashboard-strip="security"]',
      snapshot.activeApprovals > 0 ? translate('approval') : translate('active'),
    );
    setDashboardText(
      '[data-dashboard-strip-detail="security"]',
      snapshot.activeApprovals > 0 ? translate('pending') : translate('ok'),
    );
    setDashboardText('[data-inbox-metric="approvals"]', String(snapshot.activeApprovals || 0));
    setDashboardText('[data-inbox-metric="receipts"]', String(snapshot.artifactCount || snapshot.receiptEvents || 0));
    setDashboardText('[data-dashboard-metric="receipts"]', String(snapshot.artifactCount || snapshot.receiptEvents || 0));
    setDashboardText('[data-dashboard-metric="errors"]', String(snapshot.errorEvents || 0));
    setDashboardText('[data-sales-os-metric="approvals"]', String(snapshot.activeApprovals || 0));
    setDashboardText('[data-sales-os-meta="approvals"]', snapshot.activeApprovals > 0 ? 'Pending' : 'None');
    setDashboardText('[data-provider-picker="active"]', getCurrentModelRouteLabel());
    setDashboardText('[data-provider-picker="fallbacks"]', snapshot.modelLabel || 'configured');
    setDashboardText('[data-provider-picker="proof"]', snapshot.errorEvents > 0 ? 'needs review' : 'sanitized');

    updateAttentionList(snapshot);
    updateNextAction(snapshot);
    updateTrustRail(snapshot);
    updateApprovalsQueue(snapshot);
    applySessionSearchFilter();
    // Re-apply locale to any static labels that were not rebuilt via translate()
    try {
      window.ZavorthLocale?.apply?.(document.getElementById('trust-rail') || document);
    } catch {
      // optional
    }

    renderSessionTrustScore({
      pendingApprovals: snapshot.pendingApprovals,
      activeApprovals: snapshot.activeApprovals,
      errorEvents: snapshot.errorEvents,
      receiptEvents: snapshot.receiptEvents,
      gatedActions: snapshot.activeApprovals,
    });

    updateWorkboardLite(
      (Array.isArray(snapshot.liveSnapshot.runs) ? snapshot.liveSnapshot.runs : []).map((run: any) => ({
        id: run?.id,
        title: run?.title || run?.summary || run?.id,
        summary: run?.summary,
        status: run?.status,
        nextAction: run?.nextAction,
      })),
    );

    const pathLlm = document.getElementById('path-bridge-llm');
    const nodeLlm = document.getElementById('node-llm');
    const mapContainer = document.querySelector<HTMLElement>('.zavorth-connectivity-map');

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

    if (mapContainer && !mapContainer.dataset.connectivityBound) {
      mapContainer.dataset.connectivityBound = '1';
      const nodeMessages: Record<string, string> = {
        'node-user': 'Operator channel ready.',
        'node-dash': 'Control shell online.',
        'node-gate': 'Gateway connected.',
        'node-bridge': 'Runtime bridge online.',
        'node-llm': `Route: ${snapshot.liveSnapshot.routeLabel || getCurrentModelRouteLabel()}`,
      };

      mapContainer.querySelectorAll<HTMLElement>('.zavorth-conn-node').forEach((node) => {
        node.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = node.id;
          const msg = nodeMessages[id] || 'Runtime node online.';
          window.emitSignal?.('info', node.querySelector('.node-label')?.textContent || 'Runtime node', msg);
        });
      });
    }

    updateDashboardTimeline(latestTraceEvents(4));
  };

  return {
    getDashboardSnapshot,
    getLiveRuntimeSnapshot,
    updateDashboardGlass,
  };
}
